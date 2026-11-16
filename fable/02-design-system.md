# 02 · Design system: Termini + Faqja Gati (product UI)

Fable 5.2, 2026-11-13. Tokens: `design-tokens.css`. Reference implementation of every component: `termini-ui/termini.css` and the screens next to it.

This system covers the **product** (Termini app, Faqja Gati wizard, marketing pages). The six Faqja Gati **templates** each have their own art direction on purpose and only share motion rules and the reveal mechanism (`templates/base.css`).

---

## 1. Principles

1. **One thing per screen.** Each screen has one primary action, always at the bottom, under the thumb.
2. **Type and space do the work.** No illustrations, no gradients, no decorative icons. Hierarchy comes from size, weight and white space.
3. **Black, white and one colour.** Lime is used only where it means something: the selected time, a confirmed state, the brand mark. If lime appears more than twice on a screen, remove one.
4. **Fast is part of the look.** No spinner under 300 ms; skeletons shaped like the content; optimistic selection.
5. **Readable by a 50-year-old in sunlight.** 16px minimum body, 44px targets, contrast above AA everywhere, words on buttons (icons are never alone).

---

## 2. Typography

**Geist** (Google Fonts, weights 400/500/600/700) for everything. It covers ë, Ë, ç, Ç and the € sign, has clear numerals and a tabular set for times and prices. **Geist Mono 500** only for links and codes (`termini.app/berberi-arti`, SMS code boxes).

```html
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@500&display=swap" rel="stylesheet">
```

| Token | Size / line | Weight | Tracking | Use |
|---|---|---|---|---|
| `--text-display` | 40 / 42 | 700 | −0.035em | Marketing hero, "Termini u rezervua!" |
| `--text-h1` | 28 / 32 | 600 | −0.02em | Screen title |
| `--text-h2` | 22 / 28 | 600 | −0.02em | Section title, sheet title |
| `--text-h3` | 17 / 23 | 600 | −0.01em | Row title, card title |
| `--text-body` | 16 / 24 | 400 | −0.006em | Default. Inputs are never below 16px (prevents iOS zoom) |
| `--text-small` | 14 / 20 | 400 | 0 | Secondary lines, helper text |
| `--text-caption` | 12 / 16 | 500 | 0 (caps: +0.06em) | Labels above groups, badges |
| `--text-time` | 16 / 16 | 600 | 0, tabular | Times and prices |

Rules: at ≥ 768px display grows to 64 and h1 to 36; nothing else changes. Times and prices always use `font-variant-numeric: tabular-nums`. Sentence case everywhere; capitals only for 12px group labels. Maximum line length 60 characters. Titles use `text-wrap: balance`.

---

## 3. Colour

Semantic tokens only in components; never raw hex.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#FFFFFF` | `#0B0B0C` | Page |
| `--bg-subtle` | `#F6F6F3` | `#0B0B0C` | Page behind cards (owner app) |
| `--surface` | `#FFFFFF` | `#161618` | Cards, sheets |
| `--surface-2` | `#F1F1ED` | `#1F1F22` | Input fill, chips, free slot |
| `--border` | `#E4E4DF` | `#2A2A2E` | Hairlines |
| `--text` | `#0C0C0D` | `#F5F5F2` | Primary text |
| `--text-2` | `#55555A` (7.4:1) | `#B6B6BA` | Secondary |
| `--text-3` | `#6E6E73` (5.0:1) | `#8E8E93` | Tertiary; the lightest text allowed |
| `--primary` / `--on-primary` | `#0C0C0D` / white | `#C8F03C` / ink | Main button |
| `--accent` / `--on-accent` | `#C8F03C` / ink (15.6:1) | same | Selected slot, success mark, brand |
| `--accent-soft` | `#F1FBCF` | `#232B0C` | Selected row background |
| `--accent-text` | `#3F6600` (6.7:1) | `#C8F03C` | Lime-family text or links |
| `--success` | `#1A7F45` | `#4ADE80` | "Hapur", "Erdhi" |
| `--danger` | `#C8321F` | `#FF6B5A` | Errors, "S'erdhi", cancel |
| `--warning` | `#B45309` | `#FBBF24` | "Klient i ri", pending payment |
| `--whatsapp` | `#1FA855` | same | WhatsApp buttons only, with ink text |

Rules
- **Lime is a fill, never text on white.** For lime-coloured text use `--accent-text`.
- In light mode the primary button is ink; in dark mode it is lime. This flip is intentional: the brightest thing on screen is always the main action.
- Status is never colour alone: pair it with a word or icon ("S'erdhi", not just a red dot).
- Brand mark: the word "termini" in Geist 700, lowercase, tracking −0.04em, followed by a lime dot. On lime backgrounds the dot is ink.

---

## 4. Space, layout, radius, elevation

