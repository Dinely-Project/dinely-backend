import { z } from 'zod';

// ── Customer: place a new order ───────────────────────────────────────────────
export const placeOrderSchema = z.object({
  items: z
    .array(
      z.object({
        menu_item_id: z.string().uuid('Invalid menu item id'),
        quantity: z.number().int().min(1, 'Quantity must be at least 1'),
      })
    )
    .min(1, 'Order must contain at least one item'),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
});

// ── Staff: advance / cancel an order ─────────────────────────────────────────
export const updateOrderStatusSchema = z.object({
  status: z.enum(['PREPARING', 'READY', 'FINISHED', 'CANCELLED'], {
    message: 'Status must be one of: PREPARING, READY, FINISHED, CANCELLED',
  }),
});
