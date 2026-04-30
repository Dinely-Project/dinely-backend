import { z } from 'zod';

const employeeRoles = ['CHEF', 'SERVER', 'CLEANER', 'MANAGER', 'GENERAL'] as const;

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const customerRegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters long')
    .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
    .regex(/[0-9]/, 'Password must include at least one number'),
});

export const employeeRegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  employee_role: z.enum(employeeRoles),
  employee_level: z.number().int().min(0).max(5),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CustomerRegisterInput = z.infer<typeof customerRegisterSchema>;
export type EmployeeRegisterInput = z.infer<typeof employeeRegisterSchema>;
