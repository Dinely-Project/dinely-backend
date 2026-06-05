import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/rbac.middleware';
import {
  deleteUser,
  getSalaryConfigHandler,
  getSalaryHistory,
  getUser,
  getUsers,
  updateRole,
  updateSalary,
  updateSalaryConfig,
  updateStatus,
} from './admin.controller';

export const adminRoutes = Router();

adminRoutes.use(authenticate, authorize('ADMIN'));

adminRoutes.get('/salary-config', getSalaryConfigHandler);
adminRoutes.put('/salary-config/:role/:level', updateSalaryConfig);
adminRoutes.get('/users', getUsers);
adminRoutes.get('/users/:id', getUser);
adminRoutes.patch('/users/:id/status', updateStatus);
adminRoutes.patch('/users/:id/role', updateRole);
adminRoutes.patch('/users/:id/salary', updateSalary);
adminRoutes.get('/users/:id/salary-history', getSalaryHistory);
adminRoutes.delete('/users/:id', deleteUser);
