import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/rbac.middleware';
import {
  getNotifications,
  markAllRead,
  markOneRead,
} from './notification.controller';

export const notificationRoutes = Router();

// All notification routes require authentication.
// Any role (CUSTOMER, EMPLOYEE, STAFF, ADMIN) may have notifications.

// GET /api/notifications — list notifications for the current user
// ?is_read=false  returns only unread (useful for badge polling)
// ?is_read=true   returns only read
// (no param)      returns all
notificationRoutes.get(
  '/',
  authenticate,
  authorize('CUSTOMER', 'EMPLOYEE', 'STAFF', 'ADMIN'),
  getNotifications
);

// PATCH /api/notifications/read-all — mark every unread notification as read
// NOTE: registered BEFORE /:id/read so "read-all" is not treated as an id
notificationRoutes.patch(
  '/read-all',
  authenticate,
  authorize('CUSTOMER', 'EMPLOYEE', 'STAFF', 'ADMIN'),
  markAllRead
);

// PATCH /api/notifications/:id/read — mark a single notification as read
notificationRoutes.patch(
  '/:id/read',
  authenticate,
  authorize('CUSTOMER', 'EMPLOYEE', 'STAFF', 'ADMIN'),
  markOneRead
);
