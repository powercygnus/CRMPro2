// ============================================================
// Core Data Model Interfaces — mirrors the MySQL schema spec
// ============================================================

export type UserRole = 'admin' | 'technician' | 'sales' | 'delivery';

export interface User {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  last_login: string | null;   // ISO timestamp
  last_seen: string | null;    // ISO timestamp — heartbeat
  // is_active is derived: true when last_seen is within 45 seconds of now
  is_active: boolean;
  created_at: string;
  // Profile customisation (migration 011)
  nickname?: string | null;    // display name — falls back to username when null
  avatar_url?: string | null;  // base64 data URL or external image URL
}

export type RepairStatus =
  | 'Pending'
  | 'In Progress'
  | 'Awaiting Parts'
  | 'Ready'
  | 'Ready For Pickup'
  | 'Completed'
  | 'Cancelled'
  | 'Canceled';

export interface RepairRecord {
  id: string;
  repair_id: string;          // human-readable unique ID e.g. "REP-0001"
  customer_name: string;
  mof: string;                // mode of failure / fault category
  phone: string;
  phone_norm: string;         // digits-only normalized
  address: string;
  email: string;
  website: string;
  date_in: string;            // ISO date
  date_out: string | null;    // ISO date
  brand: string;
  model: string;
  serial: string;
  condition: string;
  problem: string;
  device_notes: string;
  status: RepairStatus;
  technician: string;
  technician_notes: string;
  warranty: number;           // months
  price: number;
  notes: string;
  created_at: string;
  updated_at: string;
  // Corporate client fields (B2B)
  is_corporate: boolean;
  corporate_mof: string;       // Ministry of Finance number
  corporate_address: string;   // Business address
  corporate_email: string;     // Business email
  corporate_website: string;   // Business website
}

export interface UserActivity {
  id: string;
  username: string;
  timestamp: string;          // ISO timestamp
  activity: string;           // human-readable description
}

export type LogAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';

export interface RecordLog {
  id: string;
  repair_id: string;
  username: string;
  timestamp: string;
  action: LogAction;
  details: string;            // e.g. "Status: 'Pending' → 'Ready'"
}

export type NotificationChannel = 'whatsapp' | 'email' | 'telegram';
export type NotificationStatus = 'queued' | 'sent' | 'failed';

export interface NotificationOutbox {
  id: string;
  channel: NotificationChannel;
  recipient: string;
  customer_id: string;        // repair_id reference
  title: string;
  body: string;
  created_by: string;
  created_at: string;
  status: NotificationStatus;
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
}

export interface AutoNotifyRule {
  id: string;
  enabled: boolean;
  trigger_event: string;     // e.g. "status_change"
  from_status: string;       // e.g. "In Progress"
  to_status: string;         // e.g. "Ready"
  template_key: string;      // e.g. "device_ready_whatsapp"
  created_at: string;
}

// ============================================================
// Inventory & Stock
// ============================================================

export type InventoryCategory =
  | 'Screens & Displays'
  | 'Batteries'
  | 'Keyboards & Input'
  | 'Storage'
  | 'Memory'
  | 'Charging & Power'
  | 'Cooling & Fans'
  | 'Motherboards'
  | 'Cables & Connectors'
  | 'Tools & Consumables'
  | 'Other';

export const INVENTORY_CATEGORIES: InventoryCategory[] = [
  'Screens & Displays',
  'Batteries',
  'Keyboards & Input',
  'Storage',
  'Memory',
  'Charging & Power',
  'Cooling & Fans',
  'Motherboards',
  'Cables & Connectors',
  'Tools & Consumables',
  'Other',
];

export type InventoryTransactionType = 'receive' | 'use' | 'adjust' | 'return';

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: InventoryCategory;
  description: string;
  quantity: number;
  min_quantity: number;       // low-stock threshold
  unit_price: number;
  supplier: string;
  supplier_id: string;        // FK to suppliers table
  supplier_warranty_months: number;
  purchase_date: string | null;
  location: string;           // shelf/bin e.g. "A-01"
  created_at: string;
  updated_at: string;
}

export interface InventoryTransaction {
  id: string;
  item_id: string;
  item_sku: string;
  item_name: string;
  type: InventoryTransactionType;
  quantity: number;           // always positive; direction is determined by `type`
  quantity_before: number;
  quantity_after: number;
  repair_id: string | null;   // linked repair (relevant when type = 'use')
  sale_id: string | null;     // linked sale  (relevant when type = 'use')
  notes: string;
  created_by: string;
  created_at: string;
}

// ============================================================
// Sales
// ============================================================

