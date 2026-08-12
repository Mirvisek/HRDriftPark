'use client';

import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

Font.register({
  family: 'Roboto',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf',
  fontWeight: 'normal',
});

Font.register({
  family: 'Roboto',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf',
  fontWeight: 'bold',
});

const styles = StyleSheet.create({
  page: {
    padding: 25,
    fontFamily: 'Roboto',
    backgroundColor: '#ffffff',
    fontSize: 9,
    color: '#1a1a1a',
  },
  header: {
    marginBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#d4af37',
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  subtitle: {
    fontSize: 10,
    color: '#555555',
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    minHeight: 22,
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#1f1f1f',
    color: '#ffd700',
    fontWeight: 'bold',
  },
  colDate: { width: '20%', paddingLeft: 6 },
  colHours: { width: '20%', paddingLeft: 6 },
  colLead: { width: '25%', paddingLeft: 6 },
  colSupport: { width: '25%', paddingLeft: 6 },
  colRemarks: { width: '10%', paddingLeft: 6 },
  cellText: {
    fontSize: 8,
  },
  footer: {
    marginTop: 20,
    fontSize: 8,
    color: '#888888',
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
    paddingTop: 8,
  }
});

interface SchedulePDFProps {
  monthName: string;
  year: number;
  entries: Array<{
    date: string;
    openTime?: string | null;
    closeTime?: string | null;
    isClosed?: boolean;
    leadName?: string;
    supportName?: string;
    remarks?: string | null;
  }>;
}

export function SchedulePDFDocument({ monthName, year, entries }: SchedulePDFProps) {
  return (
    <Document title={`Grafik_${monthName}_${year}`}>
      <Page size="A4" orientation="portrait" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>DRIFT PARK EXTREME</Text>
            <Text style={styles.subtitle}>Oficjalny Grafik Pracy — {monthName} {year}</Text>
          </View>
          <Text style={styles.subtitle}>Wygenerowano: {new Date().toLocaleDateString('pl-PL')}</Text>
        </View>

        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <View style={styles.colDate}><Text style={[styles.cellText, { color: '#ffd700', fontWeight: 'bold' }]}>Data</Text></View>
            <View style={styles.colHours}><Text style={[styles.cellText, { color: '#ffd700', fontWeight: 'bold' }]}>Godziny</Text></View>
            <View style={styles.colLead}><Text style={[styles.cellText, { color: '#ffd700', fontWeight: 'bold' }]}>Prowadzący</Text></View>
            <View style={styles.colSupport}><Text style={[styles.cellText, { color: '#ffd700', fontWeight: 'bold' }]}>Wspomagający</Text></View>
            <View style={styles.colRemarks}><Text style={[styles.cellText, { color: '#ffd700', fontWeight: 'bold' }]}>Uwagi</Text></View>
          </View>

          {entries.map((item, idx) => (
            <View key={idx} style={[styles.tableRow, { backgroundColor: idx % 2 === 0 ? '#fafafa' : '#ffffff' }]}>
              <View style={styles.colDate}>
                <Text style={styles.cellText}>{item.date}</Text>
              </View>
              <View style={styles.colHours}>
                <Text style={styles.cellText}>
                  {item.isClosed ? 'ZAMKNIĘTE' : `${item.openTime || '15:00'} - ${item.closeTime || '20:00'}`}
                </Text>
              </View>
              <View style={styles.colLead}>
                <Text style={styles.cellText}>{item.leadName || '—'}</Text>
              </View>
              <View style={styles.colSupport}>
                <Text style={styles.cellText}>{item.supportName || '—'}</Text>
              </View>
              <View style={styles.colRemarks}>
                <Text style={styles.cellText}>{item.remarks || '—'}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text>Drift Park Extreme — Dokument Grafik Pracy — Wygenerowano z systemu HRDriftPark</Text>
        </View>
      </Page>
    </Document>
  );
}
