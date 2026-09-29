---
version: alpha
name: Clinch
description: A poster-grade design system for a completion and sign-off platform that turns almost-done work into confirmed, approved, and locked. Vivid lime and lavender panels float on an ink-black canvas under oversized geometric type.
colors:
  primary: "#C6F24E"
  secondary: "#C3B2F7"
  tertiary: "#FF6B4A"
  neutral: "#8B8B93"
  background: "#0E0E10"
  surface: "#17171B"
  on-background: "#F4F4F2"
  on-primary: "#0E0E10"
  on-secondary: "#0E0E10"
  border: "#26262B"
  focus: "#C6F24E"
  error: "#FF6B4A"
typography:
  font-display: "'Sen', 'Trebuchet MS', sans-serif"
  font-body: "'Schibsted Grotesk', 'Helvetica Neue', Arial, sans-serif"
  display-xl:
    font: "{typography.font-display}"
    weight: 800
    size: "8.5rem"
    line-height: 0.9
    tracking: "-0.04em"
  display-lg:
    font: "{typography.font-display}"
    weight: 800
    size: "5rem"
    line-height: 0.94
    tracking: "-0.03em"
  headline-lg:
    font: "{typography.font-display}"
    weight: 800
    size: "3rem"
    line-height: 1.0
    tracking: "-0.02em"
  headline-md:
    font: "{typography.font-display}"
    weight: 700
    size: "2rem"
    line-height: 1.05
    tracking: "-0.01em"
  title-md:
    font: "{typography.font-body}"
    weight: 700
    size: "1.25rem"
    line-height: 1.2
  body-lg:
    font: "{typography.font-body}"
    weight: 400
    size: "1.125rem"
    line-height: 1.55
  body-md:
    font: "{typography.font-body}"
    weight: 400
    size: "1rem"
    line-height: 1.6
  body-sm:
    font: "{typography.font-body}"
    weight: 400
    size: "0.875rem"
    line-height: 1.5
  label-md:
    font: "{typography.font-body}"
    weight: 700
    size: "0.9375rem"
    line-height: 1.1
  label-sm:
    font: "{typography.font-body}"
    weight: 500
    size: "0.8125rem"
    line-height: 1.2
rounded:
  none: "0px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "28px"
  full: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "32px"
  xl: "56px"
  2xl: "96px"
  gutter: "24px"
  container: "1200px"
elevation:
  flat: "none"
  control: "0 0 0 2px #C6F24E"
  lifted: "0 18px 40px -24px rgba(0,0,0,0.65)"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "14px 28px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "#D7FF6B"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.on-background}"
    rounded: "{rounded.full}"
    padding: "14px 28px"
    height: "52px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.on-background}"
    rounded: "{rounded.full}"
    padding: "14px 20px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-background}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
    height: "52px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-background}"
    rounded: "{rounded.lg}"
    padding: "28px"
  card-signature:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.xl}"
    padding: "40px"
  checkbox-checked:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    size: "22px"
  tabs-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
---

## Overview

Clinch is the identity for a completion and sign-off platform: the product that takes work from *almost done* to **confirmed, approved, and locked.** The system has to feel like a decision, not a suggestion. Every screen should read like a printed brand poster that happens to be interactive: loud, confident, and unmistakably committed.

The visual metaphor is **closing the loop.** A single continuous ribbon mark repeats across the system as a graphic device, oversized wordmarks bleed off the edges of solid color panels, and a forward arrow expresses transformation from before to confirmed. The emotional target is *earned finality*: the relief of the checkmark, made monumental.

This system should feel: poster-grade, high-contrast, deliberate, and physical, like ink and paper stock. It must never feel: like a soft SaaS template, a glassy dashboard, a startup with a purple gradient, or a page padded with tiny metadata labels. Energy comes from **scale, saturation, and hard contrast**, never from decoration, glow, or clutter.

Essential traits to preserve from the source direction:

- An **ink-black canvas** as the constant frame behind everything.
- **Volt lime and haze lavender** as the only two brand hues, used as full color-blocked panels.
- **Oversized geometric display type** that is clipped by panel edges.
- **Flat color-blocking** with no glass, no glow, and effectively no drop shadows.
- The single flowing **loop mark** as a recurring, sometimes blown-up, graphic.

## Colors

Clinch runs on a strict, small palette. Two brand hues, one canvas, one text color, and a tight neutral set. Restraint is the point: the loudness comes from *how much* lime and lavender you commit to, not from adding more colors.

