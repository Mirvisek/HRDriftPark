import { describe, it, expect } from 'vitest';
import {
  calculateShiftDuration,
  findApplicableHourlyRate,
  calculateShiftPayout,
  timeStringToSeconds
} from './payrollCalculator';

describe('payrollCalculator', () => {
  describe('timeStringToSeconds', () => {
    it('poprawnie przelicza godziny i minuty na sekundy', () => {
      expect(timeStringToSeconds('00:00')).toBe(0);
      expect(timeStringToSeconds('01:30')).toBe(5400);
      expect(timeStringToSeconds('12:00')).toBe(43200);
    });

    it('zwraca 0 dla niepoprawnego formatu', () => {
      expect(timeStringToSeconds('')).toBe(0);
      expect(timeStringToSeconds('invalid')).toBe(0);
    });
  });

  describe('calculateShiftDuration', () => {
    it('poprawnie oblicza czas trwania zmiany w ciągu tego samego dnia', () => {
      const result = calculateShiftDuration('10:00', '18:00');
      expect(result.totalSeconds).toBe(8 * 3600);
      expect(result.durationHours).toBe(8);
    });

    it('poprawnie oblicza czas trwania zmiany przechodzącej przez północ', () => {
      // np. od 22:00 do 02:00 = 4 godziny
      const result = calculateShiftDuration('22:00', '02:00');
      expect(result.totalSeconds).toBe(4 * 3600);
      expect(result.durationHours).toBe(4);
    });

    it('poprawnie radzi sobie z niepełnymi godzinami', () => {
      const result = calculateShiftDuration('14:15', '16:45');
      expect(result.durationHours).toBe(2.5);
    });
  });

  describe('findApplicableHourlyRate', () => {
    const history = [
      {
        userId: 1,
        hourlyRate: 25,
        validFrom: '2026-01-01',
        validTo: '2026-05-31',
      },
      {
        userId: 1,
        hourlyRate: 30,
        validFrom: '2026-06-01',
        validTo: null,
      },
    ];

    it('wybiera stawkę historyczną w podanym przedziale', () => {
      const rate = findApplicableHourlyRate('2026-03-15', history, 20);
      expect(rate).toBe(25);
    });

    it('wybiera stawkę aktualną (bez validTo)', () => {
      const rate = findApplicableHourlyRate('2026-07-01', history, 20);
      expect(rate).toBe(30);
    });

    it('używa stawki fallbackRate jeśli brak dopasowania w historii', () => {
      const rate = findApplicableHourlyRate('2025-12-31', history, 22.5);
      expect(rate).toBe(22.5);
    });
  });

  describe('calculateShiftPayout', () => {
    it('poprawnie wylicza kwotę do wypłaty zaokrągloną do 2 miejsc', () => {
      expect(calculateShiftPayout(8, 25)).toBe(200);
      expect(calculateShiftPayout(7.5, 33.33)).toBe(249.98);
    });
  });
});
