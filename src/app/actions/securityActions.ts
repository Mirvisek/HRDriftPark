'use server';

import { db } from "@/db";
import { userSessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import { revokeUserSessions } from "@/lib/sessionGuard";

export async function getUserSessionsAction() {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const userId = Number((session.user as any).id);

  try {
    const list = await db
      .select({
        id: userSessions.id,
        userAgent: userSessions.userAgent,
        ipAddress: userSessions.ipAddress,
        expiresAt: userSessions.expiresAt,
        createdAt: userSessions.createdAt,
      })
      .from(userSessions)
      .where(and(eq(userSessions.userId, userId), eq(userSessions.isValid, true)));

    return { success: true, data: list };
  } catch (e: any) {
    console.error("Błąd listy sesji:", e);
    return { success: false, error: "Nie udało się pobrać sesji." };
  }
}

export async function invalidateOtherSessionsAction() {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const userId = Number((session.user as any).id);
  const currentRowId = Number((session.user as any).sessionRowId || 0);

  try {
    await revokeUserSessions(userId, currentRowId);
    return { success: true };
  } catch (e: any) {
    console.error("Błąd unieważniania sesji:", e);
    return { success: false, error: "Nie udało się unieważnić sesji." };
  }
}
