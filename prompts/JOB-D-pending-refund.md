# JOB D: "to confirm" bookings instead of refusing + Termini checkout with 7-day money-back (v5)

You are Fable 5.2. You may be on a new account with no memory of this project. Everything you need is on disk.
The owner is Roni (video editor, not a programmer). Do not ask questions: decide yourself, in the same premium style.
**Roni is away. NEVER stop, pause or wait for confirmation. Keep working until the line `JOB D done` is written. The only acceptable stop is the usage limit.**
**Start only if JOB C is done** (`F:\TERMINI\fable\PROGRESS-JOB-C.md` contains `JOB C done`).

## Where things are (read first)
1. `F:\TERMINI\CONTEXT.md` (the business), `F:\TERMINI\VERSIONS.md` (versions), `F:\TERMINI\REPORT-v4.md` + `F:\TERMINI\fable\04-fable-audit.md` (latest audit; "What is left" item 1 = this job).
2. `F:\TERMINI\fable\02-design-system.md`, `fable\design-tokens.css`, `fable\termini-ui\` (Termini screens style).
3. App: `F:\TERMINI\build\app-v4\` (Next.js 15 + Prisma + Vitest). Key files: `lib/booking.ts` (createPublicBooking, MAX_NEW_NUMBERS_PER_WINDOW spam guard), `components/BookingFlow.tsx`, owner dashboard/calendar components, `lib/api/owner.ts`, `lib/sq.ts` (all Albanian texts), `lib/pages.ts` + `lib/payments.ts` (Faqja Gati payment), the checkout/payment screen, `prisma/schema.prisma` (+ `prisma/postgres/` schema: keep both in sync).

## Step 0: new version
Copy `build/app-v4` to `build/app-v5` (skip `node_modules`, `.next`), `npm install` there. In `VERSIONS.md` mark v4 FROZEN, add
"v5: v4 + bookings 'to confirm' + Termini checkout with 7-day money-back". Work ONLY in `build/app-v5`.

## Part 1: spam guard → "to confirm" (Roni's decision)
Today: after 6 new phone numbers at one business in 30 minutes, the next booking is REFUSED. Real customers from an Instagram story get an error. Change it:
- Above the limit (and for any other "suspicious" case the guard catches), the booking is **accepted with status `pending` ("Në pritje të konfirmimit")**. It holds the slot (no double booking) for a limited time.
- Customer sees a clear, friendly screen: "Kërkesa u dërgua, [biznesi] do ta konfirmojë së shpejti" + WhatsApp link to the business.
- Owner dashboard: a visible banner/badge "X rezervime për konfirmim" with big **Konfirmo** / **Refuzo** buttons (44px+, works at 375px), also in the calendar. Confirm → normal confirmed booking + WhatsApp message link to the customer. Refuse → slot freed, customer message link.
- Pending not answered within a set time (e.g. 2 hours, or before the slot starts) → auto-released. Pick sensible values, put them in config.
- Blocked numbers still refused. Keep the per-IP limit from v4.
- Tests: burst of 7+ new numbers → 7th is pending, not refused; pending holds the slot; confirm/refuse/expiry work.

## Part 2: checkout shows "Termini" + 7-day money-back guarantee (Roni's decision)
- The Faqja Gati payment screen shows the brand **Termini** (logo/name), not the company name, as the main seller name.
- Legally the seller is the company, so add one small line under the price / in the footer of checkout: "Shërbimi ofrohet nga RR Digital L.L.C., Prishtinë". Also in terms/footer.
- Add a clear **"Garanci: paratë mbrapsht brenda 7 ditëve, pa pyetje"** badge on the Faqja Gati pricing + checkout screens (premium look, not cheesy), and a short refund policy page (`/kthimi-i-parave` or similar) in natural Albanian: 7 days from payment, how to ask (WhatsApp/email), refund to the same method, the page goes back offline after the refund.
- Admin: a **"Kthe paratë"** (refund) action on a paid page: marks the payment refunded, sets the page back to preview/unpublished, logs it. (Actual money return is done by hand in Paysera/bank: say so in the admin UI.)
- Tests for refund status + page unpublished after refund.

## Finish
- `npm test` + `npm run build` must pass in `build/app-v5`.
- Write `F:\TERMINI\REPORT-v5.md`: short, simple English for a non-programmer: what changed, how to try it (exact steps to see a "to confirm" booking and a refund in the demo), what is left.

## Save as you go (the usage limit can stop you any minute)
- After EACH finished step, append one line to `F:\TERMINI\fable\PROGRESS-JOB-D.md`.
- At the start, read that file and continue from the first unfinished step. Never redo finished steps.
- When everything is done write `JOB D done` in it.
Work only inside `F:\TERMINI`. Never edit v1–v4.
