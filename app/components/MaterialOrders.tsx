'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type {
  InventoryItem,
  MaterialCategory,
  MaterialOrder,
  OrderStatus,
  POJob,
  User,
} from '@/lib/types';
import { MATERIAL_CATEGORIES } from '@/lib/types';
import { newId, makeTransaction, relativeTime } from '@/lib/util';
import { STATUS_TONE, transitionOrder, fulfillDelivery } from '@/lib/orders';
import { downloadCSV, todayStamp, toCSV } from '@/lib/csv';

interface MaterialOrdersProps {
  orders: MaterialOrder[];
  setOrders: React.Dispatch<React.SetStateAction<MaterialOrder[]>>;
  pos: POJob[];
  currentUser: User;
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  addTransaction: (tx: Parameters<typeof makeTransaction>[0]) => void;
}

interface LineDraft {
  summary: string;
  quantity: number;
  unit: string;
  category: MaterialCategory;
}

const PRIORITIES: MaterialOrder['priority'][] = ['Low', 'Normal', 'High', 'Critical'];
const UNITS = ['pcs', 'rolls', 'tubes', 'units', 'bundles', 'boxes'];

export default function MaterialOrders({
  orders,
  setOrders,
  pos,
  currentUser,
  inventory,
  setInventory,
  addTransaction,
}: MaterialOrdersProps) {
  const isAdmin = currentUser.role === 'Admin';
  const isForeman = currentUser.role === 'Foreman';
  const isDriver = currentUser.role === 'Delivery Driver';

  const activePOs = useMemo(() => pos.filter(p => p.status !== 'Completed'), [pos]);
  const defaultPO =
    activePOs.find(p => p.poNumber === currentUser.assignedPO)?.poNumber ?? activePOs[0]?.poNumber ?? '';

  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all');

  const blankLine = (): LineDraft => ({ summary: '', quantity: 0, unit: 'pcs', category: 'Pipe Insulation' });
  const blankForm = () => {
    const dest = activePOs.find(p => p.poNumber === defaultPO);
    return {
      poNumber: defaultPO,
      neededByDate: new Date().toISOString().slice(0, 10),
      neededByTime: '',
      priority: 'Normal' as MaterialOrder['priority'],
      lines: [blankLine()],
      deliveryAddress: dest?.address ?? '',
      contactPerson: dest?.contactName ?? '',
      notes: '',
    };
  };
  const [form, setForm] = useState(blankForm);

  const onPOChange = (poNumber: string) => {
    const dest = activePOs.find(p => p.poNumber === poNumber);
    setForm(f => ({
      ...f,
      poNumber,
      deliveryAddress: dest?.address ?? f.deliveryAddress,
      contactPerson: dest?.contactName ?? f.contactPerson,
    }));
  };

  const submitOrder = () => {
    if (!form.poNumber || !form.neededByDate) return;
    const validLines = form.lines.filter(l => l.summary.trim() && l.quantity > 0);
    if (validLines.length === 0) return;

    const now = new Date().toISOString();
    const order: MaterialOrder = {
      id: newId('ord'),
      poNumber: form.poNumber,
      requestedBy: currentUser.name,
      neededByDate: form.neededByDate,
      neededByTime: form.neededByTime || undefined,
      priority: form.priority,
      items: validLines.map(l => ({
        summary: l.summary.trim(),
        quantity: l.quantity,
        unit: l.unit,
        category: l.category,
      })),
      notes: form.notes || undefined,
      deliveryAddress: form.deliveryAddress || undefined,
      contactPerson: form.contactPerson || undefined,
      status: 'Submitted',
      createdAt: now,
      history: [{ status: 'Submitted', by: currentUser.name, at: now }],
    };
    setOrders(prev => [order, ...prev]);
    setForm(blankForm());
    setShowForm(false);
  };

  const advanceOrder = (order: MaterialOrder, next: OrderStatus) => {
    const updated = transitionOrder(order, next, currentUser);
    setOrders(prev => prev.map(o => (o.id === order.id ? updated : o)));

    // On Delivered: apply inventory + transactions
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

  const visible = useMemo(() => {
    return orders.filter(o => {
      if (filterStatus !== 'all' && o.status !== filterStatus) return false;
      // Drivers see only orders relevant to them (Scheduled w/o driver, or assigned to them, or Delivered)
      if (isDriver) {
        if (o.status === 'Scheduled' && !o.driverId) return true;
        if (o.driverId === currentUser.id) return true;
        return false;
      }
      return true;
    });
  }, [orders, filterStatus, isDriver, currentUser.id]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Material Orders</h1>
          <p className="text-sm text-zinc-400">
            {isDriver ? 'Available + your assigned runs' : 'Request, approve, dispatch'}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {visible.length > 0 && (
            <button
              onClick={() => {
                const rows = visible.map(o => ({
                  id: o.id,
                  poNumber: o.poNumber,
                  sourcePO: o.sourcePO ?? '',
                  requestedBy: o.requestedBy,
                  status: o.status,
                  priority: o.priority,
                  neededByDate: o.neededByDate,
                  neededByTime: o.neededByTime ?? '',
                  items: o.items.map(i => `${i.quantity} ${i.unit} ${i.summary}`).join('; '),
                  deliveryAddress: o.deliveryAddress ?? '',
                  contactPerson: o.contactPerson ?? '',
                  driverName: o.driverName ?? '',
                  notes: o.notes ?? '',
                  createdAt: o.createdAt,
                }));
                downloadCSV(`orders-${todayStamp()}.csv`, toCSV(rows));
              }}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-xl"
            >
              ⬇ CSV
            </button>
          )}
          {(isForeman || isAdmin) && (
            <button
              onClick={() => setShowForm(s => !s)}
              className="bg-emerald-600 px-4 py-2 rounded-xl text-sm"
            >
              {showForm ? 'Close' : '+ New Order'}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500">Destination PO</label>
              <select
                value={form.poNumber}
                onChange={e => onPOChange(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 mt-1 text-sm"
              >
                {activePOs.map(p => (
                  <option key={p.id} value={p.poNumber}>{p.poNumber}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value as MaterialOrder['priority'] })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 mt-1 text-sm"
              >
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500">Needed by date</label>
              <input
                type="date"
                value={form.neededByDate}
                onChange={e => setForm({ ...form, neededByDate: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 mt-1 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500">Needed by time</label>
              <input
                type="time"
                value={form.neededByTime}
                onChange={e => setForm({ ...form, neededByTime: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 mt-1 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-zinc-500">Delivery address</label>
            <input
              value={form.deliveryAddress}
              onChange={e => setForm({ ...form, deliveryAddress: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 mt-1 text-sm"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-zinc-500">Contact on site</label>
            <input
              value={form.contactPerson}
              onChange={e => setForm({ ...form, contactPerson: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 mt-1 text-sm"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 block">
              Items needed
            </label>
            {form.lines.map((line, idx) => (
              <div key={idx} className="bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 mb-2 space-y-2">
                <input
                  placeholder='Material (e.g. 2" Fiberglass × 2")'
                  value={line.summary}
                  onChange={e => {
                    const next = [...form.lines];
                    next[idx] = { ...next[idx], summary: e.target.value };
                    setForm({ ...form, lines: next });
                  }}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    placeholder="Qty"
                    value={line.quantity || ''}
                    onChange={e => {
                      const next = [...form.lines];
                      next[idx] = { ...next[idx], quantity: parseInt(e.target.value) || 0 };
                      setForm({ ...form, lines: next });
                    }}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
                  />
                  <select
                    value={line.unit}
                    onChange={e => {
                      const next = [...form.lines];
                      next[idx] = { ...next[idx], unit: e.target.value };
                      setForm({ ...form, lines: next });
                    }}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-sm"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <select
                    value={line.category}
                    onChange={e => {
                      const next = [...form.lines];
                      next[idx] = { ...next[idx], category: e.target.value as MaterialCategory };
                      setForm({ ...form, lines: next });
                    }}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-sm"
                  >
                    {MATERIAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {form.lines.length > 1 && (
                  <button
                    onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) })}
                    className="text-[11px] text-rose-400"
                  >
                    Remove line
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => setForm({ ...form, lines: [...form.lines, blankLine()] })}
              className="text-emerald-400 text-sm"
            >
              + Add another item
            </button>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-zinc-500">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 mt-1 text-sm h-20"
              placeholder="Access notes, urgency, special handling…"
            />
          </div>

          <button
            onClick={submitOrder}
            className="w-full bg-emerald-600 py-3 rounded-2xl font-medium text-sm"
          >
            Submit Order
          </button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['all', 'Submitted', 'Approved', 'Scheduled', 'Accepted by Driver', 'Loaded', 'En Route', 'Delivered', 'Cancelled'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-[11px] whitespace-nowrap border ${
              filterStatus === s ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-300'
            }`}
          >
            {s === 'all' ? 'All' : s}
            <span className="ml-1.5 opacity-70">
              ({s === 'all' ? orders.length : orders.filter(o => o.status === s).length})
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map(o => (
          <OrderCard
            key={o.id}
            order={o}
            currentUser={currentUser}
            onAdvance={next => advanceOrder(o, next)}
          />
        ))}
        {visible.length === 0 && (
          <div className="text-center py-10 text-zinc-500 text-sm">
            {orders.length === 0 ? 'No orders yet.' : 'No orders match this filter.'}
          </div>
        )}
      </div>
    </div>
  );
}

function nextActions(order: MaterialOrder, user: User): OrderStatus[] {
  const role = user.role;
  if (order.status === 'Cancelled' || order.status === 'Delivered') return [];
  const actions: OrderStatus[] = [];
  if (role === 'Admin') {
    if (order.status === 'Submitted') actions.push('Approved');
    if (order.status === 'Approved') actions.push('Scheduled');
    actions.push('Cancelled');
  }
  if (role === 'Delivery Driver') {
    if (order.status === 'Scheduled' && !order.driverId) actions.push('Accepted by Driver');
    if (order.driverId === user.id) {
      if (order.status === 'Accepted by Driver') actions.push('Loaded');
      if (order.status === 'Loaded') actions.push('En Route');
      if (order.status === 'En Route') actions.push('Delivered');
    }
  }
  if (role === 'Foreman') {
    // requester can cancel their own pre-approval orders
    if (order.requestedBy === user.name && order.status === 'Submitted') actions.push('Cancelled');
  }
  return actions;
}

function OrderCard({
  order,
  currentUser,
  onAdvance,
}: {
  order: MaterialOrder;
  currentUser: User;
  onAdvance: (next: OrderStatus) => void;
}) {
  const actions = nextActions(order, currentUser);
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
      <div className="flex justify-between items-start gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/po/?n=${encodeURIComponent(order.poNumber)}`}
              className="font-semibold text-emerald-400 hover:underline"
            >
              {order.poNumber}
            </Link>
            {order.sourcePO && (
              <span className="text-xs text-zinc-400">← {order.sourcePO}</span>
            )}
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
            Needed {order.neededByDate}
            {order.neededByTime ? ` · ${order.neededByTime}` : ''}
            {' · req by '}{order.requestedBy}
          </div>
        </div>
        <div className="text-[10px] text-zinc-500 shrink-0 text-right">
          {relativeTime(order.createdAt)}
          {order.driverName && <div>👤 {order.driverName}</div>}
        </div>
      </div>

      <div className="text-sm space-y-1 mt-2">
        {order.items.map((it, i) => (
          <div key={i} className="text-zinc-200">
            · {it.quantity} {it.unit} <span className="text-zinc-400">·</span> {it.summary}
            {it.category && <span className="text-[10px] text-zinc-500 ml-1.5">[{it.category}]</span>}
          </div>
        ))}
      </div>

      {(order.deliveryAddress || order.contactPerson) && (
        <div className="text-xs text-zinc-500 mt-2.5 space-y-0.5">
          {order.deliveryAddress && <div>📍 {order.deliveryAddress}</div>}
          {order.contactPerson && <div>📞 {order.contactPerson}</div>}
        </div>
      )}
      {order.notes && <div className="text-xs text-amber-300 mt-2">{order.notes}</div>}

      {actions.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-4 pt-4 border-t border-zinc-800">
          {actions.map(a => (
            <button
              key={a}
              onClick={() => onAdvance(a)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium ${
                a === 'Cancelled'
                  ? 'bg-rose-900 hover:bg-rose-800 text-rose-200'
                  : a === 'Delivered'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-zinc-800 hover:bg-zinc-700'
              }`}
            >
              → {a}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
