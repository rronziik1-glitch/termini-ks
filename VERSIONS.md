# App versions (never overwrite an older version)

| Folder | What | Status |
|---|---|---|
| `build/app` | **v1**: MVP built by Fable + Opus, audit fixes by Opus (14 Nov 2026). | FROZEN: do not edit |
| `build/app-v2` | **v2**: copy of v1 (15 Nov 2026) + 2 new templates (wedding hall, driving school) + Fable audit fixes. | FROZEN: do not edit |
| `build/app-v3` | **v3**: v2 + car wash template + online-ready setup (Postgres, Vercel, storage, SMS/WhatsApp codes, Paysera env, subdomains, launch password). See `GO-ONLINE.md`. | FROZEN: do not edit |
| `build/app-v4` | **v4**: v3 + Fable audit fixes (16 Nov 2026). Audit: `fable/04-fable-audit.md`, report: `REPORT-v4.md`. | FROZEN: do not edit |
| `build/app-v5` | **v5**: v4 + bookings "to confirm" instead of refused + Faqja Gati switched OFF for the Termini launch (comes back April/May) + photo promise removed (built by Opus, 16 Nov 2026). Report: `REPORT-v5.md`. | Work in progress |

Rules
- New work always goes into the newest version folder. Never edit an older one.
- Original Fable templates live in `fable/templates/`. New templates are added as NEW folders there. Never change the existing 6.
- Run v1: `cd build\app` then `npm run dev` (http://localhost:3000)
- Run v2: `cd build\app-v2` then `npm install` (first time only) then `npx next dev -p 3001` (http://localhost:3001)
- Run v3: `cd build\app-v3` then `npm install` (first time only) then `npx next dev -p 3002` (http://localhost:3002)
- Run v4: `cd build\app-v4` then `npm install` (first time only) then `npx next dev -p 3003` (http://localhost:3003)
