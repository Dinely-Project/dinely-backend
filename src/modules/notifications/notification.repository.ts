import { supabase } from '../../config/supabase';
import { Notification } from '../../types';
import { NotificationSchema } from '../../types/schemas';

// read
/** Fetch all notifications for a user, newest first. */
export const getNotificationsByUser = async (
  userId: string,
  filters?: { is_read?: boolean }
): Promise<Notification[]> => {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (typeof filters?.is_read === 'boolean') {
    query = query.eq('is_read', filters.is_read);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch notifications: ${error.message}`);
  }

  return ((data ?? []) as unknown[]).map((row) =>
    NotificationSchema.parse(row)
  );
};

/** Fetch a single notification by id. */
export const getNotificationById = async (
  id: string
): Promise<Notification | null> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', id)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch notification: ${error.message}`);
  }

  if (!data || data.length === 0) return null;
  return NotificationSchema.parse(data[0]);
};

/** Count of unread notifications for a user — used for badge counts. */
export const countUnread = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    throw new Error(`Failed to count unread notifications: ${error.message}`);
  }

  return count ?? 0;
};


// WRITE
/** Mark a single notification as read. */
export const markOneAsRead = async (
  id: string,
  userId: string
): Promise<Notification> => {
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', userId) // ownership guard at DB level
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to mark notification as read: ${error?.message ?? 'No data returned'}`
    );
  }

  return NotificationSchema.parse(data);
};

/** Mark ALL unread notifications for a user as read in one call. */
export const markAllAsRead = async (userId: string): Promise<number> => {
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .select('id');

  if (error) {
    throw new Error(`Failed to mark all as read: ${error.message}`);
  }

  return (data ?? []).length;
};

/** Insert a notification. Used internally by other modules. */
export const insertNotification = async (payload: {
  user_id: string;
  type: string;
  message: string;
  reference_id?: string | null;
}): Promise<Notification> => {
  const { data, error } = await supabase
    .from('notifications')
    .insert({ ...payload, is_read: false })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to insert notification: ${error?.message ?? 'No data returned'}`
    );
  }

  return NotificationSchema.parse(data);
};
