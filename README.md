# LEDDMX Web Controller

A dependency-free static controller for compatible LEDDMX Bluetooth lights.

Use a Chromium-based browser to control colour, effects, brightness, speed, scenes, power, and music reactions. The advanced page provides lower-level BLE commands for testing.

## Live Demo

**https://leddmx.63xky.com**

## Features

- Web Bluetooth connection to LEDDMX devices
- RGB colour wheel and quick colours
- Effects, speed, brightness, and power controls
- Quick scenes
- Music reaction using microphone or shared audio
- Responsive desktop and mobile interface
- Local browser settings
- Advanced `7B` and `7E` BLE controls
- FFE1 / FFE2 write-channel support
- Raw hexadecimal command sender
- Command log
- No frameworks or runtime dependencies

## Project Structure

```text
.
├── index.html                  Easy controls
├── advanced.html               Advanced protocol controls
└── assets
    ├── css
    │   ├── shared.css          Shared layout and accessibility rules
    │   ├── home.css            Easy-controls styles
    │   └── advanced.css        Advanced-controls styles
    ├── favicon.svg             Site icon
    └── js
        ├── shared.js           Shared Bluetooth and UI utilities
        ├── home.js             Easy-controls behavior
        └── advanced.js         Advanced-controls behavior
```

## Run Locally

Serve the project through localhost instead of opening the HTML files directly.

```powershell
python -m http.server 8765
```

Then open:

```text
http://127.0.0.1:8765/
```

Use a compatible Chromium-based browser.

Web Bluetooth requires a secure context. Localhost works for development, while production deployments must use HTTPS.

## Deploy

This is a fully static project and can be hosted on GitHub Pages, Cloudflare Pages, Netlify, Vercel, or any HTTPS-capable web server.

Place `index.html` at the site root.

Recommended response headers:

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'

Referrer-Policy: strict-origin-when-cross-origin

X-Content-Type-Options: nosniff

Permissions-Policy: bluetooth=(self), microphone=(self), display-capture=(self)
```

## Bluetooth

Primary BLE service:

```text
0000FFE0-0000-1000-8000-00805F9B34FB
```

Primary write characteristic:

```text
0000FFE1-0000-1000-8000-00805F9B34FB
```

Some devices may also expose `FFE2`.

Commands use BLE **write without response**.

## Privacy

Bluetooth commands go directly from the browser to the selected device.

Music Reaction processes microphone or shared playback audio locally. Nothing is uploaded or recorded. Shared playback uses the browser's screen-sharing picker because that is how Chromium grants tab or system audio; the app stops the unused video track immediately after it receives audio.

## Browser Support

Web Bluetooth is currently limited to compatible Chromium-based browsers and operating systems. The controller explains when Bluetooth, secure-context, or audio-capture support is unavailable.

## Disclaimer

This independent project is not affiliated with or endorsed by LEDDMX device manufacturers or the LEDLAMP application. Compatibility was derived from observed BLE traffic; no LEDLAMP code was copied or decompiled.

Protocol behaviour may vary between controller models.

## License

Released under the [MIT License](LICENSE).
