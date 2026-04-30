import { compare, hash } from 'bcryptjs';
import { sign } from 'jsonwebtoken';
import {
  createUser,
  getSalaryConfig,
  getUserByEmail,
  getUserById,
  insertSalaryHistory,
  updateUser,
} from './auth.repository';
import { env } from '../../config/env';
import { EmployeeRole, JwtPayload, SafeUser, User } from '../../types';

type SalaryConfigRow = {
  base_salary: number;
};

const requireJwtSecret = (): string => env.JWT_SECRET;

const toSafeUser = (user: User): SafeUser => {
  const { password_hash, ...safe } = user;
  return safe;
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

  let createdUser: User;
  try {
    createdUser = await createUser({
      name,
      email,
      password_hash: passwordHash,
      role: 'CUSTOMER',
      status: 'ACTIVE',
      employee_role: null,
      employee_level: null,
      salary: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No data returned';
    const normalized = message.startsWith('Failed to create user: ')
      ? message.replace('Failed to create user: ', '')
      : message;
    throw new Error(`Failed to register customer: ${normalized}`);
  }

  return toSafeUser(createdUser);
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

  let newEmployee: User;
  try {
    newEmployee = await createUser({
      name,
      email,
      password_hash: passwordHash,
      role: 'EMPLOYEE',
      status: 'PENDING',
      employee_role,
      employee_level: level,
      salary: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No data returned';
    const normalized = message.startsWith('Failed to create user: ')
      ? message.replace('Failed to create user: ', '')
      : message;
    throw new Error(`Failed to register employee: ${normalized}`);
  }

  const salaryConfig: SalaryConfigRow | null = await getSalaryConfig(employee_role, level);

  if (!salaryConfig) {
    throw new Error('No salary configuration found for this role and level');
  }

  const baseSalary = salaryConfig.base_salary;

  let updatedData: User;
  try {
    updatedData = await updateUser(newEmployee.id, {
      salary: baseSalary,
      status: 'ACTIVE',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No data returned';
    const normalized = message.startsWith('Failed to update user: ')
      ? message.replace('Failed to update user: ', '')
      : message;
    throw new Error(`Failed to update employee salary and status: ${normalized}`);
  }

  await insertSalaryHistory({
    employee_id: newEmployee.id,
    old_salary: 0,
    new_salary: baseSalary,
    trigger_type: 'ROLE_SELECTION',
    changed_by: newEmployee.id,
  });

  return toSafeUser(updatedData);
};

export const getMe = async (userId: string): Promise<SafeUser> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  return toSafeUser(user);
};
