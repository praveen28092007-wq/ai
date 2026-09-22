// Abstraction over "where flow-sensor pulses come from" so the rest of the app
// doesn't care whether it's the real ESP32 or a simulated stream.

import RNBluetoothClassic from 'react-native-bluetooth-classic';

// Must match the ESP32 firmware's SerialBT.begin("...") name exactly (code.txt).
export const ESP32_DEVICE_NAME = 'WaterFlow_ESP32';

export class SimulatedSensorSource {
  constructor() {
    this._cb = null;
    this._timer = null;
  }

  start(onVolumeMl) {
    this._cb = onVolumeMl;
    // Simulate an ESP32 sending a volume delta every second while a trip is running.
    this._timer = setInterval(() => {
      const mlThisTick = Math.round((Math.random() * 8 + 2) * 2.25); // rough YF-S201-ish rate
      this._cb?.(mlThisTick);
    }, 1000);
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this._cb = null;
  }
}

// Real ESP32 connection over classic Bluetooth Serial (SPP). The firmware (code.txt)
// sends plain-text blocks once per second, e.g.:
//   Flow Rate: 12.34 L/min
//   Total: 0.567 L
//   ----------------
// "Total" is the ESP32's own running cumulative litre count since it booted — so each
// line gives an absolute total, not a delta. We diff consecutive readings ourselves to
// get the per-tick volume, and report that delta (in mL) to the callback.
// Requires an Expo dev-client build — this native module is not available in Expo Go.
export class BluetoothSensorSource {
  constructor(device) {
    this._device = device; // a device object from listPairedDevices()
    this._cb = null;
    this._subscription = null;
    this._buffer = '';
    this._lastTotalLitres = null;
  }

  async start(onVolumeMl) {
    this._cb = onVolumeMl;
    this._lastTotalLitres = null;

    const isConnected = await this._device.isConnected();
    if (!isConnected) {
      await this._device.connect();
    }

    this._subscription = this._device.onDataReceived((event) => {
      this._buffer += event.data;
      const lines = this._buffer.split('\n');
      this._buffer = lines.pop(); // keep the last, possibly-incomplete line in the buffer

      for (const line of lines) {
        const match = line.match(/Total:\s*([\d.]+)\s*L/i);
        if (!match) continue;

        const totalLitres = parseFloat(match[1]);
        if (Number.isNaN(totalLitres)) continue;

        if (this._lastTotalLitres !== null) {
          const deltaLitres = totalLitres - this._lastTotalLitres;
          if (deltaLitres > 0) {
            this._cb?.(Math.round(deltaLitres * 1000)); // litres -> mL
          }
        }
        this._lastTotalLitres = totalLitres;
      }
    });
  }

  async stop() {
    this._subscription?.remove?.();
    this._subscription = null;
    this._cb = null;
    try {
      await this._device.disconnect();
    } catch (e) {
      // already disconnected — fine
    }
  }
}

// Lists devices the phone has already paired with at the OS level (Android Bluetooth
// settings). The user must pair with the ESP32's Bluetooth name once before this
// will show it — this only lists, it doesn't initiate OS-level pairing.
export async function listPairedDevices() {
  const enabled = await RNBluetoothClassic.isBluetoothEnabled();
  if (!enabled) {
    throw new Error('Bluetooth is turned off. Turn it on and try again.');
  }
  return RNBluetoothClassic.getBondedDevices();
}

// One-tap "dummy reading" for when there's no time/hardware to run a live simulated
// trip — instantly returns a plausible finished trip (volume + distance) instead of
// making the presenter wait through the live tick-by-tick simulation.
export function generateDummyTrip() {
  const distanceKm = Number((Math.random() * 8 + 2).toFixed(2)); // 2-10 km, arbitrary demo range
  // Rough real-world-ish fuel use for a two-wheeler: ~30ml/km at highway/city mix.
  const volumeMl = Math.round(distanceKm * (25 + Math.random() * 15));
  return { volumeMl, distanceKm };
}
