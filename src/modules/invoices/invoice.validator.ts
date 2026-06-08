import { z } from 'zod';

// ── Customer/Staff: list invoices with optional status filter ─────────────────
export const listInvoicesQuerySchema = z.object({
  status: z.enum(['ISSUED', 'PAID', 'REFUNDED', 'VOID']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
