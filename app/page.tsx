'use client';

import React, { useCallback, useEffect, useState } from 'react';
import BottomNav from './components/BottomNav';
import POJobs from './components/POJobs';
import Inventory from './components/Inventory';
import Transfers from './components/Transfers';
import DailyReports from './components/DailyReports';
import CityMap from './components/CityMap';
import AdminPanel from './components/AdminPanel';
import MaterialOrders from './components/MaterialOrders';
import Dashboard from './components/Dashboard';
import Deliveries from './components/Deliveries';
import TransactionHistory from './components/TransactionHistory';
import Notifications from './components/Notifications';
import AuthScreen from './components/AuthScreen';

import type { InventoryItem, MaterialOrder, POJob, Transaction, User } from '@/lib/types';
import { seedInventory, seedPOs, seedTransactions } from '@/lib/seed';
import { usePersistedState } from '@/lib/persistence';
import { makeTransaction, normalizeInventoryItem } from '@/lib/util';
import { api, getToken, setToken, ApiError } from '@/lib/api';

export type Tab =
  | 'dashboard'
  | 'map'
  | 'jobs'
  | 'inventory'
  | 'orders'
  | 'deliveries'
  | 'transfers'
  | 'reports'
  | 'admin'
  | 'history';

type AuthState =
  | { kind: 'loading' }
  | { kind: 'setup' }
  | { kind: 'login' }
  | { kind: 'authed'; user: User };

export default function InsulTracApp() {
  const [auth, setAuth] = useState<AuthState>({ kind: 'loading' });

  const [pos, setPOs] = usePersistedState<POJob[]>('insultrac-pos', seedPOs);
  const [inventory, setInventory] = usePersistedState<InventoryItem[]>('insultrac-inventory', seedInventory);
  const [transactions, setTransactions] = usePersistedState<Transaction[]>('insultrac-transactions', seedTransactions);
  const [orders, setOrders] = usePersistedState<MaterialOrder[]>('insultrac-orders', []);

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // Inventory shape migration (carries over from earlier sessions).
  useEffect(() => {
    const broken = inventory.some(i => !i.specs || !i.category || !i.updatedAt || !i.updatedBy);
    if (!broken) return;
    setInventory(prev => prev.map(normalizeInventoryItem));
  }, [inventory, setInventory]);

  // Boot: check session token → /me, else decide setup vs login.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getToken();
      if (token) {
        try {
          const r = await api.me();
          if (!cancelled) setAuth({ kind: 'authed', user: r.user });
          return;
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) setToken(null);
        }
      }
      try {
        const r = await api.setupNeeded();
        if (!cancelled) setAuth({ kind: r.needed ? 'setup' : 'login' });
      } catch {
        if (!cancelled) setAuth({ kind: 'login' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onAuthed = useCallback((user: User) => {
    setAuth({ kind: 'authed', user });
    if (user.role === 'Foreman') setActiveTab('jobs');
    else if (user.role === 'Delivery Driver') setActiveTab('deliveries');
    else setActiveTab('dashboard');
  }, []);

  const addTransaction = (tx: Parameters<typeof makeTransaction>[0]) => {
    setTransactions(prev => [makeTransaction(tx), ...prev].slice(0, 1000));
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore — we clear locally either way
    }
    setToken(null);
    setAuth({ kind: 'login' });
  };

  if (auth.kind === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-zinc-500 text-sm">Loading…</div>
      </div>
    );
  }

  if (auth.kind === 'setup' || auth.kind === 'login') {
    return <AuthScreen mode={auth.kind} onAuthed={onAuthed} />;
  }

  const currentUser = auth.user;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard currentUser={currentUser} pos={pos} inventory={inventory} transactions={transactions} onJump={setActiveTab} />;
      case 'map':
        return (
          <CityMap
            inventory={inventory}
            pos={pos}
            currentUser={currentUser}
            addTransaction={addTransaction}
            setInventory={setInventory}
            orders={orders}
            setOrders={setOrders}
          />
        );
      case 'jobs':
        return <POJobs inventory={inventory} setInventory={setInventory} pos={pos} currentUser={currentUser} />;
      case 'inventory':
        return <Inventory inventory={inventory} setInventory={setInventory} pos={pos} currentUser={currentUser} addTransaction={addTransaction} />;
      case 'orders':
        return (
          <MaterialOrders
            orders={orders}
            setOrders={setOrders}
            pos={pos}
            currentUser={currentUser}
            inventory={inventory}
            setInventory={setInventory}
            addTransaction={addTransaction}
          />
        );
      case 'deliveries':
        return (
          <Deliveries
            orders={orders}
            setOrders={setOrders}
            pos={pos}
            currentUser={currentUser}
            inventory={inventory}
            setInventory={setInventory}
            addTransaction={addTransaction}
          />
        );
      case 'transfers':
        return <Transfers inventory={inventory} setInventory={setInventory} currentUser={currentUser} addTransaction={addTransaction} />;
      case 'reports':
        return <DailyReports inventory={inventory} setInventory={setInventory} pos={pos} currentUser={currentUser} addTransaction={addTransaction} />;
      case 'admin':
        return <AdminPanel pos={pos} setPOs={setPOs} currentUser={currentUser} onOpenHistory={() => setActiveTab('history')} />;
      case 'history':
        return <TransactionHistory transactions={transactions} pos={pos} />;
      default:
        return <Dashboard currentUser={currentUser} pos={pos} inventory={inventory} transactions={transactions} onJump={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-16">
      <div className="sticky top-0 z-40 bg-zinc-950 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/insultrac-logo.png"
            alt="InsulTrac"
            className="h-7 w-auto invert"
          />
          <p className="text-[10px] text-zinc-500 mt-1">Mechanical Insulation · Field Ops</p>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <Notifications currentUser={currentUser} transactions={transactions} orders={orders} />
          <div className="text-right">
            <div className="text-emerald-400">{currentUser.name}</div>
            <div className="text-[10px] text-zinc-500">{currentUser.role}</div>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 py-1 text-xs rounded-full border border-zinc-700 hover:bg-zinc-900"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="p-4 max-w-3xl mx-auto">{renderTabContent()}</div>

      <BottomNav
        activeTab={activeTab}
        onTabChange={tab => setActiveTab(tab as Tab)}
        role={currentUser.role}
      />
    </div>
  );
}
