'use client';

import React, { useState } from 'react';
import type { DailyReport, InventoryItem, POJob, User } from '@/lib/types';
import { itemTitle, newId, makeTransaction } from '@/lib/util';
import { usePersistedState } from '@/lib/persistence';

interface DailyReportsProps {
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  pos: POJob[];
  currentUser: User;
  addTransaction: (tx: Parameters<typeof makeTransaction>[0]) => void;
}

interface MaterialLine {
  itemId: string;
  quantity: number;
}

export default function DailyReports({ inventory, setInventory, pos, currentUser, addTransaction }: DailyReportsProps) {
  const [reports, setReports] = usePersistedState<DailyReport[]>('insultrac-reports', []);
  const [showForm, setShowForm] = useState(false);
  const [poNumber, setPoNumber] = useState(currentUser.assignedPO || pos[0]?.poNumber || '');
  const [workCompleted, setWorkCompleted] = useState('');
  const [lines, setLines] = useState<MaterialLine[]>([{ itemId: '', quantity: 0 }]);

  const submitReport = () => {
    if (!workCompleted || !poNumber) return;

    const validLines = lines.filter(l => l.itemId && l.quantity > 0);
    const matched = validLines
      .map(l => ({ line: l, item: inventory.find(i => i.id === l.itemId) }))
      .filter((x): x is { line: MaterialLine; item: InventoryItem } => !!x.item);

    const now = new Date().toISOString();

    // Deduct
    if (matched.length > 0) {
      setInventory(prev => prev.map(i => {
        const hit = matched.find(m => m.item.id === i.id);
        if (!hit) return i;
        return { ...i, quantity: Math.max(0, i.quantity - hit.line.quantity), updatedAt: now, updatedBy: currentUser.name };
      }));

      matched.forEach(({ item, line }) => {
        addTransaction({
          poNumber, itemId: item.id, user: currentUser.name,
          action: 'used', materialSummary: `${itemTitle(item)} (${line.quantity} ${item.unit})`,
          quantity: line.quantity,
        });
      });
    }

    const report: DailyReport = {
      id: newId('rep'),
      poNumber,
      date: new Date().toISOString().slice(0, 10),
      submittedBy: currentUser.name,
      workCompleted,
      materialsUsed: matched.map(({ item, line }) => ({
        itemId: item.id,
        summary: itemTitle(item),
        quantity: line.quantity,
        unit: item.unit,
      })),
      submittedAt: now,
    };
    setReports([report, ...reports]);

    setWorkCompleted('');
    setLines([{ itemId: '', quantity: 0 }]);
    setShowForm(false);
  };

  const itemsForPO = inventory.filter(i => i.poNumber === poNumber);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/reports.jpg" alt="" className="h-16 w-auto object-contain mb-2" />
          <h1 className="text-2xl font-semibold">Daily Reports</h1>
          <p className="text-sm text-zinc-400">End-of-day submission · auto-deducts inventory</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-emerald-600 px-4 py-2 rounded-xl text-sm">+ New Report</button>
      </div>

      {showForm && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6 space-y-4">
          <div>
            <label className="text-xs text-zinc-500">PO#</label>
            <select
              value={poNumber}
              onChange={e => setPoNumber(e.target.value)}
              className="w-full bg-zinc-800 rounded-xl px-4 py-3 mt-1 text-sm"
            >
              {pos.map(p => <option key={p.id} value={p.poNumber}>{p.poNumber}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-zinc-500">Work Completed</label>
            <textarea
              value={workCompleted}
              onChange={e => setWorkCompleted(e.target.value)}
              className="w-full bg-zinc-800 rounded-xl px-4 py-3 mt-1 h-20 text-sm"
              placeholder="Installed insulation on…"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-500 mb-2 block">Materials Used</label>
            {lines.map((entry, index) => (
              <div key={index} className="flex gap-3 mb-3">
                <select
                  value={entry.itemId}
                  onChange={e => {
                    const updated = [...lines];
                    updated[index] = { ...updated[index], itemId: e.target.value };
                    setLines(updated);
                  }}
                  className="flex-1 bg-zinc-800 rounded-xl px-3 py-3 text-sm"
                >
                  <option value="">Pick material…</option>
                  {itemsForPO.map(i => (
                    <option key={i.id} value={i.id}>{itemTitle(i)} ({i.quantity} {i.unit} left)</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Qty"
                  value={entry.quantity || ''}
                  onChange={e => {
                    const updated = [...lines];
                    updated[index] = { ...updated[index], quantity: parseInt(e.target.value) || 0 };
                    setLines(updated);
                  }}
                  className="w-24 bg-zinc-800 rounded-xl px-3 py-3 text-sm"
                />
              </div>
            ))}

            <button onClick={() => setLines([...lines, { itemId: '', quantity: 0 }])} className="text-emerald-400 text-sm mt-1">
              + Add Another Material
            </button>
          </div>

          <button onClick={submitReport} className="w-full bg-emerald-600 py-3 rounded-2xl font-medium text-sm">
            Submit Daily Report
          </button>
        </div>
      )}

      <div className="space-y-4">
        {reports.map(r => (
          <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex justify-between">
              <div>
                <div className="font-semibold">{r.poNumber}</div>
                <div className="text-sm text-zinc-400">{r.date} · {r.submittedBy}</div>
              </div>
              <div className="text-emerald-400 text-sm">Submitted</div>
            </div>
            <div className="mt-3 text-sm">
              <div><span className="text-zinc-500">Work:</span> {r.workCompleted}</div>
              <div className="mt-2">
                <div className="text-zinc-500 text-xs mb-1">Materials Used:</div>
                {r.materialsUsed.length === 0 && <div className="ml-2 text-zinc-500 text-xs">None recorded</div>}
                {r.materialsUsed.map((m, i) => (
                  <div key={i} className="ml-2">· {m.quantity} {m.unit} · {m.summary}</div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {reports.length === 0 && <div className="text-zinc-500 text-sm text-center py-10">No reports submitted yet.</div>}
      </div>
    </div>
  );
}
