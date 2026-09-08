'use server';

import { db } from "@/db";
import { userSessions } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { auth } from "@/auth";

export async function getUserSessionsAction() {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const userId = Number((session.user as any).id);

  try {
    const list = await db
      .select()
      .from(userSessions)
      .where(and(eq(userSessions.userId, userId), eq(userSessions.isValid, true)));

    return { success: true, data: list };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function invalidateOtherSessionsAction() {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const userId = Number((session.user as any).id);

  try {
    await db
      .update(userSessions)
      .set({ isValid: false })
      .where(eq(userSessions.userId, userId));

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
