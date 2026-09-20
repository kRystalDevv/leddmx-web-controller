import {
  copyText,
  createFeedback,
  errorMessage,
  formatHexFrame,
  getRequiredElement,
  parseByte,
  parseColour,
} from './shared.js';
import { session, subscribeConnection } from './home.js';

const log = getRequiredElement('#log');
const writeChannel = getRequiredElement('#advanced-write-channel');
const colour = getRequiredElement('#advanced-colour');
const { setStatus, showToast } = createFeedback();

let lastFrame;
let logCount = 0;

function setConnected(connected) {
  document.querySelectorAll('[data-send-action]').forEach((element) => {
    element.disabled = !connected;
  });
}

function addLog(label, frame) {
  lastFrame = [...frame];
  logCount += 1;
  const entry = `${new Date().toLocaleTimeString()}  ${label}: ${formatHexFrame(frame)}`;
  log.textContent = log.textContent === 'No commands sent yet.' ? entry : `${entry}\n${log.textContent}`;
  getRequiredElement('#log-count').textContent = `${logCount} sent`;
  getRequiredElement('#copy-last').disabled = false;
}

function parseHexFrame(value) {
  const compact = value.replace(/0x/gi, '').replace(/\s+/g, '');
  if (!compact || !/^[0-9a-f]+$/i.test(compact) || compact.length % 2) {
    throw new Error('Use complete hexadecimal bytes, such as 7E 0E 00 50 FF FF FF FF EF.');
  }
  if (compact.length / 2 > 512) throw new Error('This frame exceeds the 512-byte Bluetooth safety limit.');
  return Array.from(
    { length: compact.length / 2 },
    (_, index) => Number.parseInt(compact.slice(index * 2, index * 2 + 2), 16),
  );
}

async function writeFrame(frame, label) {
  await session.write(writeChannel.value, frame);
  addLog(label, frame);
}

function syncCharacteristics() {
  writeChannel.value = 'ffe1';
  writeChannel.querySelector('[value="ffe2"]').disabled = !session.hasCharacteristic('ffe2');
}

async function run(label, action) {
  try {
    await action();
    setStatus(`${label} sent using the native no-response Bluetooth path.`, true);
    showToast(`${label} sent`);
    return true;
  } catch (error) {
    setStatus(`Command failed: ${errorMessage(error)}`, session.connected());
    showToast(`Could not send ${label.toLowerCase()}`, true);
    return false;
  }
}

function updateColourPreview() {
  getRequiredElement('#colour-dot').style.background = colour.value;
  getRequiredElement('#colour-hex').textContent = colour.value.toUpperCase();
}

getRequiredElement('#set-colour').addEventListener('click', () => run('Colour', async () => {
  const value = parseColour(colour.value);
  const [red, green, blue] = [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  await writeFrame([0x7B, 0xFF, 0x07, red, green, blue, 0x00, 0xFF, 0xBF], 'Whole-strip colour');
}));

getRequiredElement('#send-legacy-effect').addEventListener('click', () => run('7B effect', async () => {
  const index = parseByte(getRequiredElement('#legacy-effect').value, 'Effect index', { minimum: 1, maximum: 210 });
  await writeFrame([0x7B, 0xFF, 0x03, index, 0xFF, 0xFF, 0xFF, 0xFF, 0xBF], '7B effect');
}));

getRequiredElement('#send-native-effect').addEventListener('click', () => run('Native effect', async () => {
  const mode = parseByte(getRequiredElement('#native-mode').value, 'Mode');
  const speed = parseByte(getRequiredElement('#native-speed').value, 'Speed');
  const brightness = parseByte(getRequiredElement('#native-brightness').value, 'Brightness');
  await writeFrame([0x7E, 0x0E, mode, speed, brightness, 0xFF, 0xFF, 0xFF, 0xEF], 'Native 7E effect');
}));

getRequiredElement('#send-diy-model').addEventListener('click', () => run('Native DIY model', async () => {
  const index = parseByte(getRequiredElement('#diy-index').value, 'DIY index', { maximum: 254 });
  await writeFrame([0x7E, 0x03, index + 1, 0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xEF], 'Native DIY model');
}));

getRequiredElement('#send-raw').addEventListener('click', () => run('Raw frame', async () => {
  await writeFrame(parseHexFrame(getRequiredElement('#raw-frame').value), 'Raw frame');
}));

getRequiredElement('#copy-last').addEventListener('click', async () => {
  try {
    if (!lastFrame) throw new Error('Send a frame first.');
    await copyText(formatHexFrame(lastFrame));
    setStatus('Last sent frame copied.', session.connected());
    showToast('Last frame copied');
  } catch (error) {
    setStatus(`Could not copy: ${errorMessage(error)}`, session.connected());
    showToast('Could not copy frame', true);
  }
});

colour.addEventListener('input', updateColourPreview);
updateColourPreview();
subscribeConnection((connected) => {
  setConnected(connected);
  if (connected) syncCharacteristics();
});
