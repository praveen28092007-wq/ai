import { NextResponse } from 'next/server';
import { issueFine } from '@/lib/db';

// Government dashboard action: issue a fine against a person (all their vehicles combined).
export async function POST(request, { params }) {
  const { name } = await params;
  const body = await request.json();
  const { amountInr, reason } = body || {};

  if (typeof amountInr !== 'number' || amountInr <= 0) {
    return NextResponse.json({ error: 'amountInr must be a positive number' }, { status: 400 });
  }

  try {
    const fine = await issueFine(decodeURIComponent(name), amountInr, reason);
    return NextResponse.json({ fine });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
