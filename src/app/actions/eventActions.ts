'use server';

import { db } from "@/db";
import { events } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { recordOutboxEvent } from "@/lib/outbox";
import { executeIdempotentAction } from "@/lib/transaction";

function canManageEvents(user: any) {
  const role = user?.role;
  return role === "owner" || role === "manager" || hasPermission(user, "schedule:edit");
}

function redactEvent<T extends { customerPhone?: string | null; totalAmount?: number; depositPaid?: number; notes?: string | null }>(event: T, full: boolean) {
  if (full) return event;
  return { ...event, customerPhone: null, totalAmount: 0, depositPaid: 0, notes: null };
}

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

export async function getEventsAction(dateStr?: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const venueId = (session.user as any).venueId || 1;
  const isDemo = (session.user as any).isDemo === true;
  const full = canManageEvents(session.user);

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

    return { success: true, data: results.map((event) => redactEvent(event, full)) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function createOrUpdateEventAction(eventData: EventData, idempotencyKey?: string): Promise<ActionResponse> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };
  if (!canManageEvents(session.user)) return { success: false, error: "Brak uprawnień do edycji rezerwacji." };

  const userId = Number((session.user as any).id);
  const venueId = (session.user as any).venueId || 1;
  const isDemo = (session.user as any).isDemo === true;

  if (eventData.id) {
    const existing = await db.select({ id: events.id }).from(events)
      .where(and(eq(events.id, eventData.id), eq(events.venueId, venueId)))
      .limit(1);
    if (existing.length === 0) return { success: false, error: "Nie znaleziono rezerwacji w tym lokalu." };
  }

  return (await executeIdempotentAction<ActionResponse>(userId, 'createOrUpdateEvent', idempotencyKey, async (tx) => {
    const client = tx || db;

    if (eventData.id) {
      await client
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
        .where(and(eq(events.id, eventData.id), eq(events.venueId, venueId)));

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
  if (!canManageEvents(session.user)) return { success: false, error: "Brak uprawnień do usuwania rezerwacji." };

  const venueId = (session.user as any).venueId || 1;

  try {
    const existing = await db.select({ id: events.id }).from(events)
      .where(and(eq(events.id, eventId), eq(events.venueId, venueId)))
      .limit(1);
    if (existing.length === 0) return { success: false, error: "Nie znaleziono rezerwacji w tym lokalu." };
    await db.delete(events).where(and(eq(events.id, eventId), eq(events.venueId, venueId)));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
