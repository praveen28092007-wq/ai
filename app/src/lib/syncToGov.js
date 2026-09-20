// Pushes a saved trip up to the government web dashboard when the phone has connectivity.
// Fails silently on purpose: the phone app must keep working standalone (offline) even
// if the backend is unreachable — sync is a bonus, not a dependency. See project-context.md.

// Set this to your deployed dashboard's URL (e.g. "https://ai-co2-dashboard.vercel.app")
// before the demo. Left blank, syncing is a no-op and the app works fully offline.
export const GOV_DASHBOARD_URL = 'https://ai-co2-dashboard.vercel.app';

// Makes sure the vehicle exists on the shared backend before syncing a trip to it —
// the phone may have a vehicle in its local storage that the web backend has never
// seen yet (e.g. added while offline, or added before this device ever synced).
async function ensureRegistered(ownerName, regNo, fuelType) {
  try {
    await fetch(`${GOV_DASHBOARD_URL}/api/vehicles/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerName, regNo, fuelType }),
    });
    // Ignore the response either way: success means it's now registered, and a
    // "already registered" error means it was already there — both are fine.
  } catch (e) {
    // no connectivity — the trip POST below will fail too and be handled there
  }
}

export async function syncTripToGovDashboard(ownerName, regNo, fuelType, trip) {
  if (!GOV_DASHBOARD_URL) return { synced: false, reason: 'no dashboard URL configured' };

  try {
    await ensureRegistered(ownerName, regNo, fuelType);
    const res = await fetch(`${GOV_DASHBOARD_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regNo, ...trip }),
    });
    if (!res.ok) return { synced: false, reason: `HTTP ${res.status}` };
    return { synced: true };
  } catch (e) {
    return { synced: false, reason: e.message };
  }
}
