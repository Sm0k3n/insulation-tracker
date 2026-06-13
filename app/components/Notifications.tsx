'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { MaterialOrder, Transaction, User } from '@/lib/types';
import { ACTION_LABEL, relativeTime } from '@/lib/util';
import { usePersistedState } from '@/lib/persistence';

interface NotificationEvent {
  id: string;
  ts: string;
  title: string;
  body: string;
  poNumber: string;
  href?: string;
  tone: 'info' | 'success' | 'warn' | 'pending';
}

interface NotificationsProps {
  currentUser: User;
  transactions: Transaction[];
  orders: MaterialOrder[];
}

function deriveEvents(currentUser: User, transactions: Transaction[], orders: MaterialOrder[]): NotificationEvent[] {
  const out: NotificationEvent[] = [];

  // Transactions touching my world (exclude my own actions to avoid self-noise)
  const txForMe = transactions
    .filter(t => t.user !== currentUser.name)
    .filter(t => {
      if (currentUser.role === 'Foreman' && currentUser.assignedPO) {
        return t.poNumber === currentUser.assignedPO || t.toPO === currentUser.assignedPO;
      }
      if (currentUser.role === 'Admin') {
        return ['marked-damaged', 'marked-missing', 'delivered'].includes(t.action);
      }
      // Drivers/Employees: only their own deliveries/transfers matter
      return false;
    })
    .slice(0, 30);

  for (const t of txForMe) {
    out.push({
      id: `tx-${t.id}`,
      ts: t.timestamp,
      title: `${t.poNumber} · ${ACTION_LABEL[t.action]}`,
      body: `${t.materialSummary} — ${t.user}`,
      poNumber: t.poNumber,
      href: `/po/?n=${encodeURIComponent(t.poNumber)}`,
      tone: t.action === 'marked-damaged' || t.action === 'marked-missing' ? 'warn'
          : t.action === 'delivered' ? 'success'
          : 'info',
    });
  }

  // Order events relevant to role
  for (const o of orders) {
    const last = o.history && o.history.length > 0 ? o.history[o.history.length - 1] : null;
    const ts = last?.at ?? o.createdAt;

    if (currentUser.role === 'Admin' && o.status === 'Submitted') {
      out.push({
        id: `ord-${o.id}-submitted`,
        ts,
        title: `New order needs approval · ${o.poNumber}`,
        body: `${o.items.map(i => `${i.quantity} ${i.unit} ${i.summary}`).join(', ')} (${o.priority})`,
        poNumber: o.poNumber,
        tone: 'pending',
      });
    }

    if (currentUser.role === 'Delivery Driver' && o.status === 'Scheduled' && !o.driverId) {
      out.push({
        id: `ord-${o.id}-scheduled`,
        ts,
        title: `🆓 Delivery available · ${o.poNumber}`,
        body: `${o.items.map(i => `${i.quantity} ${i.unit} ${i.summary}`).join(', ')} — needed ${o.neededByDate}`,
        poNumber: o.poNumber,
        tone: 'info',
      });
    }

    if (
      (currentUser.role === 'Foreman' || currentUser.role === 'Employee') &&
      o.requestedBy === currentUser.name &&
      last && last.by !== currentUser.name
    ) {
      out.push({
        id: `ord-${o.id}-${o.status}`,
        ts,
        title: `Your order: ${o.status} · ${o.poNumber}`,
        body: `${o.items.map(i => `${i.quantity} ${i.unit} ${i.summary}`).join(', ')}`,
        poNumber: o.poNumber,
        tone: o.status === 'Delivered' ? 'success' : o.status === 'Cancelled' ? 'warn' : 'pending',
      });
    }
  }

  const seen = new Set<string>();
  return out
    .filter(n => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    })
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, 30);
}

const TONE_BORDER: Record<NotificationEvent['tone'], string> = {
  info:    'border-l-cyan-500',
  success: 'border-l-emerald-500',
  warn:    'border-l-rose-500',
  pending: 'border-l-amber-500',
};

export default function Notifications({ currentUser, transactions, orders }: NotificationsProps) {
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = usePersistedState<string>(`insultrack-notif-seen-${currentUser.id}`, new Date(0).toISOString());

  const events = useMemo(
    () => deriveEvents(currentUser, transactions, orders),
    [currentUser, transactions, orders],
  );

  const unreadCount = events.filter(e => e.ts > lastSeen).length;

  const markAllRead = () => {
    if (events.length > 0) setLastSeen(events[0].ts);
  };

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen(o => !o);
          if (!open) markAllRead();
        }}
        className="relative w-9 h-9 flex items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700"
        aria-label="Notifications"
      >
        <span className="text-sm">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 text-[10px] bg-rose-600 text-white rounded-full min-w-4 h-4 px-1 flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/40"
            aria-hidden="true"
          />
          <div className="absolute top-12 right-0 z-50 w-[320px] sm:w-[360px] max-h-[70vh] overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl">
            <div className="sticky top-0 bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between items-center">
              <div className="font-semibold text-sm">Notifications</div>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-400 text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {events.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-sm">
                You're all caught up.<br />
                <span className="text-xs text-zinc-600">Events for your role show up here.</span>
              </div>
            ) : (
              <div>
                {events.map(e => {
                  const isUnread = e.ts > lastSeen;
                  const inner = (
                    <>
                      <div className="flex justify-between items-start gap-2">
                        <div className="text-sm font-medium text-zinc-100 min-w-0">
                          {isUnread && <span className="text-emerald-400 mr-1">●</span>}
                          {e.title}
                        </div>
                        <div className="text-[10px] text-zinc-500 shrink-0">{relativeTime(e.ts)}</div>
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{e.body}</div>
                    </>
                  );
                  const cls = `block px-4 py-3 border-b border-zinc-800 border-l-4 ${TONE_BORDER[e.tone]} ${isUnread ? 'bg-zinc-900' : 'bg-zinc-950/50'} hover:bg-zinc-800/60 transition-colors`;
                  return e.href ? (
                    <Link key={e.id} href={e.href} onClick={() => setOpen(false)} className={cls}>
                      {inner}
                    </Link>
                  ) : (
                    <div key={e.id} className={cls}>
                      {inner}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
