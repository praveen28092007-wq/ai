// Mirrors app/src/lib/emissions.js (mobile) — kept in sync manually since this is a
// separate deployable. See /docs/project-context.md and esgv.pdf for derivation.

export const ML_PER_PULSE = 2.25;
export const CO2_KG_PER_LITRE = { petrol: 2.31, diesel: 2.68 };

// Per-PERSON yearly benchmark, summed across every vehicle they own (esgv.pdf).
export const YEARLY_CO2_BUDGET_KG = 2500;
export const FINE_RATE_INR_PER_KG = 10;

export function pulsesToVolumeMl(pulseCount) {
  return pulseCount * ML_PER_PULSE;
}

export function volumeMlToCo2Kg(volumeMl, fuelType = 'petrol') {
  const factor = CO2_KG_PER_LITRE[fuelType] ?? CO2_KG_PER_LITRE.petrol;
  return (volumeMl / 1000) * factor;
}

export function effectiveBudgetKg(person) {
  return YEARLY_CO2_BUDGET_KG + (person?.budgetBonusKg || 0);
}

export function isOverThreshold(totalCo2Kg, budgetKg = YEARLY_CO2_BUDGET_KG) {
  return totalCo2Kg > budgetKg;
}

// fine = max(0, total - budget) * rate — flat per kg, per esgv.pdf. Not per-km.
export function calcFineInr(totalCo2Kg, budgetKg = YEARLY_CO2_BUDGET_KG) {
  return Math.round(Math.max(0, totalCo2Kg - budgetKg) * FINE_RATE_INR_PER_KG);
}

// One-tap "dummy reading" — mirrors app/src/lib/sensorSource.js generateDummyTrip.
export function generateDummyTrip() {
  const distanceKm = Number((Math.random() * 8 + 2).toFixed(2));
  const volumeMl = Math.round(distanceKm * (25 + Math.random() * 15));
  const pulseCount = Math.round(volumeMl / ML_PER_PULSE);
  return { pulseCount, volumeMl, distanceKm };
}
