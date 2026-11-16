# Termini: everything decided and discussed (14–15 Nov 2026)
Read this first in every new session about Termini / Faqja Gati. Detailed steps: LAUNCH-STEPS.md.

## Who / ownership
- Roni ALONE owns it (CEO/CFO). Claude = CTO. NOT THAT AD, no partners. (THAT AD removed from app config.)
- Roni is a video editor, not a programmer: explain everything in plain amateur words.
- Roni does NOTHING in person: no visits, no meetings, no going out. Everything remote.
- "Just talking" = no tool actions. Work only after "do it". Never launch long jobs myself.

## Products
- **Termini** = main money product now (booking for barbers, salons, clinics, guesthouses).
- **Faqja Gati** = standalone FIRST, joins Termini later. Idea: a switch that hides Faqja Gati until ON (offered, NOT built yet).
- Claude API is needed ONLY for Faqja Gati. Termini-only launch needs no Anthropic key.

## Company, legal, tax
- Company name: **RRender SH.P.K.** (chosen 15 Nov over RR Digital: render + Gjakova double R + his initials; backups RRezja, RRframe). New SH.P.K. with Roni as only owner, registered at ARBK (free, ~3 days, online rbk.rks-gov.net / e-Kosova).
  Docs: Form A0, company agreement, statute (ARBK templates), ID copy, representative consent. Neutral company name (register is public).
- Register NOW (launch is in a month). Accountant once (monthly declarations even at €0, otherwise fines).
- Tax (confirm with accountant): VAT 18% only above €30,000/year. Small company: 9% of income OR 10% of PROFIT with bookkeeping.
  Roni wants 10% of profit: business expenses with invoices in the COMPANY name (server, domain, Claude/API, Higgsfield for Termini,
  Meta ads, accountant, SIM, SMS, Paysera fees, influencers via contract). Upwork = his video income, keep separate unless accountant says otherwise.
  Mixed-use tools: only the Termini share. Tax is per YEAR; a loss carries forward to next years (limited years).
  Examples: €5 income first month → loss ≈ −€1,095 → tax €0. €5,000/month → ~€390 tax first month; passes €30k → VAT.
  Taking money out: salary (PIT + Trusti 5%+5%) or dividend (usually not taxed again, confirm).
- Closing later: pay debts, ATK clearance, ARBK dissolution. SH.P.K. protects personal assets.
- Software can't be patented; trademark logo+name later (Industrial Property Agency). "termini" is a common word → protect logo+name.

## Name, domain, accounts
- termini.com/.app/.net/terminiapp.com TAKEN. Free: terminiks.com (pick), termini-ks.com, merrtermin.com. No KS booking app called Termini found.
- Buy at Cloudflare Registrar (~€10/yr, auto-renew ON, 2FA). Nobody can take it while renewed.
- Gmail limit (3 per number) → Roni buys a new IPKO prepaid SIM (with ID) on 15 Nov: business Gmail, WhatsApp Business, contact number.
  Keep SIM active (top up). Proton Mail = alternative without phone. Later info@terminiks.com via Zoho free.
