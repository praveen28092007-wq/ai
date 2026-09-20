# Ai-co2 App (Demo Scaffold)

Fully functional Expo (React Native) app for the Vehicle Carbon Emission Tracker demo.
Runs completely without hardware tonight (simulated sensor data); swap in the real
ESP32 Bluetooth connection tomorrow — see `src/lib/sensorSource.js`.

See [../CLAUDE.md](../CLAUDE.md) and [../docs/project-context.md](../docs/project-context.md)
for full project context, decisions, and hardware plan.

## Run it

```
cd app
npx expo start
```

Scan the QR code with **Expo Go** (Android/iOS) to run on your phone — recommended, since
GPS distance tracking needs a real device.

## What works right now (no hardware needed)

- **Individual tab**: press "Start Trip" → simulated ESP32 sends fake flow-sensor pulses
  once per second, phone GPS tracks real distance, live CO2 total updates. Press "Stop &
  Save Trip" to persist it.
- **Government tab**: shows all registered vehicles (one seeded to already be over
  threshold so the flagging UI has something to show), flags anyone over the yearly CO2
  budget, and displays a simulated excess charge in ₹.
- Data persists across app restarts via AsyncStorage.

## Swapping in real hardware tomorrow

Everything the UI needs from the sensor goes through one interface in
`src/lib/sensorSource.js`:

```js
sensorSource.start((pulseDelta) => { ... })
sensorSource.stop()
```

Replace `SimulatedSensorSource` usage in `src/screens/IndividualScreen.js` with a real
`BluetoothSensorSource` that connects to the ESP32 over Bluetooth Serial (e.g.
`react-native-bluetooth-classic`) and calls the same callback with parsed pulse counts
from lines like `PULSE:<count>`. No other file needs to change — the CO2 math, storage,
and both screens are already sensor-agnostic.

## Key files

- `src/lib/emissions.js` — CO2 calculation constants and math (matches project-context.md)
- `src/lib/sensorSource.js` — simulated vs. real ESP32 data source
- `src/lib/useDistanceTracker.js` — phone GPS distance tracking
- `src/lib/storage.js` — AsyncStorage-backed vehicle registry (seeded with demo data)
- `src/screens/IndividualScreen.js` — rider's own trip + cumulative view
- `src/screens/GovernmentScreen.js` — enforcement view, flags + simulated charges
- `App.js` — root component, simple two-tab switcher (no nav library needed)
