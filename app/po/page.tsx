'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type {
  DailyReport,
  InventoryItem,
  MaterialOrder,
  PhotoEntry,
  POJob,
  Transaction,
  Transfer,
  User,
} from '@/lib/types';
import { seedInventory, seedPOs, seedTransactions } from '@/lib/seed';
import { usePersistedState } from '@/lib/persistence';
import {
  itemTitle,
  itemSubtitle,
  relativeTime,
  statusClass,
  newId,
  ACTION_LABEL,
} from '@/lib/util';
import { applyDelivery } from '@/lib/inventory';
import { api, getToken, setToken, ApiError } from '@/lib/api';

type TabId =
  | 'inventory'
  | 'available'
  | 'orders'
  | 'deliveries'
  | 'reports'
  | 'transfers'
  | 'notes';

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

async function fileToResizedDataUrl(file: File, maxDim = 1280, quality = 0.78): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

function PODetailInner() {
  const searchParams = useSearchParams();
  const decoded = searchParams.get('n') ?? '';

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getToken();
      if (!token) {
        if (!cancelled) setAuthChecked(true);
        return;
      }
      try {
        const r = await api.me();
        if (!cancelled) {
          setCurrentUser(r.user);
          setAuthChecked(true);
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) setToken(null);
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [pos, setPOs] = usePersistedState<POJob[]>('insultrac-pos', seedPOs);
  const [inventory, setInventory] = usePersistedState<InventoryItem[]>('insultrac-inventory', seedInventory);
  const [transactions, setTransactions] = usePersistedState<Transaction[]>('insultrac-transactions', seedTransactions);
  const [transfers] = usePersistedState<Transfer[]>('insultrac-transfers', []);
  const [reports] = usePersistedState<DailyReport[]>('insultrac-reports', []);
  const [orders] = usePersistedState<MaterialOrder[]>('insultrac-orders', []);

  const [activeTab, setActiveTab] = useState<TabId>('inventory');
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const po = useMemo(() => pos.find(p => p.poNumber === decoded), [pos, decoded]);

  const items = useMemo(() => inventory.filter(i => i.poNumber === decoded), [inventory, decoded]);
  const available = items.filter(i => i.status === 'Available for Pickup');
  const poTransfers = transfers.filter(t => t.fromPO === decoded || t.toPO === decoded);
  const poReports = reports.filter(r => r.poNumber === decoded);
  const poOrders = orders.filter(o => o.poNumber === decoded);
  const poTransactions = transactions.filter(t => t.poNumber === decoded).slice(0, 30);
  const photos = po?.photos ?? [];

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-zinc-500 text-sm">Loading…</div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div className="text-lg font-semibold mb-3">Not signed in</div>
          <Link href="/" className="text-emerald-400 underline">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white p-6">
        <Link href="/" className="text-emerald-400 text-sm">← Back</Link>
        <div className="mt-12 text-center">
          <div className="text-lg font-semibold">PO# &quot;{decoded}&quot; not found</div>
          <div className="text-sm text-zinc-500 mt-1">It may have been removed or renamed.</div>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser.role === 'Admin';
  const canEditNotes = isAdmin || currentUser.role === 'Foreman';

  const saveNotes = () => {
    if (notesDraft === null) return;
    setPOs(prev => prev.map(p => (p.id === po.id ? { ...p, notes: notesDraft } : p)));
    setNotesDraft(null);
  };

  const onPickPhotos = () => fileInputRef.current?.click();

  const handlePhotoFiles = async (files: FileList | null) => {
    setUploadError(null);
    if (!files || files.length === 0) return;
    try {
      const newPhotos: PhotoEntry[] = [];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith('image/')) continue;
        const dataUrl = await fileToResizedDataUrl(f);
        newPhotos.push({
          id: newId('ph'),
          dataUrl,
          caption: photoCaption.trim() || undefined,
          uploadedBy: currentUser.name,
          uploadedAt: new Date().toISOString(),
        });
      }
      if (newPhotos.length === 0) {
        setUploadError('Only image files are supported.');
        return;
      }
      setPOs(prev =>
        prev.map(p =>
          p.id === po.id ? { ...p, photos: [...newPhotos, ...(p.photos ?? [])] } : p,
        ),
      );
      setPhotoCaption('');
    } catch {
      setUploadError('Could not read that image. Try a different file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deletePhoto = (id: string) => {
    setPOs(prev =>
      prev.map(p =>
        p.id === po.id ? { ...p, photos: (p.photos ?? []).filter(ph => ph.id !== id) } : p,
      ),
    );
  };

  const markPickedUp = (item: InventoryItem) => {
    const now = new Date().toISOString();
    setInventory(prev =>
      prev.map(i =>
        i.id === item.id
          ? { ...i, status: 'Picked Up', updatedAt: now, updatedBy: currentUser.name }
          : i,
      ),
    );
    setTransactions(prev => [
      {
        id: newId('tx'),
        timestamp: now,
        poNumber: item.poNumber,
        itemId: item.id,
        user: currentUser.name,
        action: 'status-changed',
        materialSummary: `${itemTitle(item)} (${item.quantity} ${item.unit})`,
        quantity: item.quantity,
        fromStatus: item.status,
        toStatus: 'Picked Up',
        toPO: item.destinationPO,
        notes: item.destinationPO ? `On the way to ${item.destinationPO}` : undefined,
      },
      ...prev,
    ]);
  };

  const markDelivered = (item: InventoryItem) => {
    if (!item.destinationPO) {
      window.alert('This item has no destination PO set. Open it from the City Map and reserve again with a destination.');
      return;
    }
    const dest = item.destinationPO;
    const summary = `${itemTitle(item)} (${item.quantity} ${item.unit})`;
    setInventory(prev => applyDelivery(prev, item, dest, currentUser.name));
    setTransactions(prev => [
      {
        id: newId('tx'),
        timestamp: new Date().toISOString(),
        poNumber: dest,
        user: currentUser.name,
        action: 'transferred-in',
        materialSummary: summary,
        quantity: item.quantity,
        notes: `Delivered from ${item.poNumber}`,
      },
      {
        id: newId('tx'),
        timestamp: new Date().toISOString(),
        poNumber: item.poNumber,
        itemId: item.id,
        user: currentUser.name,
        action: 'transferred-out',
        materialSummary: summary,
        quantity: item.quantity,
        fromStatus: 'Picked Up',
        toStatus: 'Delivered to New PO#',
        toPO: dest,
      },
      ...prev,
    ]);
  };

  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: 'inventory', label: 'Inventory', count: items.length },
    { id: 'available', label: 'Available', count: available.length },
    { id: 'orders', label: 'Orders', count: poOrders.length },
    { id: 'deliveries', label: 'Deliveries' },
    { id: 'reports', label: 'Reports', count: poReports.length },
    { id: 'transfers', label: 'Transfers', count: poTransfers.length },
    { id: 'notes', label: 'Notes & Photos', count: photos.length },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-16">
      <div className="sticky top-0 z-40 bg-zinc-950 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-emerald-400 text-sm flex items-center gap-1.5">
          <span>←</span>
          <span>Back</span>
        </Link>
        <div className="text-xs text-zinc-500">{currentUser.name}</div>
      </div>

      <div className="p-4 max-w-3xl mx-auto">
        <div className="mb-5">
          <div className="text-[11px] uppercase tracking-[2px] text-zinc-500">PO# Job</div>
          <h1 className="text-3xl font-semibold tracking-tight">{po.poNumber}</h1>
          <div className="text-sm text-zinc-400 mt-0.5">{po.address}</div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={`text-[11px] px-3 py-1 rounded-full ${
              po.status === 'Active' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
              : po.status === 'On Hold' ? 'bg-amber-950 text-amber-300 border border-amber-800'
              : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
            }`}>{po.status}</span>
            {po.contactName && (
              <span className="text-[11px] text-zinc-500">
                {po.contactName}{po.contactPhone ? ` · ${po.contactPhone}` : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex overflow-x-auto border-b border-zinc-800 mb-4 -mx-4 px-4">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === t.id ? 'border-emerald-500 text-white' : 'border-transparent text-zinc-400'
              }`}
            >
              {t.label}
              {typeof t.count === 'number' && (
                <span className="ml-1.5 text-[11px] text-zinc-500">({t.count})</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'inventory' && (
          <ItemList
            items={items}
            onMarkPickedUp={markPickedUp}
            onMarkDelivered={markDelivered}
            currentUserName={currentUser.name}
          />
        )}

        {activeTab === 'available' && (
          <ItemList
            items={available}
            onMarkPickedUp={markPickedUp}
            onMarkDelivered={markDelivered}
            currentUserName={currentUser.name}
            emptyMessage="Nothing marked Available for Pickup."
          />
        )}

        {activeTab === 'orders' && (
          <OrdersTab poOrders={poOrders} />
        )}

        {activeTab === 'deliveries' && (
          <DeliveriesTab po={po} />
        )}

        {activeTab === 'reports' && (
          <ReportsTab poReports={poReports} />
        )}

        {activeTab === 'transfers' && (
          <TransfersTab poTransfers={poTransfers} />
        )}

        {activeTab === 'notes' && (
          <div className="space-y-5">
            <div>
              <div className="text-xs uppercase tracking-[2px] text-zinc-500 mb-2">Notes</div>
              {notesDraft !== null ? (
                <>
                  <textarea
                    value={notesDraft}
                    onChange={e => setNotesDraft(e.target.value)}
                    className="w-full min-h-[120px] bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-sm"
                    placeholder="Mechanical notes, access constraints, contacts on site…"
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={saveNotes} className="bg-emerald-600 px-4 py-2 rounded-xl text-sm">Save</button>
                    <button onClick={() => setNotesDraft(null)} className="bg-zinc-800 px-4 py-2 rounded-xl text-sm">Cancel</button>
                  </div>
                </>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-200 whitespace-pre-wrap">
                  {po.notes || <span className="text-zinc-500">No notes yet.</span>}
                  {canEditNotes && (
                    <div className="mt-3">
                      <button
                        onClick={() => setNotesDraft(po.notes || '')}
                        className="text-emerald-400 text-xs"
                      >
                        {po.notes ? 'Edit notes' : '+ Add notes'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs uppercase tracking-[2px] text-zinc-500">Photos ({photos.length})</div>
                <button onClick={onPickPhotos} className="text-emerald-400 text-xs">
                  + Upload
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => handlePhotoFiles(e.target.files)}
              />

              <input
                value={photoCaption}
                onChange={e => setPhotoCaption(e.target.value)}
                placeholder="Caption (optional) — applied to the next upload"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2.5 text-sm mb-3 placeholder:text-zinc-600"
              />

              {uploadError && (
                <div className="text-xs text-rose-400 mb-3">{uploadError}</div>
              )}

              {photos.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-2xl">
                  No photos yet. Tap Upload to add one.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {photos.map(ph => (
                    <div key={ph.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ph.dataUrl}
                        alt={ph.caption || `photo by ${ph.uploadedBy}`}
                        className="w-full h-32 object-cover"
                      />
                      <div className="p-2">
                        {ph.caption && <div className="text-xs text-zinc-200 truncate">{ph.caption}</div>}
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          {ph.uploadedBy} · {relativeTime(ph.uploadedAt)}
                        </div>
                        <button
                          onClick={() => deletePhoto(ph.id)}
                          className="text-[11px] text-rose-400 mt-1"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-xs uppercase tracking-[2px] text-zinc-500 mb-2">Recent activity at this site</div>
              {poTransactions.length === 0 ? (
                <div className="text-zinc-500 text-sm">No transactions yet.</div>
              ) : (
                <div className="space-y-1.5">
                  {poTransactions.slice(0, 8).map(t => (
                    <div key={t.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl px-3.5 py-2.5 text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="text-zinc-200">{ACTION_LABEL[t.action]}</span>
                        <span className="text-zinc-500">{relativeTime(t.timestamp)}</span>
                      </div>
                      <div className="text-zinc-400 mt-0.5 truncate">{t.materialSummary} · {t.user}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PODetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <PODetailInner />
    </Suspense>
  );
}

function ItemList({
  items,
  onMarkPickedUp,
  onMarkDelivered,
  currentUserName,
  emptyMessage = 'No items.',
}: {
  items: InventoryItem[];
  onMarkPickedUp: (item: InventoryItem) => void;
  onMarkDelivered: (item: InventoryItem) => void;
  currentUserName: string;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return <div className="text-center py-10 text-zinc-500">{emptyMessage}</div>;
  }
  return (
    <div className="space-y-3">
      {items.map(item => {
        const isMine = item.reservedBy === currentUserName;
        return (
          <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">{item.category}</div>
                <div className="font-medium mt-0.5">{itemTitle(item)}</div>
                {itemSubtitle(item) && <div className="text-xs text-zinc-500 mt-0.5">{itemSubtitle(item)}</div>}
                <div className="text-xs text-zinc-400 mt-1.5">
                  {item.quantity} {item.unit} · {relativeTime(item.updatedAt)} by {item.updatedBy}
                </div>
                {item.reservedBy && (
                  <div className="text-[11px] text-cyan-300 mt-0.5">
                    Reserved by {item.reservedBy}
                    {item.destinationPO && <span className="text-zinc-400"> · headed to {item.destinationPO}</span>}
                  </div>
                )}
                {item.notes && <div className="text-xs text-amber-300 mt-1">{item.notes}</div>}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {Object.entries(item.specs ?? {}).map(([k, v]) =>
                    v ? (
                      <span key={k} className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-300">
                        {SPEC_LABELS[k] ?? k}: {String(v)}
                      </span>
                    ) : null
                  )}
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2">
                <div className={`text-[11px] font-medium px-3 py-1.5 rounded-full border ${statusClass(item.status)}`}>
                  {item.status}
                </div>
                {isMine && item.status === 'Reserved' && (
                  <button
                    onClick={() => onMarkPickedUp(item)}
                    className="text-[11px] bg-emerald-600 px-3 py-1.5 rounded-full whitespace-nowrap"
                  >
                    Mark Picked Up
                  </button>
                )}
                {isMine && item.status === 'Picked Up' && item.destinationPO && (
                  <button
                    onClick={() => onMarkDelivered(item)}
                    className="text-[11px] bg-emerald-600 px-3 py-1.5 rounded-full whitespace-nowrap"
                  >
                    Mark Delivered → {item.destinationPO}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OrdersTab({ poOrders }: { poOrders: MaterialOrder[] }) {
  if (poOrders.length === 0) {
    return (
      <div className="text-center py-10 text-zinc-500">
        No material orders for this PO.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {poOrders.map(o => (
        <div key={o.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="flex justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">
                {o.items.map(i => `${i.summary} × ${i.quantity}`).join(', ')}
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                Needed by {o.neededByDate} {o.neededByTime ? `· ${o.neededByTime}` : ''} · {o.priority}
              </div>
            </div>
            <div className="text-emerald-400 text-sm shrink-0">{o.status}</div>
          </div>
          {o.notes && <div className="text-xs text-zinc-400 mt-2">{o.notes}</div>}
        </div>
      ))}
    </div>
  );
}

function DeliveriesTab({ po }: { po: POJob }) {
  return (
    <div className="space-y-3">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="text-xs uppercase tracking-[2px] text-zinc-500 mb-2">No active deliveries</div>
        <div className="text-sm text-zinc-300">
          Active runs to <span className="text-emerald-400">{po.poNumber}</span> appear here. See the global Deliveries tab for the driver dashboard.
        </div>
      </div>
    </div>
  );
}

function ReportsTab({ poReports }: { poReports: DailyReport[] }) {
  if (poReports.length === 0) {
    return <div className="text-center py-10 text-zinc-500">No daily reports for this PO yet.</div>;
  }
  return (
    <div className="space-y-3">
      {poReports.map(r => (
        <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="flex justify-between gap-3 mb-2">
            <div>
              <div className="text-sm font-medium">{r.date}</div>
              <div className="text-xs text-zinc-500">{r.submittedBy}</div>
            </div>
            <div className="text-[10px] text-zinc-500 shrink-0">{relativeTime(r.submittedAt)}</div>
          </div>
          <div className="text-xs text-zinc-300 whitespace-pre-wrap">{r.workCompleted}</div>
          {r.materialsUsed.length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Materials used</div>
              {r.materialsUsed.map((m, i) => (
                <div key={i} className="text-xs text-zinc-400">· {m.quantity} {m.unit} · {m.summary}</div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TransfersTab({ poTransfers }: { poTransfers: Transfer[] }) {
  if (poTransfers.length === 0) {
    return <div className="text-center py-10 text-zinc-500">No transfers involving this PO yet.</div>;
  }
  return (
    <div className="space-y-3">
      {poTransfers.map(t => (
        <div key={t.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="flex justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">{t.fromPO} → {t.toPO}</div>
              <div className="text-xs text-zinc-400">{t.materialSummary} × {t.quantity}</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">Requested by {t.requestedBy}</div>
            </div>
            <div className={`text-sm shrink-0 ${t.status === 'Completed' ? 'text-emerald-400' : 'text-amber-300'}`}>
              {t.status}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
