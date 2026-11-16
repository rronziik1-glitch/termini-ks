# OPUS BUILD BRIEF: build the Termini + Faqja Gati web app

You are **Opus**. Roni is asleep: work **fully on your own**, with no questions. Read `CONTEXT.md`, then all of Fable's work in `fable/` (design, design system, templates, Termini UI). **Follow Fable's design faithfully**; where something is missing, decide in the same style.

## Goal
A **working web app** in `build/app/` that Roni can open in the morning with:
```
cd F:\claude\work\kosovo-business\build\app
npm install
npm run dev
```
and see/try everything locally, **with NO external accounts or keys** (he's asleep, nobody can create accounts).

## Technology (local-first, ready for production later)
- **Next.js (App Router) + TypeScript + Tailwind** (or plain CSS with Fable's tokens), PWA manifest.
- **DB:** SQLite via Prisma (or Drizzle) with `npm run db:setup` + seed with 3 example businesses (barber in Gjakova, dentist in Prishtina, guesthouse in Rugova). Schema written so it can move to Postgres/Supabase later.
- **Auth:** simple for businesses (phone/email + password or magic code shown in the console in dev). Customers book without an account (name + phone).
- **AI (Faqja Gati):** `lib/ai.ts` calls the Claude API (Sonnet/Haiku) **only if** `ANTHROPIC_API_KEY` exists in `.env`; otherwise a **deterministic local filler** that builds `content.json` from the form (so it works without a key). Prompt + JSON schema from Fable's design.
- **Templates:** use Fable's 6 templates from `fable/templates/` (copy them into the app), fill them with `content.json`. Watermarked preview (`preview.css`, disabled buttons, served from the server, not downloadable as files before payment).
- **Payment:** `lib/payments.ts` with a **Paysera** interface (placeholder + TODO with the docs) and a **dev "Mark as paid"** button for the admin. Payment → unlock → page published at `/p/<slug>` (later, a subdomain).
- **Reminders:** generate a WhatsApp click-to-chat link (`wa.me`) with the message in Albanian; in dev, log the message. Interface ready for a WhatsApp Business API/SMS later.
- `.env.example` with all the variables, **no real keys**.

## What has to work (MVP)
**Termini:**
1. Business sign-up in ≤2 minutes (name, category, phone, services + prices + duration, hours) → gets the link `/b/<slug>`.
2. Customer: open `/b/<slug>` → pick service → pick a free slot (no double bookings, respects hours/breaks) → name + phone → confirmation + WhatsApp link + "Rezervuar përmes Termini".
3. Business dashboard: daily/weekly calendar, cancel/mark no-show, services, hours, customer list.
4. Simple "find" page `/gjej` (by city/category), the start of the marketplace.

**Faqja Gati:**
5. `/faqja`: form (category, name, city, description/prompt, upload 5–10 photos, old website link optional) → progress → watermarked preview.
6. "Merre për 100€" → payment (dev: admin marks it paid) → live page with the **"Rezervo termin"** button linked to that business's Termini.
7. Admin `/admin`: list of pages, status (preview/paid/live), mark paid.

**Everything in Albanian** in the UI. Mobile-first, Fable's design system.

## Quality
- Tests (Vitest/Playwright, whatever's simplest) for: slot calculation, double booking, preview gating (no live page without payment).
- `npm run build` must pass with no errors. Fix every error yourself.
- `build/app/README.md` in English: how to run it, how to log in (demo accounts from the seed), what's missing for production (Paysera keys, domain, hosting, WhatsApp API), production costs.

## When you're done
1. Create `READY-FOR-AUDIT.md` in the root (`F:\claude\work\kosovo-business\`) with: what you built, how to run it, demo accounts, what's not done.
2. Write 3 lines to `opus/PROGRESS.md`.
