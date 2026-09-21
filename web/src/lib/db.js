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
const PEOPLE_KEY = 'co2tracker:people';

// ownerName: null = demo-only vehicle, not owned by any signed-up rider, exists so the
// government dashboard has other vehicles to compare against.
const SEED_VEHICLES = {
  KA01CD5678: { regNo: 'KA01CD5678', fuelType: 'petrol', ownerName: 'Demo Rider A', cumulativeCo2Kg: 420, cumulativeKm: 1800, trips: [] },
  KA03EF9012: { regNo: 'KA03EF9012', fuelType: 'diesel', ownerName: 'Demo Rider B', cumulativeCo2Kg: 2650, cumulativeKm: 2100, trips: [] },
};

// A "person" record holds everything that isn't tied to one vehicle: fines issued
// against them, permit (km/budget increase) requests, and any approved budget bonus.
function emptyPerson(name) {
  return { name, budgetBonusKg: 0, fines: [], permitRequests: [], unreadCount: 0 };
}

const SEED_PEOPLE = {
  'Demo Rider B': { ...emptyPerson('Demo Rider B') },
};

function requireRedis() {
  const client = getRedis();
  if (!client) throw new Error('Redis not connected — set up the Vercel Marketplace Redis store first.');
  return client;
}

async function readVehicles(client) {
  const raw = await client.get(VEHICLES_KEY);
  if (!raw) {
    await client.set(VEHICLES_KEY, SEED_VEHICLES);
    return { ...SEED_VEHICLES };
  }
  return raw;
}

async function readPeople(client) {
  const raw = await client.get(PEOPLE_KEY);
  if (!raw) {
    await client.set(PEOPLE_KEY, SEED_PEOPLE);
    return { ...SEED_PEOPLE };
  }
  return raw;
}

async function getOrCreatePerson(client, people, name) {
  if (!people[name]) {
    people[name] = emptyPerson(name);
  }
  return people[name];
}

export async function getAllVehicles() {
  const client = getRedis();
  if (!client) return Object.values(SEED_VEHICLES);
  const raw = await readVehicles(client);
  return Object.values(raw);
}

export async function getVehiclesOwnedBy(ownerName) {
  const all = await getAllVehicles();
  return all.filter((v) => v.ownerName === ownerName);
}

export async function registerVehicle(ownerName, regNo, fuelType) {
  const client = requireRedis();

  const raw = await readVehicles(client);
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
  const client = requireRedis();

  const raw = await readVehicles(client);
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
  const client = requireRedis();

  const raw = await readVehicles(client);
  if (raw[regNo]) {
    raw[regNo] = { ...raw[regNo], cumulativeCo2Kg: 0, cumulativeKm: 0, trips: [] };
    await client.set(VEHICLES_KEY, raw);
  }
  return Object.values(raw);
}

// --- People / enforcement (fines + permit requests) ---

// One row per person: name, total CO2 across all their vehicles, fines, permit requests.
export async function getPeopleSummary() {
  const client = getRedis();
  const vehicles = client ? Object.values(await readVehicles(client)) : Object.values(SEED_VEHICLES);
  const people = client ? await readPeople(client) : SEED_PEOPLE;

  const byOwner = new Map();
  for (const v of vehicles) {
    if (!v.ownerName) continue;
    if (!byOwner.has(v.ownerName)) byOwner.set(v.ownerName, []);
    byOwner.get(v.ownerName).push(v);
  }

  const names = new Set([...byOwner.keys(), ...Object.keys(people)]);
  return [...names].map((name) => {
    const ownedVehicles = byOwner.get(name) || [];
    const totalCo2Kg = ownedVehicles.reduce((sum, v) => sum + (v.cumulativeCo2Kg || 0), 0);
    const totalKm = ownedVehicles.reduce((sum, v) => sum + (v.cumulativeKm || 0), 0);
    const person = people[name] || emptyPerson(name);
    return {
      name,
      vehicles: ownedVehicles.map((v) => v.regNo),
      totalCo2Kg,
      totalKm,
      budgetBonusKg: person.budgetBonusKg || 0,
      fines: person.fines || [],
      permitRequests: person.permitRequests || [],
      unreadCount: person.unreadCount || 0,
    };
  });
}

export async function getPersonState(name) {
  const summaries = await getPeopleSummary();
  return summaries.find((p) => p.name === name) || null;
}

export async function issueFine(name, amountInr, reason) {
  const client = requireRedis();
  const people = await readPeople(client);
  const person = await getOrCreatePerson(client, people, name);

  const fine = { id: `f_${Date.now()}`, amountInr, reason: reason || '', issuedAt: Date.now(), acknowledged: false };
  person.fines = [fine, ...(person.fines || [])].slice(0, 50);
  person.unreadCount = (person.unreadCount || 0) + 1;

  people[name] = person;
  await client.set(PEOPLE_KEY, people);
  return fine;
}

export async function requestPermit(name, extraKgRequested, reason) {
  const client = requireRedis();
  const people = await readPeople(client);
  const person = await getOrCreatePerson(client, people, name);

  const request = {
    id: `p_${Date.now()}`,
    extraKgRequested,
    reason: reason || '',
    status: 'pending', // pending | approved | denied
    requestedAt: Date.now(),
    decidedAt: null,
  };
  person.permitRequests = [request, ...(person.permitRequests || [])].slice(0, 50);

  people[name] = person;
  await client.set(PEOPLE_KEY, people);
  return request;
}

export async function decidePermitRequest(name, requestId, approve) {
  const client = requireRedis();
  const people = await readPeople(client);
  const person = await getOrCreatePerson(client, people, name);

  const request = (person.permitRequests || []).find((r) => r.id === requestId);
  if (!request) throw new Error('Permit request not found.');
  if (request.status !== 'pending') throw new Error('This request has already been decided.');

  request.status = approve ? 'approved' : 'denied';
  request.decidedAt = Date.now();
  if (approve) {
    person.budgetBonusKg = (person.budgetBonusKg || 0) + request.extraKgRequested;
  }
  person.unreadCount = (person.unreadCount || 0) + 1;

  people[name] = person;
  await client.set(PEOPLE_KEY, people);
  return { person, request };
}

export async function markPersonRead(name) {
  const client = requireRedis();
  const people = await readPeople(client);
  const person = await getOrCreatePerson(client, people, name);
  person.unreadCount = 0;
  people[name] = person;
  await client.set(PEOPLE_KEY, people);
  return person;
}
