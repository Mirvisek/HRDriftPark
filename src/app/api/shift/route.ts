import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { activeShifts, timesheets, workSchedule, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { AnomalyEngine } from '@/services/anomalyEngine';
import { logAuditEvent } from '@/app/actions/userActions';
import { ShiftRole, getRoleLabel } from '@/lib/shiftTypes';

export const dynamic = 'force-dynamic';

function getPolandDateTime() {
  const now = new Date();
  const timeFormatter = new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const dateFormatter = new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const timeStr = timeFormatter.format(now);
  const parts = dateFormatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value || String(now.getFullYear());
  const month = parts.find(p => p.type === 'month')?.value || String(now.getMonth() + 1).padStart(2, '0');
  const day = parts.find(p => p.type === 'day')?.value || String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  return { dateStr, timeStr, now };
}

async function resolveUser(sessionUser: any): Promise<{ userId: number; venueId: number; isDemo: boolean } | null> {
  if (!sessionUser) return null;

  let userId = Number(sessionUser.id);
  let venueId = Number(sessionUser.venueId || 1);
  const isDemo = sessionUser.isDemo === true;

  if (!userId || isNaN(userId)) {
    userId = Number(sessionUser.sub);
  }

  // Fallback: jeśli w tokenie/sesji brak id, pobierz z bazy po emailu
  if ((!userId || isNaN(userId)) && sessionUser.email) {
    try {
      const rows = await db
        .select({ id: users.id, venueId: users.venueId })
        .from(users)
        .where(eq(users.email, sessionUser.email))
        .limit(1);

      if (rows.length > 0) {
        userId = rows[0].id;
        if (rows[0].venueId) venueId = rows[0].venueId;
      }
    } catch (err) {
      console.error('[API /api/shift] Error looking up user by email:', err);
    }
  }

  if (!userId || isNaN(userId)) {
    return null;
  }

  return { userId, venueId, isDemo };
}

/**
 * GET /api/shift - pobiera stan aktywnej zmiany zalogowanego pracownika
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ hasActiveShift: false }, { status: 200 });
    }

    const resolved = await resolveUser(session.user);
    if (!resolved) {
      return NextResponse.json({ hasActiveShift: false }, { status: 200 });
    }

    const { userId, venueId, isDemo } = resolved;
    const { dateStr } = getPolandDateTime();

    // 1. Sprawdź czy pracownik ma aktywną zmianę
    const activeList = await db
      .select()
      .from(activeShifts)
      .where(and(eq(activeShifts.userId, userId), eq(activeShifts.isDemo, isDemo)))
      .limit(1);

    // 2. Pobierz grafik na dziś pod kątem sugerowanej roli
    let suggestedRole: ShiftRole = 'lead';
    try {
      const scheduleList = await db
        .select()
        .from(workSchedule)
        .where(and(eq(workSchedule.date, dateStr), eq(workSchedule.venueId, venueId), eq(workSchedule.isDemo, isDemo)))
        .limit(1);

      if (scheduleList.length > 0) {
        const todaySched = scheduleList[0];
        if (todaySched.leadUserId === userId) {
          suggestedRole = 'lead';
        } else if (todaySched.supportUserId === userId) {
          suggestedRole = 'support';
        }
      }
    } catch (schedErr) {
      console.warn('[API /api/shift] Błąd pobierania grafiku:', schedErr);
    }

    if (activeList.length > 0) {
      const row = activeList[0];
      const validRole = (row.shiftRole && ['lead', 'support', 'cleaning', 'replacement'].includes(row.shiftRole))
        ? (row.shiftRole as ShiftRole)
        : 'lead';

      return NextResponse.json({
        hasActiveShift: true,
        shift: {
          id: row.id,
          userId: row.userId,
          date: String(row.date || dateStr),
          startTime: String(row.startTime || '00:00'),
          startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
          shiftRole: validRole,
          venueId: row.venueId,
        },
        suggestedRole,
      });
    }

    return NextResponse.json({
      hasActiveShift: false,
      suggestedRole,
    });
  } catch (error: any) {
    console.error('[API /api/shift] GET error:', error);
    return NextResponse.json({ hasActiveShift: false, error: error?.message }, { status: 500 });
  }
}

/**
 * POST /api/shift - start, stop lub reset zmiany
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji. Zaloguj się ponownie.' }, { status: 401 });
    }

    const resolved = await resolveUser(session.user);
    if (!resolved) {
      return NextResponse.json({ success: false, error: 'Nie udało się ustalić ID użytkownika w bazie.' }, { status: 400 });
    }

    const { userId, venueId, isDemo } = resolved;
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'start';

    // === AKCJA: START ===
    if (action === 'start') {
      const validRoles: ShiftRole[] = ['lead', 'support', 'cleaning', 'replacement'];
      const rawRole = body.shiftRole || body.role;
      const chosenRole: ShiftRole = validRoles.includes(rawRole) ? rawRole : 'lead';

      // Sprawdź czy nie ma już aktywnej zmiany
      const existing = await db
        .select({ id: activeShifts.id })
        .from(activeShifts)
        .where(and(eq(activeShifts.userId, userId), eq(activeShifts.isDemo, isDemo)))
        .limit(1);

      if (existing.length > 0) {
        return NextResponse.json({ success: false, error: 'Twoja usługa pracy jest już aktywna!' });
      }

      const { dateStr, timeStr, now } = getPolandDateTime();

      await db.insert(activeShifts).values({
        userId,
        date: dateStr,
        startTime: timeStr,
        startedAt: now,
        shiftRole: chosenRole,
        venueId,
        isDemo,
      });

      console.log(`[API /api/shift] Pracownik #${userId} rozpoczął pracę (${chosenRole}) o ${timeStr}`);
      return NextResponse.json({
        success: true,
        startTime: timeStr,
        roleLabel: getRoleLabel(chosenRole),
      });
    }

    // === AKCJA: STOP ===
    if (action === 'stop') {
      const activeList = await db
        .select()
        .from(activeShifts)
        .where(and(eq(activeShifts.userId, userId), eq(activeShifts.isDemo, isDemo)))
        .limit(1);

      if (activeList.length === 0) {
        return NextResponse.json({ success: false, error: 'Brak aktywnej zmiany do zakończenia.' });
      }

      const active = activeList[0];
      const { timeStr, dateStr } = getPolandDateTime();
      const roleKey = (active.shiftRole as ShiftRole) || 'lead';
      const roleLabel = getRoleLabel(roleKey);
      const remarks = `Rola na zmianie: ${roleLabel}`;

      const shiftDate = String(active.date || dateStr);
      const shiftStart = String(active.startTime || timeStr);

      let newTimesheetId = 0;
      try {
        const [inserted] = await db.insert(timesheets).values({
          userId,
          date: shiftDate,
          startTime: shiftStart,
          endTime: timeStr,
          remarks,
          status: 'submitted',
          isLocked: false,
          reasonCode: roleKey,
          reasonText: roleLabel,
          createdById: userId,
          isDemo,
          version: 1,
        });
        newTimesheetId = (inserted as { insertId?: number }).insertId || 0;
      } catch (insertErr) {
        console.error('[API /api/shift] Timesheet insert error:', insertErr);
      }

      // Usuń z tabeli aktywnych zmian ZAWSZE
      await db.delete(activeShifts).where(eq(activeShifts.id, active.id));

      // Log audytowy
      try {
        await logAuditEvent(userId, 'timesheet', newTimesheetId, 'INSERT', null, {
          userId,
          date: shiftDate,
          startTime: shiftStart,
          endTime: timeStr,
          role: roleKey,
          source: 'shift_service_punch_out',
        });
      } catch (auditErr) {
        console.warn('[API /api/shift] Audit warning:', auditErr);
      }

      // Detektor anomalii
      if (newTimesheetId > 0) {
        try {
          await AnomalyEngine.evaluateTimesheet(newTimesheetId);
        } catch (anomErr) {
          console.warn('[API /api/shift] Anomaly warning:', anomErr);
        }
      }

      console.log(`[API /api/shift] Pracownik #${userId} zakończył pracę (${shiftStart} - ${timeStr})`);
      return NextResponse.json({
        success: true,
        timesheetId: newTimesheetId,
        duration: `${shiftStart} – ${timeStr}`,
      });
    }

    // === AKCJA: RESET ===
    if (action === 'reset') {
      await db.delete(activeShifts).where(and(eq(activeShifts.userId, userId), eq(activeShifts.isDemo, isDemo)));
      console.log(`[API /api/shift] Pracownik #${userId} zresetował aktywną zmianę`);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Nieznana akcja.' }, { status: 400 });
  } catch (error: any) {
    console.error('[API /api/shift] POST error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Błąd serwera.' }, { status: 500 });
  }
}
