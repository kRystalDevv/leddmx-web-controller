import {
  CHARACTERISTIC_IDS,
  createBluetoothSession,
  createFeedback,
  createSidebar,
  errorMessage,
  parseColour,
  readJsonStorage,
  saveJsonStorage,
} from './shared.js';

  const storageKey = 'leddmx-friendly-settings-v1';
  const modes = [
    'Forward Dreaming', 'Backward Dreaming', 'Forward 7 Colors', 'Backward 7 Colors',
    'Forward 6 colors RD', 'Backward 6 colors RD', 'Forward 6 colors GN', 'Backward 6 colors GN',
    'Forward 6 colors BU', 'Backward 6 colors BU', 'Forward Trailing 7 Colors', 'Backward Trailing 7 Colors',
    'Forward Trailing RD', 'Backward Trailing RD', 'Forward Trailing GN', 'Backward Trailing GN',
    'Forward Trailing BU', 'Backward Trailing BU', 'Forward Streaming 7 Colors', 'Backward Streaming 7 Colors',
    'Forward stream YE / CN / VT', 'Backward stream YE / CN / VT', 'Forward stream BK / WH',
    'Open Curtain 7 Colors', 'Close Curtain 7 Colors', 'YE / CN / VT Screening',
    'Forward follow colourful', 'Backward follow colourful', 'Forward 7 Colors accumulation', 'Backward 7 Colors accumulation',
  ];
  const quickColours = ['#ff2d55', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#0a84ff', '#5856d6', '#bf5af2', '#ffffff'];
  const mode = document.querySelector('#mode');
  const colour = document.querySelector('#colour');
  const speed = document.querySelector('#speed');
  const brightness = document.querySelector('#brightness');
  const audioSource = document.querySelector('#audio-source');
  const musicSensitivity = document.querySelector('#music-sensitivity');
  const musicDetail = document.querySelector('#music-detail');
  const musicSmoothness = document.querySelector('#music-smoothness');
  let audioContext;
  let microphoneStream;
  let analyser;
  let audioTimer;
  let audioSending = false;
  let powerOn = false;
  let liveColourQueued = false;
  let lastLiveColourAt = 0;

  const { setStatus, showToast } = createFeedback();
  const connectionListeners = new Set();
  export const session = createBluetoothSession({
    characteristicIds: CHARACTERISTIC_IDS,
    requiredCharacteristics: ['ffe1'],
    onDisconnected,
  });
  const deviceName = document.querySelector('#device-name');

  function setDeviceName(name = 'Compatible LEDDMX light') {
    deviceName.textContent = name;
  }
  function setControls(connected) {
    // Preferences stay editable while disconnected. Only device actions are gated.
    for (const id of ['mode', 'speed', 'brightness', 'music-style', 'audio-source', 'music-sensitivity', 'music-detail', 'music-smoothness']) {
      const control = document.querySelector(`#${id}`);
      if (control) control.disabled = false;
    }
    colour.disabled = false;
    document.querySelectorAll('.swatch, .scene').forEach(button => { button.disabled = false; });
    document.querySelector('#disconnect').disabled = !connected;
    const reconnectButton = document.querySelector('#reconnect');
    reconnectButton.disabled = !session.canReconnect();
    reconnectButton.title = session.canReconnect()
      ? ''
      : 'After a fresh load, use Connect because this browser cannot recover previously granted Bluetooth devices.';
    document.querySelector('#start-effect').disabled = !connected;
    document.querySelector('#start-mic').disabled = !connected || Boolean(audioTimer);
    document.querySelector('#stop-mic').disabled = !connected || !audioTimer;
    document.querySelector('#power-toggle').disabled = !connected;
  }
  function asPercent(value) { return Math.max(0, Math.min(100, Number.parseInt(value, 10) || 0)); }
  function asDetail(value) { return Math.max(8, Math.min(64, Number.parseInt(value, 10) || 32)); }
  function percentByte(value) { return Math.round(asPercent(value) * 255 / 100); }
  function validColour(value) { return parseColour(value, '#ff004c'); }
  function updateSummary() {
    const index = Number.parseInt(mode.value, 10) || 1;
    const speedPercent = asPercent(speed.value);
    const brightnessPercent = asPercent(brightness.value);
    document.querySelector('#speed-value').textContent = `${speedPercent}%`;
    document.querySelector('#brightness-value').textContent = `${brightnessPercent}%`;
    const sensitivity = asPercent(musicSensitivity.value);
    document.querySelector('#music-sensitivity-value').textContent = sensitivity < 34 ? 'Loud sounds only' : sensitivity > 66 ? 'Quiet sounds too' : 'Balanced';
    document.querySelector('#music-detail-value').textContent = `${asDetail(musicDetail.value)} levels`;
    document.querySelector('#music-smoothness-value').textContent = `${asPercent(musicSmoothness.value)}%`;
    document.querySelector('#effect-summary').textContent = `Mode ${index} / ${modes[index - 1]} / ${speedPercent}% speed / ${brightnessPercent}% brightness`;
  }
  function saveSettings() {
    const settings = { colour: validColour(colour.value), mode: Number.parseInt(mode.value, 10), speed: asPercent(speed.value), brightness: asPercent(brightness.value), musicStyle: Number.parseInt(document.querySelector('#music-style').value, 10), audioSource: audioSource.value, musicSensitivity: asPercent(musicSensitivity.value), musicDetail: asDetail(musicDetail.value), musicSmoothness: asPercent(musicSmoothness.value) };
    saveJsonStorage(storageKey, settings);
  }
  function restoreSettings() {
    const saved = readJsonStorage(storageKey);
    colour.value = validColour(saved.colour);
    mode.value = modes[Number.parseInt(saved.mode, 10) - 1] ? String(saved.mode) : '1';
    speed.value = String(asPercent(saved.speed ?? 50));
    brightness.value = String(asPercent(saved.brightness ?? 100));
    document.querySelector('#music-style').value = ['0', '1', '2', '3', '4', '5', '6'].includes(String(saved.musicStyle)) ? String(saved.musicStyle) : '0';
    audioSource.value = ['microphone', 'system'].includes(saved.audioSource) ? saved.audioSource : 'microphone';
    musicSensitivity.value = String(asPercent(saved.musicSensitivity ?? 55));
    musicDetail.value = String(asDetail(saved.musicDetail ?? 32));
    musicSmoothness.value = String(asPercent(saved.musicSmoothness ?? 60));
    updateSummary();
  }
  function updateSwatches() {
    document.querySelectorAll('.swatch').forEach(button => button.classList.toggle('selected', button.dataset.colour.toLowerCase() === colour.value.toLowerCase()));
    document.documentElement.style.setProperty('--chosen-colour', colour.value);
    const hexText = document.querySelector('#hex-value');
    if (hexText) hexText.textContent = colour.value.toUpperCase();
    const previewDot = document.querySelector('#chosen-dot');
    if (previewDot) previewDot.style.background = colour.value;
  }
  async function send(frame) {
    await session.write('ffe1', frame);
  }
  function onDisconnected() {
    stopMicrophone();
    powerOn = false;
    const powerToggle = document.querySelector('#power-toggle');
    powerToggle.setAttribute('aria-pressed', 'false'); powerToggle.setAttribute('aria-checked', 'false');
    setControls(false);
    setDeviceName();
    setStatus('Not connected. You can reconnect the last light without choosing it again.');
    connectionListeners.forEach(listener => listener(false));
  }
  function finishConnection() {
    setControls(true);
    setDeviceName(session.deviceName);
    setStatus(`Connected to ${session.deviceName}.`, true);
    showToast(`Connected to ${session.deviceName}`);
    connectionListeners.forEach(listener => listener(true));
  }
  export function subscribeConnection(listener) {
    connectionListeners.add(listener);
    listener(session.connected());
    return () => connectionListeners.delete(listener);
  }
  async function connect() {
    const connectButton = document.querySelector('#connect');
    connectButton.disabled = true;
    connectButton.setAttribute('aria-busy', 'true');
    try {
      setStatus('Choose your LEDDMX light in the Bluetooth picker.');
      await session.choose();
      finishConnection();
    } catch (error) {
      setStatus(`Could not connect: ${errorMessage(error)}`);
      showToast('Could not connect', true);
    } finally {
      connectButton.disabled = false;
      connectButton.removeAttribute('aria-busy');
    }
  }
  async function reconnect() {
    const reconnectButton = document.querySelector('#reconnect');
    reconnectButton.disabled = true;
    reconnectButton.setAttribute('aria-busy', 'true');
    try {
      setStatus('Reconnecting to the previously allowed LEDDMX light...');
      await session.reconnect();
      finishConnection();
    } catch (error) {
      setStatus(`Reconnect failed: ${errorMessage(error)}`);
      showToast('Reconnect failed', true);
    } finally {
      reconnectButton.disabled = !session.canReconnect();
      reconnectButton.removeAttribute('aria-busy');
    }
  }
  async function perform(label, work) {
    try {
      await work();
      setStatus(`${label} sent to ${session.deviceName}.`, true);
      showToast(`${label} applied`);
      return true;
    } catch (error) {
      setStatus(`Could not send command: ${errorMessage(error)}`, session.connected());
      showToast(`Could not apply ${label.toLowerCase()}`, true);
      return false;
    }
  }

  modes.forEach((name, index) => {
    const option = document.createElement('option');
    option.value = String(index + 1);
    option.textContent = `${index + 1}. ${name}`;
    mode.append(option);
  });
  quickColours.forEach(value => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'swatch'; button.dataset.colour = value; button.style.setProperty('--swatch-colour', value);
    button.title = value; button.setAttribute('aria-label', `Choose ${value}`); button.disabled = false;
    button.onclick = () => { colour.value = value; updateSwatches(); syncWheelFromColour(); clearActiveScene(); saveSettings(); queueLiveColour(); };
    document.querySelector('#swatches').append(button);
  });
  async function sendColour() {
    const value = validColour(colour.value);
    const rgb = [1, 3, 5].map(offset => Number.parseInt(value.slice(offset, offset + 2), 16));
    await send([0x7B, 0xFF, 0x07, ...rgb, 0x00, 0xFF, 0xBF]);
  }
  async function sendBrightnessOnly() {
    const brightnessPercent = asPercent(brightness.value);
    await send([0x7B, 0xFF, 0x01, Math.floor(brightnessPercent * 32 / 100), brightnessPercent, 0x00, 0xFF, 0xFF, 0xBF]);
  }
  function queueLiveColour() {
    if (!session.connected() || liveColourQueued) return;
    liveColourQueued = true;
    const delay = Math.max(0, 100 - (Date.now() - lastLiveColourAt));
    window.setTimeout(async () => {
      liveColourQueued = false;
      lastLiveColourAt = Date.now();
      try { await sendColour(); }
      catch (error) { showToast('Live colour update failed', true); }
    }, delay);
  }
  function clearActiveScene() { document.querySelectorAll('.scene.active').forEach(item => item.classList.remove('active')); }
  function wait(milliseconds) { return new Promise(resolve => window.setTimeout(resolve, milliseconds)); }
  async function sendEffect() {
    const effect = Number.parseInt(mode.value, 10);
    const speedByte = percentByte(speed.value);
    const brightnessPercent = asPercent(brightness.value);
    if (!Number.isInteger(effect) || effect < 1 || effect > modes.length) throw new Error('Choose a valid effect.');
    await send([0x7B, 0xFF, 0x02, speedByte, 0x01, 0xFF, 0xFF, 0xFF, 0xBF]);
    await wait(45);
    await send([0x7B, 0xFF, 0x01, Math.floor(brightnessPercent * 32 / 100), brightnessPercent, 0x00, 0xFF, 0xFF, 0xBF]);
    await wait(45);
    await send([0x7B, 0xFF, 0x03, effect, 0xFF, 0xFF, 0xFF, 0xFF, 0xBF]);
  }
  async function sendMusicSettings() {
    const musicMode = Number.parseInt(document.querySelector('#music-style').value, 10);
    const sensitivity = percentByte(musicSensitivity.value);
    if (!Number.isInteger(musicMode) || musicMode < 0 || musicMode > 255) throw new Error('Choose a valid music style.');
    await send([0x7B, 0x16, 0x00, sensitivity, 0xFF, 0xFF, 0xFF, 0xFF, 0xBF]);
    await wait(45);
    // The light's native music settings are 0–3. Later styles are built by this page,
    // so keep the device itself on a known native setting before sending RGB frames.
    await send([0x7B, 0x16, 0x01, Math.min(musicMode, 3), 0xFF, 0xFF, 0xFF, 0xFF, 0xBF]);
  }
  function hslToRgb(hue, saturation, lightness) {
    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
    const match = lightness - chroma / 2;
    const [red, green, blue] = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x] : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x];
    return [red, green, blue].map(value => Math.round((value + match) * 255));
  }
  function setMusicState(message, level = 0) {
    document.querySelector('#music-state').textContent = message;
    document.querySelector('#music-meter').style.width = `${Math.round(Math.max(0, Math.min(1, level)) * 100)}%`;
  }
  function stopMicrophone(reason = 'Audio reaction is off. Start it to see the input meter and send light reactions.') {
    if (audioTimer) window.clearInterval(audioTimer);
    audioTimer = undefined;
    audioSending = false;
    microphoneStream?.getTracks().forEach(track => track.stop());
    microphoneStream = undefined;
    audioContext?.close();
    audioContext = undefined;
    analyser = undefined;
    const stop = document.querySelector('#stop-mic');
    if (stop) stop.disabled = true;
    const start = document.querySelector('#start-mic');
    if (start) start.disabled = !session.connected();
    setMusicState(reason);
  }
  async function startAudioReaction() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Audio capture is unavailable here. Open this page from http://127.0.0.1:8765, not file://.');
    stopMicrophone('Preparing audio input...');
    await sendMusicSettings();
    const usingSystemAudio = audioSource.value === 'system';
    if (usingSystemAudio) {
      if (!navigator.mediaDevices.getDisplayMedia) throw new Error('This Chromium build cannot capture shared tab or system audio. Choose Microphone instead.');
      microphoneStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, systemAudio: 'include', windowAudio: 'system', selfBrowserSurface: 'exclude', surfaceSwitching: 'include' });
      if (!microphoneStream.getAudioTracks().length) {
        microphoneStream.getTracks().forEach(track => track.stop());
        microphoneStream = undefined;
        throw new Error('No shared audio was provided. In Chromium, choose the tab playing sound and enable Share tab audio or Share system audio.');
      }
      microphoneStream.getVideoTracks().forEach((track) => track.stop());
    } else {
      microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: { autoGainControl: false, echoCancellation: false, noiseSuppression: false } });
    }
    microphoneStream.getAudioTracks().forEach(track => track.addEventListener('ended', () => stopMicrophone(`${usingSystemAudio ? 'Shared playback' : 'Microphone'} access ended. Start it again to resume.`)));
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Audio analysis is unavailable in this browser.');
    audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(microphoneStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    // Keep the input responsive; the user-facing fade slider smooths the light output.
    analyser.smoothingTimeConstant = 0.25;
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    let lastSentAt = 0;
    let smoothHue;
    let smoothLevel;
    let lightIsDark = false;
    let recentAudioPeak = .12;
    const reactToAudio = async () => {
      if (!analyser) return;
      if (!session.connected()) { stopMicrophone('Microphone reaction stopped because the light disconnected.'); return; }
      analyser.getByteTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, value) => sum + (value - 128) ** 2, 0) / samples.length) / 128;
      const peak = Math.max(...samples.map(value => Math.abs(value - 128))) / 128;
      // RMS keeps sustained sound steady while a little peak signal catches short beats.
      const inputLevel = Math.min(1, (rms * .72 + peak * .28) * 20);
      const threshold = (100 - asPercent(musicSensitivity.value)) / 100 * .14;
      const level = Math.max(0, Math.min(1, (inputLevel - threshold) / Math.max(.04, 1 - threshold)));
      // Scale against the recent loudest sound, so ordinary playback uses the available
      // brightness range instead of looking like only a few on/off levels.
      recentAudioPeak = Math.max(level, recentAudioPeak * .992);
      const relativeLevel = Math.min(1, level / Math.max(.08, recentAudioPeak));
      const detail = asDetail(musicDetail.value);
      const steppedLevel = Math.round(relativeLevel * (detail - 1)) / (detail - 1);
      const sourceName = usingSystemAudio ? 'shared playback' : 'microphone';
      const style = Number.parseInt(document.querySelector('#music-style').value, 10) || 0;
      const volumeBrightness = style === 4;
      setMusicState(level > .015
        ? (volumeBrightness ? `Listening to ${sourceName}. The selected colour is brightening with the sound level.` : `Listening to ${sourceName} and sending a colour response to the light.`)
        : (volumeBrightness ? `Listening to ${sourceName}. It is quiet, so the light is dark.` : `Listening to ${sourceName}. Raise the volume or move sensitivity right to trigger the light.`), inputLevel);
      if (audioSending || Date.now() - lastSentAt < 110) return;
      if (level < .015) {
        if (!volumeBrightness || lightIsDark) return;
        lastSentAt = Date.now();
        audioSending = true;
        try {
          await send([0x7B, 0xFF, 0x07, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xBF]);
          smoothLevel = 0;
          lightIsDark = true;
        } catch (error) {
          stopMicrophone(`Audio reaction stopped because the Bluetooth write failed: ${errorMessage(error)}`);
        } finally { audioSending = false; }
        return;
      }
      lastSentAt = Date.now();
      audioSending = true;
      const targetHue = style === 1 ? (Date.now() / 16 + steppedLevel * 110) % 360 : style === 2 ? (steppedLevel > .16 ? 45 : 280) : style === 3 ? 210 : style === 5 ? 8 + steppedLevel * 36 : style === 6 ? 195 + steppedLevel * 38 : (Date.now() / 22 + steppedLevel * 180) % 360;
      const fade = asPercent(musicSmoothness.value) / 100;
      smoothHue ??= targetHue;
      smoothLevel ??= level;
      const blend = 1 - fade * .82;
      const hueDifference = ((targetHue - smoothHue + 540) % 360) - 180;
      smoothHue = (smoothHue + hueDifference * blend + 360) % 360;
      smoothLevel += (steppedLevel - smoothLevel) * blend;
      const [red, green, blue] = volumeBrightness
        ? [1, 3, 5].map(offset => Math.round(Number.parseInt(validColour(colour.value).slice(offset, offset + 2), 16) * Math.min(1, smoothLevel ** .72)))
        : hslToRgb(smoothHue, style === 6 ? .72 : .9, .18 + smoothLevel * .48);
      try {
        await send([0x7B, 0xFF, 0x07, red, green, blue, 0x00, 0xFF, 0xBF]);
        lightIsDark = false;
      } catch (error) {
        stopMicrophone(`Microphone reaction stopped because the Bluetooth write failed: ${errorMessage(error)}`);
      } finally { audioSending = false; }
    };
    audioTimer = window.setInterval(() => { void reactToAudio(); }, 45);
    document.querySelector('#stop-mic').disabled = false;
    document.querySelector('#start-mic').disabled = true;
    setMusicState(usingSystemAudio ? 'Listening to shared playback. Start audio in the source you shared.' : 'Listening. Make a sound near the microphone to trigger the light.');
  }
  document.querySelector('#connect').onclick = connect;
  document.querySelector('#reconnect').onclick = reconnect;
  document.querySelector('#disconnect').onclick = () => session.disconnect();
  document.querySelector('#start-effect').onclick = () => perform('Effect', sendEffect);
  document.querySelector('#power-toggle').onclick = async () => {
    const next = !powerOn;
    const ok = await perform(next ? 'Power on' : 'Power off', () => send([0x7B, 0xFF, 0x04, next ? 0x01 : 0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xBF]));
    if (ok) { powerOn = next; document.querySelector('#power-toggle').setAttribute('aria-pressed', String(powerOn)); document.querySelector('#power-toggle').setAttribute('aria-checked', String(powerOn)); }
  };
  document.querySelector('#start-mic').onclick = () => perform('Music reaction', startAudioReaction);
  document.querySelector('#stop-mic').onclick = () => { stopMicrophone('Audio reaction stopped by you.'); setStatus('Audio reaction stopped.', session.connected()); showToast('Music reaction stopped'); };
  for (const control of [mode, speed, brightness, document.querySelector('#music-style'), audioSource, musicSensitivity, musicDetail, musicSmoothness]) control.addEventListener('input', () => { updateSummary(); updateSwatches(); saveSettings(); });
  restoreSettings(); updateSwatches(); setControls(false);


  // HSV colour wheel with pointer and keyboard input.
  const colourWheel = document.querySelector('#colour-wheel');
  const wheelCanvas = document.querySelector('#colour-wheel-canvas');
  const pickColour = document.querySelector('#pick-colour');

  function hsvToRgb(h, s, v = 1) {
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    let rgb;
    if (h < 60) rgb = [c, x, 0];
    else if (h < 120) rgb = [x, c, 0];
    else if (h < 180) rgb = [0, c, x];
    else if (h < 240) rgb = [0, x, c];
    else if (h < 300) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    return rgb.map(n => Math.round((n + m) * 255));
  }
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    return [h, max === 0 ? 0 : d / max, max];
  }
  function rgbToHex(r, g, b) {
    return '#' + [r,g,b].map(n => n.toString(16).padStart(2, '0')).join('');
  }
  function hexToRgb(hex) {
    const clean = validColour(hex).slice(1);
    return [0,2,4].map(i => parseInt(clean.slice(i, i + 2), 16));
  }
  function renderColourWheel() {
    const cssSize = 320;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.round(cssSize * dpr);
    wheelCanvas.width = size;
    wheelCanvas.height = size;
    const ctx = wheelCanvas.getContext('2d', { alpha: true });
    const image = ctx.createImageData(size, size);
    const radius = size / 2;
    const data = image.data;
    for (let y = 0; y < size; y++) {
      const dy = y + .5 - radius;
      for (let x = 0; x < size; x++) {
        const dx = x + .5 - radius;
        const dist = Math.hypot(dx, dy);
        const i = (y * size + x) * 4;
        if (dist > radius) { data[i + 3] = 0; continue; }
        const saturation = Math.min(1, dist / radius);
        const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
        const [r,g,b] = hsvToRgb(hue, saturation, 1);
        data[i] = r; data[i+1] = g; data[i+2] = b; data[i+3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }
  function setWheelPosition(hue, saturation) {
    const angle = hue * Math.PI / 180;
    const r = Math.min(1, Math.max(0, saturation)) * 50;
    const x = 50 + Math.cos(angle) * r;
    const y = 50 + Math.sin(angle) * r;
    colourWheel.style.setProperty('--wheel-x', `${x}%`);
    colourWheel.style.setProperty('--wheel-y', `${y}%`);
  }
  function syncWheelFromColour() {
    const [r,g,b] = hexToRgb(colour.value);
    const [h,s] = rgbToHsv(r,g,b);
    setWheelPosition(h,s);
    colourWheel.setAttribute('aria-valuetext', colour.value.toUpperCase());
  }
  function chooseFromWheel(clientX, clientY) {
    const rect = colourWheel.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const radius = rect.width / 2;
    const distance = Math.min(radius, Math.hypot(dx, dy));
    const saturation = distance / radius;
    const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    const [r,g,b] = hsvToRgb(hue, saturation, 1);
    colour.value = rgbToHex(r,g,b);
    setWheelPosition(hue, saturation);
    updateSwatches();
    clearActiveScene();
    saveSettings();
    queueLiveColour();
    colourWheel.setAttribute('aria-valuetext', colour.value.toUpperCase());
  }
  let draggingWheel = false;
  colourWheel.addEventListener('pointerdown', event => {
    draggingWheel = true;
    colourWheel.setPointerCapture?.(event.pointerId);
    chooseFromWheel(event.clientX, event.clientY);
  });
  colourWheel.addEventListener('pointermove', event => {
    if (draggingWheel) chooseFromWheel(event.clientX, event.clientY);
  });
  const stopWheelDrag = event => {
    if (!draggingWheel) return;
    draggingWheel = false;
    colourWheel.releasePointerCapture?.(event.pointerId);
  };
  colourWheel.addEventListener('pointerup', stopWheelDrag);
  colourWheel.addEventListener('pointercancel', stopWheelDrag);
  colourWheel.addEventListener('keydown', event => {
    if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const [r,g,b] = hexToRgb(colour.value);
    let [h,s] = rgbToHsv(r,g,b);
    if (event.key === 'ArrowLeft') h = (h + 357) % 360;
    if (event.key === 'ArrowRight') h = (h + 3) % 360;
    if (event.key === 'ArrowUp') s = Math.min(1, s + .03);
    if (event.key === 'ArrowDown') s = Math.max(0, s - .03);
    const rgb = hsvToRgb(h,s,1);
    colour.value = rgbToHex(...rgb);
    setWheelPosition(h,s); updateSwatches(); clearActiveScene(); saveSettings(); queueLiveColour();
  });

  const openNativeColourPicker = () => {
    if (typeof colour.showPicker === 'function') colour.showPicker();
    else colour.click();
  };
  pickColour.addEventListener('click', openNativeColourPicker);
  colour.addEventListener('input', () => { updateSwatches(); syncWheelFromColour(); clearActiveScene(); saveSettings(); queueLiveColour(); });

  document.querySelectorAll('[data-scene-colour]').forEach(scene => {
    scene.addEventListener('click', async () => {
      colour.value = scene.dataset.sceneColour;
      if (scene.dataset.sceneEffect) mode.value = scene.dataset.sceneEffect;
      if (scene.dataset.sceneSpeed) speed.value = scene.dataset.sceneSpeed;
      if (scene.dataset.sceneBrightness) brightness.value = scene.dataset.sceneBrightness;
      clearActiveScene();
      scene.classList.add('active');
      updateSummary(); updateSwatches(); syncWheelFromColour(); saveSettings();
      const sceneName = scene.textContent.trim();
      if (!session.connected()) { showToast(`${sceneName} selected. Connect to apply.`); return; }
      try {
        await sendColour();
        await wait(45);
        if (scene.dataset.sceneEffect) await sendEffect();
        else await sendBrightnessOnly();
        setStatus(`${sceneName} scene applied.`, true);
        showToast(`${sceneName} scene applied`);
      } catch (error) {
        setStatus(`Could not apply scene: ${errorMessage(error)}`, session.connected());
        showToast(`Could not apply ${sceneName}`, true);
      }
    });
  });
  document.querySelector('#custom-scene').addEventListener('click', openNativeColourPicker);

  createSidebar({
    buttonSelector: '#menu-toggle',
    linkSelector: '.sidebar a',
    storageKey: 'leddmx-sidebar-collapsed',
  });


  const musicAdvanced = document.querySelector('#music-advanced');
  function syncMusicDisclosure() {
    if (window.matchMedia('(max-width: 620px)').matches) {
      if (!musicAdvanced.dataset.mobileInitialized) { musicAdvanced.open = false; musicAdvanced.dataset.mobileInitialized = '1'; }
    } else {
      musicAdvanced.open = true; delete musicAdvanced.dataset.mobileInitialized;
    }
  }
  syncMusicDisclosure();
  window.addEventListener('resize', syncMusicDisclosure);

  renderColourWheel();
  syncWheelFromColour();
  updateSwatches();
  window.addEventListener('pagehide', () => {
    stopMicrophone();
    session.disconnect();
  });
