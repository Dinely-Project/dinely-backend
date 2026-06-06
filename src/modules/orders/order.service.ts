import { supabase } from '../../config/supabase';
import { OrderDetail, OrderStatus, OrderSummary } from '../../types';
import {
  getAllActiveOrders,
  getActiveOrdersByCustomer,
  getOrderById,
  getOrderDetail,
  getOrderHistoryByCustomer,
  insertOrder,
  insertOrderItems,
  insertOrderStatusHistory,
  insertReadyNotification,
  updateOrderStatus,
} from './order.repository';

// ─────────────────────────────────────────────────────────────────────────────
// STATUS LIFECYCLE
// One-way chain: RECEIVED → PREPARING → READY → FINISHED
// CANCELLED is allowed from RECEIVED or PREPARING only.
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  RECEIVED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['FINISHED'],
  FINISHED: [],
  CANCELLED: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER: PLACE ORDER
// ─────────────────────────────────────────────────────────────────────────────

export const placeOrder = async (
  customerId: string,
  items: Array<{ menu_item_id: string; quantity: number }>,
  notes?: string
): Promise<OrderDetail> => {
  // 1. Look up unit prices for all requested menu items
  const { data: menuRows, error: menuError } = await supabase
    .from('menu_items')
    .select('id, price, is_available, name')
    .in(
      'id',
      items.map((i) => i.menu_item_id)
    );

  if (menuError) {
    throw new Error(`Failed to fetch menu items: ${menuError.message}`);
  }

  const menuMap = new Map<string, { price: number; is_available: boolean; name: string }>(
    ((menuRows ?? []) as { id: string; price: number; is_available: boolean; name: string }[]).map(
      (row) => [row.id, { price: row.price, is_available: row.is_available, name: row.name }]
    )
  );

  // 2. Validate every item exists and is available
  for (const item of items) {
    const menuItem = menuMap.get(item.menu_item_id);
    if (!menuItem) {
      throw new Error(`Menu item ${item.menu_item_id} not found`);
    }
    if (!menuItem.is_available) {
      throw new Error(`"${menuItem.name}" is currently unavailable`);
    }
  }

  // 3. Calculate total price
  const total_price = items.reduce((sum, item) => {
    const price = menuMap.get(item.menu_item_id)!.price;
    return sum + price * item.quantity;
  }, 0);

  // 4. Insert the order
  const order = await insertOrder({
    customer_id: customerId,
    total_price,
    notes: notes ?? null,
  });

  // 5. Insert all order items with their unit prices locked at time of order
  await insertOrderItems(
    items.map((item) => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: menuMap.get(item.menu_item_id)!.price,
    }))
  );

  // 6. Log the initial status to order_status_history
  await insertOrderStatusHistory({
    order_id: order.id,
    old_status: null,
    new_status: 'RECEIVED',
    changed_by: customerId,
  });

  // 7. Return full order detail
  const detail = await getOrderDetail(order.id);
  if (!detail) {
    throw new Error('Order created but could not be retrieved');
  }

  return detail;
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER: VIEW ACTIVE ORDERS
// ─────────────────────────────────────────────────────────────────────────────

export const getMyActiveOrders = async (customerId: string): Promise<OrderDetail[]> => {
  return getActiveOrdersByCustomer(customerId);
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER: ORDER HISTORY
// ─────────────────────────────────────────────────────────────────────────────

export const getMyOrderHistory = async (customerId: string): Promise<OrderDetail[]> => {
  return getOrderHistoryByCustomer(customerId);
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED: SINGLE ORDER DETAIL
// ─────────────────────────────────────────────────────────────────────────────

export const getOrderDetailById = async (
  orderId: string,
  requesterId: string,
  requesterRole: string
): Promise<OrderDetail> => {
  const detail = await getOrderDetail(orderId);

  if (!detail) {
    throw new Error('Order not found');
  }

  // Customers may only view their own orders
  if (requesterRole === 'CUSTOMER' && detail.customer_id !== requesterId) {
    throw new Error('Order not found');
  }

  return detail;
};

// ─────────────────────────────────────────────────────────────────────────────
// STAFF: LIST ALL ACTIVE ORDERS
// ─────────────────────────────────────────────────────────────────────────────

export const listActiveOrders = async (): Promise<OrderSummary[]> => {
  return getAllActiveOrders();
};

// ─────────────────────────────────────────────────────────────────────────────
// STAFF: ADVANCE / CANCEL ORDER STATUS
// ─────────────────────────────────────────────────────────────────────────────

export const advanceOrderStatus = async (
  orderId: string,
  newStatus: OrderStatus,
  staffId: string
): Promise<OrderDetail> => {
  // 1. Load current order
  const order = await getOrderById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  // 2. Validate lifecycle transition
  const allowedNext = ALLOWED_TRANSITIONS[order.status];
  if (!allowedNext.includes(newStatus)) {
    throw new Error(
      `Cannot transition from ${order.status} to ${newStatus}. ` +
        `Allowed next statuses: ${allowedNext.join(', ') || 'none'}`
    );
  }

  // 3. Persist the new status
  await updateOrderStatus(orderId, newStatus);

  // 4. Log the change to order_status_history
  await insertOrderStatusHistory({
    order_id: orderId,
    old_status: order.status,
    new_status: newStatus,
    changed_by: staffId,
  });

  // 5. If the order just became READY, create a notification for the customer
  if (newStatus === 'READY') {
    await insertReadyNotification(order.customer_id, orderId);
  }

  // 6. Return updated full detail
  const detail = await getOrderDetail(orderId);
  if (!detail) {
    throw new Error('Order updated but could not be retrieved');
  }

  return detail;
};
