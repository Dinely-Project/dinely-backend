import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  description: z.string().optional(),
  display_order: z.number().int().min(0).optional(),
});

export const updateCategorySchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters long').optional(),
    description: z.string().optional(),
    display_order: z.number().int().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export const createItemSchema = z.object({
  category_id: z.string().uuid('Invalid category id'),
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  description: z.string().nullable().optional(),
  price: z.number().min(0, 'Price must be a positive number'),
  image_url: z.string().nullable().optional(),
  is_available: z.boolean().optional(),
});

export const updateItemSchema = z
  .object({
    category_id: z.string().uuid('Invalid category id').optional(),
    name: z.string().min(2, 'Name must be at least 2 characters long').optional(),
    description: z.string().nullable().optional(),
    price: z.number().min(0, 'Price must be a positive number').optional(),
    image_url: z.string().nullable().optional(),
    is_available: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export const updateAvailabilitySchema = z.object({
  is_available: z.boolean(),
});
