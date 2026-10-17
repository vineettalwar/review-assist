---
name: Review Assist
description: "Carbon Copy: a review draft written on a duplicate-book sheet, with a blue carbon copy handed to the portal."
colors:
  paper: "#ffffff"
  surface: "#f6f7fa"
  ink: "#101522"
  ink-2: "#4d5566"
  ink-3: "#646c7d"
  rule: "#d4d9e4"
  rule-strong: "#b3bccc"
  toggle-off: "#cfd5e0"
  carbon: "#2346e0"
  carbon-deep: "#1a37b8"
  carbon-wash: "#e9eefb"
  ok: "#0f7a4a"
  ok-wash: "#e5f4ec"
  warn: "#8a5300"
  warn-wash: "#fbf0dc"
typography:
  display:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "clamp(34px, 9vw, 44px)"
    fontWeight: 700
    lineHeight: 1.03
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  draft:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  body-sm:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
  sheet-no:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.08em"
  mono:
    fontFamily: "ui-monospace, Menlo, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "2px"
  base: "3px"
  full: "999px"
spacing:
  hair: "2px"
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "22px"
  xl: "28px"
  xxl: "44px"
components:
  sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    padding: "16px 18px 14px"
  carbon:
    backgroundColor: "{colors.carbon-wash}"
    textColor: "{colors.carbon}"
    rounded: "{rounded.base}"
    padding: "0 18px 3px"
  button-primary:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.paper}"
    rounded: "{rounded.base}"
    height: "58px"
    padding: "0 20px"
  button-primary-hover:
    backgroundColor: "{colors.carbon-deep}"
  button-primary-admin:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.paper}"
    rounded: "{rounded.base}"
    height: "42px"
    padding: "0 18px"
  button-line:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    height: "44px"
    padding: "0 16px"
  button-line-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "7px 12px"
  chip-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  segmented:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.base}"
    height: "32px"
    padding: "0 12px"
  segmented-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    height: "42px"
    padding: "0 12px"
  pill:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.base}"
    padding: "3px 8px"
  pill-blue:
    backgroundColor: "{colors.carbon-wash}"
    textColor: "{colors.carbon}"
  pill-green:
    backgroundColor: "{colors.ok-wash}"
    textColor: "{colors.ok}"
  pill-amber:
    backgroundColor: "{colors.warn-wash}"
    textColor: "{colors.warn}"
  note:
    backgroundColor: "{colors.carbon-wash}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.base}"
    padding: "14px 16px"
  toggle:
    backgroundColor: "{colors.toggle-off}"
    rounded: "{rounded.full}"
    width: "38px"
    height: "22px"
  toggle-on:
    backgroundColor: "{colors.carbon}"
  nav-item:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.base}"
    padding: "8px 10px"
  nav-item-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
---

# Design System: Review Assist

## Overview

**Creative North Star: "Carbon Copy"**

The customer's review is the top sheet of a duplicate book. Posting lifts a blue carbon copy off it and hands it to the portal. The world is white bond paper, a near-black blue ink, and one carbon blue. The system is flat and printed: 1px ink rules, 3px corners, no soft drop shadows. Depth comes from one device only, the carbon, a pale blue duplicate offset under the sheet.

Everything is Schibsted Grotesk. Headings are tight and heavy (-0.035em); small spaced numerals (NO. 0241 · ORIGINAL) mark sheets the way a numbered form would. Stars are ink outlines that fill with ink, never amber. The admin app is the same world in a working register: the same ink rules, the same carbon, a white canvas, denser at 15px body.

Motion is GSAP with a damped expo ease-out and no bounce; Lenis supplies smooth scroll. The signature move: on Copy the carbon stays slid out from under the sheet and the sheet is stamped COPIED. The draft re-types word by word when rating or chips change.

**Key Characteristics:**
- White paper, ink #101522, one blue (carbon #2346e0) with its pale wash.
- 1px ink border, 3px corners, flat; the carbon offset is the only depth.
- Ink fill means "on" (stars, chips, segmented, nav). Carbon blue means "act" or "handed over" (primary button, carbon, focus, notes).
- One typeface, tight display, small spaced sheet numbers.
- Damped expo ease-out everywhere; reduced motion shows final states instantly.

## Colors

Restrained: white and ink do almost everything; carbon blue is the single voice, with green and amber appearing only as admin status.

