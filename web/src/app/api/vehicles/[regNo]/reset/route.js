import { NextResponse } from 'next/server';
import { resetVehicle } from '@/lib/db';

export async function POST(_request, { params }) {
  const { regNo } = await params;
  const vehicles = await resetVehicle(regNo);
  return NextResponse.json({ vehicles });
}
