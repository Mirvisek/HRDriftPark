import { db } from "@/db";
import { auditLogs } from "@/db/schema";

/**
 * Zapis śladu audytu. To nie jest server action — wołają ją tylko akcje serwerowe
 * po sprawdzeniu sesji.
 */
export async function logAuditEvent(
  userId: number | null,
  entityType: string,
  entityId: number,
  action: "UPDATE" | "DELETE" | "INSERT" | "CORRECTION" | "TRANSITION",
  oldValue: unknown,
  newValue: unknown
) {
  try {
    await db.insert(auditLogs).values({
      userId,
      entityType,
      entityId,
      action,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
    });
  } catch (e) {
    console.error("[Audit Log Error] Failed to write audit log:", e);
  }
}
