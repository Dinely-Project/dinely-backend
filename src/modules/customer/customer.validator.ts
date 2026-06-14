import { z } from 'zod';

// E.164-ish phone format: optional leading +, 7-15 digits total.
const phoneRegex = /^\+?[0-9\s\-().]{7,20}$/;

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters long').max(100).optional(),
    phone: z
      .string()
      .trim()
      .regex(phoneRegex, 'Invalid phone number format')
      .max(20)
      .nullable()
      .optional(),

  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export const updateOwnEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  current_password: z.string().min(1, 'Current password is required'),
});

export const updateOwnPasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z
    .string()
    .min(6, 'New password must be at least 6 characters long')
    .regex(/[A-Z]/, 'New password must include at least one uppercase letter')
    .regex(/[0-9]/, 'New password must include at least one number'),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateOwnEmailInput = z.infer<typeof updateOwnEmailSchema>;
export type UpdateOwnPasswordInput = z.infer<typeof updateOwnPasswordSchema>;
