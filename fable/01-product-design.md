# 01 · Product design: Termini + Faqja Gati

Fable 5.2, 2026-11-13. Source of truth for Opus's build. UI copy is Albanian (Kosovo); everything else English.
Related files: `02-design-system.md`, `design-tokens.css`, `templates/schema.json`, `termini-ui/*.html`.

---

## 1. Honest review: the 5 biggest risks

| # | Risk | Why it is real | How the design reduces it |
|---|---|---|---|
| 1 | **Businesses sign up but customers keep calling/DMing.** The link sits in a bio and nothing changes. | Habit. A barber's customers have his number. A booking tool with 2 bookings a week is dead. | The product must be useful **with zero online bookings**: the owner adds phone/walk-in bookings himself in 2 taps ("+ Termin"), so the calendar becomes his notebook from day 1. Every manual booking can send the customer a WhatsApp confirmation containing the link, which teaches customers to book there next time. Onboarding ends with "share your link" (WhatsApp status, IG bio, printed QR for the mirror). |
| 2 | **No-shows and fake bookings** with no account and no payment. One prank week and the barber deletes the app. | Booking needs only a name and a phone. | Phone is mandatory and normalised; limits per phone and per IP; the owner sees "klient i ri" vs "5 vizita" on every booking; one tap to block a number; no-show is recorded per phone and shown next time. The confirmation step asks the customer to send a WhatsApp message to the business, which proves the number is real and costs nothing. Deposits come later. |
| 3 | **The €100 page disappoints** because the business's own photos are bad or the AI writes generic text. | Templates only look premium with good photos; phone photos of a dark shop do not. | Templates are designed to look finished with **few or no photos** (type-led layouts, tonal image slots, a strict crop and a colour grade applied in CSS). The AI is forbidden from inventing facts; missing sections are removed, never padded. Photo upgrade (Roni, Higgsfield) is part of the €100, done before the page goes live. |
| 4 | **Preview is the product.** If the preview can be saved, nobody pays. | HTML can always be copied by someone who knows how. | Accept it and make copying worthless: the preview is rendered on the server, images are low-resolution with the watermark burned into the pixels, links and phone numbers are removed from the markup (not just hidden), the URL expires. What €100 buys is hosting, domain, full-quality photos, working buttons, the Termini booking link and edits. See §6.3. |
| 5 | **Payment friction and trust.** 72% cash, no Stripe, a stranger asking €100 online. | Card checkout will lose most buyers. | Three ways to pay shown as equals: Paysera, bank transfer, cash to Roni/THAT AD. The page goes live as soon as an admin marks it paid. Trust comes from showing the finished page first, a real name and phone number on the payment screen, and "pay once, yours forever" stated plainly with what "forever" includes (§6.5). |

Two smaller ones worth knowing: **`.ks` is not a real domain ending** (Kosovo has no country TLD), so `termini.ks` cannot be registered; and **"free forever" has a running cost** (SMS/WhatsApp API messages), which is why automatic reminders are the first paid extra and the free tier uses click-to-chat links only.

---

## 2. Brand

### 2.1 Names

**Booking product**

| Option | Notes |
|---|---|
| **Termini** (recommended) | The word every Kosovar already uses ("e kam një termin"). Works as a noun in the viral line "Rezervuar përmes Termini". |
| Radha | "Radha jote" (your turn). Warm, but sounds like a queue, which is the thing we remove. |
| Orari | Clear, but means timetable/opening hours; weaker for the act of booking. |

**Page product**

| Option | Notes |
|---|---|
| **Faqja Gati** (recommended) | Says the promise: the page is ready. Easy to say in a reel. |
| Vitrina | Nice metaphor (shop window), good for shops, weaker for clinics. |
| Faqja Ime | Ownership angle ("my page"), but generic and hard to own as a name. |

### 2.2 One umbrella or two brands?

**Recommendation: one company brand, Termini, with Faqja Gati as a product under it ("Faqja Gati nga Termini").**

- The business owner gets **one account**: the same login manages the calendar and the page.
- Every Faqja Gati page carries a "Rezervo termin" button powered by Termini, so the brands meet anyway.
- Customers only ever need to remember one name. Faqja Gati is sold to owners, who are a small audience reached in person and by reels.
- One design system, one domain to trust, one Instagram account.

### 2.3 Domains

Not verified from this machine (network checks were not available). Check at a registrar before printing anything.

| Use | First choice | Fallbacks |
|---|---|---|
| Termini app + booking links | `termini.app` → `termini.app/berberi-arti` | `termini.co`, `etermini.com`, `termini-ks.com` |
| Faqja Gati marketing + subdomains | `faqjagati.com` → `arti.faqjagati.com` | `faqjagati.app` |

Path-style booking links (`termini.app/berberi-arti`) are shorter to say aloud and to type into an Instagram bio than subdomains. In local dev Opus uses `/b/<slug>`; production maps `/<slug>` to the same route (reserved words in §7.4).

### 2.4 Taglines (Albanian)

