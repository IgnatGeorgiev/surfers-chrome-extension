# Chrome Extension: Video Overlay Player — Design Spec

**Date:** 2026-03-26

## Overview

A Chrome extension that plays a bundled MP4 video in a phone-portrait-orientation overlay whenever the user visits a configured website. The player floats over the page, can be dragged to any position, and remembers its position across sessions via `chrome.storage.local` (extension-scoped, consistent across all configured sites).

---

## Architecture

Manifest V3 Chrome extension.

```
subway-surfers-extension/
├── manifest.json
├── background.js       # minimal service worker (install-time redirect only)
├── content.js
├── options.html
├── options.js
├── video.mp4
└── icons/
      ├── icon16.png
      ├── icon48.png
      └── icon128.png
```

---

## Constants

```js
const POSITION_KEY = 'subway-surfers-position';   // chrome.storage.local key
const SITES_KEY    = 'sites';                      // chrome.storage.sync key
```

Both `content.js` and `options.js` use these same key names.

---

## Components

### `manifest.json`
- Manifest V3
- Content script (`content.js`) injected on `<all_urls>` — URL matching handled in-script
- Permissions: `storage`
- `host_permissions`: `["<all_urls>"]` — required for `<all_urls>` content script injection and Chrome Web Store submission
- `web_accessible_resources`:
  ```json
  [{ "resources": ["video.mp4"], "matches": ["<all_urls>"] }]
  ```
- Service worker: `background.js`
- `options_ui`: `{ "page": "options.html", "open_in_tab": true }` — opens as a full tab; accessible via right-click → Options

### `background.js`
Minimal service worker. Sole responsibility: on `chrome.runtime.onInstalled` with reason `"install"`, open the options page via `chrome.runtime.openOptionsPage()` so the user can configure their first site pattern.

### `content.js`
The entire overlay lifecycle lives here.

**Activation:**
1. On load: read configured site patterns from `chrome.storage.sync` using `SITES_KEY`. Check current URL against each pattern. If a match is found, inject the overlay. Otherwise, do nothing.
2. **SPA navigation:** Wrap `history.pushState` and `history.replaceState`; listen to `popstate` and `hashchange`. On each navigation event, re-check the URL:
   - New URL matches + overlay already present → do nothing (leave overlay in place, preserving position and playback state).
   - New URL matches + overlay not present → inject.
   - New URL does not match + overlay present → call `video.pause()`, then remove host div from DOM.
   - New URL does not match + overlay not present → do nothing.

`chrome.storage.sync` functions without the user being signed into Chrome (Chrome falls back to local storage internally), so pattern reads will always succeed offline.

**URL pattern matching:**
Only the `scheme://host/path` subset of Chrome match pattern syntax is supported. The supported schemes are `*`, `http`, `https`, and `ftp`. The `<all_urls>` token and patterns outside this subset are rejected at input time in the options page (see Validation below).

Convert each stored pattern to a `RegExp` at check time:
1. Escape all regex metacharacters except `*`: `pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')`
2. If pattern starts with `*://`, replace that prefix with `(https?|ftp)://`.
3. Replace all remaining `*` with `.*`.
4. Anchor: wrap in `^...$`.

Example: `*://reddit.com/*` → `/^(https?|ftp):\/\/reddit\.com\/.*$/`

**Overlay DOM:**
Append a host `<div>` to `document.body` and attach a Shadow DOM root. All styles and DOM inside the shadow root are isolated from the host page.

**Video element:**
`<video>` with `loop`, `muted` (default), `src = chrome.runtime.getURL('video.mp4')`. Fixed size: 200×355px (9:16 portrait ratio). Do not set the `autoplay` attribute — call `video.play()` programmatically after injection and handle the returned Promise:
```js
video.play().catch(() => {
  // Autoplay blocked: keep controls permanently visible (do not start fade timer)
  // Play button remains prominent to invite user interaction
});
```

**Custom floating controls** rendered over the video inside the shadow root:
- Close (×) button — top-right corner. On click: `video.pause()`, remove host div from DOM.
- Play/Pause toggle — calls `video.play()` or `video.pause()`
- Seek bar: `<input type="range" min="0" max="1" step="any">`. On `input` event: `video.currentTime = seekInput.value * video.duration`. Listen to `video.timeupdate` to keep the seek bar in sync with playback: `seekInput.value = video.currentTime / video.duration`.
- Mute/Unmute toggle — sets `video.muted = !video.muted`

