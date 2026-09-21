import { NextResponse } from 'next/server';
import { requestPermit } from '@/lib/db';

// Rider action: request extra yearly CO2 budget (the "toll gate" permit), with a reason.
export async function POST(request, { params }) {
  const { name } = await params;
  const body = await request.json();
  const { extraKgRequested, reason } = body || {};

  if (typeof extraKgRequested !== 'number' || extraKgRequested <= 0) {
    return NextResponse.json({ error: 'extraKgRequested must be a positive number' }, { status: 400 });
  }

  try {
    const request_ = await requestPermit(decodeURIComponent(name), extraKgRequested, reason);
    return NextResponse.json({ request: request_ });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
