import AsyncStorage from '@react-native-async-storage/async-storage';

const VEHICLES_KEY = 'co2tracker.vehicles.v2';

// Seeded demo registry so the government view has data to show immediately.
// ownerName: null means "not owned by the current demo user" — these exist purely
// so the government dashboard has other vehicles to compare against.
const DEFAULT_VEHICLES = [
  { regNo: 'KA01CD5678', fuelType: 'petrol', ownerName: null, cumulativeCo2Kg: 420, cumulativeKm: 1800, trips: [] },
  { regNo: 'KA03EF9012', fuelType: 'diesel', ownerName: null, cumulativeCo2Kg: 610, cumulativeKm: 2100, trips: [] },
];

export async function loadVehicles() {
  try {
    const raw = await AsyncStorage.getItem(VEHICLES_KEY);
    if (!raw) {
      await AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(DEFAULT_VEHICLES));
      return DEFAULT_VEHICLES;
    }
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_VEHICLES;
  }
}

export async function saveVehicles(vehicles) {
  await AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));
}

export function vehiclesOwnedBy(vehicles, ownerName) {
  return vehicles.filter((v) => v.ownerName === ownerName);
}

export async function addVehicle(ownerName, regNo, fuelType) {
  const vehicles = await loadVehicles();
  const normalizedRegNo = regNo.trim().toUpperCase();
  if (vehicles.some((v) => v.regNo === normalizedRegNo)) {
    throw new Error('That vehicle number is already registered.');
  }
  const vehicle = {
    regNo: normalizedRegNo,
    fuelType,
    ownerName,
    cumulativeCo2Kg: 0,
    cumulativeKm: 0,
    trips: [],
  };
  vehicles.push(vehicle);
  await saveVehicles(vehicles);
  return vehicles;
}

export async function upsertTrip(regNo, trip) {
  const vehicles = await loadVehicles();
  const idx = vehicles.findIndex((v) => v.regNo === regNo);
  if (idx === -1) return vehicles; // vehicle must be added via addVehicle first
  const vehicle = vehicles[idx];

  vehicle.trips = [trip, ...(vehicle.trips || [])].slice(0, 50);
  vehicle.cumulativeCo2Kg = (vehicle.cumulativeCo2Kg || 0) + trip.co2Kg;
  vehicle.cumulativeKm = (vehicle.cumulativeKm || 0) + trip.distanceKm;
  vehicles[idx] = vehicle;

  await saveVehicles(vehicles);
  return vehicles;
}

export async function resetVehicle(regNo) {
  const vehicles = await loadVehicles();
  const idx = vehicles.findIndex((v) => v.regNo === regNo);
  if (idx === -1) return vehicles;
  vehicles[idx] = { ...vehicles[idx], cumulativeCo2Kg: 0, cumulativeKm: 0, trips: [] };
  await saveVehicles(vehicles);
  return vehicles;
}
