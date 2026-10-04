'use client';

import {
  Package,
  Layers,
  ClipboardCheck,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { WarehouseTabId } from './types';

type WarehouseTabNavProps = {
  activeTab: WarehouseTabId;
  canDeliver: boolean;
  canIssue: boolean;
  canInventory: boolean;
  canManage: boolean;
  onTabChange: (tab: WarehouseTabId) => void;
};

export function WarehouseTabNav({
  activeTab,
  canDeliver,
  canIssue,
  canInventory,
  canManage,
  onTabChange,
}: WarehouseTabNavProps) {
  const tabs: { id: WarehouseTabId; label: string; icon: LucideIcon }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
    { id: 'products', label: 'Katalog produktów', icon: Package },
    ...(canDeliver ? [{ id: 'deliveries' as const, label: 'Dostawy / Przyjęcia', icon: ArrowUpRight }] : []),
    ...(canIssue ? [{ id: 'issues' as const, label: 'Wydania na lokale', icon: ArrowDownRight }] : []),
    ...(canInventory ? [{ id: 'inventories' as const, label: 'Inwentaryzacje', icon: ClipboardCheck }] : []),
    ...(canManage ? [{ id: 'categories' as const, label: 'Kategorie', icon: Layers }] : []),
    { id: 'history', label: 'Historia operacji', icon: Clock },
  ];

  return (
    <div className="flex border-b border-white/5 overflow-x-auto gap-2 scrollbar-thin">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-5 py-3 text-xs uppercase tracking-wider font-bold transition border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-brand-gold text-white bg-white/5 rounded-t-xl'
                : 'border-transparent text-[#888] hover:text-white hover:bg-white/2'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