**Controls fade behaviour:**
- Controls fade out (opacity 0, pointer-events none) 2 seconds after the last interaction.
- Interaction events that reset the 2s timer: `mousemove` on the container, `mousedown` on the container, `input` on the seek range, click on any control button.
- Controls reappear immediately on `mouseenter` on the container.
- While in the autoplay-blocked state (play() was rejected), controls never fade — the timer is not started until the user manually initiates playback.

**Drag:**
- `mousedown` on the container starts drag, **unless** the event target is a control button or the seek input (check via `event.target.closest`). Record cursor offset from the container's top-left corner.
- `mousemove` and `mouseup` listeners are attached to `document` (not the container) so fast mouse movement cannot escape the drag.
- During drag: call `event.preventDefault()` on `mousemove` to suppress text selection on the host page. Call `event.stopPropagation()` on the initial `mousedown` unconditionally at the container level (all `mousedown` on the container, whether a drag or a control click, should not propagate to the host page — all interaction is intended for the overlay).
- On `mouseup`: detach the document-level `mousemove` and `mouseup` listeners. Save position to `chrome.storage.local` using `POSITION_KEY`.

**Default position:**
Computed once when no stored position exists: `x = window.innerWidth - 216`, `y = (window.innerHeight - 355) / 2`.

**Position clamping:**
Applied whenever a position is used (both stored and default): `x = Math.max(0, Math.min(x, window.innerWidth - 200))`, `y = Math.max(0, Math.min(y, window.innerHeight - 355))`. Applied at inject time; no resize listener is needed since the overlay is repositionable by drag.

**z-index:** `2147483647` on the host container.

### `options.html` / `options.js`
- Lists currently configured URL patterns
- Add new pattern via text input with validation (see below)
- Remove existing patterns via a delete button per row
- Patterns saved to `chrome.storage.sync` under `SITES_KEY` (array of strings)

**Pattern validation** (run before saving):
- Must match the regex `/^(https?|ftp|\*):\/\//` — rejects `<all_urls>`, bare hostnames, and malformed input.
- Must not be empty.
- Display an inline error message on failure; do not save.

---

## Data Flow

### Site configuration
```
User adds pattern in options.html (passes validation)
  → chrome.storage.sync.set({ [SITES_KEY]: [...] })

Page loads
  → content.js reads chrome.storage.sync.get(SITES_KEY)
  → converts each pattern to RegExp
  → tests window.location.href
  → match: inject overlay
  → no match: do nothing
```

### Position persistence
```
First visit (no stored position)
  → compute right-center: { x: innerWidth - 216, y: (innerHeight - 355) / 2 }
  → clamp to viewport bounds
  → apply to overlay

Drag ends (mouseup)
  → chrome.storage.local.set({ [POSITION_KEY]: { x, y } })

Subsequent visits
  → chrome.storage.local.get(POSITION_KEY)
  → if present: clamp to current viewport bounds, apply
  → if absent: use default
```

Position is stored in `chrome.storage.local` (extension-scoped), so it is consistent across all configured sites regardless of their origin.

### Video playback
```
Overlay injected
  → <video> loads via chrome.runtime.getURL('video.mp4')
  → video.play() called
  → on fulfil: start controls fade timer
  → on rejection: keep controls visible (autoplay-blocked state)

User interacts with controls
  → play/pause: video.play() / video.pause()
  → seek: video.currentTime = seekInput.value * video.duration
  → seek sync: video.timeupdate → seekInput.value = currentTime / duration
  → mute: video.muted = !video.muted

User clicks close (×) or SPA navigates away
  → video.pause()
  → host div removed from document.body
```

---

## Edge Cases

| Scenario | Handling |
|---|---|
| SPA navigation, URL stays matching | Overlay left in place, no reinject |
| SPA navigation, URL stops matching | `video.pause()`, remove host div |
| SPA navigation, URL starts matching | Inject overlay as normal |
| Hash-router SPA (`#/path`) | `hashchange` event also intercepted |
| Host page has high z-index elements | Overlay uses `z-index: 2147483647` |
| Window resized, stored position off-screen | Clamp applied at inject time |
| Autoplay blocked by browser | `play()` rejection caught; controls stay visible |
| No sites configured (fresh install) | `background.js` opens options page on install |
| Video fails to load (`error` event) | `video.pause()` (no-op if not started), remove host div silently |
| Fast drag escapes overlay bounds | `mousemove`/`mouseup` on `document`, not the overlay |
| User types `<all_urls>` in options | Rejected by validation, inline error shown |

---

## Out of Scope

- Multiple video files / video picker
- Per-site position memory
- Keyboard shortcuts
- Extension popup UI
- Hash-router SPA support beyond `hashchange` interception
