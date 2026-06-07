import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../types';
import {
  adminEmployeeRequestsQuerySchema,
  myEmployeeRequestsQuerySchema,
  reviewEmployeeRequestSchema,
  submitEmployeeRequestSchema,
} from './employee-requests.validator';
import {
  getEmployeeRequestDetail as getEmployeeRequestDetailService,
  getMyEmployeeRequestById as getMyEmployeeRequestByIdService,
  getMyEmployeeRequests as getMyEmployeeRequestsService,
  listEmployeeRequests as listEmployeeRequestsService,
  reviewEmployeeRequest as reviewEmployeeRequestService,
  submitEmployeeRequest as submitEmployeeRequestService,
} from './employee-requests.service';

const formatZodError = (error: ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('; ');

const getParamId = (req: AuthRequest): string =>
  Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

const REQUEST_ERROR_STATUS: Record<string, 400 | 404 | 409> = {
  'Request not found': 404,
  'You already have a pending request of this type': 409,
  'Request has already been reviewed': 400,
};

const handleServiceError = (res: Response, error: unknown): Response => {
  if (error instanceof Error) {
    const status = REQUEST_ERROR_STATUS[error.message];
    if (status) {
      return res.status(status).json({ message: error.message });
    }
  }

  return res.status(500).json({ message: 'Internal server error' });
};

const requireUser = (req: AuthRequest, res: Response): { userId: string } | null => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return null;
  }

  return { userId: req.user.userId };
};

export const submitRequest = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  const auth = requireUser(req, res);
  if (!auth) return res as unknown as Response;

  const parsed = submitEmployeeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  try {
    const request = await submitEmployeeRequestService(auth.userId, parsed.data);
    return res.status(201).json({ message: 'Request submitted', data: request });
  } catch (error: unknown) {
    return handleServiceError(res, error);
  }
};

export const getMyRequests = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  const auth = requireUser(req, res);
  if (!auth) return res as unknown as Response;

  const parsed = myEmployeeRequestsQuerySchema.safeParse({
    status: req.query.status,
  });

  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  try {
    const requests = await getMyEmployeeRequestsService(auth.userId, parsed.data);
    return res.status(200).json({ data: requests });
  } catch (error: unknown) {
    return handleServiceError(res, error);
  }
};

export const getMyRequest = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  const auth = requireUser(req, res);
  if (!auth) return res as unknown as Response;

  try {
    const request = await getMyEmployeeRequestByIdService(auth.userId, getParamId(req));
    return res.status(200).json({ data: request });
  } catch (error: unknown) {
    return handleServiceError(res, error);
  }
};

export const listRequests = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  const parsed = adminEmployeeRequestsQuerySchema.safeParse({
    status: req.query.status,
    type: req.query.type,
  });

  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  try {
    const requests = await listEmployeeRequestsService(parsed.data);
    return res.status(200).json({ data: requests });
  } catch (error: unknown) {
    return handleServiceError(res, error);
  }
};

export const getRequest = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  try {
    const request = await getEmployeeRequestDetailService(getParamId(req));
    return res.status(200).json({ data: request });
  } catch (error: unknown) {
    return handleServiceError(res, error);
  }
};

export const reviewRequest = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  const auth = requireUser(req, res);
  if (!auth) return res as unknown as Response;

  const parsed = reviewEmployeeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  try {
    const request = await reviewEmployeeRequestService(
      getParamId(req),
      parsed.data,
      auth.userId
    );
    return res.status(200).json({ message: 'Request reviewed', data: request });
  } catch (error: unknown) {
    return handleServiceError(res, error);
  }
};
