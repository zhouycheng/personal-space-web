# Cursor Reveal Hero

Category: `HTML`

Status: complete Astro extraction. The component is not mounted on the current
Justin OS launch page yet.

This is the homepage circular mask effect extracted from the old Next/React
homepage into a dependency-light Astro component.

## Files

- `CursorRevealHero.astro` renders the two-layer hero.
- `cursor-reveal-hero.css` contains the mask, dot grid, typography, and fallback styles.
- `cursor-reveal-hero.ts` tracks pointer movement and animates the CSS variables.
- `source-notes.md` records the old Next source files used during extraction.

## Usage

Import the component from the page or component where it will be rendered:

```astro
---
import CursorRevealHero from "../justin-kit/components/cursor-reveal-hero/CursorRevealHero.astro";
---

<CursorRevealHero
  primaryLeading="你好，我是"
  primaryAccent="耀程"
  primarySubtitle="Flutter engineer building personal tools with AI."
  revealLeading="Hello, I'm"
  revealAccent="Justin"
  revealSubtitle="A second layer appears through the cursor mask."
/>
```

The component does not require React. It uses native pointer events,
`requestAnimationFrame`, and a circular CSS `clip-path`.

## Props

- `primaryLeading`: text before the primary accent.
- `primaryAccent`: emphasized text in the primary layer.
- `primarySubtitle`: subtitle in the primary layer.
- `revealLeading`: text before the reveal accent.
- `revealAccent`: emphasized text in the reveal layer.
- `revealSubtitle`: subtitle in the reveal layer.
- `class`: optional class added to the root section.

## Behavior

- Desktop fine pointers get the circular reveal mask.
- Pointer down gently shrinks the reveal radius.
- Touch devices and reduced-motion users receive the primary layer only.
- Visual tokens are local to the component and can be replaced with Justin Kit
  design tokens later.

## Integration Checklist

- Import the Astro component directly; no React runtime is required.
- Keep the component CSS local unless the design tokens are promoted into
  Justin Kit.
- If multiple instances are rendered, the initializer is safe to call more than
  once because it marks bound elements with `data-cursor-reveal-bound`.
