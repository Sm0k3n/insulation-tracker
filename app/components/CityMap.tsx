'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { InventoryItem, MaterialOrder, POJob, User } from '@/lib/types';
import { itemTitle, itemSubtitle, distanceKm, relativeTime, statusClass, makeTransaction, newId } from '@/lib/util';

const MapComponent = dynamic(() => import('./MapComponent'), { ssr: false });

interface CityMapProps {
  inventory: InventoryItem[];
  pos: POJob[];
  currentUser: User;
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  addTransaction: (tx: Parameters<typeof makeTransaction>[0]) => void;
  orders: MaterialOrder[];
  setOrders: React.Dispatch<React.SetStateAction<MaterialOrder[]>>;
}

type MapMaterial = InventoryItem & {
  address: string;
  latitude: number;
  longitude: number;
  distance: number;
  poJob: POJob;
};

const SPEC_LABELS: Record<string, string> = {
  materialType: 'Material',
  manufacturer: 'Manufacturer',
  productLine: 'Product Line',
  pipeSize: 'Pipe Size',
  insulationThickness: 'Thickness',
  length: 'Length',
  jacketType: 'Jacket',
  fittingType: 'Fitting',
  width: 'Width',
  facingType: 'Facing',
  gauge: 'Gauge',
  productName: 'Product',
  serial: 'Serial',
};

