# Termini + Faqja Gati: local web app

**Termini** is free online booking for barbers, salons, dentists, clinics and guesthouses in Kosovo.
**Faqja Gati** builds a business a one-page website from a short description and a few photos, shows a watermarked preview, and publishes it after a one-time payment of €100.

Stack: Next.js 15 (App Router) + TypeScript, plain CSS with Fable's design tokens (`app/styles/`), SQLite through Prisma, PWA manifest. Everything runs locally **without any external account or key**.

## Run it

```bash
cd F:\claude\work\kosovo-business\build\app
npm install
npm run dev          # http://localhost:3000
```

The first `npm run dev` (or `npm run build`) creates `.env` from `.env.example`, generates the Prisma client, creates `prisma/dev.db` and seeds it. To start over with fresh demo data: `npm run db:setup`.

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Vitest: slot calculation, double booking, booking rules, Faqja Gati filler and the preview/payment gate (39 tests, own `prisma/test.db`) |
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

## What is missing for production

1. **Hosting**: a Node host for the app (Railway, Render, Fly.io or a small VPS, ~€5–10/month). Static hosting of published pages on Cloudflare Pages/Netlify is free but needs an export step (not built; the pages are served by the app now).
2. **Database**: switch `provider` in `prisma/schema.prisma` to `postgresql`, set `DATABASE_URL` (Supabase free tier, then ~$25/month), run `prisma migrate`. On Postgres add the exclusion constraint for overlapping bookings described in `fable/01-product-design.md` §5.
3. **SMS login codes**: an SMS provider for the one-time codes (e.g. Twilio or a local gateway, ~€0.04–0.08 per SMS to Kosovo), then `SHOW_LOGIN_CODES=0`.
4. **Paysera**: create a Paysera project, set `PAYSERA_PROJECT_ID`, `PAYSERA_SIGN_PASSWORD`, `PAYSERA_TEST=0`, and run one real payment end to end. The callback also needs the `ss2` RSA check (TODO in `lib/payments.ts`). Fees are about 1–3% per card payment.
5. **Bank details**: real `BANK_IBAN`, `BANK_NAME`, `BANK_HOLDER`, `SUPPORT_WHATSAPP` in `.env`.
6. **Domains**: e.g. `termini.app` / `faqjagati.com` (~€10–40/year each), wildcard DNS `*.faqjagati.com` pointing at the app, and routing of subdomains to `/p/<subdomain>` (a small Next.js middleware). Custom domains (€15/year to the customer) are registered by hand for now.
7. **Claude API key** for better page text: `ANTHROPIC_API_KEY`. Cost per page is a few cents with Haiku.
8. **Automatic reminders**: WhatsApp Business API (Meta, ~€0.03–0.06 per message to Kosovo) or SMS, plus a cron job that sends the reminder an hour before. Today the owner taps "Dërgo kujtesë" in the booking sheet.
9. **File storage**: uploads are in `storage/` on disk; move them to S3/R2 (Cloudflare R2 has a free tier) when running more than one server. The in-memory rate limiter in `lib/config.ts` also needs Redis/Upstash then.
10. **Staff calendars** (several barbers per salon) are in the data model but shown as "së shpejti" in the UI.

Rough monthly cost at the start: hosting €5–10 + database €0–25 + domains ~€5 + SMS/WhatsApp per use + Claude API cents per page ≈ **€10–40/month** before the first paying customers.
