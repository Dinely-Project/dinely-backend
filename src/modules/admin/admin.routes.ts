import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/rbac.middleware';
import {
  deleteUser,
  getSalaryHistory,
  getUser,
  getUsers,
  updateRole,
  updateStatus,
} from './admin.controller';

export const adminRoutes = Router();

adminRoutes.use(authenticate, authorize('ADMIN'));

adminRoutes.get('/users', getUsers);
adminRoutes.get('/users/:id', getUser);
adminRoutes.patch('/users/:id/status', updateStatus);
adminRoutes.patch('/users/:id/role', updateRole);
adminRoutes.get('/users/:id/salary-history', getSalaryHistory);
adminRoutes.delete('/users/:id', deleteUser);
