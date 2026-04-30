import request from 'supertest';
import { hash } from 'bcryptjs';
import { sign } from 'jsonwebtoken';
import app from '../src/index';
import { supabase } from '../src/config/supabase';
import { EmployeeRole, SafeUser, User, UserRole, UserStatus } from '../src/types';

const makeAdminToken = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set in test env');
  return sign({ userId: 'test-admin-id', role: 'ADMIN' }, secret, {
    expiresIn: '1h',
  });
};

type ApiResponse<T> = {
  message?: string;
  data?: T;
  token?: string;
  user?: SafeUser;
};

type SalaryValue = number | string;

type RoleSalaryConfigRow = {
  id: string;
  employee_role: EmployeeRole;
  employee_level: number | null;
  base_salary: SalaryValue;
  configured_by: string | null;
};

type UserInsert = {
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  employee_role: EmployeeRole | null;
  employee_level: number | null;
  salary: number | null;
  status: UserStatus;
};

const testRunId = Date.now().toString();
let emailCounter = 0;
const testEmails: string[] = [];
const createdUserIds: string[] = [];

const uniqueEmail = (prefix: string): string =>
  `test.${prefix}.${testRunId}.${emailCounter++}@dinely.test`;

const normalizeSalary = (value: SalaryValue): number =>
  typeof value === 'number' ? value : Number(value);

const assertNoPasswordHash = (user: SafeUser | undefined): void => {
  expect(user).toBeDefined();
  const record = user as unknown as Record<string, unknown>;
  expect(record.password_hash).toBeUndefined();
};

const fetchUserByEmail = async (email: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch user by email: ${error.message}`);
  }

  const users = data as User[] | null;
  return users && users.length > 0 ? users[0] : null;
};

const fetchRoleSalaryConfig = async (
  role: EmployeeRole,
  level: number | null
): Promise<RoleSalaryConfigRow | null> => {
  let query = supabase.from('role_salary_config').select('*').eq('employee_role', role);

  query = level === null ? query.is('employee_level', null) : query.eq('employee_level', level);

  const { data, error } = await query.limit(1);

  if (error) {
    throw new Error(`Failed to fetch role salary config: ${error.message}`);
  }

  const configs = data as RoleSalaryConfigRow[] | null;
  return configs && configs.length > 0 ? configs[0] : null;
};

const insertRoleSalaryConfig = async (
  role: EmployeeRole,
  level: number | null,
  baseSalary: number,
  configuredBy: string
): Promise<RoleSalaryConfigRow> => {
  const { data, error } = await supabase
    .from('role_salary_config')
    .insert({
      employee_role: role,
      employee_level: level,
      base_salary: baseSalary,
      configured_by: configuredBy,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to insert role salary config: ${error?.message ?? 'No data returned'}`);
  }

  return data as RoleSalaryConfigRow;
};

