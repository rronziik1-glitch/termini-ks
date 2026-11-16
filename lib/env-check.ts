// Startup check of the environment variables (called from instrumentation.ts when the server starts).
// In production the app REFUSES TO START when a required value is missing or still a placeholder,
// and prints exactly which variable to fix. In development it only prints warnings.
// Pure function over an env object, so the tests can cover every rule.
export type EnvReport = { errors: string[]; warnings: string[] };
type Env = Record<string, string | undefined>;

const PLACEHOLDER_IBAN = 'XK05 0000 0000 0000 0000';

export function checkEnv(env: Env = process.env): EnvReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const v = (k: string) => (env[k] ?? '').trim();
  const need = (keys: string[], why: string) => { for (const k of keys) if (!v(k)) errors.push(`${k} is empty. ${why}`); };
  const onVercel = !!v('VERCEL');

  // --- core ---------------------------------------------------------------------
  const secret = v('APP_SECRET');
  if (!secret || secret === 'dev-secret-change-me' || secret.length < 24) errors.push('APP_SECRET must be a random text of 32+ characters (it protects logins). Make one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');

  const appUrl = v('APP_URL');
  if (!appUrl) errors.push('APP_URL is empty. Set it to the public address, e.g. https://termini.app');
  else if (/localhost|127\.0\.0\.1/.test(appUrl)) errors.push(`APP_URL is "${appUrl}". In production it must be the real address, e.g. https://termini.app`);
  else if (!/^https:\/\//.test(appUrl)) errors.push(`APP_URL must start with https:// (now: "${appUrl}").`);

  const dbUrl = v('DATABASE_URL');
  if (!dbUrl) errors.push('DATABASE_URL is empty. Paste the PostgreSQL connection string from Neon or Supabase.');
  else if (dbUrl.startsWith('file:')) {
    if (onVercel) errors.push('DATABASE_URL points to a SQLite file. On Vercel the database must be PostgreSQL (Neon or Supabase).');
    else warnings.push('DATABASE_URL is a SQLite file. Fine for a test on your own computer, not for a real launch.');
  } else if (!/^postgres(ql)?:\/\//.test(dbUrl)) errors.push('DATABASE_URL must start with postgresql:// (or file: for local SQLite).');

  if (!v('ADMIN_PHONES')) warnings.push('ADMIN_PHONES is empty: nobody can open /admin.');
  if (!v('ADMIN_PASSWORD_HASH')) warnings.push('ADMIN_PASSWORD_HASH is empty: /admin stays locked. Make it with: npm run admin:password');
  const pagesDomain = v('PAGES_DOMAIN');
  if (pagesDomain && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(pagesDomain)) errors.push(`PAGES_DOMAIN must be a bare domain like faqjagati.com (now: "${pagesDomain}").`);

  // --- login codes ----------------------------------------------------------------
  const otp = (v('OTP_PROVIDER') || 'dev').toLowerCase();
  if (!['dev', 'sms', 'whatsapp'].includes(otp)) errors.push(`OTP_PROVIDER is "${otp}". Use dev, sms or whatsapp.`);
  if (otp === 'dev') {
    if (v('DEMO_SHOW_CODES_IN_PRODUCTION') === '1' && !v('SITE_PASSWORD')) errors.push('DEMO_SHOW_CODES_IN_PRODUCTION is 1 but SITE_PASSWORD is empty: login codes would be shown to the whole internet. Set SITE_PASSWORD (private demo), or set OTP_PROVIDER to sms or whatsapp.');
    else if (v('DEMO_SHOW_CODES_IN_PRODUCTION') === '1') warnings.push('LOGIN CODES ARE SHOWN ON SCREEN (DEMO_SHOW_CODES_IN_PRODUCTION=1). Anyone can log in as anyone. Private demo only, never with real customers.');
    else errors.push('OTP_PROVIDER is "dev", so nobody would receive a login code. Set OTP_PROVIDER to sms or whatsapp and fill in its keys.');
  }
  if (otp === 'sms') {
    const style = (v('SMS_STYLE') || 'generic').toLowerCase();
    if (!['twilio', 'infobip', 'generic'].includes(style)) errors.push(`SMS_STYLE is "${style}". Use twilio, infobip or generic.`);
    if (style === 'twilio') need(['SMS_ACCOUNT_ID', 'SMS_API_KEY', 'SMS_FROM'], 'Needed for Twilio SMS.');
    if (style === 'infobip') need(['SMS_API_URL', 'SMS_API_KEY', 'SMS_FROM'], 'Needed for Infobip SMS.');
    if (style === 'generic') need(['SMS_API_URL'], 'Needed for the SMS gateway.');
    if (v('SMS_API_HEADERS')) { try { JSON.parse(v('SMS_API_HEADERS')); } catch { errors.push('SMS_API_HEADERS is not valid JSON, e.g. {"Authorization":"Bearer {key}"}'); } }
  }
  if (otp === 'whatsapp') need(['WHATSAPP_API_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'], 'Needed for WhatsApp login codes.');

  // --- storage ----------------------------------------------------------------------
  const drv = (v('STORAGE_DRIVER') || 'local').toLowerCase();
  if (!['local', 'vercel-blob', 'supabase', 's3'].includes(drv)) errors.push(`STORAGE_DRIVER is "${drv}". Use local, vercel-blob, supabase or s3.`);
  if (drv === 'local') {
    if (onVercel) errors.push('STORAGE_DRIVER is "local". Vercel cannot keep uploaded photos on its disk. Set STORAGE_DRIVER to vercel-blob (easiest), supabase or s3.');
    else warnings.push('STORAGE_DRIVER is "local": photos are saved in the storage/ folder of this computer.');
  }
  if (drv === 'vercel-blob') need(['BLOB_READ_WRITE_TOKEN'], 'Create a Blob store in Vercel (Storage tab); Vercel adds this variable for you.');
  if (drv === 'supabase') need(['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'], 'Needed for Supabase Storage.');
  if (drv === 's3') need(['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'], 'Needed for S3-compatible storage.');

  // --- payments ---------------------------------------------------------------------
  const paysera = ['PAYSERA_PROJECT_ID', 'PAYSERA_SIGN_PASSWORD', 'PAYSERA_PUBLIC_KEY'];
  if (paysera.some((k) => v(k))) {
    need(paysera, 'Paysera needs all three: project id, sign password and public key.');
    if ((v('PAYSERA_TEST') || '1') === '1' && !v('SITE_PASSWORD')) errors.push('PAYSERA_TEST is "1" on a public site (SITE_PASSWORD is empty): anyone could publish a page with a free TEST payment. Set PAYSERA_TEST to 0, or keep the site private with SITE_PASSWORD while you test.');
    else if ((v('PAYSERA_TEST') || '1') === '1') warnings.push('PAYSERA_TEST is "1": card payments are TEST payments, no real money arrives. Set it to 0 on launch day.');
  } else warnings.push('Paysera is not set up: the card option shows "së shpejti"; bank transfer and cash still work.');
  if (!v('BANK_IBAN') || v('BANK_IBAN') === PLACEHOLDER_IBAN) warnings.push('BANK_IBAN is still the placeholder: customers who choose bank transfer see a fake IBAN.');

  // --- optional ---------------------------------------------------------------------
  if (!v('ANTHROPIC_API_KEY')) warnings.push('ANTHROPIC_API_KEY is empty: pages are filled by the simple local writer, not by Claude.');
  if (v('SITE_PASSWORD')) warnings.push('SITE_PASSWORD is set: the whole site asks for a password (private launch). Remove it on launch day.');
  if (v('SKIP_ENV_CHECK') === '1') warnings.push('SKIP_ENV_CHECK=1 is set. It is ignored on Vercel and must never be used for the real site.');
  return { errors, warnings };
}

/** Prints the report. In production with errors it stops the server. */
export function enforceEnv(env: Env = process.env) {
  const prod = env.NODE_ENV === 'production';
  if (env.NEXT_PHASE === 'phase-production-build' || env.VITEST) return;
  const { errors, warnings } = checkEnv(env);
  if (!prod) {
    // Development: the dev defaults are expected, so stay quiet apart from a one-line reminder.
    return;
  }
  for (const w of warnings) console.warn(`[env] warning: ${w}`);
  if (!errors.length) { console.log('[env] ok: all required settings are present.'); return; }
  const skip = env.SKIP_ENV_CHECK === '1' && !env.VERCEL;
  console.error(
    `\n==================================================================\n` +
    ` Termini ${skip ? 'has settings that are NOT ready for a real launch' : 'cannot start: some settings are missing'}\n` +
    `==================================================================\n` +
    errors.map((e, i) => ` ${i + 1}. ${e}`).join('\n') +
    `\n\n Fix them in Vercel → Project → Settings → Environment Variables (or in .env on your computer),\n then redeploy. The full list with explanations is in .env.example and GO-ONLINE.md.\n` +
    `==================================================================\n`,
  );
  if (skip) return;
  process.exit(1);
}
