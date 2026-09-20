const SERVICE_ID = '0000ffe0-0000-1000-8000-00805f9b34fb';

export const CHARACTERISTIC_IDS = Object.freeze({
  ffe1: '0000ffe1-0000-1000-8000-00805f9b34fb',
  ffe2: '0000ffe2-0000-1000-8000-00805f9b34fb',
});

export function errorMessage(error, fallback = 'Something went wrong.') {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}

export function getRequiredElement(selector, root = document) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Required interface element not found: ${selector}`);
  return element;
}

export function createFeedback({ statusSelector = '#status', toastSelector = '#toast' } = {}) {
  const status = document.querySelector(statusSelector);
  const toast = document.querySelector(toastSelector);
  let toastTimer;

  function setStatus(message, connected = false) {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('connected', connected);
    const dot = document.createElement('span');
    dot.className = `live-dot${connected ? ' on' : ''}`;
    dot.setAttribute('aria-hidden', 'true');
    status.prepend(dot);
  }

  function showToast(message, isError = false) {
    if (!toast) return;
    toast.setAttribute('role', isError ? 'alert' : 'status');
    toast.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2200);
  }

  return { setStatus, showToast };
}

export function createSidebar({
  buttonSelector,
  overlaySelector = '#sidebar-overlay',
  linkSelector = '.nav a',
  storageKey,
  breakpoint = 900,
}) {
  const button = document.querySelector(buttonSelector);
  const overlay = document.querySelector(overlaySelector);
  if (!button || !overlay) return { close() {} };

  const mobileMenu = window.matchMedia(`(max-width: ${breakpoint}px)`);
  const isMobile = () => mobileMenu.matches;

  function syncAria() {
    const expanded = isMobile()
      ? document.body.classList.contains('menu-open')
      : !document.body.classList.contains('sidebar-collapsed');
    button.setAttribute('aria-expanded', String(expanded));
  }

  function close({ restoreFocus = false } = {}) {
    const wasOpen = document.body.classList.contains('menu-open');
    document.body.classList.remove('menu-open');
    syncAria();
    if (restoreFocus && wasOpen) button.focus();
  }

  function toggle() {
    if (isMobile()) {
      document.body.classList.toggle('menu-open');
    } else {
      document.body.classList.toggle('sidebar-collapsed');
      saveStorage(storageKey, document.body.classList.contains('sidebar-collapsed') ? '1' : '0');
    }
    syncAria();
  }

  if (!isMobile() && readStorage(storageKey) === '1') {
    document.body.classList.add('sidebar-collapsed');
  }

  button.addEventListener('click', toggle);
  overlay.addEventListener('click', () => close());
  document.querySelectorAll(linkSelector).forEach((link) => {
    link.addEventListener('click', () => {
      if (isMobile()) close();
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isMobile()) close({ restoreFocus: true });
  });

  const handleLayoutChange = () => close();
  if (typeof mobileMenu.addEventListener === 'function') {
    mobileMenu.addEventListener('change', handleLayoutChange);
  } else {
    mobileMenu.addListener?.(handleLayoutChange);
  }

  syncAria();
  return { close, syncAria };
}

export function createBluetoothSession({
  characteristicIds,
  requiredCharacteristics = [],
  onDisconnected = () => {},
}) {
  let device;
  let characteristics = new Map();

  function ensureSupport() {
    if (!window.isSecureContext) {
      throw new Error('Web Bluetooth requires HTTPS or a localhost address. This page cannot connect from an insecure origin.');
    }
    if (!navigator.bluetooth?.requestDevice) {
      throw new Error('Web Bluetooth is unavailable in this browser. Use a current Chromium-based browser on desktop or Android.');
    }
  }

  function handleDisconnected() {
    characteristics = new Map();
    onDisconnected();
  }

  async function connect(candidate) {
    ensureSupport();
    if (!candidate?.gatt) throw new Error('The selected device does not expose a Bluetooth GATT connection.');

    try {
      const server = candidate.gatt.connected ? candidate.gatt : await candidate.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_ID);
      const found = await service.getCharacteristics();
      const nextCharacteristics = new Map();

      for (const [key, uuid] of Object.entries(characteristicIds)) {
        const characteristic = found.find((item) => item.uuid.toLowerCase() === uuid.toLowerCase());
        if (characteristic?.properties.writeWithoutResponse) nextCharacteristics.set(key, characteristic);
      }

      for (const key of requiredCharacteristics) {
        if (!nextCharacteristics.has(key)) {
          throw new Error(`${key.toUpperCase()} is unavailable or does not support write-without-response.`);
        }
      }

      device?.removeEventListener?.('gattserverdisconnected', handleDisconnected);
      device = candidate;
      characteristics = nextCharacteristics;
      device.addEventListener('gattserverdisconnected', handleDisconnected, { once: true });
      return device;
    } catch (error) {
      if (candidate.gatt.connected) candidate.gatt.disconnect();
      throw error;
    }
  }

  async function choose() {
    ensureSupport();
    const candidate = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SERVICE_ID],
    });
    return connect(candidate);
  }

  async function reconnect() {
    ensureSupport();
    if (device) return connect(device);
    if (typeof navigator.bluetooth.getDevices !== 'function') {
      throw new Error('This browser cannot reconnect automatically. Use Connect and choose the light again.');
    }
    const granted = await navigator.bluetooth.getDevices();
    if (!granted.length) throw new Error('No previously allowed Bluetooth light was found. Use Connect.');
    let lastError;
    for (const candidate of granted) {
      try {
        return await connect(candidate);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('No previously allowed LEDDMX-compatible light was found. Use Connect.');
  }

  function characteristic(key) {
    const value = characteristics.get(key);
    if (!value) throw new Error(`${key.toUpperCase()} is not available on this connected light.`);
    return value;
  }

  function hasCharacteristic(key) {
    return characteristics.has(key);
  }

  async function write(key, frame, maximumLength = 512) {
    validateFrame(frame, maximumLength);
    if (!connected()) throw new Error('Connect the light first.');
    await characteristic(key).writeValueWithoutResponse(new Uint8Array(frame));
  }

  function connected() {
    return Boolean(device?.gatt?.connected);
  }

  function disconnect() {
    if (connected()) device.gatt.disconnect();
  }

  return {
    choose,
    reconnect,
    connect,
    disconnect,
    connected,
    canReconnect: () => Boolean(device) || typeof navigator.bluetooth?.getDevices === 'function',
    characteristic,
    hasCharacteristic,
    write,
    get deviceName() { return device?.name || 'the light'; },
  };
}

function validateFrame(frame, maximumLength = 512) {
  if (!Array.isArray(frame) || !frame.length || frame.length > maximumLength
    || frame.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    throw new Error('Invalid Bluetooth frame.');
  }
}

export function parseByte(value, label, { minimum = 0, maximum = 255 } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${label} must be a whole number from ${minimum} to ${maximum}.`);
  }
  return parsed;
}

export function parseColour(value, fallback) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  if (fallback !== undefined) return fallback;
  throw new Error('Choose a valid colour.');
}

export function formatHexFrame(frame) {
  return frame.map((value) => value.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

function readStorage(key, fallback = null) {
  if (!key) return fallback;
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch (_) {
    return fallback;
  }
}

function saveStorage(key, value) {
  if (!key) return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (_) {
    return false;
  }
}

export function readJsonStorage(key, fallback = {}) {
  try {
    return JSON.parse(readStorage(key, '') || JSON.stringify(fallback));
  } catch (_) {
    return fallback;
  }
}

export function saveJsonStorage(key, value) {
  return saveStorage(key, JSON.stringify(value));
}

export async function copyText(value) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const fallback = document.createElement('textarea');
  fallback.value = value;
  fallback.readOnly = true;
  fallback.style.position = 'fixed';
  fallback.style.opacity = '0';
  document.body.append(fallback);
  fallback.select();
  const copied = document.execCommand?.('copy');
  fallback.remove();
  if (!copied) throw new Error('Clipboard access is unavailable. Select and copy the command manually.');
}
