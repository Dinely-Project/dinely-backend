import { supabase } from '../../config/supabase';
import {
  Order,
  OrderDetail,
  OrderItem,
  OrderItemDetail,
  OrderStatus,
  OrderStatusHistory,
  OrderSummary,
} from '../../types';
import { OrderItemSchema, OrderSchema, OrderStatusHistorySchema } from '../../types/schemas';

// ─────────────────────────────────────────────────────────────────────────────
// Raw DB row types (joined queries return additional columns)
// ─────────────────────────────────────────────────────────────────────────────

type RawOrderRow = Order & { users?: { name: string; email: string } };

type RawOrderItemRow = {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  created_at: string;
  menu_items?: { name: string };
};

// ─────────────────────────────────────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────────────────────────────────────

/** Insert a new order row and return it. */
export const insertOrder = async (payload: {
  customer_id: string;
  total_price: number;
  notes: string | null;
}): Promise<Order> => {
  const { data, error } = await supabase
    .from('orders')
    .insert({ ...payload, status: 'RECEIVED' })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create order: ${error?.message ?? 'No data returned'}`);
  }

  return OrderSchema.parse(data);
};

/** Insert multiple order_items rows in one call. */
export const insertOrderItems = async (
  items: Array<{
    order_id: string;
    menu_item_id: string;
    quantity: number;
    unit_price: number;
  }>
): Promise<OrderItem[]> => {
  const { data, error } = await supabase
    .from('order_items')
    .insert(items)
    .select('*');

  if (error || !data) {
    throw new Error(`Failed to insert order items: ${error?.message ?? 'No data returned'}`);
  }

  return (data as unknown[]).map((row) => OrderItemSchema.parse(row));
};

/** Insert a single row into order_status_history. */
export const insertOrderStatusHistory = async (payload: {
  order_id: string;
  old_status: OrderStatus | null;
  new_status: OrderStatus;
  changed_by: string;
}): Promise<void> => {
  const { error } = await supabase.from('order_status_history').insert(payload);

  if (error) {
    throw new Error(`Failed to log status history: ${error.message}`);
  }
};

/** Fetch a single order by id (plain row, no joins). */
export const getOrderById = async (id: string): Promise<Order | null> => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch order: ${error.message}`);
  }

  if (!data || data.length === 0) return null;
  return OrderSchema.parse(data[0]);
};

/** Fetch full order detail for a given order id (items + status history + customer). */
export const getOrderDetail = async (id: string): Promise<OrderDetail | null> => {
  // 1. Fetch order with customer info
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('*, users!customer_id(name, email)')
    .eq('id', id)
    .limit(1);

  if (orderError) {
    throw new Error(`Failed to fetch order detail: ${orderError.message}`);
  }

  if (!orderData || orderData.length === 0) return null;

  const raw = orderData[0] as RawOrderRow;
  const order = OrderSchema.parse({
    id: raw.id,
    customer_id: raw.customer_id,
    status: raw.status,
    total_price: raw.total_price,
    notes: raw.notes,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  });

  // 2. Fetch order items joined with menu item names
  const { data: itemsData, error: itemsError } = await supabase
    .from('order_items')
    .select('*, menu_items(name)')
    .eq('order_id', id);

  if (itemsError) {
    throw new Error(`Failed to fetch order items: ${itemsError.message}`);
  }

  const items: OrderItemDetail[] = ((itemsData ?? []) as RawOrderItemRow[]).map((row) => ({
    id: row.id,
    menu_item_id: row.menu_item_id,
    name: row.menu_items?.name ?? 'Unknown item',
    quantity: row.quantity,
    unit_price: row.unit_price,
    subtotal: row.unit_price * row.quantity,
  }));

  // 3. Fetch status history
  const { data: historyData, error: historyError } = await supabase
    .from('order_status_history')
    .select('*')
    .eq('order_id', id)
    .order('changed_at', { ascending: true });

  if (historyError) {
    throw new Error(`Failed to fetch order status history: ${historyError.message}`);
  }

  const status_history: OrderStatusHistory[] = (
    (historyData ?? []) as unknown[]
  ).map((row) => OrderStatusHistorySchema.parse(row));

  return {
    ...order,
    customer_name: raw.users?.name ?? 'Unknown',
    customer_email: raw.users?.email ?? '',
    items,
    status_history,
  };
};

/** Update an order's status field. */
export const updateOrderStatus = async (
  id: string,
  status: OrderStatus
): Promise<Order> => {
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to update order status: ${error?.message ?? 'No data returned'}`);
  }

  return OrderSchema.parse(data);
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER QUERIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Active orders for a customer: any order that is not FINISHED or CANCELLED.
 * Returns summary rows (order + items via sub-select).
 */
export const getActiveOrdersByCustomer = async (
  customerId: string
): Promise<OrderDetail[]> => {
  const { data, error } = await supabase
    .from('orders')
    .select('*, users!customer_id(name, email)')
    .eq('customer_id', customerId)
    .not('status', 'in', '("FINISHED","CANCELLED")')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch active orders: ${error.message}`);
  }

  return enrichOrders((data ?? []) as RawOrderRow[]);
};

