// Core CO2 calculation logic — see /docs/project-context.md for derivation and constants.

export const ML_PER_PULSE = 2.25; // YF-S201 spec: mL per flow pulse
export const CO2_KG_PER_LITRE = {
  petrol: 2.31,
  diesel: 2.68,
};

// Two-wheeler-appropriate yearly benchmark (see project-context.md: generic 2.5t/year
// is a known weak fit for two-wheelers, so we use a scaled-down riding-only figure here).
export const YEARLY_CO2_BUDGET_KG = 500;

export const EXCESS_RATE_INR_PER_KM = 10; // proposed policy rate, simulated only

export function pulsesToVolumeMl(pulseCount) {
  return pulseCount * ML_PER_PULSE;
}

export function volumeMlToCo2Kg(volumeMl, fuelType = 'petrol') {
  const factor = CO2_KG_PER_LITRE[fuelType] ?? CO2_KG_PER_LITRE.petrol;
  return (volumeMl / 1000) * factor;
}

export function pulsesToCo2Kg(pulseCount, fuelType = 'petrol') {
  return volumeMlToCo2Kg(pulsesToVolumeMl(pulseCount), fuelType);
}

export function isOverThreshold(cumulativeCo2Kg, budgetKg = YEARLY_CO2_BUDGET_KG) {
  return cumulativeCo2Kg > budgetKg;
}

export function excessChargeInr(cumulativeCo2Kg, distanceKm, budgetKg = YEARLY_CO2_BUDGET_KG) {
  if (cumulativeCo2Kg <= budgetKg) return 0;
  // Simulated policy pricing: charge applies to km ridden while over budget.
  // For the demo we approximate "excess km" as the over-budget fraction of total distance.
  const overFraction = Math.min(1, (cumulativeCo2Kg - budgetKg) / cumulativeCo2Kg);
  const excessKm = distanceKm * overFraction;
  return Math.round(excessKm * EXCESS_RATE_INR_PER_KM);
}
