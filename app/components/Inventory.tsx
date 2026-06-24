'use client';

import React, { useMemo, useState } from 'react';
import type { InventoryItem, InventoryStatus, MaterialCategory, POJob, User } from '@/lib/types';
import { INVENTORY_STATUSES, MATERIAL_CATEGORIES } from '@/lib/types';
import { itemTitle, itemSubtitle, itemSummary, statusClass, relativeTime, newId } from '@/lib/util';
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
  const [addOpen, setAddOpen] = useState(false);

  const isForeman = currentUser.role === 'Foreman';
  const isAdmin = currentUser.role === 'Admin';
  const isDriver = currentUser.role === 'Delivery Driver';
  const warehousePONumbers = useMemo(
    () => new Set(pos.filter(p => p.type === 'warehouse').map(p => p.poNumber)),
    [pos],
  );
  const isWarehousePO = (poNumber: string) => warehousePONumbers.has(poNumber);
  const canEditItem = (item: InventoryItem) =>
    isAdmin ||
    (isForeman && (!currentUser.assignedPO || item.poNumber === currentUser.assignedPO)) ||
    (isDriver && isWarehousePO(item.poNumber));

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

  const canAddStock = isAdmin || isDriver;
  const warehouses = useMemo(() => pos.filter(p => p.type === 'warehouse'), [pos]);

  const addStock = (draft: NewStockDraft) => {
    const now = new Date().toISOString();
    const item: InventoryItem = {
      id: newId('i'),
      poNumber: draft.poNumber,
      category: draft.category,
      status: 'Available for Pickup',
      quantity: draft.quantity,
      unit: draft.unit,
      notes: draft.notes || undefined,
      updatedAt: now,
      updatedBy: currentUser.name,
      specs: draft.specs,
    };
    setInventory(prev => [item, ...prev]);
    addTransaction({
      poNumber: item.poNumber,
      itemId: item.id,
      user: currentUser.name,
      action: 'added',
      materialSummary: itemSummary(item),
      quantity: item.quantity,
      toStatus: 'Available for Pickup',
      notes: `Added to ${item.poNumber}`,
    });
    setAddOpen(false);
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
                : isDriver
                  ? 'Warehouse stock · edit warehouse, dispatch to jobsites'
                  : 'Read-only view'}
          </p>
        </div>
        <div className="flex gap-2 shrink-0 mt-1">
          {canAddStock && warehouses.length > 0 && (
            <button
              onClick={() => setAddOpen(true)}
              className="text-xs bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 rounded-full"
            >
              + Add Stock
            </button>
          )}
          {visible.length > 0 && (
            <button
              onClick={exportCSV}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-full"
            >
              ⬇ Export CSV
            </button>
          )}
        </div>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search size, material, PO#…"
        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-sm mb-3 focus:outline-none focus:border-emerald-600"
      />

      <FilterRow
        label="Location"
        value={filterPO}
        onChange={setFilterPO}
        options={[
          'all',
          ...pos.filter(p => p.type === 'warehouse').map(p => p.poNumber),
          ...pos.filter(p => p.type !== 'warehouse').map(p => p.poNumber),
        ]}
        renderLabel={opt =>
          opt === 'all' ? 'All' : isWarehousePO(opt) ? `🏭 ${opt}` : opt
        }
      />
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
                    <div className={`font-semibold ${isWarehousePO(item.poNumber) ? 'text-amber-300' : 'text-emerald-400'}`}>
                      {isWarehousePO(item.poNumber) ? `🏭 ${item.poNumber}` : item.poNumber}
                    </div>
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

      {addOpen && (
        <AddStockModal
          warehouses={warehouses}
          onClose={() => setAddOpen(false)}
          onSubmit={addStock}
        />
      )}
    </div>
  );
}

type NewStockDraft = {
  poNumber: string;
  category: MaterialCategory;
  quantity: number;
  unit: string;
  notes: string;
  specs: InventoryItem['specs'];
};

