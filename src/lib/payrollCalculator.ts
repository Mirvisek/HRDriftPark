export interface SalaryHistoryEntry {
  userId: number;
  hourlyRate: number;
  validFrom: string; // YYYY-MM-DD
  validTo: string | null; // YYYY-MM-DD or null
}

export interface ShiftDuration {
  totalSeconds: number;
  durationHours: number;
}

/**
 * Konwertuje string czasu 'HH:MM' na liczbę sekund od początku doby.
 */
export function timeStringToSeconds(timeStr: string): number {
  const parts = timeStr.split(':');
  if (parts.length < 2) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 3600 + minutes * 60;
}

/**
 * Oblicza czas trwania zmiany w sekundach oraz godzinach (z uwzględnieniem przejścia przez północ).
 */
export function calculateShiftDuration(startTime: string, endTime: string): ShiftDuration {
  const startSec = timeStringToSeconds(startTime);
  const endSec = timeStringToSeconds(endTime);

  let diffSec = endSec - startSec;
  if (diffSec <= 0) {
    // Przejście przez północ (np. 22:00 do 02:00)
    diffSec += 86400; // 24 * 3600
  }

  const durationHours = Math.round((diffSec / 3600) * 100) / 100;
  return {
    totalSeconds: diffSec,
    durationHours,
  };
}

/**
 * Dobiera odpowiednią stawkę godzinową dla danego dnia w oparciu o historię wynagrodzeń.
 */
export function findApplicableHourlyRate(
  effectiveDate: string,
  history: SalaryHistoryEntry[],
  fallbackRate: number
): number {
  const matched = history.find(h => {
    return h.validFrom <= effectiveDate && (!h.validTo || h.validTo >= effectiveDate);
  });
  return matched ? matched.hourlyRate : fallbackRate;
}

/**
 * Oblicza należność za daną zmianę zaokrągloną do 2 miejsc po przecinku.
 */
export function calculateShiftPayout(durationHours: number, hourlyRate: number): number {
  return Math.round(durationHours * hourlyRate * 100) / 100;
}
