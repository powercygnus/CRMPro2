import type { UserRole } from '../types';
import type { PageKey } from '../components/Layout';

// ============================================================
// Centralized Role-Based Access Control
// ------------------------------------------------------------
// Single source of truth for "which pages can a given role see".
// Used by Layout (sidebar nav filtering), ProtectedRoute (route
// guarding + redirect), and App (initial/landing page selection).
// ============================================================

export const ALL_PAGES: PageKey[] = [
  'dashboard',
  'repairs',
  'customers',
  'devices',
  'invoices',
  'sales',
  'warranty',
  'inventory',
  'suppliers',
  'delivery',
  'whatsapp',
  'rules',
  'notifications',
  'users',
  'logs',
  'activity',
  'settings',
];

// Pages each non-admin role is allowed to view.
// Admin always has access to every page (handled separately below).
const ROLE_PAGES: Record<UserRole, PageKey[]> = {
  admin: ALL_PAGES,
  // Technicians handle the repair workflow end-to-end.
  technician: ['dashboard', 'repairs', 'customers', 'devices', 'warranty', 'whatsapp', 'notifications'],
  // Sales accounts manage sales + inventory, and assign/monitor deliveries
  // for the orders they create.
  sales: ['sales', 'inventory', 'delivery'],
  // Delivery drivers see ONLY their delivery trip list — fully blocked
  // from financial/sales data, dashboards, and repair tickets.
  delivery: ['delivery'],
};

function normalizeRole(role: string): UserRole {
  const r = role.toLowerCase();
  if (r === 'admin' || r === 'technician' || r === 'sales' || r === 'delivery') return r;
  return 'technician';
}

export function getAllowedPages(role: string): PageKey[] {
  return ROLE_PAGES[normalizeRole(role)];
}

export function canAccessPage(role: string, page: PageKey): boolean {
  return getAllowedPages(role).includes(page);
}

/** The page a role should land on right after login / when their current page becomes disallowed. */
export function getDefaultPage(role: string): PageKey {
  const allowed = getAllowedPages(role);
  if (allowed.includes('dashboard')) return 'dashboard';
  return allowed[0] ?? 'dashboard';
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  technician: 'Technician',
  sales: 'Sales',
  delivery: 'Delivery',
};
