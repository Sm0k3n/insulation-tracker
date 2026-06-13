'use client';

import React, { useMemo, useState } from 'react';
import type { POJob, Transaction } from '@/lib/types';
import { ACTION_LABEL, relativeTime } from '@/lib/util';
import { downloadCSV, todayStamp, toCSV } from '@/lib/csv';

interface TransactionHistoryProps {
  transactions: Transaction[];
  pos: POJob[];
}

export default function TransactionHistory({ transactions, pos }: TransactionHistoryProps) {
  const [filterPO, setFilterPO] = useState<string | 'all'>('all');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    return transactions.filter(t => {
      if (filterPO !== 'all' && t.poNumber !== filterPO) return false;
      if (search) {
        const blob = `${t.poNumber} ${t.materialSummary} ${t.user} ${ACTION_LABEL[t.action]}`.toLowerCase();
        if (!blob.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [transactions, filterPO, search]);

  const exportCSV = () => {
    const rows = visible.map(t => ({
      timestamp: t.timestamp,
      poNumber: t.poNumber,
      action: ACTION_LABEL[t.action],
      material: t.materialSummary,
      quantity: t.quantity ?? '',
      user: t.user,
      fromStatus: t.fromStatus ?? '',
      toStatus: t.toStatus ?? '',
      toPO: t.toPO ?? '',
      notes: t.notes ?? '',
    }));
    downloadCSV(`transactions-${todayStamp()}.csv`, toCSV(rows));
  };

  return (
    <div>
      <div className="flex justify-between items-start gap-3 mb-1">
        <h1 className="text-2xl font-semibold">Transaction History</h1>
        {visible.length > 0 && (
          <button
            onClick={exportCSV}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-full shrink-0"
          >
            ⬇ Export CSV
          </button>
        )}
      </div>
      <p className="text-sm text-zinc-400 mb-4">Every inventory change. Nothing disappears without a record.</p>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search material, PO, action, user…"
        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-sm mb-3"
      />

      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        {(['all', ...pos.map(p => p.poNumber)] as const).map(opt => (
          <button
            key={opt}
            onClick={() => setFilterPO(opt)}
            className={`px-3 py-1.5 rounded-full text-[11px] whitespace-nowrap border transition-colors ${
              filterPO === opt ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-300'
            }`}
          >
            {opt === 'all' ? 'All' : opt}
          </button>
        ))}
      </div>

      <div className="text-xs text-zinc-500 mb-2">{visible.length} of {transactions.length} entries</div>

      <div className="space-y-2">
        {visible.map(t => (
          <div key={t.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-emerald-400">{t.poNumber}</div>
              <div className="text-[10px] text-zinc-500">{relativeTime(t.timestamp)}</div>
            </div>
            <div className="text-zinc-200 mt-0.5">{ACTION_LABEL[t.action]}</div>
            <div className="text-xs text-zinc-400 mt-0.5">{t.materialSummary}</div>
            <div className="text-[11px] text-zinc-500 mt-1.5 flex items-center justify-between gap-2 flex-wrap">
              <span>by {t.user}</span>
              {t.fromStatus && t.toStatus && (
                <span className="font-mono">{t.fromStatus} → {t.toStatus}</span>
              )}
              {t.toPO && <span className="font-mono">→ {t.toPO}</span>}
            </div>
            {t.notes && <div className="text-[11px] text-amber-300 mt-1">{t.notes}</div>}
          </div>
        ))}

        {visible.length === 0 && <div className="text-center py-10 text-zinc-500">No matching transactions.</div>}
      </div>
    </div>
  );
}
