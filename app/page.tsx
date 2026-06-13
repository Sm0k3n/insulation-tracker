'use client';

import React, { useEffect, useState } from 'react';
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

import type { InventoryItem, MaterialOrder, POJob, Transaction, User } from '@/lib/types';
import { seedInventory, seedPOs, seedUsers, seedTransactions } from '@/lib/seed';
import { usePersistedState } from '@/lib/persistence';
import { makeTransaction, normalizeInventoryItem } from '@/lib/util';

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

export default function InsulTrackApp() {
  const [currentUser, setCurrentUser] = usePersistedState<User | null>('insultrack-currentUser', null);
  const [users, setUsers] = usePersistedState<User[]>('insultrack-users', seedUsers);
  const [pos, setPOs] = usePersistedState<POJob[]>('insultrack-pos', seedPOs);
  const [inventory, setInventory] = usePersistedState<InventoryItem[]>('insultrack-inventory', seedInventory);
  const [transactions, setTransactions] = usePersistedState<Transaction[]>('insultrack-transactions', seedTransactions);
  const [orders, setOrders] = usePersistedState<MaterialOrder[]>('insultrack-orders', []);

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // One-shot migration: backfill any pre-Session-1 inventory item that lacks
  // `specs`, `category`, etc. so old localStorage data doesn't crash the UI.
  useEffect(() => {
    const broken = inventory.some(i => !i.specs || !i.category || !i.updatedAt || !i.updatedBy);
    if (!broken) return;
    setInventory(prev => prev.map(normalizeInventoryItem));
  }, [inventory, setInventory]);

  const addTransaction = (tx: Parameters<typeof makeTransaction>[0]) => {
    setTransactions(prev => [makeTransaction(tx), ...prev].slice(0, 1000));
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'Foreman') setActiveTab('jobs');
    else if (user.role === 'Delivery Driver') setActiveTab('deliveries');
    else if (user.role === 'Admin') setActiveTab('dashboard');
    else setActiveTab('map');
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-semibold tracking-tighter">InsulTrack</h1>
            <p className="text-zinc-500 mt-2">Mechanical Insulation Field Operations</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
            <div className="text-sm text-zinc-400 mb-4 text-center">Select your account to continue</div>

            <div className="space-y-2">
              {users.map(user => (
                <button
                  key={user.id}
                  onClick={() => handleLogin(user)}
                  className="w-full flex justify-between items-center bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-2xl px-5 py-4 text-left transition-colors"
                >
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-zinc-500">
                      {user.role}
                      {user.assignedPO && ` · ${user.assignedPO}`}
                    </div>
                  </div>
                  <div className="text-emerald-400 text-sm">Login →</div>
                </button>
              ))}
            </div>

            <div className="mt-6 text-center text-xs text-zinc-500">
              Admin can add accounts in Admin tab (log in as Taylor Kim)
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser.role === 'Admin';
  const isDriver = currentUser.role === 'Delivery Driver';

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
        return <AdminPanel users={users} setUsers={setUsers} pos={pos} setPOs={setPOs} currentUser={currentUser} onOpenHistory={() => setActiveTab('history')} />;
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
          <h1 className="text-xl font-semibold tracking-tight">InsulTrack</h1>
          <p className="text-xs text-zinc-500">Mechanical Insulation · Field Ops</p>
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
