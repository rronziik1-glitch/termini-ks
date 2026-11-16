// Seed data for category_presets (01-product-design.md §4.1) and the holiday suggestions (§5).
// The presets are written to the database by prisma/seed.ts; the app reads them from there.

export type PresetService = { name: string; durationMin: number; priceCents: number | null; priceFrom?: boolean; active?: boolean };
export type PresetHours = { weekday: number; start: string; end: string }[];

const week = (start: string, end: string, satEnd = end): PresetHours => [
  ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, start, end })),
  { weekday: 6, start, end: satEnd },
];

export const CATEGORY_PRESETS: Record<string, { services: PresetService[]; hours: PresetHours }> = {
  berber: {
    services: [
      { name: 'Qethje', durationMin: 30, priceCents: 500 },
      { name: 'Qethje + mjekër', durationMin: 45, priceCents: 700 },
      { name: 'Mjekër', durationMin: 15, priceCents: 300 },
      { name: 'Qethje për fëmijë', durationMin: 20, priceCents: 400 },
    ],
    hours: week('09:00', '20:00'),
  },
  salon: {
    services: [
      { name: 'Fenirim', durationMin: 30, priceCents: 800 },
      { name: 'Prerje', durationMin: 45, priceCents: 1000 },
      { name: 'Ngjyrosje', durationMin: 90, priceCents: 3000, priceFrom: true },
      { name: 'Manikyr', durationMin: 45, priceCents: 1000 },
      { name: 'Vetulla', durationMin: 15, priceCents: 300 },
    ],
    hours: week('09:00', '20:00'),
  },
  dentist: {
    services: [
      { name: 'Kontroll', durationMin: 30, priceCents: 1000 },
      { name: 'Pastrim i dhëmbëve', durationMin: 45, priceCents: 2500 },
      { name: 'Mbushje', durationMin: 45, priceCents: 2000, priceFrom: true },
      { name: 'Zbardhim', durationMin: 60, priceCents: 8000, priceFrom: true },
    ],
    hours: week('09:00', '18:00', '14:00'),
  },
  klinike: {
    services: [
      { name: 'Vizitë e përgjithshme', durationMin: 30, priceCents: 1500 },
      { name: 'Kontroll', durationMin: 20, priceCents: 1000 },
      { name: 'Analiza laboratorike', durationMin: 15, priceCents: null },
    ],
    hours: week('08:00', '18:00', '14:00'),
  },
  bujtine: {
    services: [
      { name: 'Dhomë dyshe (ardhja)', durationMin: 30, priceCents: 4500, priceFrom: true },
      { name: 'Drekë tradicionale', durationMin: 90, priceCents: 1200 },
    ],
    hours: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, start: '10:00', end: '20:00' })),
  },
  dasma: {
    services: [
      { name: 'Vizitë në sallë', durationMin: 45, priceCents: null },
      { name: 'Takim për menynë dhe ofertën', durationMin: 60, priceCents: null },
      { name: 'Rezervim i datës', durationMin: 30, priceCents: null },
    ],
    hours: week('10:00', '18:00'),
  },
  autoshkolla: {
    services: [
      { name: 'Orë vozitjeje', durationMin: 45, priceCents: 1200 },
      { name: 'Orë para provimit', durationMin: 60, priceCents: 1500 },
      { name: 'Regjistrim dhe informata', durationMin: 20, priceCents: null },
    ],
    hours: week('08:00', '19:00', '15:00'),
  },
  lavazh: {
    services: [
      { name: 'Larje e shpejtë', durationMin: 15, priceCents: 500 },
      { name: 'Larje e plotë', durationMin: 40, priceCents: 1000 },
      { name: 'Ndërrim vaji', durationMin: 30, priceCents: 4500, priceFrom: true },
      { name: 'Ndërrim i gomave', durationMin: 40, priceCents: 2000 },
      { name: 'Diagnostikë', durationMin: 20, priceCents: 1500 },
    ],
    hours: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, start: '08:00', end: weekday === 7 ? '16:00' : '20:00' })),
  },
  tjeter: {
    services: [{ name: 'Termin', durationMin: 30, priceCents: null }],
    hours: week('09:00', '17:00'),
  },
};
export const presetFor = (category: string) => CATEGORY_PRESETS[category] || CATEGORY_PRESETS.tjeter;

/** Public holidays and the two Bajram dates, offered as one-tap suggestions. Nothing closes automatically.
 *  Bajram and Easter move every year: check the dates each December and extend this list. */
export const HOLIDAYS: { from: string; to: string; name: string; short: string }[] = [
  { from: '2026-11-28', to: '2026-11-28', name: 'Dita e Flamurit', short: 'Dita e Flamurit' },
  { from: '2026-12-25', to: '2026-12-25', name: 'Krishtlindjet', short: 'Krishtlindjet' },
  { from: '2027-01-01', to: '2027-01-02', name: 'Viti i Ri', short: 'Viti i Ri' },
  { from: '2027-01-07', to: '2027-01-07', name: 'Krishtlindjet ortodokse', short: 'Krishtlindjet ortodokse' },
  { from: '2027-02-17', to: '2027-02-17', name: 'Dita e Pavarësisë', short: 'Pavarësia' },
  { from: '2027-03-10', to: '2027-03-10', name: 'Bajrami i Vogël', short: 'Bajrami i Vogël' },   // audit fix: Ramazan Bajrami is "i Vogël"
  { from: '2027-03-28', to: '2027-03-28', name: 'Pashkët katolike', short: 'Pashkët' },
  { from: '2027-05-02', to: '2027-05-02', name: 'Pashkët ortodokse', short: 'Pashkët ortodokse' },
  { from: '2027-04-09', to: '2027-04-09', name: 'Dita e Kushtetutës', short: 'Dita e Kushtetutës' },
  { from: '2027-05-01', to: '2027-05-01', name: 'Dita e Punës', short: 'Dita e Punës' },
  { from: '2027-05-09', to: '2027-05-09', name: 'Dita e Evropës', short: 'Dita e Evropës' },
  { from: '2027-05-17', to: '2027-05-17', name: 'Kurban Bajrami', short: 'Kurban Bajrami' },
  { from: '2027-11-28', to: '2027-11-28', name: 'Dita e Flamurit', short: 'Dita e Flamurit' },
  { from: '2027-12-25', to: '2027-12-25', name: 'Krishtlindjet', short: 'Krishtlindjet' },
];
