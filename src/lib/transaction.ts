import { db } from '@/db';
import { idempotencyKeys } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export interface IdempotentResult<T> {
  fromCache: boolean;
  data: T;
}

/**
 * Wykonuje funkcję w ramach transakcji bazie danych.
 */
export async function runTransaction<T>(
  action: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    return await action(tx);
  });
}

/**
 * Główny pomocnik idempotentności.
 * Gwarantuje unikalność wykonywania operacji (UNIQUE constraint na UNIQUE(operation, idempotency_key)).
 */
export async function executeIdempotentAction<T>(
  userId: number,
  operation: string,
  idempotencyKey: string | undefined | null,
  action: (tx?: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>
): Promise<IdempotentResult<T>> {
  // Jeśli brak klucza idempotentności (np. proste zapytanie odczytu), wykonaj od razu
  if (!idempotencyKey || idempotencyKey.trim() === '') {
    const data = await action();
    return { fromCache: false, data };
  }

  const cleanKey = idempotencyKey.trim();

  // 1. Sprawdź, czy operacja była już wcześniej wykonana i zapisana w idempotency_keys
  const existingRecord = await db
    .select()
    .from(idempotencyKeys)
    .where(and(eq(idempotencyKeys.operation, operation), eq(idempotencyKeys.idempotencyKey, cleanKey)))
    .limit(1);

  if (existingRecord.length > 0) {
    const record = existingRecord[0];
    if (record.status === 'completed' && record.result) {
      try {
        const parsedResult = JSON.parse(record.result) as T;
        return { fromCache: true, data: parsedResult };
      } catch (e) {
        // Jeśli błąd parsowania, przejdź dalej
      }
    } else if (record.status === 'pending') {
      throw new Error(`Operacja ${operation} z kluczem '${cleanKey}' jest obecnie w trakcie przetwarzania.`);
    }
  }

  // 2. Rejestruj wpis początkowy lub wykonaj w transakcji
  try {
    return await runTransaction(async (tx) => {
      // Rejestracja w tabeli z unikaniem duplikatów poprzez wysłanie rekordu 'pending'
      try {
        await tx.insert(idempotencyKeys).values({
          userId,
          operation,
          idempotencyKey: cleanKey,
          status: 'pending'
        });
      } catch (err: any) {
        // Jeśli nastąpiła kolizja UNIQUE(operation, idempotencyKey)
        const existing = await tx
          .select()
          .from(idempotencyKeys)
          .where(and(eq(idempotencyKeys.operation, operation), eq(idempotencyKeys.idempotencyKey, cleanKey)))
          .limit(1);

        if (existing.length > 0 && existing[0].status === 'completed' && existing[0].result) {
          return { fromCache: true, data: JSON.parse(existing[0].result) as T };
        }
        throw new Error(`Wykryto zduplikowaną operację ${operation} dla klucza '${cleanKey}'.`);
      }

      // 3. Wykonanie właściwej akcji biznesowej
      const data = await action(tx);
      const jsonResult = JSON.stringify(data ?? {});

      await tx
        .update(idempotencyKeys)
        .set({
          status: 'completed',
          result: jsonResult
        })
        .where(and(eq(idempotencyKeys.operation, operation), eq(idempotencyKeys.idempotencyKey, cleanKey)));

      return { fromCache: false, data };
    });
  } catch (actionErr: any) {
    try {
      await db
        .update(idempotencyKeys)
        .set({
          status: 'failed',
          result: JSON.stringify({ error: actionErr.message || 'Wystąpił błąd' })
        })
        .where(and(eq(idempotencyKeys.operation, operation), eq(idempotencyKeys.idempotencyKey, cleanKey)));
    } catch (e) {
      // Błąd zapisu statusu failed w bazie
    }
    throw actionErr;
  }
}
