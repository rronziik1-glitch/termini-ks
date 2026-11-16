# 04: Fable audit of the app (JOB C, v4)

Date: 2026-11-16. Auditor: Claude Fable 5.2.
Audited and fixed: `build/app-v4` (a copy of v3; v1, v2 and v3 were not touched).
Short version for Roni: `F:\TERMINI\REPORT-v4.md`.

**How it was done**
- Read all server code line by line: `lib/` (auth, sessions, admin lock, bookings, slots, time, pages, payments, storage, OTP, AI fill, env check), every API route, `middleware.ts`, the page routes.
- Ran the app and measured every screen at 375px with `fable/_audit/shots.mjs` (public screens, the 9 template examples, the logged-in owner screens, admin). Screenshots: `fable/_audit/v4/` (before) and `fable/_audit/v4-after/` (after).
- Reproduced the bugs before fixing them, then wrote a test for each fix.

**State after the audit:** `npm test` 98/98 (75 old + 23 new), `npm run build` passes, `npm run typecheck` clean, `scripts/smoke.mjs` all checks pass, and a trial run of the production build confirmed the fixes (cross-site write → 403, security header on pages, impossible date → 400, no login code in the answer).

Severity: **C** critical, **H** high, **M** medium, **S** small. ✅ fixed in v4. ➡️ left, with what to do.

No critical problem was found: nothing lets a stranger take over an account, read another business's customers, or get a paid page for free on a correctly set up site. The high findings below are real and would have hurt in the first weeks online.

---

## 1. High (all fixed)

### H1 ✅ A taken slot could be booked twice with an impossible date
- **Where:** `lib/time.ts` `isDate` (used by `lib/booking.ts`, `lib/availability.ts`, `lib/api/public.ts`).
- **Problem:** `2026-11-31` passed the check, because JavaScript reads it as 1 December. The booking was saved on 1 December, but the "is this slot busy?" check compares dates as text (`2026-12-01` against `2026-11-31`), found nothing, and offered every slot as free. A crafted request could double-book any slot on the 1st to 3rd of a month that follows a shorter month.
- **Fix:** a date is valid only when it turns back into the same text. **Test:** "a taken slot cannot be booked again through an impossible date".

### H2 ✅ Login-code limits did not hold on Vercel
- **Where:** `lib/auth.ts`, `lib/adminAuth.ts`, `app/site-password/route.ts`, `lib/pages.ts`, `lib/booking.ts`; the limiter was `rateLimit` in `lib/config.ts`.
- **Problem:** all limits were counted in the memory of one server instance. Vercel runs several instances and starts new ones all the time, each from zero. "5 codes per 15 minutes" was really "5 per instance": more guesses at a 6-digit code, and an SMS bill without a ceiling.
- **Fix:** new table `RateHit` and `lib/ratelimit.ts` (`rateLimitDb`), with a PostgreSQL lock so two instances cannot both pass. Used for: login codes (5 per phone per 15 minutes, 20 per phone per day, 20 per IP per hour, `OTP_DAILY_CAP` for the whole site), admin password, launch password, AI pages per day. Bookings per IP are counted from the bookings table. Keys are stored hashed (no phone number or IP in the table). Migration: `prisma/postgres/migrations/20261116000000_rate_hits`. **Tests:** "the database limiter counts across calls", "a 6th code for the same phone is refused", "more than 5 bookings an hour from one IP".

### H3 ✅ Login codes could be sent to any country (SMS fraud)
- **Where:** `lib/auth.ts` `requestCode`, `lib/otp.ts`.
- **Problem:** the form accepted any international number. With a paid SMS provider this is the classic "SMS pumping" fraud: a script makes the site send thousands of codes to expensive foreign numbers and Roni pays.
- **Fix:** with a real provider, codes go only to the prefixes in `OTP_ALLOWED_PREFIXES` (default `+383,+355`). Checked before anything is sent. **Test:** "with a real provider, codes go only to the allowed countries".

