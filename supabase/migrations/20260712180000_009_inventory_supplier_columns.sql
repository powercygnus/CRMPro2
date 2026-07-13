/*
# Inventory Items — Supplier Columns

## Summary
Adds three columns to `inventory_items` that exist in the frontend
InventoryItem type but were missing from the database, causing every
inventory upsert to fail silently (item appeared locally but was never
persisted, so it vanished on page refresh).

## Changes
- `supplier_id`              text NOT NULL DEFAULT ''   — FK-style reference to suppliers table
- `supplier_warranty_months` integer NOT NULL DEFAULT 0 — warranty period offered by this supplier
- `purchase_date`            text (nullable)            — date item was last purchased / received
*/

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS supplier_id              text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS supplier_warranty_months integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_date            text;
