import type { InventoryItem } from './types';
import { itemTitle, newId } from './util';

/**
 * Apply a self-pickup delivery: full quantity moves from source PO to destination PO.
 * Source row is marked "Delivered to New PO#" with qty 0 (kept for history).
 * Destination either bumps a matching available row or gets a new one.
 */
export function applyDelivery(
  inventory: InventoryItem[],
  source: InventoryItem,
  destinationPO: string,
  currentUserName: string,
): InventoryItem[] {
  const now = new Date().toISOString();

  const next = inventory.map(i =>
    i.id === source.id
      ? {
          ...i,
          status: 'Delivered to New PO#' as const,
          quantity: 0,
          destinationPO: undefined,
          updatedAt: now,
          updatedBy: currentUserName,
        }
      : i,
  );

  const dest = next.find(
    i =>
      i.poNumber === destinationPO &&
      i.category === source.category &&
      itemTitle(i) === itemTitle(source) &&
      i.status === 'Available for Pickup',
  );
  if (dest) {
    return next.map(i =>
      i.id === dest.id
        ? {
            ...i,
            quantity: i.quantity + source.quantity,
            updatedAt: now,
            updatedBy: currentUserName,
          }
        : i,
    );
  }

  return [
    ...next,
    {
      ...source,
      id: newId('i'),
      poNumber: destinationPO,
      quantity: source.quantity,
      status: 'Available for Pickup',
      reservedBy: undefined,
      destinationPO: undefined,
      updatedAt: now,
      updatedBy: currentUserName,
    },
  ];
}
