import { supabase } from '../../config/supabase';
import {
  AdminOrdersListResult,
  CategoryRevenue,
  DailyRevenueBucket,
  EmployeeRole,
  Order,
  OrderDetail,
  OrderItemDetail,
  OrderStatus,
  OrderStatusHistory,
  TopSellingItem,
  User,
  UserRole,
  UserStatus,
} from '../../types';
import { OrderSchema, OrderStatusHistorySchema, UserSchema } from '../../types/schemas';

type UserFilters = {
  role?: UserRole;
  status?: UserStatus;
};

export type AdminOrderFilters = {
  status?: OrderStatus;
  customer_id?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
};

type OrderRow = {
  id: string;
};

type Relation<T> = T | T[] | null | undefined;

type CustomerRelation = {
  name: string;
  email: string;
};

type RawAdminOrderRow = Order & {
  users?: Relation<CustomerRelation>;
  order_items?: { quantity: number }[] | null;
};

type RawOrderItemDetailRow = {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  subtotal?: number | null;
  created_at: string;
  menu_items?: Relation<{ name: string }>;
};

type RevenueOrderRow = {
  created_at: string;
  total_price: number;
};

type TopSellingItemRow = {
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  subtotal?: number | null;
  menu_items?: Relation<{ name: string }>;
};

type CategoryRevenueRow = {
  quantity: number;
  unit_price: number;
  subtotal?: number | null;
  menu_items?: Relation<{
    category_id: string;
    menu_categories?: Relation<{ id: string; name: string }>;
  }>;
};

const ORDER_STATUSES: OrderStatus[] = [
  'RECEIVED',
  'PREPARING',
  'READY',
  'FINISHED',
  'CANCELLED',
];

const firstRelation = <T>(value: Relation<T>): T | undefined =>
  Array.isArray(value) ? value[0] : value ?? undefined;

const parseOrder = (raw: Order): Order =>
  OrderSchema.parse({
    id: raw.id,
    customer_id: raw.customer_id,
    status: raw.status,
    total_price: raw.total_price,
    notes: raw.notes,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  });

const emptyOrderStatusCounts = (): Record<OrderStatus, number> =>
  ORDER_STATUSES.reduce(
    (acc, status) => {
      acc[status] = 0;
      return acc;
    },
    {} as Record<OrderStatus, number>
  );

export type SalaryConfigRow = {
  id: string;
  employee_role: EmployeeRole;
  employee_level: number | null;
  base_salary: number;
  configured_by: string;
  updated_at: string;
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

export const getUserByEmailAdmin = async (email: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch user by email: ${error.message}`);
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

export const getAllOrdersAdmin = async (
  filters: AdminOrderFilters
): Promise<AdminOrdersListResult> => {
  let query = supabase
    .from('orders')
    .select('*, users!customer_id(name, email), order_items(quantity)', {
      count: 'exact',
    });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.customer_id) {
    query = query.eq('customer_id', filters.customer_id);
  }

  if (filters.from) {
    query = query.gte('created_at', filters.from);
  }

  if (filters.to) {
    query = query.lte('created_at', filters.to);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);

  if (error) {
    throw new Error(`Failed to fetch admin orders: ${error.message}`);
  }

  const rows = ((data ?? []) as RawAdminOrderRow[]).map((raw) => {
    const order = parseOrder(raw);
    const customer = firstRelation(raw.users);
    const item_count = (raw.order_items ?? []).reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    return {
      ...order,
      customer_name: customer?.name ?? 'Unknown',
      customer_email: customer?.email ?? '',
      item_count,
    };
  });

  return {
    data: rows,
    meta: {
      total: count ?? 0,
      limit: filters.limit,
      offset: filters.offset,
    },
  };
};

export const getOrderDetailAdmin = async (id: string): Promise<OrderDetail | null> => {
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('*, users!customer_id(name, email)')
    .eq('id', id)
    .limit(1);

  if (orderError) {
    throw new Error(`Failed to fetch admin order detail: ${orderError.message}`);
  }

  if (!orderData || orderData.length === 0) return null;

  const raw = orderData[0] as RawAdminOrderRow;
  const order = parseOrder(raw);
  const customer = firstRelation(raw.users);

  const { data: itemsData, error: itemsError } = await supabase
    .from('order_items')
    .select('*, menu_items(name)')
    .eq('order_id', id);

  if (itemsError) {
    throw new Error(`Failed to fetch admin order items: ${itemsError.message}`);
  }

  const items: OrderItemDetail[] = ((itemsData ?? []) as RawOrderItemDetailRow[]).map(
    (row) => {
      const menuItem = firstRelation(row.menu_items);

      return {
        id: row.id,
        menu_item_id: row.menu_item_id,
        name: menuItem?.name ?? 'Unknown item',
        quantity: row.quantity,
        unit_price: row.unit_price,
        subtotal: row.subtotal ?? row.unit_price * row.quantity,
      };
    }
  );

  const { data: historyData, error: historyError } = await supabase
    .from('order_status_history')
    .select('*')
    .eq('order_id', id)
    .order('changed_at', { ascending: true });

  if (historyError) {
    throw new Error(`Failed to fetch admin order status history: ${historyError.message}`);
  }

  const status_history: OrderStatusHistory[] = ((historyData ?? []) as unknown[]).map(
    (row) => OrderStatusHistorySchema.parse(row)
  );

  return {
    ...order,
    customer_name: customer?.name ?? 'Unknown',
    customer_email: customer?.email ?? '',
    items,
    status_history,
  };
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

export const getAllSalaryConfig = async (): Promise<SalaryConfigRow[]> => {
  const { data, error } = await supabase
    .from('role_salary_config')
    .select('*')
    .order('employee_role')
    .order('employee_level');

  if (error) {
    throw new Error(`Failed to fetch salary configurations: ${error.message}`);
  }

  return (data ?? []) as SalaryConfigRow[];
};

export const updateSalaryConfigByRoleAndLevel = async (
  employee_role: EmployeeRole,
  level: number | null,
  base_salary: number,
  configured_by: string
): Promise<SalaryConfigRow> => {
  let query = supabase
    .from('role_salary_config')
    .update({
      base_salary,
      configured_by,
      updated_at: new Date().toISOString(),
    })
    .eq('employee_role', employee_role);

  if (level === null) {
    query = query.is('employee_level', null);
  } else {
    query = query.eq('employee_level', level);
  }

  const { data, error } = await query.select('*');

if (error) {
  throw new Error(`Failed to update salary configuration: ${error.message}`);
}

const rows = data as SalaryConfigRow[] | null;
if (!rows || rows.length === 0) {
  throw new Error('Failed to update salary configuration: No data returned');
}

return rows[0];

};

export const getEmployeesByRoleAndLevel = async (
  employee_role: EmployeeRole,
  level: number | null
): Promise<User[]> => {
  let query = supabase
    .from('users')
    .select('*')
    .eq('role', 'EMPLOYEE')
    .eq('employee_role', employee_role);

  if (level === null) {
    query = query.is('employee_level', null);
  } else {
    query = query.eq('employee_level', level);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch employees by role and level: ${error.message}`);
  }

  const rows = data as User[] | null;
  return rows ? rows.map((row) => UserSchema.parse(row)) : [];
};