- **Termini (customers):** "Rezervo terminin në 20 sekonda."
- **Termini (businesses):** "Më pak thirrje. Më shumë klientë."
- **Faqja Gati:** "Faqja e biznesit tënd, gati në 2 minuta."
- **Viral line on every confirmation:** "Rezervuar përmes Termini"

### 2.5 Tone of voice

- **"Ti", never "Ju"** in the product. Friendly, direct, like a capable friend. (Sales DMs to owners may use "Ju".)
- **Short verbs first:** "Zgjidh orën", "Konfirmo", "Shto shërbim". No "Ju lutemi", no "me sukses".
- **Standard written Albanian with ë and ç**, words Kosovars actually use: *termin, qethje, orari, lokali, klient*. No Gheg spellings in the UI, no English ("booking", "slot") and no Serbian or Turkish loanwords where a common Albanian word exists.
- **Numbers are concrete:** "5 €", "30 min", "sot në 15:30". Price format is `5 €` (number, space, sign). Time is 24-hour, `15:30`.
- **Errors say what to do:** "Kjo orë sapo u zu. Zgjidh një tjetër." Never "Gabim 409".
- **No exclamation marks** except one on the success screen.

---

## 3. Termini: customer side

Whole flow is one page, three steps, no account. Target: 20 seconds, 5 taps plus typing a name and number. Mock-ups: `termini-ui/booking.html`, `termini-ui/confirmation.html`.

### 3.1 Booking page `/{slug}`

**Header (always visible):** business photo or initial, name, category and city ("Berber · Gjakovë"), open state ("Hapur deri në 20:00" / "Mbyllur · hapet nesër në 09:00"), address link to maps.

**Step 1 · Shërbimi.** List of services: name, duration, price. Tap selects and moves on. If the business has one service, this step is skipped. If it has more than one staff member, a second row appears after the service: "Kushdo që është i lirë" (default) and one chip per person.

**Step 2 · Ora.** Horizontal day strip (14 days; "Sot", "Nesër", then "Pre 14"). Days with no free time are dimmed and show "plot". Under it, free times in a grid, grouped "Paradite", "Pasdite", "Mbrëmje". Tap a time to select.

**Step 3 · Të dhënat.** Emri, numri i telefonit (prefilled with `+383`, numeric keyboard), optional "Shënim për {biznesi}". Name and phone are remembered on the device for next time. Summary line above the button: "Qethje · e premte 14 nëntor · 15:30 · 5 €". Button: **"Konfirmo terminin"**. Small text under it: "Pagesa bëhet në lokal."

A bottom bar holds the summary and primary button from step 2 onward, so the action is always under the thumb.

### 3.2 Confirmation `/{slug}/t/{token}`

- Animated check, "Termini u rezervua!"
- Card: service, date and time, business, address, price.
- Primary: **"Dërgo konfirmimin në WhatsApp"** (opens a chat with the business, message prefilled, §3.5). This is how the business gets notified for free and how the phone number is proven.
- Secondary: "Shto në kalendar" (.ics), "Si të vij" (maps).
- Text link: "Anulo terminin" → bottom sheet "A je i sigurt?" → "Po, anulo" / "Jo, mbaje".
- Footer: "Rezervuar përmes Termini · Ke biznes? Merre linkun tënd falas."

The same URL is the customer's permanent view of the booking (status changes to "Anuluar" or "Përfunduar").

### 3.3 Empty states

| Where | Text |
|---|---|
| Day has no free times | "Asnjë orë e lirë këtë ditë." + button "Shiko {dita e parë e lirë}" |
| Nothing free in 14 days | "Jemi plot për dy javët e ardhshme. Na shkruaj në WhatsApp." + WhatsApp button |
| Business has no services yet | "Ky biznes ende s'ka shtuar shërbime." |
| Business paused bookings | "{Biznesi} nuk pranon rezervime online tani. Thirr në {telefoni}." |
| Slug not found | "Kjo faqe nuk ekziston. Kontrollo linkun." + "Kërko një biznes" |

### 3.4 Errors