export default function CityMap({ inventory, pos, currentUser, setInventory, addTransaction, setOrders }: CityMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  const [destinationPO, setDestinationPO] = useState<string>('');
  const [pickupMethod, setPickupMethod] = useState<'self' | 'driver'>('self');

  const activePOs = useMemo(() => pos.filter(p => p.status !== 'Completed'), [pos]);

  const referencePO = useMemo(() => {
    if (currentUser.assignedPO) {
      return pos.find(p => p.poNumber === currentUser.assignedPO) || activePOs[0];
    }
    return activePOs[0];
  }, [pos, activePOs, currentUser]);

  // Default the destination picker to the user's assigned PO when available.
  React.useEffect(() => {
    if (!destinationPO && referencePO) setDestinationPO(referencePO.poNumber);
  }, [referencePO, destinationPO]);

  const availableWithMeta: MapMaterial[] = useMemo(() => {
    if (!referencePO) return [];
    return inventory
      .filter(i => i.status === 'Available for Pickup')
      .map(i => {
        const po = pos.find(p => p.poNumber === i.poNumber);
        if (!po) return null;
        return {
          ...i,
          address: po.address,
          latitude: po.latitude,
          longitude: po.longitude,
          distance: distanceKm(referencePO, po),
          poJob: po,
        };
      })
      .filter((x): x is MapMaterial => x !== null)
      .sort((a, b) => a.distance - b.distance);
  }, [inventory, pos, referencePO]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return availableWithMeta.filter(m => {
      if (categoryFilter && m.category !== categoryFilter) return false;
      if (!q) return true;
      const specBlob = Object.values(m.specs).filter(Boolean).join(' ');
      const blob = `${m.poNumber} ${m.category} ${itemTitle(m)} ${itemSubtitle(m)} ${specBlob} ${m.address} ${m.unit} ${m.updatedBy}`.toLowerCase();
      return blob.includes(q);
    });
  }, [availableWithMeta, categoryFilter, searchTerm]);

  // One bucket per PO for the map. Reference PO always shows (even if empty).
  const buckets = useMemo(() => {
    const byPO = new Map<string, InventoryItem[]>();
    for (const m of filtered) {
      const arr = byPO.get(m.poNumber) || [];
      arr.push(m);
      byPO.set(m.poNumber, arr);
    }
    const allPONumbers = new Set<string>(byPO.keys());
    if (referencePO) allPONumbers.add(referencePO.poNumber);
    return Array.from(allPONumbers)
      .map(poNumber => {
        const po = pos.find(p => p.poNumber === poNumber);
        return po ? { po, items: byPO.get(poNumber) || [] } : null;
      })
      .filter((b): b is { po: POJob; items: InventoryItem[] } => !!b);
  }, [filtered, pos, referencePO]);

  const categories = Array.from(new Set(availableWithMeta.map(m => m.category)));
  const selected = filtered.find(m => m.id === selectedId) || null;
  const otherAtSamePO = selected
    ? filtered.filter(m => m.poNumber === selected.poNumber && m.id !== selected.id)
    : [];

  const reserve = (item: MapMaterial) => {
    if (item.status !== 'Available for Pickup') return;
    if (!destinationPO) return;
    if (destinationPO === item.poNumber) {
      setFlash('Destination is the same as source — pick a different PO.');
      setTimeout(() => setFlash(null), 2500);
      return;
    }
    const now = new Date().toISOString();
    const summary = `${itemTitle(item)} (${item.quantity} ${item.unit})`;

    setInventory(prev => prev.map(i =>
      i.id === item.id
        ? {
            ...i,
            status: 'Reserved',
            reservedBy: currentUser.name,
            destinationPO,
            updatedAt: now,
            updatedBy: currentUser.name,
          }
        : i
    ));
    addTransaction({
      poNumber: item.poNumber,
      itemId: item.id,
      user: currentUser.name,
      action: 'reserved',
      materialSummary: summary,
      quantity: item.quantity,
      fromStatus: 'Available for Pickup',
      toStatus: 'Reserved',
      toPO: destinationPO,
      notes:
        pickupMethod === 'driver'
          ? `Delivery requested → ${destinationPO}`
          : `Self-pickup → ${destinationPO}`,
    });

    if (pickupMethod === 'driver') {
      const dest = pos.find(p => p.poNumber === destinationPO);
      const order: MaterialOrder = {
        id: newId('ord'),
        poNumber: destinationPO,
        requestedBy: currentUser.name,
        neededByDate: new Date().toISOString().slice(0, 10),
        priority: 'Normal',
        items: [{ summary: itemTitle(item), quantity: item.quantity, unit: item.unit, category: item.category }],
        notes: `Pickup from ${item.poNumber} (${item.address}) — reserved by ${currentUser.name}`,
        deliveryAddress: dest?.address,
        contactPerson: dest?.contactName,
        status: 'Submitted',
        sourcePO: item.poNumber,
        sourceItemIds: [item.id],
        createdAt: now,
        history: [{ status: 'Submitted', by: currentUser.name, at: now }],
      };
      setOrders(prev => [order, ...prev]);
      setFlash(`✓ Delivery requested — ${item.poNumber} → ${destinationPO}. Awaiting admin approval.`);
    } else {
      setFlash(`✓ Reserved ${itemTitle(item)} for ${destinationPO}. Mark Picked Up when you grab it.`);
    }
    setTimeout(() => setFlash(null), 4000);
    setSelectedId(null);
  };

  const directions = (item: MapMaterial) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setFlash(`Opening directions to ${item.poNumber}`);
    setTimeout(() => setFlash(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/map.jpg" alt="" className="h-16 w-auto object-contain mb-2" />
        <h1 className="text-2xl font-semibold">City Material Map</h1>
        <p className="text-sm text-zinc-400">
          Available for Pickup across Calgary
          {referencePO && <span className="text-zinc-600"> · distance from {referencePO.poNumber}</span>}
        </p>
      </div>

      {flash && (
        <div className="bg-emerald-950 border border-emerald-800 text-emerald-300 px-4 py-2.5 rounded-2xl text-sm">
          {flash}
        </div>
      )}

      <input
        type="text"
        placeholder="Search size, thickness, manufacturer, PO#, address…"
        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-sm placeholder:text-zinc-500 focus:outline-none focus:border-emerald-600"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
      />

      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setCategoryFilter('')}
          className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap ${!categoryFilter ? 'bg-emerald-600' : 'bg-zinc-800'}`}
        >
          All ({availableWithMeta.length})
        </button>
        {categories.map(c => {
          const count = availableWithMeta.filter(m => m.category === c).length;
          return (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap ${categoryFilter === c ? 'bg-emerald-600' : 'bg-zinc-800'}`}
            >
              {c} ({count})
            </button>
          );
        })}
      </div>

      <div className="relative">
        <div className="h-[380px] rounded-3xl overflow-hidden border border-zinc-800">
          <MapComponent
            buckets={buckets}
            referencePO={referencePO}
            onSelectItem={(item: InventoryItem) => setSelectedId(item.id)}
          />
        </div>

        {selected && (
          <div className="absolute bottom-4 left-4 right-4 bg-zinc-900 border border-zinc-700 rounded-3xl p-5 shadow-2xl z-[1000] max-h-[calc(100%-2rem)] overflow-y-auto">
            <div className="flex justify-between items-start mb-3">
              <div className="min-w-0">
                <div className="font-semibold text-xl tracking-tight truncate">{selected.poNumber}</div>
                <div className="text-emerald-400 text-sm">{selected.distance.toFixed(1)} km away · {relativeTime(selected.updatedAt)}</div>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-zinc-400 text-2xl leading-none px-2">×</button>
            </div>

            <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">{selected.category}</div>
            <div className="text-lg tracking-tight">{itemTitle(selected)}</div>
            {itemSubtitle(selected) && <div className="text-xs text-zinc-500 mt-0.5">{itemSubtitle(selected)}</div>}

            <div className="flex gap-2 my-3 flex-wrap">
              <div className="bg-emerald-950 text-emerald-400 px-3.5 py-1 rounded-2xl text-sm font-medium">
                {selected.quantity} {selected.unit}
              </div>
              <div className={`px-3.5 py-1 rounded-2xl text-sm border ${statusClass(selected.status)}`}>{selected.status}</div>
            </div>

            {Object.entries(selected.specs).some(([, v]) => !!v) && (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 my-3 text-xs">
                {Object.entries(selected.specs).map(([k, v]) =>
                  v ? (
                    <div key={k} className="flex justify-between gap-2 border-b border-zinc-800 pb-1">
                      <span className="text-zinc-500">{SPEC_LABELS[k] ?? k}</span>
                      <span className="text-zinc-200 text-right truncate">{String(v)}</span>
                    </div>
                  ) : null
                )}
              </div>
            )}

            <div className="text-xs text-zinc-500 mb-1">{selected.address}</div>
            {selected.poJob.contactName && (
              <div className="text-xs text-zinc-500 mb-2">
                Contact: {selected.poJob.contactName}
                {selected.poJob.contactPhone && ` · ${selected.poJob.contactPhone}`}
              </div>
            )}
            <div className="text-[11px] text-zinc-500 mb-3">Last touched by {selected.updatedBy}</div>

            {selected.notes && (
              <div className="text-xs text-amber-300 bg-amber-950/40 border border-amber-900 rounded-xl px-3 py-2 mb-3">
                Note: {selected.notes}
              </div>
            )}

            {otherAtSamePO.length > 0 && (
              <div className="text-[11px] text-zinc-400 mb-3">
                +{otherAtSamePO.length} other available item{otherAtSamePO.length === 1 ? '' : 's'} at this PO
              </div>
            )}

            <div className="mb-3">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500">Pick up for</label>
              <select
                value={destinationPO}
                onChange={e => setDestinationPO(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-3 py-2.5 mt-1 text-sm focus:outline-none focus:border-emerald-600"
              >
                {activePOs
                  .filter(p => p.poNumber !== selected.poNumber)
                  .map(p => (
                    <option key={p.id} value={p.poNumber}>
                      {p.poNumber} {currentUser.assignedPO === p.poNumber ? ' (your site)' : ''}
                    </option>
                  ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 block">How</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPickupMethod('self')}
                  className={`py-2.5 rounded-2xl text-sm border ${
                    pickupMethod === 'self'
                      ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                  }`}
                >
                  🚗 I'll grab it
                </button>
                <button
                  onClick={() => setPickupMethod('driver')}
                  className={`py-2.5 rounded-2xl text-sm border ${
                    pickupMethod === 'driver'
                      ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                  }`}
                >
                  🚚 Send a driver
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => reserve(selected)} className="flex-1 bg-emerald-600 active:bg-emerald-700 py-3.5 rounded-2xl font-medium text-sm">
                {pickupMethod === 'driver' ? 'Request Delivery' : 'Reserve'}
              </button>
              <button onClick={() => directions(selected)} className="flex-1 bg-zinc-800 active:bg-zinc-700 py-3.5 rounded-2xl font-medium text-sm">
                Directions
              </button>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="px-1 text-sm text-zinc-400 mb-3">
          {filtered.length} item{filtered.length === 1 ? '' : 's'} available
          {searchTerm && ` · matching "${searchTerm}"`}
        </div>

        {filtered.length > 0 ? (
          filtered.map(item => (
            <div
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 mb-3 active:bg-zinc-800 active:scale-[0.985] transition-all cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div className="min-w-0">
                  <div className="font-semibold text-[21px] tracking-tight truncate">{item.poNumber}</div>
                  <div className="text-emerald-400 text-[15px] font-medium mt-0.5">{item.distance.toFixed(1)} km away</div>
                </div>
                <div className="text-[11px] text-zinc-500 text-right pt-1 shrink-0">{relativeTime(item.updatedAt)}</div>
              </div>

              <div className="text-sm text-zinc-300 mt-3">{itemTitle(item)}</div>
              {itemSubtitle(item) && <div className="text-xs text-zinc-500">{itemSubtitle(item)}</div>}

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center bg-zinc-800 px-3.5 py-1 rounded-2xl text-[13px]">{item.category}</div>
                <div className="inline-flex items-center bg-emerald-950 text-emerald-400 px-3.5 py-1 rounded-2xl text-[13px] font-medium">
                  {item.quantity} {item.unit}
                </div>
              </div>

              <div className="text-xs text-zinc-500 mt-3 tracking-tight">{item.address}</div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-zinc-500">
            {searchTerm || categoryFilter ? 'No matches — try clearing filters.' : 'No material currently Available for Pickup.'}
          </div>
        )}
      </div>
    </div>
  );
}