const updateRoleSalaryConfig = async (
  id: string,
  baseSalary: number,
  configuredBy: string
): Promise<RoleSalaryConfigRow> => {
  const { data, error } = await supabase
    .from('role_salary_config')
    .update({
      base_salary: baseSalary,
      configured_by: configuredBy,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to update role salary config: ${error?.message ?? 'No data returned'}`);
  }

  return data as RoleSalaryConfigRow;
};

const insertUser = async (payload: UserInsert): Promise<User> => {
  const { data, error } = await supabase.from('users').insert(payload).select('*').single();

  if (error || !data) {
    throw new Error(`Failed to insert user: ${error?.message ?? 'No data returned'}`);
  }

  return data as User;
};

let adminId = '';
let expectedChefSalary = 0;
const expectedGeneralSalary = 40000;
let generalConfigOriginal: { id: string; base_salary: number } | null = null;
let createdGeneralConfigId: string | null = null;
let createdChefConfigId: string | null = null;
let customerLoginEmail = '';
let employeeLoginEmail = '';
const customerLoginPassword = 'Password1';
const employeeLoginPassword = 'Password1';

beforeAll(async () => {
  const admin = await fetchUserByEmail('admin@dinely.com');
  if (!admin) {
    throw new Error('Seeded admin user not found');
  }
  adminId = admin.id;

  const chefConfig = await fetchRoleSalaryConfig('CHEF', 1);
  if (!chefConfig) {
    const createdChef = await insertRoleSalaryConfig('CHEF', 1, 35000, adminId);
    createdChefConfigId = createdChef.id;
    expectedChefSalary = normalizeSalary(createdChef.base_salary);
  } else {
    expectedChefSalary = normalizeSalary(chefConfig.base_salary);
  }

  const generalConfig = await fetchRoleSalaryConfig('GENERAL', null);
  if (!generalConfig) {
    const createdGeneral = await insertRoleSalaryConfig('GENERAL', null, expectedGeneralSalary, adminId);
    createdGeneralConfigId = createdGeneral.id;
  } else {
    const currentSalary = normalizeSalary(generalConfig.base_salary);
    if (currentSalary !== expectedGeneralSalary) {
      generalConfigOriginal = { id: generalConfig.id, base_salary: currentSalary };
      await updateRoleSalaryConfig(generalConfig.id, expectedGeneralSalary, adminId);
    }
  }

  customerLoginEmail = uniqueEmail('customer-login');
  const customerHash = await hash(customerLoginPassword, 10);
  const customer = await insertUser({
    name: 'Test Customer',
    email: customerLoginEmail,
    password_hash: customerHash,
    role: 'CUSTOMER',
    status: 'ACTIVE',
    employee_role: null,
    employee_level: null,
    salary: null,
  });
  testEmails.push(customerLoginEmail);
  createdUserIds.push(customer.id);

  employeeLoginEmail = uniqueEmail('employee-login');
  const employeeHash = await hash(employeeLoginPassword, 10);
  const employee = await insertUser({
    name: 'Test Employee',
    email: employeeLoginEmail,
    password_hash: employeeHash,
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    employee_role: 'CHEF',
    employee_level: 1,
    salary: expectedChefSalary,
  });
  testEmails.push(employeeLoginEmail);
  createdUserIds.push(employee.id);
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    const { error } = await supabase
      .from('salary_history')
      .delete()
      .in('employee_id', createdUserIds);

    if (error) {
      throw new Error(`Failed to delete salary history: ${error.message}`);
    }
  }

  if (testEmails.length > 0) {
    const { error } = await supabase.from('users').delete().in('email', testEmails);

    if (error) {
      throw new Error(`Failed to delete test users: ${error.message}`);
    }
  }

  if (createdChefConfigId) {
    const { error } = await supabase.from('role_salary_config').delete().eq('id', createdChefConfigId);
    if (error) {
      throw new Error(`Failed to delete chef salary config: ${error.message}`);
    }
  }

  if (createdGeneralConfigId) {
    const { error } = await supabase
      .from('role_salary_config')
      .delete()
      .eq('id', createdGeneralConfigId);
    if (error) {
      throw new Error(`Failed to delete general salary config: ${error.message}`);
    }
  }

  if (generalConfigOriginal) {
    await updateRoleSalaryConfig(
      generalConfigOriginal.id,
      generalConfigOriginal.base_salary,
      adminId
    );
  }
}, 20000);

describe('POST /api/auth/login', () => {
  test('Valid admin login → 200 + token + user (no password_hash)', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'admin@dinely.com',
      password: 'admin@dinely',
    });

    expect(response.status).toBe(200);
    const body = response.body as ApiResponse<SafeUser>;
    expect(typeof body.token).toBe('string');
    expect(body.user?.email).toBe('admin@dinely.com');
    assertNoPasswordHash(body.user);
  });

  test('Valid staff login → 200 + token', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'staff@test.com',
      password: 'Password1',
    });

    expect(response.status).toBe(200);
    const body = response.body as ApiResponse<SafeUser>;
    expect(typeof body.token).toBe('string');
    expect(body.user?.email).toBe('staff@test.com');
    assertNoPasswordHash(body.user);
  });

  test('Valid customer login → 200 + token', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: customerLoginEmail,
      password: customerLoginPassword,
    });

    expect(response.status).toBe(200);
    const body = response.body as ApiResponse<SafeUser>;
    expect(typeof body.token).toBe('string');
    expect(body.user?.email).toBe(customerLoginEmail);
    assertNoPasswordHash(body.user);
  });

  test('Valid employee login → 200 + token', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: employeeLoginEmail,
      password: employeeLoginPassword,
    });

    expect(response.status).toBe(200);
    const body = response.body as ApiResponse<SafeUser>;
    expect(typeof body.token).toBe('string');
    expect(body.user?.email).toBe(employeeLoginEmail);
    assertNoPasswordHash(body.user);
  });

  test('Deactivated user login attempt → 401', async () => {
    const email = uniqueEmail('login-deactivated');
    const password = 'Password1';
    const passwordHash = await hash(password, 10);
    const user = await insertUser({
      name: 'Deactivated Login',
      email,
      password_hash: passwordHash,
      role: 'CUSTOMER',
      status: 'DEACTIVATED',
      employee_role: null,
      employee_level: null,
      salary: null,
    });

    testEmails.push(email);
    createdUserIds.push(user.id);

    const response = await request(app).post('/api/auth/login').send({
      email,
      password,
    });

    expect(response.status).toBe(401);
    const body = response.body as { message?: string };
    expect(typeof body.message).toBe('string');
  });

  test('Wrong password → 401', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'admin@dinely.com',
      password: 'wrong-password',
    });

    expect(response.status).toBe(401);
    const body = response.body as { message?: string };
    expect(typeof body.message).toBe('string');
  });

  test('Non-existent email → 401', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: uniqueEmail('missing-login'),
      password: 'Password1',
    });

    expect(response.status).toBe(401);
    const body = response.body as { message?: string };
    expect(typeof body.message).toBe('string');
  });

  test('Missing email → 400', async () => {
    const response = await request(app).post('/api/auth/login').send({
      password: 'Password1',
    });

    expect(response.status).toBe(400);
    const body = response.body as { message?: string };
    expect(typeof body.message).toBe('string');
  });

  test('Missing password → 400', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'admin@dinely.com',
    });

    expect(response.status).toBe(400);
    const body = response.body as { message?: string };
    expect(typeof body.message).toBe('string');
  });

  test('Empty body → 400', async () => {
    const response = await request(app).post('/api/auth/login').send({});

    expect(response.status).toBe(400);
    const body = response.body as { message?: string };
    expect(typeof body.message).toBe('string');
  });
});

describe('POST /api/auth/register (customer)', () => {
  test('Valid registration → 201 + user (no password_hash)', async () => {
    const email = uniqueEmail('customer-register');
    const response = await request(app).post('/api/auth/register').send({
      name: 'Customer Registration',
      email,
      password: 'Password1',
    });

    expect(response.status).toBe(201);
    const body = response.body as ApiResponse<SafeUser>;
    expect(body.message).toBe('Registration successful');
    expect(body.data?.email).toBe(email);
    assertNoPasswordHash(body.data);

    if (body.data?.id) {
      createdUserIds.push(body.data.id);
    }
    testEmails.push(email);
  });

  test('Duplicate email → 400', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Duplicate Customer',
      email: customerLoginEmail,
      password: 'Password1',
    });

    expect(response.status).toBe(400);
    const body = response.body as { message?: string };
    expect(typeof body.message).toBe('string');
  });

  test('Password with no uppercase → 400', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Lowercase Password',
      email: uniqueEmail('customer-no-uppercase'),
      password: 'password1',
    });

    expect(response.status).toBe(400);
    const body = response.body as { message?: string };
    expect(typeof body.message).toBe('string');
  });

  test('Password with no number → 400', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'No Number Password',
      email: uniqueEmail('customer-no-number'),
      password: 'Password',
    });

    expect(response.status).toBe(400);
    const body = response.body as { message?: string };
    expect(typeof body.message).toBe('string');
  });

  test('Password too short (under 6) → 400', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Short Password',
      email: uniqueEmail('customer-short-pass'),
      password: 'Pa1',
    });

    expect(response.status).toBe(400);
    const body = response.body as { message?: string };
    expect(typeof body.message).toBe('string');
  });

  test('Name too short → 400', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'A',
      email: uniqueEmail('customer-short-name'),
      password: 'Password1',
    });

    expect(response.status).toBe(400);
    const body = response.body as { message?: string };
    expect(typeof body.message).toBe('string');
  });

  test('Invalid email format → 400', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Invalid Email',
      email: 'not-an-email',
      password: 'Password1',
    });

    expect(response.status).toBe(400);
    const body = response.body as { message?: string };
    expect(typeof body.message).toBe('string');
  });

  test('Missing fields → 400', async () => {
    const response = await request(app).post('/api/auth/register').send({});

    expect(response.status).toBe(400);
    const body = response.body as { message?: string };
    expect(typeof body.message).toBe('string');
  });
});

describe('POST /api/internal/register/employee', () => {
  test('Valid CHEF L1 → 201 + user with correct salary', async () => {
    const email = uniqueEmail('employee-chef');
    const response = await request(app)
      .post('/api/internal/register/employee')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({
        name: 'Chef Employee',
        email,
        password: 'Password1',
        employee_role: 'CHEF',
        employee_level: 1,
      });

    expect(response.status).toBe(201);
    const body = response.body as ApiResponse<SafeUser>;
    const salaryRaw = body.data?.salary;
    expect(salaryRaw).toBeDefined();
    expect(salaryRaw).not.toBeNull();
    const salary = normalizeSalary(salaryRaw as SalaryValue);
    expect(salary).toBe(expectedChefSalary);
    assertNoPasswordHash(body.data);

    if (body.data?.id) {
      createdUserIds.push(body.data.id);
    }
    testEmails.push(email);
  });

  test('Valid GENERAL (level 0) → 201 + user with fixed salary (40000)', async () => {
    const email = uniqueEmail('employee-general');
    const response = await request(app)
      .post('/api/internal/register/employee')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({
        name: 'General Employee',
        email,
        password: 'Password1',
        employee_role: 'GENERAL',
        employee_level: 0,
      });

    expect(response.status).toBe(201);
    const body = response.body as ApiResponse<SafeUser>;
    const salaryRaw = body.data?.salary;
    expect(salaryRaw).toBeDefined();
    expect(salaryRaw).not.toBeNull();
    const salary = normalizeSalary(salaryRaw as SalaryValue);
    expect(salary).toBe(expectedGeneralSalary);
    assertNoPasswordHash(body.data);

    if (body.data?.id) {
      createdUserIds.push(body.data.id);
    }
    testEmails.push(email);
  });

  test('Duplicate email → 400', async () => {
    const response = await request(app)
      .post('/api/internal/register/employee')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({
        name: 'Duplicate Employee',
        email: employeeLoginEmail,
        password: 'Password1',
        employee_role: 'CHEF',
        employee_level: 1,
      });

    expect(response.status).toBe(400);
    const body = response.body as { message?: string };
    expect(typeof body.message).toBe('string');
  });

  test('Invalid employee_role → 400', async () => {
    const payload: Record<string, unknown> = {
      name: 'Invalid Role',
      email: uniqueEmail('employee-invalid-role'),
      password: 'Password1',
      employee_role: 'INVALID',
      employee_level: 1,
    };

    const response = await request(app)
      .post('/api/internal/register/employee')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send(payload);

    expect(response.status).toBe(400);
    const body = response.body as { message?: string };
    expect(typeof body.message).toBe('string');
  });

  test('Level out of range for role → 400', async () => {
    const response = await request(app)
      .post('/api/internal/register/employee')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({
        name: 'Invalid Level',
        email: uniqueEmail('employee-invalid-level'),
        password: 'Password1',
        employee_role: 'CHEF',
        employee_level: 10,
      });

    expect(response.status).toBe(400);
    const body = response.body as { message?: string };
    expect(typeof body.message).toBe('string');
  });

  test('Missing fields → 400', async () => {
    const response = await request(app)
      .post('/api/internal/register/employee')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({});

    expect(response.status).toBe(400);
    const body = response.body as { message?: string };
    expect(typeof body.message).toBe('string');
  });
});

describe('GET /api/auth/me', () => {
  test('Valid Bearer token → 200 + user (no password_hash)', async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@dinely.com',
      password: 'admin@dinely',
    });

    expect(loginResponse.status).toBe(200);
    const loginBody = loginResponse.body as ApiResponse<SafeUser>;
    const token = loginBody.token;
    expect(typeof token).toBe('string');

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const body = response.body as ApiResponse<SafeUser>;
    assertNoPasswordHash(body.data);
    expect(body.data?.email).toBe('admin@dinely.com');
  });

  test('No token → 401', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(401);
    const body = response.body as { message?: string };
    expect(typeof body.message).toBe('string');
  });

  test('Invalid/malformed token → 401', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token');

    expect(response.status).toBe(401);
    const body = response.body as { message?: string };
    expect(typeof body.message).toBe('string');
  });

  test('Expired token → 401', async () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not set');
    }

    const expiredToken = sign({ userId: adminId, role: 'ADMIN' }, secret, {
      expiresIn: -10,
    });

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
    const body = response.body as { message?: string };
    expect(typeof body.message).toBe('string');
  });
});

describe('RBAC — Role Protection', () => {
  let adminToken: string;
  let staffToken: string;
  let customerToken: string;
  let employeeToken: string;

  beforeAll(async () => {
    const adminRes = await request(app).post('/api/auth/login').send({
      email: 'admin@dinely.com',
      password: 'admin@dinely',
    });
    adminToken = adminRes.body.token;

    const staffRes = await request(app).post('/api/auth/login').send({
      email: 'staff@test.com',
      password: 'Password1',
    });
    staffToken = staffRes.body.token;

    const customerRes = await request(app).post('/api/auth/login').send({
      email: customerLoginEmail,
      password: customerLoginPassword,
    });
    customerToken = customerRes.body.token;

    const employeeRes = await request(app).post('/api/auth/login').send({
      email: employeeLoginEmail,
      password: employeeLoginPassword,
    });
    employeeToken = employeeRes.body.token;
  });

  test('ADMIN token accessing ADMIN-only route → 200', async () => {
    const res = await request(app)
      .get('/api/internal/test/admin-only')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('STAFF token accessing ADMIN-only route → 403', async () => {
    const res = await request(app)
      .get('/api/internal/test/admin-only')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  test('CUSTOMER token accessing ADMIN-only route → 403', async () => {
    const res = await request(app)
      .get('/api/internal/test/admin-only')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  test('EMPLOYEE token accessing ADMIN-only route → 403', async () => {
    const res = await request(app)
      .get('/api/internal/test/admin-only')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  test('STAFF token accessing STAFF-only route → 200', async () => {
    const res = await request(app)
      .get('/api/internal/test/staff-only')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
  });

  test('CUSTOMER token accessing STAFF-only route → 403', async () => {
    const res = await request(app)
      .get('/api/internal/test/staff-only')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  test('No token accessing protected route → 401', async () => {
    const res = await request(app).get('/api/internal/test/admin-only');
    expect(res.status).toBe(401);
  });

  test('EMPLOYEE token accessing STAFF-only route → 403', async () => {
    const res = await request(app)
      .get('/api/internal/test/staff-only')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });
});

describe('JWT Middleware — Token Validation', () => {
  const requireJwtSecret = (): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not set');
    }
    return secret;
  };

  const encodePayload = (payload: Record<string, unknown>): string =>
    Buffer.from(JSON.stringify(payload)).toString('base64url');

  test('Token with valid signature but tampered payload → 401', async () => {
    const secret = requireJwtSecret();
    const token = sign({ userId: adminId, role: 'ADMIN' }, secret, { expiresIn: '1h' });
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Failed to build tampered token');
    }

    const tamperedPayload = encodePayload({ userId: adminId, role: 'STAFF' });
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tamperedToken}`);

    expect(response.status).toBe(401);
    expect((response.body as Record<string, unknown>).password_hash).toBeUndefined();
  });

  test('Token signed with wrong secret → 401', async () => {
    const token = sign({ userId: adminId, role: 'ADMIN' }, 'wrong-secret', { expiresIn: '1h' });
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect((response.body as Record<string, unknown>).password_hash).toBeUndefined();
  });

  test('Token with missing userId in payload → 401', async () => {
    const secret = requireJwtSecret();
    const token = sign({ role: 'ADMIN' }, secret, { expiresIn: '1h' });
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect((response.body as Record<string, unknown>).password_hash).toBeUndefined();
  });

  test('Token with missing role in payload → 401', async () => {
    const secret = requireJwtSecret();
    const token = sign({ userId: adminId }, secret, { expiresIn: '1h' });
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect((response.body as Record<string, unknown>).password_hash).toBeUndefined();
  });

  test('Malformed Bearer header (no "Bearer " prefix) → 401', async () => {
    const secret = requireJwtSecret();
    const token = sign({ userId: adminId, role: 'ADMIN' }, secret, { expiresIn: '1h' });
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', token);

    expect(response.status).toBe(401);
    expect((response.body as Record<string, unknown>).password_hash).toBeUndefined();
  });

  test('Empty Authorization header → 401', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', '');

    expect(response.status).toBe(401);
    expect((response.body as Record<string, unknown>).password_hash).toBeUndefined();
  });

  test('Token for a user that no longer exists in DB → 401', async () => {
    const email = uniqueEmail('jwt-deleted-user');
    const passwordHash = await hash('Password1', 10);
    const user = await insertUser({
      name: 'Deleted User',
      email,
      password_hash: passwordHash,
      role: 'CUSTOMER',
      status: 'ACTIVE',
      employee_role: null,
      employee_level: null,
      salary: null,
    });

    testEmails.push(email);
    createdUserIds.push(user.id);

    const secret = requireJwtSecret();
    const token = sign({ userId: user.id, role: user.role }, secret, { expiresIn: '1h' });

    const { error: deleteError } = await supabase.from('users').delete().eq('id', user.id);
    if (deleteError) {
      throw new Error(`Failed to delete test user: ${deleteError.message}`);
    }

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect((response.body as Record<string, unknown>).password_hash).toBeUndefined();
  });
});

