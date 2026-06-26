# macOS Desktop

Reusable Justin Kit component for the Justin OS desktop projection.

## Usage

```astro
---
import MacOsDesktop from "/src/justin-kit/components/macos-desktop/MacOsDesktop.astro";
import { getMacOsDesktopEntries } from "/src/justin-kit/components/macos-desktop/runtime/desktop-scanner";

const entries = await getMacOsDesktopEntries();
---

<MacOsDesktop entries={entries} />
```

## Desktop Directory

The default scanner reads:

```text
public/os-desktop/
```

Supported items:

- `.html`: opens in an iframe-backed window.
- `.md`: opens in a markdown-backed window.
- folders: open as Finder-style windows and scan recursively.

Ignored items:

- hidden files and folders starting with `.`
- unsupported file extensions

File and folder names become desktop names. File extensions are represented by
the icon badge instead of the desktop label.

## Behavior

- Icons default to `48px` with `8.5px` labels. The runtime exposes CSS
  variables for icon art size, label size, and the computed drag target.
- New layouts start at the right side and flow downward, then leftward.
- Dragged icon positions persist in `localStorage`.
- Display settings persist in `justin-os-desktop-view-settings`.
- Manually resized window dimensions persist in `justin-os-window-sizes`.
  Fullscreen frames and automatic viewport clamps are not saved.
- Overlapping icons are pushed apart with a FLIP bounce animation.
- The component listens for:
  - `justin-os-desktop:clear-windows`: clears open windows without resetting
    icon positions.
  - `justin-os-desktop:open-display-controls`: opens the display settings
    window.
  - `justin-os-desktop:arrange-icons`: animates all icons back to the right
    side and saves that layout.
