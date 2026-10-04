'use server';

import { db } from "@/db";
import { events } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { recordOutboxEvent } from "@/lib/outbox";
import { executeIdempotentAction } from "@/lib/transaction";

export interface EventData {
  id?: number;
  title: string;
  customerName: string;
  customerPhone?: string;
  date: string;
  startTime: string;
  endTime: string;
  participantsCount: number;
  totalAmount: number;
  depositPaid: number;
  notes?: string;
  status?: string;
}

export interface ActionResponse {
  success: boolean;
  error?: string;
  eventId?: number;
}

function canMutateEvents(role: string): boolean {
  return role === 'owner' || role === 'manager' || role === 'technik';
}

export async function getEventsAction(dateStr?: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const venueId = (session.user as any).venueId || 1;
  const isDemo = (session.user as any).isDemo === true;

  try {
    const conditions = [
      eq(events.venueId, venueId),
      eq(events.isDemo, isDemo)
    ];

    if (dateStr) {
      conditions.push(eq(events.date, dateStr));
    }

    const results = await db
      .select()
      .from(events)
      .where(and(...conditions))
      .orderBy(desc(events.date));

    return { success: true, data: results };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function createOrUpdateEventAction(eventData: EventData, idempotencyKey?: string): Promise<ActionResponse> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const role = (session.user as any).role || 'employee';
  if (!canMutateEvents(role)) {
    return { success: false, error: "Brak uprawnień do edycji wydarzeń." };
  }

  const userId = Number((session.user as any).id);
  const venueId = (session.user as any).venueId || 1;
  const isDemo = (session.user as any).isDemo === true;

  return (await executeIdempotentAction<ActionResponse>(userId, 'createOrUpdateEvent', idempotencyKey, async (tx) => {
    const client = tx || db;

    if (eventData.id) {
      const updated = await client
        .update(events)
        .set({
          title: eventData.title,
          customerName: eventData.customerName,
          customerPhone: eventData.customerPhone || null,
          date: eventData.date,
          startTime: eventData.startTime,
          endTime: eventData.endTime,
          participantsCount: Number(eventData.participantsCount) || 1,
          totalAmount: Number(eventData.totalAmount) || 0,
          depositPaid: Number(eventData.depositPaid) || 0,
          notes: eventData.notes || null,
          status: (eventData.status as any) || 'booked'
        })
        .where(and(
          eq(events.id, eventData.id),
          eq(events.venueId, venueId),
          eq(events.isDemo, isDemo)
        ));

      // mysql2 update result: affectedRows
      const affected = (updated as any)?.[0]?.affectedRows ?? (updated as any)?.affectedRows;
      if (affected === 0) {
        return { success: false, error: "Nie znaleziono wydarzenia w Twoim lokalu." };
      }

      await recordOutboxEvent('EVENT_UPDATED', { eventId: eventData.id, date: eventData.date, venueId }, client);
      return { success: true, eventId: eventData.id };
    } else {
      const [inserted] = await client.insert(events).values({
        title: eventData.title,
        customerName: eventData.customerName,
        customerPhone: eventData.customerPhone || null,
        date: eventData.date,
        startTime: eventData.startTime,
        endTime: eventData.endTime,
        participantsCount: Number(eventData.participantsCount) || 1,
        venueId,
        status: 'booked',
        totalAmount: Number(eventData.totalAmount) || 0,
        depositPaid: Number(eventData.depositPaid) || 0,
        notes: eventData.notes || null,
        isDemo
      });

      const newId = (inserted as any).insertId || 0;
      await recordOutboxEvent('EVENT_CREATED', { eventId: newId, title: eventData.title, date: eventData.date, venueId }, client);

      return { success: true, eventId: newId };
    }
  })).data;
}

export async function deleteEventAction(eventId: number): Promise<ActionResponse> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const role = (session.user as any).role || 'employee';
  if (!canMutateEvents(role)) {
    return { success: false, error: "Brak uprawnień do usuwania wydarzeń." };
  }

  const venueId = (session.user as any).venueId || 1;
  const isDemo = (session.user as any).isDemo === true;

  try {
    await db.delete(events).where(and(
      eq(events.id, eventId),
      eq(events.venueId, venueId),
      eq(events.isDemo, isDemo)
    ));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