- Instagram/TikTok/FB @termini.ks reserved, private until launch.
- Paysera: personal now, business account after ARBK. Apply EARLY (checks 1–2 weeks).
  Needs: Project ID (shop number), Sign password (secret stamp, never share), Public key (Paysera's stamp, public). Test a real €1.
- Hosting: rented, Frankfurt (Vercel ~€20/mo + Neon free DB). NOT self-hosted on Roni's PC (power cuts, security, backups).
  Roni controls the business in /admin; Vercel dashboard rarely.

## Security
- PC check 14 Nov: Defender ON, quick scan clean, Adobe/IDM/Wondershare folders clean, startup normal.
  Roni must check Defender exclusions + run a full scan. Cracked apps = stealer risk; business logins from phone + 2FA.
- Passwords: Roni keeps his .txt (needs it daily) → advised 7-Zip AES-256; writes all on PAPER at home too (+ 2FA recovery codes).
  Business passwords (Paysera, Cloudflare, admin) ONLY on paper.
- App admin: SMS code + admin password (2nd lock, `npm run admin:password`, 5 tries/15 min, 8 h). NOT SET YET by Roni.
  ADMIN_PHONES still demo 049 000 000 → change to new SIM. Admin panel got a "Dil nga llogaria" button.

## Launch plan (Roni's)
- Nov 15–21 SIM, Gmail, domain, ARBK, accountant, Paysera business, app online privately.
- Nov 22–28 SMS login codes + legal pages, first 10 businesses.
- Nov 29–Dec 12 → 50 businesses (30 min). Dec 1 teaser "Diçka po vjen për Kosovën. 15.12."
- Dec 15 PUBLIC LAUNCH (only after a real Paysera payment worked). Dec 18+ diaspora ads DE/CH/AT, all in.
- Remote outreach: Instagram DM + WhatsApp to ~300 businesses (Prishtina, Gjakova, Prizren, Peja) + 30-s demo video;
  self sign-up /fillo; WhatsApp video call if stuck; remote "setup for you"; digital QR poster (A5 PDF) instead of printed stands;
  founders send phone clips → Roni edits their reel at home; no cash, Paysera/bank only.

## Psychology (make businesses WANT it)
Scarcity "Vetëm 50 bizneset e para: Themelues, falas përgjithmonë" + gold badge · fear of losing the diaspora ·
proof from known businesses + live counter · pride (Apple-level page) · gift (free reel) · barbers bring barbers (featured on /gjej).

## Money (Termini) — free at launch, extras from Jan/Feb without anger
- Rule: local customers never pay to book. No surprises: show the date from day 1 in "01.01.2027" style.
  Roni wants "Falas deri më 01.01.2027"; Claude suggested 01.02.2027 (only 2 weeks free otherwise) — Roni to decide.
- Founders keep free basics forever. 30 days notice. First bill = €5 credit. Generous free quota.
- MONTHLY VALUE REPORT on the 1st (Roni loved it): "Në dhjetor Termini të solli 63 rezervime, 11 klientë të rinj, dhe të kurseu ~9 orë telefonata."
- Revenue ideas:
  - 5c per booking above 30/month (business pays, monthly bill).
  - Reminder credits: €5 = 100 reminders (cost ~3–5c each).
  - Diaspora guaranteed booking €1–2 + deposit (December).
  - Gift cards (diaspora buys for family; Christmas, New Year, Bajram, 8 March) 5–10% + unused cards.
  - No-show deposits €3–5, Termini takes 50c.
  - Last-minute empty-slot deals, 50c per filled slot.
  - New customer from /gjej: €0.50–1, opt-in "Shfaqu në /gjej", only if the customer showed up (not no-show), first visit only,
    source tracked (app already records nga=gjej/link/faqja), monthly statement, pay by Paysera/bank, unpaid 15 days → hidden from /gjej,
    watch strange no-show rates, later "A shkove? Si ishte?" message = reviews.
  - Sponsor line (Roni thinks ads are the best): one elegant line+logo on confirmation screen, WhatsApp confirmation, reminder;
    matched to category (barber → pomade brand + coupon TERMINI, dentist → pharmacy, salon → cosmetics, general → Vala/IPKO/bank).
    Sell category sponsor €200–300/mo or by views; only after ~5,000+ bookings/month; early = barter products for founders.
    Max 1 line, never a rival, Pro removes it, brands get only counts, never personal data.
  - Pro €9.90–14.90/mo (clinics €29): reminders, staff calendars, stats, deposits, no Termini line.
  - Featured on /gjej €10–15/mo (later). Tips (5c). Remote setup €20 later (free for first 50).
  - Example after ~1 year (300 businesses, 36k bookings/mo): ≈ €3,500/mo + seasonal.
- Customer 50c per booking: rejected for locals (people call for free, 72% cash, fees eat 50c).

## Costs until mid-January (estimates)
Domain ~€12 · SIM ~€10 · ARBK €0 · accountant ~€80–150 · Vercel ~€40 · Neon €0 · SMS codes ~€5–10 · reminders €0 (wa.me links) ·
Claude API €0 (Termini only) · Higgsfield €0–50 extra · influencers 10 × €50 = €500 · Meta diaspora ads €150–300 · spare €100.
TOTAL ≈ €950–1,200. Monthly after: ~€100–150 fixed + marketing €200–500.
Influencers: 10 in Prishtina (1–20k followers), own tracking link each (?nga=name), post Dec 15–20, brief = book live in story + reel
"rezervova në 20 sekonda", pay half before/half after, 2–3 diaspora creators.

## Ads (Higgsfield, Fable on other account)
ads/TERMINI-ADS.md: 3 reels 9:16 — "Telefoni s'pushon" (Apple), "20 sekonda" (Mercedes), "Kosova rezervon" (kinetic like Higgsfield refs).
Brand: black/white/lime #c8f03c, Geist. Free image models for start frames, credits only for video. Post only from launch day.

## App ideas waiting for "do it"
- Switch to hide Faqja Gati. Account circle with logo or first letter (colour from name) + menu Profile/Settings/Log out (admin = R).
- Hide the Next.js "N" dev button (dev only anyway). Themelues badge + live business counter. Digital QR poster PDF. Monthly value report.
- LATER (~1 year): 10 app themes (anime etc.), customer pays €1 per theme.

## Links / files
- Explainer page: https://claude.ai/artifact/8PzLdvj2aWxymH3yzj1GM6 (docs/si-funksionon.html)
- App: build/app → `npm run dev` → localhost:3000 · demo admin 049 000 000 · barber 049 111 111 · /fillo sign-up · /faqja/krijo
- LAUNCH-STEPS.md (steps + plan + psychology), MORNING-REPORT.md, ads/TERMINI-ADS.md

## 2026-11-15 JOB A (Fable): 2 new Faqja Gati templates
- `sallon-dasmash` ("Champagne evening", Bodoni Moda + Manrope) and `autoshkolla` ("Clear road", Sora + Figtree) in fable/templates and build/app-v2.
- Same content schema, no new fields. Wedding: first services group = halls (capacity in `tag`, photo), next groups = menus per person. Driving school: first group = licence categories as cards, first highlight = pass rate.
- New Termini categories `dasma` and `autoshkolla` (presets, onboarding, labels). Re-run of the registration: logs/job-a-register.mjs (already applied, do not run twice).