let roleTestUserId = '';

describe('GET /api/admin/users', () => {
  let staffToken = '';

  beforeAll(async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'staff@test.com',
      password: 'Password1',
    });

    staffToken = response.body.token;
  });

  test('Valid admin token → 200 + array of users (no password_hash on any item)', async () => {
    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(response.status).toBe(200);
    const body = response.body as ApiResponse<SafeUser[]>;
    expect(Array.isArray(body.data)).toBe(true);

    const users = body.data ?? [];
    users.forEach((user) => assertNoPasswordHash(user));
  });

  test('Filter by role=EMPLOYEE → 200 + all returned users have role EMPLOYEE', async () => {
    const response = await request(app)
      .get('/api/admin/users')
      .query({ role: 'EMPLOYEE' })
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(response.status).toBe(200);
    const body = response.body as ApiResponse<SafeUser[]>;
    expect(Array.isArray(body.data)).toBe(true);

    const users = body.data ?? [];
    expect(users.every((user) => user.role === 'EMPLOYEE')).toBe(true);
  });

  test('No token → 401', async () => {
    const response = await request(app).get('/api/admin/users');

    expect(response.status).toBe(401);
  });

  test('Non-admin token (STAFF) → 403', async () => {
    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(response.status).toBe(403);
  });
});

