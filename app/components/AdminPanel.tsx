'use client';

import React, { useEffect, useState } from 'react';
import type { POJob, User } from '@/lib/types';
import { api } from '@/lib/api';

const PO_STATUSES: POJob['status'][] = ['Active', 'On Hold', 'Completed'];

interface AdminPanelProps {
  pos: POJob[];
  setPOs: React.Dispatch<React.SetStateAction<POJob[]>>;
  currentUser: User;
  onOpenHistory: () => void;
}

const ROLES: User['role'][] = ['Employee', 'Foreman', 'Delivery Driver', 'Admin'];

export default function AdminPanel({ pos, setPOs, currentUser, onOpenHistory }: AdminPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [form, setForm] = useState<{ name: string; role: User['role']; email: string; username: string; password: string; phone: string; assignedPO: string }>({
    name: '', role: 'Employee', email: '', username: '', password: '', phone: '', assignedPO: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [showPOForm, setShowPOForm] = useState(false);
  const [poForm, setPOForm] = useState({ poNumber: '', address: '', contactName: '', contactPhone: '', latitude: '', longitude: '', notes: '' });

  const loadUsers = async () => {
    setLoadingUsers(true);
    setUsersError(null);
    try {
      const r = await api.listUsers();
      setUsers(r.users);
    } catch (e: any) {
      setUsersError(e?.message || 'Failed to load users.');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const openCreateUser = () => {
    setEditingId(null);
    setForm({ name: '', role: 'Employee', email: '', username: '', password: '', phone: '', assignedPO: '' });
    setFormError(null);
    setShowUserForm(true);
  };

  const openEditUser = (u: User) => {
    setEditingId(u.id);
    setForm({
      name: u.name,
      role: u.role,
      email: u.email,
      username: u.username || '',
      password: '',
      phone: u.phone || '',
      assignedPO: u.assignedPO || '',
    });
    setFormError(null);
    setShowUserForm(true);
  };

  const [inviteFlash, setInviteFlash] = useState<string | null>(null);

  const saveUser = async () => {
    setFormError(null);
    if (!form.name || !form.email) {
      setFormError('Name and email are required.');
      return;
    }
    if (form.password && form.password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        const body: any = {
          name: form.name,
          email: form.email,
          username: form.username.trim() || null,
          role: form.role,
          phone: form.phone || null,
          assignedPO: form.role === 'Foreman' ? (form.assignedPO || null) : null,
        };
        if (form.password) body.password = form.password;
        await api.updateUser(editingId, body);
      } else {
        const result = await api.createUser({
          name: form.name,
          email: form.email,
          username: form.username.trim() || null,
          password: form.password || undefined,
          role: form.role,
          phone: form.phone || null,
          assignedPO: form.role === 'Foreman' ? (form.assignedPO || null) : null,
        });
        setInviteFlash(
          result.inviteSent
            ? `✉️  Invite email sent to ${form.email}`
            : `⚠️  User created but invite email failed: ${result.inviteError || 'unknown error'}`,
        );
        setTimeout(() => setInviteFlash(null), 6000);
      }
      await loadUsers();
      setShowUserForm(false);
      setEditingId(null);
    } catch (e: any) {
      setFormError(e?.message || 'Failed to save user.');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteUser = async (id: string) => {
    if (id === currentUser.id) return;
    if (!window.confirm('Delete this user? They will not be able to sign in anymore.')) return;
    try {
      await api.deleteUser(id);
      await loadUsers();
    } catch (e: any) {
      setUsersError(e?.message || 'Failed to delete user.');
    }
  };

  const changePOStatus = (id: string, status: POJob['status']) => {
    setPOs(prev => prev.map(p => (p.id === id ? { ...p, status } : p)));
  };

  const deletePO = (po: POJob) => {
    const ok = window.confirm(
      `Permanently delete ${po.poNumber}?\n\nThis removes the PO. Inventory items, transactions, transfers, and reports linked to it will become orphaned but stay in history.\n\nTo archive instead, change status to "Completed".`,
    );
    if (!ok) return;
    setPOs(prev => prev.filter(p => p.id !== po.id));
  };

  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  const geocodeAddress = async () => {
    setGeocodeError(null);
    const q = poForm.address.trim();
    if (!q) {
      setGeocodeError('Enter an address first.');
      return;
    }
    setGeocoding(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error(`Lookup failed (${res.status})`);
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (!data.length) {
        setGeocodeError('No match for that address. You can still save without coords.');
        return;
      }
      setPOForm(prev => ({ ...prev, latitude: data[0].lat, longitude: data[0].lon }));
    } catch (e: any) {
      setGeocodeError(e?.message || 'Lookup failed.');
    } finally {
      setGeocoding(false);
    }
  };

  const savePO = () => {
    if (!poForm.poNumber || !poForm.address) return;
    const latRaw = poForm.latitude.trim();
    const lngRaw = poForm.longitude.trim();
    const lat = latRaw ? parseFloat(latRaw) : NaN;
    const lng = lngRaw ? parseFloat(lngRaw) : NaN;
    setPOs(prev => [
      ...prev,
      {
        id: `po-${Date.now()}`,
        poNumber: poForm.poNumber,
        address: poForm.address,
        latitude: Number.isFinite(lat) ? lat : undefined,
        longitude: Number.isFinite(lng) ? lng : undefined,
        contactName: poForm.contactName,
        contactPhone: poForm.contactPhone,
        notes: poForm.notes,
        status: 'Active',
        createdAt: new Date().toISOString(),
      },
    ]);
    setPOForm({ poNumber: '', address: '', contactName: '', contactPhone: '', latitude: '', longitude: '', notes: '' });
    setGeocodeError(null);
    setShowPOForm(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <div className="text-xl font-semibold">Admin</div>
          <div className="text-sm text-zinc-500">Manage users, PO jobs, and audit history</div>
        </div>
        <button onClick={onOpenHistory} className="text-sm text-emerald-400">View transaction history →</button>
      </div>

      <section>
        <div className="flex justify-between items-center mb-3">
          <div className="font-semibold">Users {users.length > 0 && <span className="text-xs text-zinc-500 ml-1">({users.length})</span>}</div>
          <button onClick={openCreateUser} className="px-3 py-1.5 bg-emerald-600 rounded-xl text-xs">+ New User</button>
        </div>

        {inviteFlash && (
          <div className={`mb-3 px-4 py-2.5 rounded-xl text-sm border ${
            inviteFlash.startsWith('✉️') ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200' : 'bg-amber-950/40 border-amber-800 text-amber-200'
          }`}>
            {inviteFlash}
          </div>
        )}

        {showUserForm && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-4 space-y-3">
            <input placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as User['role'] })}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <input placeholder="Phone (optional)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm" />
            </div>
            <input placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm" />
            <input
              placeholder="Username (optional, 3–32 chars)"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm" />
            <input
              placeholder={editingId ? 'New password (leave blank to keep current)' : 'Password (leave blank to send invite email)'}
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm" />

            {form.role === 'Foreman' && (
              <select value={form.assignedPO} onChange={e => setForm({ ...form, assignedPO: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm">
                <option value="">No PO assigned</option>
                {pos.map(p => <option key={p.id} value={p.poNumber}>{p.poNumber}</option>)}
              </select>
            )}

            {formError && (
              <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900 rounded-xl px-3 py-2">
                {formError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={saveUser}
                disabled={submitting}
                className="flex-1 py-3 bg-white text-black rounded-xl font-medium text-sm disabled:opacity-50"
              >
                {submitting ? 'Saving…' : (editingId ? 'Save Changes' : 'Create User')}
              </button>
              <button onClick={() => { setShowUserForm(false); setEditingId(null); }} className="flex-1 py-3 border border-zinc-700 rounded-xl text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {loadingUsers ? (
          <div className="text-zinc-500 text-sm">Loading users…</div>
        ) : usersError ? (
          <div className="text-rose-400 text-sm">{usersError}</div>
        ) : (
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex justify-between items-center bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4">
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-2 flex-wrap">
                    {u.name}
                    {u.role === 'Foreman' && u.assignedPO && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900 text-emerald-400">{u.assignedPO}</span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {u.role} · {u.email}
                    {u.username && <span className="text-zinc-400"> · @{u.username}</span>}
                  </div>
                </div>
                <div className="flex gap-4 text-sm shrink-0">
                  <button onClick={() => openEditUser(u)} className="text-emerald-400">Edit</button>
                  {u.id !== currentUser.id && (
                    <button onClick={() => deleteUser(u.id)} className="text-red-400">Remove</button>
                  )}
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div className="text-center py-6 text-zinc-500 text-sm">No users yet. Click + New User to add one.</div>
            )}
          </div>
        )}
      </section>

      <section>
        <div className="flex justify-between items-center mb-3">
          <div className="font-semibold">PO# Jobs</div>
          <button onClick={() => setShowPOForm(!showPOForm)} className="px-3 py-1.5 bg-emerald-600 rounded-xl text-xs">+ New PO</button>
        </div>

        {showPOForm && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-4 space-y-3">
            <input placeholder="PO# (e.g. WinSport)" value={poForm.poNumber} onChange={e => setPOForm({ ...poForm, poNumber: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm" />
            <input placeholder="Address" value={poForm.address} onChange={e => setPOForm({ ...poForm, address: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm" />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[2px] text-zinc-500">Coordinates (optional)</span>
                <button
                  type="button"
                  onClick={geocodeAddress}
                  disabled={geocoding}
                  className="text-xs text-emerald-400 hover:text-emerald-300 disabled:text-zinc-600"
                >
                  {geocoding ? 'Looking up…' : '📍 Auto-fill from address'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Latitude (optional)"  value={poForm.latitude}  onChange={e => setPOForm({ ...poForm, latitude:  e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm" />
                <input placeholder="Longitude (optional)" value={poForm.longitude} onChange={e => setPOForm({ ...poForm, longitude: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm" />
              </div>
              {geocodeError && (
                <div className="text-xs text-amber-300">{geocodeError}</div>
              )}
              <div className="text-[11px] text-zinc-500">
                Coords are only needed if you want this PO to appear on the City Map.
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Contact name" value={poForm.contactName} onChange={e => setPOForm({ ...poForm, contactName: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm" />
              <input placeholder="Contact phone" value={poForm.contactPhone} onChange={e => setPOForm({ ...poForm, contactPhone: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm" />
            </div>
            <textarea placeholder="Notes" value={poForm.notes} onChange={e => setPOForm({ ...poForm, notes: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm" />
            <button onClick={savePO} className="w-full py-3 bg-white text-black rounded-xl font-medium text-sm">Create PO</button>
          </div>
        )}

        <div className="space-y-2">
          {pos.map(p => {
            const foreman = users.find(u => u.id === p.foremanId);
            return (
              <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{p.poNumber}</div>
                    <div className="text-xs text-zinc-500">{p.address}</div>
                  </div>
                  <div className="text-xs text-zinc-400 text-right shrink-0">
                    {foreman ? `Foreman: ${foreman.name}` : 'No foreman'}<br />
                    <span className="text-zinc-600 font-mono">
                      {typeof p.latitude === 'number' && typeof p.longitude === 'number'
                        ? `${p.latitude.toFixed(3)}, ${p.longitude.toFixed(3)}`
                        : 'no coords'}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center gap-3 mt-3 pt-3 border-t border-zinc-800">
                  <select
                    value={p.status}
                    onChange={e => changePOStatus(p.id, e.target.value as POJob['status'])}
                    className={`text-[11px] font-medium px-3 py-1.5 rounded-full border focus:outline-none ${
                      p.status === 'Active'    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : p.status === 'On Hold' ? 'bg-amber-950 text-amber-300 border-amber-800'
                                               : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    }`}
                  >
                    {PO_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button
                    onClick={() => deletePO(p)}
                    className="text-xs text-rose-400 hover:text-rose-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
          {pos.length === 0 && (
            <div className="text-center py-8 text-zinc-500 text-sm">No PO# jobs.</div>
          )}
        </div>
      </section>
    </div>
  );
}
