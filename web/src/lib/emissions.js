// Mirrors app/src/lib/emissions.js (mobile) — kept in sync manually since this is a
// separate deployable. See /docs/project-context.md for derivation and constants.

export const ML_PER_PULSE = 2.25;
export const CO2_KG_PER_LITRE = { petrol: 2.31, diesel: 2.68 };
export const YEARLY_CO2_BUDGET_KG = 500;
export const EXCESS_RATE_INR_PER_KM = 10; // proposed policy rate, simulated only

export function pulsesToVolumeMl(pulseCount) {
  return pulseCount * ML_PER_PULSE;
}

export function volumeMlToCo2Kg(volumeMl, fuelType = 'petrol') {
  const factor = CO2_KG_PER_LITRE[fuelType] ?? CO2_KG_PER_LITRE.petrol;
  return (volumeMl / 1000) * factor;
}

export function isOverThreshold(cumulativeCo2Kg, budgetKg = YEARLY_CO2_BUDGET_KG) {
  return cumulativeCo2Kg > budgetKg;
}

export function excessChargeInr(cumulativeCo2Kg, distanceKm, budgetKg = YEARLY_CO2_BUDGET_KG) {
  if (cumulativeCo2Kg <= budgetKg) return 0;
  const overFraction = Math.min(1, (cumulativeCo2Kg - budgetKg) / cumulativeCo2Kg);
  const excessKm = distanceKm * overFraction;
  return Math.round(excessKm * EXCESS_RATE_INR_PER_KM);
}

// One-tap "dummy reading" — mirrors app/src/lib/sensorSource.js generateDummyTrip.
export function generateDummyTrip() {
  const distanceKm = Number((Math.random() * 8 + 2).toFixed(2));
  const volumeMl = Math.round(distanceKm * (25 + Math.random() * 15));
  const pulseCount = Math.round(volumeMl / ML_PER_PULSE);
  return { pulseCount, volumeMl, distanceKm };
}
