import { Request, Response } from 'express';
import { ZodError, z } from 'zod';
import {
  deleteUser as deleteUserService,
  getAllUsers as getAllUsersService,
  getEmployeeSalaryHistory as getEmployeeSalaryHistoryService,
  getSalaryConfigRows as getSalaryConfigRowsService,
  getUserById as getUserByIdService,
  updateSalary as updateSalaryService,
  updateSalaryConfig as updateSalaryConfigService,
  updateEmployeeRole as updateEmployeeRoleService,
  updateUserStatus as updateUserStatusService,
} from './admin.service';
import { AuthRequest } from '../../types';
import { UserRoleSchema, UserStatusSchema } from '../../types/schemas';
import {
  salaryConfigParamsSchema,
  updateEmployeeRoleSchema,
  updateSalaryConfigSchema,
  updateSalarySchema,
  updateStatusSchema,
} from './admin.validator';

const formatZodError = (error: ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('; ');

const getParamId = (req: Request): string =>
  Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

const filtersSchema = z.object({
  role: UserRoleSchema.optional(),
  status: UserStatusSchema.optional(),
});

const ADMIN_ERROR_STATUS: Record<string, 400 | 404> = {
  'User not found': 404,
  'Salary config not found': 400,
  'User is not an employee': 400,
};

const handleServiceError = (res: Response, error: unknown): Response => {
    console.error('SERVICE ERROR:', error);  // add this line
  if (error instanceof Error) {
    const status = ADMIN_ERROR_STATUS[error.message];
    if (status) {
      return res.status(status).json({ message: error.message });
    }
  }

  return res.status(500).json({ message: 'Internal server error' });
};

export const getUsers = async (req: Request, res: Response): Promise<Response> => {
  const parsed = filtersSchema.safeParse({
    role: req.query.role,
    status: req.query.status,
  });

  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  try {
    const users = await getAllUsersService(parsed.data);
    return res.status(200).json({ data: users });
  } catch (error: unknown) {
    return handleServiceError(res, error);
  }
};

export const getUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = await getUserByIdService(getParamId(req));
    return res.status(200).json({ data: user });
  } catch (error: unknown) {
    return handleServiceError(res, error);
  }
};

export const updateStatus = async (req: Request, res: Response): Promise<Response> => {
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  try {
    const user = await updateUserStatusService(getParamId(req), parsed.data.status);
    return res.status(200).json({ message: 'Status updated', data: user });
  } catch (error: unknown) {
    return handleServiceError(res, error);
  }
};

export const updateRole = async (req: Request, res: Response): Promise<Response> => {
  const parsed = updateEmployeeRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  try {
    const user = await updateEmployeeRoleService(
      getParamId(req),
      parsed.data.employee_role,
      parsed.data.employee_level
    );
    return res.status(200).json({ message: 'Role updated', data: user });
  } catch (error: unknown) {
    return handleServiceError(res, error);
  }
};

export const getSalaryConfigHandler = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  try {
    const configs = await getSalaryConfigRowsService();
    return res.status(200).json({ data: configs });
  } catch (error: unknown) {
    return handleServiceError(res, error);
  }
};

export const updateSalaryConfig = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  const parsedParams = salaryConfigParamsSchema.safeParse({
    role: req.params.role,
    level: req.params.level,
  });

  if (!parsedParams.success) {
    return res.status(400).json({ message: formatZodError(parsedParams.error) });
  }

  const parsedBody = updateSalaryConfigSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: formatZodError(parsedBody.error) });
  }

  try {
    const updated = await updateSalaryConfigService(
      parsedParams.data.role,
      parsedParams.data.level,
      parsedBody.data.base_salary,
      req.user!.userId
    );
    return res.status(200).json({ message: 'Salary config updated', data: updated });
  } catch (error: unknown) {
    return handleServiceError(res, error);
  }
};

export const updateSalary = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  const parsed = updateSalarySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  try {
    const user = await updateSalaryService(
      getParamId(req),
      parsed.data.salary,
      parsed.data.reason,
      req.user!.userId
    );
    return res.status(200).json({ message: 'Salary updated', data: user });
  } catch (error: unknown) {
    return handleServiceError(res, error);
  }
};

export const getSalaryHistory = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const history = await getEmployeeSalaryHistoryService(getParamId(req));
    return res.status(200).json({ data: history });
  } catch (error: unknown) {
    return handleServiceError(res, error);
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    await deleteUserService(getParamId(req));
    return res.status(200).json({ message: 'User deleted' });
  } catch (error: unknown) {
    return handleServiceError(res, error);
  }
};
