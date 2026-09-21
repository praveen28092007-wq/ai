import { NextResponse } from 'next/server';
import { getPersonState, markPersonRead } from '@/lib/db';

// Used by the rider app/portal to poll their own fines + permit request status.
export async function GET(_request, { params }) {
  const { name } = await params;
  const person = await getPersonState(decodeURIComponent(name));
  return NextResponse.json({ person });
}

// Clears the unread badge once the rider has actually seen their fines/decisions.
export async function POST(_request, { params }) {
  const { name } = await params;
  try {
    const person = await markPersonRead(decodeURIComponent(name));
    return NextResponse.json({ person });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
