import {
  deleteRelatedRecords,
  deleteUserById,
  getAllUsers as getAllUsersRepo,
  getSalaryConfig,
  getSalaryHistoryByEmployeeId,
  getUserById as getUserByIdRepo,
  insertSalaryHistory,
  updateUserById,
} from './admin.repository';
import { EmployeeRole, SafeUser, User, UserRole, UserStatus } from '../../types';

export const toSafeUser = (user: User): SafeUser => {
  const { password_hash, ...safe } = user;
  return safe;
};

export const getAllUsers = async (filters?: {
  role?: UserRole;
  status?: UserStatus;
}): Promise<SafeUser[]> => {
  const users = await getAllUsersRepo(filters);
  return users.map(toSafeUser);
};

export const getUserById = async (userId: string): Promise<SafeUser> => {
  const user = await getUserByIdRepo(userId);
  if (!user) {
    throw new Error('User not found');
  }

  return toSafeUser(user);
};

export const updateUserStatus = async (
  userId: string,
  status: UserStatus
): Promise<SafeUser> => {
  const user = await getUserByIdRepo(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const updated = await updateUserById(userId, { status });
  return toSafeUser(updated);
};

export const updateEmployeeRole = async (
  userId: string,
  employee_role: EmployeeRole,
  employee_level: number
): Promise<SafeUser> => {
  const user = await getUserByIdRepo(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const level: number | null = employee_level === 0 ? null : employee_level;
  const triggerType =
    employee_role !== user.employee_role ? 'ROLE_CHANGE' : 'LEVEL_CHANGE';

  const salaryConfig = await getSalaryConfig(employee_role, level);
  if (!salaryConfig) {
    throw new Error('Salary config not found');
  }

  const baseSalary = salaryConfig.base_salary;
  const updated = await updateUserById(userId, {
    employee_role,
    employee_level: level,
    salary: baseSalary,
  });

  await insertSalaryHistory({
    employee_id: userId,
    old_salary: user.salary ?? 0,
    new_salary: baseSalary,
    trigger_type: triggerType,
    changed_by: userId,
  });

  return toSafeUser(updated);
};

export const getEmployeeSalaryHistory = async (
  userId: string
): Promise<Record<string, unknown>[]> => {
  const user = await getUserByIdRepo(userId);
  if (!user) {
    throw new Error('User not found');
  }

  return getSalaryHistoryByEmployeeId(userId);
};

export const deleteUser = async (userId: string): Promise<void> => {
  const user = await getUserByIdRepo(userId);
  if (!user) {
    throw new Error('User not found');
  }

  await deleteRelatedRecords(userId);
  await deleteUserById(userId);
};
