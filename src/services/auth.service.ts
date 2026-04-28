import { compare, hash } from 'bcryptjs';
import { sign } from 'jsonwebtoken';
import { supabase } from '../config/supabase';
import { EmployeeRole, JwtPayload, SafeUser, User } from '../types';

type SalaryConfigRow = {
  base_salary: number;
};

const requireJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
};

const toSafeUser = (user: User): SafeUser => {
  const { password_hash, ...safe } = user;
  return safe;
};

const getUserByEmail = async (email: string): Promise<User | null> => {
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

const getUserById = async (id: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch user by id: ${error.message}`);
  }

  const users = data as User[] | null;
  return users && users.length > 0 ? users[0] : null;
};

export const loginUser = async (
  email: string,
  password: string
): Promise<{ token: string; user: SafeUser }> => {
  const user = await getUserByEmail(email);
  if (!user) {
    throw new Error('Invalid email or password');
  }

  if (user.status !== 'ACTIVE') {
    throw new Error('Account is not active');
  }

  const isValid = await compare(password, user.password_hash);
  if (!isValid) {
    throw new Error('Invalid email or password');
  }

  const payload: JwtPayload = { userId: user.id, role: user.role };
  const token = sign(payload, requireJwtSecret(), { expiresIn: '7d' });

  return { token, user: toSafeUser(user) };
};

export const registerCustomer = async (
  name: string,
  email: string,
  password: string
): Promise<SafeUser> => {
  const existing = await getUserByEmail(email);
  if (existing) {
    throw new Error('Email already in use');
  }

  const passwordHash = await hash(password, 10);

  const { data, error } = await supabase
    .from('users')
    .insert({
      name,
      email,
      password_hash: passwordHash,
      role: 'CUSTOMER',
      status: 'ACTIVE',
      employee_role: null,
      employee_level: null,
      salary: null,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to register customer: ${error?.message ?? 'No data returned'}`);
  }

  return toSafeUser(data as User);
};

export const registerEmployee = async (
  name: string,
  email: string,
  password: string,
  employee_role: EmployeeRole,
  employee_level: number
): Promise<SafeUser> => {
  const existing = await getUserByEmail(email);
  if (existing) {
    throw new Error('Email already in use');
  }

  const passwordHash = await hash(password, 10);
  const level: number | null = employee_level === 0 ? null : employee_level;

  const { data: insertedData, error: insertError } = await supabase
    .from('users')
    .insert({
      name,
      email,
      password_hash: passwordHash,
      role: 'EMPLOYEE',
      status: 'PENDING',
      employee_role,
      employee_level: level,
      salary: null,
    })
    .select('*')
    .single();

  if (insertError || !insertedData) {
    throw new Error(`Failed to register employee: ${insertError?.message ?? 'No data returned'}`);
  }

  const newEmployee = insertedData as User;

  let salaryQuery = supabase
    .from('role_salary_config')
    .select('base_salary')
    .eq('employee_role', employee_role);

  if (level === null) {
    salaryQuery = salaryQuery.is('employee_level', null);
  } else {
    salaryQuery = salaryQuery.eq('employee_level', level);
  }

  const { data: salaryData, error: salaryError } = await salaryQuery.limit(1);

  if (salaryError) {
    throw new Error(`Failed to fetch salary configuration: ${salaryError.message}`);
  }

  const salaryConfigs = salaryData as SalaryConfigRow[] | null;
  if (!salaryConfigs || salaryConfigs.length === 0) {
    throw new Error('No salary configuration found for this role and level');
  }

  const baseSalary = salaryConfigs[0].base_salary;

  const { data: updatedData, error: updateError } = await supabase
    .from('users')
    .update({
      salary: baseSalary,
      status: 'ACTIVE',
    })
    .eq('id', newEmployee.id)
    .select('*')
    .single();

  if (updateError || !updatedData) {
    throw new Error(
      `Failed to update employee salary and status: ${updateError?.message ?? 'No data returned'}`
    );
  }

  const { error: historyError } = await supabase.from('salary_history').insert({
    employee_id: newEmployee.id,
    old_salary: 0,
    new_salary: baseSalary,
    trigger_type: 'ROLE_SELECTION',
    changed_by: newEmployee.id,
  });

  if (historyError) {
    throw new Error(`Failed to record salary history: ${historyError.message}`);
  }

  return toSafeUser(updatedData as User);
};

export const getMe = async (userId: string): Promise<SafeUser> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  return toSafeUser(user);
};