### H4 ✅ Demo login codes could be left on for the whole internet
- **Where:** `lib/env-check.ts`, `lib/config.ts` `showLoginCodes`.
- **Problem:** `DEMO_SHOW_CODES_IN_PRODUCTION=1` (codes shown on screen) was only a warning. If `SITE_PASSWORD` was removed on launch day and this was forgotten, anyone could log in as any owner.
- **Fix:** without `SITE_PASSWORD` the app refuses to start with this setting, and the code itself hides the codes. **Tests:** "codes on screen without the launch password stop the start", "the app itself hides codes in production unless the site is private".

### H5 ✅ Paysera test mode on a public site = free pages
- **Where:** `lib/payments.ts` `verifyCallback`, `lib/env-check.ts`.
- **Problem:** `PAYSERA_TEST` is `1` by default. On a public site in test mode, anyone can "pay" with Paysera's test payment and get the page published.
- **Fix:** in production a test payment counts only while test mode is on **and** the site is private (`SITE_PASSWORD`). A public site with `PAYSERA_TEST=1` refuses to start. **Tests:** "in production a test payment counts only while the site is private", "Paysera test mode on a public site stops the start".
- Side effect handled: the guide used to say "remove `SITE_PASSWORD` for a few minutes so Paysera can verify the site". That would now stop the app (and it was unsafe anyway). `middleware.ts` now lets the home page alone through while `PAYSERA_VERIFY_CODE` is set. `GO-ONLINE.md` updated. **Test:** "while PAYSERA_VERIFY_CODE is set, only the home page opens".

### H6 ✅ A page could hang on "Po e ndërtojmë" forever
- **Where:** `lib/pages.ts` `runGeneration`, `lib/ai.ts` `fillContent`.
- **Problem:** Vercel stops a request after 60 seconds. The AI call alone could wait 120 seconds, twice, plus an automatic retry. When the function was cut off, the page stayed in `generating` and nothing could restart it.
- **Fix:** the AI gets a time budget (`FG_AI_BUDGET_MS`, default 45 s), then the built-in writer finishes the page; the automatic retry uses the built-in writer only; the stage pauses are skipped when the AI is on. A page still "generating" after 2.5 minutes becomes "failed", and the owner sees "Provo përsëri". **Tests:** "a generation that was cut off becomes failed", "the automatic retry never calls the AI".

### H7 ✅ No protection against requests from other sites
- **Where:** `lib/http.ts` `dispatch`.
- **Problem:** the session cookie is `SameSite=Lax`, which stops other **sites**. But customer pages can live at `emri.terminiks.com`, and browsers treat that as the **same site** as `terminiks.com`. The API also read JSON whatever the content type. So a page on a sibling address could send writes (delete account, change hours) with the visitor's cookie.
- **Fix:** `sameOriginWrite`: a POST/PUT/PATCH/DELETE is accepted only when the browser's `Origin` is our own address. Requests without the header (Paysera's server, scripts) are not browsers and pass. **Tests:** "same origin and non-browser clients pass; other sites and customer pages do not", "the API answers 403 to a cross-site write".

### H8 ✅ Generated pages had no Content-Security-Policy
- **Where:** `lib/fg/serve.ts` `htmlResponse` (routes `/p/<name>`, `/faqja/<id>/parapamja`, `/faqja/shembull/<template>`).
- **Problem:** these pages hold text typed by strangers and are served from the app's own address. The earlier audit fixed one script injection (C1); nothing stopped the next one.
- **Fix:** `pageCsp`: only our own script file, our styles, Google Fonts, images and the Google map frame are allowed; no inline script, no connection to other servers. Checked in the browser: fonts, map and animations still work, no console errors. **Test:** "previews and live pages carry a Content-Security-Policy".

### H9 ✅ Customer previews scrolled sideways on a phone (the selling moment)
- **Where:** `lib/fg/render.ts` `scrubForPreview`, `public/fg/preview.css`.
- **Problem:** the hidden half of a price list is shown as bars of `█`. A long bar in a big font is one unbreakable word; in the templates berber, bujtine and dyqan the page became 415–465px wide at 375px.
- **Fix:** bars are at most 12 characters, and in a preview any long word may wrap. Measured after: 375px on all previews. **Test:** "a customer preview … never has a long unbreakable bar".

