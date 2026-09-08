import { db } from '@/db';
import { outboxEvents } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export interface DomainOutboxEvent {
  eventType: string;
  payload: Record<string, any>;
}

/**
 * Rejestruje zdarzenie wyjściowe w tabeli outbox_events.
 * Może być wywoływana wewnątrz transakcji bazodanowej `tx` dla zagwarantowania spójności.
 */
export async function recordOutboxEvent(
  eventType: string,
  payload: Record<string, any>,
  dbTx?: Parameters<Parameters<typeof db.transaction>[0]>[0]
): Promise<number> {
  const client = dbTx || db;
  const jsonPayload = JSON.stringify(payload);

  const res = await client.insert(outboxEvents).values({
    eventType,
    payload: jsonPayload,
    status: 'pending',
    retryCount: 0
  });

  return (res as any)[0]?.insertId || 0;
}

/**
 * Worker przetwarzający oczekujące zdarzenia w tle (Transactional Outbox Processor).
 */
export async function processPendingOutboxEvents(batchSize: number = 10): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  const pendingEvents = await db
    .select()
    .from(outboxEvents)
    .where(eq(outboxEvents.status, 'pending'))
    .limit(batchSize);

  for (const event of pendingEvents) {
    try {
      // Ustaw stan na processing
      await db
        .update(outboxEvents)
        .set({ status: 'processing' })
        .where(eq(outboxEvents.id, event.id));

      const payload = JSON.parse(event.payload);

      // Tutaj następuje rejestracja/wysyłka powiadomień SMS / Push / Email / Alerty w tle
      console.log(`[Outbox Worker] Processing event #${event.id} (${event.eventType}):`, payload);

      // Symulacja udanej obsługi zdarzenia
      await db
        .update(outboxEvents)
        .set({
          status: 'delivered',
          processedAt: new Date()
        })
        .where(eq(outboxEvents.id, event.id));

      processed++;
    } catch (err: any) {
      failed++;
      const nextRetry = (event.retryCount || 0) + 1;
      const status = nextRetry >= 5 ? 'failed' : 'pending';

      await db
        .update(outboxEvents)
        .set({
          status,
          retryCount: nextRetry,
          errorDetails: err.message || 'Error processing outbox event'
        })
        .where(eq(outboxEvents.id, event.id));
    }
  }

  return { processed, failed };
}
