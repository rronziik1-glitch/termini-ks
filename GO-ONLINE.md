# GO ONLINE: Termini + Faqja Gati, step by step

For Roni. Simple English, no programming needed. The app that goes online is **`F:\TERMINI\build\app-v5`**.

**How it works:** the app is finished and waiting. Going online means opening 7 accounts, copying a few values from each, and pasting them into one place (Vercel → Settings → Environment Variables). Each value has a name in CAPITALS, like `APP_URL`. That name is the "box" you paste it into.

**Three rules**
1. Never paste a real key into a file inside `F:\TERMINI`. Real keys go only into Vercel (or into `.env` on your own computer).
2. Do the steps in order. After every step there is a "Check it works".
3. If the site does not start, Vercel's log tells you exactly which box is empty (the app refuses to start and prints a numbered list).

**You can ask Claude Code to help.** Claude can run the commands on your computer, but Claude must not create accounts or type passwords for you. You open the accounts, you paste the keys.

**Honest note before you start.** Everything was tested on this computer (98 automatic tests, a full build, a trial run with the launch password and subdomains). The connections to the real services below (PostgreSQL, Vercel storage, SMS, WhatsApp, Paysera) were written from each company's documentation but **could not be tried for real, because the accounts do not exist yet**. That is why every step ends with a check. If a check fails, copy the error from Vercel's log to Claude.

---

## The whole picture

| # | Account | What it is for | Cost per month | Needed for launch? |
|---|---|---|---|---|
| 1 | Domain | Your address, e.g. `termini.app` | about €1–2 (paid yearly, €12–20) | Yes |
| 2 | Vercel | The computer that runs the app | €0 to try, **$20 for a business** | Yes |
| 3 | Neon (or Supabase) | The database (bookings, businesses) | €0 at the start | Yes |
| 4 | Vercel Blob | Where uploaded photos are kept | €0 at the start | Yes |
| 5 | SMS or WhatsApp | Sends the 6-digit login code | pay per message, about €0.03–0.25 each | Yes |
| 6 | Paysera | Card payments for the €100 page | no monthly fee, a % per payment | No (bank transfer and cash work without it) |
| 7 | Anthropic | The AI that writes the page texts | pay per page, about €0.10–0.50 | No (a simple built-in writer works without it) |

Prices change. Look at each company's price page before you pay. The numbers here are rough guides, not promises.

Things only you can do, which may take days: a **registered business / company number** is needed for Paysera, and usually for WhatsApp and for an SMS sender name. You can put the site online **privately** (steps 1–5 with the launch password) before that, and add Paysera later.

---

## Before you start: two values you make yourself

Open a terminal in `F:\TERMINI\build\app-v5` (or ask Claude to run these).

**A. `APP_SECRET`** (a long random text that protects logins)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the line it prints. Keep it in your password manager. Never change it later (everyone would be logged out).

**B. `ADMIN_PASSWORD_HASH`** (the second lock on the admin page)

```bash
npm run admin:password
```

Type a password you will remember. It prints one long line starting with `scrypt$`. Copy that whole line.

---

## 1. Domain

1. **What it is:** the address people type.
2. **Where:** any domain seller, for example https://www.namecheap.com or https://porkbun.com . (Buying it inside Vercel also works and saves step 2.5.)
3. **Cost:** about €12–20 per year for `.app` or `.com`.
4. **What to buy:** one domain for everything is enough (example `termini.app`). Customer pages then live at `termini.app/p/berberi-arti`. If you also want pretty addresses like `berberi-arti.faqjagati.com`, buy a second domain (`faqjagati.com`). You can add that later.
5. **Values for later:**
   - `APP_URL` = `https://` + your domain, no slash at the end. Example: `https://termini.app`
   - `PUBLIC_LINK_HOST` = the domain alone. Example: `termini.app`
   - `PAGES_DOMAIN` = the pages domain alone (example `faqjagati.com`), **or leave it empty**.
6. **Check it works:** you can log in at the seller and see the domain in your list. It will not open a site yet.