export type SaleStatus = 'completed' | 'refunded' | 'voided';
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';
export type SaleWarrantyStatus = 'active' | 'expiring_soon' | 'expired' | 'claimed' | 'voided';

export interface SaleItem {
  id: string;
  sale_id: string;
  inventory_item_id: string;
  item_sku: string;           // snapshot at sale time
  item_name: string;          // snapshot
  quantity: number;
  unit_price: number;         // snapshot
  subtotal: number;
  warranty_months: number;    // copied from inventory_items.supplier_warranty_months
}

export interface Sale {
  id: string;
  sale_id: string;            // human-readable: SAL-2026-001
  customer_name: string;
  phone: string;
  phone_norm: string;         // digits-only — customer join key (same as repairs)
  email: string;
  sale_date: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment_method: PaymentMethod;
  notes: string;
  status: SaleStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Delivery
  delivery_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_maps_url: string;
}

// ============================================================
// Delivery Management
// ============================================================

export type DeliveryStatus = 'pending' | 'out_for_delivery' | 'near_destination' | 'delivered';

export const DELIVERY_STATUSES: DeliveryStatus[] = [
  'pending',
  'out_for_delivery',
  'near_destination',
  'delivered',
];

export interface Delivery {
  id: string;
  sale_id: string;                    // FK -> sales.id
  delivery_driver_id: string | null;  // FK -> users.id
  status: DeliveryStatus;
  assigned_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaleWarranty {
  id: string;
  warranty_id: string;        // human-readable: WSAL-2026-001
  sale_id: string;
  sale_item_id: string;
  customer_name: string;
  phone: string;
  phone_norm: string;
  item_name: string;
  item_sku: string;
  warranty_months: number;
  sale_date: string;
  expiry_date: string;        // stored — sale_date + warranty_months
  status: SaleWarrantyStatus;
  created_at: string;
}

// ============================================================
// System Configuration (from settings.json)
// ============================================================

export interface WhatsAppTemplateDef {
  key: string;
  label: string;
  lang: string;
  body: string;
}

export interface WhatsAppSettings {
  enabled: boolean;
  api_version: string;
  phone_number_id: string;
  access_token: string;
}

export interface EmailSettings {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  pass: string;
  from_name: string;
}

export interface TelegramSettings {
  enabled: boolean;
  bot_token: string;
  chat_id: string;
}

export interface FlowStatuses {
  finish_statuses: string[];
  cancel_statuses: string[];
}

export interface DatabaseSettings {
  mode: 'cloud' | 'local';
  // Cloud (Supabase)
  supabase_url: string;
  supabase_anon_key: string;
  supabase_db_url: string;
  supabase_service_role_key: string;
  // Local
  local_host: string;
  local_port: number;
  local_database: string;
  local_username: string;
  local_password: string;
}

export interface SystemConfig {
  company_name: string;
  address: string;
  phone: string;
  mof: string;
  logo_path: string;
  theme: string;
  auto_id_prefix: string;
  whatsapp: WhatsAppSettings;
  email: EmailSettings;
  telegram: TelegramSettings;
  flow_statuses: FlowStatuses;
  whatsapp_templates: WhatsAppTemplateDef[];
  database: DatabaseSettings;
}

// ============================================================
// WhatsApp Integration Types
// ============================================================

export type WhatsAppTemplateName = 'crm_received' | 'crm_ready_for_pickup' | 'crm_cancelled' | 'order_received' | 'order_finished' | 'order_cancelled';
export type WhatsAppLogStatus = 'queued' | 'sent' | 'failed';

export interface WhatsAppConfigRecord {
  id: number;
  phone_number_id: string;
  access_token: string;
  api_version: string;
  template_language: string;
  enabled: boolean;
  finish_statuses: string[];
  cancel_statuses: string[];
  created_at: string;
  updated_at: string;
}

export interface WhatsAppLogRecord {
  id: string;
  repair_id: string;
  customer_name: string;
  phone: string;
  template_name: WhatsAppTemplateName;
  variables: string[];
  status: WhatsAppLogStatus;
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
}

// ============================================================
// Aggregate state shape persisted to localStorage / Supabase
// ============================================================

export interface AppState {
  config: SystemConfig;
  users: User[];
  repairs: RepairRecord[];
  activities: UserActivity[];
  logs: RecordLog[];
  notifications: NotificationOutbox[];
  autoNotifyRules: AutoNotifyRule[];
  inventory: InventoryItem[];
  inventoryTransactions: InventoryTransaction[];
  suppliers: Supplier[];
  sales: Sale[];
  saleItems: SaleItem[];
  saleWarranties: SaleWarranty[];
  deliveries: Delivery[];
  currentUserId: string | null;   // logged-in user (client-side only)
}
