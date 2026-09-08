import fs from 'fs';
import path from 'path';

export interface DemoUser {
  id: number;
  displayName: string;
  email: string;
  role: 'owner' | 'manager' | 'pracownik' | 'technik';
  position: string;
  venueId: number;
}

export interface DemoScheduleItem {
  id: number;
  date: string;
  leadUserId: number;
  supportUserId: number;
  venueId: number;
  isClosed?: boolean;
}

export interface DemoChecklistItem {
  id: number;
  date: string;
  type: 'opening' | 'closing';
  title: string;
  status: 'pending' | 'completed' | 'problem';
  section: string;
  completedByName?: string;
}

export interface DemoTask {
  id: number;
  title: string;
  description?: string;
  assignedToName?: string;
  completed: boolean;
  dueDate?: string;
}

export interface DemoInventoryProduct {
  id: number;
  name: string;
  sku: string;
  category: string;
  unit: string;
  minStock: number;
  currentStock: number;
}

export interface DemoDataSchema {
  users: DemoUser[];
  schedule: DemoScheduleItem[];
  checklists: DemoChecklistItem[];
  tasks: DemoTask[];
  inventory: DemoInventoryProduct[];
  lastUpdated: string;
}

const DEMO_DB_PATH = path.join(process.cwd(), 'data', 'demo-db.json');

const INITIAL_DEMO_DATA: DemoDataSchema = {
  users: [
    { id: 1, displayName: 'Jan Kowalski (Manager Demo)', email: 'demo.manager@driftpark.pl', role: 'manager', position: 'Kierownik Toru', venueId: 1 },
    { id: 2, displayName: 'Michał Nowak (Pracownik Demo)', email: 'demo.michal@driftpark.pl', role: 'pracownik', position: 'Obsługa Widowni', venueId: 1 },
    { id: 3, displayName: 'Piotr Wiśniewski (Technik Demo)', email: 'demo.technik@driftpark.pl', role: 'technik', position: 'Mechanik Gokartów', venueId: 1 },
  ],
  schedule: [
    { id: 1, date: new Date().toISOString().split('T')[0], leadUserId: 1, supportUserId: 2, venueId: 1 },
  ],
  checklists: [
    { id: 1, date: new Date().toISOString().split('T')[0], type: 'opening', title: 'Rozbrojenie alarmu i otwarcie lokalu', status: 'completed', section: 'Budynek', completedByName: 'Jan Kowalski' },
    { id: 2, date: new Date().toISOString().split('T')[0], type: 'opening', title: 'Uruchomienie terminala POS i kasy fiskalnej', status: 'completed', section: 'Lokal', completedByName: 'Jan Kowalski' },
    { id: 3, date: new Date().toISOString().split('T')[0], type: 'opening', title: 'Sprawdzenie gokartów i odłączenie ładowarek', status: 'pending', section: 'Sprzęt' },
    { id: 4, date: new Date().toISOString().split('T')[0], type: 'closing', title: 'Przeliczenie kasy i generowanie raportu dobowego', status: 'pending', section: 'Finanse' },
    { id: 5, date: new Date().toISOString().split('T')[0], type: 'closing', title: 'Podłączenie gokartów do ładowania', status: 'pending', section: 'Sprzęt' },
  ],
  tasks: [
    { id: 1, title: 'Wymiana oleju w gokarcie #04', description: 'Techniczny przegląd po 50h jazdy', assignedToName: 'Piotr Wiśniewski (Technik Demo)', completed: false, dueDate: new Date().toISOString().split('T')[0] },
    { id: 2, title: 'Uzupełnienie zgód na jazdy w recepcji', description: 'Wydrukować 20 egzemplarzy zgód', assignedToName: 'Michał Nowak (Pracownik Demo)', completed: true, dueDate: new Date().toISOString().split('T')[0] },
  ],
  inventory: [
    { id: 1, name: 'Olej silnikowy 4T 1L', sku: 'OL-4T-1L', category: 'Części i Chemia', unit: 'szt', minStock: 5, currentStock: 12 },
    { id: 2, name: 'Kask Ochronny rozmiarek M', sku: 'KSK-M', category: 'Wyposażenie', unit: 'szt', minStock: 10, currentStock: 18 },
    { id: 3, name: 'Bilet Jazda 10 min', sku: 'TK-10M', category: 'Usługi', unit: 'szt', minStock: 0, currentStock: 500 },
  ],
  lastUpdated: new Date().toISOString(),
};

/**
 * Odczytuje dane demo z lokalnego pliku JSON
 */
export function getDemoData(): DemoDataSchema {
  try {
    const dir = path.dirname(DEMO_DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(DEMO_DB_PATH)) {
      saveDemoData(INITIAL_DEMO_DATA);
      return INITIAL_DEMO_DATA;
    }

    const content = fs.readFileSync(DEMO_DB_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    return parsed;
  } catch (err) {
    console.error('[Demo DB] Błąd odczytu bazy plikowej, inicjalizacja domyślnych danych:', err);
    saveDemoData(INITIAL_DEMO_DATA);
    return INITIAL_DEMO_DATA;
  }
}

/**
 * Zapisuje dane demo do lokalnego pliku JSON
 */
export function saveDemoData(data: DemoDataSchema): boolean {
  try {
    const dir = path.dirname(DEMO_DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DEMO_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[Demo DB] Błąd zapisu bazy plikowej:', err);
    return false;
  }
}

/**
 * Przywraca dane demo do stanu fabrycznego
 */
export function resetDemoData(): DemoDataSchema {
  const freshData = {
    ...INITIAL_DEMO_DATA,
    lastUpdated: new Date().toISOString(),
  };
  saveDemoData(freshData);
  return freshData;
}
