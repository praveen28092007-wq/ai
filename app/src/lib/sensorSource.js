// Abstraction over "where flow-sensor pulses come from" so the rest of the app
// doesn't care whether it's the real ESP32 or a simulated stream.
//
// Tomorrow: replace SimulatedSensorSource's internals with a real Bluetooth Serial
// (e.g. react-native-bluetooth-classic) connection to the ESP32, parsing lines like
// "PULSE:<count>" it sends. onPulseCount(cb) is the only interface the UI needs.

export class SimulatedSensorSource {
  constructor() {
    this._cb = null;
    this._timer = null;
  }

  start(onPulseCount) {
    this._cb = onPulseCount;
    // Simulate an ESP32 sending a pulse-count delta every second while a trip is running.
    this._timer = setInterval(() => {
      const pulsesThisTick = Math.floor(Math.random() * 8) + 2; // 2-9 pulses/sec, arbitrary demo rate
      this._cb?.(pulsesThisTick);
    }, 1000);
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this._cb = null;
  }
}

// Placeholder for tomorrow's real hardware source.
export class BluetoothSensorSource {
  constructor() {
    throw new Error(
      'BluetoothSensorSource not implemented yet — wire this up once the ESP32 firmware ' +
        'is flashed and paired. See docs/project-context.md for the ESP32 + YF-S201 setup.'
    );
  }
}

// One-tap "dummy reading" for when there's no time/hardware to run a live simulated
// trip — instantly returns a plausible finished trip (pulse count + distance) instead
// of making the presenter wait through the live tick-by-tick simulation.
export function generateDummyTrip() {
  const distanceKm = Number((Math.random() * 8 + 2).toFixed(2)); // 2-10 km, arbitrary demo range
  // Rough real-world-ish fuel use for a two-wheeler: ~30ml/km at highway/city mix.
  const volumeMl = Math.round(distanceKm * (25 + Math.random() * 15));
  const pulseCount = Math.round(volumeMl / 2.25); // inverse of ML_PER_PULSE, kept local to avoid a cycle
  return { pulseCount, volumeMl, distanceKm };
}
