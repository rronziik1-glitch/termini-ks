# READY FOR AUDIT: Termini + Faqja Gati web app

Built by Opus, 2026-11-14, per `OPUS-BUILD.md`, following Fable's design (`fable/01-product-design.md`, `02-design-system.md`, `design-tokens.css`, `templates/`, `termini-ui/`).
App: `build/app/`. Full details (URLs, architecture, production gaps, costs) are in `build/app/README.md`.

## Status
- `npm run build`: passes, no type errors.
- `npm test`: 39/39 pass (slot calculation, DST, double booking incl. two simultaneous confirms, booking rules, local filler, preview protection, **no live page without payment**, mark paid → live, unpublish, expiry).
- `npm run smoke -- http://localhost:3000` against a running server: 48/48 pass (every page returns 200, full Faqja Gati flow create → photo → generate → preview → style → checkout → payment gate 404 → admin mark paid → live, owner settings API).
- Visual check at 375px and 1280px of the new Faqja Gati screens (screenshots in `build/app/.shots/`).

## How to run
```
cd F:\claude\work\kosovo-business\build\app
npm install
npm run dev        → http://localhost:3000
```
No accounts or keys needed: `.env`, the database and the demo data are created on the first run.

## Demo accounts (log in at /hyr; the code is shown on screen in dev)
| Who | Phone |
|---|---|
| Admin (Roni) → `/admin` | 049 000 000 |
| Berberi Arti, barber, Gjakova (bookings today, live page `/p/berberi-arti`) | 049 111 111 |
| Klinika Dardania, dentist, Prishtina (Faqja Gati page in preview) | 044 222 222 |
| Bujtina Rugova, guesthouse, Rugova | 049 333 333 |

## What was built (MVP list from OPUS-BUILD.md)
1. **Sign-up ≤ 2 min** `/fillo`: 4 steps with category presets → link `/b/<slug>`, copy / WhatsApp share / QR.
2. **Customer booking** `/b/<slug>`: service → day + free time (no double booking, respects hours, pause, days off, blocks, notice, window) → name + phone → confirmation with WhatsApp link + "Rezervuar përmes Termini", .ics, cancel link.
3. **Owner dashboard** `/app`: day and week calendar, came / no-show / cancel / move, manual bookings, block time, WhatsApp reminder links; `/app/klientet`, `/app/sherbimet`; **`/app/cilesimet`** with link/QR/share, pause bookings, weekly hours + lunch break + days off with holiday suggestions, booking rules, profile + photo + map pin, logout, delete account.
4. **Find** `/gjej` by city and category.
5. **Faqja Gati** `/faqja` (examples from all 6 templates) → `/faqja/krijo` wizard (type, name, city, description, old site link, up to 10 photos shrunk on the phone, phone) → `/faqja/<id>` progress in 4 named stages → watermarked preview in a phone frame (full-bleed on phones), "Ndrysho diçka" (3 free rebuilds with a note), "Provo stil tjetër".
6. **"Merre për 100 €"** → address (free subdomain or own domain +15 €/yr) → Paysera (off until keys) / bank transfer (IBAN + reference) / cash (WhatsApp) → waiting screen → admin marks paid → live at `/p/<subdomain>` with "Rezervo termin" linked to the business's Termini (if it has one; otherwise "Aktivizo rezervimet online falas" → prefilled sign-up).
7. **Admin** `/admin`: pages with status filter, contact, payment, send preview on WhatsApp, mark paid, publish/unpublish, content JSON editor (schema-validated), photo replace, generation log; business overview with bookings per week.
- AI: `lib/ai.ts` uses the Claude API only when `ANTHROPIC_API_KEY` is set; otherwise the deterministic local filler. PWA manifest + icons. `.env.example` without real keys. All UI copy in Albanian in one file, `lib/sq.ts`.

## This session (finishing a partial build)
The backend, Termini screens, tests and seed already existed. Added: `/faqja`, `/faqja/krijo`, `/faqja/[id]` (+ `/parapamja`, `/img`), `/faqja/shembull/[template]`, `/p/[slug]` (+ `/img`), `/admin`, `/app/cilesimet` (+ `/orari`, `/rezervimet`, `/profili`), `lib/fg/serve.ts`, `lib/settings-data.ts`, `scripts/smoke.mjs`, `README.md`.

## Not done / decisions to review
- **Paysera** is coded to the documented scheme but never run against Paysera; the `ss2` RSA check is a TODO. Off until keys exist.
- **No SMS**: login codes are shown on screen in dev (`SHOW_LOGIN_CODES=1`). Reminders are wa.me links the owner taps; no automatic sending or cron.
- **Subdomains / custom domains** are not routed; published pages live at `/p/<subdomain>`. No static export to Cloudflare Pages yet.
- **Staff** (several people per business) exists in the data model, shown as "së shpejti".
- **Photo enhancement** is manual (admin replaces a photo with an enhanced one in `/admin`).
- **Decisions I made:** `/faqja` shows all 6 templates as examples (spec said 3; 6 fills the 2-column phone grid evenly). Examples are rendered on the preview path (with watermark) so the clean template HTML isn't handed out. Holiday suggestions include Bajram dates for 2026–2028 as approximations, and Dita e Flamurit (28 Nov) because Fable's mock-up shows it, even though it's not an official holiday in Kosovo.
- The owner settings screens were checked through the API and server rendering, but not screenshotted (the screenshot tool can't log in).
- A test server I started on port 3123 may still be running (I couldn't stop the process from this session). It goes away on restart, or close the `node` process.
