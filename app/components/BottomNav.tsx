'use client';

import type { Role } from '@/lib/types';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  role: Role;
}

const ALL_TABS = [
  { id: 'dashboard',  label: 'Home',      icon: '🏠', roles: ['Admin', 'Foreman', 'Delivery Driver', 'Employee'] as Role[] },
  { id: 'map',        label: 'Map',       icon: '🗺️', roles: ['Admin', 'Foreman', 'Delivery Driver', 'Employee'] as Role[] },
  { id: 'jobs',       label: 'PO# Jobs',  icon: '📁', roles: ['Admin', 'Foreman', 'Employee'] as Role[] },
  { id: 'inventory',  label: 'Inventory', icon: '📦', roles: ['Admin', 'Foreman', 'Delivery Driver', 'Employee'] as Role[] },
  { id: 'orders',     label: 'Orders',    icon: '🛒', roles: ['Admin', 'Foreman'] as Role[] },
  { id: 'deliveries', label: 'Deliveries',icon: '🚚', roles: ['Admin', 'Delivery Driver', 'Foreman'] as Role[] },
  { id: 'transfers',  label: 'Transfers', icon: '🔄', roles: ['Admin', 'Foreman', 'Delivery Driver'] as Role[] },
  { id: 'reports',    label: 'Reports',   icon: '📝', roles: ['Admin', 'Foreman'] as Role[] },
  { id: 'admin',      label: 'Admin',     icon: '⚙️', roles: ['Admin'] as Role[] },
];

export default function BottomNav({ activeTab, onTabChange, role }: BottomNavProps) {
  const tabs = ALL_TABS.filter(t => t.roles.includes(role));
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 flex justify-around py-2 z-50 overflow-x-auto">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex flex-col items-center px-2 py-1 text-[11px] transition-colors min-w-[56px] ${
            activeTab === tab.id ? 'text-emerald-400' : 'text-zinc-400'
          }`}
        >
          <div className="text-xl mb-0.5">{tab.icon}</div>
          <div>{tab.label}</div>
        </button>
      ))}
    </div>
  );
}
