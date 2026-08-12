'use server';

import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

export interface AuditLogEntry {
  id: number;
  userId: number | null;
  executorName?: string;
  tableName: string;
  recordId: number;
  action: string;
  oldData: string | null;
  newData: string | null;
  createdAt: Date | null;
}

export async function getAuditLogsAction(limit: number = 100) {
  const session = await auth();
  if (!session?.user || !hasPermission(session.user, 'settings:edit')) {
    return { success: false, data: [], error: "Brak uprawnień do przeglądania logów audytowych." };
  }

  try {
    const logs = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        executorName: users.displayName,
        tableName: auditLogs.entityType,
        recordId: auditLogs.entityId,
        action: auditLogs.action,
        oldData: auditLogs.oldValue,
        newData: auditLogs.newValue,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    return { success: true, data: logs as AuditLogEntry[] };
  } catch (e: any) {
    console.error("Błąd pobierania logów audytowych:", e);
    return { success: false, data: [], error: e.message };
  }
}

export async function purgeOldAuditLogsAction(monthsOld: number = 6) {
  const session = await auth();
  if (!session?.user || !hasPermission(session.user, 'settings:edit')) {
    return { success: false, error: "Brak uprawnień." };
  }

  try {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - monthsOld);

    await db.delete(auditLogs).where(sql`created_at < ${cutoff}`);
    return { success: true };
  } catch (e: any) {
    console.error("Błąd podczas czyszczenia logów audytu:", e);
    return { success: false, error: e.message };
  }
}
