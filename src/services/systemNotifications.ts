/**
 * System-wide notification helpers.
 * Writes to the `system_notifications` and `password_reset_requests`
 * Supabase tables; silently no-ops if Supabase is unreachable.
 */
import { supabase } from '../lib/supabase';

export type SysNotifType =
  | 'password_reset'
  | 'inventory_in'
  | 'inventory_out'
  | 'repair_in'
  | 'repair_out'
  | 'delivery';

export interface SystemNotification {
  id: string;
  type: SysNotifType;
  title: string;
  body: string;
  status: 'unread' | 'read';
  related_id: string | null;
  created_by: string | null;
  created_at: string;
}

export async function insertSystemNotification(params: {
  type: SysNotifType;
  title: string;
  body: string;
  related_id?: string | null;
  created_by?: string | null;
}): Promise<void> {
  try {
    const { error } = await supabase.from('system_notifications').insert({
      type: params.type,
      title: params.title,
      body: params.body,
      status: 'unread',
      related_id: params.related_id ?? null,
      created_by: params.created_by ?? null,
    });
    if (error) console.warn('[sysNotif] insert error:', error.message);
  } catch (err) {
    console.warn('[sysNotif] Failed to insert:', err);
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    await supabase.from('system_notifications').update({ status: 'read' }).eq('id', id);
  } catch (err) {
    console.warn('[sysNotif] Failed to mark read:', err);
  }
}
