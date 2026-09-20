# XKY LEDDMX

XKY LEDDMX is a dependency-free, private-by-design browser controller for compatible LEDDMX Bluetooth lights. It keeps control, microphone processing, and shared-playback audio in the browser; it has no accounts, analytics, uploads, or remote-control service.

**Live controller:** [leddmx.63xky.com](https://leddmx.63xky.com)

## What it does

- Controls whole-strip colour, effects, brightness, speed, scenes, and power
- Reacts to microphone or browser-shared audio locally
- Keeps Easy and Advanced controls in one page, preserving the Bluetooth session when switching views
- Provides validated raw `7B` / `7E` frame tools and a local sent-command log
- Uses no framework or runtime dependency

## Compatibility and privacy

This is an independent XKY project, not affiliated with or endorsed by LEDDMX device manufacturers or the LEDLAMP application. Compatibility is derived from observed Bluetooth traffic; no LEDLAMP code was copied or decompiled. Controller behaviour can vary between hardware models.

Bluetooth commands travel directly from the browser to the device selected in the browser picker. Music reaction processes audio locally; nothing is uploaded or recorded. Leaving the controller, reloading, or closing the tab stops audio capture and releases the GATT connection on a best-effort basis.

The project supports the observed FFE0 Bluetooth service and writable FFE1/FFE2 characteristics. The known whole-strip RGB frame is `7B FF 07 RR GG BB 00 FF BF`.

## Run locally

Use a current Chromium-based browser and serve the directory instead of opening the HTML file directly:

```powershell
python -m http.server 8765
```

Then open `http://127.0.0.1:8765/`. Web Bluetooth and audio capture require localhost or HTTPS.

## Deploy to Cloudflare Pages

Deploy this repository root as a static site and attach `leddmx.63xky.com`. The checked-in [`_headers`](_headers) policy permits only same-origin resources and the Bluetooth, microphone, and display-capture browser capabilities this controller needs. It also blocks framing, MIME sniffing, and unrelated browser permissions.

No build command is required. Confirm that the custom domain is served over HTTPS before testing Bluetooth or audio capture.

## Project layout

```text
index.html                     XKY LEDDMX controller shell and Easy controls
advanced.html                  Backward-compatible redirect to #advanced
assets/advanced-view.fragment  Readable Advanced-controls partial
assets/js/app.js               Hash routing and lazy Advanced view loading
assets/js/home.js              Shared Bluetooth session and Easy controls
assets/js/advanced.js          Advanced BLE controls
_headers                       Cloudflare Pages security headers
```

## Verification boundaries

Source and browser-route checks can confirm page loading, policy compatibility, and UI behavior. They cannot prove that a particular lamp firmware accepts every command, or that microphone/system-audio capture works on every operating system. Test those functions with the target browser and physical controller before relying on them in a live setting.

## License

Released under the [MIT License](LICENSE). Copyright © 2026 63xky.
