/*
# Delivery WhatsApp Notifications

## Summary
Enables automated WhatsApp notifications tied to delivery status changes
(driver starts trip, driver is near the destination, driver completes the
delivery). Reuses the existing `whatsapp_logs` outbox table used by the
repair workflow, extending it to also support sale/delivery-triggered
messages that are not tied to a repair ticket.

## Changes to existing tables
- `whatsapp_logs`
  - `repair_id` is now nullable (previously NOT NULL) — delivery-triggered
    messages have no repair ticket to reference.
  - `sale_id` (text, nullable, FK -> sales.id) - the sale a delivery
    notification belongs to, mirroring how `repair_id` works for repairs.
  - `template_name` check constraint widened to include the three new
    delivery templates: `crm_delivery_started`, `crm_delivery_near`,
    `crm_delivery_completed`.

## Notes
1. These three new template names must be created and approved in Meta
   Business Manager (WhatsApp Manager) before live sending will work,
   exactly like the existing `crm_received` / `crm_ready_for_pickup` /
   `crm_cancelled` templates. Until then, messages are safely logged as
   'queued' in dev/mock mode (mirrors existing repair-notification
   behavior when WhatsApp is not enabled or not configured).
2. `sale_id` follows the same TEXT id convention as the rest of this
   project (see migration 007 notes).
*/

-- repair_id is no longer required for every log row
ALTER TABLE whatsapp_logs ALTER COLUMN repair_id DROP NOT NULL;

-- Add sale_id reference for delivery-triggered notifications
ALTER TABLE whatsapp_logs ADD COLUMN IF NOT EXISTS sale_id text REFERENCES sales(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_sale_id ON whatsapp_logs(sale_id);

-- Widen the template_name check constraint to include delivery templates
ALTER TABLE whatsapp_logs DROP CONSTRAINT IF EXISTS whatsapp_logs_template_name_check;
ALTER TABLE whatsapp_logs ADD CONSTRAINT whatsapp_logs_template_name_check
  CHECK (template_name IN (
    'order_received', 'order_finished', 'order_cancelled',
    'crm_received', 'crm_ready_for_pickup', 'crm_cancelled', 'crm_restock_order',
    'crm_delivery_started', 'crm_delivery_near', 'crm_delivery_completed'
  ));
