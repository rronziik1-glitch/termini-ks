# REPORT v5: Termini first (16 Nov 2026)

For Roni. Simple English. Built by Opus in the Claude app (no PowerShell). v1 to v4 were not touched.

## In one minute
- **Real customers are never turned away any more.** When many new numbers book at once (e.g. after an Instagram story), the extra bookings are accepted as **"Për konfirmim"** (to confirm), and the barber taps **Konfirmo** or **Refuzo**.
- **Faqja Gati is switched off** for the Termini launch. Nobody sees it: no home page section, no links, and its addresses go back to the home page. It comes back with one setting in April/May.
- **The "we improve your photos" promise is removed.** Later we can add it back (Higgsfield or by hand).
- **107 automatic tests pass** (9 new) and the build passes. I also clicked through it in the browser.

## What changed

**1. "To confirm" bookings (replaces the spam refusal)**
- More than 6 new numbers at one business in 30 minutes → the next bookings are **accepted as pending**, not refused.
- The customer sees **"Kërkesa u dërgua"**: the business will confirm soon, the time is held for them, plus a WhatsApp button to write to the business, and they can cancel.
- The barber sees an **orange banner** at the top of the calendar: "1 rezervim pret konfirmimin tënd". Tap it → the day opens; the booking has an orange "Për konfirmim" badge.
- Tap the booking → **Konfirmo** (big green) or **Refuzo** (red). After Konfirmo: "Njofto në WhatsApp" to tell the customer.
- **No answer within 2 hours → the time is released** automatically and the customer sees "Kërkesa nuk u konfirmua".
- A pending booking holds its time: nobody else can take it meanwhile (no double bookings).
- Blocked numbers are still refused.

**2. Faqja Gati off until it opens**
- One setting: `FAQJA_GATI_ENABLED`. Empty or `0` = off (now). `1` = on (April/May).
- Off means: no Faqja Gati section on the home page, no link in the footer or in the barber's settings, `/faqja...` and page addresses go to the home page, not in Google's sitemap.
- Paysera's payment address stays open (needed later), and all the Faqja Gati code is still there, untouched, ready for April.

**3. Photo promise removed**
- "Fotot e tua të përmirësuara" now says "Fotot e tua, në madhësinë e duhur për çdo ekran" (the app already resizes photos automatically, so this is true).

**4. Bug fixed on the way**
- The booking confirmation page had a small code error on phones (a button inside a paragraph) that made the page re-draw itself. Fixed for both normal and "to confirm" bookings.

## How to try it
```bash
cd F:\TERMINI\build\app-v5
```
```bash
npm run dev
```
1. To make a demo "to confirm" booking: in a second PowerShell in the same folder run `npx tsx scripts/demo-pending.ts` (it adds demo customers for tomorrow at Berberi Arti; the last one becomes "to confirm").
2. Open http://localhost:3000/hyr → `049 111 111` → the code is shown on screen.
3. You see the orange banner → tap it → tap the orange booking → **Konfirmo**.

(The local demo database already has a few demo bookings for 17 Nov from my test.)

## For later
- **April/May, Faqja Gati opens:** set `FAQJA_GATI_ENABLED=1`, then do the decisions already made: checkout shows **Termini** (small line "Shërbimi ofrohet nga RR Digital L.L.C."), **7-day money-back guarantee** badge + refund page + admin "Kthe paratë" button. (Prompt idea is in `prompts/JOB-D-pending-refund.md`, Part 2.)
- **Photo upgrade** (Higgsfield / by hand): decide a few months after launch.
- Still to test for real when accounts exist: database, SMS/WhatsApp, Paysera (see `GO-ONLINE.md`).
