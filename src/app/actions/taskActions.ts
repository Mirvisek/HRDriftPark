'use server';

import { db } from "@/db";
import { taskTemplates, shiftTasks, users } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { auth } from "@/auth";

/**
 * Pobiera zadania na określony dzień.
 * Jeśli na dany dzień nie ma jeszcze żadnych zadań, automatycznie kopiuje je z szablonów.
 */
export async function getTasksForDateAction(dateStr: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };
  const userVenueId = (session.user as any).venueId || 1;
  const userIsDemo = (session.user as any).isDemo === true;

  try {
    // 1. Sprawdź czy są już zadania w bazie dla tej daty i tego lokalu
    const existingTasks = await db
      .select()
      .from(shiftTasks)
      .where(and(
        eq(shiftTasks.date, dateStr),
        eq(shiftTasks.venueId, userVenueId),
        eq(shiftTasks.isDemo, userIsDemo)
      ))
      .orderBy(shiftTasks.id);

    if (existingTasks.length > 0) {
      return { success: true, data: existingTasks };
    }

    // 2. Jeśli nie ma, pobierz szablony dla odpowiedniego dnia tygodnia i lokalu
    const d = new Date(dateStr);
    const dayOfWeek = d.getDay(); // 0 = Niedziela, 1 = Poniedziałek, ..., 6 = Sobota

    const templates = await db
      .select()
      .from(taskTemplates)
      .where(and(
        eq(taskTemplates.dayOfWeek, dayOfWeek),
        eq(taskTemplates.venueId, userVenueId),
        eq(taskTemplates.isDemo, userIsDemo)
      ))
      .orderBy(taskTemplates.id);

    // 3. Skopiuj szablony do tabeli shift_tasks dla tej daty i lokalu
    const newTasks = templates.map(t => ({
      date: dateStr,
      title: t.title,
      type: 'recurring' as 'recurring' | 'additional',
      priority: 'medium' as 'low' | 'medium' | 'high',
      isCompleted: false,
      venueId: userVenueId,
      isDemo: userIsDemo
    }));

    // Jeżeli to NIEDZIELA (dayOfWeek === 0), dodaj cotygodniową pełną inwentaryzację lokalu
    if (dayOfWeek === 0) {
      newTasks.push({
        date: dateStr,
        title: `[MAGAZYN] Cotygodniowa pełna inwentaryzacja lokalu`,
        type: 'recurring' as 'recurring' | 'additional',
        priority: 'high' as 'low' | 'medium' | 'high',
        isCompleted: false,
        venueId: userVenueId,
        isDemo: userIsDemo
      });
    }

    for (const task of newTasks) {
      await db.insert(shiftTasks).values(task);
    }

    // Automatycznie losuj wybiórczą inwentaryzację (Spot Check) na ten dzień w tym lokalu
    try {
      const { triggerDailySpotCheckAction } = await import("./inventoryActions");
      await triggerDailySpotCheckAction(dateStr, userVenueId, userIsDemo);
    } catch (spotErr) {
      console.error("Błąd podczas automatycznego losowania Spot Check:", spotErr);
    }

    // 4. Pobierz ponownie nowo utworzone zadania
    const initializedTasks = await db
      .select()
      .from(shiftTasks)
      .where(and(
        eq(shiftTasks.date, dateStr),
        eq(shiftTasks.venueId, userVenueId),
        eq(shiftTasks.isDemo, userIsDemo)
      ))
      .orderBy(shiftTasks.id);

    return { success: true, data: initializedTasks };
  } catch (e: any) {
    console.error("[Task Error] Pobieranie zadań:", e);
    return { success: false, error: "Błąd bazy danych przy wczytywaniu zadań." };
  }
}

/**
 * Dodaje dodatkowe zadanie jednorazowe na dany dzień
 */
export async function addAdditionalTaskAction(
  dateStr: string,
  title: string,
  priority: 'low' | 'medium' | 'high'
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };
  const userVenueId = (session.user as any).venueId || 1;
  const userIsDemo = (session.user as any).isDemo === true;

  if (!title.trim()) {
    return { success: false, error: "Tytuł zadania nie może być pusty." };
  }

  try {
    await db.insert(shiftTasks).values({
      date: dateStr,
      title: title.trim(),
      type: 'additional',
      priority,
      isCompleted: false,
      venueId: userVenueId,
      isDemo: userIsDemo
    });

    console.log(`[Tasks] Dodano zadanie dodatkowe na dzień ${dateStr} w lokalu ${userVenueId}: ${title}`);
    return { success: true };
  } catch (e: any) {
    console.error("[Task Error] Dodawanie zadania:", e);
    return { success: false, error: "Błąd bazy danych podczas dodawania zadania." };
  }
}

