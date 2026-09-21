'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  YEARLY_CO2_BUDGET_KG,
  isOverThreshold,
  effectiveBudgetKg,
  volumeMlToCo2Kg,
  generateDummyTrip,
} from '@/lib/emissions';

const RIDER_NAME_KEY = 'co2tracker.riderName';

export default function RiderPage() {
  const [name, setName] = useState(null); // null = still checking localStorage
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      setName(localStorage.getItem(RIDER_NAME_KEY));
    } catch (e) {
      setName(null);
    } finally {
      setChecked(true);
    }
  }, []);

  function handleSignedUp(riderName) {
    try {
      localStorage.setItem(RIDER_NAME_KEY, riderName);
    } catch (e) {}
    setName(riderName);
  }

  function handleSignOut() {
    try {
      localStorage.removeItem(RIDER_NAME_KEY);
    } catch (e) {}
    setName(null);
  }

  if (!checked) return null;
  if (!name) return <SignupForm onDone={handleSignedUp} />;
  return <RiderDashboard name={name} onSignOut={handleSignOut} />;
}

function SignupForm({ onDone }) {
  const [name, setName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [fuelType, setFuelType] = useState('petrol');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const canContinue = name.trim() && regNo.trim() && !saving;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/vehicles/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerName: name.trim(), regNo: regNo.trim(), fuelType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      onDone(name.trim());
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-slate-950 p-6 text-slate-100">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <div className="text-center text-5xl">🏍️</div>
        <h1 className="mt-2 text-center text-2xl font-extrabold">Welcome</h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          Set up your first vehicle. You can add more later.
        </p>

        <label className="mt-6 block text-xs font-semibold text-slate-400">Your name</label>
        <input
          className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-base outline-none focus:border-emerald-500"
          placeholder="e.g. Kamalesh"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="mt-4 block text-xs font-semibold text-slate-400">Vehicle number</label>
        <input
          className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-base uppercase outline-none focus:border-emerald-500"
          placeholder="e.g. KA05AB1234"
          value={regNo}
          onChange={(e) => setRegNo(e.target.value)}
        />

        <label className="mt-4 block text-xs font-semibold text-slate-400">Fuel type</label>
        <div className="mt-2 flex gap-2">
          {['petrol', 'diesel'].map((f) => (
            <button
              type="button"
              key={f}
              onClick={() => setFuelType(f)}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                fuelType === f
                  ? 'border-emerald-500 bg-emerald-900/40 text-white'
                  : 'border-slate-800 bg-slate-900 text-slate-400'
              }`}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={!canContinue}
          className="mt-8 w-full rounded-xl bg-emerald-500 py-4 text-base font-extrabold text-white disabled:opacity-40"
        >
          {saving ? 'Setting up…' : 'Get Started'}
        </button>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-500">
          Demo only — no real account, no password. This is a simulated rider portal for a
          government-pitched course project.
        </p>
      </form>
    </main>
  );
}

function RiderDashboard({ name, onSignOut }) {
  const [vehicles, setVehicles] = useState([]);
  const [person, setPerson] = useState(null);
  const [activeRegNo, setActiveRegNo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [logging, setLogging] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);

  const refresh = useCallback(async () => {
    const [vRes, pRes] = await Promise.all([
      fetch(`/api/vehicles/by-owner/${encodeURIComponent(name)}`, { cache: 'no-store' }),
      fetch(`/api/people/${encodeURIComponent(name)}`, { cache: 'no-store' }),
    ]);
    const vData = await vRes.json();
    const pData = await pRes.json();
    setVehicles(vData.vehicles || []);
    setPerson(pData.person);
    setLoading(false);
    return vData.vehicles || [];
  }, [name]);

  useEffect(() => {
    refresh().then((vs) => {
      if (vs.length > 0) setActiveRegNo((prev) => prev || vs[0].regNo);
    });
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const vehicle = vehicles.find((v) => v.regNo === activeRegNo) || vehicles[0];
  const totalCo2Kg = vehicles.reduce((s, v) => s + (v.cumulativeCo2Kg || 0), 0);
  const totalKm = vehicles.reduce((s, v) => s + (v.cumulativeKm || 0), 0);
  const budget = effectiveBudgetKg(person);
  const overLimit = isOverThreshold(totalCo2Kg, budget);
  const unreadCount = person?.unreadCount || 0;

  async function openNotifications() {
    setShowNotifications(true);
    if (unreadCount > 0) {
      await fetch(`/api/people/${encodeURIComponent(name)}`, { method: 'POST' });
      refresh();
    }
  }

  async function logDummyRide() {
    if (!vehicle) return;
    setLogging(true);
    const dummy = generateDummyTrip();
    const co2Kg = Number(volumeMlToCo2Kg(dummy.volumeMl, vehicle.fuelType).toFixed(3));
    await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        regNo: vehicle.regNo,
        pulseCount: dummy.pulseCount,
        volumeMl: dummy.volumeMl,
        distanceKm: dummy.distanceKm,
        co2Kg,
      }),
    });
    await refresh();
    setLogging(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center bg-slate-950 text-slate-400">
        Loading…
      </main>
    );
  }

  return (
    <main className="flex-1 bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-md px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">Hi {name} 👋</p>
            <h1 className="text-xl font-extrabold">My Vehicles</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={openNotifications} className="relative text-xl">
              🔔
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>
            <button onClick={onSignOut} className="text-xs text-slate-500 hover:text-slate-300">
              Sign out
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {vehicles.map((v) => (
            <button
              key={v.regNo}
              onClick={() => setActiveRegNo(v.regNo)}
              className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                v.regNo === activeRegNo
                  ? 'border-emerald-500 bg-emerald-900/40 text-white'
                  : 'border-slate-800 bg-slate-900 text-slate-400'
              }`}
            >
              {v.regNo}
            </button>
          ))}
          <button
            onClick={() => setAdding(true)}
            className="rounded-lg border border-dashed border-emerald-500 px-3 py-2 text-xs font-bold text-emerald-400"
          >
            + Add
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs font-semibold text-slate-400">
            Your total this year (all vehicles combined)
          </p>
          <p className={`mt-1 text-3xl font-extrabold ${overLimit ? 'text-red-400' : 'text-white'}`}>
            {totalCo2Kg.toFixed(1)} kg CO2
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full ${overLimit ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, Math.round((totalCo2Kg / budget) * 100))}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {totalKm.toFixed(0)} km · limit {budget} kg
            {person?.budgetBonusKg > 0 ? ` (${YEARLY_CO2_BUDGET_KG} base + ${person.budgetBonusKg} approved)` : ''}
          </p>
          {overLimit && (
            <p className="mt-2 text-xs font-semibold text-red-400">
              ⚠ Over the limit — flagged on the government dashboard
            </p>
          )}

          <button
            onClick={() => setShowRequestForm(true)}
            className="mt-4 w-full rounded-xl border border-emerald-600 py-3 text-sm font-bold text-emerald-400"
          >
            🚧 Request More KM
          </button>
        </div>

        {vehicle && (
          <>
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs font-semibold text-slate-400">Ride on {vehicle.regNo}</p>
              <button
                onClick={logDummyRide}
                disabled={logging}
                className="mt-3 w-full rounded-xl border border-slate-700 py-3 text-sm font-bold text-slate-200 disabled:opacity-40"
              >
                {logging ? 'Logging…' : '⚡ Log a Dummy Ride'}
              </button>
              <p className="mt-2 text-center text-[11px] text-slate-500">
                Real rides are logged from the phone app, connected to the ESP32 sensor over
                Bluetooth. Use this to demo the flow from a browser.
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs font-semibold text-slate-400">Recent rides</p>
              {(vehicle.trips || []).length === 0 && (
                <p className="mt-2 text-sm text-slate-500">No rides yet.</p>
              )}
              {(vehicle.trips || []).slice(0, 5).map((t) => (
                <div key={t.ts} className="mt-2 border-t border-slate-800 pt-2 text-xs text-slate-300">
                  {new Date(t.ts).toLocaleString()} — {t.distanceKm} km, {t.co2Kg} kg CO2
                </div>
              ))}
            </div>
          </>
        )}

        {vehicles.length === 0 && !adding && (
          <p className="mt-8 text-center text-sm text-slate-500">No vehicles yet — add one above.</p>
        )}
      </div>

      {adding && (
        <AddVehicleModal
          ownerName={name}
          onClose={() => setAdding(false)}
          onAdded={async (regNo) => {
            await refresh();
            setActiveRegNo(regNo);
            setAdding(false);
          }}
        />
      )}

      {showNotifications && (
        <NotificationsModal person={person} onClose={() => setShowNotifications(false)} />
      )}

      {showRequestForm && (
        <RequestKmModal
          name={name}
          onClose={() => setShowRequestForm(false)}
          onSent={() => {
            setShowRequestForm(false);
            refresh();
          }}
        />
      )}
    </main>
  );
}

