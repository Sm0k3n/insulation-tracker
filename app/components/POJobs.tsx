'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { InventoryItem, POJob, User } from '@/lib/types';

interface POJobsProps {
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  pos: POJob[];
  currentUser: User;
}

export default function POJobs({ inventory, pos, currentUser }: POJobsProps) {
  const [showCompleted, setShowCompleted] = useState(false);

  // Sort: warehouses pinned to the top, then jobsites.
  const sorted = useMemo(
    () => [...pos].sort((a, b) => (a.type === 'warehouse' ? -1 : b.type === 'warehouse' ? 1 : 0)),
    [pos],
  );

  const visiblePOs = useMemo(() => {
    // Foreman with an assigned PO always sees their own job regardless of status.
    if (currentUser.role === 'Foreman' && currentUser.assignedPO) {
      return sorted.filter(p => p.poNumber === currentUser.assignedPO);
    }
    return showCompleted ? sorted : sorted.filter(p => p.status !== 'Completed');
  }, [sorted, currentUser, showCompleted]);

  const completedCount = sorted.filter(p => p.type !== 'warehouse' && p.status === 'Completed').length;
  const showToggle = !(currentUser.role === 'Foreman' && currentUser.assignedPO) && completedCount > 0;

  return (
    <div>
      <div className="mb-6 flex justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-semibold">PO# Jobs</h1>
          <p className="text-sm text-zinc-400">
            {currentUser.role === 'Foreman' ? 'Your assigned jobs' : `${visiblePOs.length} active job${visiblePOs.length === 1 ? '' : 's'}`}
          </p>
        </div>
        {showToggle && (
          <button
            onClick={() => setShowCompleted(s => !s)}
            className="text-xs text-zinc-400 underline shrink-0 mt-1.5"
          >
            {showCompleted ? `Hide completed (${completedCount})` : `Show completed (${completedCount})`}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {visiblePOs.map(po => {
          const items = inventory.filter(i => i.poNumber === po.poNumber);
          const availableCount = items.filter(i => i.status === 'Available for Pickup').length;
          const reservedCount = items.filter(i => i.status === 'Reserved').length;
          const photoCount = po.photos?.length ?? 0;
          const isWarehouse = po.type === 'warehouse';
          return (
            <Link
              key={po.id}
              href={`/po/?n=${encodeURIComponent(po.poNumber)}`}
              className={`block rounded-3xl p-5 active:bg-zinc-800 transition-all ${
                isWarehouse
                  ? 'bg-amber-950/30 border border-amber-800/60 hover:border-amber-700'
                  : 'bg-zinc-900 border border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <div className={`font-semibold text-xl truncate ${isWarehouse ? 'text-amber-300' : ''}`}>
                    {isWarehouse ? `🏭 ${po.poNumber}` : po.poNumber}
                  </div>
                  <div className="text-sm text-zinc-400 truncate">{po.address}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-xs ${
                    isWarehouse ? 'text-amber-300' :
                    po.status === 'Active' ? 'text-emerald-400' : po.status === 'On Hold' ? 'text-amber-300' : 'text-zinc-500'
                  }`}>{isWarehouse ? 'Warehouse' : po.status}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="text-[11px] bg-emerald-950 border border-emerald-800 text-emerald-300 px-2.5 py-0.5 rounded-full">
                  {availableCount} avail
                </span>
                {reservedCount > 0 && (
                  <span className="text-[11px] bg-cyan-950 border border-cyan-800 text-cyan-300 px-2.5 py-0.5 rounded-full">
                    {reservedCount} reserved
                  </span>
                )}
                <span className="text-[11px] bg-zinc-800 text-zinc-300 px-2.5 py-0.5 rounded-full">
                  {items.length} total
                </span>
                {photoCount > 0 && (
                  <span className="text-[11px] bg-zinc-800 text-zinc-300 px-2.5 py-0.5 rounded-full">
                    📷 {photoCount}
                  </span>
                )}
              </div>

              <div className="text-xs text-zinc-500 mt-3 flex justify-between gap-3">
                <span className="truncate">{po.contactName ? `Contact: ${po.contactName}` : 'No contact set'}</span>
                <span className="text-emerald-400 shrink-0">Open →</span>
              </div>
            </Link>
          );
        })}

        {visiblePOs.length === 0 && (
          <div className="text-center py-12 text-zinc-500">No PO# jobs available.</div>
        )}
      </div>
    </div>
  );
}
