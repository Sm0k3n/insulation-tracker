import type { InventoryItem, InventoryStatus, POJob, Transaction, TransactionAction } from './types';

/** One-line title for any inventory item, category-aware. Defensive against pre-Session-1 data missing `specs` or `category`. */
export function itemTitle(item: InventoryItem): string {
  const s = item.specs ?? {};
  const category = item.category ?? 'Pipe Insulation';
  switch (category) {
    case 'Pipe Insulation':
      return [s.pipeSize && `${s.pipeSize} IPS`, s.insulationThickness && `× ${s.insulationThickness}`, s.materialType]
        .filter(Boolean)
        .join(' ') || 'Pipe Insulation';
    case 'Fitting Cover':
      return [s.fittingType, s.pipeSize, s.insulationThickness && `× ${s.insulationThickness}`].filter(Boolean).join(' ') || 'Fitting Cover';
    case 'Duct Wrap':
      return ['Duct Wrap', s.insulationThickness, s.width, s.length].filter(Boolean).join(' ') || 'Duct Wrap';
    case 'Jacketing':
      return [s.materialType, s.gauge, s.width].filter(Boolean).join(' ') || 'Jacketing';
    case 'Consumable':
      return s.productName || 'Consumable';
    case 'Equipment':
      return s.productName || 'Equipment';
  }
  return 'Item';
}

/** Subtitle line — manufacturer / jacket / length / etc. Defensive against missing `specs`. */
export function itemSubtitle(item: InventoryItem): string {
  const s = item.specs ?? {};
  const category = item.category ?? 'Pipe Insulation';
  const parts: string[] = [];
  if (s.manufacturer) parts.push(s.manufacturer);
  if (s.productLine) parts.push(s.productLine);
  if (s.jacketType) parts.push(`${s.jacketType} jacket`);
  if (s.length && category === 'Pipe Insulation') parts.push(`${s.length} pieces`);
  if (s.facingType) parts.push(`${s.facingType} facing`);
  if (s.serial) parts.push(`SN ${s.serial}`);
  return parts.join(' · ');
}

/** Normalize a possibly-pre-Session-1 inventory item so consumers can rely on shape. */
export function normalizeInventoryItem(item: InventoryItem): InventoryItem {
  if (item.specs && item.category && item.updatedAt && item.updatedBy) return item;
  return {
    ...item,
    category: item.category ?? 'Pipe Insulation',
    status: item.status ?? 'Available for Pickup',
    specs: item.specs ?? {},
    updatedAt: item.updatedAt ?? new Date().toISOString(),
    updatedBy: item.updatedBy ?? 'system',
    quantity: typeof item.quantity === 'number' ? item.quantity : 0,
    unit: item.unit ?? 'pcs',
  };
}

/** Used as the materialSummary on transactions, transfers, orders. */
export function itemSummary(item: InventoryItem): string {
  return `${itemTitle(item)} (${item.quantity} ${item.unit})`;
}

const STATUS_TONE: Record<InventoryStatus, string> = {
  'Available for Pickup':  'bg-emerald-950 text-emerald-400 border-emerald-800',
  'Reserved':              'bg-cyan-950 text-cyan-300 border-cyan-800',
  'Transfer Requested':    'bg-cyan-950 text-cyan-300 border-cyan-800',
  'Picked Up':             'bg-cyan-950 text-cyan-300 border-cyan-800',
  'Delivered to New PO#':  'bg-emerald-950 text-emerald-400 border-emerald-800',
  'Needed on Site':        'bg-zinc-800 text-zinc-300 border-zinc-700',
  'Used':                  'bg-zinc-900 text-zinc-500 border-zinc-800',
  'Damaged':               'bg-amber-950 text-amber-400 border-amber-800',
  'Missing':               'bg-rose-950 text-rose-400 border-rose-800',
};

export function statusClass(status: InventoryStatus): string {
  return STATUS_TONE[status];
}

/** Haversine, returns km. */
export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diffMin = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const hr = Math.round(diffMin / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

/** Look up a PO by either poNumber or id. */
export function findPO(pos: POJob[], key: string | undefined): POJob | undefined {
  if (!key) return undefined;
  return pos.find(p => p.poNumber === key || p.id === key);
}

export function newId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function makeTransaction(input: Omit<Transaction, 'id' | 'timestamp'> & { timestamp?: string }): Transaction {
  return {
    id: newId('tx'),
    timestamp: input.timestamp || new Date().toISOString(),
    ...input,
  };
}

export const ACTION_LABEL: Record<TransactionAction, string> = {
  'added':              'Added',
  'removed':            'Removed',
  'used':               'Used on report',
  'transferred-out':    'Transferred out',
  'transferred-in':     'Transferred in',
  'reserved':           'Reserved',
  'unreserved':         'Unreserved',
  'delivered':          'Delivered',
  'marked-available':   'Marked available',
  'marked-damaged':     'Marked damaged',
  'marked-missing':     'Marked missing',
  'status-changed':     'Status changed',
};
