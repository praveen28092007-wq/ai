import { NextResponse } from 'next/server';
import { decidePermitRequest } from '@/lib/db';

// Government dashboard action: approve or deny a rider's pending permit request.
export async function POST(request, { params }) {
  const { name, id } = await params;
  const body = await request.json();
  const { approve } = body || {};

  try {
    const result = await decidePermitRequest(decodeURIComponent(name), id, !!approve);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
