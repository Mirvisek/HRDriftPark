'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import SettingsTabNav, { SettingsTab } from './SettingsTabNav';
import UsersTab from './tabs/UsersTab';
import GroupsTab from './tabs/GroupsTab';
import SmtpTab from './tabs/SmtpTab';
import TasksTab from './tabs/TasksTab';
import VenuesTab from './tabs/VenuesTab';
import SiteTab from './tabs/SiteTab';
import AuditTab from './tabs/AuditTab';
import BackupTab from './tabs/BackupTab';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>('users');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      const user = session?.user;
      if (hasPermission(user, 'users:manage')) {
        setActiveTab('users');
      } else if (hasPermission(user, 'settings:edit')) {
        setActiveTab('smtp');
      } else if (hasPermission(user, 'tasks:edit')) {
        setActiveTab('tasks');
      } else {
        router.push('/dashboard');
      }
    }
  }, [status, session, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-gold"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-white font-display">
          USTAWIENIA <span className="text-brand-gold">SYSTEMOWE</span>
        </h2>
        <p className="text-xs text-[#a0a0a0] mt-1">
          Zarządzaj kontami pracowników toru oraz konfiguracją powiadomień e-mail.
        </p>
      </div>

      <SettingsTabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={session?.user}
      />

      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'groups' && <GroupsTab />}
      {activeTab === 'smtp' && <SmtpTab />}
      {activeTab === 'tasks' && <TasksTab />}
      {activeTab === 'venues' && <VenuesTab />}
      {activeTab === 'site' && <SiteTab />}
      {activeTab === 'audit' && <AuditTab />}
      {activeTab === 'backup' && <BackupTab />}
    </div>
  );
}
