-- ============================================================
-- Migration 010: Password Reset & System Notifications
--
-- Fixes:
--   1. password_reset_requests — add missing columns
--      (temp_password, resolved_at, resolved_by) needed by the
--      server GET /api/password-reset/:id polling endpoint and
--      the NotificationBell approve/reject actions.
--
--   2. system_notifications — the table existed with a 'message'
--      column (NOT NULL, no default) but the server and frontend
--      both use 'body'. Add 'body' + 'created_by', copy data,
--      and relax the 'message' NOT NULL constraint so legacy rows
--      and new inserts don't conflict.
--
--   3. GRANT SELECT/INSERT/UPDATE/DELETE on both tables to the
--      'anon' and 'authenticated' roles so the Supabase JS client
--      (anon key) can read notifications and write approve/reject.
-- ============================================================

-- ── password_reset_requests ───────────────────────────────────

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username    text NOT NULL,
  status      text NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS temp_password  text;
ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS resolved_at    timestamptz;
ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS resolved_by    text;

ALTER TABLE password_reset_requests DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON password_reset_requests TO anon, authenticated;

-- ── system_notifications ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS system_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text NOT NULL,
  title       text NOT NULL,
  body        text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'unread',
  related_id  text,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Add columns that may be missing if the table already existed
-- with a different schema (column 'message' instead of 'body').
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS body       text NOT NULL DEFAULT '';
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS created_by text;

-- Relax the legacy 'message' column so existing inserts (which
-- don't provide it) don't hit a NOT NULL violation.
ALTER TABLE system_notifications ALTER COLUMN message SET DEFAULT '';
ALTER TABLE system_notifications ALTER COLUMN message DROP NOT NULL;

-- Backfill: copy 'message' into 'body' for any rows written
-- before this migration.
UPDATE system_notifications SET body = message
WHERE body = '' AND message IS NOT NULL AND message <> '';

ALTER TABLE system_notifications DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sys_notif_status ON system_notifications(status);
CREATE INDEX IF NOT EXISTS idx_sys_notif_type   ON system_notifications(type);

GRANT SELECT, INSERT, UPDATE, DELETE ON system_notifications TO anon, authenticated;
