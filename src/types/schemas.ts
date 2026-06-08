
import { z } from 'zod';

export const UserRoleSchema = z.enum(['ADMIN', 'STAFF', 'EMPLOYEE', 'CUSTOMER']);
export const EmployeeRoleSchema = z.enum(['CHEF', 'SERVER', 'CLEANER', 'MANAGER', 'GENERAL']);
export const UserStatusSchema = z.enum(['PENDING', 'ACTIVE', 'REJECTED', 'DEACTIVATED']);

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  password_hash: z.string(),
  role: UserRoleSchema,
  employee_role: EmployeeRoleSchema.nullable(),
  employee_level: z.number().nullable(),
  salary: z.number().nullable(),
  status: UserStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export const RequestTypeSchema = z.enum(['PROMOTION', 'SALARY_INCREASE', 'RESIGNATION']);
export const RequestStatusSchema = z.enum(['PENDING', 'APPROVED', 'DECLINED']);

export const EmployeeRequestSchema = z.object({
  id: z.string().uuid(),
  employee_id: z.string().uuid(),
  type: RequestTypeSchema,
  cover_letter: z.string().nullable(),
  status: RequestStatusSchema,
  admin_feedback: z.string().nullable(),
  reviewed_by: z.string().uuid().nullable(),
  reviewed_at: z.string().nullable(),
  created_at: z.string(),
});

export const MenuCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  display_order: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string().optional(),
});

export const MenuItemSchema = z.object({
  id: z.string().uuid(),
  category_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  image_url: z.string().nullable(),
  is_available: z.boolean(),
  created_at: z.string(),
  updated_at: z.string().optional(),
});

//Order schemas

export const OrderStatusSchema = z.enum([
  'RECEIVED',
  'PREPARING',
  'READY',
  'FINISHED',
  'CANCELLED',
]);

export const OrderSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid(),
  status: OrderStatusSchema,
  total_price: z.number(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  menu_item_id: z.string().uuid(),
  quantity: z.number().int().min(1),
  unit_price: z.number(),
  subtotal: z.number(),
  created_at: z.string().optional(),
});

export const OrderStatusHistorySchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  old_status: OrderStatusSchema.nullable(),
  new_status: OrderStatusSchema,
  changed_by: z.string().uuid(),
  changed_at: z.string(),
});

//Notifications
 
export const NotificationSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  type: z.string(),
  message: z.string(),
  is_read: z.boolean(),
  reference_id: z.string().uuid().nullable(),
  created_at: z.string(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Invoices
// ─────────────────────────────────────────────────────────────────────────────

export const InvoiceStatusSchema = z.enum(['ISSUED', 'PAID', 'REFUNDED', 'VOID']);

export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  invoice_number: z.string(),
  order_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  total_amount: z.number(),
  status: InvoiceStatusSchema,
  pdf_url: z.string().nullable(),
  pdf_generated_at: z.string().nullable(),
  notes: z.string().nullable(),
  issued_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
