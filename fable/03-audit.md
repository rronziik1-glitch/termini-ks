# 03 — Audit of `build/app` (Phase 3)

Date: 2026-11-14. Auditor: Claude Opus 5.5 standing in for Fable, which was out of credits.
Scope: security (including preview bypass), bugs and edge cases, UX at 375px, flows, Albanian copy, business.
Method: I read all of `lib/`, the API routes, the Faqja Gati routes and the key components. I ran the tests, reproduced the bugs with scripts (`fable/_audit/*.ts`), ran the app on port 3210, took screenshots at 375px of every public screen and **every logged-in owner and admin screen** (Opus couldn't screenshot those; see `fable/_audit/shots/`) and ran `npm run smoke`.

**State after this audit:** `tsc` is clean, `npm test` passes 41/41 (39 + 2 new regression tests), and `npm run smoke` passes 48/48.

Severity: **C** = critical (must fix before any real user), **H** = high (before launch), **M** = medium (first weeks), **S** = small.
✅ = fixed in this session. ➡️ = left for Opus, with instructions.

---

## 1. Critical

### C1 ✅ Stored XSS on every live Faqja Gati page (JSON-LD `</script>` breakout)
- **Where:** `templates/fg.js:309` (same code in `public/fg/fg.js` and `fable/templates/fg.js`).
- **Problem:** `jsonLd()` returned `JSON.stringify(data)`, and the server wrote it into `<script type="application/ld+json">` through jsdom `outerHTML`, which does not escape `</script>`. If the business name, description or address contained `</script><script>…`, the browser ran it on the live page. The name comes straight from the public `/faqja/krijo` form (60 characters is enough). Live pages are served at `/p/<slug>` on the **same origin as the app**, so the script could call `/api/admin/*` with the cookie of whoever opened the page. Roni opens every page from `/admin`, so this meant admin takeover: mark pages paid, read every business's customers.
- **Reproduced:** `fable/_audit/xss-check.ts` printed `live breaks out: true` before the fix.
- **Fix (done):** `JSON.stringify(data).replace(/</g, '\\u003c')` in all three copies. Regression test added in `tests/pages.test.ts` ("cannot break out of the JSON-LD block").
- ➡️ **Opus, defence in depth:** serve published pages from their own origin (`*.faqjagati.com`, as already planned) rather than `/p/` on the app domain, and add a CSP on live pages (`default-src 'self'; script-src 'self'; img-src 'self' data:; frame-src https://www.google.com`).

### C2 ✅ Login codes returned in the API response in production, so anyone could log in as anyone, including the admin
- **Where:** `lib/config.ts:9` together with `.env.example:17` and `scripts/ensure-setup.mjs`.
- **Problem:** `showLoginCodes()` only fell back to "off in production" when the variable was unset. But `ensure-setup` copies `.env.example`, which sets `SHOW_LOGIN_CODES="1"`, into `.env`. Deploying the app as-is therefore made `/api/auth/code` return `dev_code` for any phone. The admin phone is `+38349000000`, which is in `.env.example` and the README. Separately, `APP_SECRET` defaulted to the public value `dev-secret-change-me`.
- **Fix (done):** in production, codes are shown only with the explicit `DEMO_SHOW_CODES_IN_PRODUCTION=1`. `config.secret()` now throws in production if `APP_SECRET` is the default or shorter than 24 characters. `.env.example` comments updated.
- ➡️ **Opus:** add `APP_SECRET`, real `ADMIN_PHONES` and an SMS provider to the deploy checklist in `README.md`. `npm start` locally now needs `APP_SECRET` set; this is intentional.

---

## 2. High

### H1 ✅ OTP 5-try limit could be bypassed with parallel requests
- **Where:** `lib/auth.ts:33-40` (before the fix).
- **Problem:** the code read `attempts`, compared, then incremented. Fifty parallel guesses all saw `attempts = 0`. With 5 codes per 15 minutes that is unlimited guessing against 10⁶ codes, i.e. account takeover of any owner.
- **Fix (done):** the attempt is claimed atomically with `updateMany … attempts < 5` before comparing, and the code is consumed with `updateMany … consumedAt: null`, so one code gives one session. Also added an IP limit on `/auth/code` (20 per hour) against SMS pumping once real SMS costs money.

### H2 ✅ Rate limits keyed on an IP that the client chooses
- **Where:** `lib/http.ts:86`.
- **Problem:** the code took the **leftmost** `X-Forwarded-For` entry, which is whatever the client sends. A bot sending a random header per request got past the 5-bookings-per-hour limit and the 10-pages-per-day limit.
- **Fix (done):** it now takes the **rightmost** entry, which is the one added by our proxy.
- ➡️ **Opus:** behind more than one proxy (e.g. Cloudflare in front of Railway), use `CF-Connecting-IP` or set a `TRUSTED_PROXY_HOPS`. Document this in the README.

### H3 ➡️ Spam bookings can still fill a barber's day
- **Where:** `lib/booking.ts:41-88`.
- **Problem:** customer phones are unverified. `MAX_ACTIVE_PER_PHONE = 3` is per number, so a script with random numbers and a few IPs (or mobile carrier NAT) can book every slot. The owner only notices when nobody comes. This is the biggest trust risk for Termini.
- **Fix for Opus:**
  1. Per-business velocity limit: more than 6 public bookings from **new** numbers within 30 minutes → further bookings get `status = 'pending'` (not shown as taken to others; owner confirms with one tap) and the owner gets a banner "Shumë rezervime të reja njëherësh, kontrolloji".
  2. Add a "Fshi të gjitha nga ky numër / bllokoje" action in the booking sheet (blocking exists; bulk cancel does not).
  3. Later: optional SMS/WhatsApp OTP for customers, only for businesses that turn it on.

### H4 ➡️ Preview bypass: a technical user can rebuild the page from the preview HTML
- **Where:** `lib/fg/render.ts:80-123` and `app/faqja/[id]/parapamja/route.ts`.
- **What is already good:** phones are masked, links point to `#`, there is no map, images are 800px with the watermark burned in, `no-store`, `noindex`, and `/p/` returns 404 until the page is `live`. I checked every path: no query, cookie or status trick reaches `renderLive`, and the gate holds.
- **What remains:** the preview is the complete rendered DOM. "Save as…", delete `data-fg-preview` and the `preview.css` link, swap in the owner's own photos (which they have anyway) and restore the `href`s, and you have the finished site. `/fg/<template>/style.css`, `base.css` and `fg.js` are public. The real target is web designers using Faqja Gati as a free generator, not barbers.
- **Fix for Opus (in order of value per effort):**
  1. Make the content "preview-shaped": in `scrubForPreview`, replace the second half of each service list, the FAQ answers and the reviews with blurred skeleton blocks (CSS `filter: blur(6px)` on server-generated dummy text, **not** the real text). The owner still sees the design and their top content, but the HTML no longer holds the full site.
  2. Require phone verification (the existing OTP) **before** generation when the same IP has more than 2 pages today. This limits free use at scale.
  3. Later, if abuse shows up: serve the preview as screenshots (headless Chrome → 3 tall JPEGs) instead of HTML.

### H5 ✅ Owner "Zhvendos" (move) and "Zhbëj" (undo cancel) created silent double bookings
- **Where:** `lib/booking.ts:163-200`.
- **Problem:** moving a booking, or undoing a cancel after another customer had taken the freed slot, wrote the booking without any overlap check.
- **Fix (done):** inside the business lock, a move or a restore from `cancelled_*` checks for a confirmed booking of the same staff member and returns `overlap` ("Në këtë orë ke termin me X…"). Regression test added in `tests/booking.test.ts`.
- ➡️ **Opus (small UX):** in the move sheet, show only free times (reuse `freeStarts` with `ignoreBookingId`, which already exists in `busyOn`) and offer "Ruaje gjithsesi" like the manual-booking sheet.

### H6 ✅ SSRF through "Ke faqe të vjetër?"
- **Where:** `lib/pages.ts:82-98`.
- **Problem:** only the hostname text was checked, then `redirect: 'follow'`. `http://my.site` → 302 → `http://169.254.169.254/…`, or a name that resolves to 127.0.0.1 (`127.0.0.1.nip.io`), reached internal services. The fetched text then flows into the page text that the user can read.
- **Fix (done):** the hostname is resolved and every address checked (private, loopback, link-local, CGNAT, IPv4-mapped), only ports 80/443 are allowed, and redirects are followed by hand (at most 4) with the same check on each hop. Residual risk is DNS rebinding between the check and the fetch; acceptable for now.

---

## 3. Medium

### M1 ✅ Holiday suggestions: Bajram names swapped, Easter missing
- **Where:** `components/Settings.tsx:23-26`, `lib/presets.ts:71`.
- **Problem:** 20 Mar 2026 and 10 Mar 2027 (end of Ramadan) were labelled "Bajrami i Madh". In Kosovo, Ramazan Bajrami is **Bajrami i Vogël** and Kurban Bajrami is **Bajrami i Madh**. Every owner would see the wrong name, which hurts trust. Both Easters (official holidays) were missing.
- **Fix (done):** labels corrected and Easter 2027/2028 added (Catholic 28 Mar 2027, Orthodox 2 May 2027, both 16 Apr 2028).
- ➡️ **Opus:** `lib/presets.ts HOLIDAYS` is unused dead code next to the list in `Settings.tsx`. Keep **one** list in `lib/presets.ts`, import it in Settings, and add a test that every year in range has both Bajrams. Dita e Flamurit (28 Nov) is not an official day off in Kosovo, but many close, so keeping it as a suggestion is fine.

### M2 ✅ HEIC photos fail off-iPhone, and the error text promised HEIC
- **Where:** `components/FaqjaWizard.tsx:180`, `lib/sq.ts:58`.
- **Problem:** the sharp build has no HEVC decoder (`sharp.format.heif` only lists `.avif`). Android/desktop browsers can't decode HEIC either, so the original went to the server and failed with "Vetëm foto JPG, PNG ose HEIC".
- **Fix (done):** `accept` no longer lists `image/heic`. That makes iOS convert to JPEG on its own. The message now reads "JPG, PNG ose WebP".

### M3 ➡️ Touch targets below 44px on the owner screens (the 50-year-old barber)
Measured at 375px (`fable/_audit/shots/*.png`):
- Calendar: 30-minute bookings render as **36px**-high cards (`components/Calendar.tsx`, `.event`). Set `min-height: 44px` on `.event` and let short events overlap the next gridline visually instead of shrinking.
- Services: up/down reorder buttons are **32×28** (`.iconbtn` in `components/Services.tsx`). Make them 44×44, or replace them with a single "Rendit" mode.
- Switches **52×32**, chips and `btn--sm` **40px** high (`app/styles/termini.css`). Add an invisible hit-area: `.switch, .chip, .btn--sm { position: relative } .switch::after, .chip::after, .btn--sm::after { content: ''; position: absolute; inset: -6px; }`.
- Footer/inline text links are 18–20px high. That's fine for secondary links, but give the footer `nav a` `padding-block: 12px`.

### M4 ➡️ No security headers app-wide
`next.config.mjs` sets none. Add a `headers()` block for all routes: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=31536000` (prod), `X-Frame-Options: DENY` (except the preview route, which keeps `SAMEORIGIN`), `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`.

### M5 ➡️ Links built from the request `Host` / `X-Forwarded-Host`
`lib/http.ts:67` and `lib/session.ts:14` trust `x-forwarded-host`. Booking links, QR codes and Paysera accept/callback URLs are built from it. In production use `APP_URL` only (`requestOrigin = () => config.appUrl()` when `NODE_ENV=production`).

### M6 ➡️ Faqja Gati cost abuse
`createPage` limits are 3/day per (unverified) phone and 10/day per IP, the latter **only in production** (`lib/pages.ts:42`). Each page can then generate once plus 3 revisions, each a Claude call, plus up to 10×15 MB uploads. Add a global daily cap (e.g. 200 generations/day, env `FG_DAILY_CAP`) that switches to "Na shkruaj në WhatsApp" when reached, plus a per-IP limit on `/pages/:id/generate`.

### M7 ➡️ Paysera before taking real money
`lib/payments.ts:46` has no `ss2` RSA check and doesn't check `currency === 'EUR'` or `test === '0'` in production. Add all three. Also make `markPaid` idempotent on `providerRef`, because Paysera retries callbacks.

---

## 4. Small

- **S1 ✅ WhatsApp grammar** (`lib/booking.ts:210-220`): reminder and cancel used the list form inside a sentence ("termini yt e premte, 14 nëntor në 10:00"). They now read "të enjten më 19 nëntor në orën 10:30". Checked with `fable/_audit/wa-check.ts`.
- **S2 ✅ Copy** (`lib/sq.ts`): `too_late` was ambiguous ("Termini është për më pak se 2 orë" reads like a duration) → "Deri te termini kanë mbetur më pak se 2 orë." `r2Hint` was awkward → "Që askush të mos vijë pa e ditur ti më parë." "Sot je mbyllur" → "Sot nuk punon." `listed` now names the page "Gjej një termin" consistently.
- **S3 ➡️** `isTime` accepts `24:00`–`24:59` (`lib/time.ts:36`). Only `24:00` should pass (end of day). Use `/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/`.
- **S4 ➡️** Revision counter race: two quick taps on "Rindërtoje" can both pass `revisionsUsed < 3` (`lib/pages.ts:117`). Use `updateMany where revisionsUsed < 3`.
- **S5 ➡️** `startGeneration` is allowed while `payment_pending`, so the owner can change content after Roni has quoted/seen it. Fine, but `markPaid` should then use the latest content (it does). Just log it in the admin generation list. No action needed beyond awareness.
- **S6 ➡️** Home page phone mock-up has hard-coded dates "Sot 13 / Nesër 14" (`app/page.tsx:12`). Generate them from today so the demo never looks stale.
- **S7 ➡️** `withLock` and `rateLimit` are in-memory (`lib/db.ts`, `lib/config.ts`). OK for one instance. The README already says so; with Postgres add the exclusion constraint before scaling out.

---

## 5. UX at 375px — what I saw

Screens checked: `/`, `/b/berberi-arti`, `/fillo`, `/hyr`, `/gjej`, `/faqja`, `/faqja/krijo`, `/p/berberi-arti`, `/app`, `/app/klientet`, `/app/sherbimet`, `/app/cilesimet` (+ `orari`, `rezervimet`, `profili`) and `/admin`.
- **No horizontal overflow on any screen.** No text below 12px. Dark theme contrast is good. Lime is used sparingly, as the design system says.
- **Booking page** is the strongest screen: clear step bar (1/3), prices right-aligned, "nga 20 €" handled, the business status line ("Mbyllur · hapet sot në 09:00") is correct at 07:50.
- **Calendar** reads well: the summary card "9 termine · 59 €" plus "I radhës: Driton M. në 09:00" is exactly what an owner wants at a glance. The weak spot is the small cards for 15–30-minute services (M3).
- **Settings / Orari:** the 24-hour selects and the switches are clear. The holiday chips are a great idea; their labels are now right (M1).
- Apple-level? The visual language is there: type, spacing, motion tokens, reveal that degrades without JS. What separates it from Apple-level is touch-target discipline (M3) and the demo dates (S6).

## 6. Flow: can a 50-year-old barber sign up in 2 minutes?

`/fillo`: name + category chips + city → services (pre-filled per category) → hours (pre-filled, "Kopjo të hënën") → phone + SMS code → link, QR and WhatsApp share. Steps 1–3 are saved in `localStorage`, so a lost SMS doesn't lose the work. Good.

Where they will get stuck:
1. **The SMS code** is the only hard step, and there is no SMS provider yet. Until there is, onboarding in the field must be done with Roni beside them. ➡️ Opus: offer "Merre kodin në WhatsApp" as the main channel (WhatsApp Cloud API authentication template) and SMS as fallback; barbers live in WhatsApp.
2. **Prices** step: the price inputs expect numbers; "5 euro" or "5€" are parsed (`parsePrice` strips € and spaces), "pesë" is not. Fine.
3. **After sign-up** the next action is "put the link in your Instagram bio". Many barbers don't know how. ➡️ Add a 15-second "Si ta vendos në bio" GIF/video link on the done screen and in the checklist item.

## 7. Business notes

- **Pricing copy conflict** (`lib/sq.ts:310-317`, `fg.includes`): "Hosting pa pagesë mujore" sits right next to "pastaj 5 €/muaj ose 20 € për ndryshim". A reader sees "5 €/muaj" and stops trusting "no monthly fee". ➡️ Reword: "Ndryshimet: 1 falas në 30 ditët e para, pastaj 20 € secili (ose 5 €/muaj pa limit)". Keep the hosting line.
- **Custom domain "+15 €/vit"** is charged once at checkout; nothing tracks renewal. ➡️ Store `domainRenewsAt` and show it in `/admin`. Otherwise, 12 months later the domain lapses and the client's site goes dark: the worst possible trust event.
- **"Fotot e tua të përmirësuara"** is a manual promise (admin replaces photos). Keep it only if Roni really does it for every page within 24h. Otherwise change it to "Fotot e tua, të rregulluara për web".
- **Trust on the payment screen:** add the legal entity (THAT AD SH.P.K.) plus a "Kthimi i parave brenda 7 ditëve nëse s'je i kënaqur" line. A refund promise costs little and removes the main objection to paying 100 € to an unknown brand. This is Roni's decision; I recommend it.
- **Termini "Rezervuar përmes Termini"** footer in every WhatsApp reminder is the growth engine. Good, keep it.

---

## Files changed in this audit
- `build/app/templates/fg.js`, `build/app/public/fg/fg.js`, `fable/templates/fg.js`: C1
- `build/app/lib/config.ts`, `build/app/.env.example`: C2
- `build/app/lib/auth.ts`, `build/app/lib/api/public.ts`: H1 + code IP limit
- `build/app/lib/http.ts`: H2
- `build/app/lib/booking.ts`: H5, S1
- `build/app/lib/pages.ts`: H6
- `build/app/components/Settings.tsx`, `build/app/lib/presets.ts`: M1
- `build/app/components/FaqjaWizard.tsx`, `build/app/lib/sq.ts`: M2, S2
- `build/app/tests/booking.test.ts`, `build/app/tests/pages.test.ts`: 2 regression tests
- Audit tools: `fable/_audit/xss-check.ts`, `wa-check.ts`, `shots.mjs` (logged-in screenshots), screenshots in `fable/_audit/shots/`

## Order for Opus
1. H3 (spam bookings), H4 step 1 (preview skeletons), M5, M4.
2. M3 (touch targets), M7 (Paysera, before the first card payment), M6.
3. M1 cleanup (one holiday list + test), S3, S4, S6, the business copy in §7.
