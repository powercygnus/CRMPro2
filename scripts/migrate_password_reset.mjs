/**
 * One-shot migration: ensure password_reset_requests and system_notifications
 * tables exist with all required columns.
 * Run with: node scripts/migrate_password_reset.mjs
 */
import pg from 'pg';

const { Pool } = pg;

function buildPoolerUrl(raw) {
  if (!raw) return null;
  try {
    const trimmed = raw.trim();
    const u = new URL(trimmed);
    if (u.port === '6543' || u.hostname.includes('pooler')) return trimmed;
    const match = u.hostname.match(/^db\.(.+)\.supabase\.co$/);
    const projectId = match ? match[1] : u.hostname.split('.')[1];
    u.hostname = 'aws-0-ap-northeast-1.pooler.supabase.com';
    u.port = '6543';
    u.username = `postgres.${projectId}`;
    return u.toString();
  } catch (err) {
    console.error('Failed to build pooler URL:', err.message);
    return null;
  }
}

const url = buildPoolerUrl(process.env.SUPABASE_DB_URL);
if (!url) { console.error('SUPABASE_DB_URL not set'); process.exit(1); }

const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const SQL = `
-- ============================================================
-- password_reset_requests: create if missing, add columns
-- ============================================================
create table if not exists password_reset_requests (
  id          uuid primary key default gen_random_uuid(),
  username    text not null,
  status      text not null default 'pending',
  created_at  timestamptz not null default now()
);

-- Add missing columns (idempotent)
alter table password_reset_requests add column if not exists temp_password  text;
alter table password_reset_requests add column if not exists resolved_at    timestamptz;
alter table password_reset_requests add column if not exists resolved_by    text;

-- Disable RLS so the service-role backend can read/write freely
alter table password_reset_requests disable row level security;

-- ============================================================
-- system_notifications: create if missing
-- ============================================================
create table if not exists system_notifications (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,
  title       text not null,
  body        text not null default '',
  status      text not null default 'unread',
  related_id  uuid,
  created_by  text,
  created_at  timestamptz not null default now()
);

alter table system_notifications disable row level security;

-- Index for fast unread-count queries
create index if not exists idx_sys_notif_status on system_notifications(status);
create index if not exists idx_sys_notif_type   on system_notifications(type);
`;

try {
  const client = await pool.connect();
  console.log('Connected to DB. Running migration…');
  await client.query(SQL);
  console.log('✅ Migration complete.');
  client.release();
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
