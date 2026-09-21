# Ai-co2 — Vehicle Carbon Emission Tracker

Government-pitched hardware+software project tracking two-wheeler CO2 emissions via retrofit
sensors (not OBD), for pre-2023 Indian two-wheelers that have no OBD port.

**Read [docs/project-context.md](docs/project-context.md) first, before doing anything else
in this repo.** It has the full decided context: why this project, why it's NOT patent-worthy
(settled — don't re-open), the architecture, the finalized hardware list, the calculation
logic, and a list of decisions already made and rejected alternatives. Don't re-litigate
anything marked as settled/decided in that file without a new reason from the user.

**KNOWN FRAGILITY — read before touching this file:** this repo is shared via GitHub with a
collaborator (Praveen, repo `praveen28092007-wq/ai`). Windows/macOS filesystems are
case-insensitive, so `CLAUDE.md` and a lowercase `claude.md` from his side are THE SAME FILE.
This has already caused CLAUDE.md to be silently emptied once by a merge. After any `git pull`
or `git merge` from `origin/main`, verify `CLAUDE.md` is non-empty before trusting it, and
re-write it from `docs/project-context.md` + git history if it's ever empty or stale again.

## Timeline
Software prep + hardware build were the original 2-day plan; project is now in active
feature-iteration (fine/permit system, multi-vehicle, etc.) — treat the timeline section in
project-context.md as historical, not a hard deadline still in effect, unless the user says
otherwise.

## App status — three deployable pieces, one shared backend
- **`app/`** — Expo (React Native) mobile app. **The only piece that can receive real ESP32
  sensor data** — browsers cannot do classic Bluetooth Serial (SPP) on any OS; settled, don't
  re-propose a browser-based live sensor connection without a firmware rewrite to BLE, which
  was considered and rejected. Simulated sensor source + one-tap dummy reading for demo.
  Supports multiple vehicles per person (`src/lib/storage.js`, `src/lib/profile.js`).
- **`web/` (`/` route)** — Next.js government/enforcement dashboard, live at
  **https://ai-co2-dashboard.vercel.app**.
- **`web/` (`/rider` route)** — Next.js rider portal, live at
  **https://ai-co2-dashboard.vercel.app/rider**. Browser signup/vehicles/dummy rides — not
  live sensor input (impossible in a browser, see above).

All three read/write the same Vercel Marketplace Redis (Upstash) store (`web/src/lib/db.js`),
connected and verified working end-to-end. Phone app posts finished trips to `/api/trips`
when it has connectivity; sync fails silently so the phone always works offline.

## Enforcement model (updated — see esgv.pdf provided by user's collaborator)
**Settled, matches the source document exactly — don't revert to the old per-vehicle model:**
- Benchmark is **2,500 kg CO2/year per PERSON**, summed across every vehicle they own — not
  per-vehicle. A person with 2 bikes has ONE combined total compared against 2,500kg.
  (Earlier version of this app used 500kg per-vehicle + ₹10/km; that has been replaced.)
- Fine formula: `fine = max(0, totalYearlyCo2Kg - 2500) * 10` (₹10 per kg of excess CO2,
  flat — not per-km).
- This is explicitly a **demo enforcement model**, not a real policy — keep that framing in
  the UI (already the case) and in any pitch materials.

## Government dashboard — enforcement operations (in progress)
Beyond just listing vehicles, the government dashboard needs real operations:
- **Issue a fine**: on a person/vehicle over the limit, government clicks a button, a fine
  record is created in the shared backend. No real push notifications (extra infra, not
  needed for a demo) — instead the rider's app/portal shows an unread badge/alert next time
  it loads or polls (both already poll on an interval).
- **KM increase requests ("permit" system, toll-gate analogy)**: rider can request more
  yearly budget with a reason; government sees a pending-requests queue and can
  Approve/Deny. Approving raises that rider's effective yearly CO2 budget (or equivalently,
  a person-level allowance on top of the 2,500kg base — implementation detail, check
  db.js/schema for how this landed).

## Quick facts
- Hardware: ESP32 + YF-S201 water flow sensor only (RPM sensor and GPS module cut — see
  project-context.md for why)
- Distance traveled: read from phone GPS via the app, not a hardware GPS module
- CO2 math: `volume_ml = pulse_count * 2.25`; `CO2_kg = (volume_ml/1000) * 2.31` (petrol) or
  `× 2.68` (diesel) — this part is unchanged, only the yearly threshold/fine model changed
- Excess-emissions charge is a **proposed policy concept for the pitch** — simulate it, do
  not build real payment processing or real registry integration
