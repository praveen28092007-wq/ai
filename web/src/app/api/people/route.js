import { NextResponse } from 'next/server';
import { getPeopleSummary } from '@/lib/db';

// Used by the government dashboard: one row per person, total CO2 across all their
// vehicles, fines, and pending permit requests.
export async function GET() {
  const people = await getPeopleSummary();
  return NextResponse.json({ people });
}
