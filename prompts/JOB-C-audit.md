# JOB C: full Fable audit of the app (v4)

You are Fable 5.2. You may be on a new account with no memory of this project. Everything you need is on disk.
The owner is Roni (video editor, not a programmer). Do not ask questions: decide yourself.
**Roni is away. NEVER stop, pause or wait for confirmation. Keep working until the line `JOB C done` is written. The only acceptable stop is the usage limit.**
**Start only if JOB B is done** (`F:\TERMINI\fable\PROGRESS-JOB-B.md` contains `JOB B done`; if not, stop and say so).

## Where things are (read first)
1. `F:\TERMINI\CONTEXT.md` (the business), `F:\TERMINI\VERSIONS.md` (versions), `F:\TERMINI\GO-ONLINE.md` (production setup).
2. `F:\TERMINI\fable\03-audit.md` (earlier audit, done by Opus) + `F:\TERMINI\MORNING-REPORT.md` (what was already fixed).
3. `F:\TERMINI\fable\02-design-system.md`, `fable\design-tokens.css`, `fable\templates\` (9 templates).
4. App: Next.js 15 + Prisma + Vitest.

## Step 0: new version
Copy `build/app-v3` to `build/app-v4` (skip `node_modules` and `.next`), `npm install` there. In `VERSIONS.md` mark v3 FROZEN and add
"v4: v3 + Fable audit fixes". Audit the code in v4 and fix ONLY in `build/app-v4`.

## The audit: be strict, think like an attacker and like a tired barber on a phone
- **Security:** login/OTP (brute force, reuse), sessions/cookies, admin access, Paysera callback (forged/duplicate/test payments), preview bypass (getting the paid page for free), uploads (type/size/path), rate limits, XSS/injection in templates and content.json, data leaks between businesses, env/secret handling, the SITE_PASSWORD gate, subdomain middleware.
- **Bugs:** slots, double bookings (race conditions), hours/breaks/holidays, cancellations, time zone Europe/Belgrade, DST.
- **UX at 375px:** customer booking, business sign-up (≤2 min), barber dashboard, Faqja Gati wizard + preview + pay, admin.
- **Albanian copy:** natural Kosovo Albanian, no Google-Translate tone.
- **Design:** all 9 templates + Termini screens: anything below Apple/Mercedes level.
- **Production readiness:** anything that would break on Vercel + Postgres.

Write `F:\TERMINI\fable\04-fable-audit.md` (critical / high / medium / small, each with file + fix).
Then FIX all critical and high (medium if quick) in `build/app-v4`, add tests for each fix, make `npm test` + `npm run build` pass.
Finish with `F:\TERMINI\REPORT-v4.md`: short, simple English for a non-programmer: what was found, what was fixed, how to open v4, what is left.

## Save as you go (the usage limit can stop you any minute)
- After EACH finished step, append one line to `F:\TERMINI\fable\PROGRESS-JOB-C.md`.
- At the start, read that file and continue from the first unfinished step. Never redo finished steps.
- When everything is done write `JOB C done` in it.
Work only inside `F:\TERMINI`. Never edit v1, v2 or v3.
