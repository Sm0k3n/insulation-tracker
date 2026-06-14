'use client';

import {
  Home,
  Map,
  ClipboardList,
  Boxes,
  ShoppingCart,
  Truck,
  ArrowLeftRight,
  BarChart3,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/lib/types';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  role: Role;
}

interface TabDef {
  id: string;
  label: string;
  Icon: LucideIcon;
  roles: Role[];
}

const ALL_TABS: TabDef[] = [
  { id: 'dashboard',  label: 'Home',       Icon: Home,           roles: ['Admin', 'Foreman', 'Delivery Driver', 'Employee'] },
  { id: 'map',        label: 'Map',        Icon: Map,            roles: ['Admin', 'Foreman', 'Delivery Driver', 'Employee'] },
  { id: 'jobs',       label: 'PO# Jobs',   Icon: ClipboardList,  roles: ['Admin', 'Foreman', 'Employee'] },
  { id: 'inventory',  label: 'Inventory',  Icon: Boxes,          roles: ['Admin', 'Foreman', 'Delivery Driver', 'Employee'] },
  { id: 'orders',     label: 'Orders',     Icon: ShoppingCart,   roles: ['Admin', 'Foreman'] },
  { id: 'deliveries', label: 'Deliveries', Icon: Truck,          roles: ['Admin', 'Delivery Driver', 'Foreman'] },
  { id: 'transfers',  label: 'Transfers',  Icon: ArrowLeftRight, roles: ['Admin', 'Foreman', 'Delivery Driver'] },
  { id: 'reports',    label: 'Reports',    Icon: BarChart3,      roles: ['Admin', 'Foreman'] },
  { id: 'admin',      label: 'Admin',      Icon: Settings,       roles: ['Admin'] },
];

export default function BottomNav({ activeTab, onTabChange, role }: BottomNavProps) {
  const tabs = ALL_TABS.filter(t => t.roles.includes(role));
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 flex justify-around py-2 z-50 overflow-x-auto">
      {tabs.map(tab => {
        const active = activeTab === tab.id;
        const Icon = tab.Icon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center px-2 py-1 text-[11px] transition-colors min-w-[56px] ${
              active ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Icon className="h-6 w-6 mb-0.5" strokeWidth={active ? 2.25 : 1.75} />
            <div>{tab.label}</div>
          </button>
        );
      })}
    </div>
  );
}
