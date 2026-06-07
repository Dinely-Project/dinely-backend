import { z } from 'zod';
import { RequestStatusSchema, RequestTypeSchema } from '../../types/schemas';

export const submitEmployeeRequestSchema = z
  .object({
    type: RequestTypeSchema,
    cover_letter: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      (value.type === 'PROMOTION' || value.type === 'SALARY_INCREASE') &&
      (!value.cover_letter || value.cover_letter.length < 1)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['cover_letter'],
        message: 'Cover letter is required for promotion and salary increase requests',
      });
    }
  });

export const myEmployeeRequestsQuerySchema = z.object({
  status: RequestStatusSchema.optional(),
});

export const adminEmployeeRequestsQuerySchema = z.object({
  status: RequestStatusSchema.optional(),
  type: RequestTypeSchema.optional(),
});

export const reviewEmployeeRequestSchema = z.object({
  status: z.enum(['APPROVED', 'DECLINED']),
  admin_feedback: z.string().optional(),
});
