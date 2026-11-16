# JOB A: 2 new Faqja Gati templates (wedding hall + driving school)

You are Fable 5.2. You may be on a new account with no memory of this project. Everything you need is on disk.
The owner is Roni (video editor, not a programmer). Do not ask questions: decide yourself, in the same premium style.
**Roni is away. NEVER stop, pause or wait for confirmation. Keep working until the line `JOB A done` is written. The only acceptable stop is the usage limit.**

## Where things are (read these first, in this order)
1. `F:\TERMINI\CONTEXT.md`: the business (Termini booking + Faqja Gati €100 AI pages, Kosovo).
2. `F:\TERMINI\VERSIONS.md`: which app folder to use. **Work ONLY in `build/app-v2`.**
3. `F:\TERMINI\fable\02-design-system.md` + `fable\design-tokens.css`: the look (colors, type, spacing).
4. `F:\TERMINI\fable\templates\`: the 6 existing templates. Study `berber/` and `klinike-dentare/` closely:
   each template = `index.html` + `style.css` + `content.json` (+ `content.js`), shared `base.css`, `fg.js`, `preview.css`, `schema.json`.
   The content must validate against `schema.json`.
5. How the app uses templates: `build/app-v2/templates/`, `build/app-v2/lib/fg/` (render.ts, filler.ts, schema.ts),
   `build/app-v2/lib/ai.ts`, `build/app-v2/components/FaqjaWizard.tsx`, `build/app-v2/lib/sq.ts` (Albanian texts), `build/app-v2/prisma/seed.ts`.
   Search the code for `klinike-dentare` to find every place a category is registered.

## The job
Make 2 NEW templates at Apple/Mercedes level, mobile first (375px), all text in natural Albanian (Kosovo):
- **`sallon-dasmash`**: wedding hall. Big hero photo, halls with capacity, menus/packages with prices, a free-date calendar feel, gallery, "Rezervo datën" (book the date) linked to Termini, aimed at diaspora families too.
- **`autoshkolla`**: driving school. Categories (B, C, A…), prices, instructors, lessons booking, pass-rate trust, "Regjistrohu" + "Rezervo orën" linked to Termini.

Steps:
1. Create them as NEW folders in `fable/templates/` (never change the 6 existing ones), with realistic sample content.json.
2. Copy them into `build/app-v2/templates/` and register both categories everywhere the app needs (wizard, filler, AI prompt, Albanian labels, schema if needed).
3. Run inside `build/app-v2`: `npm install` (if node_modules is missing), `npm test`, `npm run build`. Fix until both pass.
4. Take a 375px screenshot of each new template if you can, save in `fable/_shots/`.

## Save as you go (the usage limit can stop you any minute)
- After EACH finished step, append one line to `F:\TERMINI\fable\PROGRESS-JOB-A.md`.
- At the start, read that file and continue from the first unfinished step. Never redo finished steps.
- When everything is done write the line `JOB A done` in it.
Work only inside `F:\TERMINI`. Never edit `build/app` (v1 is frozen).
