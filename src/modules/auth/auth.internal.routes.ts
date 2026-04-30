import { Router } from 'express';
import { registerEmployee } from './auth.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/rbac.middleware';

export const internalRoutes = Router();

internalRoutes.post(
  '/register/employee',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  registerEmployee
);

internalRoutes.get('/test/admin-only', authenticate, authorize('ADMIN'), (req, res) => {
  res.status(200).json({ message: 'ok' });
});

internalRoutes.get('/test/staff-only', authenticate, authorize('STAFF'), (req, res) => {
  res.status(200).json({ message: 'ok' });
});
