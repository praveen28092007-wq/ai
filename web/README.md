# Ai-co2 Government Dashboard (Web)

Live at: **https://ai-co2-dashboard.vercel.app**

Next.js app showing the government/enforcement view — every registered vehicle, flagged
if over the yearly CO2 budget, with a simulated excess charge. Reads data that the mobile
app (`../app`) syncs up after each trip.

## One remaining setup step: connect Redis

The API routes (`src/lib/db.js`) expect a Vercel Marketplace Redis (Upstash) store. It is
**not connected yet**. Until it is, `GET /api/vehicles` returns fixed seed data (fine for
looking at the UI) but `POST /api/trips` (trip sync from the phone) will fail.

To connect it:
1. https://vercel.com/dashboard → **ai-co2-dashboard** project → **Storage** tab
2. **Create Database** → **Upstash** → **Redis** → name it anything → free tier → Create
3. It auto-connects and adds the right env vars (`KV_REST_API_URL` / `KV_REST_API_TOKEN` or
   `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — `src/lib/db.js` checks both) to
   the project automatically. No code changes needed.
4. Redeploy so the new env vars take effect: `npx vercel deploy --prod --yes`

## Local dev

```
npm run dev
```

Pulls env vars from `.env.local` (already linked to the Vercel project via `vercel link`).

## API

- `GET /api/vehicles` — all registered vehicles with cumulative CO2/km
- `POST /api/trips` — body `{ regNo, fuelType, co2Kg, distanceKm, pulseCount, volumeMl, ts }`,
  called by the mobile app after each trip
- `POST /api/vehicles/:regNo/reset` — clears one vehicle's cumulative totals (demo convenience)

## Deploy

```
npx vercel deploy --prod --yes
```
