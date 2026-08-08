/**
 * Definicja wszystkich granularnych uprawnień w systemie.
 */
export const PERMISSIONS = {
  SCHEDULE_VIEW: 'schedule:view',
  SCHEDULE_EDIT: 'schedule:edit',
  TIMESHEET_VIEW_OWN: 'timesheet:view_own',
  TIMESHEET_VIEW_ALL: 'timesheet:view_all',
  TIMESHEET_EDIT_ALL: 'timesheet:edit_all',
  TASKS_VIEW: 'tasks:view',
  TASKS_EDIT: 'tasks:edit',
  PAYROLL_VIEW: 'payroll:view',
  SETTINGS_EDIT: 'settings:edit',
  USERS_MANAGE: 'users:manage',
  PUSH_SEND: 'push:send',
  INVENTORY_VIEW: 'inventory:view',
  INVENTORY_DELIVER: 'inventory:deliver',
  INVENTORY_ISSUE: 'inventory:issue',
  INVENTORY_INVENTORY: 'inventory:inventory',
  INVENTORY_MANAGE: 'inventory:manage',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  'schedule:view': 'Podgląd grafiku pracy',
  'schedule:edit': 'Układanie i automatyczne generowanie grafiku',
  'timesheet:view_own': 'Wprowadzanie i edycja własnej karty godzin',
  'timesheet:view_all': 'Podgląd kart godzin wszystkich pracowników',
  'timesheet:edit_all': 'Modyfikacja i akceptacja kart godzin wszystkich',
  'tasks:view': 'Podgląd codziennych zadań na zmianę',
  'tasks:edit': 'Zarządzanie listą zadań i szablonami tygodniowymi',
  'payroll:view': 'Dostęp do rozliczeń płacowych i finansów',
  'settings:edit': 'Dostęp do ustawień SMTP i szablonów powiadomień',
  'users:manage': 'Zarządzanie profilami pracowników i reset haseł',
  'push:send': 'Wysyłanie ręcznych powiadomień push',
  'inventory:view': 'Podgląd stanu magazynu, historii i dashboardu',
  'inventory:deliver': 'Przyjmowanie i rejestrowanie dostaw',
  'inventory:issue': 'Wydawanie produktów na lokale (tory/kluby)',
  'inventory:inventory': 'Przeprowadzanie inwentaryzacji (pełnych i wybiórczych)',
  'inventory:manage': 'Zarządzanie katalogiem produktów, kategoriami i korektami',
};

/**
 * Sprawdza, czy zalogowany użytkownik ma dane uprawnienie.
 * Właściciel (rola 'owner') ma zawsze pełny dostęp do wszystkiego.
 */
export function hasPermission(user: any, permission: PermissionKey): boolean {
  if (!user) return false;
  if (user.role === 'owner') return true;

  const userPermsString = user.permissions || '';
  const userPermsArray = userPermsString.split(',').map((p: string) => p.trim());
  return userPermsArray.includes(permission);
}
