'use client';

import React, { useMemo, useState } from 'react';
import type { InventoryItem, InventoryStatus, MaterialCategory, POJob, User } from '@/lib/types';
import { INVENTORY_STATUSES, MATERIAL_CATEGORIES } from '@/lib/types';
import { itemTitle, itemSubtitle, itemSummary, statusClass, relativeTime } from '@/lib/util';
import { makeTransaction } from '@/lib/util';
import { downloadCSV, todayStamp, toCSV } from '@/lib/csv';

interface InventoryProps {
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  pos: POJob[];
  currentUser: User;
  addTransaction: (tx: Parameters<typeof makeTransaction>[0]) => void;
}

const CATEGORY_TONE: Record<MaterialCategory, string> = {
  'Pipe Insulation': 'bg-cyan-950 text-cyan-300 border-cyan-800',
  'Fitting Cover':   'bg-violet-950 text-violet-300 border-violet-800',
  'Duct Wrap':       'bg-sky-950 text-sky-300 border-sky-800',
  'Jacketing':       'bg-amber-950 text-amber-300 border-amber-800',
  'Consumable':      'bg-zinc-800 text-zinc-300 border-zinc-700',
  'Equipment':       'bg-rose-950 text-rose-300 border-rose-800',
};

export default function Inventory({ inventory, setInventory, pos, currentUser, addTransaction }: InventoryProps) {
  const [filterPO, setFilterPO] = useState<string | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<MaterialCategory | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<InventoryStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const isForeman = currentUser.role === 'Foreman';
  const isAdmin = currentUser.role === 'Admin';
  const canEditItem = (item: InventoryItem) =>
    isAdmin || (isForeman && (!currentUser.assignedPO || item.poNumber === currentUser.assignedPO));

  const visible = useMemo(() => {
    return inventory.filter(item => {
      if (filterPO !== 'all' && item.poNumber !== filterPO) return false;
      if (filterCategory !== 'all' && item.category !== filterCategory) return false;
      if (filterStatus !== 'all' && item.status !== filterStatus) return false;
      if (search) {
        const blob = `${item.poNumber} ${itemTitle(item)} ${itemSubtitle(item)} ${item.category}`.toLowerCase();
        if (!blob.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [inventory, filterPO, filterCategory, filterStatus, search]);

  const changeStatus = (item: InventoryItem, next: InventoryStatus) => {
    if (next === item.status) return;
    if (!canEditItem(item)) return;
    setInventory(prev => prev.map(i => (i.id === item.id ? { ...i, status: next, updatedAt: new Date().toISOString(), updatedBy: currentUser.name } : i)));
    addTransaction({
      poNumber: item.poNumber,
      itemId: item.id,
      user: currentUser.name,
      action:
        next === 'Available for Pickup' ? 'marked-available' :
        next === 'Damaged'              ? 'marked-damaged' :
        next === 'Missing'              ? 'marked-missing' :
        next === 'Reserved'             ? 'reserved' :
                                          'status-changed',
      materialSummary: itemSummary(item),
      quantity: item.quantity,
      fromStatus: item.status,
      toStatus: next,
    });
  };

  const exportCSV = () => {
    const rows = visible.map(i => ({
      poNumber: i.poNumber,
      category: i.category,
      status: i.status,
      title: itemTitle(i),
      subtitle: itemSubtitle(i),
      quantity: i.quantity,
      unit: i.unit,
      materialType: i.specs?.materialType ?? '',
      manufacturer: i.specs?.manufacturer ?? '',
      pipeSize: i.specs?.pipeSize ?? '',
      thickness: i.specs?.insulationThickness ?? '',
      length: i.specs?.length ?? '',
      jacketType: i.specs?.jacketType ?? '',
      fittingType: i.specs?.fittingType ?? '',
      width: i.specs?.width ?? '',
      gauge: i.specs?.gauge ?? '',
      productName: i.specs?.productName ?? '',
      reservedBy: i.reservedBy ?? '',
      destinationPO: i.destinationPO ?? '',
      updatedAt: i.updatedAt,
      updatedBy: i.updatedBy,
      notes: i.notes ?? '',
    }));
    downloadCSV(`inventory-${todayStamp()}.csv`, toCSV(rows));
  };

  return (
    <div>
      <div className="mb-4 flex justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="text-sm text-zinc-400">
            {isForeman && currentUser.assignedPO
              ? `Editing enabled for ${currentUser.assignedPO}`
              : isAdmin
                ? 'All sites · edit any'
                : 'Read-only view'}
          </p>
        </div>
        {visible.length > 0 && (
          <button
            onClick={exportCSV}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-full shrink-0 mt-1"
          >
            ⬇ Export CSV
          </button>
        )}
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search size, material, PO#…"
        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-sm mb-3 focus:outline-none focus:border-emerald-600"
      />

      <FilterRow label="PO" value={filterPO} onChange={setFilterPO} options={['all', ...pos.map(p => p.poNumber)]} />
      <FilterRow label="Category" value={filterCategory} onChange={setFilterCategory} options={['all', ...MATERIAL_CATEGORIES]} />
      <FilterRow label="Status" value={filterStatus} onChange={setFilterStatus} options={['all', ...INVENTORY_STATUSES]} compact />

      <div className="mt-4 text-xs text-zinc-500">{visible.length} of {inventory.length} items</div>

      <div className="space-y-3 mt-2">
        {visible.map(item => {
          const editable = canEditItem(item);
          return (
            <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold text-emerald-400">{item.poNumber}</div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${CATEGORY_TONE[item.category]}`}>
                      {item.category}
                    </span>
                  </div>
                  <div className="text-base mt-1.5">{itemTitle(item)}</div>
                  {itemSubtitle(item) && (
                    <div className="text-xs text-zinc-500 mt-0.5">{itemSubtitle(item)}</div>
                  )}
                  <div className="text-sm text-zinc-400 mt-1.5">
                    {item.quantity} {item.unit} · updated {relativeTime(item.updatedAt)} by {item.updatedBy}
                  </div>
                  {item.notes && <div className="text-xs text-amber-300 mt-1">⚠️ {item.notes}</div>}
                  {item.reservedBy && <div className="text-xs text-cyan-300 mt-1">🔒 reserved by {item.reservedBy}</div>}
                </div>

                <div className="shrink-0">
                  {editable ? (
                    <select
                      value={item.status}
                      onChange={e => changeStatus(item, e.target.value as InventoryStatus)}
                      className={`text-[11px] font-medium px-3 py-1.5 rounded-full border focus:outline-none ${statusClass(item.status)}`}
                    >
                      {INVENTORY_STATUSES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  ) : (
                    <div className={`text-[11px] font-medium px-3 py-1.5 rounded-full border ${statusClass(item.status)}`}>
                      {item.status}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {visible.length === 0 && (
          <div className="text-center py-12 text-zinc-500">No matching inventory.</div>
        )}
      </div>
    </div>
  );
}

function FilterRow<T extends string>({
  label,
  value,
  onChange,
  options,
  compact = false,
}: {
  label: string;
  value: T | 'all';
  onChange: (v: any) => void;
  options: (T | 'all')[];
  compact?: boolean;
}) {
  return (
    <div className="mb-2">
      <div className="text-[10px] uppercase tracking-[2px] text-zinc-500 mb-1.5 ml-1">{label}</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-3 ${compact ? 'py-1' : 'py-1.5'} rounded-full text-[11px] whitespace-nowrap border transition-colors ${
              value === opt ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-300'
            }`}
          >
            {opt === 'all' ? 'All' : opt}
          </button>
        ))}
      </div>
    </div>
  );
}
