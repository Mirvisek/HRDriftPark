'use client';

import {
  Users,
  Settings as SettingsIcon,
  Shield,
  ClipboardList,
  Building,
  Globe,
  Lock,
} from 'lucide-react';
import { hasPermission } from '@/lib/permissions';

export type SettingsTab =
  | 'users'
  | 'groups'
  | 'smtp'
  | 'tasks'
  | 'venues'
  | 'site'
  | 'audit'
  | 'backup';

interface SettingsTabNavProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  user: unknown;
}

export default function SettingsTabNav({ activeTab, onTabChange, user }: SettingsTabNavProps) {
  const role = (user as any)?.role;
  return (
    <div className="flex border-b border-white/10 gap-2">
      {hasPermission(user as any, 'users:manage') && (
        <button
          onClick={() => onTabChange('users')}
          className={`px-5 py-3 text-xs uppercase tracking-wider font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'users'
              ? 'border-brand-gold text-white bg-white/5 rounded-t-lg'
              : 'border-transparent text-[#a0a0a0] hover:text-white hover:bg-white/2'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Użytkownicy</span>
        </button>
      )}
      {hasPermission(user as any, 'users:manage') && (
        <button
          onClick={() => onTabChange('groups')}
          className={`px-5 py-3 text-xs uppercase tracking-wider font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'groups'
              ? 'border-brand-gold text-white bg-white/5 rounded-t-lg'
              : 'border-transparent text-[#a0a0a0] hover:text-white hover:bg-white/2'
          }`}
        >
          <Shield className="w-4 h-4 text-brand-gold" />
          <span>Grupy & Uprawnienia</span>
        </button>
      )}
      {hasPermission(user as any, 'settings:edit') && (
        <button
          onClick={() => onTabChange('smtp')}
          className={`px-5 py-3 text-xs uppercase tracking-wider font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'smtp'
              ? 'border-brand-gold text-white bg-white/5 rounded-t-lg'
              : 'border-transparent text-[#a0a0a0] hover:text-white hover:bg-white/2'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>SMTP & E-mail</span>
        </button>
      )}
      {hasPermission(user as any, 'tasks:edit') && (
        <button
          onClick={() => onTabChange('tasks')}
          className={`px-5 py-3 text-xs uppercase tracking-wider font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'tasks'
              ? 'border-brand-gold text-white bg-white/5 rounded-t-lg'
              : 'border-transparent text-[#a0a0a0] hover:text-white hover:bg-white/2'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Szablony zadań</span>
        </button>
      )}
      {hasPermission(user as any, 'settings:edit') && (
        <button
          onClick={() => onTabChange('venues')}
          className={`px-5 py-3 text-xs uppercase tracking-wider font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'venues'
              ? 'border-brand-gold text-white bg-white/5 rounded-t-lg'
              : 'border-transparent text-[#a0a0a0] hover:text-white hover:bg-white/2'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Lokale</span>
        </button>
      )}
      {hasPermission(user as any, 'settings:edit') && (
        <button
          onClick={() => onTabChange('site')}
          className={`px-5 py-3 text-xs uppercase tracking-wider font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'site'
              ? 'border-brand-gold text-white bg-white/5 rounded-t-lg'
              : 'border-transparent text-[#a0a0a0] hover:text-white hover:bg-white/2'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Ustawienia Strony</span>
        </button>
      )}
      {hasPermission(user as any, 'settings:edit') && (
        <button
          onClick={() => onTabChange('audit')}
          className={`px-5 py-3 text-xs uppercase tracking-wider font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'audit'
              ? 'border-brand-gold text-white bg-white/5 rounded-t-lg'
              : 'border-transparent text-[#a0a0a0] hover:text-white hover:bg-white/2'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Audyt Zdarzeń</span>
        </button>
      )}
      {role === 'owner' && (
        <button
          onClick={() => onTabChange('backup')}
          className={`px-5 py-3 text-xs uppercase tracking-wider font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'backup'
              ? 'border-brand-gold text-white bg-white/5 rounded-t-lg'
              : 'border-transparent text-[#a0a0a0] hover:text-white hover:bg-white/2'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Kopia Zapasowa & Bezpieczeństwo</span>
        </button>
      )}
    </div>
  );
}
