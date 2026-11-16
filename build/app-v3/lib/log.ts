// Basic logging: one JSON line per event, so Vercel's log search (or any log tool) can filter by "event".
//   log.info('otp.sent', { provider: 'sms' })   →  {"t":"2026-…","level":"info","event":"otp.sent","provider":"sms"}
// Never log secrets, login codes or full phone numbers: use maskPhoneForLog().
// LOG_LEVEL = debug | info | warn | error (default info). Tests are silent unless LOG_LEVEL is set.
type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const v = (process.env.LOG_LEVEL || '').toLowerCase() as Level;
  if (ORDER[v]) return ORDER[v];
  return process.env.VITEST ? 99 : ORDER.info;
}

function write(level: Level, event: string, data?: Record<string, unknown>) {
  if (ORDER[level] < threshold()) return;
  let line: string;
  try { line = JSON.stringify({ t: new Date().toISOString(), level, event, ...(data || {}) }); }
  catch { line = JSON.stringify({ t: new Date().toISOString(), level, event, note: 'unserializable data' }); }
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (event: string, data?: Record<string, unknown>) => write('debug', event, data),
  info: (event: string, data?: Record<string, unknown>) => write('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) => write('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) => write('error', event, data),
};

/** +38349123456 → +38349•••456 */
export const maskPhoneForLog = (phone: string) => (phone.length > 7 ? `${phone.slice(0, 6)}•••${phone.slice(-3)}` : '•••');
