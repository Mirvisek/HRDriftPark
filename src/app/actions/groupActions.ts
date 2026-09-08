'use server';

import { db } from "@/db";
import { userGroups, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

const DEFAULT_SYSTEM_GROUPS = [
  {
    id: 1,
    name: 'Właściciel',
    roleKey: 'owner',
    permissions: 'schedule:view,schedule:edit,timesheet:view_own,timesheet:view_all,timesheet:edit_all,tasks:view,tasks:edit,payroll:view,settings:edit,users:manage,push:send,inventory:view,inventory:deliver,inventory:issue,inventory:inventory,inventory:manage',
    isSystem: true,
  },
  {
    id: 2,
    name: 'Menedżer',
    roleKey: 'manager',
    permissions: 'schedule:view,schedule:edit,timesheet:view_own,timesheet:view_all,timesheet:edit_all,tasks:view,tasks:edit,payroll:view,users:manage,push:send,inventory:view,inventory:deliver,inventory:issue,inventory:inventory',
    isSystem: true,
  },
  {
    id: 3,
    name: 'Technik',
    roleKey: 'technik',
    permissions: 'schedule:view,timesheet:view_own,tasks:view,tasks:edit,push:send,inventory:view,inventory:deliver,inventory:issue,inventory:inventory,inventory:manage',
    isSystem: true,
  },
  {
    id: 4,
    name: 'Pracownik Toru',
    roleKey: 'employee',
    permissions: 'schedule:view,timesheet:view_own,tasks:view,inventory:view,inventory:inventory',
    isSystem: true,
  },
];

async function checkAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Brak autoryzacji.");
  }
  if (!hasPermission(session.user, 'users:manage') && !hasPermission(session.user, 'settings:edit')) {
    throw new Error("Brak uprawnień do zarządzania grupami.");
  }
  return session;
}

/**
 * Pobiera wszystkie grupy użytkowników z bazy danych
 */
export async function getUserGroupsAction() {
  try {
    await checkAuth();
    const groups = await db.select().from(userGroups);
    if (groups.length === 0) {
      return { success: true, data: DEFAULT_SYSTEM_GROUPS };
    }
    return { success: true, data: groups };
  } catch (e: any) {
    console.error("Błąd pobierania grup użytkowników:", e);
    return { success: true, data: DEFAULT_SYSTEM_GROUPS };
  }
}

/**
 * Tworzy nową grupę lub aktualizuje istniejącą (zapisuje nazwę i matrycę uprawnień)
 */
export async function saveUserGroupAction(groupData: {
  id?: number;
  name: string;
  roleKey?: string;
  permissions: string;
}) {
  try {
    await checkAuth();

    const { id, name, roleKey, permissions } = groupData;
    if (!name.trim()) {
      return { success: false, error: "Nazwa grupy jest wymagana." };
    }

    const cleanRoleKey = (roleKey || name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, '_');

    const cleanPermissions = permissions
      .split(',')
      .map(p => p.trim())
      .filter(Boolean)
      .join(',');

    if (id) {
      // Edycja istniejącej grupy
      const existing = await db.select().from(userGroups).where(eq(userGroups.id, id)).limit(1);
      if (existing.length === 0) {
        return { success: false, error: "Grupa nie istnieje." };
      }

      await db
        .update(userGroups)
        .set({
          name: name.trim(),
          permissions: cleanPermissions,
        })
        .where(eq(userGroups.id, id));

      console.log(`[GroupActions] Zaktualizowano grupę ID ${id}: ${name}`);
      return { success: true };
    } else {
      // Tworzenie nowej grupy
      const existingKey = await db.select().from(userGroups).where(eq(userGroups.roleKey, cleanRoleKey)).limit(1);
      if (existingKey.length > 0) {
        return { success: false, error: "Grupa o takim kluczu roli już istnieje." };
      }

      await db.insert(userGroups).values({
        name: name.trim(),
        roleKey: cleanRoleKey,
        permissions: cleanPermissions,
        isSystem: false,
      });

      console.log(`[GroupActions] Utworzono nową grupę: ${name} (${cleanRoleKey})`);
      return { success: true };
    }
  } catch (e: any) {
    console.error("Błąd zapisu grupy:", e);
    return { success: false, error: "Błąd bazy danych przy zapisie grupy." };
  }
}

/**
 * Usuwa customową grupę użytkowników (zabezpieczenie przed usunięciem grup systemowych)
 */
export async function deleteUserGroupAction(groupId: number) {
  try {
    await checkAuth();

    const existing = await db.select().from(userGroups).where(eq(userGroups.id, groupId)).limit(1);
    if (existing.length === 0) {
      return { success: false, error: "Grupa nie istnieje." };
    }

    if (existing[0].isSystem) {
      return { success: false, error: "Nie można usunąć domyślnej grupy systemowej." };
    }

    await db.delete(userGroups).where(eq(userGroups.id, groupId));
    console.log(`[GroupActions] Usunięto grupę ID ${groupId}`);
    return { success: true };
  } catch (e: any) {
    console.error("Błąd usuwania grupy:", e);
    return { success: false, error: "Błąd bazy danych przy usuwaniu grupy." };
  }
}
