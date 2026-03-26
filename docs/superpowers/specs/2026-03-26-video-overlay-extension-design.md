# Chrome Extension: Video Overlay Player — Design Spec

**Date:** 2026-03-26

## Overview

A Chrome extension that plays a bundled MP4 video in a phone-portrait-orientation overlay whenever the user visits a configured website. The player floats over the page, can be dragged to any position, and remembers its position across sessions via `localStorage`.

---

## Architecture

Manifest V3 Chrome extension. No background service worker required.

```
subway-surfers-extension/
├── manifest.json
├── content.js
├── options.html
├── options.js
├── video.mp4
└── icons/
```

---

## Components

### `manifest.json`
- Manifest V3
- Content script (`content.js`) injected on `<all_urls>` — URL matching handled in-script
- Permissions: `storage` (for `chrome.storage.sync`)
- `web_accessible_resources`: exposes `video.mp4` so the content script can load it via `chrome.runtime.getURL`

### `content.js`
The entire overlay lifecycle lives here.

1. On load: read configured site patterns from `chrome.storage.sync`. If the current URL matches any pattern, inject the overlay. Otherwise, do nothing.
2. For SPAs: wrap `history.pushState` / `history.replaceState` and listen to `popstate` to re-check the URL on client-side navigation. Inject or remove overlay accordingly.
3. **Overlay DOM:** append a host `<div>` to `document.body` and attach a Shadow DOM root. Everything inside the shadow root is fully isolated from the host page's CSS.
4. **Video element:** `<video>` with `loop`, `muted` (default), `autoplay`, `src = chrome.runtime.getURL('video.mp4')`. Fixed size: 200×355px (phone portrait ratio ~9:16).
5. **Custom floating controls** rendered over the video:
   - Play/Pause button
   - Seek/progress bar
   - Mute/Unmute button
   - Controls fade out after 2s of no interaction; reappear on hover or any interaction.
6. **Drag:** `mousedown` on the container records the cursor offset. `mousemove` updates `left`/`top` CSS. `mouseup` saves the new position to `localStorage`.
7. **Default position:** right-center — `left = window.innerWidth - 216px`, `top = (window.innerHeight - 355px) / 2`. Applied only when no stored position exists.
8. **z-index:** `2147483647` to always render on top.

### `options.html` / `options.js`
- Lists currently configured URL patterns (e.g. `*://reddit.com/*`)
- Add new pattern via text input
- Remove existing patterns
- Patterns saved to `chrome.storage.sync` under key `"sites"`

---

## Data Flow

### Site configuration
```
User adds pattern in options.html
  → chrome.storage.sync.set({ sites: [...] })

Page loads
  → content.js reads chrome.storage.sync.get('sites')
  → checks window.location.href against each pattern
  → match: inject overlay
  → no match: do nothing
```

### Position persistence
```
First visit (no stored position)
  → compute right-center: { x: innerWidth - 216, y: (innerHeight - 355) / 2 }
  → apply to overlay

Drag ends (mouseup)
  → localStorage.setItem('subway-surfers-position', JSON.stringify({ x, y }))

Subsequent visits
  → localStorage.getItem('subway-surfers-position')
  → if present: apply stored position (with off-screen clamp)
  → if absent: use default
```

Position is origin-scoped (per browser profile), so it is consistent across all configured sites.

### Video playback
```
Overlay injected
  → <video> loads via chrome.runtime.getURL('video.mp4')
  → autoplay, loop, muted

User interacts with controls
  → video.play() / video.pause()
  → video.muted = !video.muted
  → video.currentTime = seekValue
```

---

## Edge Cases

| Scenario | Handling |
|---|---|
| SPA navigation (React/Vue/etc.) | Intercept `pushState`/`replaceState` + `popstate`; re-check URL on each navigation |
| Host page has high z-index elements | Overlay uses `z-index: 2147483647` |
| Window resized, player goes off-screen | On inject, clamp `x`/`y` to keep player fully within viewport |
| No sites configured (fresh install) | Overlay never appears; options page shown via install-time redirect |
| Video fails to load | Silent fail — catch `error` event on `<video>`, remove overlay host div |

---

## Out of Scope

- Multiple video files / video picker
- Per-site position memory
- Keyboard shortcuts
- Extension popup UI (options accessible via right-click → Options)
