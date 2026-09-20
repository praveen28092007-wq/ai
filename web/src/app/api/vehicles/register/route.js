import { NextResponse } from 'next/server';
import { registerVehicle } from '@/lib/db';

export async function POST(request) {
  const body = await request.json();
  const { ownerName, regNo, fuelType } = body || {};

  if (!ownerName || !regNo) {
    return NextResponse.json({ error: 'ownerName and regNo are required' }, { status: 400 });
  }

  try {
    const vehicle = await registerVehicle(ownerName, regNo, fuelType || 'petrol');
    return NextResponse.json({ vehicle });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
