'use server';

import { db } from "@/db";
import { alerts } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

export async function getAlertsAction(severityFilter?: string, statusFilter: string = 'open') {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const venueId = (session.user as any).venueId || 1;
  const isDemo = (session.user as any).isDemo === true;

  try {
    const list = await db
      .select()
      .from(alerts)
      .where(and(
        eq(alerts.isDemo, isDemo),
        statusFilter ? eq(alerts.status, statusFilter as any) : undefined
      ))
      .orderBy(desc(alerts.createdAt));

    return { success: true, data: list };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function resolveAlertAction(alertId: number, status: 'acknowledged' | 'resolved' | 'dismissed', reasonCode?: string, reasonText?: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const userId = Number((session.user as any).id);

  try {
    await db
      .update(alerts)
      .set({
        status,
        resolvedBy: userId,
        resolvedAt: new Date(),
        reasonCode,
        reasonText
      })
      .where(eq(alerts.id, alertId));

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
