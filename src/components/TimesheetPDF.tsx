import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { TimesheetEntry } from '@/app/actions/timesheetActions';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    fontSize: 10,
    color: '#333333',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#ff3333',
    paddingBottom: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111111',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 8,
    color: '#888888',
    marginTop: 3,
    letterSpacing: 1.5,
  },
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eeeeee',
  },
  metaCol: {
    flexDirection: 'column',
  },
  metaLabel: {
    fontSize: 8,
    color: '#888888',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111111',
  },
  table: {
    flexDirection: 'column',
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 6,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#dddddd',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableHeaderCell: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableRowOdd: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    backgroundColor: '#fcfcfc',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  cellDate: { width: '25%' },
  cellTime: { width: '15%' },
  cellDuration: { width: '15%', textAlign: 'center' },
  cellRemarks: { width: '45%' },
  summaryContainer: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingRight: 10,
  },
  summaryText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#111111',
  },
  signatureSection: {
    marginTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBox: {
    width: '45%',
    flexDirection: 'column',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#cccccc',
    paddingTop: 10,
  },
  signatureLabel: {
    fontSize: 8,
    color: '#888888',
    marginBottom: 5,
  },
  signatureName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333333',
    fontStyle: 'italic',
  },
});

interface TimesheetPDFProps {
  entries: TimesheetEntry[];
  employeeName: string;
  position: string;
  monthName: string;
  year: number;
}

export function TimesheetPDF({ entries, employeeName, position, monthName, year }: TimesheetPDFProps) {
  // Sortowanie wpisów chronologicznie
  const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  // Obliczenie sumy godzin
  const calculateTotalHours = () => {
    let total = 0;
    entries.forEach(e => {
      const [sh, sm] = e.startTime.split(':').map(Number);
      const [eh, em] = e.endTime.split(':').map(Number);
      const diffMin = (eh * 60 + em) - (sh * 60 + sm);
      if (diffMin > 0) total += diffMin / 60;
    });
    return total.toFixed(1);
  };

  const getDuration = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) return '0.0h';
    return `${(diff / 60).toFixed(1)}h`;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* Nagłówek serwisu */}
        <View style={styles.header}>
          <Text style={styles.title}>Drift Park Extreme</Text>
          <Text style={styles.subtitle}>KARTA EWIDENCJI CZASU PRACY</Text>
        </View>

        {/* Metadane pracownika */}
        <View style={styles.metaContainer}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Pracownik</Text>
            <Text style={styles.metaValue}>{employeeName}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Stanowisko</Text>
            <Text style={styles.metaValue}>{position}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Miesiąc / Rok</Text>
            <Text style={styles.metaValue}>{monthName} {year}</Text>
          </View>
        </View>

        {/* Tabela godzin */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.cellDate]}>Data</Text>
            <Text style={[styles.tableHeaderCell, styles.cellTime]}>Start</Text>
            <Text style={[styles.tableHeaderCell, styles.cellTime]}>Koniec</Text>
            <Text style={[styles.tableHeaderCell, styles.cellDuration, { color: '#ffd700' }]}>Suma</Text>
            <Text style={[styles.tableHeaderCell, styles.cellRemarks]}>Uwagi</Text>
          </View>

          {sortedEntries.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={{ width: '100%', textAlign: 'center', color: '#888888', fontStyle: 'italic', paddingVertical: 10 }}>
                Brak wpisów w tym miesiącu.
              </Text>
            </View>
          ) : (
            sortedEntries.map((entry, index) => {
              const isOdd = index % 2 === 1;
              const rowStyle = isOdd ? styles.tableRowOdd : styles.tableRow;
              
              return (
                <View key={entry.id || index} style={rowStyle}>
                  <Text style={styles.cellDate}>{entry.date}</Text>
                  <Text style={styles.cellTime}>{entry.startTime}</Text>
                  <Text style={styles.cellTime}>{entry.endTime}</Text>
                  <Text style={[styles.cellDuration, { fontWeight: 'bold' }]}>
                    {getDuration(entry.startTime, entry.endTime)}
                  </Text>
                  <Text style={styles.cellRemarks}>{entry.remarks || '—'}</Text>
                </View>
              );
            })
          )}
        </View>

        {/* Podsumowanie godzin */}
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryText}>Łączny czas pracy: {calculateTotalHours()} godz.</Text>
        </View>

        {/* Sekcja podpisów */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Zatwierdził (Manager / Owner)</Text>
            <Text style={{ fontSize: 10, color: '#cccccc', marginTop: 15 }}>..............................................</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Podpis pracownika</Text>
            <Text style={styles.signatureName}>/{employeeName}/</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}
