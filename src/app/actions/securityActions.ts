'use server';

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";

/**
 * Session listing previously relied on unused user_sessions rows.
 * With JWT + sessionVersion, we expose the current logical session only.
 */
export async function getUserSessionsAction() {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const userId = Number((session.user as any).id);
  const sessionVersion = Number((session.user as any).sessionVersion ?? 0);

  return {
    success: true,
    data: [
      {
        id: userId,
        sessionToken: `jwt-v${sessionVersion}`,
        userAgent: "Bieżąca sesja (JWT)",
        ipAddress: null,
        expiresAt: null,
        isValid: true,
        createdAt: null,
        isCurrent: true,
      },
    ],
  };
}

/**
 * Invalidates ALL sessions for the current user by bumping sessionVersion.
 * The current JWT will fail validation on the next refresh (within ~60s).
 */
export async function invalidateOtherSessionsAction() {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const userId = Number((session.user as any).id);
  if (!userId) return { success: false, error: "Niepoprawne ID użytkownika" };

  try {
    await db
      .update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, userId));

    return {
      success: true,
      message:
        "Unieważniono wszystkie sesje. Zaloguj się ponownie na tym urządzeniu.",
      requiresReLogin: true,
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
