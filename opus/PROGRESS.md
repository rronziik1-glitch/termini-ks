# Opus progress

- 2026-11-14: Finished the build in `build/app`: added the Faqja Gati screens (`/faqja`, `/faqja/krijo`, `/faqja/[id]`), live pages `/p/[slug]`, `/admin` and the owner settings (`/app/cilesimet` + orari/rezervimet/profili), plus README and a smoke script.
- `npm run build` passes, `npm test` 39/39, `npm run smoke` 48/48 against a running server; checked the new screens visually at 375px and 1280px.
- Done → `READY-FOR-AUDIT.md` written. Open items: Paysera untested live, no SMS/WhatsApp API, subdomain routing, staff calendars.
- 2026-11-14 (afternoon): fixed audit items H3 (new-number burst limit + block cancels future bookings), H4 step 1 (preview hides half the content), M3, M4, M5, M6, M7, S3, S4, S6, pricing copy. 3 new tests (44/44). Build + smoke pass on a fresh server. MORNING-REPORT.md written.
