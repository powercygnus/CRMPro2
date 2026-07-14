// src/services/supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'cygnus_crm_state';

interface DbConfig {
  mode: 'cloud' | 'local';
  supabase_url: string;
  supabase_anon_key: string;
}

function readDbConfig(): DbConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const db = parsed?.config?.database;
    if (db && db.supabase_url && db.supabase_anon_key) {
      return { mode: db.mode, supabase_url: db.supabase_url, supabase_anon_key: db.supabase_anon_key };
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

function resolveCredentials() {
  const stored = readDbConfig();
  const url = (stored?.supabase_url) || import.meta.env.VITE_SUPABASE_URL || '';
  const key = (stored?.supabase_anon_key) || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  return { url, key, fromConfig: Boolean(stored) };
}

const { url, key, fromConfig } = resolveCredentials();

if (!url || !key) {
  console.info('[supabase] Credentials not set — running in localStorage-only mode.');
} else if (fromConfig) {
  console.info('[supabase] Using dynamically configured credentials from app config.');
}

export const supabase: SupabaseClient = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder-key'
);

export function isSupabaseConfigured(): boolean {
  return Boolean(url && key);
}

export function reinitSupabaseClient(): SupabaseClient {
  const creds = resolveCredentials();
  if (!creds.url || !creds.key) {
    console.info('[supabase] Re-init: credentials not set — staying in localStorage-only mode.');
  }
  return createClient(
    creds.url || 'https://placeholder.supabase.co',
    creds.key || 'placeholder-key'
  );
}
