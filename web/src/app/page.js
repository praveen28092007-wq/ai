'use client';

import { useEffect, useState, useCallback } from 'react';
import { isOverThreshold, calcFineInr, effectiveBudgetKg, YEARLY_CO2_BUDGET_KG, FINE_RATE_INR_PER_KG } from '@/lib/emissions';

export default function DashboardPage() {
  const [tab, setTab] = useState('people'); // 'people' | 'requests'
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterFlaggedOnly, setFilterFlaggedOnly] = useState(false);
  const [fineTarget, setFineTarget] = useState(null); // person object or null

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/people', { cache: 'no-store' });
      const data = await res.json();
      setPeople(data.people || []);
      setError(null);
    } catch (e) {
      setError('Could not reach the server. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const pendingRequests = people.flatMap((p) =>
    (p.permitRequests || []).filter((r) => r.status === 'pending').map((r) => ({ ...r, personName: p.name }))
  );

  const flaggedCount = people.filter((p) => isOverThreshold(p.totalCo2Kg, effectiveBudgetKg(p))).length;
  const visiblePeople = [...people]
    .filter((p) => !filterFlaggedOnly || isOverThreshold(p.totalCo2Kg, effectiveBudgetKg(p)))
    .sort((a, b) => {
      const aFlagged = isOverThreshold(a.totalCo2Kg, effectiveBudgetKg(a));
      const bFlagged = isOverThreshold(b.totalCo2Kg, effectiveBudgetKg(b));
      if (aFlagged !== bFlagged) return aFlagged ? -1 : 1;
      return b.totalCo2Kg - a.totalCo2Kg;
    });

  async function handleDecide(personName, requestId, approve) {
    await fetch(`/api/people/${encodeURIComponent(personName)}/permit-request/${requestId}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approve }),
    });
    refresh();
  }

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
                ? 'No one over the limit right now'
                : `${flaggedCount} of ${people.length} people over the limit`}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
          <span className="text-base">ℹ️</span>
          <p className="text-xs leading-relaxed text-slate-400">
            Demo enforcement model: {YEARLY_CO2_BUDGET_KG}kg CO2/year per person (all their
            vehicles combined), fine = ₹{FINE_RATE_INR_PER_KG} per kg over that limit. Not a
            real policy — for pitch purposes only.
          </p>
        </div>

        {error && (
          <p className="mt-6 rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <button
            onClick={() => setTab('people')}
            className={`rounded-lg px-4 py-2 text-sm font-bold ${
              tab === 'people' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400'
            }`}
          >
            People & Fines
          </button>
          <button
            onClick={() => setTab('requests')}
            className={`relative rounded-lg px-4 py-2 text-sm font-bold ${
              tab === 'requests' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400'
            }`}
          >
            KM Requests
            {pendingRequests.length > 0 && (
              <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">
                {pendingRequests.length}
              </span>
            )}
          </button>
        </div>

        {tab === 'people' && (
          <>
            <label className="mt-5 flex w-fit items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={filterFlaggedOnly}
                onChange={(e) => setFilterFlaggedOnly(e.target.checked)}
                className="accent-emerald-500"
              />
              Show only people over the limit
            </label>

            <div className="mt-4 space-y-3">
              {visiblePeople.map((p) => {
                const budget = effectiveBudgetKg(p);
                const flagged = isOverThreshold(p.totalCo2Kg, budget);
                const fine = calcFineInr(p.totalCo2Kg, budget);
                const percent = Math.min(150, Math.round((p.totalCo2Kg / budget) * 100));
                return (
                  <div
                    key={p.name}
                    className={`rounded-2xl border p-5 transition ${
                      flagged ? 'border-red-500/60 bg-red-950/20' : 'border-slate-800 bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-extrabold">{p.name}</span>
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
                          {p.vehicles.join(', ') || 'no vehicles'} · {p.totalKm.toFixed(0)} km ·{' '}
                          {p.totalCo2Kg.toFixed(1)} kg CO2 (limit {budget}kg
                          {p.budgetBonusKg > 0 ? `, +${p.budgetBonusKg} approved` : ''})
                        </div>
                        {(p.fines || []).length > 0 && (
                          <div className="mt-1 text-[11px] text-slate-500">
                            {p.fines.length} fine{p.fines.length > 1 ? 's' : ''} issued so far ·
                            total ₹{p.fines.reduce((s, f) => s + f.amountInr, 0)}
                          </div>
                        )}
                      </div>
                      {flagged && (
                        <button
                          onClick={() => setFineTarget(p)}
                          className="shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500"
                        >
                          Issue Fine
                        </button>
                      )}
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full ${flagged ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>

                    {flagged && (
                      <div className="mt-3 text-sm font-bold text-red-400">
                        Suggested fine: ₹{fine}
                      </div>
                    )}
                  </div>
                );
              })}
              {!loading && visiblePeople.length === 0 && (
                <p className="text-slate-500">No one to show.</p>
              )}
            </div>
          </>
        )}

        {tab === 'requests' && (
          <div className="mt-6 space-y-3">
            {pendingRequests.length === 0 && (
              <p className="text-slate-500">No pending requests right now.</p>
            )}
            {pendingRequests.map((r) => (
              <div key={r.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-base font-extrabold">{r.personName}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(r.requestedAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  Requesting <span className="font-bold text-white">+{r.extraKgRequested} kg</span>{' '}
                  of extra yearly budget.
                </p>
                {r.reason && <p className="mt-1 text-sm text-slate-400">&ldquo;{r.reason}&rdquo;</p>}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => handleDecide(r.personName, r.id, true)}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleDecide(r.personName, r.id, false)}
                    className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-slate-700"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {fineTarget && (
        <FineModal
          person={fineTarget}
          suggestedAmount={calcFineInr(fineTarget.totalCo2Kg, effectiveBudgetKg(fineTarget))}
          onClose={() => setFineTarget(null)}
          onIssued={() => {
            setFineTarget(null);
            refresh();
          }}
        />
      )}
    </main>
  );
}

function FineModal({ person, suggestedAmount, onClose, onIssued }) {
  const [amount, setAmount] = useState(suggestedAmount);
  const [reason, setReason] = useState('Exceeded yearly CO2 emissions limit');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/people/${encodeURIComponent(person.name)}/fine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountInr: Number(amount), reason }),
    });
    onIssued();
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950 p-6">
        <h2 className="text-lg font-extrabold">Issue Fine</h2>
        <p className="mt-1 text-sm text-slate-400">{person.name}</p>

        <label className="mt-4 block text-xs font-semibold text-slate-400">Amount (₹)</label>
        <input
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-base outline-none focus:border-red-500"
        />

        <label className="mt-4 block text-xs font-semibold text-slate-400">Reason</label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-base outline-none focus:border-red-500"
        />

        <p className="mt-4 text-[11px] text-slate-500">
          This creates a simulated fine record. The rider will see it next time they open
          their app or portal — no real payment is processed.
        </p>

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
            disabled={saving || !amount}
            className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? 'Issuing…' : 'Issue Fine'}
          </button>
        </div>
      </form>
    </div>
  );
}
