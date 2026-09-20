import { NextResponse } from 'next/server';
import { recordTrip } from '@/lib/db';

// Called by the mobile app whenever it has connectivity, to sync a saved trip
// up to the government dashboard. Not called live during sensing — the phone
// already has the trip finalized locally before this fires.
export async function POST(request) {
  const body = await request.json();
  const { regNo, co2Kg, distanceKm, pulseCount, volumeMl, ts } = body || {};

  if (!regNo || typeof co2Kg !== 'number' || typeof distanceKm !== 'number') {
    return NextResponse.json(
      { error: 'regNo, co2Kg (number), and distanceKm (number) are required' },
      { status: 400 }
    );
  }

  const trip = { ts: ts || Date.now(), pulseCount, volumeMl, co2Kg, distanceKm };
  try {
    const vehicle = await recordTrip(regNo, trip);
    return NextResponse.json({ vehicle });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
