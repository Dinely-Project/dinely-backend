import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/rbac.middleware';
import {
  getMyRequest,
  getMyRequests,
  getRequest,
  listRequests,
  reviewRequest,
  submitRequest,
} from './employee-requests.controller';

export const employeeRequestRoutes = Router();

employeeRequestRoutes.post('/', authenticate, authorize('EMPLOYEE'), submitRequest);
employeeRequestRoutes.get('/my', authenticate, authorize('EMPLOYEE'), getMyRequests);
employeeRequestRoutes.get('/my/:id', authenticate, authorize('EMPLOYEE'), getMyRequest);

employeeRequestRoutes.get('/', authenticate, authorize('ADMIN'), listRequests);
employeeRequestRoutes.get('/:id', authenticate, authorize('ADMIN'), getRequest);
employeeRequestRoutes.patch('/:id/review', authenticate, authorize('ADMIN'), reviewRequest);