describe('GET /api/admin/users/:id', () => {
  let staffToken = '';

  beforeAll(async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'staff@test.com',
      password: 'Password1',
    });

    staffToken = response.body.token;
  });

  test('Valid id → 200 + correct user (no password_hash)', async () => {
    const response = await request(app)
      .get(`/api/admin/users/${adminId}`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(response.status).toBe(200);
    const body = response.body as ApiResponse<SafeUser>;
    expect(body.data?.id).toBe(adminId);
    assertNoPasswordHash(body.data);
  });

  test('Non-existent id → 404', async () => {
    const response = await request(app)
      .get('/api/admin/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(response.status).toBe(404);
  });

  test('No token → 401', async () => {
    const response = await request(app).get(`/api/admin/users/${adminId}`);

    expect(response.status).toBe(401);
  });

  test('Non-admin token → 403', async () => {
    const response = await request(app)
      .get(`/api/admin/users/${adminId}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(response.status).toBe(403);
  });
});

describe('PATCH /api/admin/users/:id/status', () => {
  let statusTestUserId = '';
  let statusTestEmail = '';
  const statusTestPassword = 'Password1';

  beforeAll(async () => {
    statusTestEmail = uniqueEmail('admin-status');
    const passwordHash = await hash(statusTestPassword, 10);
    const user = await insertUser({
      name: 'Admin Status User',
      email: statusTestEmail,
      password_hash: passwordHash,
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      employee_role: 'CHEF',
      employee_level: 1,
      salary: expectedChefSalary,
    });

    statusTestUserId = user.id;
    testEmails.push(statusTestEmail);
    createdUserIds.push(user.id);
  });

  test('Deactivate user → 200 + status is DEACTIVATED', async () => {
    const response = await request(app)
      .patch(`/api/admin/users/${statusTestUserId}/status`)
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ status: 'DEACTIVATED' });

    expect(response.status).toBe(200);
    const body = response.body as ApiResponse<SafeUser>;
    expect(body.data?.status).toBe('DEACTIVATED');
  });

  test('Activate user → 200 + status is ACTIVE', async () => {
    const response = await request(app)
      .patch(`/api/admin/users/${statusTestUserId}/status`)
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ status: 'ACTIVE' });

    expect(response.status).toBe(200);
    const body = response.body as ApiResponse<SafeUser>;
    expect(body.data?.status).toBe('ACTIVE');
  });

  test('Deactivated user cannot login → 401', async () => {
    const deactivateResponse = await request(app)
      .patch(`/api/admin/users/${statusTestUserId}/status`)
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ status: 'DEACTIVATED' });

    expect(deactivateResponse.status).toBe(200);

    const response = await request(app).post('/api/auth/login').send({
      email: statusTestEmail,
      password: statusTestPassword,
    });

    expect(response.status).toBe(401);
  });

  test('Invalid status value → 400', async () => {
    const response = await request(app)
      .patch(`/api/admin/users/${statusTestUserId}/status`)
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ status: 'PENDING' });

    expect(response.status).toBe(400);
  });

  test('Non-existent user → 404', async () => {
    const response = await request(app)
      .patch('/api/admin/users/00000000-0000-0000-0000-000000000000/status')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ status: 'ACTIVE' });

    expect(response.status).toBe(404);
  });

  test('No token → 401', async () => {
    const response = await request(app)
      .patch(`/api/admin/users/${statusTestUserId}/status`)
      .send({ status: 'ACTIVE' });

    expect(response.status).toBe(401);
  });
});

describe('PATCH /api/admin/users/:id/role', () => {
  let roleTestEmail = '';
  const roleTestPassword = 'Password1';
  let serverLevel1Salary = 0;
  let serverLevel2Salary = 0;
  const createdServerConfigIds: string[] = [];

  beforeAll(async () => {
    const serverL1 = await fetchRoleSalaryConfig('SERVER', 1);
    if (!serverL1) {
      const created = await insertRoleSalaryConfig('SERVER', 1, 36000, adminId);
      createdServerConfigIds.push(created.id);
      serverLevel1Salary = normalizeSalary(created.base_salary);
    } else {
      serverLevel1Salary = normalizeSalary(serverL1.base_salary);
    }

    const serverL2 = await fetchRoleSalaryConfig('SERVER', 2);
    if (!serverL2) {
      const created = await insertRoleSalaryConfig('SERVER', 2, 42000, adminId);
      createdServerConfigIds.push(created.id);
      serverLevel2Salary = normalizeSalary(created.base_salary);
    } else {
      serverLevel2Salary = normalizeSalary(serverL2.base_salary);
    }

    roleTestEmail = uniqueEmail('admin-role');
    const passwordHash = await hash(roleTestPassword, 10);
    const user = await insertUser({
      name: 'Admin Role User',
      email: roleTestEmail,
      password_hash: passwordHash,
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      employee_role: 'CHEF',
      employee_level: 1,
      salary: expectedChefSalary,
    });

    roleTestUserId = user.id;
    testEmails.push(roleTestEmail);
    createdUserIds.push(user.id);
  });

  afterAll(async () => {
    if (createdServerConfigIds.length > 0) {
      const { error } = await supabase
        .from('role_salary_config')
        .delete()
        .in('id', createdServerConfigIds);

      if (error) {
        throw new Error(`Failed to delete server salary config: ${error.message}`);
      }
    }
  });

  test('Change role (CHEF→SERVER L1) → 200 + salary recalculated + trigger_type ROLE_CHANGE in salary_history', async () => {
    const response = await request(app)
      .patch(`/api/admin/users/${roleTestUserId}/role`)
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ employee_role: 'SERVER', employee_level: 1 });

    expect(response.status).toBe(200);
    const body = response.body as ApiResponse<SafeUser>;
    expect(body.data?.employee_role).toBe('SERVER');
    const salaryRaw = body.data?.salary;
    expect(salaryRaw).toBeDefined();
    const salary = normalizeSalary(salaryRaw as SalaryValue);
    expect(salary).toBe(serverLevel1Salary);

    const { data, error } = await supabase
      .from('salary_history')
      .select('*')
      .eq('employee_id', roleTestUserId)
      .order('changed_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Failed to fetch salary history: ${error.message}`);
    }

    const latest = data && data[0];
    expect(latest?.trigger_type).toBe('ROLE_CHANGE');
  });

  test('Change level only (SERVER L1→L2) → 200 + salary recalculated + trigger_type LEVEL_CHANGE in salary_history', async () => {
    const response = await request(app)
      .patch(`/api/admin/users/${roleTestUserId}/role`)
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ employee_role: 'SERVER', employee_level: 2 });

    expect(response.status).toBe(200);
    const body = response.body as ApiResponse<SafeUser>;
    const salaryRaw = body.data?.salary;
    expect(salaryRaw).toBeDefined();
    const salary = normalizeSalary(salaryRaw as SalaryValue);
    expect(salary).toBe(serverLevel2Salary);

    const { data, error } = await supabase
      .from('salary_history')
      .select('*')
      .eq('employee_id', roleTestUserId)
      .order('changed_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Failed to fetch salary history: ${error.message}`);
    }

    const latest = data && data[0];
    expect(latest?.trigger_type).toBe('LEVEL_CHANGE');
  });

  test('Change to GENERAL (level 0) → 200 + employee_level is null in response + salary is 40000', async () => {
    const response = await request(app)
      .patch(`/api/admin/users/${roleTestUserId}/role`)
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ employee_role: 'GENERAL', employee_level: 0 });

    expect(response.status).toBe(200);
    const body = response.body as ApiResponse<SafeUser>;
    expect(body.data?.employee_level).toBeNull();
    const salaryRaw = body.data?.salary;
    expect(salaryRaw).toBeDefined();
    const salary = normalizeSalary(salaryRaw as SalaryValue);
    expect(salary).toBe(expectedGeneralSalary);
  });

  test('Non-existent user → 404', async () => {
    const response = await request(app)
      .patch('/api/admin/users/00000000-0000-0000-0000-000000000000/role')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ employee_role: 'CHEF', employee_level: 1 });

    expect(response.status).toBe(404);
  });

  test('Invalid employee_role → 400', async () => {
    const payload: Record<string, unknown> = {
      employee_role: 'INVALID',
      employee_level: 1,
    };

    const response = await request(app)
      .patch(`/api/admin/users/${roleTestUserId}/role`)
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send(payload);

    expect(response.status).toBe(400);
  });

  test('Missing fields → 400', async () => {
    const response = await request(app)
      .patch(`/api/admin/users/${roleTestUserId}/role`)
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({});

    expect(response.status).toBe(400);
  });

  test('No token → 401', async () => {
    const response = await request(app)
      .patch(`/api/admin/users/${roleTestUserId}/role`)
      .send({ employee_role: 'CHEF', employee_level: 1 });

    expect(response.status).toBe(401);
  });
});

