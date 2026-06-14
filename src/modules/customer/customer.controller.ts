import { Response } from 'express';
import { ZodError } from 'zod';
import {
  getCustomerProfile,
  updateCustomerEmail,
  updateCustomerPassword,
  updateCustomerProfile,
} from './customer.service';
import { AuthRequest } from '../../types';
import {
  updateOwnEmailSchema,
  updateOwnPasswordSchema,
  updateProfileSchema,
} from './customer.validator';

const formatZodError = (error: ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('; ');

const CUSTOMER_ERROR_STATUS: Record<string, 400 | 401 | 404> = {
  'Profile not found': 404,
  'Incorrect password': 400,
  'Email already in use': 400,
};

const handleServiceError = (res: Response, error: unknown): Response => {
  if (error instanceof Error) {
    const status = CUSTOMER_ERROR_STATUS[error.message];
    if (status) {
      return res.status(status).json({ message: error.message });
    }
    console.error('[CustomerProfileError]', error.message, error.stack);
  }

  return res.status(500).json({ message: 'Internal server error' });
};

export const getMyProfile = async (req: AuthRequest, res: Response): Promise<Response> => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const profile = await getCustomerProfile(req.user.userId);
    return res.status(200).json({ data: profile });
  } catch (error: unknown) {
    return handleServiceError(res, error);
  }
};

export const updateMyProfile = async (req: AuthRequest, res: Response): Promise<Response> => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  try {
    const profile = await updateCustomerProfile(req.user.userId, parsed.data);
    return res.status(200).json({ message: 'Profile updated successfully', data: profile });
  } catch (error: unknown) {
    return handleServiceError(res, error);
  }
};

export const updateMyEmail = async (req: AuthRequest, res: Response): Promise<Response> => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const parsed = updateOwnEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  try {
    const profile = await updateCustomerEmail(
      req.user.userId,
      parsed.data.email,
      parsed.data.current_password
    );
    return res.status(200).json({ message: 'Email updated successfully', data: profile });
  } catch (error: unknown) {
    return handleServiceError(res, error);
  }
};

export const updateMyPassword = async (req: AuthRequest, res: Response): Promise<Response> => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const parsed = updateOwnPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  try {
    await updateCustomerPassword(
      req.user.userId,
      parsed.data.current_password,
      parsed.data.new_password
    );
    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (error: unknown) {
    return handleServiceError(res, error);
  }
};
