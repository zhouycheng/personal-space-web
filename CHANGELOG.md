# Changelog

## 2026-06-26 | v0.1.0 | No Release

JustinWeb is an Astro 6 root project with Justin OS homepage work, Justin Kit component extraction, local activity runtime wiring, and the project-local workflow skill matrix.

### Added

- Justin OS homepage launch shell, fullscreen projection, and macOS-like desktop system.
- Recursive `public/os-desktop/` desktop scanner with HTML, Markdown, and folder windows.
- Justin Kit component folders for cursor reveal, local activity status, and macOS desktop.
- Project-local workflow skills under `.agents/skills/`.

### Changed

- Active runtime is Astro at the repository root; the old Next implementation is no longer active.
- Documentation now uses `CONTEXT.md`, `README.md`, `docs/`, and component README files as current-fact entrypoints.

### Verified

- `rtk npm run build`.