- **Grid:** 4px base. Scale: 4, 8, 12, 16, 20, 24, 32, 40, 56, 72, 96.
- **Page:** 20px side gutter at 375. App screens are a single column, max 480px, centred on larger screens. Marketing and the desktop calendar go to 1120px.
- **Vertical rhythm:** 24 between groups inside a screen, 40 between sections, 72–96 between marketing sections.
- **Safe areas:** bottom bars add `env(safe-area-inset-bottom)`.
- **Radius:** 14 for controls (buttons, inputs, slots), 20 for cards, 28 for sheets and media, full for chips and avatars. Nested radius = outer − padding.
- **Elevation:** three shadows. `--shadow-1` resting cards (often just a border instead), `--shadow-2` floating button and toast, `--shadow-3` sheets. In dark mode elevation is shown by a lighter surface and a 1px inner line, not by shadow.
- **Borders:** 1px `--border`. Prefer a border **or** a shadow, never both.

---

## 5. Motion

| Token | Value | Use |
|---|---|---|
| `--dur-instant` | 90 ms | Press (scale 0.97) |
| `--dur-fast` | 160 ms | Colour, hover, toggle |
| `--dur-base` | 240 ms | Selection, chips, toast in |
| `--dur-slow` | 400 ms | Sheet, step change, page transitions |
| `--dur-reveal` | 700 ms | Scroll reveal on marketing and templates |
| `--ease-out` | `cubic-bezier(.16,1,.3,1)` | Anything entering; the default |
| `--ease-in` | `cubic-bezier(.5,0,.75,0)` | Anything leaving (use 70% of the entering duration) |
| `--ease-in-out` | `cubic-bezier(.65,0,.35,1)` | Things that move while staying on screen |
| `--ease-spring` | `cubic-bezier(.34,1.56,.64,1)` | Only small pops: check mark, badge count |

Patterns
- **Press:** every tappable element scales to 0.97 in 90 ms and back in 160 ms. This is the main feedback on touch; there is no hover dependence.
- **Step change (booking, onboarding):** outgoing step fades and moves 12px left in 160 ms; incoming fades in from 12px right in 400 ms `--ease-out`. Going back mirrors it.
- **Slot selection:** fill changes to lime in 160 ms; the bottom bar summary cross-fades.
- **Bottom sheet:** slides up from the bottom in 400 ms `--ease-out`, scrim fades in 240 ms. Dismiss by dragging down, tapping the scrim, or Escape; closes in 240 ms `--ease-in`.
- **Success:** circle scales 0.6 → 1 with `--ease-spring` (400 ms), then the check stroke draws (320 ms), then text fades up. Happens once.
- **Scroll reveal (marketing, templates):** elements start at opacity 0, 24px lower; when 15% visible they animate to rest in 700 ms `--ease-out`. Siblings stagger by 70 ms, maximum 6. Each element reveals once. Above-the-fold content animates on load, not on scroll.
- **Skeletons:** `--surface-2` blocks with a slow opacity pulse (1.2 s); no shimmer sweep.
- **Reduced motion:** all movement and scaling are removed; opacity changes stay but become instant (the tokens collapse to 1 ms). The success check appears drawn.

Only animate `opacity` and `transform`.

---

## 6. Components

Class names match `termini-ui/termini.css`.

### 6.1 Button `.btn`
- Height 52 (small 40), radius 14, 16px/600 text, horizontal padding 20, full width on mobile by default.
- **Primary** `.btn--primary`: `--primary` fill, `--on-primary` text. One per screen.
- **Secondary** `.btn--secondary`: `--surface-2` fill, `--text`.
- **Ghost** `.btn--ghost`: transparent, `--text`; for "Kthehu", "Anulo".
- **Danger** `.btn--danger`: `--danger-soft` fill, `--danger` text. Solid red is never used.
- **WhatsApp** `.btn--whatsapp`: `--whatsapp` fill, ink text, WhatsApp glyph on the left.
- States: pressed scale 0.97; disabled 40% opacity and no pointer; loading replaces the label with a 20px spinner and keeps the width; focus-visible 2px `--focus` ring with 2px offset.
- Labels are verbs: "Konfirmo terminin", "Ruaj", "Vazhdo".

### 6.2 Input `.field`
- Label above (14/500, `--text-2`), control 52 high, radius 14, `--surface-2` fill, no border at rest; focus = 2px `--text` inside ring on a `--surface` fill.
- Helper or error text under it (14px). Error: ring and text in `--danger`, message says what to do.
- Phone: `inputmode="tel"`, `autocomplete="tel"`, the `+383` prefix shown as a fixed adornment. Name: `autocomplete="name"`. Price and minutes: `inputmode="numeric"` with a unit adornment on the right ("€", "min").
- Time of day: a `<select>` with 24-hour options (`.input--time`, every 30 min for opening hours, 15 for bookings), never `<input type="time">`, which follows the phone's locale and can show AM/PM.
- Saving: a switch or a choice saves at once with the toast "U ruajt."; typed fields and the weekly hours save with a "Ruaj" button in the bottom bar.
- Textarea grows with content up to 5 lines.
- Code input `.code`: six 48×56 boxes, Geist Mono, auto-advance, `autocomplete="one-time-code"`.

### 6.3 Selectable row `.row` (service list)
- Minimum height 64, padding 16, title (17/600) and meta ("30 min") on the left, price (16/600, tabular) on the right, hairline divider between rows.
- Selected: `--accent-soft` background, a lime check disc on the right replaces the chevron.
- The whole row is the target.