| Token | Value | Role |
| --- | --- | --- |
| `background` | `#0E0E10` | Ink canvas. The primary background everywhere: system, preview, cover, metadata. |
| `primary` | `#C6F24E` | Volt lime. Signature panels, primary buttons, focus, the "confirmed" state. |
| `secondary` | `#C3B2F7` | Haze lavender. Paired panels, the "in review" state, secondary accents. |
| `on-background` | `#F4F4F2` | Chalk. Primary text and marks on the ink canvas. |
| `on-primary` / `on-secondary` | `#0E0E10` | Ink text and marks placed on lime or lavender panels. |
| `surface` | `#17171B` | Slate. Raised neutral cards on the canvas. |
| `neutral` | `#8B8B93` | Ash. Secondary and muted text only. |
| `border` | `#26262B` | Hairline. Dividers and outlines on dark surfaces. |
| `error` | `#FF6B4A` | Coral. Destructive and error states only. |

Rules:

- **Ink is always the base.** Never invert the system to a light background. Panels sit *on* the ink; the ink never sits on panels.
- **Lime is the hero.** Reach for volt lime first for the single most important action or confirmation on a screen. Never dilute it with tints; use the pure value or nothing.
- **Text on lime/lavender is always ink**, never chalk. Text on ink is chalk or ash, never lime (lime on ink fails as body text and screams).
- **Ash is for support only.** Never use ash for a heading or a primary action.
- The one permitted gradient is the **lavender-to-lime diagonal** (`#C3B2F7` to `#C6F24E`), reserved for the hero and signature panels. It is a branded gradient, not the banned purple/blue SaaS gradient. Never place body text on it and never use it more than once per screen.
- Coral is functional only. Never decorative, never a third brand color.

Contrast: chalk on ink and ink on lime/lavender all clear WCAG AA for body text. Ash on ink is reserved for large or secondary text only.

## Typography

Two families, no serifs, no third face.

- **Display: Sen 800.** The loud voice. Headlines, oversized wordmarks, and any type that gets clipped by a panel edge. Set it very large with tight tracking (`-0.02em` to `-0.04em`) and line-height at or below `0.94` so multi-line headlines lock into a solid block. Its rounded-geometric warmth keeps the scale friendly, not aggressive.
- **Body / UI: Schibsted Grotesk.** 400/500 for body and UI, 700 for emphasis and labels, 900 reserved for rare inline shout words. A neutral geometric grotesk that stays quiet under the display face.

Type rules:

- **Lead with the heading.** Never place an eyebrow, kicker, category, or all-caps label above an `h1` or `h2`. The heading is the entrance.
- **One subtitle maximum** per heading block. If you need a second line, cut it.
- Body copy sits at `body-md` / `body-lg`; measure caps around 60ch. Never run body text below `body-sm`.
- Use size and weight for hierarchy, not color. The only colored text is functional (a lime link on hover, coral for error).
- Prefer **few large elements over many tiny labels.** No decorative micro-caps, no monospace tags lining edges.
- Numerals in tables and controls should use `font-variant-numeric: tabular-nums`.

## Layout

Clinch composes like a poster gallery: bold rectangular panels on an even ink frame, arranged on a 12-column grid with a `24px` gutter inside a `1200px` container. The ink margin around and between panels is part of the design; treat it as the mat around framed prints.

Page rhythm:

- **Header:** transparent over the ink canvas, `72px` tall. Loop mark and wordmark hard-left, a slim nav, and one lime pill CTA hard-right. No border unless the page scrolls, then a single hairline.
- **Hero:** the loudest block on the page. Either a single full-width signature panel (lime, lavender, or the brand gradient) carrying an oversized headline that bleeds off the panel edge, or an asymmetric two-panel split echoing the identity-board layout: a large expressive panel beside a taller portrait/product panel. Left-align the headline. Follow with at most one subtitle and a lime primary + secondary button pair.
- **Section spacing:** `96px` (`2xl`) between major sections, `56px` (`xl`) within. Sections breathe; never crowd two loud panels without ink between them.
- **Feature / content grids:** 2 or 3 columns of cards. Mix one signature (lime/lavender) card into a row of slate cards to keep rhythm; never make an entire row signature-colored.
- **Split panels:** favor deliberate asymmetry (for example a 7/5 or 8/4 column split) over perfectly even halves, mirroring the reference identity board where one panel is clearly the star.
- **Footer:** a large lime or lavender signature panel with a blown-up loop mark or wordmark bleeding off one corner, plus compact navigation in ink text.

Composition rules:

- **Left-align by default.** Center only short hero headlines or the confirmation moment. Never center every section.
- **Commit panels edge to edge.** A panel is a solid block of color with generous internal padding (`40px` on signature panels). Do not nest bordered cards inside colored panels.
- **Let type bleed.** At least one headline or the loop mark per major view should be clipped by a panel edge. This is the signature move; use it, but no more than once or twice per screen so it stays intentional.
- **Stacking:** on small screens, panels stack full-width in source order, oversized type steps down one display level, and the asymmetric splits collapse to single columns. Keep the ink gutter; never let panels touch.
- Do not put a section heading on the left and its description on the right of the same line. Stack them.

