import { z } from 'zod';

const employeeRoles = ['CHEF', 'SERVER', 'CLEANER', 'MANAGER', 'GENERAL'] as const;

export const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'DEACTIVATED']),
});

export const updateEmployeeRoleSchema = z.object({
  employee_role: z.enum(employeeRoles),
  employee_level: z.number().int().min(0).max(5),
});
