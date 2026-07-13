import { useMemo, useState } from 'react';
import { Truck, MapPin, Navigation, Phone, PackageCheck, ChevronRight, ExternalLink, CircleDot } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatDateTime, formatTimeAgo } from '../utils/helpers';
import type { Delivery, DeliveryStatus, Sale } from '../types';
import { DELIVERY_STATUSES } from '../types';

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: 'Pending',
  out_for_delivery: 'Out for Delivery',
  near_destination: 'Near Destination',
  delivered: 'Delivered',
};

const STATUS_STYLES: Record<DeliveryStatus, string> = {
  pending: 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400',
  out_for_delivery: 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400',
  near_destination: 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400',
  delivered: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400',
};

const NEXT_STATUS: Record<DeliveryStatus, DeliveryStatus | null> = {
  pending: 'out_for_delivery',
  out_for_delivery: 'near_destination',
  near_destination: 'delivered',
  delivered: null,
};

const NEXT_ACTION_LABEL: Record<DeliveryStatus, string> = {
  pending: 'Start Trip',
  out_for_delivery: 'Mark Near Destination',
  near_destination: 'Mark Delivered',
  delivered: 'Completed',
};

function mapsUrlFor(sale: Sale | undefined): string | null {
  if (!sale) return null;
  if (sale.delivery_maps_url) return sale.delivery_maps_url;
  if (sale.delivery_lat != null && sale.delivery_lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${sale.delivery_lat},${sale.delivery_lng}`;
  }
  if (sale.delivery_address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(sale.delivery_address)}`;
  }
  return null;
}

export function DeliveryPage() {
  const { state, service } = useStore();
  const user = service.getCurrentUser();

  if (!user) return null;

  if (user.role === 'delivery') {
    return <DriverView driverId={user.id} />;
  }

  return <DispatchView />;
}

// ============================================================
// Driver view — mobile-friendly trip list for the assigned driver
// ============================================================

