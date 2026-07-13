import { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileText,
  Search,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Printer,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Building2,
  User,
  Layers,
  ShoppingBag,
  Package,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { showToast } from '../components/Toast';
import { formatDate } from '../utils/helpers';
import type { RepairRecord, Sale } from '../types';

type InvoiceStatus = 'Paid' | 'Pending' | 'Cancelled';
type InvoiceType = 'repair' | 'sale';

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  customerName: string;
  phone: string;
  deviceDescription: string; // repair: "Brand Model" | sale: item summary
  serial: string;             // repair: SN | sale: payment method
  amount: number;
  status: InvoiceStatus;
  type: InvoiceType;
  rawRecord?: RepairRecord;
  rawSale?: Sale;
}

type SortField = 'invoiceNumber' | 'date' | 'customerName' | 'amount';
type SortDir = 'asc' | 'desc';

export function InvoicesPage() {
  const { state } = useStore();

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Pending' | 'Cancelled'>('All');
  const [typeFilter, setTypeFilter] = useState<'All' | 'repair' | 'sale'>('All');
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'date', dir: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  // Merge repair invoices + sale invoices
  const invoices = useMemo<InvoiceData[]>(() => {
    const repairInvoices: InvoiceData[] = state.repairs.map((repair) => {
      let status: InvoiceStatus = 'Pending';
      if (repair.status === 'Completed' || repair.status === 'Ready') status = 'Paid';
      else if (repair.status === 'Cancelled' || repair.status === 'Canceled') status = 'Cancelled';
      return {
        invoiceNumber: repair.repair_id
          ? `INV-${repair.repair_id.replace(/\D/g, '') || repair.id.substring(0, 5)}`
          : `INV-${repair.id.substring(0, 5)}`,
        date: repair.date_in,
        customerName: repair.customer_name,
        phone: repair.phone,
        deviceDescription: `${repair.brand} ${repair.model}`,
        serial: repair.serial || '—',
        amount: Number(repair.price) || 0,
        status,
        type: 'repair',
        rawRecord: repair,
      };
    });

    const saleInvoices: InvoiceData[] = (state.sales ?? []).map((sale) => {
      let status: InvoiceStatus = 'Paid';
      if (sale.status === 'refunded') status = 'Pending';
      if (sale.status === 'voided') status = 'Cancelled';
      // Build a short description from sale items
      const saleItemsForSale = (state.saleItems ?? []).filter((si) => si.sale_id === sale.id);
      const desc = saleItemsForSale.length === 1
        ? saleItemsForSale[0].item_name
        : saleItemsForSale.length > 1
        ? `${saleItemsForSale[0].item_name} +${saleItemsForSale.length - 1} more`
        : 'Direct Sale';
      return {
        invoiceNumber: sale.sale_id,
        date: sale.sale_date,
        customerName: sale.customer_name,
        phone: sale.phone,
        deviceDescription: desc,
        serial: sale.payment_method,
        amount: sale.total,
        status,
        type: 'sale',
        rawSale: sale,
      };
    });

    return [...repairInvoices, ...saleInvoices];
  }, [state.repairs, state.sales, state.saleItems]);

  const metrics = useMemo(() => {
    let gross = 0, collected = 0, pending = 0;
    invoices.forEach((inv) => {
      gross += inv.amount;
      if (inv.status === 'Paid') collected += inv.amount;
      if (inv.status === 'Pending') pending += inv.amount;
    });
    return { gross, collected, pending, count: invoices.filter((i) => i.status !== 'Cancelled').length };
  }, [invoices]);

  const filteredData = useMemo(() => {
    let result = [...invoices];
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (i) =>
          i.invoiceNumber.toLowerCase().includes(q) ||
          i.customerName.toLowerCase().includes(q) ||
          i.deviceDescription.toLowerCase().includes(q) ||
          i.serial.toLowerCase().includes(q) ||
          i.phone.includes(q)
      );
    }
    if (statusFilter !== 'All') result = result.filter((i) => i.status === statusFilter);
    if (typeFilter !== 'All') result = result.filter((i) => i.type === typeFilter);
    result.sort((a, b) => {
      const av = a[sort.field];
      const bv = b[sort.field];
      if (sort.field === 'amount') return sort.dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
      return sort.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return result;
  }, [invoices, searchQuery, statusFilter, typeFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, safePage, pageSize]);

  const handleSort = (field: SortField) => {
    setSort((prev) => ({ field, dir: prev.field === field && prev.dir === 'asc' ? 'desc' : 'asc' }));
  };

  const triggerPrint = () => window.print();

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in print:p-0">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2.5">
            <FileText className="h-6 w-6 text-brand-600" />
            Invoices Hub
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Unified billing ledger — repair tickets and direct sales in one view.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type filter */}
          <div className="flex items-center gap-1 rounded-xl bg-gray-100 dark:bg-slate-900/50 p-1">
            {(['All', 'repair', 'sale'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTypeFilter(t); setCurrentPage(1); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1 ${
                  typeFilter === t
                    ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 shadow-sm'
                    : 'text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'
                }`}
              >
                {t === 'repair' && <FileText className="h-3 w-3" />}
                {t === 'sale' && <ShoppingBag className="h-3 w-3" />}
                {t === 'All' ? 'All Types' : t === 'repair' ? 'Repairs' : 'Sales'}
              </button>
            ))}
          </div>
          {/* Status filter */}
          <div className="flex items-center gap-1 rounded-xl bg-gray-100 dark:bg-slate-900/50 p-1">
            {(['All', 'Paid', 'Pending', 'Cancelled'] as const).map((status) => (
              <button
                key={status}
                onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  statusFilter === status
                    ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 shadow-sm'
                    : 'text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 print:hidden">
        {[
          { label: 'Total Gross Revenue', value: `$${metrics.gross.toLocaleString()}`, icon: <DollarSign className="h-4 w-4 text-brand-500" />, sub: 'All recorded operations' },
          { label: 'Collected Funds', value: `$${metrics.collected.toLocaleString()}`, icon: <CheckCircle2 className="h-4 w-4 text-green-500" />, sub: 'Paid invoices', color: 'text-emerald-600' },
          { label: 'Outstanding Balances', value: `$${metrics.pending.toLocaleString()}`, icon: <Clock className="h-4 w-4 text-amber-500" />, sub: 'Pending payment', color: 'text-amber-600' },
          { label: 'Invoiced Assets', value: `${metrics.count} Items`, icon: <Layers className="h-4 w-4 text-slate-500" />, sub: 'Excluding cancelled' },
        ].map(({ label, value, icon, sub, color }) => (
          <div key={label} className="bg-white dark:bg-[#131b2e] p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between text-gray-400 dark:text-slate-500 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
              {icon}
            </div>
            <p className={`text-xl font-bold ${color ?? 'text-gray-900 dark:text-slate-100'}`}>{value}</p>
            <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">{sub}</span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4 flex items-center gap-3 print:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by invoice ID, customer, device, or phone…"
            className="w-full rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0b0f19] pl-10 pr-4 py-2 text-sm text-gray-700 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-500/20"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#131b2e] shadow-sm print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-gray-50 dark:bg-[#0b0f19] text-xs font-semibold uppercase text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800 select-none">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-5 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800/50 transition-colors" onClick={() => handleSort('invoiceNumber')}>
                  <div className="flex items-center gap-1.5">Invoice ID <SlidersHorizontal className="h-3 w-3 text-gray-400 dark:text-slate-500" /></div>
                </th>
                <th className="px-5 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800/50 transition-colors" onClick={() => handleSort('date')}>
                  <div className="flex items-center gap-1.5">Date <SlidersHorizontal className="h-3 w-3 text-gray-400 dark:text-slate-500" /></div>
                </th>
                <th className="px-5 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800/50 transition-colors" onClick={() => handleSort('customerName')}>
                  <div className="flex items-center gap-1.5">Client <SlidersHorizontal className="h-3 w-3 text-gray-400 dark:text-slate-500" /></div>
                </th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800/50 transition-colors" onClick={() => handleSort('amount')}>
                  <div className="flex items-center justify-center gap-1.5">Total <SlidersHorizontal className="h-3 w-3 text-gray-400 dark:text-slate-500" /></div>
                </th>
                <th className="px-5 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-400 dark:text-slate-500 font-medium">
                    No invoices found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedData.map((inv) => (
                  <tr
                    key={`${inv.type}-${inv.invoiceNumber}`}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    onClick={() => { setSelectedInvoice(inv); setDrawerOpen(true); }}
                  >
                    <td className="px-4 py-3.5">
                      {inv.type === 'repair' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400">
                          <FileText className="h-3 w-3" /> Repair
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400">
                          <ShoppingBag className="h-3 w-3" /> Sale
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono bg-slate-100 dark:bg-slate-800/70 text-gray-900 dark:text-slate-200 rounded px-2 py-0.5 text-xs font-bold border border-gray-200 dark:border-slate-700 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">
                        {inv.invoiceNumber}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-600 dark:text-slate-400 font-medium whitespace-nowrap">
                      {formatDate(inv.date)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col text-xs">
                        <span className="font-bold text-gray-900 dark:text-slate-100">{inv.customerName}</span>
                        <span className="text-gray-400 dark:text-slate-500 mt-0.5">{inv.phone}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-800 dark:text-slate-200">{inv.deviceDescription}</span>
                        <span className="text-[11px] font-mono text-gray-400 dark:text-slate-500 mt-0.5">
                          {inv.type === 'repair' ? `SN: ${inv.serial}` : `Pay: ${inv.serial}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center font-bold text-gray-900 dark:text-slate-100">
                      ${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        inv.status === 'Paid' ? 'bg-green-50 dark:bg-emerald-950/40 text-green-700 dark:text-emerald-400 border-green-200 dark:border-emerald-900/30' :
                        inv.status === 'Pending' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/30' :
                        'bg-gray-50 dark:bg-slate-800/50 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700/30'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="bg-gray-50 dark:bg-[#0b0f19] border-t border-gray-200 dark:border-slate-800 px-5 py-3 flex items-center justify-between text-xs text-gray-500 dark:text-slate-500 font-medium select-none">
          <div>
            Showing <span className="text-gray-700 dark:text-slate-300 font-bold">{filteredData.length === 0 ? 0 : (safePage - 1) * pageSize + 1}</span> to{' '}
            <span className="text-gray-700 dark:text-slate-300 font-bold">{Math.min(safePage * pageSize, filteredData.length)}</span> of{' '}
            <span className="text-gray-700 dark:text-slate-300 font-bold">{filteredData.length}</span> entries.
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="p-1 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 transition">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>Page <span className="font-bold text-gray-800 dark:text-slate-200">{safePage}</span> of {totalPages}</span>
            <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="p-1 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 transition">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {drawerOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 transition-opacity animate-fade-in print:hidden" onClick={() => setDrawerOpen(false)} />
      )}

      {/* Drawer */}
      <div className={`fixed inset-y-0 right-0 w-full max-w-2xl bg-white dark:bg-[#131b2e] shadow-2xl z-50 transform transition-transform duration-300 ease-in-out border-l border-gray-200 dark:border-slate-800 flex flex-col print:relative print:transform-none print:w-full print:inset-0 print:shadow-none print:border-none ${
        drawerOpen && selectedInvoice ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {selectedInvoice && (
          <>
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50 dark:bg-[#0b0f19] print:hidden">
              <div className="flex items-center gap-2">
                {selectedInvoice.type === 'repair'
                  ? <FileText className="h-5 w-5 text-brand-600" />
                  : <ShoppingBag className="h-5 w-5 text-violet-600" />}
                <span className="text-sm font-bold text-gray-900 dark:text-slate-100">Invoice Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={triggerPrint} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-brand-700 transition">
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
                <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:bg-gray-200 dark:hover:bg-slate-800 transition">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-[#131b2e] print:p-0">
              <div className="border border-gray-200 rounded-xl p-6 shadow-xs bg-white print:border-none print:p-0">
                {/* Company header */}
                <div className="flex justify-between items-start border-b border-gray-200 pb-6 mb-6">
                  <div>
                    <h2 className="text-xl font-black tracking-tight text-gray-900 flex items-center gap-1.5">
                      <Building2 className="h-5 w-5 text-brand-600" />
                      CyGnuS SARL
                    </h2>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">CRM Pro Repair Solutions</p>
                    <p className="text-[11px] text-gray-500 mt-2">Al Metn, Lebanon</p>
                    <p className="text-[11px] text-gray-400">operations@cygnus.com</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs uppercase font-extrabold tracking-wider text-brand-600 bg-brand-50 px-2.5 py-1 rounded border border-brand-100 print:bg-transparent print:border-none">
                      {selectedInvoice.type === 'repair' ? 'REPAIR INVOICE' : 'SALES INVOICE'}
                    </span>
                    <h3 className="text-lg font-mono font-bold text-gray-900 mt-3">{selectedInvoice.invoiceNumber}</h3>
                    <p className="text-[11px] text-gray-400 mt-1">Date: {formatDate(selectedInvoice.date)}</p>
                  </div>
                </div>

                {/* Client info */}
                <div className="grid grid-cols-2 gap-6 border-b border-gray-100 pb-6 mb-6">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Billed To</h4>
                    <p className="text-xs font-bold text-gray-900 flex items-center gap-1">
                      <User className="h-3 w-3 text-gray-400" /> {selectedInvoice.customerName}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">Phone: {selectedInvoice.phone}</p>
                  </div>
                  <div className="text-right">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                      {selectedInvoice.type === 'repair' ? 'Job Details' : 'Payment Details'}
                    </h4>
                    {selectedInvoice.type === 'repair' && selectedInvoice.rawRecord ? (
                      <>
                        <p className="text-xs font-semibold text-gray-800">
                          Ref: {selectedInvoice.rawRecord.repair_id || '—'}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Technician: @{selectedInvoice.rawRecord.technician || 'workbench'}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-semibold text-gray-800 capitalize">
                          Method: {selectedInvoice.rawSale?.payment_method ?? '—'}
                        </p>
                        {selectedInvoice.rawSale?.notes && (
                          <p className="text-[11px] text-gray-500 mt-0.5 italic">{selectedInvoice.rawSale.notes}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Line items */}
                <div className="mb-6">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase text-[10px] tracking-wider bg-slate-50 print:bg-transparent">
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-3 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Unit Price</th>
                        <th className="py-2 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedInvoice.type === 'repair' ? (
                        <tr>
                          <td className="py-3 px-3">
                            <div className="font-bold text-gray-900">{selectedInvoice.deviceDescription} — Repair Service</div>
                            <p className="text-[11px] text-gray-400 italic mt-0.5">
                              {selectedInvoice.rawRecord?.problem || 'Diagnostic service.'}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-center text-gray-600">1</td>
                          <td className="py-3 px-3 text-right text-gray-600">${selectedInvoice.amount.toFixed(2)}</td>
                          <td className="py-3 px-3 text-right font-bold text-gray-900">${selectedInvoice.amount.toFixed(2)}</td>
                        </tr>
                      ) : (
                        (state.saleItems ?? [])
                          .filter((si) => si.sale_id === selectedInvoice.rawSale?.id)
                          .map((si) => (
                            <tr key={si.id}>
                              <td className="py-3 px-3">
                                <div className="font-bold text-gray-900">{si.item_name}</div>
                                <p className="text-[11px] text-gray-400 font-mono mt-0.5">{si.item_sku}</p>
                              </td>
                              <td className="py-3 px-3 text-center text-gray-600">{si.quantity}</td>
                              <td className="py-3 px-3 text-right text-gray-600">${si.unit_price.toFixed(2)}</td>
                              <td className="py-3 px-3 text-right font-bold text-gray-900">${si.subtotal.toFixed(2)}</td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="border-t border-gray-200 pt-4 flex justify-end">
                  <div className="w-64 space-y-2 text-xs">
                    {selectedInvoice.type === 'sale' && selectedInvoice.rawSale ? (
                      <>
                        <div className="flex justify-between text-gray-500 font-medium">
                          <span>Subtotal:</span>
                          <span>${selectedInvoice.rawSale.subtotal.toFixed(2)}</span>
                        </div>
                        {selectedInvoice.rawSale.discount > 0 && (
                          <div className="flex justify-between text-emerald-600 font-medium">
                            <span>Discount:</span>
                            <span>−${selectedInvoice.rawSale.discount.toFixed(2)}</span>
                          </div>
                        )}
                        {selectedInvoice.rawSale.tax > 0 && (
                          <div className="flex justify-between text-gray-500 font-medium">
                            <span>Tax:</span>
                            <span>+${selectedInvoice.rawSale.tax.toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex justify-between text-gray-500 font-medium">
                        <span>Subtotal:</span>
                        <span>${selectedInvoice.amount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-500 font-medium">
                      <span>VAT (0%):</span>
                      <span>$0.00</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-100 pt-2 text-sm font-black text-gray-900">
                      <span>Total Due:</span>
                      <span className="text-brand-600">
                        ${selectedInvoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-12 pt-6 border-t border-gray-100 text-[10px] text-gray-400 text-center leading-relaxed">
                  Thank you for choosing CyGnuS SARL. All services and products are verified against strict quality standards prior to release.
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
