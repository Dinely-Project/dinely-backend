import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../types';
import { OrderStatusSchema } from '../../types/schemas';
import {
  advanceOrderStatus,
  getMyActiveOrders,
  getMyOrderHistory,
  getOrderDetailById,
  listActiveOrders,
  placeOrder,
} from './order.service';
import { placeOrderSchema, updateOrderStatusSchema } from './order.validator';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const formatZodError = (error: ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('; ');

/** Known service errors → HTTP status codes. */
const ORDER_ERROR_STATUS: Record<string, 400 | 403 | 404 | 409 | 500> = {
  'Order not found': 404,
  'Order created but could not be retrieved': 500,
  'Order updated but could not be retrieved': 500,
};

const handleServiceError = (res: Response, error: unknown): Response => {
  if (error instanceof Error) {
    const known = ORDER_ERROR_STATUS[error.message];
    if (known) {
      return res.status(known).json({ message: error.message });
    }

    // Lifecycle / validation errors raised by the service layer
    if (
      error.message.startsWith('Cannot transition') ||
      error.message.includes('not found') ||
      error.message.includes('unavailable') ||
      error.message.includes('Menu item')
    ) {
      return res.status(400).json({ message: error.message });
    }
  }

  return res.status(500).json({ message: 'Internal server error' });
};

const requireUser = (
  req: AuthRequest,
  res: Response
): { userId: string; role: string } | null => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return null;
  }
  return { userId: req.user.userId, role: req.user.role };
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER — POST /api/orders
// ─────────────────────────────────────────────────────────────────────────────

export const createOrder = async (req: AuthRequest, res: Response): Promise<Response> => {
  const auth = requireUser(req, res);
  if (!auth) return res as unknown as Response;

  const parsed = placeOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  try {
    const order = await placeOrder(
      auth.userId,
      parsed.data.items,
      parsed.data.notes
    );
    return res.status(201).json({ message: 'Order placed', data: order });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER — GET /api/orders/my
// ─────────────────────────────────────────────────────────────────────────────

export const getMyOrders = async (req: AuthRequest, res: Response): Promise<Response> => {
  const auth = requireUser(req, res);
  if (!auth) return res as unknown as Response;

  try {
    const orders = await getMyActiveOrders(auth.userId);
    return res.status(200).json({ data: orders });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER — GET /api/orders/history
// ─────────────────────────────────────────────────────────────────────────────

export const getOrderHistory = async (req: AuthRequest, res: Response): Promise<Response> => {
  const auth = requireUser(req, res);
  if (!auth) return res as unknown as Response;

  try {
    const orders = await getMyOrderHistory(auth.userId);
    return res.status(200).json({ data: orders });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STAFF — GET /api/orders
// ─────────────────────────────────────────────────────────────────────────────

export const getActiveOrders = async (_req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const orders = await listActiveOrders();
    return res.status(200).json({ data: orders });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STAFF or CUSTOMER — GET /api/orders/:id
// ─────────────────────────────────────────────────────────────────────────────

export const getOrderById = async (req: AuthRequest, res: Response): Promise<Response> => {
  const auth = requireUser(req, res);
  if (!auth) return res as unknown as Response;

  const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const order = await getOrderDetailById(orderId, auth.userId, auth.role);
    return res.status(200).json({ data: order });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STAFF — PATCH /api/orders/:id/status
// ─────────────────────────────────────────────────────────────────────────────

export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<Response> => {
  const auth = requireUser(req, res);
  if (!auth) return res as unknown as Response;

  const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const parsed = updateOrderStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  // Validate against the full OrderStatus enum (updateOrderStatusSchema already
  // excludes RECEIVED, which staff can never set — the order starts there)
  const statusParsed = OrderStatusSchema.safeParse(parsed.data.status);
  if (!statusParsed.success) {
    return res.status(400).json({ message: 'Invalid status value' });
  }

  try {
    const order = await advanceOrderStatus(orderId, parsed.data.status, auth.userId);
    return res.status(200).json({ message: 'Order status updated', data: order });
  } catch (error) {
    return handleServiceError(res, error);
  }
};
