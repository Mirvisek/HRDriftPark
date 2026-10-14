import crypto from "crypto";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { userSessions, users } from "@/db/schema";

export async function openUserSession(input: {
  userId: number;
  remember: boolean;
  userAgent?: string | null;
  ipAddress?: string | null;
}): Promise<number | null> {
  try {
    const hours = input.remember ? 30 * 24 : 12;
    const inserted = await db.insert(userSessions).values({
      userId: input.userId,
      sessionToken: crypto.randomBytes(32).toString("hex"),
      userAgent: input.userAgent || null,
      ipAddress: input.ipAddress ? input.ipAddress.slice(0, 50) : null,
      expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
      isValid: true,
    });
    const header = Array.isArray(inserted) ? inserted[0] : inserted;
    const id = Number((header as { insertId?: number })?.insertId || 0);
    return id > 0 ? id : null;
  } catch (e) {
    console.error("[session] Nie zapisano sesji urządzenia:", e);
    return null;
  }
}

/** Brak id (stary token albo awaria zapisu) nie wylogowuje. Zapisane id musi być ważne. */
export async function isSessionRowActive(rowId: number): Promise<boolean> {
  if (!rowId) return true;
  try {
    const rows = await db
      .select({ isValid: userSessions.isValid, expiresAt: userSessions.expiresAt })
      .from(userSessions)
      .where(eq(userSessions.id, rowId))
      .limit(1);
    if (rows.length === 0 || !rows[0].isValid) return false;
    if (rows[0].expiresAt && rows[0].expiresAt.getTime() < Date.now()) return false;
    return true;
  } catch (e) {
    console.error("[session] Pominięto sprawdzenie sesji:", e);
    return true;
  }
}

export async function revokeUserSessions(userId: number, exceptRowId?: number) {
  const filters = [eq(userSessions.userId, userId)];
  if (exceptRowId && exceptRowId > 0) filters.push(ne(userSessions.id, exceptRowId));
  await db.update(userSessions).set({ isValid: false }).where(and(...filters));
}

export async function loadAccount(userId: number) {
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      role: users.role,
      position: users.position,
      venueId: users.venueId,
      permissions: users.permissions,
      mustChangePassword: users.mustChangePassword,
      isDemo: users.isDemo,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}
