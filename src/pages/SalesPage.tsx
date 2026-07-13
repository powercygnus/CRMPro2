import { useState, useMemo, useRef, useEffect } from 'react';
import {
  ShoppingBag,
  Plus,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  ShieldCheck,
  Package,
  Tag,
  Receipt,
  TrendingUp,
  DollarSign,
  BarChart2,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  User,
  Phone,
  Mail,
  StickyNote,
  AlertCircle,
  CheckCircle2,
  Printer,
  Pencil,
  Ban,
  AlertTriangle,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { showToast } from '../components/Toast';
import { formatDate } from '../utils/helpers';
import { DocumentPreviewModal, type PreviewType } from '../components/DocumentPreviewModal';
import type { Sale, SaleStatus, PaymentMethod } from '../types';

// ─── local draft types ─────────────────────────────────────────────────────

interface LineItemDraft {
  draftId: string;
  inventoryItemId: string;
  quantity: number;
  unitPrice: number;
}

interface NewSaleForm {
  customerName: string;
  phone: string;
  email: string;
  lineItems: LineItemDraft[];
  discount: number;
  tax: number;
  paymentMethod: PaymentMethod;
  notes: string;
  deliveryAddress: string;
  deliveryMapsUrl: string;
}

const EMPTY_FORM: NewSaleForm = {
  customerName: '',
  phone: '+961 ',
  email: '',
  lineItems: [{ draftId: 'di_0', inventoryItemId: '', quantity: 1, unitPrice: 0 }],
  discount: 0,
  tax: 0,
  paymentMethod: 'cash',
  notes: '',
  deliveryAddress: '',
  deliveryMapsUrl: '',
};

// ─── helpers ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<SaleStatus, string> = {
  completed: 'Completed',
  refunded: 'Refunded',
  voided: 'Voided',
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  transfer: 'Transfer',
  other: 'Other',
};

const PAYMENT_ICONS: Record<PaymentMethod, JSX.Element> = {
  cash: <Banknote className="h-3.5 w-3.5" />,
  card: <CreditCard className="h-3.5 w-3.5" />,
  transfer: <ArrowRightLeft className="h-3.5 w-3.5" />,
  other: <DollarSign className="h-3.5 w-3.5" />,
};

function statusBadge(status: SaleStatus) {
  if (status === 'completed')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Completed
      </span>
    );
  if (status === 'refunded')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
        <ArrowRightLeft className="h-3 w-3" />
        Refunded
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-slate-800/60 dark:text-slate-400">
      <X className="h-3 w-3" />
      Voided
    </span>
  );
}

let _draftCounter = 1;
function newDraftId() {
  return `di_${_draftCounter++}`;
}

// ─── Print helpers ──────────────────────────────────────────────────────────

function printSaleA4(sale: Sale, items: ReturnType<typeof Array.prototype.filter>) {
  const itemRows = items
    .map(
      (si: any) => `
      <tr>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;vertical-align:top">
          <strong>${si.item_name}</strong><br/>
          <span style="font-family:monospace;font-size:10px;color:#888">${si.item_sku}</span>
          ${si.warranty_months > 0 ? `<br/><span style="font-size:10px;color:#059669">★ ${si.warranty_months}mo warranty</span>` : ''}
        </td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">${si.quantity}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">$${si.unit_price.toFixed(2)}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:700">$${si.subtotal.toFixed(2)}</td>
      </tr>`,
    )
    .join('');

  const discountRow =
    sale.discount > 0
      ? `<tr><td colspan="3" style="text-align:right;padding:4px 6px;color:#059669">Discount</td><td style="text-align:right;padding:4px 6px;color:#059669">−$${sale.discount.toFixed(2)}</td></tr>`
      : '';
  const taxRow =
    sale.tax > 0
      ? `<tr><td colspan="3" style="text-align:right;padding:4px 6px;color:#555">Tax</td><td style="text-align:right;padding:4px 6px;color:#555">+$${sale.tax.toFixed(2)}</td></tr>`
      : '';

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Invoice ${sale.sale_id}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:40px}
  @media print{body{padding:20px}@page{size:A4;margin:15mm}}
