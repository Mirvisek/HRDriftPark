import * as XLSX from 'xlsx';
import { TimesheetEntry } from '@/app/actions/timesheetActions';

interface ExcelExportProps {
  entries: TimesheetEntry[];
  employeeName: string;
  position: string;
  monthName: string;
  year: number;
  month: number;
}

export function exportTimesheetToExcel({
  entries,
  employeeName,
  position,
  monthName,
  year,
  month
}: ExcelExportProps) {
  // Obliczenie liczby dni w miesiącu
  const daysInMonth = new Date(year, month, 0).getDate();

  // Grupowanie wpisów według dnia miesiąca
  const entriesByDay: Record<number, TimesheetEntry[]> = {};
  entries.forEach(entry => {
    if (!entry.date) return;
    const parts = entry.date.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[2], 10);
      if (!isNaN(day)) {
        if (!entriesByDay[day]) {
          entriesByDay[day] = [];
        }
        entriesByDay[day].push(entry);
      }
    }
  });

  // Przygotowanie danych do arkusza (AOA - Array of Arrays)
  const data: any[][] = [];

  // Tytuł i metadane
  data.push([`Lista obecności za m-c ${monthName} ${year} r.`]);
  data.push([]); // Pusty wiersz
  data.push(['Imię i nazwisko:', employeeName]);
  data.push(['Stanowisko:', position]);
  data.push([]); // Pusty wiersz

  // Nagłówki kolumn
  data.push([
    'Dzień miesiąca',
    'Rozpoczęcie pracy',
    'Zakończenie pracy',
    'Ilość godzin',
    'Podpis pracownika'
  ]);

  let totalHours = 0;

  // Wiersze dla poszczególnych dni
  for (let d = 1; d <= daysInMonth; d++) {
    const dayEntries = entriesByDay[d] || [];
    
    // Sortowanie wpisów z danego dnia chronologicznie
    const sortedDayEntries = [...dayEntries].sort((a, b) => a.startTime.localeCompare(b.startTime));

    let startTimeStr = '';
    let endTimeStr = '';
    let dayHoursValue: number | null = null;
    let signatureStr = '';

    if (sortedDayEntries.length > 0) {
      if (sortedDayEntries.length === 1) {
        startTimeStr = sortedDayEntries[0].startTime;
        endTimeStr = sortedDayEntries[0].endTime;
      } else {
        startTimeStr = sortedDayEntries.map(e => e.startTime).join(', ');
        endTimeStr = sortedDayEntries.map(e => e.endTime).join(', ');
      }

      let dayHours = 0;
      sortedDayEntries.forEach(entry => {
        const [sh, sm] = entry.startTime.split(':').map(Number);
        const [eh, em] = entry.endTime.split(':').map(Number);
        const diffMin = (eh * 60 + em) - (sh * 60 + sm);
        if (diffMin > 0) {
          dayHours += diffMin / 60;
        }
      });
      
      if (dayHours > 0) {
        dayHoursValue = Number(dayHours.toFixed(2));
        totalHours += dayHours;
      }
      signatureStr = `/${employeeName}/`;
    }

    data.push([
      `${d}.`,
      startTimeStr,
      endTimeStr,
      dayHoursValue !== null ? dayHoursValue : '',
      signatureStr
    ]);
  }

  // Wiersz podsumowania (Razem)
  data.push([
    'Razem:',
    '',
    '',
    totalHours > 0 ? Number(totalHours.toFixed(2)) : '',
    ''
  ]);

  // Tworzenie arkusza i skoroszytu
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();

  // Ustawienie szerokości kolumn (wch to szerokość w znakach)
  ws['!cols'] = [
    { wch: 16 }, // Dzień miesiąca
    { wch: 20 }, // Rozpoczęcie pracy
    { wch: 20 }, // Zakończenie pracy
    { wch: 15 }, // Ilość godzin
    { wch: 28 }  // Podpis pracownika
  ];

  // Połączenie komórek dla tytułu (Wiersz 1, kolumny A do E)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }
  ];

  // Dołączenie arkusza do pliku i zapis
  XLSX.utils.book_append_sheet(wb, ws, 'Karta Obecności');
  
  const sanitizedName = employeeName.replace(/\s+/g, '_');
  XLSX.writeFile(wb, `karta_godzin_${sanitizedName}_${monthName}_${year}.xlsx`);
}
