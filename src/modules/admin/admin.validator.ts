import { z } from 'zod';

const employeeRoles = ['CHEF', 'SERVER', 'CLEANER', 'MANAGER', 'GENERAL'] as const;

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
