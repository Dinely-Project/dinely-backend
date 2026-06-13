import { compare, hash } from 'bcryptjs';
import {
  AdminOrderFilters,
  bulkInsertSalaryHistory,
  bulkUpdateEmployeeSalary,
  deleteRelatedRecords,
  deleteUserById,
  getAllOrdersAdmin,
  getAllUsers as getAllUsersRepo,
  getAllSalaryConfig as getAllSalaryConfigRepo,
  getCustomerStats,
  getEmployeeHeadcount,
  getEmployeesByRoleAndLevel,
  getOrderCountsByStatus,
  getOrderDetailAdmin,
  getRevenueByCategory,
  getRevenueByDay,
  getSalaryConfig,
  getSalaryHistoryByEmployeeId,
  getTopSellingItems,
  getUserByEmailAdmin,
  getUserById as getUserByIdRepo,
  insertSalaryHistory,
  SalaryConfigRow,
  updateSalaryConfigByRoleAndLevel,
  updateUserById,
} from './admin.repository';
import {
  AdminOrdersListResult,
  AnalyticsSummary,
  EmployeeRole,
  OrderDetail,
  SafeUser,
  User,
  UserRole,
  UserStatus,
} from '../../types';

type AnalyticsPeriod = 'today' | 'week' | 'month' | 'year';

type AnalyticsParams = {
  period: AnalyticsPeriod;
  from?: string;
  to?: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const roundToTwo = (value: number): number => Number(value.toFixed(2));

const resolveAnalyticsPeriod = (
  params: AnalyticsParams
): { from: string; to: string } => {
  if (params.from && params.to) {
    const from = new Date(params.from);
    const to = new Date(params.to);

    if (from.getTime() > to.getTime()) {
      throw new Error('Invalid date range');
    }

    return { from: from.toISOString(), to: to.toISOString() };
  }

  const now = new Date();
  let from: Date;

  switch (params.period) {
    case 'today':
      from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      break;
    case 'week':
      from = new Date(now.getTime() - 7 * MS_PER_DAY);
      break;
    case 'year':
      from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      break;
    case 'month':
    default:
      from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      break;
  }

  return { from: from.toISOString(), to: now.toISOString() };
};

const daySpan = (from: string, to: string): number =>
  Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / MS_PER_DAY));

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

export const getAllOrdersForAdmin = async (
  filters: AdminOrderFilters
): Promise<AdminOrdersListResult> => {
  return getAllOrdersAdmin(filters);
};

export const getOrderDetailForAdmin = async (orderId: string): Promise<OrderDetail> => {
  const order = await getOrderDetailAdmin(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  return order;
};

export const getAnalyticsSummary = async (
  params: AnalyticsParams
): Promise<AnalyticsSummary> => {
  const period = resolveAnalyticsPeriod(params);

  const [
    revenueByDay,
    orderCounts,
    topItems,
    customerStats,
    employeeHeadcount,
    revenueByCategory,
  ] = await Promise.all([
    getRevenueByDay(period.from, period.to),
    getOrderCountsByStatus(period.from, period.to),
    getTopSellingItems(period.from, period.to, 10),
    getCustomerStats(period.from, period.to),
    getEmployeeHeadcount(),
    getRevenueByCategory(period.from, period.to),
  ]);

  const totalRevenue = revenueByDay.reduce((sum, bucket) => sum + bucket.revenue, 0);
  const totalOrders = Object.values(orderCounts).reduce((sum, count) => sum + count, 0);

  return {
    period,
    revenue: {
      total: roundToTwo(totalRevenue),
      daily_average: roundToTwo(totalRevenue / daySpan(period.from, period.to)),
      by_day: revenueByDay.map((bucket) => ({
        ...bucket,
        revenue: roundToTwo(bucket.revenue),
      })),
    },
    orders: {
      total: totalOrders,
      by_status: orderCounts,
      completion_rate:
        totalOrders === 0 ? 0 : roundToTwo((orderCounts.FINISHED / totalOrders) * 100),
    },
    top_items: topItems.map((item) => ({
      ...item,
      total_revenue: roundToTwo(item.total_revenue),
    })),
    customers: customerStats,
    employees: employeeHeadcount,
    revenue_by_category: revenueByCategory.map((category) => ({
      ...category,
      total_revenue: roundToTwo(category.total_revenue),
    })),
  };
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

export const getSalaryConfigRows = async (): Promise<SalaryConfigRow[]> => {
  return getAllSalaryConfigRepo();
};

export const updateSalaryConfig = async (
  role: EmployeeRole,
  levelParam: string,
  base_salary: number,
  adminId: string
): Promise<SalaryConfigRow> => {
  const level: number | null = levelParam === 'null' ? null : parseInt(levelParam, 10);
  const existing = await getSalaryConfig(role, level);
  if (!existing) {
    throw new Error('Salary config not found');
  }

  const updated = await updateSalaryConfigByRoleAndLevel(
    role,
    level,
    base_salary,
    adminId
  );
  const employees = await getEmployeesByRoleAndLevel(role, level);
  if (employees.length === 0) {
    return updated;
  }

  await bulkUpdateEmployeeSalary(role, level, base_salary);

  const historyInserts = employees.map((emp) => ({
    employee_id: emp.id,
    old_salary: emp.salary ?? 0,
    new_salary: base_salary,
    trigger_type: 'CONFIG_UPDATE',
    changed_by: adminId,
    reason: `Base salary config updated for ${role}${level !== null ? ` L${level}` : ''}`,
  }));

  await bulkInsertSalaryHistory(historyInserts);

  return updated;
};

export const updateSalary = async (
  userId: string,
  salary: number,
  reason: string | undefined,
  adminId: string
): Promise<SafeUser> => {
  const user = await getUserByIdRepo(userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (user.role !== 'EMPLOYEE') {
    throw new Error('User is not an employee');
  }

  const oldSalary = user.salary ?? 0;
  const updated = await updateUserById(userId, { salary });

  await insertSalaryHistory({
    employee_id: userId,
    old_salary: oldSalary,
    new_salary: salary,
    trigger_type: 'MANUAL_OVERRIDE',
    changed_by: adminId,
    reason: reason ?? null,
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

export const updateAdminEmail = async (
  adminId: string,
  newEmail: string,
  currentPassword: string
): Promise<SafeUser> => {
  const admin = await getUserByIdRepo(adminId);
  if (!admin) {
    throw new Error('Admin user not found');
  }

  const isPasswordValid = await compare(currentPassword, admin.password_hash);
  if (!isPasswordValid) {
    throw new Error('Incorrect password');
  }

  const existing = await getUserByEmailAdmin(newEmail);
  if (existing && existing.id !== adminId) {
    throw new Error('Email already in use');
  }

  const updated = await updateUserById(adminId, { email: newEmail });
  return toSafeUser(updated);
};

export const updateAdminPassword = async (
  adminId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  const admin = await getUserByIdRepo(adminId);
  if (!admin) {
    throw new Error('Admin user not found');
  }

  const isPasswordValid = await compare(currentPassword, admin.password_hash);
  if (!isPasswordValid) {
    throw new Error('Incorrect password');
  }

  const password_hash = await hash(newPassword, 10);
  await updateUserById(adminId, { password_hash });
};

export const deleteUser = async (userId: string): Promise<void> => {
  const user = await getUserByIdRepo(userId);
  if (!user) {
    throw new Error('User not found');
  }

  await deleteRelatedRecords(userId);
  await deleteUserById(userId);
};
