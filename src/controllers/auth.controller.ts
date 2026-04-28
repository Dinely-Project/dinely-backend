import { Request, Response } from 'express';
import { ZodError } from 'zod';
import {
  getMe as getMeService,
  loginUser,
  registerCustomer as registerCustomerService,
  registerEmployee as registerEmployeeService,
} from '../services/auth.service';
import { AuthRequest } from '../types';
import {
  customerRegisterSchema,
  employeeRegisterSchema,
  loginSchema,
} from '../validators/auth.validator';

const formatZodError = (error: ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('; ');

const AUTH_ERROR_STATUS: Record<string, 400 | 401> = {
  'Invalid email or password': 401,
  'Account is not active': 401,
  'Email already in use': 400,
  'User not found': 401,
};

const handleServiceError = (res: Response, error: unknown): Response => {
  if (error instanceof Error) {
    const status = AUTH_ERROR_STATUS[error.message];
    if (status) {
      return res.status(status).json({ message: error.message });
    }
  }

  return res.status(500).json({ message: 'Internal server error' });
};

export const login = async (req: Request, res: Response): Promise<Response> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  try {
    const { token, user } = await loginUser(parsed.data.email, parsed.data.password);
    return res.status(200).json({ token, user });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const registerCustomer = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const parsed = customerRegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  try {
    const user = await registerCustomerService(
      parsed.data.name,
      parsed.data.email,
      parsed.data.password
    );
    return res.status(201).json({ message: 'Registration successful', data: user });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const registerEmployee = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const parsed = employeeRegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  try {
    const user = await registerEmployeeService(
      parsed.data.name,
      parsed.data.email,
      parsed.data.password,
      parsed.data.employee_role,
      parsed.data.employee_level
    );
    return res
      .status(201)
      .json({ message: 'Registration submitted. Awaiting approval.', data: user });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<Response> => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const user = await getMeService(req.user.userId);
    return res.status(200).json({ data: user });
  } catch (error) {
    return handleServiceError(res, error);
  }
};