| Case | Text | Behaviour |
|---|---|---|
| Time taken while the form was open | "Kjo orë sapo u zu. Zgjidh një tjetër." | Return to step 2, refresh times, keep name and phone |
| Invalid phone | "Shkruaj një numër të vlefshëm, p.sh. 044 123 456." | Inline under the field |
| Name missing | "Shkruaj emrin." | Inline |
| Too many bookings from this phone | "Ke tashmë 3 termine aktive këtu. Anulo një për të rezervuar tjetër." | Inline above the button |
| Rate limited | "Shumë tentime. Provo përsëri pas pak minutash." | Toast |
| Number blocked by the owner | "Rezervimi online s'është i mundur për këtë numër. Thirr në lokal." | Inline |
| Offline | "S'ka internet. Kontrollo lidhjen." | Toast, button stays enabled for retry |
| Cancel too late (inside the business's cut-off) | "Termini është për më pak se {n} orë. Thirr në {telefoni} për ta anuluar." | In the sheet |

### 3.5 WhatsApp messages (Albanian, exact text)

Variables in `{}`. Dates are written as "e premte, 14 nëntor". All are `https://wa.me/{number}?text={urlencoded}` links at the start; the same texts become API templates later.

**A. Customer → business, after booking (button on the confirmation screen)**
```
Përshëndetje! Sapo rezervova termin:
{sherbimi}, {data}, ora {ora}
Emri: {emri}
{link_termini}
```

**B. Business → customer, confirming a booking the owner added by hand**
```
Përshëndetje {emri}! Termini yt te {biznesi}:
{sherbimi}, {data}, ora {ora}
Herën tjetër rezervo vetë këtu: {link_biznesi}
```

**C. Business → customer, reminder (one tap in the calendar; automatic in the paid extra)**
```
Përshëndetje {emri}! Të kujtojmë terminin sot në {ora} te {biznesi}.
Nëse s'mund të vish, anuloje këtu: {link_termini}
Rezervuar përmes Termini
```
For a reminder sent the day before, "sot" becomes "nesër".

**D. Business → customer, cancelled by the business**
```
Përshëndetje {emri}. Na vjen keq, termini yt {data} në {ora} te {biznesi} u anulua.
Zgjidh një orë tjetër këtu: {link_biznesi}
```

**E. Business → customer, after a no-show (optional, owner taps it)**
```
Përshëndetje {emri}. Sot të pritëm në {ora} dhe nuk erdhe. Nëse do një termin tjetër: {link_biznesi}
```

**F. Owner shares the link (onboarding, WhatsApp status / groups)**
```
Tani mund të rezervosh termin te {biznesi} online, pa thirrur: {link_biznesi}
```

Opus's launch plan has an older reminder text; use C above (it uses "ti" and handles same-day reminders).

### 3.6 "Gjej" page (later; simple version in MVP) `/gjej`

- Top: city selector (Gjakovë, Prishtinë, Prizren, Pejë, …) and category chips (Berber, Sallon, Dentist, Klinikë, Tjetër).
- List of business cards: photo, name, area, **next free time** ("Sot 16:30", "Nesër 09:00"), starting price. Sorted by soonest free time. Tap opens the booking page with that day preselected.
- Empty: "Ende s'ka biznese në {qyteti}. Ke biznes? Shtoje falas."
- Later: "Afër meje" (location permission asked only on tap), featured placement marked "I sponsorizuar".

---

## 4. Termini: business side

Mock-ups: `termini-ui/onboarding.html`, `termini-ui/calendar.html`, `termini-ui/services.html`, `termini-ui/settings.html` (all listed in `termini-ui/index.html`). Mobile-first; on desktop the same screens sit in a centred 480px column, with the calendar allowed to widen to a week view.

### 4.1 Onboarding: 2 minutes, 4 steps

Starts from "Merre linkun tënd falas". Progress shown as 4 segments. Nothing is asked that has a sensible default.

| Step | Screen | Fields | Defaults that save time |
|---|---|---|---|
| 1 | **Biznesi yt** | Emri i biznesit; Lloji (chips: Berber, Sallon bukurie, Dentist, Klinikë, Tjetër); Qyteti (select) | Slug generated live from the name and shown: "termini.app/**berberi-arti**" (editable) |
| 2 | **Shërbimet** | List prefilled from the category with typical services, durations and prices; each row editable inline (emri, min, €); toggle off what they don't offer; "+ Shto shërbim" | Berber: Qethje 30 min 5 €, Qethje + mjekër 45 min 7 €, Mjekër 15 min 3 €, Qethje për fëmijë 20 min 4 € |
| 3 | **Orari** | One row per day with on/off and from/to; "Kopjo në të gjitha ditët"; optional pause | Hën–Sht 09:00–20:00, E diel mbyllur |
| 4 | **Numri yt** | Numri i telefonit (this is the login and the WhatsApp number); code by SMS (in dev the code is shown on screen); Emri yt | None |

Then **"Gati! Ky është linku yt"**: the link in large type, buttons "Kopjo linkun", "Ndaje në WhatsApp" (message F), "Shkarko QR-kodin" (print for the mirror), and "Shiko si e sheh klienti". A three-item checklist stays on the calendar until done: put the link in the Instagram bio, add your first booking, add a photo.

Phone verification is last on purpose: by then the owner has built something and will not abandon it. Steps 1–3 are saved in local storage, so a closed tab loses nothing.

Default prefilled services per category live in a seed file (`category_presets`), not in code.

### 4.2 Daily calendar (home) `/app`

- Top: date with arrows and a 7-day strip showing a dot per booked day; "Sot" button.
- Summary line: "6 termine · 34 €" and the next one: "I radhës: Dren K. në 15:30".
- Vertical timeline from opening to closing, 15-minute grid, a red "now" line. Booking blocks show time, customer name, service; a small badge for "i ri" (first visit) and for a customer with past no-shows.
- Tap a booking → bottom sheet: customer name, phone (tap to call), service, price, note, visits so far. Actions: "Dërgo kujtesë" (WhatsApp C), "Erdhi", "S'erdhi", "Zhvendos", "Anulo".
- Tap an empty time or the floating **"+ Termin"** → sheet: service, time (prefilled), customer name, phone (optional for walk-ins, suggestions from past customers) → "Ruaj" → offer "Dërgo konfirmimin në WhatsApp" (message B).
- Long-press an empty time → "Blloko këtë orë" (break, personal).
- Tab bar: **Kalendari · Klientët · Shërbimet · Cilësimet**.
- With several staff: chips at the top to filter by person; desktop shows columns per person.

**Empty states**
- New account, no bookings: illustration-free card: "Ende s'ke termine. Ndaje linkun që klientët të rezervojnë vetë." + "Ndaje linkun" + "Shto një termin vetë".
- Free day: "Asnjë termin sot."
- Closed day: "Sot je mbyllur." + "Hap vetëm për sot".

### 4.3 Klientët

List built automatically from bookings: name, phone, visits, last visit, no-show count. Search by name or number. Customer detail: history, note field ("alergji, stili i preferuar"), "Blloko numrin". Empty: "Klientët shfaqen këtu pas terminit të parë."

### 4.4 Shërbimet

List with drag handle, name, duration, price, on/off. Add/edit in a bottom sheet: Emri, Kohëzgjatja (chips 15/20/30/45/60/90 + custom), Çmimi (optional; empty shows "Çmimi në lokal"; checkbox "nga" for starting prices), Përshkrimi (optional). Deleting a service with future bookings: "Ky shërbim ka 3 termine të ardhshme. Ato mbeten; shërbimi nuk shfaqet më për rezervime të reja."

### 4.5 Cilësimet

- **Orari:** weekly hours, pauses, "Ditë pushimi" (date ranges: Bajram, pushime vjetore), with public holidays suggested but never forced.
- **Rezervimet:** how far ahead (default 30 ditë), minimum notice (default 1 orë), cancel cut-off (default 2 orë), time step (15/30 min), pause online bookings (toggle).
- **Profili:** name, photo, address, map pin, Instagram, description.
- **Linku im:** copy, QR, share.
- **Stafi** (shown as "së shpejti" in MVP unless built): people and which services each does.
- **Faqja Gati:** banner "Bëje faqen e biznesit tënd në 2 minuta" → Faqja Gati flow prefilled from this business.
- **Llogaria:** phone, logout, delete account.

### 4.6 Business-side errors

| Case | Text |
|---|---|
| Wrong code | "Kodi s'është i saktë. Provo përsëri." |
| Code expired | "Kodi skadoi. Dërgo një të ri." |
| Slug taken | "Ky link është i zënë. Provo: {sugjerim}" |
| Overlapping manual booking | "Në këtë orë ke termin me {emri}. Ruaje gjithsesi?" (owner may overbook) |
| Closing a day that has bookings | "Ke {n} termine këtë ditë. Anuloji ose zhvendosi më parë." |
| Save failed | "S'u ruajt. Provo përsëri." |

---

## 5. Booking rules (precise, for the slot engine)

- **Time zone:** every business is `Europe/Belgrade` (Kosovo's zone; CET/CEST). Store `starts_at`/`ends_at` in UTC. Compute slots in local time so the DST change days work.
- **Slot generation for (business, staff, service, date):** take the working intervals of that weekday, subtract pauses, time off, blocks and existing bookings with status `confirmed`; emit start times on the business's `slot_step_min` grid where `start + duration_min + buffer_min` fits inside one free interval.
- **Filters:** drop starts earlier than `now + min_notice_min`; drop dates beyond `max_advance_days`.
- **"Any staff":** a time is free if at least one eligible staff member is free; on confirm, assign the one with the fewest bookings that day.
- **No double booking:** creating a booking is a transaction that re-checks overlap for that staff member and fails with `409 slot_taken`. On Postgres add an exclusion constraint on `(staff_id, tstzrange(starts_at, ends_at))` for `status = 'confirmed'`.
- **Customer limits:** max 3 future confirmed bookings per phone per business; max 5 booking attempts per IP per hour; hidden honeypot field; blocked phones rejected.
- **Cancel:** customers cancel with the booking token until `cancel_cutoff_min` before the start. Owners can always cancel.
- **Auto-complete:** a confirmed booking whose end is more than 2 hours in the past is shown as "Përfunduar" unless marked "S'erdhi".
- **Phone normalisation:** strip spaces and punctuation; `04x…` (9 digits) → `+3834x…`; `00…` → `+…`; accept any valid E.164 so diaspora numbers work; Albania `06x…` only when typed with `+355`.
- **Holidays:** nothing is closed automatically. A list of Kosovo public holidays and the two Bajram dates of the year is offered as one-tap suggestions in "Ditë pushimi".

---

## 6. Faqja Gati

### 6.1 Flow

| # | Screen | What happens |
|---|---|---|
| 1 | **Fillimi** `/faqja` | Headline "Faqja e biznesit tënd, gati në 2 minuta." Three example pages (the templates with demo content) to open full-screen. Button "Fillo falas". Line under it: "E sheh faqen para se të paguash." |
| 2 | **Biznesi** | Lloji (6 cards with a thumbnail of each template + "Tjetër"), Emri, Qyteti. Logged-in Termini owners skip this (prefilled). |
| 3 | **Tregona për biznesin** | One large text field with a category-specific example as placeholder: "Berber në Gjakovë, te Çarshia e Madhe. Qethje 5 €, mjekër 3 €. Hapur 9–20, të dielën mbyllur. 049 123 456. Punojmë që nga 2015." Optional field "Ke faqe të vjetër? Ngjite linkun" (note under it: "Linqet e Instagramit dhe Facebookut nuk lexohen. Ngarko fotot më poshtë."). |
| 4 | **Fotot** | Upload 0–10 photos (drag to reorder; first is the hero). Tips: "Dritë dite, pa tekst mbi foto, një foto e lokalit nga jashtë." Skip allowed: "Vazhdo pa foto" (template uses its tonal placeholders). Phone number for contact about the page. |
| 5 | **Po e ndërtojmë** | Real progress in four named stages with a live preview frame blurring in: "Po lexojmë përshkrimin" → "Po shkruajmë tekstet" → "Po rregullojmë fotot" → "Po e montojmë faqen". 1–3 minutes. If the tab is closed, the link arrives by WhatsApp click-to-chat from admin, or they can return to `/faqja/{id}`. |
| 6 | **Parapamja** `/faqja/{id}` | The page in a phone-shaped frame on desktop, full-bleed on mobile, watermarked. Sticky bar: "Kjo është faqja jote. **Merre për 100 €**". Secondary: "Ndrysho diçka" (free regeneration with a note, up to 3 times) and "Provo stil tjetër" (colour variants of the same template). |
| 7 | **Pagesa** | Summary of what €100 includes (§6.5). Three options as equal cards: **Paysera** (card/bank), **Transfer bankar** (IBAN, reference code = page id, "E kreva pagesën" button), **Para në dorë** ("Na shkruaj në WhatsApp, vijmë te ti" for the pilot cities). Address choice: free `emri.faqjagati.com` or own domain (+15 €/vit). |
| 8 | **Live** | "Faqja jote është live!" with the link, share buttons, "Vendose në Instagram bio", and the Termini link status: if they have Termini, the "Rezervo termin" button already points there; if not, "Aktivizo rezervimet online falas" starts Termini onboarding prefilled from the page content. |

Statuses of a page: `draft → generating → preview → payment_pending → paid → live` (and `failed`, `expired`).

Errors: generation failed → "Diçka shkoi keq. Po e provojmë përsëri." (one automatic retry, then "Na shkruaj në WhatsApp"); photo too large → compress on the device before upload; unsupported file → "Vetëm foto JPG, PNG ose HEIC."; old-site link unreadable → continue without it and say so: "S'e lexuam dot faqen e vjetër. Vazhduam me përshkrimin tënd."

### 6.2 How the page is made

1. **Template is chosen by rule, not by AI.** The category picked in step 2 maps 1:1 to a template (`berber`, `klinike-dentare`, `restorant-kafe`, `bujtine`, `salon-bukurie`, `dyqan`). "Tjetër" → the model returns the closest template id as part of its output (field `meta.template`), restricted to the six by the schema's enum.
2. **Inputs are assembled:** category, name, city, the free text, text extracted from the old website (fetch server-side, strip to visible text, cap at 6,000 characters), the number of uploaded photos with any captions, and the Termini slug if one exists.
3. **One model call fills the content** as JSON matching `templates/schema.json` (prompt in §6.4). The server validates against the schema; on failure it retries once with the validation errors appended; on a second failure it falls back to the deterministic filler (Opus's `lib/ai.ts` fallback) using only the form fields.
4. **Photos are assigned by the server, not the model.** The model only says how many images each section wants and writes alt text. The server maps uploads in order: first → hero, next → about, the rest → gallery (and service/product images for `dyqan` and `bujtine`). Empty slots keep the template's placeholder.
5. **Derived values are computed by code,** never by the model: WhatsApp link, `tel:` link, map link and embed, booking URL, "open now".
6. **Render.** `templates/fg.js` exposes `FG.fill(document, content)`, which uses only standard DOM methods, so the same function renders in the browser (demo) and on the server (Node with linkedom or jsdom) to produce static HTML. Published pages are static HTML + CSS + the small interaction script, with content already in the markup (good for Google and for speed).

Models: `claude-haiku-5-5` for the fill (cheap, fast, enough for structured extraction and short copy); `claude-sonnet-5-5` only on the retry or when the input includes an old website to digest. Expected cost is a few cents per page.

### 6.3 Preview protection

A browser must receive HTML to show a page, so a preview cannot be made impossible to copy. The goal is that a copied preview is not usable as a business page.

**Server side (the real protection)**
- Preview HTML is rendered on the server per request from stored content. `content.json` is never served. The route is `noindex, nofollow`, sent with `Cache-Control: no-store` and `X-Frame-Options: SAMEORIGIN`.
- **Images are preview derivatives:** at most 800px wide, JPEG quality ~55, with the watermark text composited into the pixels in a diagonal repeat. Full-quality files sit in private storage and get public URLs only after payment.
- **Contact data is removed from the markup:** every `href` becomes `#`, phone numbers are masked ("049 ••• •••"), the map iframe is replaced by a static tonal block, the booking link is absent. A copied preview has no way to reach the business.
- The preview URL contains an unguessable id and **expires after 14 days** (then: "Parapamja skadoi. Rindërtoje falas.").
- Rate limit generation: 3 pages per phone number per day, 10 per IP per day.
- Published pages are produced by a separate render path that only runs when `status` is `paid` or `live`. There is no query parameter or cookie that turns a preview into a live page; test this (Opus's "preview gating" test).

**Client side (deterrence only): `templates/preview.css` + a few lines in `fg.js`**
- Fixed full-screen watermark overlay "Faqja Gati – Preview", diagonal, repeated, above everything, not clickable through.
- All links and buttons disabled (`pointer-events: none`), text selection and image dragging off, context menu and common save/print shortcuts blocked, print stylesheet blanks the page.
- A fixed ribbon at the top: "Kjo është parapamje. Butonat aktivizohen pas pagesës."

**What is deliberately not done:** rendering the preview as a single image or video (it would lose the scroll animations that sell the page), and obfuscating the HTML (cheap to undo, costly to maintain).

### 6.4 The fill prompt

Call the model with one tool, `save_page_content`, whose `input_schema` is the content of `templates/schema.json`, and force that tool, so the reply is always schema-shaped JSON.

**System prompt**
```
You write the content for a one-page website of a small business in Kosovo.
You will receive what the owner told us. Return the page content by calling save_page_content.

LANGUAGE
- Write everything in standard Albanian as used in Kosovo, with correct ë and ç.
- Address the visitor as "ti". Warm, short, concrete. No clichés such as "cilësi e lartë",
  "eksperiencë e paharrueshme", "ne jemi pasionantë". No exclamation marks. No emoji.
- If the owner wrote in another language, still write in Albanian, unless they explicitly asked
  for another language.

TRUTH
- Use only facts given by the owner: services, prices, hours, address, phone, years, names.
- Never invent prices, reviews, awards, staff names, years of experience, or an address.
- If a fact is missing, leave that field empty or omit the optional section. An honest short
  page is better than a full invented one.
- Reviews: include only reviews the owner pasted. Otherwise return an empty reviews.items list.
- You may write: the hero title and subtitle, section titles, the about text, and one-line
  service descriptions, as long as they only restate or lightly rephrase given facts.

SHAPE
- hero.title: at most 6 words, no business name in it, no full stop at the end.
- hero.subtitle: one sentence, at most 18 words, says what it is and where.
- about.text: 2 to 4 sentences, at most 70 words.
- Service names as the owner wrote them, spelling corrected. description at most 12 words.
- Prices exactly as given, formatted "5 €" or "nga 30 €". No price given: empty string.
- Durations in minutes as a number when given; otherwise omit.
- Hours as rows like {"days": "E hënë – E shtunë", "time": "09:00 – 20:00"}; closed days
  as {"days": "E diel", "time": "Mbyllur"}.
- contact.phone in international digits only (Kosovo: 383 + number without the leading 0).
  contact.phoneDisplay as locals write it: "049 123 456".
- For every image slot write a short alt text describing what a suitable photo would show;
  leave src empty. The server assigns the photos.
- meta.template: use the template id you are given. Only when it is "auto", pick the closest of:
  berber, klinike-dentare, restorant-kafe, bujtine, salon-bukurie, dyqan.
- theme.accent: keep the template default (empty string) unless the owner named a brand colour.
```

**User message (assembled by the server)**
```
TEMPLATE: {template_id | auto}
BUSINESS NAME: {name}
CATEGORY: {category}
CITY: {city}
OWNER'S DESCRIPTION:
"""{free_text}"""
TEXT FROM THEIR OLD WEBSITE (may be empty, may contain junk; use only clear facts):
"""{old_site_text}"""
PHOTOS UPLOADED: {n}{, captions if any}
TERMINI BOOKING LINK: {url or "none"}
REVISION NOTE FROM OWNER (may be empty): """{note}"""
```

On regeneration with a note, send the previous JSON as well and ask for the same JSON with only the requested change.

### 6.5 What €100 includes (shown on the payment screen)

"Paguan një herë. Faqja është e jotja."
- Faqja live pa watermark, me butonat që punojnë
- Adresa `emri.faqjagati.com` falas, ose domeni yt (15 €/vit)
- Fotot e tua të përmirësuara
- Butoni "Rezervo termin" i lidhur me Termini
- Hosting pa pagesë mujore
- 1 ndryshim falas brenda 30 ditëve; pastaj 5 €/muaj ose 20 € për ndryshim

Define "forever" in the terms so it is a promise that can be kept: the page stays hosted for as long as the service exists, and the owner can request an export of the page as static files at any time after paying.

---

## 7. Data model

Written for SQLite via Prisma now, Postgres later. All ids are `cuid` strings; all tables have `created_at`, `updated_at`. Times are UTC ISO strings; "local time" fields are `HH:MM` strings in the business time zone. Money is integer cents in EUR.

### 7.1 Accounts and businesses

**users**: `id`, `phone` (E.164, unique), `name`, `role` (`owner` | `admin`), `last_login_at`

**login_codes**: `id`, `phone`, `code_hash`, `expires_at`, `attempts`, `consumed_at`

**sessions**: `id`, `user_id`, `token_hash`, `expires_at`

**businesses**: `id`, `owner_id` → users, `slug` (unique), `name`, `category` (`berber` | `salon` | `dentist` | `klinike` | `bujtine` | `restorant` | `dyqan` | `tjeter`), `city`, `address`, `lat`, `lng`, `phone` (E.164, public), `whatsapp` (E.164), `instagram`, `description`, `photo_url`, `timezone` (default `Europe/Belgrade`), `slot_step_min` (15), `min_notice_min` (60), `max_advance_days` (30), `cancel_cutoff_min` (120), `bookings_paused` (bool), `listed_in_find` (bool, default true), `onboarded_at`

**staff**: `id`, `business_id`, `name`, `photo_url`, `active`, `sort`. One row is created automatically for the owner; single-person businesses never see the concept.

**services**: `id`, `business_id`, `name`, `description`, `duration_min`, `buffer_min` (0), `price_cents` (nullable), `price_from` (bool), `active`, `sort`

**staff_services**: `staff_id`, `service_id` (composite key). Empty for a staff member means "does everything".

**working_hours**: `id`, `business_id`, `staff_id` (nullable = whole business), `weekday` (1 = Monday … 7 = Sunday), `start_local`, `end_local`. Several rows per day express a pause (09:00–13:00 and 14:00–20:00).

**time_off**: `id`, `business_id`, `staff_id` (nullable), `starts_at`, `ends_at`, `reason`, `kind` (`holiday` | `block`)

### 7.2 Customers and bookings

**customers**: `id`, `business_id`, `phone` (E.164, nullable for walk-ins), `name`, `note`, `visits_count`, `no_show_count`, `last_visit_at`, `blocked` (bool). Unique `(business_id, phone)`. Customers belong to a business; there is no global customer account in the MVP.

**bookings**: `id`, `business_id`, `staff_id`, `service_id`, `customer_id`, `starts_at`, `ends_at`, `status` (`confirmed` | `cancelled_customer` | `cancelled_business` | `completed` | `no_show`), `source` (`link` | `page` | `find` | `manual`), `service_name`, `price_cents` (both copied at booking time so later edits don't rewrite history), `customer_note`, `token` (unique, unguessable, for the customer's view/cancel link), `cancelled_at`, `reminder_sent_at`, `created_ip_hash`. Index `(business_id, starts_at)`, `(staff_id, starts_at)`.

**booking_events**: `id`, `booking_id`, `type` (`created` | `cancelled` | `moved` | `no_show` | `completed` | `reminder_sent` | `whatsapp_opened`), `actor` (`customer` | `owner` | `system`), `meta_json`

**category_presets** (seed): `category`, `services_json`, `hours_json`

### 7.3 Faqja Gati

**pages**: `id` (unguessable; it is the preview URL), `business_id` (nullable), `owner_user_id` (nullable), `contact_phone`, `template` (`berber` | `klinike-dentare` | `restorant-kafe` | `bujtine` | `salon-bukurie` | `dyqan`), `status` (`draft` | `generating` | `preview` | `payment_pending` | `paid` | `live` | `failed` | `expired`), `input_name`, `input_category`, `input_city`, `input_text`, `input_old_url`, `content_json` (validated against the schema), `theme_variant`, `subdomain` (unique, nullable), `custom_domain` (nullable), `revisions_used` (int), `preview_expires_at`, `published_at`, `created_ip_hash`

**page_assets**: `id`, `page_id`, `kind` (`upload` | `enhanced` | `preview`), `slot` (`hero` | `about` | `gallery` | `service` | `logo`), `sort`, `storage_key` (private), `width`, `height`, `alt`

**page_generations**: `id`, `page_id`, `model`, `input_tokens`, `output_tokens`, `cost_cents`, `ok` (bool), `error`, `revision_note`, `duration_ms`

**payments**: `id`, `page_id`, `amount_cents`, `currency` (`EUR`), `method` (`paysera` | `bank` | `cash`), `status` (`pending` | `paid` | `failed` | `refunded`), `reference` (shown to the customer for bank transfers), `provider_ref`, `marked_by_user_id` (admin who confirmed a manual payment), `paid_at`

**audit_log**: `id`, `user_id`, `action`, `target_type`, `target_id`, `meta_json` (every admin action, especially "mark paid")

### 7.4 Slugs

Lowercase, `a–z 0–9 -`, 3–40 characters; `ë → e`, `ç → c`; spaces → `-`. On collision append the city, then a number (`berberi-arti-gjakove`, `berberi-arti-2`). Reserved: `app`, `admin`, `api`, `b`, `p`, `gjej`, `faqja`, `hyr`, `regjistrohu`, `kushtet`, `privatesia`, `ndihme`, `static`, `_next`, `t`.

---

## 8. API

JSON over HTTPS. Owner routes need a session cookie (httpOnly, SameSite=Lax). Errors: `{ "error": { "code": "slot_taken", "message": "Kjo orë sapo u zu. Zgjidh një tjetër." } }` with the Albanian message ready to show. Public POST routes are rate limited per IP.

### 8.1 Public (customers)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/public/businesses/{slug}` | Profile, services, staff, open state, booking settings |
| GET | `/api/public/businesses/{slug}/days?service_id&staff_id&from&days=14` | For each date: `free_count` (drives the day strip) |
| GET | `/api/public/businesses/{slug}/slots?service_id&staff_id&date` | Free start times for one date: `["09:00","09:15",…]` |
| POST | `/api/public/businesses/{slug}/bookings` | Body: `service_id, staff_id?, date, time, name, phone, note?, source?`. Returns `{ token }`. Errors: `slot_taken` 409, `invalid_phone` 422, `too_many_active` 429, `blocked` 403, `paused` 409 |
| GET | `/api/public/bookings/{token}` | Booking for the confirmation page |
| POST | `/api/public/bookings/{token}/cancel` | Customer cancel; `too_late` 409 |
| GET | `/api/public/bookings/{token}/calendar.ics` | Calendar file |
| GET | `/api/public/find?city&category` | Businesses with `next_free` and `price_from` |

### 8.2 Auth

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/code` | Body `phone` → sends a 6-digit code (dev: returned in the response and logged) |
| POST | `/api/auth/verify` | Body `phone, code` → session cookie; creates the user if new |
| POST | `/api/auth/logout` | |
| GET | `/api/me` | User and their business |

### 8.3 Owner

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/slug-check?name` | `{ slug, available, suggestion }` |
| GET | `/api/category-presets/{category}` | Default services and hours |
| POST | `/api/business` | Create from onboarding: profile + services[] + hours[] in one call |
| PATCH | `/api/business` | Profile and booking settings |
| GET / POST | `/api/services` | List, create |
| PATCH / DELETE | `/api/services/{id}` | Edit, deactivate |
| PUT | `/api/services/order` | Body: ordered ids |
| GET / PUT | `/api/hours` | Whole week in one document |
| GET / POST / DELETE | `/api/time-off`, `/api/time-off/{id}` | Days off and blocks |
| GET | `/api/bookings?from&to` | Calendar range, includes customer summary |
| POST | `/api/bookings` | Manual booking; `force: true` allows overlap |
| PATCH | `/api/bookings/{id}` | `status` (`completed`, `no_show`, `cancelled_business`) or move (`starts_at`, `staff_id`) |
| GET | `/api/bookings/{id}/whatsapp?type=confirm\|reminder\|cancel\|noshow` | Returns the `wa.me` link and logs the event |
| GET | `/api/customers?q` | List and search |
| GET / PATCH | `/api/customers/{id}` | History; note, blocked |
| GET | `/api/stats?period=day\|week\|month` | Count, revenue estimate, no-show rate |
| GET | `/api/business/qr.svg` | QR of the booking link |

### 8.4 Faqja Gati

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/pages` | Create draft: category, name, city, text, old_url?, contact_phone → `{ id }` |
| POST | `/api/pages/{id}/assets` | Upload a photo (multipart); server makes the preview derivative |
| PUT | `/api/pages/{id}/assets/order` | Reorder |
| POST | `/api/pages/{id}/generate` | Start generation; body may carry `revision_note` or `theme_variant` |
| GET | `/api/pages/{id}/status` | `{ status, stage, progress }` for the progress screen (poll every 2 s, or SSE) |
| GET | `/faqja/{id}/preview` | Server-rendered watermarked HTML (not under `/api`; shown in an iframe) |
| POST | `/api/pages/{id}/checkout` | Body `method, subdomain \| custom_domain` → Paysera redirect URL, or bank details + reference |
| POST | `/api/payments/paysera/callback` | Provider callback; verify the signature, then mark paid |
| GET | `/p/{subdomain}` (dev) / `{subdomain}.faqjagati.com` | Live page; 404 unless `paid` or `live` |

### 8.5 Admin

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/pages?status` | All pages with contact phone and payment state |
| POST | `/api/admin/pages/{id}/mark-paid` | Body `method, note` → payment row, status `paid`, publish, audit log |
| POST | `/api/admin/pages/{id}/unpublish` | |
| PUT | `/api/admin/pages/{id}/content` | Hand-edit the content JSON (validated) |
| POST | `/api/admin/pages/{id}/assets/{assetId}/replace` | Upload the enhanced photo |
| GET | `/api/admin/businesses` | Overview: bookings per week per business |

---

## 9. Notes for Opus

- Build the customer booking page first and make it fast: it is the page customers judge the whole brand by. Server-render the profile and services; fetch times on the client.
- Use the classes and structure in `termini-ui/*.html` and the variables in `design-tokens.css` as they are; they are written to be lifted into components.
- All Albanian strings in this document are final copy. Keep them in one dictionary file so Phase 3 can review the language in one place.
- Do not add features that are not here. If something is missing, choose the simplest behaviour in the same tone.