> **DONE: your domain is `terminiks.com`.** Bought at Namecheap on 16 Nov 2026 (order 219705737), $12.28 for the first year, auto-renew on (about $15.98 per year after that), free Domain Privacy on. Click the verification email from Namecheap if you have not yet.
>
> Your values:
> - `APP_URL` = `https://terminiks.com`
> - `PUBLIC_LINK_HOST` = `terminiks.com`
> - `PAGES_DOMAIN` = **leave empty at first** → customer pages live at `terminiks.com/p/berberi-arti`. Later you can set it to `terminiks.com` → pages also open at `berberi-arti.terminiks.com` (the app keeps `www`, `app`, `api`, `admin` and similar names for itself). For that you need the nameservers option in step 2.5 plus the wildcard domain `*.terminiks.com` in Vercel.
>
> **At Namecheap, change nothing until step 2.5.** Then: Namecheap → Domain List → `terminiks.com` → Manage → Nameservers → "Custom DNS" → paste the two nameservers Vercel shows you (they look like `ns1.vercel-dns.com`, `ns2.vercel-dns.com`) → green tick to save. In Vercel also add `www.terminiks.com` so both addresses work.

---

## 2. Vercel (hosting)

1. **What it is:** the service that runs the app on the internet.
2. **Where:** https://vercel.com → Sign up.
3. **Cost:** the free "Hobby" plan is for personal, non-commercial use. Use it to try things. **For a real business Vercel asks for the Pro plan, $20 per month.** Switch to Pro before you take money from customers.
4. **Put the app on Vercel.** In a terminal in `F:\TERMINI\build\app-v5`:

   ```bash
   npx vercel login
   ```

   ```bash
   npx vercel link
   ```

   Answer the questions: create a **new project**, name it `termini`. Do not deploy yet: the app needs its settings first (steps 3–5).
5. **Connect the domain:** Vercel → your project → Settings → Domains → add your domain. Vercel shows what to change at the domain seller (either "nameservers" or two "records"). **Choose the nameservers option** if you want `name.faqjagati.com` addresses: only then can you add `*.faqjagati.com` (a "wildcard" domain) in the same Domains screen.
6. **Where every value goes from now on:** Vercel → project → **Settings → Environment Variables**. For each value: Name = the CAPITAL name, Value = what you copied, tick "Production", Save.
7. **Paste now:** `APP_URL`, `PUBLIC_LINK_HOST`, `APP_SECRET` (from "Before you start"), `ADMIN_PASSWORD_HASH`, and:
   - `ADMIN_PHONES` = your own mobile number with +383, example `+38349123456`
   - `SUPPORT_WHATSAPP` = your support WhatsApp number, digits only, example `38349123456`
   - `SUPPORT_NAME` = `Termini`
   - `SITE_PASSWORD` = a password for the private launch, example `hapu-2026` (step 8 explains it)
8. **Check it works:** the domain shows "Valid Configuration" in Vercel → Settings → Domains (this can take up to a day after changing nameservers).

---

## 3. Database: Neon

