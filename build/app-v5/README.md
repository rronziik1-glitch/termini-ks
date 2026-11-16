# Termini + Faqja Gati: local web app

**Termini** is free online booking for barbers, salons, dentists, clinics and guesthouses in Kosovo.
**Faqja Gati** builds a business a one-page website from a short description and a few photos, shows a watermarked preview, and publishes it after a one-time payment of €100.

Stack: Next.js 15 (App Router) + TypeScript, plain CSS with Fable's design tokens (`app/styles/`), SQLite through Prisma, PWA manifest. Everything runs locally **without any external account or key**.

## v4: Fable audit fixes (16 Nov 2026)

v4 = v3 + the fixes from the full audit in `fable/04-fable-audit.md` (short version for Roni: `REPORT-v4.md`, both in the TERMINI folder). What changed in the code:

- **Dates** must be real calendar days (`lib/time.ts`): an impossible date such as `2026-11-31` could double-book a taken slot.
- **Limits in the database** (`lib/ratelimit.ts`, table `RateHit`, migration `20261116000000_rate_hits`): login codes, admin password, launch password, AI pages and bookings per IP are now counted in the database, so they hold on every Vercel instance.
- **Login codes** go only to the countries in `OTP_ALLOWED_PREFIXES` (default Kosovo + Albania), with a daily cap `OTP_DAILY_CAP`.
- **Refuses to start** in production when `DEMO_SHOW_CODES_IN_PRODUCTION=1` or `PAYSERA_TEST=1` is used without `SITE_PASSWORD`.
- **Paysera callback** counts what was really paid (`payamount`, `paycurrency`).
- **Page building** fits one server call (`FG_AI_BUDGET_MS`), and a build that was cut off turns into "failed" after 2.5 minutes instead of hanging forever.
- **Cross-site requests**: the API accepts writes only from its own origin (`sameOriginWrite` in `lib/http.ts`).
- **Content-Security-Policy** on every generated page and preview (`pageCsp` in `lib/fg/serve.ts`).
- Uploads accept photo formats only; custom domains are checked; the "Gjej" list is cached for 30 seconds.
- Screens: examples on `/faqja` show the whole demo page; previews no longer scroll sideways on a phone; the payment screen shows the real page address; the login text names SMS or WhatsApp correctly.

## v3: ready to go online

This folder is `build/app-v4`. It runs locally exactly like before (`npm install`, `npm run dev`, no accounts needed), and it is prepared so that going online is only a matter of pasting keys. **The step-by-step guide for Roni is `F:\TERMINI\GO-ONLINE.md`.** Nothing real is switched on.