function NotificationsModal({ person, onClose }) {
  const fines = person?.fines || [];
  const decidedRequests = (person?.permitRequests || []).filter((r) => r.status !== 'pending');

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Notifications</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            ✕
          </button>
        </div>

        <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">
          {fines.length === 0 && decidedRequests.length === 0 && (
            <p className="text-sm text-slate-500">Nothing here yet.</p>
          )}

          {fines.map((f) => (
            <div key={f.id} className="rounded-xl border border-red-500/40 bg-red-950/20 p-3">
              <p className="text-sm font-bold text-red-400">Fine issued: ₹{f.amountInr}</p>
              {f.reason && <p className="mt-1 text-xs text-slate-300">{f.reason}</p>}
              <p className="mt-1 text-[11px] text-slate-500">{new Date(f.issuedAt).toLocaleString()}</p>
            </div>
          ))}

          {decidedRequests.map((r) => (
            <div
              key={r.id}
              className={`rounded-xl border p-3 ${
                r.status === 'approved' ? 'border-emerald-600/40 bg-emerald-950/20' : 'border-slate-700 bg-slate-900'
              }`}
            >
              <p className={`text-sm font-bold ${r.status === 'approved' ? 'text-emerald-400' : 'text-slate-300'}`}>
                KM request {r.status === 'approved' ? 'approved' : 'denied'}: +{r.extraKgRequested} kg
              </p>
              <p className="mt-1 text-[11px] text-slate-500">{new Date(r.decidedAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RequestKmModal({ name, onClose, onSent }) {
  const [extraKg, setExtraKg] = useState(200);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/people/${encodeURIComponent(name)}/permit-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extraKgRequested: Number(extraKg), reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      onSent();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950 p-6">
        <h2 className="text-lg font-extrabold">Request More KM</h2>
        <p className="mt-1 text-sm text-slate-400">
          Like a toll gate — ask for extra yearly CO2 budget. Government reviews and can
          approve or deny.
        </p>

        <label className="mt-4 block text-xs font-semibold text-slate-400">Extra CO2 budget (kg)</label>
        <input
          type="number"
          min="1"
          value={extraKg}
          onChange={(e) => setExtraKg(e.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-base outline-none focus:border-emerald-500"
        />

        <label className="mt-4 block text-xs font-semibold text-slate-400">Reason</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Long trip planned next month"
          rows={3}
          className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-base outline-none focus:border-emerald-500"
        />

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-800 py-3 text-sm font-bold text-slate-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !extraKg}
            className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? 'Sending…' : 'Send Request'}
          </button>
        </div>
      </form>
    </div>
  );
}

function AddVehicleModal({ ownerName, onClose, onAdded }) {
  const [regNo, setRegNo] = useState('');
  const [fuelType, setFuelType] = useState('petrol');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/vehicles/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerName, regNo: regNo.trim(), fuelType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      onAdded(data.vehicle.regNo);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950 p-6"
      >
        <h2 className="text-lg font-extrabold">Add a Vehicle</h2>
        <label className="mt-4 block text-xs font-semibold text-slate-400">Vehicle number</label>
        <input
          autoFocus
          className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-base uppercase outline-none focus:border-emerald-500"
          placeholder="e.g. KA07GH3456"
          value={regNo}
          onChange={(e) => setRegNo(e.target.value)}
        />
        <label className="mt-4 block text-xs font-semibold text-slate-400">Fuel type</label>
        <div className="mt-2 flex gap-2">
          {['petrol', 'diesel'].map((f) => (
            <button
              type="button"
              key={f}
              onClick={() => setFuelType(f)}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                fuelType === f
                  ? 'border-emerald-500 bg-emerald-900/40 text-white'
                  : 'border-slate-800 bg-slate-900 text-slate-400'
              }`}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-800 py-3 text-sm font-bold text-slate-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!regNo.trim() || saving}
            className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>
    </div>
  );
}
