# Fable progress

- [x] **1A** Product + brand → `fable/01-product-design.md` (risks, brand, all Termini screens + Albanian copy, Faqja Gati flow, preview protection, fill prompt, data model, API).
- [x] **1B** Design system → `fable/02-design-system.md` + `fable/design-tokens.css` (Geist, ink + lime, light/dark, motion, components).
- [x] **2A** Templates → `fable/templates/` (shared `schema.json`, `fg.js`, `base.css`, `preview.css`, then 6 templates)
  - [x] shared: `schema.json`, `fg.js` (fill + interactions), `base.css`, `preview.css` (open any template with `?preview=1`), `tools/sync-content.mjs` (content.json → content.js + validation), `tools/shot.mjs` (screenshots)
  - [x] `berber` (verified at 375px)
  - [x] `klinike-dentare` (verified at 375px)
  - [x] `restorant-kafe` (verified at 375px)
  - [x] `bujtine` (verified at 375px)
  - [x] `salon-bukurie` (verified at 375px)
  - [x] `dyqan` (verified at 375px; primary button orders on WhatsApp, Termini button appears only when booking.enabled)
  - [x] desktop check (1280px) + preview check for all six (`node fable/templates/tools/shot-all.mjs` re-runs every screenshot into `fable/_shots/`)
- [x] **2A done.** fg.js change: without a Termini link the booking button now uses `contact.whatsappMessage` when given.
- [x] **2B** Termini screens → `fable/termini-ui/` (open `index.html` for every screen and state)
  - [x] `booking.html` (3 steps), `confirmation.html`, `onboarding.html` (4 steps + done), `calendar.html` (day, booking sheet, new booking, empty)
  - [x] `services.html` (list, on/off, add/edit sheet, delete sheet, empty)
  - [x] `settings.html` (home with link card; `?view=orari` weekly hours + pause + days off; `?view=rezervimet` booking rules; `?view=profili`)
  - [x] shared `termini.css` + `termini.js` (prototype behaviour only). All screens checked at 375px light and dark, plus 320px and 1280px: no horizontal overflow. Re-run with `node fable/templates/tools/shot-termini.mjs` → `fable/_shots/termini/`.
  - Fixed while checking: time fields are now 24-hour `<select>`s (`type="time"` showed AM/PM), day names no longer clip in the hours list, the week strip fits 7 days, step transitions no longer cause sideways scroll.
  - Not built (not in the brief's key screens): Klientët list and the "Gjej" page; both are specified in `01-product-design.md` §3.6 and §4.3.
  - Notes for Opus: saving rule is in the comment at the top of `settings.html`; `<input type="date">` in the days-off sheet shows the phone's own date format.

Phase 2 done

Phase 2 done, waiting for Opus to build the app. Phase 3 (audit) starts only when `READY-FOR-AUDIT.md` exists in the project root.

- [x] **Phase 3 audit** → `fable/03-audit.md` (2026-11-14, done by Opus 5.5 because Fable had no credits). Fixed: stored XSS in live pages (JSON-LD), login codes leaking in production, OTP race, spoofable IP, move/undo double booking, SSRF, swapped Bajram names, HEIC, Albanian copy. Tests 41/41, smoke 48/48. Open items for Opus are ranked at the end of the audit (spam bookings H3, preview skeletons H4, touch targets M3, headers M4, Paysera M7).
