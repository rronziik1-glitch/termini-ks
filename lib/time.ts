// Time helpers. Every business lives in Europe/Belgrade (Kosovo: CET/CEST).
// Bookings are stored in UTC; slots are computed in local wall time so DST days work.

export const TZ = 'Europe/Belgrade';

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

function wall(d: Date, tz: string) {
  const p: Record<string, number> = {};
  for (const part of fmt(tz).formatToParts(d)) if (part.type !== 'literal') p[part.type] = Number(part.value);
  return p as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Local time minus UTC, in minutes, at the given instant. */
export function tzOffsetMin(d: Date, tz = TZ): number {
  const w = wall(d, tz);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}

export const pad2 = (n: number) => (n < 10 ? '0' + n : String(n));
export const hmToMin = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + (m || 0); };
export const minToHm = (min: number) => pad2(Math.floor(min / 60)) + ':' + pad2(min % 60);
export const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
export const isTime = (s: unknown): s is string => typeof s === 'string' && /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/.test(s);

/** A local date + minutes after local midnight → the UTC instant. */
export function localMinToUtc(date: string, minutes: number, tz = TZ): Date {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  let off = tzOffsetMin(new Date(guess), tz);
  let res = guess - off * 60000;
  const off2 = tzOffsetMin(new Date(res), tz);
  if (off2 !== off) res = guess - off2 * 60000;
  return new Date(res);
}
export const localToUtc = (date: string, time: string, tz = TZ) => localMinToUtc(date, hmToMin(time), tz);

/** UTC instant → local date, time, minutes after midnight and weekday (1 = Monday … 7 = Sunday). */
export function toLocal(d: Date, tz = TZ) {
  const w = wall(d, tz);
  const date = `${w.year}-${pad2(w.month)}-${pad2(w.day)}`;
  return { date, time: pad2(w.hour) + ':' + pad2(w.minute), minutes: w.hour * 60 + w.minute, weekday: weekdayOf(date) };
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
}
export const diffDays = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
export const today = (now = new Date(), tz = TZ) => toLocal(now, tz).date;
export const mondayOf = (date: string) => addDays(date, 1 - weekdayOf(date));

/* ---- Albanian dates ------------------------------------------------------ */
export const DAYS = ['e hënë', 'e martë', 'e mërkurë', 'e enjte', 'e premte', 'e shtunë', 'e diel'];
export const DAYS_ACC = ['të hënën', 'të martën', 'të mërkurën', 'të enjten', 'të premten', 'të shtunën', 'të dielën'];
export const DAYS_SHORT = ['Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht', 'Die'];
export const DAYS_NAME = ['Hënë', 'Martë', 'Mërkurë', 'Enjte', 'Premte', 'Shtunë', 'Diel'];
export const MONTHS = ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor', 'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor'];

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const dayNum = (date: string) => Number(date.slice(8, 10));
export const dayName = (date: string) => DAYS[weekdayOf(date) - 1];
export const dayAcc = (date: string) => DAYS_ACC[weekdayOf(date) - 1];
/** "14 nëntor" */
export const fmtDayMonth = (date: string) => `${dayNum(date)} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
/** "e premte, 14 nëntor" */
export const fmtDateLong = (date: string) => `${dayName(date)}, ${fmtDayMonth(date)}`;
/** "sot", "nesër" or "e premte, 14 nëntor" */
export function fmtDateRel(date: string, todayDate: string) {
  const n = diffDays(todayDate, date);
  return n === 0 ? 'sot' : n === 1 ? 'nesër' : fmtDateLong(date);
}
/** "30 min", "1 orë", "1 orë 15 min" */
export function fmtDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} orë ${m} min` : `${h} orë`;
}
/** 500 → "5 €", 1250 → "12,50 €" */
export function fmtPrice(cents: number | null | undefined, from = false) {
  if (cents === null || cents === undefined) return '';
  const v = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace('.', ',');
  return (from ? 'nga ' : '') + v + ' €';
}
