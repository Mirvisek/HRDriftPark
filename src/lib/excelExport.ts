import ExcelJS from "exceljs";
import { TimesheetEntry } from "@/app/actions/timesheetActions";

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

async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Eksport Karty Czasu Pracy (exceljs — bez podatnego xlsx).
 */
export async function exportTimesheetToExcel({
  entries,
  employeeName,
  position,
  monthName,
  year,
  month,
}: ExcelExportProps) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const entriesByDay: Record<number, TimesheetEntry[]> = {};
  entries.forEach((entry) => {
    if (!entry.date) return;
    const parts = entry.date.split("-");
    if (parts.length === 3) {
      const day = parseInt(parts[2], 10);
      if (!isNaN(day)) {
        if (!entriesByDay[day]) entriesByDay[day] = [];
        entriesByDay[day].push(entry);
      }
    }
  });

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Karta Obecności");

  ws.mergeCells(1, 1, 1, 5);
  ws.getCell(1, 1).value = `KARTA ECWP / LISTA OBECNOŚCI - ${monthName.toUpperCase()} ${year}`;
  ws.getCell(1, 1).font = { bold: true, size: 14 };

  ws.getCell(3, 1).value = "Pracownik:";
  ws.getCell(3, 2).value = employeeName;
  ws.getCell(4, 1).value = "Stanowisko:";
  ws.getCell(4, 2).value = position;

  const headerRow = ws.getRow(6);
  [
    "Dzień",
    "Rozpoczęcie pracy",
    "Zakończenie pracy",
    "Liczba godzin (h)",
    "Podpis pracownika",
  ].forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
    headerRow.getCell(i + 1).font = { bold: true };
  });

  let totalHours = 0;
  let rowIdx = 7;

  for (let d = 1; d <= daysInMonth; d++) {
    const dayEntries = entriesByDay[d] || [];
    const sortedDayEntries = [...dayEntries].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );

    let startTimeStr = "";
    let endTimeStr = "";
    let dayHoursValue: number | null = null;
    let signatureStr = "";

    if (sortedDayEntries.length > 0) {
      if (sortedDayEntries.length === 1) {
        startTimeStr = sortedDayEntries[0].startTime;
        endTimeStr = sortedDayEntries[0].endTime;
      } else {
        startTimeStr = sortedDayEntries.map((e) => e.startTime).join(", ");
        endTimeStr = sortedDayEntries.map((e) => e.endTime).join(", ");
      }

      let dayHours = 0;
      sortedDayEntries.forEach((entry) => {
        const [sh, sm] = entry.startTime.split(":").map(Number);
        const [eh, em] = entry.endTime.split(":").map(Number);
        let diffSec = eh * 3600 + em * 60 - (sh * 3600 + sm * 60);
        if (diffSec <= 0) diffSec += 86400;
        if (diffSec > 0) dayHours += diffSec / 3600;
      });

      if (dayHours > 0) {
        dayHoursValue = Number(dayHours.toFixed(2));
        totalHours += dayHours;
      }
      signatureStr = `/${employeeName}/`;
    }

    const row = ws.getRow(rowIdx++);
    row.getCell(1).value = `${d}.`;
    row.getCell(2).value = startTimeStr || "-";
    row.getCell(3).value = endTimeStr || "-";
    row.getCell(4).value = dayHoursValue !== null ? dayHoursValue : 0;
    row.getCell(5).value = signatureStr;
  }

  const totalRow = ws.getRow(rowIdx);
  totalRow.getCell(1).value = "RAZEM";
  totalRow.getCell(4).value = totalHours > 0 ? Number(totalHours.toFixed(2)) : 0;
  totalRow.font = { bold: true };

  ws.columns = [
    { width: 12 },
    { width: 22 },
    { width: 22 },
    { width: 20 },
    { width: 32 },
  ];

  const sanitizedName = employeeName.replace(/\s+/g, "_");
  await downloadWorkbook(
    workbook,
    `karta_godzin_${sanitizedName}_${monthName}_${year}.xlsx`
  );
}

/**
 * Eksport Podsumowania Płacowego
 */
export async function exportPayrollToExcel({
  payrollList,
  monthName,
  year,
}: PayrollExportProps) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Podsumowanie Płacowe");

  ws.mergeCells(1, 1, 1, 6);
  ws.getCell(1, 1).value = `ZESTAWIENIE PŁACOWE - DRIFT PARK EXTREME - ${monthName.toUpperCase()} ${year}`;
  ws.getCell(1, 1).font = { bold: true, size: 14 };

  const headers = [
    "Lp.",
    "Pracownik",
    "Stanowisko",
    "Stawka (PLN/h)",
    "Łączne Godziny (h)",
    "Kwota do wypłaty (PLN)",
  ];
  headers.forEach((h, i) => {
    ws.getCell(3, i + 1).value = h;
    ws.getCell(3, i + 1).font = { bold: true };
  });

  let totalHoursSum = 0;
  let totalPayoutSum = 0;
  let rowIdx = 4;

  payrollList.forEach((item, index) => {
    const row = ws.getRow(rowIdx++);
    row.getCell(1).value = index + 1;
    row.getCell(2).value = item.name;
    row.getCell(3).value = item.position;
    row.getCell(4).value = item.hourlyRate;
    row.getCell(5).value = item.totalHours;
    row.getCell(6).value = item.payout;
    totalHoursSum += item.totalHours;
    totalPayoutSum += item.payout;
  });

  const totalRow = ws.getRow(rowIdx);
  totalRow.getCell(1).value = "RAZEM";
  totalRow.getCell(5).value = Number(totalHoursSum.toFixed(2));
  totalRow.getCell(6).value = Number(totalPayoutSum.toFixed(2));
  totalRow.font = { bold: true };

  ws.columns = [
    { width: 6 },
    { width: 28 },
    { width: 22 },
    { width: 16 },
    { width: 18 },
    { width: 22 },
  ];

  await downloadWorkbook(
    workbook,
    `rozliczenie_placowe_${monthName}_${year}.xlsx`
  );
}
