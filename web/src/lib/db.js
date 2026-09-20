import { Redis } from '@upstash/redis';

// Reads whichever env vars the Vercel Marketplace Redis integration provisions.
// Different integrations name them slightly differently, so we check the common variants.
const url =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
const token =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

let redis = null;
export function getRedis() {
  if (!url || !token) return null; // not connected yet — callers fall back to seed data
  if (!redis) redis = new Redis({ url, token });
  return redis;
}

const VEHICLES_KEY = 'co2tracker:vehicles';

// ownerName: null = demo-only vehicle, not owned by any signed-up rider, exists so the
// government dashboard has other vehicles to compare against.
const SEED_VEHICLES = {
  KA01CD5678: { regNo: 'KA01CD5678', fuelType: 'petrol', ownerName: null, cumulativeCo2Kg: 420, cumulativeKm: 1800, trips: [] },
  KA03EF9012: { regNo: 'KA03EF9012', fuelType: 'diesel', ownerName: null, cumulativeCo2Kg: 610, cumulativeKm: 2100, trips: [] },
};

async function readAll(client) {
  const raw = await client.get(VEHICLES_KEY);
  if (!raw) {
    await client.set(VEHICLES_KEY, SEED_VEHICLES);
    return { ...SEED_VEHICLES };
  }
  return raw;
}

export async function getAllVehicles() {
  const client = getRedis();
  if (!client) return Object.values(SEED_VEHICLES);
  const raw = await readAll(client);
  return Object.values(raw);
}

export async function getVehiclesOwnedBy(ownerName) {
  const all = await getAllVehicles();
  return all.filter((v) => v.ownerName === ownerName);
}

export async function registerVehicle(ownerName, regNo, fuelType) {
  const client = getRedis();
  if (!client) throw new Error('Redis not connected — set up the Vercel Marketplace Redis store first.');

  const raw = await readAll(client);
  const normalizedRegNo = regNo.trim().toUpperCase();
  if (raw[normalizedRegNo]) {
    throw new Error('That vehicle number is already registered.');
  }
  raw[normalizedRegNo] = {
    regNo: normalizedRegNo,
    fuelType,
    ownerName,
    cumulativeCo2Kg: 0,
    cumulativeKm: 0,
    trips: [],
  };
  await client.set(VEHICLES_KEY, raw);
  return raw[normalizedRegNo];
}

export async function recordTrip(regNo, trip) {
  const client = getRedis();
  if (!client) throw new Error('Redis not connected — set up the Vercel Marketplace Redis store first.');

  const raw = await readAll(client);
  const vehicle = raw[regNo];
  if (!vehicle) throw new Error('Vehicle not found — register it first.');

  vehicle.trips = [trip, ...(vehicle.trips || [])].slice(0, 50);
  vehicle.cumulativeCo2Kg = (vehicle.cumulativeCo2Kg || 0) + trip.co2Kg;
  vehicle.cumulativeKm = (vehicle.cumulativeKm || 0) + trip.distanceKm;

  raw[regNo] = vehicle;
  await client.set(VEHICLES_KEY, raw);
  return vehicle;
}

export async function resetVehicle(regNo) {
  const client = getRedis();
  if (!client) throw new Error('Redis not connected — set up the Vercel Marketplace Redis store first.');

  const raw = await readAll(client);
  if (raw[regNo]) {
    raw[regNo] = { ...raw[regNo], cumulativeCo2Kg: 0, cumulativeKm: 0, trips: [] };
    await client.set(VEHICLES_KEY, raw);
  }
  return Object.values(raw);
}