export const bulkUpdateEmployeeSalary = async (
  employee_role: EmployeeRole,
  level: number | null,
  salary: number
): Promise<void> => {
  let query = supabase
    .from('users')
    .update({ salary })
    .eq('role', 'EMPLOYEE')
    .eq('employee_role', employee_role);

  if (level === null) {
    query = query.is('employee_level', null);
  } else {
    query = query.eq('employee_level', level);
  }

  const { error } = await query;

  if (error) {
    throw new Error(`Failed to bulk update employee salaries: ${error.message}`);
  }
};

export const insertSalaryHistory = async (payload: {
  employee_id: string;
  old_salary: number;
  new_salary: number;
  trigger_type: string;
  changed_by: string;
  reason?: string | null;
}): Promise<void> => {
  const { error } = await supabase.from('salary_history').insert(payload);

  if (error) {
    throw new Error(`Failed to record salary history: ${error.message}`);
  }
};

export const bulkInsertSalaryHistory = async (
  records: {
    employee_id: string;
    old_salary: number;
    new_salary: number;
    trigger_type: string;
    changed_by: string;
    reason?: string | null;
  }[]
): Promise<void> => {
  if (records.length === 0) {
    return;
  }

  const { error } = await supabase.from('salary_history').insert(records);

  if (error) {
    throw new Error(`Failed to bulk record salary history: ${error.message}`);
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

    // Delete invoices before order_items and orders (FK: invoices.order_id RESTRICT)
    const { error: invoicesError } = await supabase
      .from('invoices')
      .delete()
      .in('order_id', orderIds);
    if (invoicesError) {
      throw new Error(`Failed to delete invoices: ${invoicesError.message}`);
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

export const getRevenueByDay = async (
  from: string,
  to: string
): Promise<DailyRevenueBucket[]> => {
  const { data, error } = await supabase
    .from('orders')
    .select('created_at, total_price')
    .eq('status', 'FINISHED')
    .gte('created_at', from)
    .lte('created_at', to);

  if (error) {
    throw new Error(`Failed to fetch revenue by day: ${error.message}`);
  }

  const buckets = ((data ?? []) as RevenueOrderRow[]).reduce(
    (acc, row) => {
      const date = new Date(row.created_at).toISOString().slice(0, 10);
      const current = acc[date] ?? { date, revenue: 0, order_count: 0 };
      current.revenue += row.total_price;
      current.order_count += 1;
      acc[date] = current;
      return acc;
    },
    {} as Record<string, DailyRevenueBucket>
  );

  return Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
};

export const getOrderCountsByStatus = async (
  from: string,
  to: string
): Promise<Record<OrderStatus, number>> => {
  const { data, error } = await supabase
    .from('orders')
    .select('status')
    .gte('created_at', from)
    .lte('created_at', to);

  if (error) {
    throw new Error(`Failed to fetch order counts by status: ${error.message}`);
  }

  return ((data ?? []) as { status: OrderStatus }[]).reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    },
    emptyOrderStatusCounts()
  );
};

export const getTopSellingItems = async (
  from: string,
  to: string,
  limit: number
): Promise<TopSellingItem[]> => {
  const { data, error } = await supabase
    .from('order_items')
    .select(
      'menu_item_id, quantity, unit_price, subtotal, menu_items(name), orders!inner(status, created_at)'
    )
    .eq('orders.status', 'FINISHED')
    .gte('orders.created_at', from)
    .lte('orders.created_at', to);

  if (error) {
    throw new Error(`Failed to fetch top selling items: ${error.message}`);
  }

  const byItem = ((data ?? []) as TopSellingItemRow[]).reduce(
    (acc, row) => {
      const menuItem = firstRelation(row.menu_items);
      const current =
        acc[row.menu_item_id] ??
        ({
          menu_item_id: row.menu_item_id,
          name: menuItem?.name ?? 'Unknown item',
          total_quantity_sold: 0,
          total_revenue: 0,
        } satisfies TopSellingItem);

      current.total_quantity_sold += row.quantity;
      current.total_revenue += row.subtotal ?? row.unit_price * row.quantity;
      acc[row.menu_item_id] = current;
      return acc;
    },
    {} as Record<string, TopSellingItem>
  );

  return Object.values(byItem)
    .sort(
      (a, b) =>
        b.total_quantity_sold - a.total_quantity_sold ||
        b.total_revenue - a.total_revenue
    )
    .slice(0, limit);
};

export const getCustomerStats = async (
  from: string,
  to: string
): Promise<{
  total_registered: number;
  new_in_period: number;
  active_in_period: number;
}> => {
  const { count: totalCount, error: totalError } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'CUSTOMER');

  if (totalError) {
    throw new Error(`Failed to count registered customers: ${totalError.message}`);
  }

  const { count: newCount, error: newError } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'CUSTOMER')
    .gte('created_at', from)
    .lte('created_at', to);

  if (newError) {
    throw new Error(`Failed to count new customers: ${newError.message}`);
  }

  const { data: activeData, error: activeError } = await supabase
    .from('orders')
    .select('customer_id')
    .gte('created_at', from)
    .lte('created_at', to);

  if (activeError) {
    throw new Error(`Failed to fetch active customers: ${activeError.message}`);
  }

  const activeCustomerIds = new Set(
    ((activeData ?? []) as { customer_id: string }[]).map((row) => row.customer_id)
  );

  return {
    total_registered: totalCount ?? 0,
    new_in_period: newCount ?? 0,
    active_in_period: activeCustomerIds.size,
  };
};

