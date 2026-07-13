import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowLeft,
  Inbox,
  DollarSign,
  Smartphone,
  Wrench,
  Clock,
  Building2,
  Globe,
  Mail,
  Phone,
  MapPin,
  FileText,
  Hash,
  ExternalLink,
  ShoppingBag,
  LayoutList,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatDate } from '../utils/helpers';
import type { RepairRecord, Sale } from '../types';

type SortDir = 'asc' | 'desc';

interface SortState {
  field: string;
  dir: SortDir;
}

interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  phone_norm: string;
  email: string;
  total_tickets: number;
  active_repairs: number;
  total_spent: number;
  status: 'Active' | 'Suspended';
  is_corporate: boolean;
  corporate_mof: string;
  corporate_address: string;
  corporate_email: string;
  corporate_website: string;
}

type DetailTab = 'all' | 'repairs' | 'sales' | 'devices';

export function CustomerDatabaseView() {
  const { state } = useStore();

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sort, setSort] = useState<SortState>({ field: 'name', dir: 'asc' });
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('all');
  const [detailSearch, setDetailSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  // Reset detail state when customer changes
  useEffect(() => {
    setDetailTab('all');
    setDetailSearch('');
  }, [selectedCustomer?.id]);

  const customerProfiles = useMemo<CustomerProfile[]>(() => {
    const map = new Map<string, CustomerProfile>();
    for (const r of state.repairs) {
      const key = r.phone_norm || r.phone || r.customer_name;
      const existing = map.get(key);
      if (existing) {
        existing.total_tickets += 1;
        if (r.status === 'Completed') existing.total_spent += r.price;
        if (r.status !== 'Completed' && r.status !== 'Cancelled' && r.status !== 'Canceled') existing.active_repairs += 1;
        if (!existing.email || existing.email === '—') existing.email = r.email || existing.email;
        if (r.is_corporate && !existing.is_corporate) {
          existing.is_corporate = true;
          existing.corporate_mof = r.corporate_mof || '';
          existing.corporate_address = r.corporate_address || '';
          existing.corporate_email = r.corporate_email || '';
          existing.corporate_website = r.corporate_website || '';
        }
      } else {
        const isActive = r.status !== 'Completed' && r.status !== 'Cancelled' && r.status !== 'Canceled';
        map.set(key, {
          id: key,
          name: r.customer_name,
          phone: r.phone,
          phone_norm: r.phone_norm || '',
          email: r.email || '—',
          total_tickets: 1,
          active_repairs: isActive ? 1 : 0,
          total_spent: r.status === 'Completed' ? r.price : 0,
          status: 'Active',
          is_corporate: r.is_corporate ?? false,
          corporate_mof: r.corporate_mof || '',
          corporate_address: r.corporate_address || '',
          corporate_email: r.corporate_email || '',
          corporate_website: r.corporate_website || '',
        });
      }
    }
    // Aggregate direct sales
    for (const sale of (state.sales ?? [])) {
      if (sale.status !== 'completed') continue;
      const key = sale.phone_norm || sale.phone || sale.customer_name;
      const existing = map.get(key);
      if (existing) {
        existing.total_spent += sale.total;
      } else {
        map.set(key, {
          id: key,
          name: sale.customer_name,
          phone: sale.phone,
          phone_norm: sale.phone_norm || '',
          email: sale.email || '—',
          total_tickets: 0,
          active_repairs: 0,
          total_spent: sale.total,
          status: 'Active',
          is_corporate: false,
          corporate_mof: '',
          corporate_address: '',
          corporate_email: '',
          corporate_website: '',
        });
      }
    }
    return Array.from(map.values());
  }, [state.repairs, state.sales]);

  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let rows = customerProfiles;
    if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.phone.includes(q) || r.email.toLowerCase().includes(q));
    if (statusFilter !== 'all') rows = rows.filter((r) => r.status === statusFilter);
    rows = [...rows].sort((a, b) => {
      const av = a[sort.field as keyof CustomerProfile];
      const bv = b[sort.field as keyof CustomerProfile];
      if (typeof av === 'number' && typeof bv === 'number') return sort.dir === 'asc' ? av - bv : bv - av;
      return sort.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return rows;
  }, [customerProfiles, searchQuery, statusFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, safePage, pageSize]);

  const handleSort = (field: string) => {
    setSort((prev) => prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' });
  };

  const getCustomerRepairs = (customer: CustomerProfile): RepairRecord[] =>
    state.repairs.filter((r) => (r.phone_norm || r.phone || r.customer_name) === customer.id);

  const getCustomerSales = (customer: CustomerProfile): Sale[] =>
    (state.sales ?? []).filter((s) => (s.phone_norm || s.phone || s.customer_name) === customer.id);

  const getCustomerDevices = (customer: CustomerProfile) => {
    const repairs = getCustomerRepairs(customer);
    const deviceMap = new Map<string, { brand: string; model: string; serial: string; count: number }>();
    for (const r of repairs) {
      const k = `${r.brand}|${r.model}|${r.serial}`;
      const ex = deviceMap.get(k);
      if (ex) ex.count += 1;
      else deviceMap.set(k, { brand: r.brand, model: r.model, serial: r.serial, count: 1 });
    }
    return Array.from(deviceMap.values());
  };

  // ─── Detail view ──────────────────────────────────────────────────────────
  if (selectedCustomer) {
    const repairs = getCustomerRepairs(selectedCustomer);
    const customerSales = getCustomerSales(selectedCustomer);
    const devices = getCustomerDevices(selectedCustomer);
    const activeRepairs = repairs.filter((r) => r.status !== 'Completed' && r.status !== 'Cancelled' && r.status !== 'Canceled').length;

    // Lifetime spent: completed repairs + completed sales
    const lifetimeSpent =
      repairs.reduce((sum, r) => r.status === 'Completed' ? sum + r.price : sum, 0) +
      customerSales.filter((s) => s.status === 'completed').reduce((sum, s) => sum + s.total, 0);

    // Merged chronological history for "All" tab
    type HistoryItem =
      | { kind: 'repair'; date: string; repair: RepairRecord }
      | { kind: 'sale'; date: string; sale: Sale };

    const allHistory: HistoryItem[] = [
      ...repairs.map((r): HistoryItem => ({ kind: 'repair', date: r.created_at || r.date_in, repair: r })),
      ...customerSales.map((s): HistoryItem => ({ kind: 'sale', date: s.created_at, sale: s })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const dq = detailSearch.toLowerCase();
    const filteredHistory = dq
      ? allHistory.filter((h) =>
          h.kind === 'repair'
            ? (h.repair.repair_id?.toLowerCase().includes(dq) || `${h.repair.brand} ${h.repair.model}`.toLowerCase().includes(dq) || h.repair.problem?.toLowerCase().includes(dq))
            : (h.sale.sale_id.toLowerCase().includes(dq) || h.sale.notes?.toLowerCase().includes(dq))
        )
      : allHistory;
    const filteredRepairs = dq
      ? repairs.filter((r) => (r.repair_id?.toLowerCase().includes(dq) || `${r.brand} ${r.model}`.toLowerCase().includes(dq) || r.problem?.toLowerCase().includes(dq)))
      : repairs;
    const filteredSales = dq
      ? customerSales.filter((s) => s.sale_id.toLowerCase().includes(dq) || s.notes?.toLowerCase().includes(dq))
      : customerSales;

    return (
      <div className="animate-fade-in">
        <button
          onClick={() => setSelectedCustomer(null)}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors mb-5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Database
        </button>

        {/* Profile Header */}
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#131b2e] p-6 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-teal-500 text-white text-xl font-bold shadow-md">
              {selectedCustomer.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 truncate">{selectedCustomer.name}</h2>
                {selectedCustomer.is_corporate && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/30 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                    <Building2 className="h-3 w-3" /> Corporate
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-1.5 text-sm text-gray-500 dark:text-slate-400">
                {selectedCustomer.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {selectedCustomer.phone}</span>}
                {selectedCustomer.email && selectedCustomer.email !== '—' && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {selectedCustomer.email}</span>}
              </div>
            </div>
          </div>

          {selectedCustomer.is_corporate && (
            <div className="mt-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-3">Corporate Information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {selectedCustomer.corporate_mof && (
                  <div className="flex items-start gap-2">
                    <Hash className="h-4 w-4 text-gray-400 dark:text-slate-500 mt-0.5 shrink-0" />
                    <div><p className="text-xs text-gray-500 dark:text-slate-400">MOF Number</p><p className="font-medium text-gray-900 dark:text-slate-100">{selectedCustomer.corporate_mof}</p></div>
                  </div>
                )}
                {selectedCustomer.corporate_address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-400 dark:text-slate-500 mt-0.5 shrink-0" />
                    <div><p className="text-xs text-gray-500 dark:text-slate-400">Address</p><p className="font-medium text-gray-900 dark:text-slate-100">{selectedCustomer.corporate_address}</p></div>
                  </div>
                )}
                {selectedCustomer.corporate_email && (
                  <div className="flex items-start gap-2">
                    <Mail className="h-4 w-4 text-gray-400 dark:text-slate-500 mt-0.5 shrink-0" />
                    <div><p className="text-xs text-gray-500 dark:text-slate-400">Business Email</p><p className="font-medium text-gray-900 dark:text-slate-100">{selectedCustomer.corporate_email}</p></div>
                  </div>
                )}
                {selectedCustomer.corporate_website && (
                  <div className="flex items-start gap-2">
                    <Globe className="h-4 w-4 text-gray-400 dark:text-slate-500 mt-0.5 shrink-0" />
                    <div><p className="text-xs text-gray-500 dark:text-slate-400">Website</p><p className="font-medium text-gray-900 dark:text-slate-100">{selectedCustomer.corporate_website}</p></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <KpiCard icon={<Smartphone className="h-5 w-5" />} label="Total Devices" value={String(devices.length)} color="blue" />
          <KpiCard icon={<Wrench className="h-5 w-5" />} label="Active Repairs" value={String(activeRepairs)} color="amber" />
          <KpiCard
            icon={<DollarSign className="h-5 w-5" />}
            label="Lifetime Spent"
            value={`$${lifetimeSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            color="emerald"
          />
        </div>

        {/* Detail Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
          <input
            value={detailSearch}
            onChange={(e) => setDetailSearch(e.target.value)}
            placeholder="Filter this customer's history…"
            className="w-full rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0b0f19] pl-10 pr-4 py-2 text-sm text-gray-700 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20"
          />
        </div>

        {/* Tabs */}
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#131b2e] shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-[#0b0f19] overflow-x-auto">
            {(
              [
                { key: 'all', label: 'All', icon: <LayoutList className="h-3.5 w-3.5" />, count: allHistory.length },
                { key: 'repairs', label: 'Repair History', icon: <Clock className="h-3.5 w-3.5" />, count: repairs.length },
                { key: 'sales', label: 'Sales History', icon: <ShoppingBag className="h-3.5 w-3.5" />, count: customerSales.length },
                { key: 'devices', label: 'Device History', icon: <Smartphone className="h-3.5 w-3.5" />, count: devices.length },
              ] as const
            ).map(({ key, label, icon, count }) => (
              <button
                key={key}
                onClick={() => setDetailTab(key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-all ${
                  detailTab === key
                    ? 'border-blue-600 dark:border-blue-400 text-blue-700 dark:text-blue-400 bg-white dark:bg-[#131b2e]'
                    : 'border-transparent text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'
                }`}
              >
                {icon}
                {label}
                <span className="ml-1 rounded-full bg-gray-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:text-slate-400">
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* All Tab — merged chronological view */}
          {detailTab === 'all' && (
            <div className="overflow-x-auto">
              {filteredHistory.length === 0 ? (
                <EmptyState message={detailSearch ? 'No results match your search' : 'No history found for this customer'} />
              ) : (
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-[#0b0f19] border-b border-gray-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Reference</th>
                      <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Description</th>
                      <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-right">Amount</th>
                      <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((h, i) => (
                      <tr key={i} className={`border-b border-gray-100 dark:border-slate-800 hover:bg-blue-50/40 dark:hover:bg-blue-950/10 transition-colors ${i % 2 === 0 ? 'bg-white dark:bg-[#131b2e]' : 'bg-gray-50/30 dark:bg-slate-800/10'}`}>
                        {h.kind === 'repair' ? (
                          <>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400">
                                <FileText className="h-3 w-3" /> Repair
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs font-medium text-blue-700 dark:text-blue-400">{h.repair.repair_id}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-slate-300">
                              {h.repair.brand} {h.repair.model}
                              {h.repair.problem && <span className="block text-gray-400 dark:text-slate-500 truncate max-w-[200px]">{h.repair.problem}</span>}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">{formatDate(h.repair.date_in)}</td>
                            <td className="px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-slate-100 text-right tabular-nums">
                              ${h.repair.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-2.5"><RepairStatusBadge status={h.repair.status} /></td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400">
                                <ShoppingBag className="h-3 w-3" /> Sale
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs font-medium text-violet-700 dark:text-violet-400">{h.sale.sale_id}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-slate-300">
                              Direct Sale
                              {h.sale.notes && <span className="block text-gray-400 dark:text-slate-500 truncate max-w-[200px] italic">{h.sale.notes}</span>}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">{formatDate(h.sale.sale_date)}</td>
                            <td className="px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-slate-100 text-right tabular-nums">
                              ${h.sale.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-2.5">
                              <SaleStatusBadge status={h.sale.status} />
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Repair History Tab */}
          {detailTab === 'repairs' && (
            <div className="overflow-x-auto">
              {filteredRepairs.length === 0 ? (
                <EmptyState message={detailSearch ? 'No repairs match your search' : 'No repair records found for this customer'} />
              ) : (
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-[#0b0f19] border-b border-gray-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Ticket ID</th>
                      <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Device</th>
                      <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Fault</th>
                      <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-right">Cost</th>
                      <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRepairs.map((r, i) => (
                      <tr key={r.id} className={`border-b border-gray-100 dark:border-slate-800 hover:bg-blue-50/40 dark:hover:bg-blue-950/10 transition-colors ${i % 2 === 0 ? 'bg-white dark:bg-[#131b2e]' : 'bg-gray-50/30 dark:bg-slate-800/10'}`}>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1.5 text-sm font-mono font-medium text-blue-700 dark:text-blue-400">
                            <FileText className="h-3.5 w-3.5" />{r.repair_id}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300">{r.brand} {r.model}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-600 dark:text-slate-400 max-w-[200px] truncate">{r.problem || r.mof || '—'}</td>
                        <td className="px-4 py-2.5"><RepairStatusBadge status={r.status} /></td>
                        <td className="px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-slate-100 text-right tabular-nums">
                          ${r.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-slate-400">{formatDate(r.created_at || r.date_in)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Sales History Tab */}
          {detailTab === 'sales' && (
            <div className="overflow-x-auto">
              {filteredSales.length === 0 ? (
                <EmptyState message={detailSearch ? 'No sales match your search' : 'No direct sales found for this customer'} />
              ) : (
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-[#0b0f19] border-b border-gray-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Sale ID</th>
                      <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Items</th>
                      <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Payment</th>
                      <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-right">Total</th>
                      <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((s, i) => {
                      const itemCount = (state.saleItems ?? []).filter((si) => si.sale_id === s.id).length;
                      return (
                        <tr key={s.id} className={`border-b border-gray-100 dark:border-slate-800 hover:bg-violet-50/40 dark:hover:bg-violet-950/10 transition-colors ${i % 2 === 0 ? 'bg-white dark:bg-[#131b2e]' : 'bg-gray-50/30 dark:bg-slate-800/10'}`}>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-1.5 text-sm font-mono font-medium text-violet-700 dark:text-violet-400">
                              <ShoppingBag className="h-3.5 w-3.5" />{s.sale_id}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">{formatDate(s.sale_date)}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-slate-400">
                            {itemCount} item{itemCount !== 1 ? 's' : ''}
                            {s.notes && <span className="block italic text-gray-400 dark:text-slate-500 truncate max-w-[180px]">{s.notes}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-xs capitalize text-gray-600 dark:text-slate-400">{s.payment_method}</td>
                          <td className="px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-slate-100 text-right tabular-nums">
                            ${s.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5"><SaleStatusBadge status={s.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Device History Tab */}
          {detailTab === 'devices' && (
            <div className="overflow-x-auto">
              {devices.length === 0 ? (
                <EmptyState message="No devices registered for this customer" />
              ) : (
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-[#0b0f19] border-b border-gray-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Brand</th>
                      <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Model</th>
                      <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Serial / IMEI</th>
                      <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-right">Repairs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((d, i) => (
                      <tr key={`${d.brand}-${d.model}-${d.serial}-${i}`} className={`border-b border-gray-100 dark:border-slate-800 ${i % 2 === 0 ? 'bg-white dark:bg-[#131b2e]' : 'bg-gray-50/30 dark:bg-slate-800/10'}`}>
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-slate-100">{d.brand || '—'}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300">{d.model || '—'}</td>
                        <td className="px-4 py-2.5 text-sm font-mono text-gray-600 dark:text-slate-400">{d.serial || '—'}</td>
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-slate-100 text-right">{d.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Master Table ─────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <MiniStat label="Total Customers" value={String(customerProfiles.length)} />
        <MiniStat label="Active" value={String(customerProfiles.filter((c) => c.active_repairs > 0).length)} />
        <MiniStat label="Corporate" value={String(customerProfiles.filter((c) => c.is_corporate).length)} />
        <MiniStat
          label="Total Revenue"
          value={`$${customerProfiles.reduce((s, c) => s + c.total_spent, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, phone, or email…"
            className="w-full rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0b0f19] pl-10 pr-4 py-2 text-sm text-gray-700 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0b0f19] px-3 py-2 text-sm text-gray-700 dark:text-slate-100 focus:border-blue-400 focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Suspended">Suspended</option>
        </select>
        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
          className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0b0f19] px-3 py-2 text-sm text-gray-700 dark:text-slate-100 focus:border-blue-400 focus:outline-none"
        >
          <option value={10}>10 per page</option>
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#131b2e] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-gray-50 dark:bg-[#0b0f19] border-b border-gray-200 dark:border-slate-800">
              <tr>
                <SortHeader label="Customer" field="name" sort={sort} onSort={handleSort} />
                <SortHeader label="Phone" field="phone" sort={sort} onSort={handleSort} />
                <SortHeader label="Email" field="email" sort={sort} onSort={handleSort} />
                <SortHeader label="Tickets" field="total_tickets" sort={sort} onSort={handleSort} align="right" />
                <SortHeader label="Total Spent" field="total_spent" sort={sort} onSort={handleSort} align="right" />
                <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider w-24">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-300 dark:text-slate-600 mb-4">
                        <Inbox className="h-8 w-8" />
                      </div>
                      <p className="text-sm font-medium text-gray-700 dark:text-slate-300">No customers found</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Try adjusting your search or filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`border-b border-gray-100 dark:border-slate-800 transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-950/10 cursor-pointer ${i % 2 === 0 ? 'bg-white dark:bg-[#131b2e]' : 'bg-gray-50/30 dark:bg-slate-800/10'}`}
                    onClick={() => setSelectedCustomer(row)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-teal-500 text-white text-xs font-bold shadow-sm">
                          {row.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate block">{row.name}</span>
                          {row.is_corporate && <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">Corporate</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400 font-mono">{row.phone}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">{row.email}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100 text-right">{row.total_tickets}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-slate-100 text-right tabular-nums">
                      ${row.total_spent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${row.active_repairs > 0 ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${row.active_repairs > 0 ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {row.active_repairs > 0 ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedCustomer(row); }}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 dark:border-slate-800 px-4 py-3">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Showing {filteredData.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredData.length)} of {filteredData.length} customers
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} className="rounded-lg p-1.5 text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-slate-300 disabled:opacity-40 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) page = i + 1;
              else if (safePage <= 3) page = i + 1;
              else if (safePage >= totalPages - 2) page = totalPages - 4 + i;
              else page = safePage - 2 + i;
              return (
                <button key={page} onClick={() => setCurrentPage(page)} className={`h-7 w-7 rounded-lg text-xs font-medium transition-colors ${page === safePage ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}>
                  {page}
                </button>
              );
            })}
            <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="rounded-lg p-1.5 text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-slate-300 disabled:opacity-40 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function SortHeader({ label, field, sort, onSort, align = 'left' }: { label: string; field: string; sort: SortState; onSort: (f: string) => void; align?: 'left' | 'right' }) {
  const isActive = sort.field === field;
  return (
    <th className={`px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800/50 transition-colors ${align === 'right' ? 'text-right' : 'text-left'}`} onClick={() => onSort(field)}>
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {label}
        {isActive ? sort.dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 text-gray-300 dark:text-slate-600" />}
      </span>
    </th>
  );
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: 'blue' | 'amber' | 'emerald' }) {
  const colorMap = { blue: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/30', amber: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/30', emerald: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30' };
  const iconBg = { blue: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400', amber: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400', emerald: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]} transition-all hover:shadow-md`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg[color]}`}>{icon}</div>
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{label}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-slate-100">{value}</p>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#131b2e] px-4 py-3">
      <p className="text-[11px] font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-slate-100 mt-0.5">{value}</p>
    </div>
  );
}

function RepairStatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    Pending: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    'In Progress': 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400',
    'Awaiting Parts': 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400',
    'Ready For Pickup': 'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400',
    Completed: 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400',
    Cancelled: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400',
    Canceled: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400',
  };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${config[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>;
}

function SaleStatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    completed: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400',
    refunded: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400',
    voided: 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400',
  };
  const labels: Record<string, string> = { completed: 'Completed', refunded: 'Refunded', voided: 'Voided' };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${config[status] || 'bg-gray-100 text-gray-600'}`}>{labels[status] ?? status}</span>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-300 dark:text-slate-600 mb-3">
        <Inbox className="h-7 w-7" />
      </div>
      <p className="text-sm text-gray-500 dark:text-slate-400">{message}</p>
    </div>
  );
}
