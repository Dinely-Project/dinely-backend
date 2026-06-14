import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/rbac.middleware';
import { getMyProfile, updateMyEmail, updateMyPassword, updateMyProfile } from './customer.controller';

export const customerRoutes = Router();

customerRoutes.use(authenticate, authorize('CUSTOMER'));

customerRoutes.get('/me', getMyProfile);
customerRoutes.patch('/me', updateMyProfile);
customerRoutes.patch('/me/email', updateMyEmail);
customerRoutes.patch('/me/password', updateMyPassword);