function DriverView({ driverId }: { driverId: string }) {
  const { state, service } = useStore();

  const deliveries = useMemo(
    () =>
      state.deliveries
        .filter((d) => d.delivery_driver_id === driverId && d.status !== 'delivered')
        .concat(state.deliveries.filter((d) => d.delivery_driver_id === driverId && d.status === 'delivered').slice(0, 10))
        .sort((a, b) => (a.status === 'delivered' ? 1 : 0) - (b.status === 'delivered' ? 1 : 0)),
    [state.deliveries, driverId]
  );

  const saleFor = (d: Delivery) => state.sales.find((s) => s.id === d.sale_id);

  const handleAdvance = (d: Delivery) => {
    const next = NEXT_STATUS[d.status];
    if (!next) return;
    service.updateDeliveryStatus(d.id, next);
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <Truck className="h-6 w-6 text-brand-600" /> My Deliveries
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Your assigned trips, most urgent first.</p>
      </div>

      {deliveries.length === 0 ? (
        <div className="card p-10 text-center">
          <PackageCheck className="h-10 w-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-slate-400">No deliveries assigned right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {deliveries.map((d) => {
            const sale = saleFor(d);
            const mapsUrl = mapsUrlFor(sale);
            const next = NEXT_STATUS[d.status];
            return (
              <div key={d.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-slate-100 text-lg">{sale?.customer_name ?? 'Unknown customer'}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sale?.sale_id}</p>
                  </div>
                  <span className={`badge ${STATUS_STYLES[d.status]}`}>{STATUS_LABELS[d.status]}</span>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  {sale?.phone && (
                    <a href={`tel:${sale.phone}`} className="flex items-center gap-2 text-gray-600 dark:text-slate-300 hover:text-brand-600">
                      <Phone className="h-4 w-4 text-gray-400" /> {sale.phone}
                    </a>
                  )}
                  {sale?.delivery_address && (
                    <div className="flex items-start gap-2 text-gray-600 dark:text-slate-300">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                      <span>{sale.delivery_address}</span>
                    </div>
                  )}
                  {!sale?.delivery_address && !sale?.delivery_maps_url && (
                    <p className="text-gray-400 dark:text-slate-500 italic">No delivery address on file.</p>
                  )}
                </div>

                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary flex-1 justify-center"
                    >
                      <Navigation className="h-4 w-4" /> Open in GPS/Maps
                    </a>
                  )}
                  {next && (
                    <button onClick={() => handleAdvance(d)} className="btn-primary flex-1 justify-center">
                      {NEXT_ACTION_LABEL[d.status]} <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                  {!next && (
                    <div className="flex-1 flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-sm font-medium py-2">
                      <PackageCheck className="h-4 w-4" /> Delivered {d.completed_at ? formatTimeAgo(d.completed_at) : ''}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Dispatch view — admin/sales assignment & monitoring dashboard
// ============================================================

function DispatchView() {
  const { state, service } = useStore();
  const [filter, setFilter] = useState<'all' | DeliveryStatus>('all');
  const drivers = state.users.filter((u) => u.role === 'delivery');

  const rows = useMemo(() => {
    // Sales that have a delivery address (i.e. need delivery) plus their delivery record, if any.
    const eligibleSales = state.sales.filter((s) => s.status === 'completed' && (s.delivery_address || s.delivery_maps_url || s.delivery_lat != null));
    return eligibleSales
      .map((sale) => ({
        sale,
        delivery: state.deliveries.find((d) => d.sale_id === sale.id) ?? null,
      }))
      .filter((r) => (filter === 'all' ? true : (r.delivery?.status ?? 'pending') === filter))
      .sort((a, b) => (b.sale.sale_date > a.sale.sale_date ? 1 : -1));
  }, [state.sales, state.deliveries, filter]);

  const handleAssign = (saleId: string, driverId: string) => {
    service.assignDriver(saleId, driverId || null);
  };

  const handleStatusChange = (deliveryId: string, status: DeliveryStatus) => {
    service.updateDeliveryStatus(deliveryId, status);
  };

  const counts = useMemo(() => {
    const c: Record<'all' | DeliveryStatus, number> = { all: 0, pending: 0, out_for_delivery: 0, near_destination: 0, delivered: 0 };
    for (const s of state.sales) {
      if (!(s.delivery_address || s.delivery_maps_url || s.delivery_lat != null) || s.status !== 'completed') continue;
      c.all++;
      const d = state.deliveries.find((d) => d.sale_id === s.id);
      c[d?.status ?? 'pending']++;
    }
    return c;
  }, [state.sales, state.deliveries]);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Truck className="h-6 w-6 text-brand-600" /> Delivery
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Assign drivers and monitor delivery progress for orders that need to be shipped out.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {(['all', ...DELIVERY_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === s
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_LABELS[s]} <span className="opacity-70">({counts[s]})</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <PackageCheck className="h-10 w-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-slate-400">No sales need delivery yet.</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Add a delivery address when creating a sale to see it here.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800/50 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Sale</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Driver</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {rows.map(({ sale, delivery }) => {
                  const mapsUrl = mapsUrlFor(sale);
                  return (
                    <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">{sale.sale_id}</td>
                      <td className="px-4 py-3">
                        <p className="text-gray-800 dark:text-slate-200">{sale.customer_name}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{sale.phone}</p>
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-gray-600 dark:text-slate-300">{sale.delivery_address || '—'}</span>
                          {mapsUrl && (
                            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 shrink-0" title="Open in Maps">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="input py-1.5 text-sm"
                          value={delivery?.delivery_driver_id ?? ''}
                          onChange={(e) => handleAssign(sale.id, e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>{d.username}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {delivery ? (
                          <select
                            className={`badge border-0 cursor-pointer ${STATUS_STYLES[delivery.status]}`}
                            value={delivery.status}
                            onChange={(e) => handleStatusChange(delivery.id, e.target.value as DeliveryStatus)}
                          >
                            {DELIVERY_STATUSES.map((s) => (
                              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="badge bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400">
                            <CircleDot className="h-3 w-3" /> Not assigned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs">
                        {delivery ? formatDateTime(delivery.updated_at) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
