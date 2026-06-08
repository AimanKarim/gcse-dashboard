/**
 * app/api/poll/[jobId]/route.ts
 *
 * Single-request status check. The browser calls this every 3 seconds.
 * Each call takes ~200ms, never times out.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const RAILWAY_URL = process.env.RAILWAY_API_URL;

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  if (!RAILWAY_URL) {
    return NextResponse.json({ error: 'RAILWAY_API_URL is not set' }, { status: 500 });
  }

  const res = await fetch(`${RAILWAY_URL}/pipeline/status/${params.jobId}`);

  if (!res.ok) {
    return NextResponse.json({ error: 'Could not reach Railway' }, { status: 502 });
  }

  const job = await res.json();
  return NextResponse.json(job);
}