### 6.4 Chip `.chip`
- Height 40 (touch area padded to 44), radius full, 14/500, `--surface-2`; selected = `--primary` fill with `--on-primary` text. Used for category, staff, durations, filters. Horizontal scroll rows have 20px edge padding and snap.

### 6.5 Day strip `.days` and calendar slot `.slot`
- **Day pill:** 56×68, radius 14; weekday (12/500, `--text-3`) above the date (17/600). Selected = `--primary` fill. Full day = 40% opacity with "plot" replacing the weekday. Today is labelled "Sot".
- **Slot:** grid of 3 columns at 375 (4 from 420px), gap 8, each 48 high, radius 14, `--surface-2`, time in `--text-time`. Selected = `--accent` fill, `--on-accent` text, 600 weight. Taken times are not rendered at all (no greyed-out grid of regret).
- Groups are labelled "Paradite", "Pasdite", "Mbrëmje" in 12px caps.

### 6.6 Card `.card`
- `--surface`, radius 20, padding 20, 1px `--border` (light) or `--shadow-1`. Cards never nest.
- **Summary card** (confirmation): rows of label (14, `--text-3`) and value (16/500), hairlines between.

### 6.7 Bottom bar `.bar`
- Fixed to the bottom, `--surface` with `--shadow-bar`, padding 12/20 plus safe area. Holds a one-line summary on the left (two lines max) and the primary button. Appears with a 400 ms slide when there is something to confirm.

### 6.8 Bottom sheet `.sheet`
- `--surface`, top radius 28, 36×4 grabber, max height 90vh, content scrolls inside; title 22/600; actions at the bottom, primary last (closest to the thumb). Scrim `--scrim`. On ≥ 768px it becomes a centred dialog, 440 wide, radius 28.
- Focus is trapped while open and returns to the trigger on close.

### 6.9 Toast `.toast`
- Bottom centre above the bar, ink pill (in both themes: `#0C0C0D` with white text, in dark mode `--surface-3`), radius 14, 14/500, max 2 lines, optional action ("Zhbëj"). In 240 ms, stays 4 s (6 s with an action), out 160 ms. `role="status"`; errors use `role="alert"`.

### 6.10 Timeline booking `.event` (owner calendar)
- Left time rail 52 wide (12px, `--text-3`, tabular). Hour height 80 (15 min = 20px), so a 15-minute booking is still a 44px target with its padding.
- Event block: `--surface` card with a 3px left bar: lime = confirmed, `--success` = "Erdhi", `--danger` = "S'erdhi", `--border-strong` = blocked time. Shows time, name (16/600), service (14, `--text-2`).
- "Now" line: 1px `--danger` with a 8px dot on the rail.
- Blocked time uses diagonal hatching on `--surface-2`.

### 6.11 Others
- **Segmented progress** `.steps`: 4 equal bars, 4px high, radius full; done = `--primary`, rest = `--surface-3`.
- **Toggle** `.switch`: 52×32, knob 28; on = `--primary` (dark: lime).
- **Badge** `.badge`: 12/500, height 22, radius full, soft fill + matching text (`--warning-soft`/`--warning` for "i ri").
- **Tab bar** `.tabs`: 4 items, icon 24 + label 12/500; active = `--text` with a 4px lime dot above the icon; inactive `--text-3`. Height 64 plus safe area.
- **FAB** `.fab`: 56 high pill "+ Termin", `--primary`, `--shadow-2`, bottom right above the tab bar.
- **Empty state** `.empty`: title 17/600, one line 14 `--text-2`, one button. No illustration.
- **Avatar** `.avatar`: 40 or 56, radius full, `--surface-2`, initial in 600.

### 6.12 Icons
Lucide, 24px, 1.75 stroke, `currentColor`, inlined as SVG. Used only where they add meaning: tab bar, chevrons, phone, map pin, clock, check, plus, WhatsApp glyph. Every icon-only control has an `aria-label` in Albanian.

---

## 7. Accessibility checklist

- Text contrast ≥ 4.5:1, large text and UI outlines ≥ 3:1 (token pairs above already pass).
- Targets ≥ 44×44 with ≥ 8px between them.
- Visible focus ring on every interactive element for keyboard users (`:focus-visible`).
- Forms: real `<label>`s, `aria-invalid` and `aria-describedby` on errors, error summary announced via `role="alert"`.
- Step changes move focus to the new step's heading; sheets trap focus; toasts are announced.
- `lang="sq"` on `<html>`. Dates and times written out for screen readers ("e premte, 14 nëntor, ora 15:30").
- Works at 200% zoom and at 320px width without horizontal scrolling.
- Motion respects `prefers-reduced-motion`; theme respects `prefers-color-scheme`.

---

## 8. Marketing pages (termini home, `/faqja`)

Same tokens, more air: display type at 40 (mobile) / 64 (desktop), sections 96 apart, one idea per screen height, product screens shown as real UI inside a phone frame with radius 44 and `--shadow-3`. Alternate white and ink sections; the lime appears once per page, on the main call to action. Scroll reveal as in §5.
