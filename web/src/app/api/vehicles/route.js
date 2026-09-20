import { NextResponse } from 'next/server';
import { getAllVehicles } from '@/lib/db';

export async function GET() {
  const vehicles = await getAllVehicles();
  return NextResponse.json({ vehicles });
}