### H10 ✅ The examples on `/faqja` showed half the page blacked out
- **Where:** `app/faqja/shembull/[template]/route.ts`.
- **Problem:** the nine examples (our own demo content) went through the customer preview path, so half of every price list, the FAQ and the reviews were black bars. This is the first thing a business owner opens.
- **Fix:** `renderExample`: still locked (watermark, no working links) but shown in full. **Test:** "examples show the whole demo page".

---

## 2. Medium

- **M1 ✅ Paysera callback checked the asked amount, not the paid one.** `lib/payments.ts` now takes the smaller of `amount` and `payamount` and requires `paycurrency` to be EUR. The signature is compared in constant time. **Test:** "counts what was really paid, in euros".
- **M2 ✅ A paid page could be pulled back to preview.** If "Rindërtoje" was pressed in the same moment a payment was confirmed, the page went from live back to preview. `lib/pages.ts`: the status is now part of the write condition in `startGeneration` and at the end of `runGeneration`. **Test:** "a paid page cannot be sent back to generating".
- **M3 ✅ Daily AI cap and bookings per IP were in memory.** Now in the database (see H2).
- **M4 ✅ Uploads accepted every format the image library can read (SVG included).** `lib/fg/images.ts` `assertPhoto`: JPEG, PNG, WebP, AVIF, HEIF, GIF, TIFF only. **Test:** "an SVG … is refused as an upload".
- **M5 ✅ The custom domain at checkout was not checked.** `lib/pages.ts` `checkout`: must look like a domain, and can never be our own domain, a subdomain of it or a `vercel.app` address. **Test:** "a custom domain must look like a domain".
- **M6 ✅ The home and "Gjej" pages ran about four database queries per business on every visit.** `lib/business.ts`: the list is kept for 30 seconds.
- **M7 ✅ Profile photo upload sent the raw phone photo.** Vercel refuses request bodies above 4.5 MB. `components/shrink.ts` (shared with the page wizard) shrinks it on the phone first.
- **M8 ✅ The payment screen promised an address at a domain that is not ours** (`emri.faqjagati.com`). `lib/config.ts` `pagesHostPrefix`: without `PAGES_DOMAIN` it shows the real address, `terminiks.com/p/emri`. **Test:** "the address shown on the payment screen is a real one".
- **M9 ✅ The login screen always said "me SMS".** With WhatsApp codes that is wrong. The API now returns the channel and the text follows it (`sq.login.codeSent`). **Test:** "the login text names the channel".
- **M10 ✅ "Gjej një termin" had no filter for wedding halls, driving schools and car washes** (added in v2/v3). `app/gjej/page.tsx`, `lib/sq.ts`.
- **M11 ➡️ The spam guard can also stop real customers.** `lib/booking.ts`: more than 6 new phone numbers at one business in 30 minutes are refused. When a barber posts the link in a story, the 7th real customer gets an error at the best possible moment. Proposed: instead of refusing, save the booking as "to confirm" and show the owner a banner. This needs a new status and screen work, so it was not done in this audit.
- **M12 ➡️ Somebody can keep an owner from logging in** by asking for codes for their number (5 per 15 minutes). This is the price of protecting the code against guessing. Sessions last 60 days, so the effect is small. Proposed later: a "trusted device" cookie that allows an extra code.
- **M13 ➡️ The app's own screens have no Content-Security-Policy** (only the generated pages do). Next.js needs a per-request nonce for that. The other security headers are set.

## 3. Small

- **S1 ✅** The AI could set a hero video address; the server now removes it (`lib/ai.ts` `normalize`).
- **S2 ✅** A broken `%` in an API address gave "500" instead of "not found" (`lib/http.ts`).
- **S3 ✅** Copy: the small links still said "Merre linkun tënd falas" after the main button became "Regjistro biznesin tënd falas" → "Ke biznes? Regjistroje falas." and the sign-up page title. "watermark" → 'mbishkrimin "Preview"'.
- **S4 ➡️** A Faqja Gati page is linked to a Termini business by matching the phone number typed in the form (`lib/pages.ts` `createPage`), without proof. The effect is only that the page's booking button points to that business, and the page still has to be paid. Link it only after login later.
- **S5 ➡️** A HEIC photo from an Android phone or a computer cannot be shrunk in the browser and goes up as it is; above 4.5 MB Vercel refuses it. iPhones convert by themselves.
- **S6 ➡️** Blocking a customer cancels their future bookings without writing a line in the booking history.
- **S7 ➡️** Templates: a few labels are under 12px on a phone (sallon-dasmash 10 places, salon-bukurie 4, the others 0–2). Readable, but below the bar of the rest.

