import { supabase } from '../../config/supabase';
import { EmployeeRole, User, UserRole, UserStatus } from '../../types';
import { UserSchema } from '../../types/schemas';

type UserFilters = {
  role?: UserRole;
  status?: UserStatus;
};

type OrderRow = {
  id: string;
};

export const getAllUsers = async (filters: UserFilters = {}): Promise<User[]> => {
  let query = supabase.from('users').select('*');

  if (filters.role) {
    query = query.eq('role', filters.role);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  const rows = data as User[] | null;
  return rows ? rows.map((row) => UserSchema.parse(row)) : [];
};

export const getUserById = async (id: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch user by id: ${error.message}`);
  }

  if (!data || data.length === 0) return null;
  return UserSchema.parse(data[0]);
};

export const updateUserById = async (id: string, payload: Partial<User>): Promise<User> => {
  const { data, error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to update user: ${error?.message ?? 'No data returned'}`);
  }

  return UserSchema.parse(data);
};

export const getSalaryConfig = async (
  employee_role: EmployeeRole,
  level: number | null
): Promise<{ base_salary: number } | null> => {
  let query = supabase
    .from('role_salary_config')
    .select('base_salary')
    .eq('employee_role', employee_role);

  if (level === null) {
    query = query.is('employee_level', null);
  } else {
    query = query.eq('employee_level', level);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    throw new Error(`Failed to fetch salary configuration: ${error.message}`);
  }

  const rows = data as { base_salary: number }[] | null;
  return rows && rows.length > 0 ? rows[0] : null;
};

export const insertSalaryHistory = async (payload: {
  employee_id: string;
  old_salary: number;
  new_salary: number;
  trigger_type: string;
  changed_by: string;
}): Promise<void> => {
  const { error } = await supabase.from('salary_history').insert(payload);

  if (error) {
    throw new Error(`Failed to record salary history: ${error.message}`);
  }
};

export const getSalaryHistoryByEmployeeId = async (
  employeeId: string
): Promise<Record<string, unknown>[]> => {
  const { data, error } = await supabase
    .from('salary_history')
    .select('*')
    .eq('employee_id', employeeId)
    .order('changed_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch salary history: ${error.message}`);
  }

  return (data ?? []) as Record<string, unknown>[];
};

export const deleteRelatedRecords = async (userId: string): Promise<void> => {
  const { error: salaryError } = await supabase
    .from('salary_history')
    .delete()
    .eq('employee_id', userId);
  if (salaryError) {
    throw new Error(`Failed to delete salary history: ${salaryError.message}`);
  }

  const { error: requestError } = await supabase
    .from('employee_requests')
    .delete()
    .eq('employee_id', userId);
  if (requestError) {
    throw new Error(`Failed to delete employee requests: ${requestError.message}`);
  }

  const { error: notificationError } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId);
  if (notificationError) {
    throw new Error(`Failed to delete notifications: ${notificationError.message}`);
  }

  const { data: ordersData, error: ordersError } = await supabase
    .from('orders')
    .select('id')
    .eq('customer_id', userId);
  if (ordersError) {
    throw new Error(`Failed to fetch orders: ${ordersError.message}`);
  }

  const orders = ordersData as OrderRow[] | null;
  const orderIds = orders ? orders.map((order) => order.id) : [];

  if (orderIds.length > 0) {
    const { error: statusError } = await supabase
      .from('order_status_history')
      .delete()
      .in('order_id', orderIds);
    if (statusError) {
      throw new Error(`Failed to delete order status history: ${statusError.message}`);
    }

    const { error: itemsError } = await supabase
      .from('order_items')
      .delete()
      .in('order_id', orderIds);
    if (itemsError) {
      throw new Error(`Failed to delete order items: ${itemsError.message}`);
    }
  }

  const { error: ordersDeleteError } = await supabase
    .from('orders')
    .delete()
    .eq('customer_id', userId);
  if (ordersDeleteError) {
    throw new Error(`Failed to delete orders: ${ordersDeleteError.message}`);
  }

  const { error: auditError } = await supabase
    .from('audit_logs')
    .delete()
    .eq('actor_id', userId);
  if (auditError) {
    throw new Error(`Failed to delete audit logs: ${auditError.message}`);
  }
};

export const deleteUserById = async (id: string): Promise<void> => {
  const { error } = await supabase.from('users').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete user: ${error.message}`);
  }
};