describe('GET /api/admin/users/:id/salary-history', () => {
  let customerHistoryUserId = '';
  let customerHistoryEmail = '';

  beforeAll(async () => {
    customerHistoryEmail = uniqueEmail('admin-history');
    const passwordHash = await hash('Password1', 10);
    const user = await insertUser({
      name: 'History Customer',
      email: customerHistoryEmail,
      password_hash: passwordHash,
      role: 'CUSTOMER',
      status: 'ACTIVE',
      employee_role: null,
      employee_level: null,
      salary: null,
    });

    customerHistoryUserId = user.id;
    testEmails.push(customerHistoryEmail);
    createdUserIds.push(user.id);
  });

  test('Employee with history → 200 + non-empty array ordered by changed_at desc', async () => {
    const response = await request(app)
      .get(`/api/admin/users/${roleTestUserId}/salary-history`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(response.status).toBe(200);
    const body = response.body as ApiResponse<Record<string, unknown>[]>;
    expect(Array.isArray(body.data)).toBe(true);

    const history = body.data ?? [];
    expect(history.length).toBeGreaterThan(0);

    if (history.length > 1) {
      const first = new Date(history[0].changed_at as string).getTime();
      const second = new Date(history[1].changed_at as string).getTime();
      expect(first).toBeGreaterThanOrEqual(second);
    }
  });

  test('Non-employee user (customer) → 200 + empty array', async () => {
    const response = await request(app)
      .get(`/api/admin/users/${customerHistoryUserId}/salary-history`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(response.status).toBe(200);
    const body = response.body as ApiResponse<Record<string, unknown>[]>;
    expect(Array.isArray(body.data)).toBe(true);
    expect((body.data ?? []).length).toBe(0);
  });

  test('Non-existent user → 404', async () => {
    const response = await request(app)
      .get('/api/admin/users/00000000-0000-0000-0000-000000000000/salary-history')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(response.status).toBe(404);
  });

  test('No token → 401', async () => {
    const response = await request(app).get(
      `/api/admin/users/${customerHistoryUserId}/salary-history`
    );

    expect(response.status).toBe(401);
  });
});

describe('DELETE /api/admin/users/:id', () => {
  let deleteTestUserId = '';
  let deleteTestEmail = '';
  let staffToken = '';

  beforeAll(async () => {
    deleteTestEmail = uniqueEmail('admin-delete');
    const passwordHash = await hash('Password1', 10);
    const user = await insertUser({
      name: 'Delete Customer',
      email: deleteTestEmail,
      password_hash: passwordHash,
      role: 'CUSTOMER',
      status: 'ACTIVE',
      employee_role: null,
      employee_level: null,
      salary: null,
    });

    deleteTestUserId = user.id;
    testEmails.push(deleteTestEmail);

    const staffLogin = await request(app).post('/api/auth/login').send({
      email: 'staff@test.com',
      password: 'Password1',
    });
    staffToken = staffLogin.body.token;
  });

  test('Valid delete → 200 + user no longer exists in DB', async () => {
    const response = await request(app)
      .delete(`/api/admin/users/${deleteTestUserId}`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(response.status).toBe(200);

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', deleteTestUserId)
      .limit(1);

    if (error) {
      throw new Error(`Failed to fetch user by id: ${error.message}`);
    }

    const users = data as User[] | null;
    expect(!users || users.length === 0).toBe(true);
  });

  test('Delete already deleted (non-existent) user → 404', async () => {
    const response = await request(app)
      .delete(`/api/admin/users/${deleteTestUserId}`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(response.status).toBe(404);
  });

  test('No token → 401', async () => {
    const response = await request(app).delete(`/api/admin/users/${deleteTestUserId}`);

    expect(response.status).toBe(401);
  });

  test('Non-admin token → 403', async () => {
    const response = await request(app)
      .delete(`/api/admin/users/${deleteTestUserId}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(response.status).toBe(403);
  });
});

afterAll(() => {
  jest.useRealTimers();
});
