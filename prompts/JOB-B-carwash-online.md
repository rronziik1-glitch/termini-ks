# JOB B: car wash/auto template + make the app ready to go online (v3)

You are Fable 5.2. You may be on a new account with no memory of this project. Everything you need is on disk.
The owner is Roni (video editor, not a programmer). Do not ask questions: decide yourself, in the same premium style.
**Roni is away. NEVER stop, pause or wait for confirmation. Keep working until the line `JOB B done` is written. The only acceptable stop is the usage limit.**
**Start only if JOB A is done** (`F:\TERMINI\fable\PROGRESS-JOB-A.md` contains `JOB A done`).

## Where things are (read first)
1. `F:\TERMINI\CONTEXT.md`: the business (Termini booking + Faqja Gati €100 AI pages, Kosovo).
2. `F:\TERMINI\VERSIONS.md`: app versions. Never edit an older version.
3. `F:\TERMINI\fable\02-design-system.md` + `fable\design-tokens.css`: the look.
4. `F:\TERMINI\fable\templates\`: templates (index.html, style.css, content.json, content.js; shared base.css, fg.js, preview.css, schema.json). Newest examples: `sallon-dasmash/`, `autoshkolla/`.
5. `F:\TERMINI\fable\PROGRESS-JOB-A.md`: exactly how JOB A registered a new category in the app (files list + `logs/job-a-register.mjs`). Do it the same way.
6. App code: Next.js 15 + Prisma/SQLite + Vitest. Key files: `lib/payments.ts` (Paysera), `lib/config.ts`, `lib/ai.ts`, `lib/session.ts`, `lib/http.ts`, `lib/fg/*`, `prisma/schema.prisma`, `.env.example`, `next.config.mjs`.

## Step 0: new version
Copy `build/app-v2` to `build/app-v3` (skip `node_modules` and `.next`), run `npm install` there. In `VERSIONS.md` mark v2 FROZEN and add
"v3: v2 + car wash template + online-ready setup". Work ONLY in `build/app-v3`.

## Part 1: template `lavazh-servis` (car wash + auto service)
Apple/Mercedes level, mobile first (375px), natural Albanian (Kosovo). Wash packages, oil change, tyres, diagnostics with prices + duration,
before/after photos, "Rezervo terminin" linked to Termini, hours, location. New folder in `fable/templates/` (never change existing ones),
copy into `build/app-v3`, register like JOB A did. Screenshot at 375px into `fable/_shots/`.

## Part 2: online-ready (nothing real switched on)
Roni has NO company number, Paysera, domain or server accounts yet. Build it so later he only pastes keys. Never create accounts, never use real keys.
1. **Database:** PostgreSQL for production (Neon or Supabase free tier), SQLite still works for local dev. Migrations + seed work on both.
2. **Hosting:** ready for **Vercel**. Uploaded photos not on local disk in production: storage interface (local in dev; Vercel Blob / S3-compatible / Supabase Storage in prod, by env var).
3. **Login codes (OTP):** provider interface: dev (code on screen), **SMS** (generic HTTP provider, Twilio/Infobip style), **WhatsApp Cloud API**. Chosen by env var.
4. **Paysera:** every setting is an env var; add a test-payment checklist.
5. **Domain + subdomains:** `APP_URL`; Faqja Gati pages on `<name>.<domain>` via middleware, fallback `/p/<slug>`.
6. **Production safety:** startup env check (refuse to start in production if a required key is missing, clear message), Albanian error pages, robots.txt + sitemap, basic logging.
7. **Private launch password:** env `SITE_PASSWORD`; when set the whole public site asks for a password. Paysera callback `/api/...` must still work.
8. `.env.example` complete, commented in simple English.
9. `npm test` + `npm run build` pass (SQLite locally).

## Deliverable: `F:\TERMINI\GO-ONLINE.md`
Simple English, numbered, for a non-programmer. For EACH account (domain, Vercel, Neon/Supabase, storage, SMS/WhatsApp, Paysera, Anthropic API key):
what it is in one line, link, monthly cost, exactly which value to copy and which env var to paste it in, how to check it works.
End with a "Launch day checklist" (remove SITE_PASSWORD, test €1 payment, test a booking from a phone).

## Save as you go (the usage limit can stop you any minute)
- After EACH finished step, append one line to `F:\TERMINI\fable\PROGRESS-JOB-B.md`.
- At the start, read that file and continue from the first unfinished step. Never redo finished steps.
- When everything is done write `JOB B done` in it.
Work only inside `F:\TERMINI`. Never edit `build/app` (v1) or `build/app-v2` after step 0.
