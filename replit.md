# CRMPRO

A full-featured CRM web application for repair shops, built with React + TypeScript (Vite) on the frontend and Express on the backend.

## Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express (port 3001)
- **Database**: Supabase (PostgreSQL) — falls back to localStorage if not configured
- **Messaging**: WhatsApp Business API via Meta Graph API

## Running the app

The `start.sh` script starts both services:
1. Express backend on port 3001 (handles WhatsApp API proxying and password-reset DB queries)
2. Vite dev server on port 5000 (proxies `/api` and `/health` to the backend)

```bash
bash start.sh
```

## Environment secrets

| Secret | Purpose |
|---|---|
| `SUPABASE_DB_URL` | PostgreSQL connection string (direct or pooler URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server-side operations) |
| `VITE_SUPABASE_URL` | Supabase project URL (frontend) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (frontend) |
| `META_ACCESS_TOKEN` | Meta/WhatsApp Business API token |
| `META_PHONE_NUMBER_ID` | WhatsApp phone number ID |
| `META_API_VERSION` | Meta API version (e.g. `v22.0`) |
| `SESSION_SECRET` | Express session secret |

## User preferences

- Keep existing project structure and stack — no migrations or restructuring without explicit request.
