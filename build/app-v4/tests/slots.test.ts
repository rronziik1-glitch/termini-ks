// Slot calculation (pure functions) + time zone helpers.
import { describe, expect, it } from 'vitest';
import { hoursToRows, rowsToHours, type HoursDoc } from '../lib/business';
import { normalizePhone } from '../lib/phone';
import { merge, slotStarts, subtract } from '../lib/slots';
import { slugify } from '../lib/slug';
import { hmToMin, localToUtc, minToHm, toLocal } from '../lib/time';

const day = (a: string, b: string) => ({ start: hmToMin(a), end: hmToMin(b) });
const times = (list: number[]) => list.map(minToHm);

describe('slotStarts', () => {
  it('offers every step where the service fits before closing', () => {
    const s = times(slotStarts({ working: [day('09:00', '11:00')], busy: [], durationMin: 30, stepMin: 30 }));
    expect(s).toEqual(['09:00', '09:30', '10:00', '10:30']);
  });

  it('does not offer a start that would run past closing time', () => {
    const s = times(slotStarts({ working: [day('09:00', '10:00')], busy: [], durationMin: 45, stepMin: 15 }));
    expect(s).toEqual(['09:00', '09:15']);
  });

  it('respects a lunch break (two working intervals)', () => {
    const s = times(slotStarts({ working: [day('12:00', '13:00'), day('14:00', '15:00')], busy: [], durationMin: 30, stepMin: 30 }));
    expect(s).toEqual(['12:00', '12:30', '14:00', '14:30']);
  });

  it('removes times that overlap an existing booking, including partial overlaps', () => {
    const s = times(slotStarts({ working: [day('09:00', '11:00')], busy: [day('09:30', '10:00')], durationMin: 30, stepMin: 15 }));
    expect(s).toEqual(['09:00', '10:00', '10:15', '10:30']);
  });

  it('keeps the buffer after a service free', () => {
    const s = times(slotStarts({ working: [day('09:00', '10:00')], busy: [], durationMin: 30, bufferMin: 15, stepMin: 15 }));
    expect(s).toEqual(['09:00', '09:15']);
  });

  it('applies the minimum notice on the same day and stays on the grid', () => {
    const s = times(slotStarts({ working: [day('09:00', '11:00')], busy: [], durationMin: 30, stepMin: 30, earliestMin: hmToMin('09:40') }));
    expect(s).toEqual(['10:00', '10:30']);
  });

  it('returns nothing on a closed day or a full day', () => {
    expect(slotStarts({ working: [], busy: [], durationMin: 30, stepMin: 15 })).toEqual([]);
    expect(slotStarts({ working: [day('09:00', '10:00')], busy: [day('08:00', '12:00')], durationMin: 30, stepMin: 15 })).toEqual([]);
  });

  it('merges and subtracts intervals', () => {
    expect(merge([day('10:00', '11:00'), day('09:00', '10:00'), day('10:30', '12:00')])).toEqual([day('09:00', '12:00')]);
    expect(subtract([day('09:00', '17:00')], [day('12:00', '13:00')])).toEqual([day('09:00', '12:00'), day('13:00', '17:00')]);
  });
});

describe('time zone (Europe/Belgrade)', () => {
  it('stores local wall time as UTC in winter and summer', () => {
    expect(localToUtc('2026-11-14', '15:30').toISOString()).toBe('2026-11-14T14:30:00.000Z');   // CET, UTC+1
    expect(localToUtc('2026-07-14', '15:30').toISOString()).toBe('2026-07-14T13:30:00.000Z');   // CEST, UTC+2
  });

  it('round-trips on the days the clocks change', () => {
    for (const date of ['2027-03-28', '2026-10-25']) {
      const l = toLocal(localToUtc(date, '10:00'));
      expect([l.date, l.time]).toEqual([date, '10:00']);
    }
    expect(toLocal(new Date('2026-11-13T23:30:00Z')).date).toBe('2026-11-14');
    expect(toLocal(new Date('2026-11-15T12:00:00Z')).weekday).toBe(7);
  });
});

describe('weekly hours document', () => {
  it('splits open days around the pause and reads them back', () => {
    const doc: HoursDoc = {
      days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, open: weekday < 7, start: '09:00', end: weekday === 6 ? '13:00' : '20:00' })),
      pause: { on: true, start: '13:00', end: '13:30' },
    };
    const rows = hoursToRows(doc);
    expect(rows.filter((r) => r.weekday === 1)).toEqual([
      { weekday: 1, startLocal: '09:00', endLocal: '13:00' },
      { weekday: 1, startLocal: '13:30', endLocal: '20:00' },
    ]);
    expect(rows.filter((r) => r.weekday === 6)).toHaveLength(1);        // the pause is outside Saturday's hours
    expect(rows.filter((r) => r.weekday === 7)).toHaveLength(0);
    const back = rowsToHours(rows.map((r) => ({ ...r, staffId: null })));
    expect(back.pause).toEqual({ on: true, start: '13:00', end: '13:30' });
    expect(back.days[0]).toEqual({ weekday: 1, open: true, start: '09:00', end: '20:00' });
    expect(back.days[6].open).toBe(false);
  });

  it('rejects a closing time before the opening time', () => {
    expect(() => hoursToRows({ days: [{ weekday: 1, open: true, start: '18:00', end: '09:00' }], pause: { on: false, start: '13:00', end: '13:30' } })).toThrow();
  });
});

describe('phone numbers and slugs', () => {
  it('normalises Kosovo numbers to E.164', () => {
    expect(normalizePhone('044 123 456')).toBe('+38344123456');
    expect(normalizePhone('49 123 456')).toBe('+38349123456');
    expect(normalizePhone('+383 (0)44 123-456'.replace('(0)', '0'))).toBe('+38344123456');
    expect(normalizePhone('00383 44 123 456')).toBe('+38344123456');
    expect(normalizePhone('+49 151 12345678')).toBe('+4915112345678');
    expect(normalizePhone('069 123 4567')).toBeNull();                   // Albania only with +355
    expect(normalizePhone('12')).toBeNull();
  });

  it('builds slugs without ë and ç', () => {
    expect(slugify('Berberi Arti')).toBe('berberi-arti');
    expect(slugify('Çarshia e Gjakovës!')).toBe('carshia-e-gjakoves');
  });
});