---

## 4. What was checked and found good

- **Sessions and cookies:** random 40-character tokens, stored hashed, `HttpOnly`, `Secure` on https. The admin panel needs the admin phone **and** the admin password, and the unlock is tied to one session.
- **One business cannot see another's data:** every owner query is filtered by the business of the logged-in user (bookings, customers, services, hours, days off, WhatsApp links).
- **Payment gate:** `/p/<name>` and the full-size photos are served only for status `live`. No query, cookie or header changes that. Previews use separate low-resolution watermarked files.
- **Paysera callback:** both signatures (ss1 and ss2) are checked, project id, currency, and a payment reference is never processed twice.
- **Uploads:** every file is re-encoded to JPEG by the server; names are generated; storage paths cannot leave their folder.
- **Old-website reader:** private addresses and redirects to them are refused.
- **Time:** slots are computed in Kosovo local time and stored in UTC. The two clock-change days work (covered by `tests/slots.test.ts`). Lunch breaks, days off, blocks, minimum notice and the booking window are respected inside the booking transaction, with a per-business lock that also works across instances on PostgreSQL.
- **Subdomain routing:** page addresses can only show pages and their files; everything else is sent to the main site. Reserved names (`www`, `app`, `api`, `admin` …) are never pages.
- **375px:** no sideways scroll on any screen after the fixes; no text under 12px on the Termini screens; small controls (chips, switches, small buttons) have an enlarged tap area of 44px.
- **Albanian copy:** natural, short, consistent "ti"; WhatsApp messages use the right grammatical case for days. Only the points in M9 and S3 needed a change.

## 5. Honest limits of this audit

- The cloud services (PostgreSQL on Neon/Supabase, Vercel Blob, SMS, WhatsApp, Paysera) still could not be run for real: no accounts exist. The fixes for them are tested with local stand-ins. Each has a "check it works" step in `GO-ONLINE.md`.
- Design was judged from screenshots at phone width and the measurements above, not on a real phone.
- Roni's decisions from the earlier audit are still open: the legal name on the payment screen, a money-back promise, and whether every photo is really improved by hand.

## 6. Files changed in v4

`lib/time.ts`, `lib/ratelimit.ts` (new), `lib/auth.ts`, `lib/otp.ts`, `lib/adminAuth.ts`, `lib/config.ts`, `lib/env-check.ts`, `lib/payments.ts`, `lib/pages.ts`, `lib/ai.ts`, `lib/booking.ts`, `lib/http.ts`, `lib/business.ts`, `lib/sq.ts`, `lib/fg/serve.ts`, `lib/fg/images.ts`, `lib/fg/render.ts`, `lib/api/public.ts`, `lib/api/pages.ts`, `middleware.ts`, `app/site-password/route.ts`, `app/faqja/shembull/[template]/route.ts`, `app/faqja/[id]/page.tsx`, `app/gjej/page.tsx`, `components/shrink.ts` (new), `components/FaqjaWizard.tsx`, `components/FaqjaView.tsx`, `components/Settings.tsx`, `components/Login.tsx`, `components/Onboarding.tsx`, `public/fg/preview.css`, `prisma/schema.prisma`, `prisma/postgres/schema.prisma`, `prisma/postgres/migrations/20261116000000_rate_hits/`, `tests/v4-audit.test.ts` (new, 22 tests), `tests/online.test.ts`, `tests/admin-lock.test.ts`, `.env.example`, `README.md`, `package.json`.
Outside the app: `GO-ONLINE.md` (now points to `build/app-v4`), `VERSIONS.md`. Patch scripts that made the edits: `logs/job-c-fix1.mjs` … `job-c-fix6.mjs` (already applied; do not run again).
