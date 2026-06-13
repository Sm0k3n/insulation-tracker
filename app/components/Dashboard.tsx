'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import type { InventoryItem, POJob, Transaction, User } from '@/lib/types';
import { ACTION_LABEL, itemTitle, relativeTime } from '@/lib/util';

const itemTitleSafe = (item: InventoryItem) => itemTitle(item);
import type { Tab } from '../page';

interface DashboardProps {
  currentUser: User;
  pos: POJob[];
  inventory: InventoryItem[];
  transactions: Transaction[];
  onJump: (tab: Tab) => void;
}

export default function Dashboard({ currentUser, pos, inventory, transactions, onJump }: DashboardProps) {
  const { greeting, dateStr } = useMemo(() => {
    const now = new Date();
    const h = now.getHours();
    const greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    return { greeting: greet, dateStr: date };
  }, []);

  const myPO = currentUser.assignedPO ? pos.find(p => p.poNumber === currentUser.assignedPO) : undefined;

  const availableCount = inventory.filter(i => i.status === 'Available for Pickup').length;
  const needCount     = inventory.filter(i => i.status === 'Needed on Site').length;
  const reservedCount = inventory.filter(i => i.status === 'Reserved').length;
  const damagedCount  = inventory.filter(i => i.status === 'Damaged' || i.status === 'Missing').length;

  const todaysTransactions = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return transactions.filter(t => t.timestamp.slice(0, 10) === today);
  }, [transactions]);

  const myPickups = useMemo(
    () =>
      inventory.filter(
        i => i.reservedBy === currentUser.name && (i.status === 'Reserved' || i.status === 'Picked Up'),
      ),
    [inventory, currentUser.name],
  );

  const mySiteInventory = myPO ? inventory.filter(i => i.poNumber === myPO.poNumber) : [];
  const mySiteAvailable = mySiteInventory.filter(i => i.status === 'Available for Pickup').length;
  const mySiteNeeded = mySiteInventory.filter(i => i.status === 'Needed on Site').length;

  const initials = currentUser.name
    .split(' ')
    .map(s => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600/30 border border-emerald-700 text-emerald-300 flex items-center justify-center text-base font-semibold shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="text-xs text-zinc-500">{greeting} · {dateStr}</div>
          <h1 className="text-3xl font-semibold tracking-tight truncate">{currentUser.name.split(' ')[0]}</h1>
          <div className="text-xs text-zinc-500 mt-0.5">
            {currentUser.role}
            {myPO && ` · ${myPO.poNumber}`}
          </div>
        </div>
      </div>

      {/* My site quick card */}
      {myPO && (
        <Link
          href={`/po/?n=${encodeURIComponent(myPO.poNumber)}`}
          className="block bg-gradient-to-br from-emerald-900/40 to-zinc-900 border border-emerald-800/60 rounded-3xl p-5 active:scale-[0.99] transition-transform"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[2px] text-emerald-400 mb-1">Your site</div>
              <div className="text-xl font-semibold tracking-tight truncate">{myPO.poNumber}</div>
              <div className="text-sm text-zinc-400 mt-0.5 truncate">{myPO.address}</div>
            </div>
            <div className="text-emerald-400 text-sm shrink-0">Open →</div>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-[11px] bg-emerald-950 border border-emerald-800 text-emerald-300 px-2.5 py-0.5 rounded-full">
              {mySiteAvailable} avail
            </span>
            <span className="text-[11px] bg-zinc-800 text-zinc-300 px-2.5 py-0.5 rounded-full">
              {mySiteNeeded} needed
            </span>
            <span className="text-[11px] bg-zinc-800 text-zinc-300 px-2.5 py-0.5 rounded-full">
              {mySiteInventory.length} total
            </span>
          </div>
        </Link>
      )}

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Available citywide" value={availableCount} tone="emerald" onClick={() => onJump('map')} />
        <StatTile label="Needed on site"     value={needCount}      tone="zinc" onClick={() => onJump('inventory')} />
        <StatTile label="Reserved"           value={reservedCount}  tone="cyan" onClick={() => onJump('inventory')} />
        <StatTile label="Damaged / Missing"  value={damagedCount}   tone="amber" onClick={() => onJump('inventory')} />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl px-5 py-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-zinc-500">Activity today</div>
          <div className="text-2xl font-semibold tracking-tighter">{todaysTransactions.length}</div>
        </div>
        <button onClick={() => onJump('history')} className="text-emerald-400 text-sm">
          View history →
        </button>
      </div>

      {myPickups.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-[2px] text-zinc-500 mb-2">Your active pickups</div>
          <div className="space-y-2">
            {myPickups.map(item => {
              const sourcePO = pos.find(p => p.poNumber === item.poNumber);
              return (
                <Link
                  key={item.id}
                  href={`/po/?n=${encodeURIComponent(item.poNumber)}`}
                  className="block bg-cyan-950/40 border border-cyan-900/60 rounded-2xl px-4 py-3"
                >
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {item.quantity} {item.unit} · {itemTitleSafe(item)}
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5 truncate">
                        From {item.poNumber}
                        {sourcePO && <span className="text-zinc-500"> · {sourcePO.address}</span>}
                      </div>
                      {item.destinationPO && (
                        <div className="text-xs text-emerald-300 mt-0.5">→ {item.destinationPO}</div>
                      )}
                    </div>
                    <div className="text-[11px] text-cyan-300 shrink-0">{item.status}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <div className="text-xs uppercase tracking-[2px] text-zinc-500 mb-2">Quick actions</div>
        <div className="grid grid-cols-2 gap-3">
          <ActionTile label="🗺️ City Material Map" hint="Find pickup-available material" onClick={() => onJump('map')} />
          {currentUser.role === 'Foreman' && (
            <>
              <ActionTile label="📦 Inventory" hint="Mark items Available" onClick={() => onJump('inventory')} />
              <ActionTile label="🛒 New Order" hint="Request materials" onClick={() => onJump('orders')} />
              <ActionTile label="📝 Daily Report" hint="Log today's work" onClick={() => onJump('reports')} />
            </>
          )}
          {currentUser.role === 'Delivery Driver' && (
            <>
              <ActionTile label="🚚 Deliveries" hint="Today's runs" onClick={() => onJump('deliveries')} />
              <ActionTile label="🔄 Transfers" hint="Move material between sites" onClick={() => onJump('transfers')} />
            </>
          )}
          {currentUser.role === 'Admin' && (
            <>
              <ActionTile label="⚙️ Admin" hint="Users, POs, history" onClick={() => onJump('admin')} />
              <ActionTile label="📁 All PO# Jobs" hint="Every site" onClick={() => onJump('jobs')} />
            </>
          )}
          {currentUser.role === 'Employee' && (
            <ActionTile label="📁 PO# Jobs" hint="Browse sites" onClick={() => onJump('jobs')} />
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <div className="text-xs uppercase tracking-[2px] text-zinc-500 mb-2">Recent activity</div>
        <div className="space-y-2">
          {transactions.slice(0, 6).map(t => (
            <div key={t.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-sm">
              <div className="flex justify-between items-center gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/po/?n=${encodeURIComponent(t.poNumber)}`}
                    className="text-emerald-400 mr-2 hover:underline"
                    onClick={e => e.stopPropagation()}
                  >
                    {t.poNumber}
                  </Link>
                  <span className="text-zinc-300">{ACTION_LABEL[t.action]}</span>
                </div>
                <div className="text-[10px] text-zinc-500 shrink-0">{relativeTime(t.timestamp)}</div>
              </div>
              <div className="text-xs text-zinc-500 mt-0.5 truncate">{t.materialSummary} · {t.user}</div>
            </div>
          ))}
          {transactions.length === 0 && <div className="text-zinc-600 text-sm">No activity yet.</div>}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, tone, onClick }: { label: string; value: number; tone: 'emerald' | 'cyan' | 'amber' | 'zinc'; onClick?: () => void }) {
  const toneText = {
    emerald: 'text-emerald-400',
    cyan: 'text-cyan-300',
    amber: 'text-amber-300',
    zinc: 'text-zinc-200',
  }[tone];
  return (
    <button onClick={onClick} className="text-left bg-zinc-900 border border-zinc-800 rounded-3xl p-4 active:bg-zinc-800 transition-colors">
      <div className={`text-3xl font-semibold tracking-tighter ${toneText}`}>{value}</div>
      <div className="text-xs text-zinc-500 mt-1">{label}</div>
    </button>
  );
}

function ActionTile({ label, hint, onClick }: { label: string; hint: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left bg-zinc-900 border border-zinc-800 rounded-3xl p-4 active:bg-zinc-800 transition-colors">
      <div className="text-sm font-medium">{label}</div>
      <div className="text-[11px] text-zinc-500 mt-0.5">{hint}</div>
    </button>
  );
}
