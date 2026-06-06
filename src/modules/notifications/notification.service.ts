import { Notification } from '../../types';
import {
  countUnread,
  getNotificationById,
  getNotificationsByUser,
  markAllAsRead,
  markOneAsRead,
} from './notification.repository';

// ─────────────────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────────────────

export const getMyNotifications = async (
  userId: string,
  filters?: { is_read?: boolean }
): Promise<{ notifications: Notification[]; unread_count: number }> => {
  const [notifications, unread_count] = await Promise.all([
    getNotificationsByUser(userId, filters),
    countUnread(userId),
  ]);

  return { notifications, unread_count };
};

// ─────────────────────────────────────────────────────────────────────────────
// MARK ONE AS READ
// ─────────────────────────────────────────────────────────────────────────────

export const markNotificationRead = async (
  notificationId: string,
  userId: string
): Promise<Notification> => {
  // Verify the notification exists and belongs to the user
  const notification = await getNotificationById(notificationId);

  if (!notification) {
    throw new Error('Notification not found');
  }

  if (notification.user_id !== userId) {
    // Return same error as not-found to avoid information leak
    throw new Error('Notification not found');
  }

  if (notification.is_read) {
    // Already read — return it as-is without hitting the DB again
    return notification;
  }

  return markOneAsRead(notificationId, userId);
};

// ─────────────────────────────────────────────────────────────────────────────
// MARK ALL AS READ
// ─────────────────────────────────────────────────────────────────────────────

export const markAllNotificationsRead = async (
  userId: string
): Promise<{ marked: number }> => {
  const marked = await markAllAsRead(userId);
  return { marked };
};
