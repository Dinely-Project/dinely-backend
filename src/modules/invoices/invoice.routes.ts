import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/rbac.middleware';
import {
  downloadInvoiceHandler,
  getInvoiceByIdHandler,
  getInvoiceByOrderHandler,
  getMyInvoicesHandler,
} from './invoice.controller';

export const invoiceRoutes = Router();

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: Static-segment routes are registered BEFORE dynamic /:invoiceId
// so Express does not treat "my" or "order" as invoice ID values.
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/invoices/my
// Customer: list all their own invoices (supports ?status=ISSUED&limit=20&offset=0)
invoiceRoutes.get(
  '/my',
  authenticate,
  authorize('CUSTOMER'),
  getMyInvoicesHandler
);

// GET /api/invoices/order/:orderId
// Customer / Staff / Admin: get the invoice linked to a specific order
invoiceRoutes.get(
  '/order/:orderId',
  authenticate,
  authorize('CUSTOMER', 'STAFF', 'ADMIN'),
  getInvoiceByOrderHandler
);

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic routes — registered AFTER static routes
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/invoices/:invoiceId/download
// Customer / Staff / Admin: generate (if needed) and return a signed PDF download URL.
// NOTE: /:invoiceId/download is registered before /:invoiceId to avoid
// Express treating "download" as a nested param.
invoiceRoutes.get(
  '/:invoiceId/download',
  authenticate,
  authorize('CUSTOMER', 'STAFF', 'ADMIN'),
  downloadInvoiceHandler
);

// GET /api/invoices/:invoiceId
// Customer / Staff / Admin: get full invoice detail by invoice ID
invoiceRoutes.get(
  '/:invoiceId',
  authenticate,
  authorize('CUSTOMER', 'STAFF', 'ADMIN'),
  getInvoiceByIdHandler
);