### Primary
- **Carbon Blue** (#2346e0, `carbon`): primary button, carbon sheet border and text, caret, focus ring, active link text, locked-note border, selection fill.
- **Carbon Deep** (#1a37b8, `carbon-deep`): hover state of the carbon-blue button only.
- **Carbon Wash** (#e9eefb, `carbon-wash`): carbon sheet fill, note callout, reward panel, focus halo, "Main"/"Opened" pills.

### Neutral
- **Bond Paper** (#ffffff, `paper`): page, sheet, inputs, cards.
- **Surface** (#f6f7fa, `surface`): admin hover rows, neutral pill, disabled input, nav hover.
- **Ink** (#101522, `ink`): text, sheet border, "on" fill, brand mark, line buttons.
- **Ink 2** (#4d5566, `ink-2`): ledes, secondary text, inactive segmented labels.
- **Ink 3** (#646c7d, `ink-3`): meta, sheet numbers, footers, placeholders (4.5:1 or better on white; keep it as the lightest text color).
- **Rule** (#d4d9e4, `rule`): hairlines, chip and segmented borders, card borders. Rule Strong (#b3bccc) is admin input hover only. Toggle Off (#cfd5e0) is the off track.

### Status (admin only)
- **Ok** #0f7a4a on **Ok Wash** #e5f4ec: Posted, Sent, Active; also the customer "Sent" confirmation text.
- **Warn** #8a5300 on **Warn Wash** #fbf0dc: Pending.

### Named Rules
**The One Blue Rule.** Carbon blue is the only chromatic accent. Never violet, never amber stars, never a second brand hue.
**The Ink Means On Rule.** Selected state is an ink fill with white text. Carbon blue marks the action to take or the duplicate, never selection.

## Typography

**Display, Body, Label:** Schibsted Grotesk (weights 400, 500, 600, 700) with system-ui, sans-serif fallback. Load via next/font with `display: swap`.
**Mono:** ui-monospace, Menlo, only for the generated link URL in admin.

**Character:** a tight grotesque, confident at heading size and plain at reading size. Hierarchy comes from weight and tracking, not from a second family.

### Hierarchy
- **Display** (700, clamp(34px, 9vw, 44px), 1.03, -0.035em): customer greeting h1 (`text-wrap: balance`, margin 34px 0 10px; 56px top on >=720px). Admin page h1 is the same face at a fixed 36px.
- **Headline** (700, 22px, 1.15, -0.025em): after-copy confirmation h2.
- **Title** (700, 18px, 1.1, -0.02em): admin section h2; reward h3 is 19px/-0.02em; list-row h2 is 16px/-0.01em.
- **Body** (400, 16px, 1.5): customer body; lede capped at 34ch in ink-2. Admin body is 15px.
- **Draft** (400, 17px, 1.55, ink): the review text in the textarea and carbon; the largest body size because it is the product.
- **Body Small** (400, 14px): chips, alternates, table cells, rate word. 13px (500 for labels, 400 for helpers/foot) and 12px (hints, table heads, pills) fill the rest.
- **Sheet Number** (400, 11px, 0.08em, uppercase, ink-3; carbon on the carbon): "NO. 0241", "NEW LINK · NO. 0242", "NO. 0241 · COPY". It identifies a sheet; it never sits above a heading as a label.
- **Stamp** (700, 11px, 0.14em, carbon): COPIED only.

### Named Rules
**The One Face Rule.** Schibsted Grotesk throughout. Tightening (-0.02 to -0.035em) scales with size; body is never tracked.

## Layout

Customer page: a single column, `max-width: 520px`, centered, padding 28px 22px plus bottom safe-area inset; 72px top padding from 720px up. Order is brand line, display greeting, lede, rating row, chips, sheet stack, post button, alternates, after-copy block, reward, footer. No navigation. Rhythm steps: 6, 10, 14, 18, 22, 28, 44 (tokens `xs` to `xxl`); gaps between rating, stack and post are 28px/26px.

Admin: two columns, 220px sidebar (right 1px rule) and a main area padded 44px 48px, max-width 1040px (forms 760-820px). Page head is flex space-between with a 1px **ink** bottom rule, 20px padding below, 28px margin below. Two-column forms use a 16px gap. Under 860px the sidebar becomes a horizontal scrolling top bar (brand and counts hidden), main padding 28px 16px, grids collapse to one column, `hide-sm` columns drop.

Touch targets are at least 44px on the customer page (stars 44px, segmented buttons carry a 6px invisible vertical hit extension).

## Elevation & Depth

Flat and printed. There are no drop shadows. Depth is a single structural device, the carbon: a duplicate panel offset 10px right and 30px down under the sheet (customer) or 12px right and 12px down (admin), in carbon wash with a 1px carbon border. Interaction depth is a 3px carbon-wash halo (`box-shadow: 0 0 0 3px #e9eefb`) on sheet focus-within and admin input focus; it is a ring, not a shadow. The toggle knob's `0 1px 2px rgba(16,21,34,.2)` is the one hairline shadow and is limited to the knob.

### Named Rules
**The Carbon Is The Only Depth Rule.** Nothing else is lifted. No blur shadows on cards, modals or buttons. Stack order is sheet over carbon.

## Shapes

3px corners on every rectangular surface (sheet, carbon, buttons, inputs, notes, cards, pills, mark, nav items); 2px for items nested inside a 3px frame (segmented buttons, stamp). Fully round (999px) is reserved for chips and toggles. Status pills are 3px rectangles, not capsules. Borders are 1px; ink for the sheet and primary containers, rule for secondary, carbon for carbon-related surfaces (carbon, note, reward, result). The stamp is a 1.5px carbon border rotated -4deg. The carbon's top edge carries a 1px dashed carbon line (45% alpha) like a tear-off perforation.

## Components

### Sheet + carbon stack (signature)
- **Stack:** relative wrapper, padding `0 10px 30px 0`. The carbon is absolutely positioned `left:10px; right:0; top:30px; bottom:0`; the sheet is relative on top.
- **Sheet:** white, 1px ink border, 3px radius, padding 16px 18px 14px. Head row: sheet number left (with stamp), segmented control right. Then the borderless transparent textarea (17px/1.55, min-height 4.7em, auto-grows, caret carbon). Foot row: top 1px rule, 10px padding: "New draft" regen button (13px ink-2, hover carbon, 15px stroke icon), contextual suggest/undo link (13px carbon 500, hover underline), word count (13px ink-3).
- **Carbon:** carbon-wash fill, 1px carbon border, carbon 16px text mirroring the draft (`filter: blur(.25px)`), bottom-aligned, `aria-hidden`. Its tag row (sheet number "NO. 0241 · COPY" plus "TO GOOGLE") is hidden until handed.
- **States:** focus-within gives the 3px carbon-wash halo. While typing, textarea text is ink-2. Handed: stack bottom padding goes 30px to 92px so the carbon shows out from under the sheet, the tag appears, the stamp scales 1.4 to 1 and fades in (0.6s expo.out; padding 0.9s expo.out). Editing the draft after handing reverses it (padding 0.6s, stamp fade 0.2s). On load the carbon settles from y -18px, 1.2s expo.out, 0.2s delay.
- **Never overwrite the customer's words:** if edited, rating/chip changes offer a "Rewrite for N stars" link; rewriting offers "Undo" for 7s.

### Stars
- Five 44px square hit areas, 2px gap, `role=radiogroup`. Glyph is a 30px SVG outline, 1.3px ink stroke, round joins; selected stars fill ink (0.2s). Hover lifts 2px (0.2s expo). Never pre-filled; rate word beside it (14px ink-3, min 8ch, aria-live) reads Tap to rate, Poor, Not great, Okay, Good, Great.

### Chips
- Pill (999px), 14px text, padding 7px 12px, 1px rule border, white. Hover: ink border. Pressed (`aria-pressed=true`): ink fill, white text, ink border. 6px gap, wrapping. The set swaps by rating (positive set for 4-5 or unrated, negative set for 1-3, "Clean office" in both). Admin chips are 13px, padding 6px 12px, `.on` = same ink fill.

### Segmented control
- 1px rule border, 3px radius; buttons 32px high, 13px, padding 0 12px, ink-2 text; pressed = ink fill, white text, 2px radius. Used for Short / Detailed.

### Primary button
- **Customer "go":** full width, 58px, carbon fill, white 600 17px, 3px radius, padding 0 20px, label left and 20px arrow icon (1.8 stroke) right, hover carbon-deep (0.2s). Label "Copy & open Google".
- **Admin:** 42px high, padding 0 18px, 600, centered, hover carbon-deep (0.15s). Small variant 32px, padding 0 12px, 13px.
- Alternates sit below as centered 14px ink-3 text with ink underline-link buttons (underline rule-colored, offset 4px; hover turns carbon).

### Line button
- Transparent/white, 1px ink border, 3px radius, 500; customer 44px/15px/padding 0 16px with 16px icon, admin 42px (small 32px). Hover: ink fill, white text. Used for Open again, Copy again, Copy, Approve, Upload logo.

### Inputs
- Admin `.input`: 42px, 1px rule border, 3px radius, padding 0 12px, caret carbon; hover border #b3bccc; focus ink border plus 3px carbon-wash halo; disabled surface fill, ink-3 text. Textarea: padding 10px 12px, 1.55 line-height, vertical resize. Field = column, 6px gap, 13px 500 ink-2 label, 12px ink-3 hint.
- Customer email: 46px, 1px **ink** border, 16px text (avoids iOS zoom), white, focus 2px carbon outline offset 1px; sits beside a 46px ink-fill "Send" button (600, padding 0 18px).

### Pills / status
- 3px radius, 12px 500, padding 3px 8px, with an optional 6px currentColor dot. Neutral (surface/ink-2): Created, Draft. Blue (carbon-wash/carbon): Opened, Main. Green (ok-wash/ok): Posted, Sent, Active. Amber (warn-wash/warn): Pending.

### Toggles (including locked)
- 38x22 track, off #cfd5e0, on carbon; 16px white knob at 3px inset travelling to left 19px (0.2s expo). **Locked:** the same toggle at 50% opacity, `cursor: not-allowed`, always off, never operable, paired with a 12px ink-3 lock line (13px padlock icon + "Rewards") beside it. Locked is a platform guarantee for Google, Amazon, Trustpilot, Yelp, Facebook.

### Note callout
- Carbon wash fill, 1px carbon border, 3px radius, padding 14px 16px, 13px ink-2 with an ink bold lead sentence, 16px carbon icon (padlock) top-aligned. Margin-bottom 20px. Also the customer fallback message (no border, 10px 12px, 14px ink) and the reward panel (18px padding, carbon border, carbon wash, 19px title, 14px ink-2 body).

### Tables
- Full-width inside a rule-bordered card with 14px top padding. Head: 12px 500 ink-3, padding 0 16px 10px. Cells: 14px, padding 13px 16px, 1px rule top border. Row hover: surface. Secondary cells use ink-3. Action column right-aligned with small line button.

### Admin shell / nav
- Sidebar 220px, padding 24px 12px, 1px rule right border, 1px item gap. Brand: 26px ink mark (3px radius, 11px 700 white initial) plus 14px 600 name, margin 0 10px 28px. Nav item: 8px 10px, 3px radius, 500, ink-2, name left and a count in `small` (opacity .6) right; hover surface fill and ink text; active ink fill and white text. Mobile: horizontal scroll bar, counts hidden.
- List rows (cards, 16px 18px, 14px gap): selected row has an ink border. "New link" card: ink border, 22px padding, sheet number row, result row (carbon wash, carbon border, mono 14px carbon URL, small line "Copy").

### Motion
- **Easing:** `--ease: cubic-bezier(.16,1,.3,1)` for CSS; GSAP `expo.out` (same curve) for entrances and handoffs; `power1.out` for typing progress. No bounce, no spring, no overshoot.
- **Durations:** state color changes 0.15-0.2s; stars/toggle 0.2s; stamp 0.6s; after-copy and reward entrances 0.8s (y 10, opacity, delay .25 and .4); stack padding 0.9s; carbon settle 1.2s; retype `min(1.1s, .15 + words*.045)`.
- **GSAP:** animate only transform, opacity and the stack padding; kill the in-flight typing tween before a new one; the draft re-types only the changed tail from the last shared word boundary.
- **Lenis:** `lerp: .1`, `smoothWheel: true`, driven from `gsap.ticker` (`lenis.raf(t*1000)`, `lagSmoothing(0)`); apply `html.lenis` height auto and `.lenis-smooth { scroll-behavior: auto !important }`. Skip Lenis entirely under reduced motion.
- **Reduced motion:** no transitions or animations; text, stamp and carbon states set instantly.

## Do's and Don'ts

### Do:
- **Do** use ink fill (#101522) for every selected state and carbon blue (#2346e0) for the primary action and the carbon duplicate.
- **Do** keep corners at 3px (2px nested), borders at 1px, and depth to the carbon offset alone.
- **Do** keep the customer rating unselected on load and offer the same portals at every rating.
- **Do** show the locked toggle at 50% opacity with its padlock line, and explain it in a note.
- **Do** apply focus as a 2px carbon outline (offset 3px on the customer page, 2px in admin) and a carbon-wash halo on inputs.
- **Do** keep text at ink-3 (#646c7d) or darker on white.

### Don't:
- **Don't** use amber or gold stars, or a violet accent.
- **Don't** add soft or blurred drop shadows, or pill-rounded cards and textareas.
- **Don't** use bounce, elastic or spring easing, or animate layout properties other than the stack padding.
- **Don't** pre-fill the rating or push toward five stars with color, copy or order.
- **Don't** introduce a second typeface or a second chromatic hue; status green and amber stay in admin pills and the "Sent" text.
- **Don't** put the dark "Design draft" switcher into product; it is a prototype tool.
