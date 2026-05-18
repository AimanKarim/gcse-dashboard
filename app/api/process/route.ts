/**
 * app/api/process/route.ts
 *
 * Thin proxy — forwards the two PDFs + paper label to the Railway
 * Python backend, then polls for progress and streams status updates
 * back to the browser as Server-Sent Events.
 *
 * The actual pipeline (extract → rewrite → prompt → test) runs entirely
 * on Railway. This file contains zero pipeline logic.
 */

import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // only needs to cover the initial POST + first poll

const RAILWAY_URL = process.env.RAILWAY_API_URL; // e.g. https://web-production-af56d.up.railway.app

function send(controller: ReadableStreamDefaultController, type: string, message: string) {
  const data = JSON.stringify({ type, message });
  controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
}

export async function POST(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (!RAILWAY_URL) {
          send(controller, 'error', '❌ RAILWAY_API_URL is not set');
          controller.close();
          return;
        }

        // ── Step 1: Forward the upload to Railway ──────────────────────
        send(controller, 'info', '📤 Uploading PDFs to pipeline...');

        const formData = await req.formData();

        // Railway expects: question_pdf, marking_pdf, paper_label
        const railwayForm = new FormData();
        const questionFile = formData.get('questionPdf') as File;
        const markingFile  = formData.get('markSchemePdf') as File;
        const paperLabel   = formData.get('paperLabel') as string;

        if (!questionFile || !markingFile || !paperLabel) {
          send(controller, 'error', '❌ Missing files or paper label');
          controller.close();
          return;
        }

        railwayForm.append('question_pdf', questionFile);
        railwayForm.append('marking_pdf',  markingFile);
        railwayForm.append('paper_label',  paperLabel);

        const startRes = await fetch(`${RAILWAY_URL}/pipeline/start`, {
          method: 'POST',
          body: railwayForm,
        });

        if (!startRes.ok) {
          const err = await startRes.text();
          send(controller, 'error', `❌ Railway rejected the request: ${err}`);
          controller.close();
          return;
        }

        const { job_id } = await startRes.json();
        send(controller, 'info', `🚀 Pipeline started (job: ${job_id})`);
        send(controller, 'info', `📄 Processing: ${paperLabel}`);

        // ── Step 2: Poll Railway for progress ──────────────────────────
        let done = false;
        let lastLabel = '';

        while (!done) {
          await new Promise(r => setTimeout(r, 3000)); // poll every 3 seconds

          const statusRes = await fetch(`${RAILWAY_URL}/pipeline/status/${job_id}`);
          if (!statusRes.ok) {
            send(controller, 'error', '❌ Could not reach Railway status endpoint');
            break;
          }

          const job = await statusRes.json();

          // Only send a message when the label changes (avoid spam)
          if (job.stage_label !== lastLabel) {
            const emoji = job.stage === 1 ? '🔍' : job.stage === 2 ? '✏️' : job.stage === 3 ? '🔧' : job.stage === 4 ? '🧪' : '⏳';
            send(controller, 'info', `${emoji} ${job.stage_label}`);
            if (job.rows_total > 0) {
              send(controller, 'info', `   Questions found: ${job.rows_total}`);
            }
            lastLabel = job.stage_label;
          }

          if (job.status === 'done') {
            send(controller, 'success', `✅ Pipeline complete! ${job.rows_total} questions processed.`);
            send(controller, 'info', `📊 Results are ready — refresh the dashboard to review.`);
            send(controller, 'done', 'done');
            done = true;
          } else if (job.status === 'failed') {
            send(controller, 'error', `❌ Pipeline failed: ${job.stage_label}`);
            if (job.error) {
              // Send first line of traceback only
              const firstLine = job.error.split('\n').filter(Boolean).pop() || job.error;
              send(controller, 'error', firstLine);
            }
            done = true;
          }
        }

        controller.close();

      } catch (err: any) {
        send(controller, 'error', `❌ ${err.message}`);
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  });
}