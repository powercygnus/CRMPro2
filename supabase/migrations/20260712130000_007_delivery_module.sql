/*
# Delivery Management Module

## Summary
Adds delivery tracking on top of the existing sales module: a new
`deliveries` table linking a sale to an assigned driver and its
fulfillment status, plus delivery-address fields on `sales`. Also widens
the `users.role` check constraint to support the two new roles (sales,
delivery) introduced alongside this module.

## Changes to existing tables
- `sales`
  - `delivery_address` (text) - free-text delivery address entered at sale time
  - `delivery_lat` (double precision, nullable) - optional latitude
  - `delivery_lng` (double precision, nullable) - optional longitude
  - `delivery_maps_url` (text) - optional pasted Google Maps share link
- `users`
  - `role` check constraint widened from ('admin','technician') to also
    allow ('sales','delivery')

## New Tables
- `deliveries`
  - `id` (text, primary key) - Unique delivery identifier (app-generated, matches
    the id style already used by every other table in this project)
  - `sale_id` (text, FK -> sales.id) - The sale being delivered
  - `delivery_driver_id` (text, FK -> users.id, nullable) - Assigned driver
  - `status` (text, not null, default 'pending') - pending | out_for_delivery | near_destination | delivered
  - `assigned_at` (timestamptz, nullable) - When a driver was assigned
  - `completed_at` (timestamptz, nullable) - When marked delivered
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

## Security
- RLS enabled on `deliveries` table
- Anon + authenticated CRUD policies (single-tenant app, no user-scoped auth),
  consistent with every other table in this project.

## Notes
1. Role-based access to the Delivery page/tab is enforced entirely in the
   frontend (src/utils/rbac.ts); this migration only adds storage.
2. `users.id` and `sales.id` are TEXT (app-generated ids like "usr_admin",
   "sale_xxx"), not uuid — `deliveries.id` and its FKs follow the same
   convention for consistency.
*/

-- Add delivery fields to sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_address text DEFAULT '';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_lat double precision;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_lng double precision;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_maps_url text DEFAULT '';

-- Widen the users.role check constraint to allow the new sales/delivery roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'technician', 'sales', 'delivery'));

-- Create deliveries table
CREATE TABLE IF NOT EXISTS deliveries (
  id text PRIMARY KEY,
  sale_id text NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  delivery_driver_id text REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  assigned_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_deliveries" ON deliveries;
CREATE POLICY "anon_select_deliveries" ON deliveries FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_deliveries" ON deliveries;
CREATE POLICY "anon_insert_deliveries" ON deliveries FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_deliveries" ON deliveries;
CREATE POLICY "anon_update_deliveries" ON deliveries FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_deliveries" ON deliveries;
CREATE POLICY "anon_delete_deliveries" ON deliveries FOR DELETE
  TO anon, authenticated USING (true);

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS idx_deliveries_sale_id ON deliveries(sale_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_id ON deliveries(delivery_driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
