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

interface PayrollExportProps {
  payrollList: Array<{
    name: string;
    role: string;
    position: string;
    hourlyRate: number;
    totalHours: number;
    payout: number;
  }>;
  monthName: string;
  year: number;
}

/**
 * Eksport Karty Czasu Pracy z czytelnymi szerokościami kolumn, siatką i obrysem tabeli
 */
export function exportTimesheetToExcel({
  entries,
  employeeName,
  position,
  monthName,
  year,
  month
}: ExcelExportProps) {
  const daysInMonth = new Date(year, month, 0).getDate();

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

  const data: any[][] = [];

  // Tytuł i metadane z nagłówkiem
  data.push([`KARTA ECWP / LISTA OBECNOŚCI - ${monthName.toUpperCase()} ${year}`]);
  data.push([]);
  data.push(['Pracownik:', employeeName]);
  data.push(['Stanowisko:', position]);
  data.push([]);

  // Nagłówki kolumn tabeli
  data.push([
    'Dzień',
    'Rozpoczęcie pracy',
    'Zakończenie pracy',
    'Liczba godzin (h)',
    'Podpis pracownika'
  ]);

  let totalHours = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dayEntries = entriesByDay[d] || [];
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
        let diffSec = (eh * 3600 + em * 60) - (sh * 3600 + sm * 60);
        if (diffSec <= 0) diffSec += 86400; // Przejście przez północ
        if (diffSec > 0) {
          dayHours += diffSec / 3600;
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
      startTimeStr || '-',
      endTimeStr || '-',
      dayHoursValue !== null ? dayHoursValue : 0,
      signatureStr
    ]);
  }

  // Wiersz podsumowania (SUMA)
  data.push([
    'RAZEM',
    '',
    '',
    totalHours > 0 ? Number(totalHours.toFixed(2)) : 0,
    ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();

  // Oblicz dynamiczne szerokości kolumn (Auto-fit z marginesem)
  const colWidths = [
    { wch: 12 }, // Dzień
    { wch: 22 }, // Rozpoczęcie pracy
    { wch: 22 }, // Zakończenie pracy
    { wch: 20 }, // Liczba godzin
    { wch: 32 }  // Podpis pracownika
  ];

  ws['!cols'] = colWidths;

  // Połączenie komórek dla nagłówka tytułowego
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }
  ];

  // Włączenie widoczności siatki w formacie Excel
  ws['!views'] = [{ showGridLines: true }];

  XLSX.utils.book_append_sheet(wb, ws, 'Karta Obecności');

  const sanitizedName = employeeName.replace(/\s+/g, '_');
  XLSX.writeFile(wb, `karta_godzin_${sanitizedName}_${monthName}_${year}.xlsx`);
}

/**
 * Eksport Podsumowania Płacowego z pełnym formatowaniem tabelarycznym
 */
export function exportPayrollToExcel({ payrollList, monthName, year }: PayrollExportProps) {
  const data: any[][] = [];

  data.push([`ZESTAWIENIE PŁACOWE - DRIFT PARK EXTREME - ${monthName.toUpperCase()} ${year}`]);
  data.push([]);
  data.push(['Lp.', 'Pracownik', 'Stanowisko', 'Stawka (PLN/h)', 'Łączne Godziny (h)', 'Kwota do wypłaty (PLN)']);

  let totalHoursSum = 0;
  let totalPayoutSum = 0;

  payrollList.forEach((item, index) => {
    totalHoursSum += item.totalHours;
    totalPayoutSum += item.payout;

    data.push([
      index + 1,
      item.name,
      item.position,
      item.hourlyRate,
      item.totalHours,
      item.payout
    ]);
  });

  data.push([
    'RAZEM',
    '',
    '',
    '',
    Number(totalHoursSum.toFixed(2)),
    Number(totalPayoutSum.toFixed(2))
  ]);

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();

  ws['!cols'] = [
    { wch: 8 },  // Lp.
    { wch: 28 }, // Pracownik
    { wch: 24 }, // Stanowisko
    { wch: 18 }, // Stawka
    { wch: 22 }, // Łączne godziny
    { wch: 26 }  // Wyłata
  ];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }
  ];

  ws['!views'] = [{ showGridLines: true }];

  XLSX.utils.book_append_sheet(wb, ws, 'Podsumowanie Płacowe');
  XLSX.writeFile(wb, `rozliczenie_placowe_${monthName}_${year}.xlsx`);
}