export const getEmployeeHeadcount = async (): Promise<{
  total: number;
  by_role: Partial<Record<EmployeeRole, number>>;
}> => {
  const { data, error } = await supabase
    .from('users')
    .select('employee_role')
    .eq('role', 'EMPLOYEE')
    .eq('status', 'ACTIVE');

  if (error) {
    throw new Error(`Failed to fetch employee headcount: ${error.message}`);
  }

  return ((data ?? []) as { employee_role: EmployeeRole | null }[]).reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.employee_role) {
        acc.by_role[row.employee_role] = (acc.by_role[row.employee_role] ?? 0) + 1;
      }
      return acc;
    },
    { total: 0, by_role: {} as Partial<Record<EmployeeRole, number>> }
  );
};

export const getRevenueByCategory = async (
  from: string,
  to: string
): Promise<CategoryRevenue[]> => {
  const { data, error } = await supabase
    .from('order_items')
    .select(
      'quantity, unit_price, subtotal, menu_items(category_id, menu_categories(id, name)), orders!inner(status, created_at)'
    )
    .eq('orders.status', 'FINISHED')
    .gte('orders.created_at', from)
    .lte('orders.created_at', to);

  if (error) {
    throw new Error(`Failed to fetch revenue by category: ${error.message}`);
  }

  const byCategory = ((data ?? []) as CategoryRevenueRow[]).reduce(
    (acc, row) => {
      const menuItem = firstRelation(row.menu_items);
      if (!menuItem) {
        return acc;
      }

      const category = firstRelation(menuItem.menu_categories);
      const categoryId = category?.id ?? menuItem.category_id;
      const current =
        acc[categoryId] ??
        ({
          category_id: categoryId,
          category_name: category?.name ?? 'Unknown category',
          total_revenue: 0,
          order_count: 0,
        } satisfies CategoryRevenue);

      current.total_revenue += row.subtotal ?? row.unit_price * row.quantity;
      current.order_count += row.quantity;
      acc[categoryId] = current;
      return acc;
    },
    {} as Record<string, CategoryRevenue>
  );

  return Object.values(byCategory).sort((a, b) => b.total_revenue - a.total_revenue);
};
