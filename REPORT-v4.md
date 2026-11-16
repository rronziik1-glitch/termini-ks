# REPORT v4: the Fable audit (16 Nov 2026)

For Roni. Simple English. The full technical list is `fable\04-fable-audit.md`.

## In one minute

- I checked the whole app like an attacker and like a tired barber on a phone.
- **Nothing critical was found.** Nobody can take over an account, read another business's customers, or get a paid page for free on a correctly set up site.
- I found **10 serious problems** and **20 smaller ones**. **All 10 serious ones are fixed**, and 13 of the 20 smaller ones.
- The fixed app is **`build\app-v4`**. v1, v2 and v3 were not touched.
- 98 automatic tests pass (23 are new, one or more for every fix), and the build passes.

## What was found and fixed

**Bookings**
1. A hacker could book a slot that was already taken, by sending a date that does not exist ("31 November"). Fixed.

**Logins and SMS cost**
2. The limit "5 login codes per 15 minutes" did not really work on Vercel, because each server counted on its own. Now the count is in the database.
3. Anyone could make the site send login codes to any country. With paid SMS that is a known fraud that leaves you with the bill. Now codes go only to Kosovo and Albania numbers (you can add countries), with a daily ceiling.
4. If you forgot to switch off "show codes on screen" on launch day, anyone could log in as anyone. Now the app refuses to start in that case.

**Payments**
5. With Paysera still in test mode on an open site, anyone could publish a page with a free test payment. Now the app refuses to start in that case.
6. The Paysera check now looks at the money that was really paid, not only the amount that was asked.
7. A page that was just paid could fall back to "preview" if "Rindërtoje" was pressed in the same second. Fixed.

**Faqja Gati pages**
8. A page could stay on "Po e ndërtojmë" forever when the server cut the work off. Now the work fits the time limit, and a stuck page offers "Provo përsëri" after 2.5 minutes.
9. On a phone, the preview scrolled sideways in three designs (berber, bujtine, dyqan), exactly when the customer decides to pay. Fixed.
10. The nine examples on `/faqja` showed half of the page as black bars. They now show the whole page (still with the "Preview" mark).
11. The payment screen promised an address at `faqjagati.com`, a domain you do not own. It now shows the real address (`terminiks.com/p/emri`).

**Protection**
12. Other websites (and customer pages on your own domain) could send actions in the name of a logged-in owner. Now the app accepts changes only from its own address.
13. Every generated page now carries a rule that allows only our own script to run.
14. Uploads accept photo formats only. The custom domain typed at checkout is checked.

**Small things**
15. The login screen said "me SMS" even when the code comes on WhatsApp. It now says the right one.
16. "Gjej një termin" now has filters for wedding halls, driving schools and car washes.
17. The small links that still said "Merre linkun tënd falas" now say "Regjistroje falas", to match the button you changed.
18. The profile photo is made smaller on the phone before upload (large photos would fail on Vercel).

## How to open v4

```bash
cd F:\TERMINI\build\app-v4
```

```bash
npm run dev
```

Then open http://localhost:3000 . The demo logins are the same as before (`049 111 111` barber, `049 000 000` admin; the code is shown on screen).

`GO-ONLINE.md` now points to `build\app-v4`. Three things changed in it:
- Paysera's "prove the site is yours" step no longer needs you to remove the launch password.
- On launch day, remove `DEMO_SHOW_CODES_IN_PRODUCTION` and set `PAYSERA_TEST` to `0` in the same step as removing `SITE_PASSWORD` (otherwise the app refuses to start, on purpose).
- New optional settings: `OTP_ALLOWED_PREFIXES` (countries that may get a login code) and `OTP_DAILY_CAP`.

## What is left

**Not fixed, on purpose (needs your decision or more screen work)**
1. **The spam guard can stop real customers.** After 6 new phone numbers at one business in 30 minutes, the next booking is refused. If a barber posts the link in a story, the 7th real customer gets an error. Better: accept it as "to confirm" and show the owner a banner. This is new screen work.
2. Somebody can annoy an owner by asking for login codes for their number (the owner then waits up to 15 minutes for a new code). Small, because a login lasts 60 days.
3. One more medium item (M13) and four tiny ones (S4–S7), listed in the audit file.

**Still not tested for real** (no accounts yet): the online database, photo storage, SMS, WhatsApp and Paysera. Each has a "check it works" step in `GO-ONLINE.md`.

**Your open decisions from the earlier audit:** the legal name on the payment screen, a "money back within 7 days" line, and whether you really improve every photo by hand.

**Note:** the two changes you asked for today (the button text and the cities on a computer) were made in v3 before it was frozen, so they are in v4 too.
