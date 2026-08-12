'use server';

import { and, asc, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { shiftChecklistItems, shiftChecklists } from '@/db/schema';

export type ChecklistType = 'opening' | 'closing';
export type ChecklistItemStatus = 'pending' | 'completed' | 'not_applicable' | 'problem';

type ChecklistTemplateItem = {
  key: string;
  title: string;
  section: string;
  dueMinutesBeforeClose?: number;
};

const openingItems: ChecklistTemplateItem[] = [
  ['building', 'Otwarcie budynku.', 'Budynek i bezpieczeństwo'],
  ['alarm', 'Rozbrojenie alarmu.', 'Budynek i bezpieczeństwo'],
  ['venue', 'Otwarcie lokalu.', 'Budynek i bezpieczeństwo'],
  ['lighting', 'Włączenie oświetlenia (kolorowe + 1 segment świetlówek).', 'Lokal i stanowisko'],
  ['counter', 'Uruchomienie listwy wraz z laptopem i kasą fiskalną.', 'Lokal i stanowisko'],
  ['toilets-storage', 'Otwarcie pomieszczenia toalet i magazynu.', 'Budynek i bezpieczeństwo'],
  ['mop-bucket', 'Schowanie wiaderka z mopem.', 'Czystość i materiały'],
  ['sound', 'Uruchomienie nagłośnienia.', 'Lokal i stanowisko'],
  ['rooms', 'Otwarcie salek z modelami i salki urodzinowej.', 'Budynek i bezpieczeństwo'],
  ['karts', 'Odłączenie gokartów od ładowania.', 'Sprzęt'],
  ['backroom', 'Otwarcie zaplecza.', 'Budynek i bezpieczeństwo'],
  ['chargers', 'Odłożenie przedłużacza i ładowarek na zaplecze.', 'Sprzęt'],
  ['bathrooms', 'Sprawdzenie czystości łazienek.', 'Czystość i materiały'],
  ['programmer', 'Włączenie zasilania stałego programatora na zapleczu, jeśli są podłączone akumulatory.', 'Sprzęt'],
  ['cash-key', 'Pobranie klucza do szuflady z kasą z zaplecza.', 'Lokal i stanowisko'],
  ['cash-clients', 'Przeliczenie gotówki w kasie i oddzwonienie do klientów.', 'Lokal i stanowisko'],
  ['heating', 'Włączenie ogrzewania jednej dmuchawy nad postojem gokartów, jeśli temperatura jest poniżej 18°C.', 'Lokal i stanowisko'],
  ['rc-batteries', 'Odłączenie baterii modeli RC od ładowania na zapleczu.', 'Sprzęt'],
  ['consents', 'Sprawdzenie zapasu zgód i akceptacji regulaminu; dodruk po 5 sztuk w razie potrzeby.', 'Czystość i materiały'],
  ['birthday-contracts', 'Sprawdzenie umów na urodziny; dodruk po 3 sztuki w razie potrzeby.', 'Czystość i materiały'],
  ['bubbles', 'Sprawdzenie płynu do wytwornicy baniek i ewentualne dolanie.', 'Sprzęt'],
].map(([key, title, section]) => ({ key, title, section }));

const closingItemsRaw: Array<[string, string, string, number?]> = [
  ['mop-water', 'Jeśli to konieczne, wymienić wodę w mopie.', 'Przed zamknięciem', 60],
  ['kitchen', 'Posprzątać aneks kuchenny — umyć kubki itp.', 'Przed zamknięciem', 50],
  ['chargers-ready', 'Przygotować przedłużacz i ładowarki do podpięcia gokartów.', 'Przed zamknięciem', 40],
  ['ride-lists', 'Uzupełnić listy przejazdów w pliku.', 'Przed zamknięciem', 35],
  ['cash-count', 'Przeliczyć gotówkę w kasie.', 'Przed zamknięciem', 30],
  ['trash', 'Wyrzucić śmieci z łazienki i aneksu do zbiorowego worka na zapleczu.', 'Przed zamknięciem', 25],
  ['coffee-machine', 'Wyczyścić ekspres do kawy.', 'Przed zamknięciem', 20],
  ['backroom-floor', 'Pozmywać podłogę na zapleczu.', 'Przed zamknięciem', 15],
  ['rc-charging', 'Odłączyć ładowanie baterii do modeli RC.', 'Przed zamknięciem', 14],
  ['bathroom-clean', 'Sprawdzić czystość łazienki i ewentualnie posprzątać.', 'Przed zamknięciem', 10],
  ['floors', 'Pozmywać podłogę w toalecie, aneksie kuchennym i za ladą.', 'Przed zamknięciem', 10],
  ['karts-charging', 'Podłączyć gokarty do ładowania.', 'Przed zamknięciem', 5],
  ['daily-report', 'Wygenerować raport dobowy na kasie fiskalnej.', 'Zamknięcie i przekazanie', 0],
  ['day-end-file', 'Wpisać dane do pliku „zakończenie dnia”.', 'Zamknięcie i przekazanie'],
  ['send-documents', 'Wysłać listy przejazdów oraz zdjęcia stolika i kasków.', 'Zamknięcie i przekazanie'],
  ['heaters', 'Sprawdzić, czy wszystkie grzejniki są wyłączone z gniazdek.', 'Budynek i bezpieczeństwo'],
  ['windows', 'Sprawdzić, czy wszystkie okna są zamknięte.', 'Budynek i bezpieczeństwo'],
  ['room-lights', 'Pogasić światła w salce urodzinowej, salce modeli i na zapleczu.', 'Budynek i bezpieczeństwo'],
  ['air-conditioner', 'Sprawdzić, czy klimatyzacja jest wyłączona.', 'Budynek i bezpieczeństwo'],
  ['speaker', 'Wyłączyć głośnik.', 'Budynek i bezpieczeństwo'],
  ['heaters-off', 'Wyłączyć nagrzewnice.', 'Budynek i bezpieczeństwo'],
  ['lock-rooms', 'Zamknąć salkę urodzinową, salkę modeli oraz wejście do toalet i magazynu.', 'Budynek i bezpieczeństwo'],
  ['venue-floor', 'Pozmywać podłogę na lokalu.', 'Zamknięcie i przekazanie'],
  ['track-lights', 'Zgasić światła na torze.', 'Budynek i bezpieczeństwo'],
  ['lock-venue', 'Zamknąć lokal.', 'Budynek i bezpieczeństwo'],
  ['secure-alarm', 'Zabezpieczyć alarm.', 'Budynek i bezpieczeństwo'],
  ['downstairs-light', 'Zgasić światło na dole.', 'Budynek i bezpieczeństwo'],
  ['lock-building', 'Zamknąć wejście do budynku.', 'Budynek i bezpieczeństwo'],
];

const closingItems: ChecklistTemplateItem[] = closingItemsRaw.map(([key, title, section, dueMinutesBeforeClose]) => ({
  key, title, section, dueMinutesBeforeClose,
}));

function templateFor(type: ChecklistType) {
  return type === 'opening' ? openingItems : closingItems;
}

async function currentScope() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user as typeof session.user & {
    id?: string;
    venueId?: number;
    isDemo?: boolean;
  };
  return {
    userId: Number(user.id),
    displayName: session.user.name || 'Pracownik',
    venueId: Number(user.venueId || 1),
    isDemo: user.isDemo === true,
  };
}

