/**
 * Hand Physiotherapy BLE Measurement System -- Web Bluetooth client.
 *
 * Talks directly to a BeagleY-AI running the custom PHYSIO GATT service
 * over Bluetooth Low Energy. There is no backend and no other network
 * traffic involved in the measurement path.
 *
 * ---- BLE identifiers (must match beagley-ai/src/ble_ids.h) ----
 */
const SERVICE_UUID = "7b7b0001-8f7b-4e7b-9b7b-123456789001";
const MEASUREMENT_CHAR_UUID = "7b7b0002-8f7b-4e7b-9b7b-123456789002";
const COMMAND_CHAR_UUID = "7b7b0003-8f7b-4e7b-9b7b-123456789003";

const RESET_COMMAND = "RESET";

/**
 * Wire format of the measurement packet (16 bytes, little-endian):
 *   [0:4)   elbow_standing  float32
 *   [4:8)   elbow_laying    float32
 *   [8:12)  forearm_tilt    float32
 *   [12:16) final_rom       float32
 */
const EXPECTED_PACKET_LENGTH = 16;

/* ---- DOM references ---- */
const connectBtn = document.getElementById("connect-btn");
const resetBtn = document.getElementById("reset-btn");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const errorBanner = document.getElementById("error-banner");

const elbowStandingEl = document.getElementById("elbow-standing");
const elbowLayingEl = document.getElementById("elbow-laying");
const forearmTiltEl = document.getElementById("forearm-tilt");
const finalRomEl = document.getElementById("final-rom");

/* ---- Connection state ---- */
let bleDevice = null;
let gattServer = null;
let measurementChar = null;
let commandChar = null;

function setStatus(state, label) {
  statusDot.classList.remove("connected", "disconnected", "connecting");
  statusDot.classList.add(state);
  statusText.textContent = label;
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
}

function clearError() {
  errorBanner.hidden = true;
  errorBanner.textContent = "";
}

function formatDegrees(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--.--\u00B0";
  }
  return `${value.toFixed(2)}\u00B0`;
}

function setConnectedUiState(connected) {
  resetBtn.disabled = !connected;
  connectBtn.textContent = connected ? "Disconnect" : "Connect Bluetooth";
}

/* ------------------------------------------------------------------ */
/* Connect / disconnect                                                 */
/* ------------------------------------------------------------------ */

async function connect() {
  clearError();

  if (!navigator.bluetooth) {
    showError(
      "Web Bluetooth isn't available in this browser. Try Chrome or Edge on desktop or Android, over HTTPS."
    );
    return;
  }

  try {
    setStatus("connecting", "Bluetooth: Connecting\u2026");
    connectBtn.disabled = true;

    bleDevice = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
    });

    bleDevice.addEventListener("gattserverdisconnected", onDisconnected);

    gattServer = await bleDevice.gatt.connect();

    const service = await gattServer.getPrimaryService(SERVICE_UUID);

    measurementChar = await service.getCharacteristic(MEASUREMENT_CHAR_UUID);
    commandChar = await service.getCharacteristic(COMMAND_CHAR_UUID);

    measurementChar.addEventListener(
      "characteristicvaluechanged",
      onMeasurementNotification
    );
    await measurementChar.startNotifications();

    setStatus("connected", "Bluetooth: Connected");
    setConnectedUiState(true);
  } catch (err) {
    handleConnectError(err);
    cleanupAfterFailure();
  } finally {
    connectBtn.disabled = false;
  }
}

function handleConnectError(err) {
  const name = err && err.name;

  if (name === "NotFoundError") {
    // User cancelled the chooser, or no matching device was found.
    showError(
      "No device selected, or no BEAGLEY-PHYSIO device found nearby. Make sure the BeagleY-AI is powered on and advertising."
    );
    return;
  }

  if (name === "SecurityError") {
    showError(
      "Bluetooth access was blocked. This page must be served over HTTPS and you must interact with the Connect button directly."
    );
    return;
  }

  if (name === "NetworkError") {
    showError(
      "Couldn't establish a GATT connection to the device. Move closer and try again, or power-cycle the BeagleY-AI."
    );
    return;
  }

  if (err && /service/i.test(err.message || "") && /not found/i.test(err.message || "")) {
    showError(
      "Connected, but the physio service wasn't found on this device. Is the BeagleY-AI server running the correct firmware?"
    );
    return;
  }

  if (err && /characteristic/i.test(err.message || "") && /not found/i.test(err.message || "")) {
    showError(
      "Connected, but a required characteristic wasn't found. The BeagleY-AI firmware may be out of date."
    );
    return;
  }

  showError(`Bluetooth connection failed: ${(err && err.message) || err}`);
  // eslint-disable-next-line no-console
  console.error("BLE connect error:", err);
}

