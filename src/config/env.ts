import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET is required'),
  PORT: z.string().default('5000'),
  ALLOWED_ORIGIN: z.string().default('*'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Supabase Storage bucket name for generated invoice PDFs
  INVOICE_PDF_BUCKET: z.string().min(1, 'INVOICE_PDF_BUCKET is required').default('invoice-pdfs'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Missing or invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
