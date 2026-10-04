import ExcelJS from "exceljs";

export type WarehouseImportRow = {
  name: string;
  categoryName: string;
  unit: string;
  supplier: string;
  sku: string;
  location: string;
  initialStock: number;
  minStock: number;
  maxStock: number;
  hasExpiry: boolean;
  autoSpotCheck: boolean;
  remarks: string;
};

function colIndex(headers: string[], names: string[]) {
  return headers.findIndex((h) => names.some((n) => h.includes(n)));
}

function parseBoolean(val: unknown) {
  if (val == null || val === "") return false;
  const str = String(val).trim().toLowerCase();
  return str === "tak" || str === "yes" || str === "true" || str === "1" || str === "t";
}

function rowsFromMatrix(rows: unknown[][]): WarehouseImportRow[] {
  if (rows.length < 2) {
    throw new Error("Arkusz jest pusty lub nie posiada nagłówków.");
  }

  const headers = rows[0].map((h) => String(h ?? "").trim().toLowerCase());
  const idxName = colIndex(headers, ["nazwa", "name", "artykuł", "produkt"]);
  const idxCategory = colIndex(headers, ["kategoria", "category", "grupa"]);
  const idxUnit = colIndex(headers, ["jednostka", "unit", "miara"]);
  const idxSupplier = colIndex(headers, ["dostawca", "supplier", "producent"]);
  const idxSku = colIndex(headers, ["sku", "kod", "index"]);
  const idxLocation = colIndex(headers, ["lokalizacja", "location", "półka", "miejsce"]);
  const idxInitialStock = colIndex(headers, ["stan", "ilość", "stock", "ilośc", "początkowy", "ilosc"]);
  const idxMinStock = colIndex(headers, ["min", "minimalny", "ostrzegawczy"]);
  const idxMaxStock = colIndex(headers, ["max", "maksymalny"]);
  const idxHasExpiry = colIndex(headers, ["ważności", "expiry", "data", "waznosci"]);
  const idxAutoSpotCheck = colIndex(headers, ["wybiórcza", "spot", "auto", "wybiorcza"]);
  const idxRemarks = colIndex(headers, ["uwagi", "remarks", "opis"]);

  if (idxName === -1 || idxCategory === -1) {
    throw new Error("Nie odnaleziono wymaganych kolumn (Nazwa, Kategoria).");
  }

  const parsedProducts: WarehouseImportRow[] = [];
  const maxRows = Math.min(rows.length, 501); // header + 500

  for (let i = 1; i < maxRows; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row[idxName] == null || row[idxName] === "") continue;

    parsedProducts.push({
      name: String(row[idxName]).trim(),
      categoryName: String(row[idxCategory] ?? "").trim() || "Inne",
      unit: idxUnit !== -1 && row[idxUnit] != null ? String(row[idxUnit]).trim() : "szt.",
      supplier: idxSupplier !== -1 && row[idxSupplier] != null ? String(row[idxSupplier]).trim() : "",
      sku: idxSku !== -1 && row[idxSku] != null ? String(row[idxSku]).trim() : "",
      location: idxLocation !== -1 && row[idxLocation] != null ? String(row[idxLocation]).trim() : "",
      initialStock:
        idxInitialStock !== -1 && row[idxInitialStock] != null
          ? Number(row[idxInitialStock]) || 0
          : 0,
      minStock: idxMinStock !== -1 && row[idxMinStock] != null ? Number(row[idxMinStock]) || 0 : 0,
      maxStock: idxMaxStock !== -1 && row[idxMaxStock] != null ? Number(row[idxMaxStock]) || 0 : 0,
      hasExpiry: idxHasExpiry !== -1 ? parseBoolean(row[idxHasExpiry]) : false,
      autoSpotCheck: idxAutoSpotCheck !== -1 ? parseBoolean(row[idxAutoSpotCheck]) : false,
      remarks: idxRemarks !== -1 && row[idxRemarks] != null ? String(row[idxRemarks]).trim() : "",
    });
  }

  if (parsedProducts.length === 0) {
    throw new Error("Brak poprawnych rekordów produktów w pliku.");
  }
  if (rows.length - 1 > 500) {
    throw new Error("Plik ma więcej niż 500 wierszy danych. Podziel import.");
  }

  return parsedProducts;
}

function parseCsv(text: string): unknown[][] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        cells.push(current);
        current = "";
      } else if ((ch === ";" || ch === "\t") && !inQuotes && cells.length === 0 && !line.includes(",")) {
        // fallback delimiter handled below
        current += ch;
      } else {
        current += ch;
      }
    }
    cells.push(current);

    // If only one cell and semicolon-separated, re-split
    if (cells.length === 1 && line.includes(";")) {
      return line.split(";").map((c) => c.trim());
    }
    return cells.map((c) => c.trim());
  });
}

/**
 * Parse warehouse import file client-side with exceljs (xlsx) or CSV.
 * Replaces vulnerable SheetJS/xlsx usage.
 */
export async function parseWarehouseImportFile(file: File): Promise<WarehouseImportRow[]> {
  const name = file.name.toLowerCase();
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Plik nie może przekraczać 5 MB.");
  }

  if (name.endsWith(".csv") || file.type === "text/csv") {
    const text = await file.text();
    return rowsFromMatrix(parseCsv(text));
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    // exceljs supports xlsx; legacy .xls may fail — surface clear error
    try {
      await workbook.xlsx.load(buffer);
    } catch {
      throw new Error("Nie udało się odczytać pliku. Użyj .xlsx lub .csv.");
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("Brak arkusza w pliku.");

    const matrix: unknown[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      matrix.push((row.values as unknown[]).slice(1)); // exceljs is 1-indexed
    });
    return rowsFromMatrix(matrix);
  }

  throw new Error("Dozwolone formaty: .xlsx, .csv");
}
