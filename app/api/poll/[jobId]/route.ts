import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const RAILWAY_URL = process.env.RAILWAY_API_URL;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  if (!RAILWAY_URL) {
    return NextResponse.json({ error: 'RAILWAY_API_URL is not set' }, { status: 500 });
  }

  const { jobId } = await params;

  const res = await fetch(`${RAILWAY_URL}/pipeline/status/${jobId}`);

  if (!res.ok) {
    return NextResponse.json({ error: 'Could not reach Railway' }, { status: 502 });
  }

  const job = await res.json();
  return NextResponse.json(job);
}