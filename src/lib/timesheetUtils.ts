import { TimesheetEntry } from "@/app/actions/timesheetActions";

// Sprawdzanie nakładania się zmian w wybranym miesiącu (funkcja czysto kliencka/pomocnicza, bez "use server")
export function checkConflicts(entries: TimesheetEntry[]): string[] {
  const dateMap: Record<string, TimesheetEntry[]> = {};
  entries.forEach(e => {
    if (!dateMap[e.date]) dateMap[e.date] = [];
    dateMap[e.date].push(e);
  });

  const conflictDates: string[] = [];

  Object.entries(dateMap).forEach(([date, dayEntries]) => {
    if (dayEntries.length < 2) return;
    
    const sorted = [...dayEntries].sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      
      // Jeżeli koniec obecnej zmiany jest po starcie kolejnej
      if (current.endTime.localeCompare(next.startTime) > 0) {
        if (!conflictDates.includes(date)) {
          conflictDates.push(date);
        }
      }
    }
  });

  return conflictDates;
}
