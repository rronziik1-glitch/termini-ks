# MORNING REPORT: Termini + Faqja Gati (2026-11-14)

## Status: the MVP is ready to try ✅
- `npm run build` passes · `npm test` **44/44** · `npm run smoke` **all checks pass** (run against a fresh server with the latest code).
- Both products work end to end **locally, with no accounts or keys**.

## How to open it
```
cd F:\claude\work\kosovo-business\build\app
npm install
npm run dev
```
Then open **http://localhost:3000**. Log in at `/hyr`. In dev the code is shown on screen.

| Who | Phone | What you see |
|---|---|---|
| Admin (you) | `049 000 000` | `/admin`: all pages, "mark paid", publish, edit |
| Berberi Arti (Gjakova) | `049 111 111` | calendar with bookings, live page `/p/berberi-arti` |
| Klinika Dardania (Prishtina) | `044 222 222` | Faqja Gati page in preview |
| Bujtina Rugova | `049 333 333` | guesthouse |

Try: `/b/berberi-arti` (customer booking), `/fillo` (business sign-up), `/faqja/krijo` (make a page), `/gjej` (find).

Note: an old server from the night is still running on **port 3123** (`next start`). Close it if you don't need it.

## Who did what
| Phase | Who |
|---|---|
| Design, brand, design system, 6 Faqja Gati templates, Termini screens | **Fable** |
| App build | **Fable** started it → **Opus** finished it (Fable's 5-hour limit) |
| Audit (`fable/03-audit.md`) | **Opus** (Fable was out); fixed 2 critical + 4 high on its own |
| Final fixes + this report | **Opus** (14 Nov, afternoon) |

## Fixed today (from the audit)
- **Spam bookings (H3):** more than 6 new numbers in 30 minutes at one business are stopped ("call the business"). **Blocking a number now also cancels all its future bookings.**
- **Preview (H4):** the preview no longer holds the full page. The second half of services, FAQ and reviews is hidden with bars, so the page can't be copied for free.
- **Security:** security headers on every page (M4); links/QR/Paysera built only from `APP_URL` in production (M5).
- **Paysera (M7):** ss2 RSA signature check, EUR only, a test payment is never accepted as real money, and the same payment can't be processed twice.
- **AI cost (M6):** global cap of 200 generations a day (`FG_DAILY_CAP`), then "write to us on WhatsApp".
- **Bigger buttons (M3)** for the barber: calendar cards and buttons at least 44px.
- **Small:** "Rebuild" can't be used more than 3 times with fast taps (S4), `24:30` is no longer a valid time (S3), the home page phone mock-up has today's dates (S6), the pricing copy no longer contradicts "no monthly fee".
- 3 new tests for these fixes.

## Still missing before launch (needs you)
1. **Paysera:** open the account, put `PAYSERA_PROJECT_ID`, `PAYSERA_SIGN_PASSWORD`, `PAYSERA_PUBLIC_KEY` in `.env`, test one real €1 payment.
2. **Login code by SMS/WhatsApp:** today the code only shows in dev. You need an SMS provider (~€0.05/SMS) or the WhatsApp Business API.
3. **Domain + hosting:** e.g. `termini.app` / `faqjagati.com`, with Postgres (Supabase/Neon) instead of SQLite; then subdomains `<name>.faqjagati.com`.
4. **Anthropic API key** for the real AI pages (without a key it uses the simple local filler). ~€0.10–0.50 per page.
5. Your decisions from the audit (§7): legal entity on the payment screen (THAT AD SH.P.K.?), "money back within 7 days", and whether you really upgrade every photo within 24 hours.

## Next 3 steps
1. **Today:** open the app, try it as barber + customer + admin, and note what you don't like.
2. **This week:** 15 conversations with real businesses (questions in `opus/launch-plan.md`) using this demo on your phone.
3. **Then:** Paysera + domain + hosting → the first 10 businesses set up in person (pilot).

## Not done from the audit (small, for later)
- Spam: "pending" status that the owner confirms (instead of rejection); OTP for customers on request.
- Preview as images instead of HTML (only if abuse shows up).
- "Move" sheet that shows only free times; one shared holiday list + test; "Si ta vendos në bio" video after sign-up; domain renewal date in admin.
