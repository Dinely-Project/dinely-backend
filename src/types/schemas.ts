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
