export type ShiftRole = 'lead' | 'support' | 'cleaning' | 'replacement';

export const SHIFT_ROLE_LABELS: Record<ShiftRole, string> = {
  lead: 'Osoba prowadząca',
  support: 'Osoba wspomagająca',
  cleaning: 'Prace porządkowe',
  replacement: 'Zamiana osoby prowadzącej',
};

export const ROLE_DESCRIPTIONS: Record<ShiftRole, { title: string; desc: string; icon: string }> = {
  lead: {
    title: 'Osoba prowadząca',
    desc: 'Odpowiedzialność za otwarcie/zamknięcie, rozliczenie kasy i koordynację zmiany.',
    icon: '👑',
  },
  support: {
    title: 'Osoba wspomagająca',
    desc: 'Wsparcie na torze, obsługa klientów, szkolenia i pomoc techniczna.',
    icon: '🤝',
  },
  cleaning: {
    title: 'Prace porządkowe',
    desc: 'Prace czyszczące, serwisowe, porządkowanie toru i zaplecza (bez dostępu do kasy).',
    icon: '🧹',
  },
  replacement: {
    title: 'Zamiana osoby prowadzącej',
    desc: 'Zastępstwo w roli osoby prowadzącej z pełnymi uprawnieniami rozliczeniowymi.',
    icon: '🔄',
  },
};

export function getRoleLabel(role?: string | null): string {
  if (!role) return 'Osoba prowadząca';
  return SHIFT_ROLE_LABELS[role as ShiftRole] || 'Osoba prowadząca';
}

export interface ActiveShiftInfo {
  hasActiveShift: boolean;
  shift?: {
    id: number;
    userId: number;
    date: string;
    startTime: string;
    startedAt: string | null;
    shiftRole: ShiftRole;
    venueId: number;
  };
  suggestedRole?: ShiftRole;
}
