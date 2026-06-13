import type { InventoryItem, MaterialOrder, OrderStatus, User } from './types';
import { applyDelivery } from './inventory';
import { newId } from './util';

/** Push a status transition + audit entry. Stamps driver fields on Accepted by Driver. */
export function transitionOrder(order: MaterialOrder, next: OrderStatus, user: User): MaterialOrder {
  const driverFields =
    next === 'Accepted by Driver'
      ? { driverId: user.id, driverName: user.name }
      : {};
  return {
    ...order,
    ...driverFields,
    status: next,
    history: [...(order.history || []), { status: next, by: user.name, at: new Date().toISOString() }],
  };
}

/**
 * Apply the inventory + transaction effects of an order reaching "Delivered".
 * - Path B (sourceItemIds present): full applyDelivery for each reserved source item
 * - Fresh order: add new Available-for-Pickup rows at the destination PO
 */
export function fulfillDelivery(
  inventory: InventoryItem[],
  order: MaterialOrder,
  driverName: string,
): InventoryItem[] {
  if (order.sourceItemIds && order.sourceItemIds.length > 0) {
    return order.sourceItemIds.reduce<InventoryItem[]>((inv, sourceId) => {
      const src = inv.find(i => i.id === sourceId);
      if (!src) return inv;
      return applyDelivery(inv, src, order.poNumber, driverName);
    }, inventory);
  }
  const now = new Date().toISOString();
  const newItems: InventoryItem[] = order.items.map(line => ({
    id: newId('i'),
    poNumber: order.poNumber,
    category: line.category || 'Consumable',
    status: 'Available for Pickup' as const,
    quantity: line.quantity,
    unit: line.unit,
    specs: { productName: line.summary },
    updatedAt: now,
    updatedBy: driverName,
  }));
  return [...inventory, ...newItems];
}

export const ORDER_STATUSES: OrderStatus[] = [
  'Submitted',
  'Approved',
  'Scheduled',
  'Accepted by Driver',
  'Loaded',
  'En Route',
  'Delivered',
  'Cancelled',
];

export const STATUS_TONE: Record<OrderStatus, string> = {
  'Submitted':           'bg-zinc-800 text-zinc-300 border-zinc-700',
  'Approved':            'bg-emerald-950 text-emerald-300 border-emerald-800',
  'Scheduled':           'bg-emerald-950 text-emerald-300 border-emerald-800',
  'Accepted by Driver':  'bg-cyan-950 text-cyan-300 border-cyan-800',
  'Loaded':              'bg-cyan-950 text-cyan-300 border-cyan-800',
  'En Route':            'bg-amber-950 text-amber-300 border-amber-800',
  'Delivered':           'bg-emerald-950 text-emerald-300 border-emerald-800',
  'Cancelled':           'bg-rose-950 text-rose-300 border-rose-800',
};
