import { NextResponse } from 'next/server';
import { getVehiclesOwnedBy } from '@/lib/db';

export async function GET(_request, { params }) {
  const { name } = await params;
  const vehicles = await getVehiclesOwnedBy(decodeURIComponent(name));
  return NextResponse.json({ vehicles });
}
