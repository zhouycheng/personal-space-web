# Source Notes

The original Next implementation used React state only for refs/effects. The
visual behavior was mostly CSS variables:

- `--cursor-x`
- `--cursor-y`
- `--cursor-radius`
- `--cursor-scale`
- `--cursor-opacity`

The component can be simplified in Astro by binding pointer movement directly to
an element and updating `--x` / `--y`.

Important behavior to preserve:

- hide the reveal layer on coarse pointers,
- respect `prefers-reduced-motion`,
- avoid hijacking the cursor outside the active hero area,
- keep primary and reveal content real HTML for accessibility.

Current Astro implementation:

- `CursorRevealHero.astro` renders static semantic markup.
- `cursor-reveal-hero.css` owns the layer styling and mask behavior.
- `cursor-reveal-hero.ts` binds pointer events to every
  `[data-cursor-reveal-hero]` element and updates CSS variables through
  `requestAnimationFrame`.

The legacy Next files are no longer part of the active working tree.