function cleanupAfterFailure() {
  setStatus("disconnected", "Bluetooth: Disconnected");
  setConnectedUiState(false);
  measurementChar = null;
  commandChar = null;
  gattServer = null;
}

function onDisconnected() {
  setStatus("disconnected", "Bluetooth: Disconnected");
  setConnectedUiState(false);
  showError("Bluetooth disconnected. Click Connect Bluetooth to reconnect.");
  measurementChar = null;
  commandChar = null;
  gattServer = null;
}

async function disconnect() {
  if (bleDevice && bleDevice.gatt && bleDevice.gatt.connected) {
    bleDevice.gatt.disconnect();
    // onDisconnected() fires via the gattserverdisconnected listener.
  } else {
    onDisconnected();
  }
}

/* ------------------------------------------------------------------ */
/* Measurement notifications                                            */
/* ------------------------------------------------------------------ */

function onMeasurementNotification(event) {
  const dataView = event.target.value;

  if (!dataView || dataView.byteLength !== EXPECTED_PACKET_LENGTH) {
    showError(
      `Received a malformed measurement packet (${
        dataView ? dataView.byteLength : 0
      } bytes, expected ${EXPECTED_PACKET_LENGTH}). Ignoring it.`
    );
    return;
  }

  try {
    const elbowStanding = dataView.getFloat32(0, true /* little-endian */);
    const elbowLaying = dataView.getFloat32(4, true);
    const forearmTilt = dataView.getFloat32(8, true);
    const finalRom = dataView.getFloat32(12, true);

    if (
      !Number.isFinite(elbowStanding) ||
      !Number.isFinite(elbowLaying) ||
      !Number.isFinite(forearmTilt) ||
      !Number.isFinite(finalRom)
    ) {
      showError("Received invalid measurement data. Ignoring this update.");
      return;
    }

    clearError();

    elbowStandingEl.textContent = formatDegrees(elbowStanding);
    elbowLayingEl.textContent = formatDegrees(elbowLaying);
    forearmTiltEl.textContent = formatDegrees(forearmTilt);
    finalRomEl.textContent = formatDegrees(finalRom);
  } catch (err) {
    showError("Failed to decode the measurement packet.");
    // eslint-disable-next-line no-console
    console.error("Packet decode error:", err);
  }
}

/* ------------------------------------------------------------------ */
/* Reset                                                                 */
/* ------------------------------------------------------------------ */

async function sendReset() {
  clearError();

  if (!commandChar || !gattServer || !gattServer.connected) {
    showError("Can't reset: not connected to the BeagleY-AI. Connect first.");
    return;
  }

  try {
    resetBtn.disabled = true;
    const encoder = new TextEncoder();
    const payload = encoder.encode(RESET_COMMAND);

    // writeValueWithResponse is the modern Web Bluetooth API for a
    // "write" (as opposed to "write-without-response") characteristic;
    // fall back to the older writeValue() on browsers that don't have it.
    if (typeof commandChar.writeValueWithResponse === "function") {
      await commandChar.writeValueWithResponse(payload);
    } else {
      await commandChar.writeValue(payload);
    }
  } catch (err) {
    showError(`Failed to send RESET command: ${(err && err.message) || err}`);
    // eslint-disable-next-line no-console
    console.error("RESET write error:", err);
  } finally {
    resetBtn.disabled = !(gattServer && gattServer.connected);
  }
}

/* ------------------------------------------------------------------ */
/* Wire up UI                                                            */
/* ------------------------------------------------------------------ */

connectBtn.addEventListener("click", () => {
  if (gattServer && gattServer.connected) {
    disconnect();
  } else {
    connect();
  }
});

resetBtn.addEventListener("click", sendReset);

setConnectedUiState(false);
