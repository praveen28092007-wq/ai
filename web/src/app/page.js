'use client';

import { useEffect, useState, useCallback } from 'react';
import { isOverThreshold, excessChargeInr, YEARLY_CO2_BUDGET_KG, EXCESS_RATE_INR_PER_KM } from '@/lib/emissions';

export default function DashboardPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/vehicles', { cache: 'no-store' });
      const data = await res.json();
      setVehicles(data.vehicles || []);
      setError(null);
    } catch (e) {
      setError('Could not reach the server. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000); // live-ish polling for the demo
    return () => clearInterval(id);
  }, [refresh]);

  async function handleReset(regNo) {
    if (!confirm(`Reset ${regNo} back to zero?`)) return;
    await fetch(`/api/vehicles/${regNo}/reset`, { method: 'POST' });
    refresh();
  }

  const flaggedCount = vehicles.filter((v) => isOverThreshold(v.cumulativeCo2Kg)).length;
  const sorted = [...vehicles].sort((a, b) => {
    const aFlagged = isOverThreshold(a.cumulativeCo2Kg);
    const bFlagged = isOverThreshold(b.cumulativeCo2Kg);
    if (aFlagged !== bFlagged) return aFlagged ? -1 : 1;
    return b.cumulativeCo2Kg - a.cumulativeCo2Kg;
  });

  return (
    <main className="flex-1 bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-center gap-3">
          <span className="text-4xl">🏛️</span>
          <div>
            <h1 className="text-2xl font-extrabold">Enforcement Dashboard</h1>
            <p className="mt-0.5 text-sm text-slate-400">
              {loading
                ? 'Loading…'
                : flaggedCount === 0
                ? 'No vehicles over the limit right now'
                : `${flaggedCount} of ${vehicles.length} vehicles over the limit`}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
          <span className="text-base">ℹ️</span>
          <p className="text-xs leading-relaxed text-slate-400">
            Prices shown (₹{EXCESS_RATE_INR_PER_KM}/km over budget) are a proposed idea for
            the pitch only — nothing here is a real charge. Data updates automatically as
            riders finish trips on the phone app.
          </p>
        </div>

        {error && (
          <p className="mt-6 rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="mt-8 space-y-3">
          {sorted.map((v) => {
            const flagged = isOverThreshold(v.cumulativeCo2Kg);
            const charge = excessChargeInr(v.cumulativeCo2Kg, v.cumulativeKm);
            const percent = Math.min(150, Math.round((v.cumulativeCo2Kg / YEARLY_CO2_BUDGET_KG) * 100));
            return (
              <div
                key={v.regNo}
                className={`rounded-2xl border p-5 transition ${
                  flagged ? 'border-red-500/60 bg-red-950/20' : 'border-slate-800 bg-slate-900'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-extrabold tracking-wide">{v.regNo}</span>
                      {flagged ? (
                        <span className="rounded-md bg-red-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                          OVER LIMIT
                        </span>
                      ) : (
                        <span className="rounded-md bg-emerald-700 px-2 py-0.5 text-[10px] font-extrabold text-white">
                          OK
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {v.fuelType} · {v.cumulativeKm.toFixed(0)} km · {v.cumulativeCo2Kg.toFixed(1)} kg CO2
                      {' '}(limit {YEARLY_CO2_BUDGET_KG} kg)
                    </div>
                  </div>
                  <button
                    onClick={() => handleReset(v.regNo)}
                    className="shrink-0 rounded-md px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
                  >
                    Reset
                  </button>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${flagged ? 'bg-red-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, percent)}%` }}
                  />
                </div>

                {flagged && (
                  <div className="mt-3 text-sm font-bold text-red-400">
                    Suggested charge: ₹{charge}
                  </div>
                )}
              </div>
            );
          })}
          {!loading && vehicles.length === 0 && (
            <p className="text-slate-500">No vehicles registered yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