function AddStockModal({
  warehouses,
  onClose,
  onSubmit,
}: {
  warehouses: POJob[];
  onClose: () => void;
  onSubmit: (draft: NewStockDraft) => void;
}) {
  const [poNumber, setPoNumber] = useState(warehouses[0]?.poNumber ?? '');
  const [category, setCategory] = useState<MaterialCategory>('Pipe Insulation');
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState('pcs');
  const [notes, setNotes] = useState('');
  // Spec fields — only the ones relevant to the selected category get used.
  const [materialType, setMaterialType] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [pipeSize, setPipeSize] = useState('');
  const [thickness, setThickness] = useState('');
  const [length, setLength] = useState('');
  const [jacketType, setJacketType] = useState('');
  const [fittingType, setFittingType] = useState('');
  const [width, setWidth] = useState('');
  const [gauge, setGauge] = useState('');
  const [productName, setProductName] = useState('');

  const submit = () => {
    if (!poNumber || quantity <= 0) return;
    const specs: InventoryItem['specs'] = {};
    if (materialType) specs.materialType = materialType;
    if (manufacturer) specs.manufacturer = manufacturer;
    if (pipeSize) specs.pipeSize = pipeSize;
    if (thickness) specs.insulationThickness = thickness;
    if (length) specs.length = length;
    if (jacketType) specs.jacketType = jacketType;
    if (fittingType) specs.fittingType = fittingType;
    if (width) specs.width = width;
    if (gauge) specs.gauge = gauge;
    if (productName) specs.productName = productName;
    onSubmit({ poNumber, category, quantity, unit, notes, specs });
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Add Stock to Warehouse</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl leading-none">×</button>
        </div>

        <Field label="Location">
          <select value={poNumber} onChange={e => setPoNumber(e.target.value)} className={inputClass}>
            {warehouses.map(w => <option key={w.id} value={w.poNumber}>🏭 {w.poNumber}</option>)}
          </select>
        </Field>

        <Field label="Category">
          <select value={category} onChange={e => setCategory(e.target.value as MaterialCategory)} className={inputClass}>
            {MATERIAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Quantity">
            <input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Unit">
            <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="pcs / rolls / tubes" className={inputClass} />
          </Field>
        </div>

        {category === 'Pipe Insulation' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Material"><input value={materialType} onChange={e => setMaterialType(e.target.value)} placeholder="Fiberglass" className={inputClass} /></Field>
              <Field label="Manufacturer"><input value={manufacturer} onChange={e => setManufacturer(e.target.value)} placeholder="Owens Corning" className={inputClass} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Pipe size"><input value={pipeSize} onChange={e => setPipeSize(e.target.value)} placeholder='2"' className={inputClass} /></Field>
              <Field label="Thickness"><input value={thickness} onChange={e => setThickness(e.target.value)} placeholder='2"' className={inputClass} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Length"><input value={length} onChange={e => setLength(e.target.value)} placeholder="3 ft" className={inputClass} /></Field>
              <Field label="Jacket"><input value={jacketType} onChange={e => setJacketType(e.target.value)} placeholder="ASJ / FSK / None" className={inputClass} /></Field>
            </div>
          </>
        )}

        {category === 'Fitting Cover' && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Fitting type"><input value={fittingType} onChange={e => setFittingType(e.target.value)} placeholder="PVC 90 / Tee" className={inputClass} /></Field>
            <Field label="Pipe size"><input value={pipeSize} onChange={e => setPipeSize(e.target.value)} placeholder='2"' className={inputClass} /></Field>
          </div>
        )}

        {category === 'Duct Wrap' && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Thickness"><input value={thickness} onChange={e => setThickness(e.target.value)} placeholder='1.5"' className={inputClass} /></Field>
            <Field label="Width"><input value={width} onChange={e => setWidth(e.target.value)} placeholder='48"' className={inputClass} /></Field>
          </div>
        )}

        {category === 'Jacketing' && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Material"><input value={materialType} onChange={e => setMaterialType(e.target.value)} placeholder="Aluminum" className={inputClass} /></Field>
            <Field label="Gauge"><input value={gauge} onChange={e => setGauge(e.target.value)} placeholder='0.016"' className={inputClass} /></Field>
          </div>
        )}

        {(category === 'Consumable' || category === 'Equipment') && (
          <Field label="Product name">
            <input value={productName} onChange={e => setProductName(e.target.value)} placeholder="ASJ Tape 3&quot; / Baker Scaffold" className={inputClass} />
          </Field>
        )}

        <Field label="Notes (optional)">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputClass} />
        </Field>

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 bg-zinc-800 hover:bg-zinc-700 rounded-2xl py-2.5 text-sm">Cancel</button>
          <button
            onClick={submit}
            disabled={!poNumber || quantity <= 0}
            className="flex-1 bg-emerald-700 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-500 rounded-2xl py-2.5 text-sm font-medium"
          >
            Add Stock
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-600';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function FilterRow<T extends string>({
  label,
  value,
  onChange,
  options,
  compact = false,
  renderLabel,
}: {
  label: string;
  value: T | 'all';
  onChange: (v: any) => void;
  options: (T | 'all')[];
  compact?: boolean;
  renderLabel?: (opt: T | 'all') => string;
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
            {renderLabel ? renderLabel(opt) : opt === 'all' ? 'All' : opt}
          </button>
        ))}
      </div>
    </div>
  );
}
