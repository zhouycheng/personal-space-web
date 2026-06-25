# Justin Kit

Justin Kit is the personal component library behind Justin OS.

This first Astro version keeps the library source-first. The typed catalog lives
in `src/data/kit.ts`, while complete extracted component source lives under
`src/justin-kit/components`.

The catalog is ready for a future homepage section or `/kit` route, but the
current homepage does not render it yet.

## Categories

- `HTML`: HTML/CSS visual effects and page sections.
- `JS Motion`: browser APIs, local runtime integrations, SSE, and interaction effects.
- `Design`: brand rules, layout patterns, color systems, and visual QA checklists.
- `Flutter`: copyable Dart widgets for Flutter projects.

## Current Extracted Components

- `cursor-reveal-hero`: the old homepage mask/reveal hero effect, now as a
  standalone Astro component with local CSS and pointer script.
- `local-activity-status`: the macOS foreground app monitor, Astro API runtime,
  SSE badge, app catalog, TTL store, and listener script.

## Planned Catalog Entries

- `justin-brand-dna`: design tokens, layout rules, and visual QA rules.
- `flutter-status-chip`: copyable Dart status badge for Flutter projects.

These planned entries exist in `src/data/kit.ts` so the UI contract can be
designed before the files are created.

## Component Boundary

Each extracted component should own:

- its Astro component file,
- local CSS,
- browser script if needed,
- runtime/server files if needed,
- a README with copyable usage,
- `source-notes.md` explaining what was extracted from the legacy app.

The active Astro page may import a component, but the component should not rely
on homepage-only CSS or data.

## Next Pass

The next pass should turn each extracted component into:

- a first-class full-page Astro preview route,
- a copyable source snippet,
- a visual screenshot,
- a small QA checklist.
