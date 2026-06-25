# Project Agent Notes

## Active Runtime

JustinWeb is now an Astro project. The active app lives in
the repository root.

- Use Node `>=22.12.0`; `.node-version` currently pins `22.22.3`.
- Run app commands from this repository root.
- The old Next implementation has been removed. Do not add or restore Next code
  unless the user explicitly asks for it.

## Commands

When running shell commands in this repository, prefix command segments with
`rtk` unless debugging requires raw output.

Common commands:

```bash
rtk npm install
rtk npm run dev
rtk npm run build
rtk npm run preview
rtk npm run monitor:activity
```

## Documentation

- Keep root `README.md` as the repository orientation page.
- Keep active runtime details in `README.md`.
- Keep Justin Kit rules in `src/justin-kit/README.md`.
- Keep component usage inside each component folder.
- If docs and source disagree, update the docs to match the source.