export async function getChecklistAction(date: string, type: ChecklistType) {
  const scope = await currentScope();
  if (!scope) return { success: false, error: 'Brak autoryzacji.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { success: false, error: 'Nieprawidłowa data.' };

  try {
    let [checklist] = await db.select().from(shiftChecklists).where(and(
      eq(shiftChecklists.date, date), eq(shiftChecklists.type, type),
      eq(shiftChecklists.venueId, scope.venueId), eq(shiftChecklists.isDemo, scope.isDemo),
    )).limit(1);

    if (!checklist) {
      const created = await db.insert(shiftChecklists).values({
        date, type, venueId: scope.venueId, isDemo: scope.isDemo,
      });
      const checklistId = Number(created[0].insertId);
      const template = templateFor(type);
      await db.insert(shiftChecklistItems).values(template.map((item, index) => ({
        checklistId, itemKey: item.key, title: item.title, section: item.section,
        sortOrder: index + 1, dueMinutesBeforeClose: item.dueMinutesBeforeClose ?? null,
      })));
      [checklist] = await db.select().from(shiftChecklists).where(eq(shiftChecklists.id, checklistId)).limit(1);
    }

    const items = await db.select().from(shiftChecklistItems)
      .where(eq(shiftChecklistItems.checklistId, checklist.id)).orderBy(asc(shiftChecklistItems.sortOrder));
    return { success: true, checklist, data: items };
  } catch (error) {
    console.error('[Checklist] Loading failed:', error);
    return { success: false, error: 'Nie udało się wczytać checklisty.' };
  }
}

export async function updateChecklistItemAction(
  itemId: number, status: ChecklistItemStatus, note?: string,
) {
  const scope = await currentScope();
  if (!scope) return { success: false, error: 'Brak autoryzacji.' };
  if (!['pending', 'completed', 'not_applicable', 'problem'].includes(status)) {
    return { success: false, error: 'Nieprawidłowy status.' };
  }
  const cleanedNote = note?.trim() || null;
  if (status === 'problem' && !cleanedNote) {
    return { success: false, error: 'Przy oznaczeniu problemu dodaj opis.' };
  }

  try {
    const [item] = await db.select({ id: shiftChecklistItems.id }).from(shiftChecklistItems)
      .innerJoin(shiftChecklists, eq(shiftChecklistItems.checklistId, shiftChecklists.id))
      .where(and(eq(shiftChecklistItems.id, itemId), eq(shiftChecklists.venueId, scope.venueId), eq(shiftChecklists.isDemo, scope.isDemo)))
      .limit(1);
    if (!item) return { success: false, error: 'Nie znaleziono elementu checklisty.' };

    const isFinished = status === 'completed' || status === 'not_applicable' || status === 'problem';
    await db.update(shiftChecklistItems).set({
      status, note: cleanedNote,
      completedBy: isFinished ? scope.userId : null,
      completedByName: isFinished ? scope.displayName : null,
      completedAt: isFinished ? new Date() : null,
    }).where(eq(shiftChecklistItems.id, itemId));
    return { success: true };
  } catch (error) {
    console.error('[Checklist] Update failed:', error);
    return { success: false, error: 'Nie udało się zapisać zmiany.' };
  }
}
