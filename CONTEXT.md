# CONTEXT: Termini + Faqja Gati (everything decided with Roni, 2026-11-12)

**Who:** Roni, Kosovo (Gjakova/Prishtina). Video editor, motion designer, AI visuals (Higgsfield), builds with Claude Code. 50/50 partner in the agency **THAT AD** (has local clients). Wants something **"bigger that grows slowly"**, good for people, Apple/Nvidia/Mercedes design level.
**Format:** **web app** (works perfectly on phones, installable as a PWA). No App Store at the start.
**Team:** Sonnet did the research, Opus did the analysis/plan/code, **Fable 5.2 does design + premium templates + final audit** (limited credits).

---

## 1. Termini: online booking for barbers, salons, dentists, clinics
**Idea:** every business gets a link (`termini.ks/berberi-arti`, name not final). The customer picks a time in 20 seconds without calling → WhatsApp/SMS confirmation → reminder 1 hour before. The owner sees the day's schedule on their phone.

**Decided model (Roni):**
- **FREE for businesses at the start.** They sign up on their own, from the phone, in **2 minutes** (name, phone, services + prices, hours) → get their link → put it in their Instagram bio. No meeting, no sales rep.
- **Growth on its own:** every confirmation says "Booked through Termini" → customers bring the next business. Later a **"find a free slot near you"** page for customers (Wolt for appointments) → businesses come because the customers are there.
- **Money later** (once they're used to it):
  1. Paid extras €10–20/mo: automatic WhatsApp/SMS reminders, more staff (salon with 4 hairdressers), reports ("200 customers this month, €2,000").
  2. **Deposit against no-shows:** the customer pays €2–5 upfront; it comes off the price if they show up, the business keeps it if they don't; Termini takes a small cut (~€0.20).
  3. **Featured first** on the "find" page: €10–15/mo.
- Model like **Fresha** (free for businesses, money from payments/extras; 100k+ businesses), **ebarber.gr** (350+ shops, 120k users, Greece).
- **Reels:** Roni films barbers using it ("I don't answer the phone anymore"), and other businesses sign up on their own.
- **Risk:** businesses are used to phone/DMs → the first 20 get set up in person, free.

## 2. Faqja Gati: premium AI landing page in 2 minutes
**Idea (Roni):** the business writes a prompt **or** uploads 5–10 photos + 2–3 sentences ("Barbershop in Gjakova, haircut €5, open 9–20, 049…"), or pastes its **old website** link (it can be read). **Instagram/Facebook links don't work** (they block scraping).
→ AI builds the page in **1–3 minutes** → **watermarked preview** ("Faqja Gati – Preview", buttons disabled, not downloadable, shown so the code can't be copied easily) → pays **€100 once** → the watermark disappears and the page goes live on their domain (`berberiarti.com`) or `arti.faqjagati.com`, **theirs forever**.
- Extras: domain €15/yr; changes €5/mo or €20 per change.
- **Termini built in** on every page ("Book an appointment" opens Termini) → the two products grow together.
- **Quality = Apple/Nvidia/Mercedes level** (clean style, big typography, lots of space, scroll animations, cinematic; their style, not a copy of their pages). **Fable designs 6–8 templates once** (barber, dentist/clinic, restaurant/café, guesthouse, beauty salon, shop, + 1–2 others). A cheaper model (Claude API, Sonnet/Haiku) only **fills** the template with text/photos/colours, so quality is the same every time and it's cheap.
- **Photos** are upgraded with AI (clean-up, colour, premium look; Roni with Higgsfield). Top package: a short cinematic video in the hero.
- **NOT with Roni's personal Claude account** (against the rules, PC has to stay on) → **Claude API**, ~€0.10–0.50 per page.

## 3. Technology (Opus recommendation; Fable may improve it)
- Next.js (web app/PWA) + Supabase (DB, auth) or similar; static hosting for the pages **free** (Cloudflare Pages/Netlify); a small server/queue ~€5–10/mo.
- Reminders: WhatsApp (click-to-chat link at the start; later the WhatsApp Business API or a cheap SMS API).
- **Payments:** Stripe and PayPal **don't work in Kosovo**. Use **Paysera** (checkout for the €100). Roni also has **OneFor** (check payment links). At the start, bank transfer/cash + manual unlock is fine too.

## 4. Kosovo market facts (Sonnet research; ~ = estimate)
- 1.6M people (2024), Prishtina 227k; Albania 2.4M (second market).
- Average net salary **€552**; ~**72% of payments in cash**; card/online payment is weak.
- ~856k Facebook users; Instagram + WhatsApp + Viber are the main communication channels.
- Only **28–49%** of small businesses use the internet to sell; many have only an IG/FB page. Agencies ask **$1,000–10,000** for a site, which is too much for small businesses. IPKO myWeb sells site packages from €9.95/mo (simple).
- **Booking:** no dominant booking app in Kosovo; barbers/salons/clinics work by phone + IG DMs. Fresha/Treatwell aren't here.
- Public healthcare has long waits → private clinics growing, prices not transparent → clinics need booking + a page.
- Guesthouses in Rugova/Prizren (€30–60/night) are booked by phone/blogs; tourism 6.9–7.5M entries/yr; diaspora summer July–August.
- Competitors to watch: doXmenu (QR menus, already in Kosovo), IPKO myWeb, local agencies, Instagram.

## 5. Traps (in Kosovo)
1. Don't force card payments → cash/transfer/Paysera, annual payment.
2. "My nephew can do it for free" → sell the **result** (more customers, fewer calls), not "a website"; show a reel.
3. Don't build too much before customers → 10–20 conversations with real businesses first.
