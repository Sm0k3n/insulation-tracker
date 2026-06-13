'use client';

import React, { useState } from 'react';
import type { InventoryItem, POJob, Transfer, User } from '@/lib/types';
import { itemTitle, itemSummary, newId, makeTransaction } from '@/lib/util';
import { usePersistedState } from '@/lib/persistence';

interface TransfersProps {
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  currentUser: User;
  addTransaction: (tx: Parameters<typeof makeTransaction>[0]) => void;
}

export default function Transfers({ inventory, setInventory, currentUser, addTransaction }: TransfersProps) {
  const [transfers, setTransfers] = usePersistedState<Transfer[]>('insultrack-transfers', []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fromPO: '', toPO: '', itemId: '', quantity: 0 });

  const sourceOptions = inventory.filter(i => !form.fromPO || i.poNumber === form.fromPO);

  const submitTransfer = () => {
    const sourceItem = inventory.find(i => i.id === form.itemId);
    if (!sourceItem || !form.toPO || form.quantity <= 0) return;
    const newTransfer: Transfer = {
      id: newId('tr'),
      fromPO: sourceItem.poNumber,
      toPO: form.toPO,
      materialSummary: itemSummary(sourceItem),
      itemId: sourceItem.id,
      quantity: form.quantity,
      status: 'Pending',
      requestedBy: currentUser.name,
      createdAt: new Date().toISOString(),
    };
    setTransfers([newTransfer, ...transfers]);
    setForm({ fromPO: '', toPO: '', itemId: '', quantity: 0 });
    setShowForm(false);
  };

  const completeTransfer = (t: Transfer) => {
    if (!t.itemId) return;
    const src = inventory.find(i => i.id === t.itemId);
    if (!src || src.quantity < t.quantity) {
      alert('Not enough material to transfer.');
      return;
    }

    const now = new Date().toISOString();
    setInventory(prev => {
      // deduct from source
      const next = prev.map(i =>
        i.id === src.id ? { ...i, quantity: i.quantity - t.quantity, updatedAt: now, updatedBy: currentUser.name } : i,
      );
      // add to destination — either bump matching item or create new
      const dest = next.find(i => i.poNumber === t.toPO && i.category === src.category && itemTitle(i) === itemTitle(src));
      if (dest) {
        return next.map(i => (i.id === dest.id ? { ...i, quantity: i.quantity + t.quantity, updatedAt: now, updatedBy: currentUser.name } : i));
      }
      return [
        ...next,
        {
          ...src,
          id: newId('i'),
          poNumber: t.toPO,
          quantity: t.quantity,
          status: 'Picked Up',
          reservedBy: undefined,
          updatedAt: now,
          updatedBy: currentUser.name,
        },
      ];
    });

    setTransfers(prev => prev.map(x => (x.id === t.id ? { ...x, status: 'Completed' } : x)));

    addTransaction({
      poNumber: src.poNumber, itemId: src.id, user: currentUser.name,
      action: 'transferred-out', materialSummary: t.materialSummary, quantity: t.quantity,
      toPO: t.toPO,
    });
    addTransaction({
      poNumber: t.toPO, user: currentUser.name,
      action: 'transferred-in', materialSummary: t.materialSummary, quantity: t.quantity,
    });
  };

  return (
    <div>
      <div className="flex justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Transfers</h1>
          <p className="text-sm text-zinc-400">Move material between jobs</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-emerald-600 px-4 py-2 rounded-xl text-sm">+ New Transfer</button>
      </div>

      {showForm && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6 space-y-3">
          <select
            value={form.fromPO}
            onChange={e => setForm({ ...form, fromPO: e.target.value, itemId: '' })}
            className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm"
          >
            <option value="">From PO# …</option>
            {Array.from(new Set(inventory.map(i => i.poNumber))).map(po => (
              <option key={po} value={po}>{po}</option>
            ))}
          </select>

          <select
            value={form.itemId}
            onChange={e => setForm({ ...form, itemId: e.target.value })}
            className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm"
            disabled={!form.fromPO}
          >
            <option value="">Pick material…</option>
            {sourceOptions.map(i => (
              <option key={i.id} value={i.id}>{itemTitle(i)} — {i.quantity} {i.unit}</option>
            ))}
          </select>

          <input
            placeholder="To PO#"
            value={form.toPO}
            onChange={e => setForm({ ...form, toPO: e.target.value })}
            className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm"
          />

          <input
            type="number"
            placeholder="Quantity"
            value={form.quantity || ''}
            onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })}
            className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm"
          />

          <button onClick={submitTransfer} className="w-full bg-emerald-600 py-3 rounded-2xl text-sm font-medium">
            Request Transfer
          </button>
        </div>
      )}

      <div className="space-y-3">
        {transfers.map(t => (
          <div key={t.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{t.fromPO} → {t.toPO}</div>
                <div className="text-sm text-zinc-300">{t.materialSummary} × {t.quantity}</div>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-sm ${t.status === 'Completed' ? 'text-emerald-400' : 'text-amber-400'}`}>{t.status}</div>
                <div className="text-xs text-zinc-500">{t.requestedBy}</div>
              </div>
            </div>

            {t.status === 'Pending' && (
              <button onClick={() => completeTransfer(t)} className="mt-4 w-full bg-emerald-600 py-2 rounded-xl text-sm font-medium">
                Complete Transfer
              </button>
            )}
          </div>
        ))}

        {transfers.length === 0 && <div className="text-zinc-500 text-sm text-center py-10">No transfers yet.</div>}
      </div>
    </div>
  );
}