/**
 * Completed / cancelled orders for a customer — order history.
 */
export const getOrderHistoryByCustomer = async (
  customerId: string
): Promise<OrderDetail[]> => {
  const { data, error } = await supabase
    .from('orders')
    .select('*, users!customer_id(name, email)')
    .eq('customer_id', customerId)
    .in('status', ['FINISHED', 'CANCELLED'])
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch order history: ${error.message}`);
  }

  return enrichOrders((data ?? []) as RawOrderRow[]);
};

// ─────────────────────────────────────────────────────────────────────────────
// STAFF QUERIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All active orders (RECEIVED + PREPARING + READY) sorted by creation time.
 * Returns lightweight summary rows for the staff queue view.
 */
export const getAllActiveOrders = async (): Promise<OrderSummary[]> => {
  const { data, error } = await supabase
    .from('orders')
    .select('*, users!customer_id(name)')
    .in('status', ['RECEIVED', 'PREPARING', 'READY'])
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch active orders: ${error.message}`);
  }

  // Fetch item counts per order in a single query
  const orderIds: string[] = ((data ?? []) as RawOrderRow[]).map((o) => o.id);
  let itemCounts: Record<string, number> = {};

  if (orderIds.length > 0) {
    const { data: countData, error: countError } = await supabase
      .from('order_items')
      .select('order_id, quantity')
      .in('order_id', orderIds);

    if (countError) {
      throw new Error(`Failed to fetch item counts: ${countError.message}`);
    }

    itemCounts = ((countData ?? []) as { order_id: string; quantity: number }[]).reduce(
      (acc, row) => {
        acc[row.order_id] = (acc[row.order_id] ?? 0) + row.quantity;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  return ((data ?? []) as RawOrderRow[]).map((raw) => ({
    ...OrderSchema.parse({
      id: raw.id,
      customer_id: raw.customer_id,
      status: raw.status,
      total_price: raw.total_price,
      notes: raw.notes,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
    }),
    customer_name: raw.users?.name ?? 'Unknown',
    item_count: itemCounts[raw.id] ?? 0,
  }));
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Insert a notification record for a customer when their order is READY. */
export const insertReadyNotification = async (
  customerId: string,
  orderId: string
): Promise<void> => {
  const { error } = await supabase.from('notifications').insert({
    user_id: customerId,
    type: 'ORDER_READY',
    message: 'Your order is ready for pickup!',
    reference_id: orderId,
    is_read: false,
  });

  if (error) {
    // Non-fatal: log but do not throw — the status update already succeeded
    console.error(`Failed to create ready notification: ${error.message}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given a list of raw order rows (with joined users), fetch their items and
 * status histories in bulk and assemble full OrderDetail objects.
 */
async function enrichOrders(rawOrders: RawOrderRow[]): Promise<OrderDetail[]> {
  if (rawOrders.length === 0) return [];

  const orderIds = rawOrders.map((o) => o.id);

  // Fetch all items for these orders in one query
  const { data: itemsData, error: itemsError } = await supabase
    .from('order_items')
    .select('*, menu_items(name)')
    .in('order_id', orderIds);

  if (itemsError) {
    throw new Error(`Failed to fetch order items: ${itemsError.message}`);
  }

  // Fetch all status histories for these orders in one query
  const { data: historyData, error: historyError } = await supabase
    .from('order_status_history')
    .select('*')
    .in('order_id', orderIds)
    .order('changed_at', { ascending: true });

  if (historyError) {
    throw new Error(`Failed to fetch order status histories: ${historyError.message}`);
  }

  // Group items by order_id
  const itemsByOrder = ((itemsData ?? []) as RawOrderItemRow[]).reduce(
    (acc, row) => {
      const detail: OrderItemDetail = {
        id: row.id,
        menu_item_id: row.menu_item_id,
        name: row.menu_items?.name ?? 'Unknown item',
        quantity: row.quantity,
        unit_price: row.unit_price,
        subtotal: row.unit_price * row.quantity,
      };
      acc[row.order_id] = [...(acc[row.order_id] ?? []), detail];
      return acc;
    },
    {} as Record<string, OrderItemDetail[]>
  );

  // Group history by order_id
  const historyByOrder = ((historyData ?? []) as unknown[]).reduce(
    (acc: Record<string, OrderStatusHistory[]>, row) => {
      const parsed = OrderStatusHistorySchema.parse(row);
      acc[parsed.order_id] = [...(acc[parsed.order_id] ?? []), parsed];
      return acc;
    },
    {} as Record<string, OrderStatusHistory[]>
  );

  return rawOrders.map((raw) => ({
    ...OrderSchema.parse({
      id: raw.id,
      customer_id: raw.customer_id,
      status: raw.status,
      total_price: raw.total_price,
      notes: raw.notes,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
    }),
    customer_name: raw.users?.name ?? 'Unknown',
    customer_email: raw.users?.email ?? '',
    items: itemsByOrder[raw.id] ?? [],
    status_history: historyByOrder[raw.id] ?? [],
  }));
}