/**
 * Przełącza status wykonania zadania (zaznacza / odznacza)
 */
export async function toggleTaskStatusAction(taskId: number, isCompleted: boolean) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const userId = Number((session.user as any).id);
  const userDisplayName = session.user.name || 'Pracownik';

  try {
    if (isCompleted) {
      await db
        .update(shiftTasks)
        .set({
          isCompleted: true,
          completedBy: userId,
          completedByName: userDisplayName,
          completedAt: new Date()
        })
        .where(eq(shiftTasks.id, taskId));
    } else {
      await db
        .update(shiftTasks)
        .set({
          isCompleted: false,
          completedBy: null,
          completedByName: null,
          completedAt: null
        })
        .where(eq(shiftTasks.id, taskId));
    }

    console.log(`[Tasks] Zmiana statusu zadania ID ${taskId} na ${isCompleted ? 'ukończone' : 'do zrobienia'} przez ID ${userId}`);
    return { success: true };
  } catch (e: any) {
    console.error("[Task Error] Zmiana statusu zadania:", e);
    return { success: false, error: "Błąd bazy danych podczas aktualizacji statusu zadania." };
  }
}

/**
 * Usuwa zadanie dodatkowe (stałych zadań z szablonu nie wolno usuwać z widoku dnia)
 */
export async function deleteAdditionalTaskAction(taskId: number) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const role = (session.user as any).role;
  if (role !== 'owner' && role !== 'manager' && role !== 'technik') {
    return { success: false, error: "Brak uprawnień do usuwania zadań." };
  }

  try {
    await db
      .delete(shiftTasks)
      .where(and(eq(shiftTasks.id, taskId), eq(shiftTasks.type, 'additional')));

    console.log(`[Tasks] Usunięto zadanie dodatkowe ID: ${taskId}`);
    return { success: true };
  } catch (e: any) {
    console.error("[Task Error] Usuwanie zadania:", e);
    return { success: false, error: "Błąd bazy danych podczas usuwania zadania." };
  }
}

/**
 * Pobiera szablony zadań stałych
 */
export async function getTaskTemplatesAction() {
  const session = await auth();
  if (!session?.user) return { success: false, data: [] };
  const userVenueId = (session.user as any).venueId || 1;
  const userIsDemo = (session.user as any).isDemo === true;

  try {
    const templates = await db
      .select()
      .from(taskTemplates)
      .where(and(
        eq(taskTemplates.venueId, userVenueId),
        eq(taskTemplates.isDemo, userIsDemo)
      ))
      .orderBy(asc(taskTemplates.dayOfWeek), asc(taskTemplates.title));

    return { success: true, data: templates };
  } catch (e: any) {
    console.error("[Task Error] Pobieranie szablonów:", e);
    return { success: false, data: [], error: "Błąd bazy danych przy pobieraniu szablonów." };
  }
}

/**
 * Tworzy nowy szablon zadania stałego
 */
export async function saveTaskTemplateAction(title: string, dayOfWeek: number) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };
  const userVenueId = (session.user as any).venueId || 1;
  const userIsDemo = (session.user as any).isDemo === true;

  const role = (session.user as any).role;
  if (role !== 'owner' && role !== 'manager' && role !== 'technik') {
    return { success: false, error: "Brak uprawnień." };
  }

  if (!title.trim() || dayOfWeek < 0 || dayOfWeek > 6) {
    return { success: false, error: "Nieprawidłowe dane szablonu." };
  }

  try {
    await db.insert(taskTemplates).values({
      title: title.trim(),
      dayOfWeek,
      venueId: userVenueId,
      isDemo: userIsDemo
    });

    console.log(`[Tasks] Zapisano szablon zadania w lokalu ${userVenueId} na dzień tygodnia ${dayOfWeek}: ${title}`);
    return { success: true };
  } catch (e: any) {
    console.error("[Task Error] Zapis szablonu:", e);
    return { success: false, error: "Błąd bazy danych przy zapisie szablonu." };
  }
}

/**
 * Usuwa szablon zadania stałego
 */
export async function deleteTaskTemplateAction(templateId: number) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const role = (session.user as any).role;
  if (role !== 'owner' && role !== 'manager' && role !== 'technik') {
    return { success: false, error: "Brak uprawnień." };
  }

  try {
    await db.delete(taskTemplates).where(eq(taskTemplates.id, templateId));
    console.log(`[Tasks] Usunięto szablon zadania ID: ${templateId}`);
    return { success: true };
  } catch (e: any) {
    console.error("[Task Error] Usuwanie szablonu:", e);
    return { success: false, error: "Błąd bazy danych przy usuwaniu szablonu." };
  }
}
