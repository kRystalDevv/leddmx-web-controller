# LEDDMX Web Controller

A responsive browser-based controller for LEDDMX Bluetooth lights.

Control colours, lighting effects, brightness, speed, scenes, and music reactions directly from a compatible browser using the Web Bluetooth API. An advanced controller is also included for direct BLE command testing and native LEDDMX protocol controls.

## Live Demo

**https://leddmx.63xky.com**

> Web Bluetooth requires a compatible Chromium-based browser and a secure HTTPS connection.

## Features

- Web Bluetooth connection to LEDDMX devices
- RGB colour picker with live preview
- Quick colour presets
- Lighting effects
- Speed and brightness controls
- Power control
- Quick scenes
- Music reaction using microphone or shared system audio
- Audio sensitivity and smoothing controls
- Responsive desktop and mobile interface
- Collapsible navigation
- Connection and command feedback
- Advanced BLE controller
- FFE1 and FFE2 write-channel support
- Native `7B` and `7E` LEDDMX commands
- Raw hexadecimal BLE command sender
- Sent-command log
- Local browser preference storage

## Pages

### Main Controller

`index.html`

The user-friendly controller for normal day-to-day use.

Includes:

- Colour control
- Scenes
- Effects
- Brightness and speed
- Power
- Music reaction

### Advanced Controller

`advanced.html`

Provides lower-level access to the LEDDMX Bluetooth protocol.

Includes:

- Write-channel selection
- Native effect controls
- DIY model selection
- Raw BLE frame sender
- Command history

## Project Structure

```text
leddmx-web-controller/
├── index.html
├── advanced.html
├── css/
│   └── styles.css
├── js/
│   ├── bluetooth.js
│   ├── controller.js
│   ├── music.js
│   ├── ui.js
│   └── advanced.js
├── assets/
│   └── ...
└── README.md
