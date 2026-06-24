import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { TimesheetEntry } from '@/app/actions/timesheetActions';

// Rejestracja czcionki Roboto wspierającej polskie znaki bezpośrednio z lokalnych plików na Twoim serwerze
Font.register({
  family: 'Roboto',
  fonts: [
    { src: '/fonts/Roboto-Regular.ttf' },
    { src: '/fonts/Roboto-Bold.ttf', fontWeight: 'bold' }
  ]
});

const styles = StyleSheet.create({
  page: {
    paddingTop: 35,
    paddingBottom: 35,
    paddingHorizontal: 40,
    fontFamily: 'Roboto',
    backgroundColor: '#ffffff',
    fontSize: 9,
    color: '#000000',
  },
  title: {
    fontFamily: 'Roboto',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 25,
  },
  metaRow: {
    fontFamily: 'Roboto',
    fontSize: 10,
    marginBottom: 6,
    flexDirection: 'row',
  },
  metaLabel: {
    fontFamily: 'Roboto',
    fontWeight: 'bold',
  },
  metaValue: {
    fontFamily: 'Roboto',
    fontWeight: 'normal',
  },
  table: {
    flexDirection: 'column',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#000000',
    marginTop: 20,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#e0e0e0',
    height: 28,
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    height: 18,
    alignItems: 'center',
  },
  cell: {
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    padding: 2,
  },
  cellText: {
    fontFamily: 'Roboto',
    fontSize: 8,
    textAlign: 'center',
  },
  cellTextBold: {
    fontFamily: 'Roboto',
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  colDay: { width: '12%' },
  colStart: { width: '18%' },
  colEnd: { width: '18%' },
  colHours: { width: '15%' },
  colSig: { width: '37%' },
});

interface TimesheetPDFProps {
  entries: TimesheetEntry[];
  employeeName: string;
  position: string;
  monthName: string;
  year: number;
  month?: number;
}

export function TimesheetPDF({ entries, employeeName, position, monthName, year, month }: TimesheetPDFProps) {
  // Mapowanie nazwy miesiąca na numer (1-12) jako fallback
  const monthNamesMap: Record<string, number> = {
    "Styczeń": 1, "Luty": 2, "Marzec": 3, "Kwiecień": 4, "Maj": 5, "Czerwiec": 6,
    "Lipiec": 7, "Sierpień": 8, "Wrzesień": 9, "Październik": 10, "Listopad": 11, "Grudzień": 12
  };
  const monthNumber = month || monthNamesMap[monthName] || 1;

  // Obliczenie liczby dni w miesiącu
  const daysInMonth = new Date(year, monthNumber, 0).getDate();

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

  // Suma godzin dla całego miesiąca
  let totalHours = 0;
  entries.forEach(entry => {
    const [sh, sm] = entry.startTime.split(':').map(Number);
    const [eh, em] = entry.endTime.split(':').map(Number);
    const diffMin = (eh * 60 + em) - (sh * 60 + sm);
    if (diffMin > 0) {
      totalHours += diffMin / 60;
    }
  });

  const rows = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayEntries = entriesByDay[d] || [];
    
    // Sortowanie wpisów z danego dnia chronologicznie
    const sortedDayEntries = [...dayEntries].sort((a, b) => a.startTime.localeCompare(b.startTime));

    let startTimeStr = "";
    let endTimeStr = "";
    let hoursStr = "";
    let signatureStr = "";

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
      hoursStr = dayHours > 0 ? dayHours.toFixed(2) : "";
      signatureStr = `/${employeeName}/`;
    }

    rows.push(
      <View key={d} style={styles.tableRow}>
        {/* Dzień miesiąca */}
        <View style={[styles.cell, styles.colDay]}>
          <Text style={styles.cellTextBold}>{d}.</Text>
        </View>
        
        {/* Rozpoczęcie pracy */}
        <View style={[styles.cell, styles.colStart]}>
          <Text style={styles.cellText}>{startTimeStr}</Text>
        </View>
        
        {/* Zakończenie pracy */}
        <View style={[styles.cell, styles.colEnd]}>
          <Text style={styles.cellText}>{endTimeStr}</Text>
        </View>
        
        {/* Ilość godzin */}
        <View style={[styles.cell, styles.colHours]}>
          <Text style={styles.cellText}>{hoursStr}</Text>
        </View>
        
        {/* Podpis pracownika */}
        <View style={[styles.cell, styles.colSig]}>
          <Text style={styles.cellText}>{signatureStr}</Text>
        </View>
      </View>
    );
  }

  const summaryRow = (
    <View key="summary" style={styles.tableRow}>
      {/* Razem: */}
      <View style={[styles.cell, styles.colDay]}>
        <Text style={styles.cellTextBold}>Razem:</Text>
      </View>
      
      {/* Puste pole dla Rozpoczęcia */}
      <View style={[styles.cell, styles.colStart]}>
        <Text style={styles.cellText}></Text>
      </View>
      
      {/* Puste pole dla Zakończenia */}
      <View style={[styles.cell, styles.colEnd]}>
        <Text style={styles.cellText}></Text>
      </View>
      
      {/* Łączna ilość godzin */}
      <View style={[styles.cell, styles.colHours]}>
        <Text style={styles.cellTextBold}>{totalHours > 0 ? totalHours.toFixed(2) : ""}</Text>
      </View>
      
      {/* Puste pole dla Podpisu */}
      <View style={[styles.cell, styles.colSig]}>
        <Text style={styles.cellText}></Text>
      </View>
    </View>
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Tytuł główny */}
        <Text style={styles.title}>
          Lista obecności za m-c {monthName} {year} r.
        </Text>

        {/* Dane pracownika */}
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Imię i nazwisko: </Text>
          <Text style={styles.metaValue}>{employeeName}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Stanowisko: </Text>
          <Text style={styles.metaValue}>{position}</Text>
        </View>

        {/* Siatka tabeli */}
        <View style={styles.table}>
          {/* Nagłówek */}
          <View style={styles.tableHeaderRow}>
            <View style={[styles.cell, styles.colDay]}>
              <Text style={styles.cellTextBold}>Dzień</Text>
              <Text style={styles.cellTextBold}>miesiąca</Text>
            </View>
            <View style={[styles.cell, styles.colStart]}>
              <Text style={styles.cellTextBold}>Rozpoczęcie</Text>
              <Text style={styles.cellTextBold}>pracy</Text>
            </View>
            <View style={[styles.cell, styles.colEnd]}>
              <Text style={styles.cellTextBold}>Zakończenie</Text>
              <Text style={styles.cellTextBold}>pracy</Text>
            </View>
            <View style={[styles.cell, styles.colHours]}>
              <Text style={styles.cellTextBold}>Ilość godzin</Text>
            </View>
            <View style={[styles.cell, styles.colSig]}>
              <Text style={styles.cellTextBold}>Podpis pracownika</Text>
            </View>
          </View>

          {/* Rekordy dni */}
          {rows}

          {/* Rekord podsumowania */}
          {summaryRow}
        </View>
      </Page>
    </Document>
  );
}
