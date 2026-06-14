'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type {
  InventoryItem,
  MaterialOrder,
  OrderStatus,
  POJob,
  User,
} from '@/lib/types';
import { makeTransaction, relativeTime } from '@/lib/util';
import { STATUS_TONE, transitionOrder, fulfillDelivery } from '@/lib/orders';
import { api } from '@/lib/api';

interface DeliveriesProps {
  orders: MaterialOrder[];
  setOrders: React.Dispatch<React.SetStateAction<MaterialOrder[]>>;
  pos: POJob[];
  currentUser: User;
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  addTransaction: (tx: Parameters<typeof makeTransaction>[0]) => void;
}

const isoToday = () => new Date().toISOString().slice(0, 10);
const isoOffset = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

type Bucket = 'today' | 'tomorrow' | 'thisWeek' | 'later' | 'unassigned';

export default function Deliveries({
  orders,
  setOrders,
  pos,
  currentUser,
  inventory,
  setInventory,
  addTransaction,
}: DeliveriesProps) {
  const isDriver = currentUser.role === 'Delivery Driver';
  const isAdmin = currentUser.role === 'Admin';

  const [drivers, setDrivers] = useState<User[]>([]);
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const r = await api.listUsers();
        setDrivers(r.users.filter(u => u.role === 'Delivery Driver'));
      } catch {
        // ignore
      }
    })();
  }, [isAdmin]);

  const schedulePatch = (
    order: MaterialOrder,
    patch: { driverId?: string; driverName?: string; neededByDate?: string; neededByTime?: string; eta?: string },
  ) => {
    setOrders(prev =>
      prev.map(x => {
        if (x.id !== order.id) return x;
        const shouldPromote =
          patch.driverId && (x.status === 'Submitted' || x.status === 'Approved');
        if (!shouldPromote) return { ...x, ...patch };
        const now = new Date().toISOString();
        const history = [...(x.history || [])];
        if (x.status === 'Submitted') {
          history.push({ status: 'Approved', by: currentUser.name, at: now });
        }
        history.push({ status: 'Scheduled', by: currentUser.name, at: now });
        return { ...x, ...patch, status: 'Scheduled', history };
      }),
    );
  };

  const today = isoToday();
  const tomorrow = isoOffset(1);
  const weekOut = isoOffset(7);

  // In-flight = anything past Approved and not Delivered/Cancelled
  const inFlight = useMemo(
    () =>
      orders.filter(
        o => !['Submitted', 'Delivered', 'Cancelled'].includes(o.status),
      ),
    [orders],
  );

  const driverScope = useMemo(() => {
    if (isDriver) {
      return inFlight.filter(o => !o.driverId || o.driverId === currentUser.id);
    }
    return inFlight;
  }, [inFlight, isDriver, currentUser.id]);

  const buckets = useMemo(() => {
    const out: Record<Bucket, MaterialOrder[]> = {
      unassigned: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
    };
    for (const o of driverScope) {
      if (o.status === 'Scheduled' && !o.driverId) {
        out.unassigned.push(o);
        continue;
      }
      if (o.neededByDate === today) out.today.push(o);
      else if (o.neededByDate === tomorrow) out.tomorrow.push(o);
      else if (o.neededByDate > today && o.neededByDate <= weekOut) out.thisWeek.push(o);
      else out.later.push(o);
    }
    // Sort each by neededByDate + time
    const sort = (a: MaterialOrder, b: MaterialOrder) =>
      (a.neededByDate + (a.neededByTime || '00:00')).localeCompare(
        b.neededByDate + (b.neededByTime || '00:00'),
      );
    Object.values(out).forEach(arr => arr.sort(sort));
    return out;
  }, [driverScope, today, tomorrow, weekOut]);

  const promptForEta = (currentEta?: string): string | undefined => {
    const def = currentEta
      ? new Date(currentEta).toLocaleString()
      : new Date(Date.now() + 30 * 60 * 1000).toLocaleString();
    const input = window.prompt('ETA to destination? (date / time the foreman will see)', def);
    if (!input) return undefined;
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) {
      window.alert('Could not read that date/time. ETA was not updated.');
      return undefined;
    }
    return parsed.toISOString();
  };

  const advanceOrder = (order: MaterialOrder, next: OrderStatus) => {
    let updated = transitionOrder(order, next, currentUser);

    // Ask the driver for ETA when they Accept or go En Route.
    if (next === 'Accepted by Driver' || next === 'En Route') {
      const eta = promptForEta(order.eta);
      if (eta) updated = { ...updated, eta };
    }

    setOrders(prev => prev.map(o => (o.id === order.id ? updated : o)));

    if (next === 'Delivered') {
      setInventory(prev => fulfillDelivery(prev, updated, currentUser.name));
      const summary = order.items.map(i => `${i.summary} × ${i.quantity}`).join(', ');
      addTransaction({
        poNumber: order.poNumber,
        user: currentUser.name,
        action: 'delivered',
        materialSummary: summary,
        notes: order.sourcePO ? `Driver delivered from ${order.sourcePO}` : 'New material delivered',
      });
      if (order.sourcePO) {
        addTransaction({
          poNumber: order.sourcePO,
          user: currentUser.name,
          action: 'transferred-out',
          materialSummary: summary,
          toPO: order.poNumber,
          notes: 'Driver pickup completed',
        });
      }
    }
  };

  const updateEta = (order: MaterialOrder) => {
    const eta = promptForEta(order.eta);
    if (!eta) return;
    setOrders(prev => prev.map(o => (o.id === order.id ? { ...o, eta } : o)));
  };

  const recentlyDelivered = useMemo(
    () => orders.filter(o => o.status === 'Delivered' && o.driverId === currentUser.id).slice(0, 6),
    [orders, currentUser.id],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Deliveries</h1>
        <p className="text-sm text-zinc-400">
          {isDriver ? "Today's runs, tomorrow, this week" : isAdmin ? 'All in-flight runs' : 'Active deliveries across all sites'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SummaryTile label="Today" value={buckets.today.length} tone="amber" />
        <SummaryTile label="Tomorrow" value={buckets.tomorrow.length} tone="emerald" />
        <SummaryTile label="Open" value={inFlight.length} tone="cyan" />
      </div>

      {buckets.unassigned.length > 0 && (
        <BucketSection
          label={isDriver ? '🆓 Available to accept' : '⏳ Awaiting driver acceptance'}
          orders={buckets.unassigned}
          pos={pos}
          currentUser={currentUser}
          drivers={drivers}
          onAdvance={advanceOrder}
          onUpdateEta={updateEta}
          onSchedule={schedulePatch}
        />
      )}

      <BucketSection
        label="🔥 Today"
        orders={buckets.today}
        pos={pos}
        currentUser={currentUser}
        drivers={drivers}
        onAdvance={advanceOrder}
        onUpdateEta={updateEta}
        onSchedule={schedulePatch}
        empty="No runs scheduled for today."
      />
      <BucketSection
        label="📅 Tomorrow"
        orders={buckets.tomorrow}
        pos={pos}
        currentUser={currentUser}
        drivers={drivers}
        onAdvance={advanceOrder}
        onUpdateEta={updateEta}
        onSchedule={schedulePatch}
      />
      {buckets.thisWeek.length > 0 && (
        <BucketSection
          label="🗓️ This week"
          orders={buckets.thisWeek}
          pos={pos}
          currentUser={currentUser}
          drivers={drivers}
          onAdvance={advanceOrder}
          onUpdateEta={updateEta}
          onSchedule={schedulePatch}
        />
      )}
      {buckets.later.length > 0 && (
        <BucketSection
          label="Later"
          orders={buckets.later}
          pos={pos}
          currentUser={currentUser}
          drivers={drivers}
          onAdvance={advanceOrder}
          onUpdateEta={updateEta}
          onSchedule={schedulePatch}
        />
      )}

      {isDriver && recentlyDelivered.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-[2px] text-zinc-500 mb-2">Recently delivered</div>
          <div className="space-y-2">
            {recentlyDelivered.map(o => (
              <div key={o.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <Link href={`/po/?n=${encodeURIComponent(o.poNumber)}`} className="text-emerald-400 font-medium hover:underline">
                    {o.poNumber}
                  </Link>
                  <span className="text-[11px] text-zinc-500">{relativeTime((o.history?.find(h => h.status === 'Delivered')?.at) || o.createdAt)}</span>
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {o.items.map(i => `${i.quantity} ${i.unit} ${i.summary}`).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: 'amber' | 'emerald' | 'cyan' }) {
  const text = { amber: 'text-amber-300', emerald: 'text-emerald-400', cyan: 'text-cyan-300' }[tone];
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
      <div className={`text-2xl font-semibold tracking-tighter ${text}`}>{value}</div>
      <div className="text-[11px] text-zinc-500 mt-0.5">{label}</div>
    </div>
  );
}

interface SchedulePatch {
  driverId?: string;
  driverName?: string;
  neededByDate?: string;
  neededByTime?: string;
  eta?: string;
}

function BucketSection({
  label,
  orders,
  pos,
  currentUser,
  drivers,
  onAdvance,
  onUpdateEta,
  onSchedule,
  empty,
}: {
  label: string;
  orders: MaterialOrder[];
  pos: POJob[];
  currentUser: User;
  drivers: User[];
  onAdvance: (order: MaterialOrder, next: OrderStatus) => void;
  onUpdateEta: (order: MaterialOrder) => void;
  onSchedule: (order: MaterialOrder, patch: SchedulePatch) => void;
  empty?: string;
}) {
  if (orders.length === 0 && !empty) return null;
  return (
    <div>
      <div className="text-xs uppercase tracking-[2px] text-zinc-500 mb-2">{label}</div>
      {orders.length === 0 ? (
        <div className="text-sm text-zinc-600 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
          {empty}
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(o => (
            <DeliveryCard
              key={o.id}
              order={o}
              pos={pos}
              currentUser={currentUser}
              drivers={drivers}
              onAdvance={n => onAdvance(o, n)}
              onUpdateEta={() => onUpdateEta(o)}
              onSchedule={patch => onSchedule(o, patch)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function deliveryActions(order: MaterialOrder, user: User): OrderStatus[] {
  if (user.role !== 'Delivery Driver' && user.role !== 'Admin') return [];
  if (['Cancelled', 'Delivered'].includes(order.status)) return [];
  const actions: OrderStatus[] = [];
  if (user.role === 'Delivery Driver') {
    if (order.status === 'Scheduled' && !order.driverId) actions.push('Accepted by Driver');
    if (order.driverId === user.id) {
      if (order.status === 'Accepted by Driver') actions.push('Loaded');
      if (order.status === 'Loaded') actions.push('En Route');
      if (order.status === 'En Route') actions.push('Delivered');
    }
  }
  if (user.role === 'Admin') {
    if (order.status === 'Submitted') actions.push('Approved');
    if (order.status === 'Approved') actions.push('Scheduled');
  }
  return actions;
}

function DeliveryCard({
  order,
  pos,
  currentUser,
  drivers,
  onAdvance,
  onUpdateEta,
  onSchedule,
}: {
  order: MaterialOrder;
  pos: POJob[];
  currentUser: User;
  drivers: User[];
  onAdvance: (next: OrderStatus) => void;
  onUpdateEta: () => void;
  onSchedule: (patch: SchedulePatch) => void;
}) {
  const destPO = pos.find(p => p.poNumber === order.poNumber);
  const sourcePOJob = order.sourcePO ? pos.find(p => p.poNumber === order.sourcePO) : null;
  const actions = deliveryActions(order, currentUser);
  const isAdmin = currentUser.role === 'Admin';
  const adminCanEdit = isAdmin && !['Delivered', 'Cancelled'].includes(order.status);
  const isMyAssignedRun =
    currentUser.role === 'Delivery Driver' &&
    order.driverId === currentUser.id &&
    !['Delivered', 'Cancelled'].includes(order.status);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    driverId: order.driverId || '',
    neededByDate: order.neededByDate,
    neededByTime: order.neededByTime || '',
    eta: order.eta ? order.eta.slice(0, 16) : '',
  });

  const applyEdits = () => {
    const driver = drivers.find(d => d.id === draft.driverId);
    onSchedule({
      driverId: draft.driverId || undefined,
      driverName: driver?.name || (draft.driverId ? order.driverName : undefined),
      neededByDate: draft.neededByDate,
      neededByTime: draft.neededByTime || undefined,
      eta: draft.eta ? new Date(draft.eta).toISOString() : undefined,
    });
    setEditing(false);
  };

  const openDirectionsToDest = () => {
    const target = destPO
      ? `${destPO.latitude},${destPO.longitude}`
      : encodeURIComponent(order.deliveryAddress || order.poNumber);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${target}`, '_blank', 'noopener,noreferrer');
  };

  const openDirectionsToSource = () => {
    if (!sourcePOJob) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${sourcePOJob.latitude},${sourcePOJob.longitude}`,
      '_blank', 'noopener,noreferrer',
    );
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
      <div className="flex justify-between items-start gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {order.sourcePO && (
              <span className="text-xs text-zinc-400">{order.sourcePO} →</span>
            )}
            <Link
              href={`/po/?n=${encodeURIComponent(order.poNumber)}`}
              className="font-semibold text-emerald-400 hover:underline"
            >
              {order.poNumber}
            </Link>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_TONE[order.status]}`}>
              {order.status}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              order.priority === 'Critical' ? 'bg-rose-950 text-rose-300' :
              order.priority === 'High'     ? 'bg-amber-950 text-amber-300' :
                                              'bg-zinc-800 text-zinc-400'
            }`}>{order.priority}</span>
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            Needed {order.neededByDate}{order.neededByTime ? ` · ${order.neededByTime}` : ''}
            {order.driverName && <span> · 👤 {order.driverName}</span>}
          </div>
          {order.eta && (
            <div className="text-xs mt-1 text-emerald-300">
              ⏱️ ETA {new Date(order.eta).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>

      <div className="text-sm space-y-0.5 mt-2">
        {order.items.map((it, i) => (
          <div key={i} className="text-zinc-200">
            · {it.quantity} {it.unit} · {it.summary}
          </div>
        ))}
      </div>

      {(order.deliveryAddress || order.contactPerson) && (
        <div className="text-xs text-zinc-500 mt-2 space-y-0.5">
          {order.deliveryAddress && <div>📍 {order.deliveryAddress}</div>}
          {order.contactPerson && <div>📞 {order.contactPerson}</div>}
        </div>
      )}
      {order.notes && <div className="text-xs text-amber-300 mt-2">{order.notes}</div>}

      {editing && (
        <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Schedule / reassign</div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-zinc-500">Driver</label>
            <select
              value={draft.driverId}
              onChange={e => setDraft({ ...draft, driverId: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 mt-1 text-sm"
            >
              <option value="">— Unassigned (any driver can accept) —</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.name}{d.phone ? ` · ${d.phone}` : ''}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500">Needed by date</label>
              <input
                type="date"
                value={draft.neededByDate}
                onChange={e => setDraft({ ...draft, neededByDate: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 mt-1 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500">Needed by time</label>
              <input
                type="time"
                value={draft.neededByTime}
                onChange={e => setDraft({ ...draft, neededByTime: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 mt-1 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {([
              ['Today', 0],
              ['Tomorrow', 1],
              ['+3 days', 3],
              ['Next week', 7],
            ] as const).map(([label, offset]) => {
              const d = new Date();
              d.setDate(d.getDate() + offset);
              const iso = d.toISOString().slice(0, 10);
              const active = draft.neededByDate === iso;
              return (
                <button
                  key={label}
                  onClick={() => setDraft({ ...draft, neededByDate: iso })}
                  className={`px-3 py-1 rounded-full text-[11px] border ${
                    active
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-zinc-500">Initial ETA (optional)</label>
            <input
              type="datetime-local"
              value={draft.eta}
              onChange={e => setDraft({ ...draft, eta: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 mt-1 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={applyEdits} className="flex-1 bg-emerald-600 hover:bg-emerald-700 py-2.5 rounded-xl text-sm">Save</button>
            <button onClick={() => setEditing(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-2.5 rounded-xl text-sm">Cancel</button>
          </div>
        </div>
      )}

      {!editing && (
        <div className="flex gap-2 flex-wrap mt-4 pt-4 border-t border-zinc-800">
          {actions.map(a => (
            <button
              key={a}
              onClick={() => onAdvance(a)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium ${
                a === 'Delivered' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-zinc-800 hover:bg-zinc-700'
              }`}
            >
              → {a}
            </button>
          ))}
          {adminCanEdit && (
            <button
              onClick={() => setEditing(true)}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-800"
            >
              📅 Schedule / Reassign
            </button>
          )}
          {isMyAssignedRun && (
            <button
              onClick={onUpdateEta}
              className="px-3.5 py-1.5 rounded-full text-xs bg-zinc-800 hover:bg-zinc-700"
            >
              ⏱️ {order.eta ? 'Update ETA' : 'Set ETA'}
            </button>
          )}
          {sourcePOJob && (
            <button
              onClick={openDirectionsToSource}
              className="px-3.5 py-1.5 rounded-full text-xs bg-zinc-800 hover:bg-zinc-700"
            >
              🧭 To pickup
            </button>
          )}
          <button
            onClick={openDirectionsToDest}
            className="px-3.5 py-1.5 rounded-full text-xs bg-zinc-800 hover:bg-zinc-700"
          >
            🧭 To dest
          </button>
        </div>
      )}
    </div>
  );
}