## Elevation & Depth

Clinch is **flat.** Depth is achieved by layering vivid rounded panels on the ink canvas and by oversized type being clipped by panel edges, not by shadows.

- **No decorative drop shadows.** No glow, no glass, no `backdrop-filter`.
- The only permitted shadow is a functional lift on a raised menu or a focused floating control: an ultra-subtle `0 18px 40px -24px rgba(0,0,0,0.65)`. Use it rarely.
- Focus states use a **2px volt-lime ring** (`0 0 0 2px #C6F24E`), never a soft blur.
- Layer order for reading depth: ink canvas (back) → slate surfaces → color-blocked signature panels → oversized clipped type and loop mark (front).

## Shapes

Rounding is generous but hard-edged: soft corners, crisp fills, no feathering.

- **Signature panels:** `28px` (`xl`).
- **Cards:** `20px` (`lg`).
- **Inputs / small surfaces:** `12px` (`md`).
- **Buttons, tabs, pills:** fully pill-shaped (`full`).
- **Small chips / checkboxes:** `8px` (`sm`).

The loop mark is the only organic shape in the system; every container stays a rounded rectangle. Borders are `1px` hairline on dark surfaces and are omitted entirely inside solid color panels. Never add a stroke, glow, or gradient fill to the loop mark itself; it is always a single solid fill via `currentColor`.

## Components

All components share one grammar: solid fills, pill or rounded-rect shapes, ink-on-color or chalk-on-ink text, and a lime focus ring.

- **Buttons.** Primary is a volt-lime pill with ink text and bold label; hover lightens to `#D7FF6B` and nudges up `1px`. Secondary is transparent with a chalk hairline border and chalk text; hover fills with a faint chalk wash. Ghost is text-only with a lime hover. All buttons are `52px` tall with `28px` horizontal padding. One primary button per view.
- **Inputs & form fields.** Slate surface, hairline border, chalk text, ash placeholder, `12px` radius, `52px` tall. Focus swaps the border to lime and adds the 2px lime ring. Labels sit above the field in `label-md`, ink-adjacent chalk.
- **Cards.** Two kinds. *Neutral* cards are slate with a hairline border, `20px` radius, chalk heading and ash body. *Signature* cards are full lime or lavender with ink text, `28px` radius, and can hold clipped oversized type or a large loop mark. Never give a card a drop shadow.
- **Checkbox.** `22px` rounded square (`8px`), hairline border when empty, volt-lime fill with an ink check when selected. The check is the "confirmed" motif at small scale.
- **Tabs.** A pill segmented control on a slate track; the active pill is lime with an ink label, inactive labels are ash. Used for switching states like Draft / In review / Confirmed.
- **Signature panel.** The system's showpiece: a large rounded lime, lavender, or gradient panel with an oversized word or the loop mark bleeding off one edge. Reserve for hero, footer, and one mid-page moment.
- **Status expression.** Map real states to brand color: lavender = in review, lime = confirmed/locked, coral = rejected. States must reflect real, actionable data, never decorative pills.

**Icons:** [Phosphor Icons](https://phosphoricons.com/) (MIT). Use the **bold** weight consistently to match the heavy geometric type, loaded via the bold CDN stylesheet. Icons are utility elements at `20px`–`24px` (never scaled past `32px` as decoration). Recolor with `currentColor`: chalk on ink, ink on color panels. Do not mix in another icon set and do not invent custom paths; the loop mark is the only non-Phosphor glyph.

## Do's and Don'ts

**Do**

- Commit to full color-blocked panels of pure lime or lavender on the ink canvas.
- Set display type huge and let a headline or the loop mark bleed off a panel edge at least once per view.
- Keep the palette to two brand hues plus ink, chalk, slate, and ash.
- Left-align editorial content and use deliberate asymmetric splits.
- Use ink text on every lime and lavender surface, and chalk text on ink.
- Reserve the lavender-to-lime gradient for a single hero or signature panel per screen.
- Keep the loop mark a single solid fill and reuse it as a repeating graphic device.

**Don't**

- Don't add drop shadows, glow, glass, or `backdrop-filter` to create depth.
- Don't introduce a third brand color or tint the lime and lavender into pastels.
- Don't place chalk text on lime/lavender or use lime as body text on ink.
- Don't wrap every element in a bordered card; let the ink and type separate content.
- Don't scatter tiny all-caps or monospace metadata labels, coordinates, counts, or version tags to fake richness.
- Don't place an eyebrow/kicker above a heading, and never exceed one subtitle per heading block.
- Don't center every section or split even 50/50 when an asymmetric layout would carry more force.