| Topic | Where | How it is chosen |
|---|---|---|
| Database | `prisma/schema.prisma` (SQLite, source of truth) → `prisma/postgres/schema.prisma` (generated) + `prisma/postgres/migrations/` | `DATABASE_URL`: `file:` = SQLite, `postgresql://` = PostgreSQL. `npm run build` on PostgreSQL runs `prisma migrate deploy` and saves the category presets |
| Photos | `lib/storage.ts` (drivers: `local`, `vercel-blob`, `supabase`, `s3`) | `STORAGE_DRIVER` |
| Login codes | `lib/otp.ts` (providers: `dev`, `sms` with Twilio / Infobip / generic HTTP, `whatsapp` Cloud API) | `OTP_PROVIDER`, `SMS_STYLE` |
| Paysera | `lib/payments.ts` | `PAYSERA_*` (all env) |
| Addresses | `middleware.ts`, `lib/site-lock.ts` | `APP_URL`, `PAGES_DOMAIN` (`name.<domain>` → `/p/name`; `/p/name` always works; a customer's own domain is matched on `Page.customDomain`) |
| Private launch | `middleware.ts`, `app/site-password/route.ts` | `SITE_PASSWORD` (the Paysera callback stays open) |
| Startup check | `lib/env-check.ts`, `instrumentation.ts`, `npm run env:check` | refuses to start in production when a required value is missing |
| Error pages, robots, sitemap, logs | `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, `app/robots.ts`, `app/sitemap.ts`, `lib/log.ts` | `LOG_LEVEL` |

New commands: `npm run env:check` (what is missing for production), `npm run db:migrate` (bring the database in `DATABASE_URL` up to date), `npm run db:pg-schema` (regenerate the PostgreSQL schema after changing a model).

Honest limits (also listed in `GO-ONLINE.md`):
- The cloud paths (PostgreSQL on Neon/Supabase, Vercel Blob / Supabase / S3 storage, SMS, WhatsApp, Paysera) were built from the providers' documentation and are covered by tests that check the requests, the S3 signature and the migration SQL (on PGlite). They have **not** been run against the real services, because no accounts exist yet. Each has a "how to check it works" step in `GO-ONLINE.md`.
- Rate limits (`rateLimit` in `lib/config.ts`) are kept in memory per server instance. On Vercel several instances can run at once, so the limits are approximate. Good enough for a start; move to Upstash Redis when traffic grows.
- Double bookings are prevented by a per-business lock inside the booking transaction (`lockKey` in `lib/db.ts`, a PostgreSQL advisory lock), which works across instances.
- Page building continues after the response with `after()` from `next/server`; the API route allows 60 seconds (`maxDuration`).

## Run it

```bash
cd F:\TERMINI\build\app-v3
npm install
npm run dev          # http://localhost:3000
```

The first `npm run dev` (or `npm run build`) creates `.env` from `.env.example`, generates the Prisma client, creates `prisma/dev.db` and seeds it. To start over with fresh demo data: `npm run db:setup`.

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Vitest: slot calculation, double booking, booking rules, Faqja Gati filler, the preview/payment gate and the online-ready parts (98 tests, own `prisma/test.db`) |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run smoke -- http://localhost:3000` | End-to-end check against a running server (48 checks: public pages, full Faqja Gati flow up to the live page, admin, owner settings) |

## Demo accounts

Login is phone + one-time code. In development there is no SMS, so **the code is shown on the login screen** (and printed in the server console).

| Who | Phone (at `/hyr`) | Where to look |
|---|---|---|
| Admin (Roni) | `049 000 000` | `/admin`: all Faqja Gati pages, "Shëno të paguar", publish/unpublish, edit content JSON, replace photos, business overview |
| Berberi Arti, barber in Gjakova | `049 111 111` | `/app` calendar with today's bookings · booking page `/b/berberi-arti` · live page `/p/berberi-arti` |
| Klinika Dardania, dentist in Prishtina | `044 222 222` | `/b/klinika-dardania` · its Faqja Gati page is in **preview** (link printed by the seed and listed in `/admin`) |
| Bujtina Rugova, guesthouse in Rugova | `049 333 333` | `/b/bujtina-rugova` |

Customers book without an account (name + phone).

## What is where

| URL | Screen |
|---|---|
| `/` | Termini home |
| `/fillo` | Business sign-up in 4 steps (name/category/city → services → hours → phone + code) → booking link |
| `/b/<slug>` | Customer booking: service → day and free time → name + phone → confirmation with WhatsApp link and "Rezervuar përmes Termini" |
| `/b/<slug>/t/<token>` | The customer's booking: add to calendar, directions, cancel |
| `/app` | Owner calendar (day/week), booking sheet: came / no-show / cancel / move / WhatsApp reminder, add a booking or block time |
| `/app/klientet`, `/app/sherbimet` | Customer list with history and notes; services (add, edit, reorder, on/off) |
| `/app/cilesimet` (+ `/orari`, `/rezervimet`, `/profili`) | Link + QR + share, pause online bookings, weekly hours + lunch break + days off (with holiday suggestions), booking rules, profile and photo, logout, delete account |
| `/gjej` | "Find a free slot" by city and category (start of the marketplace) |
| `/faqja` | Faqja Gati start page with the six templates as examples |
| `/faqja/krijo` | Wizard: type, name, city → description (+ optional old website) → up to 10 photos + phone |
| `/faqja/<id>` | Progress (4 stages) → watermarked preview, "Ndrysho diçka" (3 free rebuilds), "Provo stil tjetër" (colour variants) → payment (Paysera / bank transfer / cash) → waiting → live |
| `/p/<subdomain>` | Published page (later `<subdomain>.faqjagati.com`). 404 unless paid and live |
| `/admin` | Admin panel |

### How the main parts work

- **Slots and double booking** (`lib/slots.ts`, `lib/availability.ts`, `lib/booking.ts`): times are computed in Europe/Belgrade local time and stored in UTC; working intervals minus pauses, days off, blocks and confirmed bookings, on the business's 15/30-minute grid, with minimum notice and booking window. Creating a booking re-checks overlap inside a transaction, so two customers can't take the same time.
- **Reminders** (`lib/booking.ts`): WhatsApp click-to-chat links (`wa.me`) with the Albanian message ready; in dev every message is printed in the server console and recorded as a `BookingEvent`. `recordMessage()` is the single place where a WhatsApp Business API / SMS sender plugs in later (`REMINDER_CHANNEL` in `.env`).
- **AI fill** (`lib/ai.ts`): if `ANTHROPIC_API_KEY` is set, one Claude call (`claude-haiku-5-5`, retry with `claude-sonnet-5-5`) fills `content.json` through a tool whose input schema is `templates/schema.json`. Without a key, `lib/fg/filler.ts` builds the same JSON deterministically from the form (prices, hours, phone, address are parsed from the text; nothing is invented).
- **Templates** (`templates/`, copied from `fable/templates/`): the six templates are filled on the server with Fable's `fg.js` (jsdom) into static HTML.
- **Preview protection** (`lib/fg/render.ts`, `lib/pages.ts`): the preview is a separate render path with watermark CSS, masked phone numbers, every link set to `#`, no map and no booking link, `noindex` + `no-store` + `X-Frame-Options: SAMEORIGIN`, and images that are 800px JPEGs with the watermark burned into the pixels. The original photos and the live HTML are served only when `status = live`; no query, cookie or header changes that (covered by tests and the smoke script).
- **Payments** (`lib/payments.ts`): a `PaymentProvider` interface with a Paysera implementation (checkout URL + signed callback). It is switched off until keys are in `.env`; bank transfer and cash create a pending payment with a reference code (`FG-XXXXXX`), and the admin marks it paid in `/admin`, which publishes the page at once.

## What is still missing for production

The accounts, keys and step-by-step setup are in `F:\TERMINI\GO-ONLINE.md` (v3 already has the code for PostgreSQL, photo storage, SMS/WhatsApp codes, Paysera with the ss2 check, subdomains and the private-launch password). Not built yet:

1. **Automatic reminders**: WhatsApp Business API or SMS plus a cron job that sends the reminder an hour before. Today the owner taps "Dërgo kujtesë" in the booking sheet.
2. **Shared rate limits**: move the in-memory limiter in `lib/config.ts` to Upstash Redis when traffic grows.
3. **Staff calendars** (several barbers per salon) are in the data model but shown as "së shpejti" in the UI.
4. **Customer custom domains** are matched on `Page.customDomain`, but each one is added in Vercel by hand.
