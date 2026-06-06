import { Response } from 'express';
import { AuthRequest } from '../../types';
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notification.service';

// Helpers

const requireUser = (
  req: AuthRequest,
  res: Response
): { userId: string } | null => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return null;
  }
  return { userId: req.user.userId };
};

const handleServiceError = (res: Response, error: unknown): Response => {
  if (error instanceof Error) {
    if (error.message === 'Notification not found') {
      return res.status(404).json({ message: error.message });
    }
  }
  return res.status(500).json({ message: 'Internal server error' });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/notifications
// Returns all notifications + unread badge count.
// Optional query param: ?is_read=true  or  ?is_read=false
// ─────────────────────────────────────────────────────────────────────────────

export const getNotifications = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  const auth = requireUser(req, res);
  if (!auth) return res as unknown as Response;

  // Parse optional filter
  let is_read: boolean | undefined;
  if (req.query.is_read === 'true') is_read = true;
  if (req.query.is_read === 'false') is_read = false;

  try {
    const result = await getMyNotifications(auth.userId, { is_read });
    return res.status(200).json({ data: result });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/notifications/:id/read
// Marks a single notification as read.
// ─────────────────────────────────────────────────────────────────────────────

export const markOneRead = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  const auth = requireUser(req, res);
  if (!auth) return res as unknown as Response;

  const notificationId = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;

  try {
    const notification = await markNotificationRead(notificationId, auth.userId);
    return res
      .status(200)
      .json({ message: 'Notification marked as read', data: notification });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/notifications/read-all
// Marks every unread notification for the current user as read.
// ─────────────────────────────────────────────────────────────────────────────

export const markAllRead = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  const auth = requireUser(req, res);
  if (!auth) return res as unknown as Response;

  try {
    const result = await markAllNotificationsRead(auth.userId);
    return res.status(200).json({
      message: `${result.marked} notification${result.marked !== 1 ? 's' : ''} marked as read`,
      data: result,
    });
  } catch (error) {
    return handleServiceError(res, error);
  }
};