1. **What it is:** where bookings, businesses and pages are saved (PostgreSQL).
2. **Where:** https://neon.tech → Sign up → Create project. Name `termini`, region **Europe (Frankfurt)**.
   (Supabase, https://supabase.com , works the same way. Use one, not both. Note: a free Supabase project goes to sleep after a week without visitors.)
3. **Cost:** €0 on the free plan (enough for the first months). Paid plans start around $5–19 per month when you outgrow it.
4. **Copy two values:** in Neon → your project → **Connect**:
   - With "Connection pooling" **on**: copy the text starting with `postgresql://` → paste into **`DATABASE_URL`**
   - With "Connection pooling" **off**: copy the text → paste into **`DIRECT_URL`**
5. **You do not create tables yourself.** Every time the app is deployed it creates or updates the tables and saves the default services for each business type.
6. **Check it works:** after the first deploy (step 8), Neon → Tables shows about 19 tables (`User`, `Business`, `Booking`, `Page` …) and the table `CategoryPreset` has 9 rows.

---

## 4. Photo storage: Vercel Blob

1. **What it is:** where the photos that businesses upload are kept. (Vercel's own disk forgets files, so photos need this.)
2. **Where:** Vercel → your project → **Storage** tab → Create → **Blob** → name `termini-photos` → connect it to the project.
3. **Cost:** a free amount is included (about 1 GB on Hobby, more on Pro). After that you pay per GB, a few cents.
4. **Values:**
   - Vercel adds **`BLOB_READ_WRITE_TOKEN`** to the project by itself. Check it is in the Environment Variables list.
   - You add **`STORAGE_DRIVER`** = `vercel-blob`
5. **Other choices** (only if you prefer them): `STORAGE_DRIVER=supabase` with `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `STORAGE_BUCKET` (a **private** bucket), or `STORAGE_DRIVER=s3` with `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (Cloudflare R2, Backblaze). All are explained in `.env.example`.
6. **Check it works:** after the first deploy, start a Faqja Gati page at `/faqja/krijo` and upload one photo. The photo must appear in the preview, and Vercel → Storage → your Blob store must show files in a folder `pages/`.

---

## 5. Login codes: SMS or WhatsApp

> **Good to know (v4):** codes are sent only to Kosovo (+383) and Albania (+355) numbers, so strangers cannot make the site send expensive SMS abroad. To allow more countries set `OTP_ALLOWED_PREFIXES`, for example `+383,+355,+41,+49`. `OTP_DAILY_CAP` (default 1000) is the most codes per day for the whole site.

Owners log in with their phone number and a 6-digit code. Somebody has to deliver that code. Choose **one**.

### Option A: SMS (simplest to start)

1. **What it is:** a company that sends the SMS for you.
2. **Where:** https://www.twilio.com or https://www.infobip.com (Infobip is strong in the Balkans). Any other SMS company with an "HTTP API" also works.
3. **Cost:** no monthly fee, you pay per SMS. To Kosovo numbers expect roughly €0.05–0.25 each: **check the price for Kosovo (+383) before choosing.** A trial account can usually only send to your own number.
4. **Values for Twilio:**
   - `OTP_PROVIDER` = `sms`
   - `SMS_STYLE` = `twilio`
   - `SMS_ACCOUNT_ID` = the "Account SID" (Twilio Console, first page)
   - `SMS_API_KEY` = the "Auth Token" (same page)
   - `SMS_FROM` = your Twilio phone number with +, or an approved sender name like `Termini`
5. **Values for Infobip:**
   - `OTP_PROVIDER` = `sms`
   - `SMS_STYLE` = `infobip`
   - `SMS_API_URL` = your "Base URL", example `https://abc123.api.infobip.com`
   - `SMS_API_KEY` = an API key you create in Infobip
   - `SMS_FROM` = your sender name or number
6. **Any other SMS company:** `SMS_STYLE` = `generic`, then `SMS_API_URL`, `SMS_API_HEADERS`, `SMS_API_BODY` (see `.env.example`; give the company's API page to Claude and ask for the three values).

### Option B: WhatsApp

1. **What it is:** the code arrives as a WhatsApp message. Cheaper per message and everyone in Kosovo has WhatsApp.
2. **Where:** https://developers.facebook.com → Create app → add "WhatsApp". You need a **Meta Business account**, a phone number that is not already used in the WhatsApp app, and business verification (documents). This can take days.
3. **Cost:** no monthly fee; "authentication" messages cost a few cents each (see Meta's price list for your country).
4. **In Meta:** create a message template of type **Authentication**, name `login_code`, language Albanian, and wait until it is approved.
5. **Values:**
   - `OTP_PROVIDER` = `whatsapp`
   - `WHATSAPP_API_TOKEN` = a **permanent** access token (System User token, not the 24-hour test token)
   - `WHATSAPP_PHONE_NUMBER_ID` = the "Phone number ID" (API Setup page)
   - `WHATSAPP_OTP_TEMPLATE` = `login_code`, `WHATSAPP_OTP_LANG` = `sq`

### Check it works (both options)

After the first deploy open `/hyr`, type **your own** number, press continue. The code must arrive on your phone within a few seconds, and it must **not** appear on the screen. If the screen says "S'e dërguam dot kodin", open Vercel → Logs and search for `otp.failed`: the line shows the company's answer.

---

## 6. Paysera (card payments) – can wait

Without Paysera the app still sells pages: the customer chooses bank transfer or cash, and you mark it paid in `/admin`. Add Paysera when your business is registered.

1. **What it is:** the payment company that works for Kosovo (Stripe and PayPal do not).
2. **Where:** https://www.paysera.com → open a **business** account → "Projects and Activities" → create a project for your website → turn on "Payment collection via e-banking and other systems".
3. **Cost:** no monthly fee for the service itself; Paysera keeps a percentage of each payment. See their price list.
4. **Bank details shown to customers** (needed even without Paysera):
   - `BANK_IBAN`, `BANK_NAME`, `BANK_HOLDER` = your real business account
   - `PAGE_PRICE_CENTS` = `10000` (that is €100)
5. **Paysera values** (Project → Project settings / General settings):
   - `PAYSERA_PROJECT_ID` = the project number
   - `PAYSERA_SIGN_PASSWORD` = the "sign password" / project password
   - `PAYSERA_PUBLIC_KEY` = open https://www.paysera.com/download/public.key , copy everything including the BEGIN and END lines, paste it as it is
   - `PAYSERA_TEST` = `1` for now
   - `PAYSERA_VERIFY_CODE` = Paysera asks you to prove the site is yours with a "meta tag". Copy only the code inside it and paste it here. **You do not need to remove the launch password for this:** while `PAYSERA_VERIFY_CODE` has a value, the home page alone opens without the password, so Paysera can see the code. Redeploy after pasting it. When Paysera confirms, empty `PAYSERA_VERIFY_CODE` and redeploy, and the home page is private again.
6. **You do not type any address into Paysera.** The app sends Paysera its own callback address with every payment: `APP_URL/api/payments/paysera/callback`. This address keeps working while the launch password is on.

### Test-payment checklist

Do this once with `PAYSERA_TEST=1`, then again on launch day with real money.

1. Redeploy after pasting the values. Open `/faqja/krijo`, build a test page, press "Merre për 100 €".
2. The payment screen must show **Paysera** as a normal option (not "së shpejti"). If it says "së shpejti", `PAYSERA_PROJECT_ID` or `PAYSERA_SIGN_PASSWORD` is empty.
3. Choose Paysera. You must land on Paysera's page with the right amount (100.00 EUR) and your project name.
4. Finish the test payment. You must come back to your page at `/faqja/...`.
5. Within a minute the page must change to **live** without you doing anything. That proves Paysera's callback reached the app.
6. Vercel → Logs → search `paysera.callback`. You must see a line with `"ok":true,"paid":true`.
   - `"ok":false` → the sign password or the public key is wrong.
   - No line at all → Paysera could not reach the site (wrong `APP_URL`, or the project is not active yet).
7. `/admin` must show the page as paid with method "paysera".
8. Open the live page. No watermark, the buttons work.
9. Press cancel once on Paysera's page too: you must come back to the payment step, and the page must **not** be live.
10. On launch day set `PAYSERA_TEST` = `0`, redeploy, and repeat with a real card (see the launch checklist). A test payment is never accepted as real money once `PAYSERA_TEST` is `0`.

---

## 7. Anthropic API key (the AI writer) – can wait

1. **What it is:** Claude writes the texts of each Faqja Gati page from what the owner typed. Without a key, a simple built-in writer is used (it only rearranges the owner's own sentences).
2. **Where:** https://console.anthropic.com → sign up → Billing: add credit (start with $10) → API Keys → Create key. This is **separate** from your personal Claude subscription; do not use the personal account for the app.
3. **Cost:** you pay only for use, roughly €0.10–0.50 per page. In the console set a **monthly spend limit** (for example $20).
4. **Values:**
   - `ANTHROPIC_API_KEY` = the key (starts with `sk-ant-`). You can see it only once: copy it straight into Vercel.
   - `FG_DAILY_CAP` = `200` (the most pages per day for all users together; lower it if you want a tighter limit)
5. **Check it works:** build a page at `/faqja/krijo` from two plain sentences. With the key, the page gets a written headline and a flowing "about" text. Vercel → Logs shows no error, and the Anthropic console → Usage shows a small amount.

---

## 8. First deploy, privately

1. Make sure these are in Vercel → Environment Variables (Production):

   | Must be there | From step |
   |---|---|
   | `APP_URL`, `PUBLIC_LINK_HOST`, `APP_SECRET`, `ADMIN_PHONES`, `ADMIN_PASSWORD_HASH`, `SUPPORT_WHATSAPP`, `SITE_PASSWORD` | 2 |
   | `DATABASE_URL`, `DIRECT_URL` | 3 |
   | `STORAGE_DRIVER`, `BLOB_READ_WRITE_TOKEN` | 4 |
   | `OTP_PROVIDER` and its keys | 5 |
   | `BANK_IBAN`, `BANK_NAME`, `BANK_HOLDER` | 6 |

2. Optional self-check on your computer. Put the same values in `F:\TERMINI\build\app-v5\.env` and run:

   ```bash
   npm run env:check -- vercel
   ```

   It lists what is missing. (Then remove the real keys from `.env` again if other people use this computer.)
3. Deploy:

   ```bash
   npx vercel --prod
   ```

   The first build takes 2–4 minutes. It also creates the database tables.
4. **If the site shows an error instead of opening:** Vercel → project → Logs. Look for the box titled "Termini cannot start: some settings are missing". It lists the exact names to fix. Fix them, then deploy again.
5. Open your domain. You must see a dark page "Së shpejti" asking for a password. Type your `SITE_PASSWORD`. Now you see the real site; everyone else sees only the password page. Search engines are told to stay away while the password is on.
6. Go through the checks of steps 3, 4 and 5 above.
7. Test like a customer, **on your phone**:
   - `/fillo` → register a test business with your own number → you get a booking link.
   - Open the booking link in a private browser window → you are asked for the launch password once → book a time → the booking appears in `/app`.
   - `/faqja/krijo` → build a page with 3 photos → preview with watermark → choose bank transfer → open `/admin` (your admin number, then your admin password) → "Shëno të paguar" → the page is live at `APP_URL/p/<name>`.
8. If you set `PAGES_DOMAIN` and added the wildcard domain in Vercel: the same page must open at `https://<name>.<PAGES_DOMAIN>`.

---

## 9. Things to know (limits, said plainly)

1. **Not tried with real accounts.** PostgreSQL, Vercel Blob, SMS, WhatsApp and Paysera were built from the companies' documentation and checked with automatic tests, but never against the real services. Steps 3–6 each end with a check for exactly this reason.
2. **Login-attempt limits are approximate on Vercel.** The app counts attempts in memory; Vercel can run several copies of the app, each with its own count. Fine for a start. When traffic grows, ask Claude to move the limits to "Upstash Redis".
3. **A customer's own domain** (`berberiarti.com` instead of `berberi-arti.faqjagati.com`) is prepared in the app, but each such domain has to be added by hand in Vercel → Settings → Domains, and the customer has to point the domain to Vercel.
4. **Reminders** are still WhatsApp links that the owner taps. Automatic reminders are not built yet.
5. **Backups:** Neon keeps a short history on the free plan (about a day). Before real customers depend on it, look at Neon's backup options or a paid plan.
6. **Updates later:** change the code in a new version folder, run `npm test`, then `npx vercel --prod` again. Database changes are applied by the deploy.

---

## Launch day checklist

Do these in order, on the day you open to the public.

1. [ ] Vercel plan is **Pro** (you are now taking money).
2. [ ] `npm run env:check -- vercel` (or the Vercel log after a deploy) shows no "MISSING" lines.
3. [ ] `OTP_PROVIDER` is `sms` or `whatsapp`, and `DEMO_SHOW_CODES_IN_PRODUCTION` is **not** set (the app refuses to start if it is still `1` when you remove `SITE_PASSWORD`). Set `PAYSERA_TEST` = `0` in the same step, for the same reason. Log in with your own number: the code comes to the phone, not the screen.
4. [ ] `BANK_IBAN`, `BANK_NAME`, `BANK_HOLDER` are your real account (not `XK05 0000 …`).
5. [ ] Paysera: set `PAYSERA_TEST` = `0` and redeploy. **Pay €1 with a real card**: for this one test set `PAGE_PRICE_CENTS` = `100`, redeploy, pay for a test page, see it go live by itself and see the €1 arrive in Paysera. Then set `PAGE_PRICE_CENTS` back to `10000`, redeploy, and check the payment screen says 100 €. Refund the €1 to yourself in Paysera if you like.
6. [ ] **Test a booking from a phone** that has never opened the site (ask a friend): open a real business link, pick a time, get the confirmation, and see it in that business's `/app` calendar. Cancel it from the customer's link and see it disappear.
7. [ ] Build one Faqja Gati page from a phone with real photos, from start to the watermarked preview.
8. [ ] `/admin` opens only with your admin phone **and** the admin password.
9. [ ] Delete the test businesses, test bookings and test pages you made (in `/admin` and in the owner's settings → delete account).
10. [ ] **Remove `SITE_PASSWORD`**: Vercel → Environment Variables → delete it (or empty it) → `npx vercel --prod`. Open the site in a private window: no password page.
11. [ ] Open `https://your-domain/robots.txt`: it must now say `Allow: /` and show a sitemap line. Open `/sitemap.xml`: it lists your public pages.
12. [ ] Open `https://your-domain/nje-faqe-qe-nuk-ekziston`: you see the Albanian "Kjo faqe nuk ekziston" page, not an English error.
13. [ ] Watch Vercel → Logs for the first hour. Lines with `"level":"error"` are the ones to copy to Claude.

When all 13 are ticked, post the first reel.


## v5 note: Faqja Gati switch
`FAQJA_GATI_ENABLED` stays empty (off) for the Termini launch. Set it to `1` in Vercel when Faqja Gati opens (April/May 2027).
