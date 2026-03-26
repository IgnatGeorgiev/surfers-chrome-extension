# Subway Surfers Extension

A Chrome extension that plays a video in a draggable phone-portrait overlay on any website you choose. Born from the noble tradition of watching Subway Surfers while doing literally anything else.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-brightgreen)

---

## Features

- **Phone-portrait overlay** — 200×355px (9:16) video player floats over any page
- **Draggable** — click and drag to move it anywhere; position is remembered across sessions and sites
- **Floating controls** — play/pause, seek bar, mute — fade out when idle, reappear on hover
- **Configurable** — choose which sites trigger the overlay via a simple options page
- **SPA-aware** — works on React/Vue/Next.js apps that navigate without full page reloads (Reddit, YouTube, etc.)
- **Shadow DOM isolation** — the overlay's styles never interfere with the host page

---

## Installation

1. Clone or download this repo
2. Place your `video.mp4` in the project root (any MP4 works)
3. Open Chrome and go to `chrome://extensions`
4. Enable **Developer mode** (toggle in the top-right corner)
5. Click **Load unpacked** and select this folder
6. The options page will open automatically — add your first site

---

## Usage

### Adding sites

Right-click the extension icon → **Options**, or navigate to `chrome://extensions` and click the extension's **Details → Extension options**.

Enter a URL pattern and click **Add**:

| Pattern | Matches |
|---|---|
| `*://reddit.com/*` | All of Reddit (http and https) |
| `https://youtube.com/*` | YouTube (https only) |
| `http://localhost/*` | Local dev server |
| `*://news.ycombinator.com/*` | Hacker News |

Patterns follow Chrome's [match pattern syntax](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns): `scheme://host/path`. Supported schemes: `*`, `http`, `https`, `ftp`.

### Using the overlay

Once you visit a configured site, the overlay appears on the right side of the screen:

- **Drag** it anywhere by clicking and dragging on the video itself
- **Hover** to reveal controls
- **Play/Pause** — toggle playback
- **Seek** — scrub through the video
- **Mute/Unmute** — toggle sound (starts muted by default)
- **✕** — close the overlay for this page visit

Your position is saved automatically and restored on your next visit.

---

## Development

### Project structure

```
subway-surfers-extension/
├── manifest.json       # Extension config (Manifest V3)
├── background.js       # Service worker — opens options on first install
├── content.js          # Overlay injection, controls, drag, SPA navigation
├── options.html        # Options page UI
├── options.js          # Options page logic
├── video.mp4           # The video to play (not tracked in git)
├── icons/              # Extension icons (16, 48, 128px)
└── tests/
    ├── utils.js        # Pure utility functions (exported for testing)
    └── utils.test.js   # Jest unit tests
```

### Running tests

```bash
npm install
npm test
```

21 unit tests covering pattern matching, validation, and position clamping.

### Reloading after changes

Go to `chrome://extensions` and click the **↺ reload** button on the extension card. Then refresh the target page.

---

## How it works

The content script is injected on every page and checks the current URL against your configured patterns. On a match, it creates a `<div>` with a Shadow DOM root and injects the video player inside — fully isolated from the host page's CSS.

Position is stored in `chrome.storage.local` (extension-scoped), so it's consistent across all your configured sites regardless of their origin.

For single-page apps, the script wraps `history.pushState` and `history.replaceState` and listens to `popstate`/`hashchange` to re-check the URL on every client-side navigation.

---

## Customising the video

Replace `video.mp4` with any MP4 file and reload the extension. The video plays muted and looped by default.

---

## License

MIT
