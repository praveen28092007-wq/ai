// Core CO2 calculation logic — see /docs/project-context.md and esgv.pdf for derivation.

export const ML_PER_PULSE = 2.25; // YF-S201 spec: mL per flow pulse
export const CO2_KG_PER_LITRE = {
  petrol: 2.31,
  diesel: 2.68,
};

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

export function pulsesToCo2Kg(pulseCount, fuelType = 'petrol') {
  return volumeMlToCo2Kg(pulsesToVolumeMl(pulseCount), fuelType);
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
