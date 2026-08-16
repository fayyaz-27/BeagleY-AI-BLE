const SERVICE_UUID =
  "7b7b0001-8f7b-4e7b-9b7b-123456789001";

const MEASUREMENT_UUID =
  "7b7b0002-8f7b-4e7b-9b7b-123456789002";

const COMMAND_UUID =
  "7b7b0003-8f7b-4e7b-9b7b-123456789003";

let device = null;
let server = null;
let measurementCharacteristic = null;
let commandCharacteristic = null;

const connectBtn = document.getElementById("connectBtn");
const resetBtn = document.getElementById("resetBtn");

function setStatus(text, connected) {
  document.getElementById("statusText").textContent = text;
  document.getElementById("statusDot").classList.toggle("connected", connected);
}

function message(text) {
  document.getElementById("message").textContent = text;
}

function handleMeasurement(event) {
  const value = event.target.value;

  if (value.byteLength < 16) {
    message("Invalid measurement packet.");
    return;
  }

  const standing = value.getFloat32(0, true);
  const laying = value.getFloat32(4, true);
  const forearm = value.getFloat32(8, true);
  const rom = value.getFloat32(12, true);

  document.getElementById("standing").textContent =
    `${standing.toFixed(2)}°`;

  document.getElementById("laying").textContent =
    `${laying.toFixed(2)}°`;

  document.getElementById("forearm").textContent =
    `${forearm.toFixed(2)}°`;

  document.getElementById("rom").textContent =
    `${rom.toFixed(2)}°`;
}

async function connect() {
  if (!navigator.bluetooth) {
    message("Web Bluetooth is not supported in this browser.");
    return;
  }

  try {
    setStatus("Selecting device...", false);

    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
      optionalServices: [SERVICE_UUID]
    });

    device.addEventListener("gattserverdisconnected", onDisconnected);

    server = await device.gatt.connect();

    const service = await server.getPrimaryService(SERVICE_UUID);

    measurementCharacteristic =
      await service.getCharacteristic(MEASUREMENT_UUID);

    commandCharacteristic =
      await service.getCharacteristic(COMMAND_UUID);

    await measurementCharacteristic.startNotifications();

    measurementCharacteristic.addEventListener(
      "characteristicvaluechanged",
      handleMeasurement
    );

    setStatus(`Connected: ${device.name || "BEAGLEY-PHYSIO"}`, true);
    connectBtn.textContent = "Connected";
    connectBtn.disabled = true;
    resetBtn.disabled = false;
    message("Receiving BLE measurements.");
  } catch (error) {
    console.error(error);
    setStatus("Connection failed", false);
    message(error.message || String(error));
  }
}

function onDisconnected() {
  setStatus("Disconnected", false);
  connectBtn.disabled = false;
  connectBtn.textContent = "Connect BeagleY-AI";
  resetBtn.disabled = true;
  message("BLE device disconnected.");
}

async function resetRom() {
  if (!commandCharacteristic) {
    message("Not connected.");
    return;
  }

  try {
    const data = new TextEncoder().encode("RESET");
    await commandCharacteristic.writeValue(data);
    message("ROM reset command sent.");
  } catch (error) {
    console.error(error);
    message(`Reset failed: ${error.message || error}`);
  }
}

connectBtn.addEventListener("click", connect);
resetBtn.addEventListener("click", resetRom);

setStatus("Disconnected", false);
