# Active Decisions

This index lists decisions that remain active. Add full decision records under `docs/decisions/` when a decision needs more detail.

| Date | Decision | Status | Source |
| --- | --- | --- | --- |
| 2026-06-25 | Astro 6 at the repository root is the active runtime. | Active | README.md |
| 2026-06-25 | Homepage state vocabulary is `全显状态`, `推拉状态`, and `Justin OS 状态`. | Active | CONTEXT.md |
| 2026-06-25 | Justin Kit components stay source-first under `src/justin-kit/components/`. | Active | src/justin-kit/README.md |
| 2026-06-26 | Desktop files come from `public/os-desktop/` and are rendered by the macOS desktop component. | Active | src/justin-kit/components/macos-desktop/README.md |
| 2026-06-26 | Project workflow skills use the `justinweb-` prefix under `.agents/skills/`. | Active | .agents/skills/README.md |
| 2026-06-26 | Dock navigation uses real routes `/home`, `/works`, and `/os`; `/` remains a homepage alias and client navigation preserves the shared app shell. | Active | src/components/app/JustinAppShell.astro |
| 2026-06-26 | Homepage mid-collapse `推拉状态` progress is restored from same-tab `sessionStorage`, and terminal boot timing uses a shared 20% speed-up helper. | Active | src/components/app/homeRuntimeState.mjs |
