/**
 * app/api/process/route.ts
 *
 * Thin proxy — forwards the two PDFs + paper label to Railway,
 * then immediately returns the job_id.
 *
 * The browser polls /api/poll/:jobId for progress updates.
 * No long-lived connection = no Vercel 60s timeout.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // just needs to cover the upload POST

const RAILWAY_URL = process.env.RAILWAY_API_URL;

export async function POST(req: NextRequest) {
  if (!RAILWAY_URL) {
    return NextResponse.json({ error: 'RAILWAY_API_URL is not set' }, { status: 500 });
  }

  const formData = await req.formData();

  const questionFile = formData.get('questionPdf') as File;
  const markingFile  = formData.get('markSchemePdf') as File;
  const paperLabel   = formData.get('paperLabel') as string;

  if (!questionFile || !markingFile || !paperLabel) {
    return NextResponse.json({ error: 'Missing files or paper label' }, { status: 400 });
  }

  // Forward to Railway with the field names the Python backend expects
  const railwayForm = new FormData();
  railwayForm.append('question_pdf', questionFile);
  railwayForm.append('marking_pdf',  markingFile);
  railwayForm.append('paper_label',  paperLabel);

  let startRes: Response;
  try {
    startRes = await fetch(`${RAILWAY_URL}/pipeline/start`, {
      method: 'POST',
      body: railwayForm,
      // @ts-expect-error
      duplex: 'half',
    });
  } catch (err: any) {
    return NextResponse.json({ error: `Could not reach Railway: ${err.message}` }, { status: 502 });
  }

  if (!startRes.ok) {
    const text = await startRes.text();
    return NextResponse.json({ error: `Railway error: ${text}` }, { status: 502 });
  }

  const { job_id } = await startRes.json();
  return NextResponse.json({ job_id });
}