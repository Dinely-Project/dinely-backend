import { z } from 'zod';

const employeeRoles = ['CHEF', 'SERVER', 'CLEANER', 'MANAGER', 'GENERAL'] as const;
const orderStatuses = ['RECEIVED', 'PREPARING', 'READY', 'FINISHED', 'CANCELLED'] as const;

export const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'DEACTIVATED']),
});

export const updateEmployeeRoleSchema = z.object({
  employee_role: z.enum(employeeRoles),
  employee_level: z.number().int().min(0).max(5),
});

export const salaryConfigParamsSchema = z.object({
  role: z.enum(employeeRoles),
  level: z.union([z.literal('null'), z.string().regex(/^[1-5]$/)]),
});

export const updateSalaryConfigSchema = z.object({
  base_salary: z.number().positive(),
});

export const updateSalarySchema = z.object({
  salary: z.number().positive(),
  reason: z.string().optional(),
});

export const adminOrdersQuerySchema = z.object({
  status: z.enum(orderStatuses).optional(),
  customer_id: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const analyticsQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month', 'year']).optional().default('month'),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export const updateOwnEmailSchema = z.object({
  email: z.string().email(),
  current_password: z.string().min(1),
});

export const updateOwnPasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8, 'New password must be at least 8 characters'),
});
