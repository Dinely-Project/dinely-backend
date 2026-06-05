import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/rbac.middleware';
import {
  createCategory,
  createItem,
  deleteCategory,
  deleteItem,
  getCategories,
  getItem,
  getItems,
  updateAvailability,
  updateCategory,
  updateItem,
} from './menu.controller';

export const menuRoutes = Router();

menuRoutes.get('/categories', getCategories);
menuRoutes.post('/categories', authenticate, authorize('STAFF'), createCategory);
menuRoutes.put('/categories/:id', authenticate, authorize('STAFF'), updateCategory);
menuRoutes.delete('/categories/:id', authenticate, authorize('STAFF'), deleteCategory);

menuRoutes.get('/items', getItems);
menuRoutes.get('/items/:id', getItem);
menuRoutes.post('/items', authenticate, authorize('STAFF'), createItem);
menuRoutes.put('/items/:id', authenticate, authorize('STAFF'), updateItem);
menuRoutes.delete('/items/:id', authenticate, authorize('STAFF'), deleteItem);
menuRoutes.patch(
  '/items/:id/availability',
  authenticate,
  authorize('STAFF'),
  updateAvailability
);
