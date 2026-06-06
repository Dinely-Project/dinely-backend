import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/rbac.middleware';
import {
  createOrder,
  getActiveOrders,
  getMyOrders,
  getOrderById,
  getOrderHistory,
  updateOrderStatus,
} from './order.controller';

export const orderRoutes = Router();

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER routes
// All require authentication + CUSTOMER role
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/orders — place a new order
orderRoutes.post('/', authenticate, authorize('CUSTOMER'), createOrder);

// GET /api/orders/my — customer's active orders
// NOTE: registered BEFORE /:id so Express doesn't treat "my" as an id param
orderRoutes.get('/my', authenticate, authorize('CUSTOMER'), getMyOrders);

// GET /api/orders/history — customer's completed / cancelled orders
// NOTE: registered BEFORE /:id for the same reason
orderRoutes.get('/history', authenticate, authorize('CUSTOMER'), getOrderHistory);

// ─────────────────────────────────────────────────────────────────────────────
// STAFF routes
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/orders — all active orders (RECEIVED, PREPARING, READY)
orderRoutes.get('/', authenticate, authorize('STAFF'), getActiveOrders);

// PATCH /api/orders/:id/status — advance or cancel an order
orderRoutes.patch('/:id/status', authenticate, authorize('STAFF'), updateOrderStatus);

// ─────────────────────────────────────────────────────────────────────────────
// SHARED routes (STAFF or CUSTOMER)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/orders/:id — full order detail
// The service layer enforces that customers can only see their own orders.
orderRoutes.get('/:id', authenticate, authorize('STAFF', 'CUSTOMER'), getOrderById);
