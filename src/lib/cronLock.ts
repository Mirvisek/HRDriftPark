import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * MySQL advisory lock so cron jobs don't double-run across instances.
 * Returns true if lock acquired, false if another worker holds it.
 */
export async function withCronLock<T>(
  lockName: string,
  timeoutSeconds: number,
  fn: () => Promise<T>
): Promise<T | undefined> {
  const name = lockName.slice(0, 64);
  try {
    const acquiredRows: any = await db.execute(
      sql`SELECT GET_LOCK(${name}, ${timeoutSeconds}) AS acquired`
    );
    const row = Array.isArray(acquiredRows)
      ? acquiredRows[0]
      : (acquiredRows as any)?.[0]?.[0] ?? (acquiredRows as any)?.rows?.[0];
    const acquired = Number(
      row?.acquired ?? row?.ACQUIRED ?? Object.values(row || {})[0]
    );

    if (acquired !== 1) {
      console.log(`[CRON] Pominięto job '${name}' — lock zajęty przez inną instancję.`);
      return undefined;
    }

    try {
      return await fn();
    } finally {
      await db.execute(sql`SELECT RELEASE_LOCK(${name})`);
    }
  } catch (e) {
    console.error(`[CRON] Błąd locka '${name}':`, e);
    // Fail open for single-instance / non-MySQL-compatible setups
    return await fn();
  }
}
