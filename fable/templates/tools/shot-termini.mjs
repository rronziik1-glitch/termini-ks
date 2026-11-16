// Re-runs every Termini screen screenshot into fable/_shots/termini/.
//   node fable/templates/tools/shot-termini.mjs [filter]
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ui = join(here, '..', '..', 'termini-ui');
const out = join(here, '..', '..', '_shots', 'termini');
mkdirSync(out, { recursive: true });

const shots = [
  ['booking.html', 'booking-1'],
  ['booking.html?step=2', 'booking-2'],
  ['booking.html?step=3&state=error', 'booking-3'],
  ['confirmation.html', 'confirmation'],
  ['confirmation.html?sheet=cancel', 'confirmation-cancel'],
  ['onboarding.html', 'onboarding-1'],
  ['onboarding.html?step=2', 'onboarding-2'],
  ['onboarding.html?step=3', 'onboarding-3'],
  ['onboarding.html?step=4&state=code', 'onboarding-4'],
  ['onboarding.html?step=5', 'onboarding-5'],
  ['calendar.html?top=1', 'calendar'],
  ['calendar.html?top=1&sheet=booking', 'calendar-booking'],
  ['calendar.html?top=1&sheet=new', 'calendar-new'],
  ['calendar.html?state=empty', 'calendar-empty'],
  ['calendar.html?top=1&theme=dark', 'calendar-dark'],
  ['services.html', 'services'],
  ['services.html?sheet=service', 'services-edit'],
  ['settings.html', 'settings'],
  ['settings.html?view=orari', 'settings-orari'],
  ['settings.html?view=orari&sheet=dayoff', 'settings-dayoff'],
  ['settings.html?view=rezervimet', 'settings-rezervimet'],
  ['settings.html?view=profili', 'settings-profili'],
  ['settings.html?view=orari&theme=dark', 'settings-orari-dark'],
  ['index.html', 'index'],
  ['calendar.html?top=1', 'calendar-1280', 1280, 800],
  ['booking.html?step=2', 'booking-320', 320, 640]
];

const filter = process.argv[2];
for (const [page, name, w = 375, h = 812] of shots) {
  if (filter && !name.includes(filter)) continue;
  console.log('— ' + name);
  const [file, query = ''] = page.split('?');
  const q = query.includes('theme=') ? query : (query ? query + '&' : '') + 'theme=light';   // headless Chrome follows the OS theme
  spawnSync(process.execPath, [join(here, 'shot.mjs'), join(ui, file) + '?' + q, join(out, name + '.png'), String(w), String(h), '1700'], { stdio: 'inherit' });
}
