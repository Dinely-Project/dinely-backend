import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../types';
import {
  getInvoiceByOrder,
  getInvoiceDetail,
  getInvoiceDownloadUrl,
  listMyInvoices,
} from './invoice.service';
import { listInvoicesQuerySchema } from './invoice.validator';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (mirrors pattern used in order.controller.ts)
// ─────────────────────────────────────────────────────────────────────────────

const formatZodError = (error: ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('; ');

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

/** Map known service-layer error messages to HTTP status codes. */
const handleServiceError = (res: Response, error: unknown): Response => {
  if (error instanceof Error) {
    const msg = error.message;

    if (msg === 'Invoice not found' || msg === 'Invoice not found for this order') {
      return res.status(404).json({ message: msg });
    }

    if (msg.startsWith('Failed to upload') || msg.startsWith('Failed to generate')) {
      return res.status(502).json({ message: msg });
    }

    if (msg.startsWith('Failed to')) {
      return res.status(500).json({ message: msg });
    }
  }

  return res.status(500).json({ message: 'Internal server error' });
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER — GET /api/invoices/my
// ─────────────────────────────────────────────────────────────────────────────

export const getMyInvoicesHandler = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  const auth = requireUser(req, res);
  if (!auth) return res as unknown as Response;

  const parsed = listInvoicesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  try {
    const invoices = await listMyInvoices(auth.userId, parsed.data);
    return res.status(200).json({ data: invoices });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER / STAFF / ADMIN — GET /api/invoices/order/:orderId
// ─────────────────────────────────────────────────────────────────────────────

export const getInvoiceByOrderHandler = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  const auth = requireUser(req, res);
  if (!auth) return res as unknown as Response;

  const orderId = Array.isArray(req.params.orderId)
    ? req.params.orderId[0]
    : req.params.orderId;

  try {
    const invoice = await getInvoiceByOrder(orderId, auth.userId, auth.role);
    return res.status(200).json({ data: invoice });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER / STAFF / ADMIN — GET /api/invoices/:invoiceId
// ─────────────────────────────────────────────────────────────────────────────

export const getInvoiceByIdHandler = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  const auth = requireUser(req, res);
  if (!auth) return res as unknown as Response;

  const invoiceId = Array.isArray(req.params.invoiceId)
    ? req.params.invoiceId[0]
    : req.params.invoiceId;

  try {
    const invoice = await getInvoiceDetail(invoiceId, auth.userId, auth.role);
    return res.status(200).json({ data: invoice });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER / STAFF / ADMIN — GET /api/invoices/:invoiceId/download
// ─────────────────────────────────────────────────────────────────────────────

export const downloadInvoiceHandler = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  const auth = requireUser(req, res);
  if (!auth) return res as unknown as Response;

  const invoiceId = Array.isArray(req.params.invoiceId)
    ? req.params.invoiceId[0]
    : req.params.invoiceId;

  try {
    const result = await getInvoiceDownloadUrl(invoiceId, auth.userId, auth.role);
    return res.status(200).json({
      message: 'Download URL generated',
      data: result,
    });
  } catch (error) {
    return handleServiceError(res, error);
  }
};
