# Ai-co2 — Vehicle Carbon Emission Tracker

Government-pitched hardware+software project tracking two-wheeler CO2 emissions via retrofit
sensors (not OBD), for pre-2023 Indian two-wheelers that have no OBD port.

**Read [docs/project-context.md](docs/project-context.md) first, before doing anything else
in this repo.** It has the full decided context: why this project, why it's NOT patent-worthy
(settled — don't re-open), the architecture, the finalized hardware list, the calculation
logic, and a list of decisions already made and rejected alternatives. Don't re-litigate
anything marked as settled/decided in that file without a new reason from the user.

## Timeline (tight — respect this)
- Software prep: today
- Hardware build/test: tomorrow
- Presentation: day after tomorrow

## App status
Three deployable pieces now exist, all sharing one real-time backend:

- **`app/`** — Expo (React Native) mobile app. **This is the only piece that can receive
  real ESP32 sensor data** — browsers cannot do classic Bluetooth Serial (SPP) at all,
  on any OS; that capability is native-app-only (settled, don't re-propose a browser-based
  live sensor connection without a firmware rewrite to BLE + Android-Chrome-only Web
  Bluetooth, which was considered and explicitly rejected for the demo — see below).
  Runs completely without hardware right now via a simulated sensor source
  (`app/src/lib/sensorSource.js`) generating fake ESP32 pulse data, plus a one-tap
  "Use a Dummy Reading" button for instant fake trips. Supports **multiple vehicles per
  person** (add vehicle, switch active vehicle) via `app/src/lib/storage.js` +
  `app/src/lib/profile.js`. Tomorrow, swap in a real Bluetooth connection in
  `sensorSource.js` only; nothing else needs to change. See `app/README.md`.
- **`web/` (`/` route)** — Next.js government/enforcement dashboard, deployed live at
  **https://ai-co2-dashboard.vercel.app**. Polls `/api/vehicles` every 5s.
- **`web/` (`/rider` route)** — Next.js rider portal, live at
  **https://ai-co2-dashboard.vercel.app/rider**. Browser-based signup (name + vehicle,
  stored in that browser's localStorage as "who am I"), add more vehicles, and a
  "Log a Dummy Ride" button — this is the web-accessible equivalent of the mobile app's
  individual view, minus real sensor input (impossible in a browser — see above).

All three read/write the **same Vercel Marketplace Redis (Upstash) store**
(`web/src/lib/db.js`), now connected and verified working end-to-end (register → log trip →
appears in government dashroom's list, confirmed via curl). The phone app posts each saved
trip to `/api/trips` (`app/src/lib/syncToGov.js`) whenever it has network connectivity; sync
fails silently so the phone app always keeps working fully offline even with no signal.

## Data flow architecture (settled — see the "isn't Bluetooth just sending data" and
"can a website receive Bluetooth" discussions — don't re-litigate without a new reason)
ESP32 → Bluetooth Serial → **phone app only** (does all CO2 math locally, works fully
offline) → phone syncs finished trips to the shared Vercel/Redis backend when it has its own
WiFi. The one wireless link that must work live (ESP32↔phone) is short-range Bluetooth with
no auth/captive-portal risk; all internet-dependent risk is pushed to the phone, which
handles flaky WiFi far more gracefully than the ESP32 would. The web rider portal and
government dashboard both read/write the same backend but never talk to the ESP32 directly.

## Quick facts
- Hardware: ESP32 + YF-S201 water flow sensor only (RPM sensor and GPS module were both
  considered and cut — see project-context.md for why)
- Distance traveled: read from phone GPS via the app, not a hardware GPS module
- CO2 math: `volume_ml = pulse_count * 2.25`; `CO2_kg = (volume_ml/1000) * 2.31` (petrol) or
  `× 2.68` (diesel)
- App needs two views: individual tracking, and government/enforcement view (flags vehicles
  exceeding threshold, shows simulated excess charge)
- Excess-emissions charge is a **proposed policy concept for the pitch** — simulate it in the
  app, do not build real payment processing or real registry integration