</style>
</head><body>
<table style="width:100%;border-bottom:2px solid #111;padding-bottom:20px;margin-bottom:24px">
  <tr>
    <td>
      <div style="font-size:22px;font-weight:900;letter-spacing:-0.02em">CyGnuS SARL</div>
      <div style="color:#666;font-size:10px;margin-top:3px">CRM Pro Repair Solutions · Al Metn, Lebanon</div>
      <div style="color:#888;font-size:10px">operations@cygnus.com</div>
    </td>
    <td style="text-align:right">
      <div style="display:inline-block;border:1px solid #ddd;padding:3px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">SALES INVOICE</div>
      <div style="font-size:18px;font-weight:900;font-family:monospace">${sale.sale_id}</div>
      <div style="color:#666;font-size:10px;margin-top:4px">Date: ${new Date(sale.sale_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      <div style="margin-top:6px;display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;
        ${sale.status === 'completed' ? 'background:#d1fae5;color:#065f46' : sale.status === 'refunded' ? 'background:#fef3c7;color:#92400e' : 'background:#f3f4f6;color:#4b5563'}">
        ${STATUS_LABELS[sale.status]}
      </div>
    </td>
  </tr>
</table>
<table style="width:100%;margin-bottom:24px">
  <tr>
    <td style="width:50%;vertical-align:top">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin-bottom:5px">Billed To</div>
      <div style="font-size:13px;font-weight:700">${sale.customer_name}</div>
      ${sale.phone ? `<div style="color:#555;margin-top:2px">${sale.phone}</div>` : ''}
      ${sale.email ? `<div style="color:#555">${sale.email}</div>` : ''}
    </td>
    <td style="width:50%;vertical-align:top;text-align:right">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin-bottom:5px">Payment</div>
      <div style="font-size:12px;font-weight:700;text-transform:capitalize">${sale.payment_method}</div>
      ${sale.notes ? `<div style="color:#555;font-style:italic;margin-top:4px">${sale.notes}</div>` : ''}
    </td>
  </tr>
</table>
<table style="width:100%;border-collapse:collapse">
  <thead>
    <tr style="background:#f9fafb;border-bottom:2px solid #111">
      <th style="text-align:left;padding:8px 6px;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#666">Item</th>
      <th style="text-align:right;padding:8px 6px;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#666">Qty</th>
      <th style="text-align:right;padding:8px 6px;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#666">Unit Price</th>
      <th style="text-align:right;padding:8px 6px;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#666">Subtotal</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
  <tfoot>
    ${discountRow}${taxRow}
    <tr>
      <td colspan="3" style="text-align:right;padding:10px 6px;font-weight:700;font-size:13px;border-top:2px solid #111">TOTAL DUE</td>
      <td style="text-align:right;padding:10px 6px;font-weight:900;font-size:15px;border-top:2px solid #111;color:#4f46e5">$${sale.total.toFixed(2)}</td>
    </tr>
  </tfoot>
</table>
<div style="margin-top:60px;padding-top:20px;border-top:1px solid #eee;text-align:center;font-size:9px;color:#aaa">
  Thank you for your business — CyGnuS SARL — All sales are final unless otherwise specified.
</div>
</body></html>`;

  const w = window.open('', '_blank', 'width=850,height=1100');
  if (!w) { showToast('error', 'Allow popups to print invoices'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 600);
}

function printThermalReceipt(sale: Sale, _items: ReturnType<typeof Array.prototype.filter>) {
  // Opens the DocumentPreviewModal-based thermal receipt via a custom event
  // The actual rendering is handled by StandardSalesReceiptDocument in DocumentPreviewModal
  const event = new CustomEvent('open-sale-receipt', { detail: { saleId: sale.id } });
  window.dispatchEvent(event);
}

// ─── ItemCombobox ────────────────────────────────────────────────────────────

interface InventoryOption {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  supplier_warranty_months: number;
}

function ItemCombobox({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (id: string) => void;
  options: InventoryOption[];
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const selected = options.find((o) => o.id === value);
  const filtered = query
    ? options.filter(
        (o) =>
          o.name.toLowerCase().includes(query.toLowerCase()) ||
          o.sku.toLowerCase().includes(query.toLowerCase()),
      )
    : options;

  const displayValue = open ? query : selected ? selected.name : '';

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 dark:text-slate-500 pointer-events-none" />
        <input
          value={displayValue}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); setQuery(''); }}
          placeholder="Search item by name or SKU…"
          className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0b0f19] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
        />
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#0b0f19] border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl max-h-56 overflow-y-auto ring-1 ring-black/5">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-xs text-gray-400 dark:text-slate-500 text-center">No items match</p>
          ) : (
            filtered.map((inv) => (
              <button
                key={inv.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(inv.id); setOpen(false); setQuery(''); }}
                className={`w-full px-3 py-2.5 text-left hover:bg-brand-50 dark:hover:bg-brand-900/20 text-xs flex items-center justify-between gap-3 transition-colors border-b border-slate-100 dark:border-slate-800/50 last:border-0 ${value === inv.id ? 'bg-brand-50/60 dark:bg-brand-900/10' : ''}`}
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-slate-100 truncate">{inv.name}</p>
                  <p className="text-gray-400 dark:text-slate-500 font-mono mt-0.5 truncate">{inv.sku}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-gray-700 dark:text-slate-300 tabular-nums">${inv.unit_price.toFixed(2)}</p>
                  <p className={`text-[10px] mt-0.5 font-medium ${inv.quantity > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                    {inv.quantity} in stock
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── main component ─────────────────────────────────────────────────────────

export function SalesPage() {
  const { state, service } = useStore();

  // list state
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | SaleStatus>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  // modal / drawer state
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // inline edit state (inside detail drawer)
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ notes: '', status: 'completed' as SaleStatus });

  // void/refund confirmation state
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidAction, setVoidAction] = useState<'voided' | 'refunded'>('voided');

  // document preview state
  const [previewType, setPreviewType] = useState<PreviewType | null>(null);

  // new sale form state
  const [form, setForm] = useState<NewSaleForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  // ─── computed ──────────────────────────────────────────────────────────────

  const sales = state.sales ?? [];
  const saleItems = state.saleItems ?? [];
  const saleWarranties = state.saleWarranties ?? [];

  const metrics = useMemo(() => {
    const completed = sales.filter((s) => s.status === 'completed');
    const revenue = completed.reduce((sum, s) => sum + s.total, 0);
    const avgOrder = completed.length ? revenue / completed.length : 0;
    const totalItems = saleItems
      .filter((si) => completed.some((s) => s.id === si.sale_id))
      .reduce((sum, si) => sum + si.quantity, 0);
    return { count: completed.length, revenue, avgOrder, totalItems };
  }, [sales, saleItems]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let rows = sales;
    if (statusFilter !== 'All') rows = rows.filter((s) => s.status === statusFilter);
    if (q) {
      rows = rows.filter(
        (s) =>
          s.sale_id.toLowerCase().includes(q) ||
          s.customer_name.toLowerCase().includes(q) ||
          s.phone.includes(q) ||
          s.email.toLowerCase().includes(q),
      );
    }
    return [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [sales, statusFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // stock-aware inventory items for the combobox
  const stockedItems = useMemo(
    () => state.inventory.filter((i) => i.quantity > 0).sort((a, b) => a.name.localeCompare(b.name)),
    [state.inventory],
  );

  // items + warranties for the open detail drawer
  const drawerItems = useMemo(
    () => (selectedSale ? saleItems.filter((si) => si.sale_id === selectedSale.id) : []),
    [selectedSale, saleItems],
  );
  const drawerWarranties = useMemo(
    () => (selectedSale ? saleWarranties.filter((sw) => sw.sale_id === selectedSale.id) : []),
    [selectedSale, saleWarranties],
  );

  // Keep selectedSale in sync with state updates
  useEffect(() => {
    if (selectedSale) {
      const updated = sales.find((s) => s.id === selectedSale.id);
      if (updated) setSelectedSale(updated);
    }
  }, [sales]);

  // ─── form helpers ──────────────────────────────────────────────────────────

  function openModal() {
    setForm(EMPTY_FORM);
    setFormErrors([]);
    setIsNewSaleOpen(true);
  }

  function closeModal() {
    setIsNewSaleOpen(false);
    setFormErrors([]);
  }

  function updateLineItem(draftId: string, patch: Partial<LineItemDraft>) {
    setForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((li) => (li.draftId === draftId ? { ...li, ...patch } : li)),
    }));
  }

  function addLineItem() {
    setForm((prev) => ({
      ...prev,
      lineItems: [...prev.lineItems, { draftId: newDraftId(), inventoryItemId: '', quantity: 1, unitPrice: 0 }],
    }));
  }

  function removeLineItem(draftId: string) {
    setForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((li) => li.draftId !== draftId),
    }));
  }

  function handleItemSelect(draftId: string, inventoryItemId: string) {
    const inv = state.inventory.find((i) => i.id === inventoryItemId);
    updateLineItem(draftId, { inventoryItemId, unitPrice: inv?.unit_price ?? 0 });
  }

  const formSubtotal = form.lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const formTotal = Math.max(0, formSubtotal - form.discount + form.tax);

  function validate(): string[] {
    const errs: string[] = [];
    if (!form.customerName.trim()) errs.push('Customer name is required.');
    if (form.lineItems.length === 0) errs.push('Add at least one item.');
    for (const li of form.lineItems) {
      if (!li.inventoryItemId) { errs.push('Select an item for every row.'); break; }
      if (li.quantity < 1) { errs.push('Quantity must be at least 1 for all items.'); break; }
    }
    const qtyByItem: Record<string, number> = {};
    for (const li of form.lineItems) {
      if (!li.inventoryItemId) continue;
      qtyByItem[li.inventoryItemId] = (qtyByItem[li.inventoryItemId] || 0) + li.quantity;
    }
    for (const [itemId, requestedQty] of Object.entries(qtyByItem)) {
      const inv = state.inventory.find((i) => i.id === itemId);
      if (inv && requestedQty > inv.quantity) {
        errs.push(`"${inv.name}" — requested ${requestedQty} but only ${inv.quantity} in stock.`);
      }
    }
    return errs;
  }

  function handleSubmit() {
    const errs = validate();
    if (errs.length) { setFormErrors(errs); return; }
    setSubmitting(true);
    try {
      service.addSale({
        customer_name: form.customerName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        items: form.lineItems.map((li) => ({
          inventoryItemId: li.inventoryItemId,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
        })),
        discount: form.discount,
        tax: form.tax,
        payment_method: form.paymentMethod,
        notes: form.notes.trim(),
        delivery_address: form.deliveryAddress.trim(),
        delivery_maps_url: form.deliveryMapsUrl.trim(),
      });
      showToast('success', 'Sale recorded successfully.');
      closeModal();
      // Open the receipt preview for the newly created sale
      const newSale = service['state']?.sales?.slice?.().reverse().find((s) => s.customer_name === form.customerName.trim());
      if (newSale) {
        setPreviewType('sale-receipt');
        setSelectedSale(newSale);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to save sale.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── drawer helpers ────────────────────────────────────────────────────────

  function openDrawer(sale: Sale) {
    setSelectedSale(sale);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setIsEditing(false);
    setVoidOpen(false);
    setTimeout(() => setSelectedSale(null), 300);
  }

  function openInlineEdit() {
    if (!selectedSale) return;
    setEditForm({ notes: selectedSale.notes || '', status: selectedSale.status });
    setIsEditing(true);
    setVoidOpen(false);
  }

  function handleEditSave() {
    if (!selectedSale) return;
    service.updateSale(selectedSale.id, { notes: editForm.notes, status: editForm.status });
    showToast('success', 'Sale updated.');
    setIsEditing(false);
  }

  function openVoidConfirm(action: 'voided' | 'refunded') {
    setVoidAction(action);
    setVoidOpen(true);
    setIsEditing(false);
  }

  function handleVoidConfirm() {
    if (!selectedSale) return;
    service.voidOrRefundSale(selectedSale.id, voidAction === 'voided' ? 'void' : 'refund');
    showToast('success', voidAction === 'voided' ? 'Sale voided.' : 'Sale marked as refunded.');
    setVoidOpen(false);
  }

  // ─── receipt preview event listener ───────────────────────────────────────
  useEffect(() => {
    function handleOpenReceipt(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.saleId) {
        const sale = state.sales.find((s) => s.id === detail.saleId);
        if (sale) {
          setSelectedSale(sale);
          setPreviewType('sale-receipt');
        }
      }
    }
    window.addEventListener('open-sale-receipt', handleOpenReceipt);
    return () => window.removeEventListener('open-sale-receipt', handleOpenReceipt);
  }, [state.sales]);

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── main panel ── */}
      <div
        className={`flex flex-col flex-1 min-w-0 overflow-hidden transition-all duration-300 ${drawerOpen ? 'mr-[440px]' : ''}`}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-brand-50 dark:bg-brand-950/20 p-2 rounded-xl">
              <ShoppingBag className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Sales</h1>
              <p className="text-xs text-gray-500 dark:text-slate-400">Direct product sales &amp; warranty tracking</p>
            </div>
          </div>
          <button
            onClick={openModal}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors shrink-0"
          >
            <Plus className="h-4 w-4" />
            New Sale
          </button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-6 py-4 shrink-0">
          {[
            { icon: <Receipt className="h-4 w-4 text-brand-500" />, label: 'Total Sales', value: String(metrics.count) },
            {
              icon: <DollarSign className="h-4 w-4 text-emerald-500" />,
              label: 'Revenue',
              value: `$${metrics.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            },
            {
              icon: <TrendingUp className="h-4 w-4 text-blue-500" />,
              label: 'Avg. Order',
              value: `$${metrics.avgOrder.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            },
            { icon: <BarChart2 className="h-4 w-4 text-amber-500" />, label: 'Items Sold', value: String(metrics.totalItems) },
          ].map(({ icon, label, value }) => (
            <div key={label} className="bg-white dark:bg-[#111827] border border-gray-100 dark:border-slate-800 rounded-xl p-4 flex items-center gap-3 shadow-sm">
              <div className="bg-gray-50 dark:bg-slate-800 p-2 rounded-lg">{icon}</div>
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="px-6 pb-3 flex items-center gap-3 flex-wrap shrink-0">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by ID, customer, phone…"
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-[#111827] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
            />
          </div>
          <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1 gap-0.5">
            {(['All', 'completed', 'refunded', 'voided'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setStatusFilter(tab); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === tab
                    ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                }`}
              >
                {tab === 'All' ? 'All' : STATUS_LABELS[tab]}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 pb-4">
          <div className="bg-white dark:bg-[#111827] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-[#0b0f19]">
                  {['Sale ID', 'Date', 'Customer', 'Phone', 'Items', 'Total', 'Payment', 'Status', ''].map((col) => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <ShoppingBag className="h-10 w-10 text-gray-200 dark:text-slate-700 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-400 dark:text-slate-500">No sales found</p>
                      <p className="text-xs text-gray-300 dark:text-slate-600 mt-1">
                        {sales.length === 0 ? 'Click "New Sale" to record your first sale.' : 'Try adjusting your search or filters.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginated.map((sale) => {
                    const itemCount = saleItems.filter((si) => si.sale_id === sale.id).length;
                    return (
                      <tr
                        key={sale.id}
                        onClick={() => openDrawer(sale)}
                        className={`border-b border-gray-100 dark:border-slate-800/50 hover:bg-brand-50/50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors ${selectedSale?.id === sale.id ? 'bg-brand-50/40 dark:bg-brand-900/10' : ''}`}
                      >
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-700 dark:text-brand-400">{sale.sale_id}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">{formatDate(sale.sale_date)}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-[160px] truncate">{sale.customer_name}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">{sale.phone || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-300">{itemCount} item{itemCount !== 1 ? 's' : ''}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                          ${sale.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
                            {PAYMENT_ICONS[sale.payment_method]}
                            {PAYMENT_LABELS[sale.payment_method]}
                          </span>
                        </td>
                        <td className="px-4 py-3">{statusBadge(sale.status)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); openDrawer(sale); }}
                            className="text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <p className="text-gray-500 dark:text-slate-400">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-medium text-gray-700 dark:text-slate-300">{currentPage} / {totalPages}</span>
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Drawer ── */}
      <div
        className={`fixed top-0 right-0 h-full w-[440px] bg-white dark:bg-[#0f1623] border-l border-gray-100 dark:border-slate-800 shadow-2xl z-40 flex flex-col transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {selectedSale && (
          <>
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-800 shrink-0">
              <div>
                <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">Sale</p>
                <p className="text-lg font-bold font-mono text-brand-700 dark:text-brand-400">{selectedSale.sale_id}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {statusBadge(selectedSale.status)}
                <button
                  onClick={closeDrawer}
                  className="ml-1 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Drawer action buttons — streamlined */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-slate-800 shrink-0 bg-gray-50 dark:bg-[#0b0f19]">
              <button
                onClick={() => printSaleA4(selectedSale, drawerItems)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-900/30 hover:bg-brand-100 dark:hover:bg-brand-900/30 rounded-lg transition-colors"
              >
                <Printer className="h-3.5 w-3.5" /> Invoice
              </button>
              <button
                onClick={() => printThermalReceipt(selectedSale, drawerItems)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <Printer className="h-3.5 w-3.5" /> Receipt
              </button>
              {selectedSale.status === 'completed' && !isEditing && !voidOpen && (
                <button
                  onClick={openInlineEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-colors ml-auto"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              )}
            </div>

            {/* Inline edit panel (inside drawer body) */}
            {isEditing && (
              <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 bg-blue-50/50 dark:bg-blue-950/10 shrink-0">
                <h4 className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Pencil className="h-3.5 w-3.5" /> Edit Sale
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Status</label>
                    <div className="flex gap-2">
                      {(['completed', 'refunded', 'voided'] as SaleStatus[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setEditForm((f) => ({ ...f, status: s }))}
                          className={`flex-1 px-2 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                            editForm.status === s
                              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400'
                              : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-600'
                          }`}
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Notes</label>
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      placeholder="Optional notes…"
                      className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#111827] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex-1 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEditSave}
                      className="flex-1 px-3 py-1.5 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Void/Refund confirmation panel */}
            {voidOpen && (
              <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 bg-red-50/50 dark:bg-red-950/10 shrink-0">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-red-700 dark:text-red-400 mb-1">
                      {voidAction === 'voided' ? 'Void this sale?' : 'Mark as Refunded?'}
                    </p>
                    <p className="text-xs text-red-600/70 dark:text-red-400/60 mb-3">
                      {voidAction === 'voided'
                        ? 'The sale status will be set to Voided. Warranty records will remain but be flagged. This cannot be undone.'
                        : 'The sale status will be updated to Refunded. This indicates the customer received a refund.'}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setVoidOpen(false)}
                        className="flex-1 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleVoidConfirm}
                        className="flex-1 px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                      >
                        {voidAction === 'voided' ? 'Void Sale' : 'Confirm Refund'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              {/* Customer */}
              <section>
                <h4 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Customer
                </h4>
                <div className="bg-gray-50 dark:bg-[#111827] border border-gray-100 dark:border-slate-800 rounded-xl p-3.5 space-y-1.5 text-sm">
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedSale.customer_name}</p>
                  {selectedSale.phone && (
                    <p className="text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-gray-300 dark:text-slate-600 shrink-0" />
                      {selectedSale.phone}
                    </p>
                  )}
                  {selectedSale.email && (
                    <p className="text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-gray-300 dark:text-slate-600 shrink-0" />
                      {selectedSale.email}
                    </p>
                  )}
                </div>
              </section>

              {/* Sale details */}
              <section>
                <h4 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Receipt className="h-3.5 w-3.5" /> Sale Details
                </h4>
                <div className="bg-gray-50 dark:bg-[#111827] border border-gray-100 dark:border-slate-800 rounded-xl p-3.5 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-slate-400">Date</span>
                    <span className="font-medium text-gray-800 dark:text-slate-200">{formatDate(selectedSale.sale_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-slate-400">Payment</span>
                    <span className="inline-flex items-center gap-1 font-medium text-gray-800 dark:text-slate-200">
                      {PAYMENT_ICONS[selectedSale.payment_method]}
                      {PAYMENT_LABELS[selectedSale.payment_method]}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-slate-400">Created by</span>
                    <span className="font-medium text-gray-800 dark:text-slate-200">{selectedSale.created_by}</span>
                  </div>
                </div>
              </section>

              {/* Line items */}
              <section>
                <h4 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" /> Items
                </h4>
                <div className="bg-gray-50 dark:bg-[#111827] border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Item</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Qty</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Price</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Sub</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drawerItems.map((si) => (
                        <tr key={si.id} className="border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-gray-800 dark:text-slate-200 leading-tight">{si.item_name}</p>
                            <p className="text-gray-400 dark:text-slate-600 font-mono mt-0.5">{si.item_sku}</p>
                            {si.warranty_months > 0 && (
                              <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded text-[10px] font-semibold">
                                <ShieldCheck className="h-3 w-3" />
                                {si.warranty_months}mo warranty
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-700 dark:text-slate-300">{si.quantity}</td>
                          <td className="px-3 py-2.5 text-right text-gray-700 dark:text-slate-300">
                            ${si.unit_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-gray-900 dark:text-white">
                            ${si.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Pricing summary */}
              <section>
                <div className="bg-gray-50 dark:bg-[#111827] border border-gray-100 dark:border-slate-800 rounded-xl p-3.5 space-y-1.5 text-xs">
                  <div className="flex justify-between text-gray-500 dark:text-slate-400">
                    <span>Subtotal</span>
                    <span>${selectedSale.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {selectedSale.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Discount</span>
                      <span>−${selectedSale.discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {selectedSale.tax > 0 && (
                    <div className="flex justify-between text-gray-500 dark:text-slate-400">
                      <span>Tax</span>
                      <span>+${selectedSale.tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gray-900 dark:text-white text-sm pt-1.5 border-t border-gray-200 dark:border-slate-700">
                    <span>Total</span>
                    <span>${selectedSale.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </section>

              {/* Warranties */}
              {drawerWarranties.length > 0 && (
                <section>
                  <h4 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" /> Warranties Issued
                  </h4>
                  <div className="space-y-2">
                    {drawerWarranties.map((sw) => {
                      const daysLeft = Math.ceil((new Date(sw.expiry_date).getTime() - Date.now()) / 86400000);
                      return (
                        <div key={sw.id} className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-emerald-800 dark:text-emerald-300">{sw.item_name}</p>
                              <p className="text-emerald-600 dark:text-emerald-500 mt-0.5">{sw.warranty_id} · {sw.warranty_months} months</p>
                            </div>
                            <span className={`shrink-0 px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                              daysLeft > 30
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : daysLeft > 0
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
                            }`}>
                              {daysLeft > 0 ? `${daysLeft}d left` : 'Expired'}
                            </span>
                          </div>
                          <p className="text-emerald-600 dark:text-emerald-600 mt-1.5">Expires {formatDate(sw.expiry_date)}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Notes */}
              {selectedSale.notes && !isEditing && (
                <section>
                  <h4 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <StickyNote className="h-3.5 w-3.5" /> Notes
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-slate-300 italic bg-gray-50 dark:bg-[#111827] border border-gray-100 dark:border-slate-800 rounded-xl p-3.5">
                    {selectedSale.notes}
                  </p>
                </section>
              )}

              {/* Inline Refund/Void actions (only for completed sales, not in edit mode) */}
              {selectedSale.status === 'completed' && !isEditing && !voidOpen && (
                <section>
                  <h4 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Danger Zone
                  </h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openVoidConfirm('refunded')}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" /> Refund
                    </button>
                    <button
                      onClick={() => openVoidConfirm('voided')}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                      <Ban className="h-3.5 w-3.5" /> Void
                    </button>
                  </div>
                </section>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── New Sale Drawer ── */}
      {isNewSaleOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="fixed inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in" onClick={closeModal} />
          <aside className="relative z-10 w-full max-w-2xl bg-white dark:bg-[#131b2e] shadow-2xl animate-slide-in-right h-full flex flex-col border-l border-gray-200 dark:border-slate-800">

            {/* Drawer header */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 px-5 py-4 shrink-0">
              <div className="flex items-center gap-2">
                <div className="bg-brand-50 dark:bg-brand-950/20 p-1.5 rounded-lg">
                  <ShoppingBag className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">New Sale</h2>
              </div>
              <button onClick={closeModal} className="rounded-lg p-1.5 text-gray-400 dark:text-slate-500 transition-colors hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-slate-300">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

              {/* Errors */}
              {formErrors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/30 rounded-xl p-3.5 space-y-1">
                  {formErrors.map((e, i) => (
                    <p key={i} className="text-xs text-red-700 dark:text-red-400 flex items-start gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      {e}
                    </p>
                  ))}
                </div>
              )}

              {/* Customer + Payment row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Customer */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> Customer
                  </h3>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Name <span className="text-red-500">*</span></label>
                    <input
                      value={form.customerName}
                      onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                      placeholder="Full name"
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#111827] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Phone</label>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+961 70 123 456 (e.g. 70 123 456)"
                      type="tel"
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#111827] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="customer@email.com"
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#111827] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Delivery Address <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
                    <input
                      value={form.deliveryAddress}
                      onChange={(e) => setForm((f) => ({ ...f, deliveryAddress: e.target.value }))}
                      placeholder="Street, building, floor…"
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#111827] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Google Maps Link <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
                    <input
                      value={form.deliveryMapsUrl}
                      onChange={(e) => setForm((f) => ({ ...f, deliveryMapsUrl: e.target.value }))}
                      placeholder="Paste a shared Google Maps link"
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#111827] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                    />
                  </div>
                </div>

                {/* Payment */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" /> Payment
                  </h3>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Method</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['cash', 'card', 'transfer', 'other'] as PaymentMethod[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, paymentMethod: m }))}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                            form.paymentMethod === m
                              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400'
                              : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-600'
                          }`}
                        >
                          {PAYMENT_ICONS[m]}
                          {PAYMENT_LABELS[m]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Notes</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Optional sale notes…"
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#111827] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Line items */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" /> Items
                </h3>
                <div className="space-y-2">
                  {form.lineItems.map((li) => {
                    const invItem = state.inventory.find((i) => i.id === li.inventoryItemId);
                    const availableQty = invItem?.quantity ?? 0;
                    const isOverStock = invItem && li.quantity > availableQty;
                    return (
                      <div
                        key={li.draftId}
                        className={`grid grid-cols-[1fr_80px_100px_auto_36px] gap-2 items-start p-3 rounded-xl border ${
                          isOverStock
                            ? 'border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/10'
                            : 'border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-[#111827]'
                        }`}
                      >
                        {/* Item combobox */}
                        <div>
                          <ItemCombobox
                            value={li.inventoryItemId}
                            onChange={(id) => handleItemSelect(li.draftId, id)}
                            options={stockedItems}
                          />
                          {invItem && (
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[10px] text-gray-400 dark:text-slate-500">Stock: {availableQty}</span>
                              {invItem.supplier_warranty_months > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded font-semibold">
                                  <ShieldCheck className="h-2.5 w-2.5" />
                                  {invItem.supplier_warranty_months}mo warranty
                                </span>
                              )}
                              {isOverStock && (
                                <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold">Exceeds stock!</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Qty */}
                        <div>
                          <label className="block text-[10px] text-gray-400 dark:text-slate-500 mb-0.5 font-semibold">Qty</label>
                          <input
                            type="number"
                            min={1}
                            value={li.quantity}
                            onChange={(e) => updateLineItem(li.draftId, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-full px-2 py-1.5 text-xs text-center border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0b0f19] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                          />
                        </div>

                        {/* Unit price */}
                        <div>
                          <label className="block text-[10px] text-gray-400 dark:text-slate-500 mb-0.5 font-semibold">Unit Price</label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={li.unitPrice}
                              onChange={(e) => updateLineItem(li.draftId, { unitPrice: parseFloat(e.target.value) || 0 })}
                              className="w-full pl-5 pr-2 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0b0f19] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                            />
                          </div>
                        </div>

                        {/* Subtotal */}
                        <div className="text-right">
                          <label className="block text-[10px] text-gray-400 dark:text-slate-500 mb-0.5 font-semibold">Subtotal</label>
                          <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 py-1.5">
                            ${(li.quantity * li.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => removeLineItem(li.draftId)}
                          disabled={form.lineItems.length === 1}
                          className="mt-5 p-1 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={addLineItem}
                  className="mt-2 flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add another item
                </button>
              </div>

              {/* Pricing footer */}
              <div className="bg-gray-50 dark:bg-[#111827] border border-gray-100 dark:border-slate-800 rounded-xl p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Discount ($)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={form.discount}
                        onChange={(e) => setForm((f) => ({ ...f, discount: parseFloat(e.target.value) || 0 }))}
                        className="w-full pl-6 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0b0f19] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Tax ($)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={form.tax}
                        onChange={(e) => setForm((f) => ({ ...f, tax: parseFloat(e.target.value) || 0 }))}
                        className="w-full pl-6 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0b0f19] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col justify-end">
                    <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Total</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${formTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    {formSubtotal !== formTotal && (
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        Subtotal: ${formSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer footer */}
            <div className="px-5 py-4 border-t border-gray-200 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0 bg-gray-50 dark:bg-[#0b0f19]">
              <button onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
              >
                <Tag className="h-4 w-4" />
                {submitting ? 'Saving…' : 'Complete Sale'}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Document Preview Modal for sale receipts */}
      <DocumentPreviewModal
        open={previewType !== null}
        type={previewType}
        repair={null}
        sale={selectedSale}
        saleItems={selectedSale ? (state.saleItems ?? []).filter((si) => si.sale_id === selectedSale.id) : []}
        onClose={() => setPreviewType(null)}
      />
    </div>
  );
}
