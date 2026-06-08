'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

type LogEntry = {
  type: 'info' | 'success' | 'error' | 'done';
  message: string;
};

export default function Home() {
  const router = useRouter();
  const [questionPdf, setQuestionPdf]     = useState<File | null>(null);
  const [markSchemePdf, setMarkSchemePdf] = useState<File | null>(null);
  const [paperLabel, setPaperLabel]       = useState('');
  const [processing, setProcessing]       = useState(false);
  const [log, setLog]                     = useState<LogEntry[]>([]);
  const [done, setDone]                   = useState(false);
  const logRef     = useRef<HTMLDivElement>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLabel  = useRef('');

  function addLog(entry: LogEntry) {
    setLog(prev => {
      const next = [...prev, entry];
      setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }), 50);
      return next;
    });
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  async function handleProcess() {
    if (!questionPdf || !markSchemePdf || !paperLabel.trim()) return;

    setProcessing(true);
    setLog([]);
    setDone(false);
    lastLabel.current = '';

    // ── Step 1: Upload PDFs to Railway via our API proxy ──────────────
    addLog({ type: 'info', message: '📤 Uploading PDFs to pipeline...' });

    const formData = new FormData();
    formData.append('questionPdf',   questionPdf);
    formData.append('markSchemePdf', markSchemePdf);
    formData.append('paperLabel',    paperLabel.trim());

    let jobId: string;
    try {
      const res = await fetch('/api/process', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || !data.job_id) throw new Error(data.error || 'Failed to start pipeline');
      jobId = data.job_id;
    } catch (err: any) {
      addLog({ type: 'error', message: `❌ ${err.message}` });
      setProcessing(false);
      return;
    }

    addLog({ type: 'info', message: `🚀 Pipeline started for "${paperLabel.trim()}"` });

    // ── Step 2: Poll /api/poll/:jobId every 3 seconds ─────────────────
    // Each request is short-lived — Vercel never holds a long connection.
    pollRef.current = setInterval(async () => {
      let job: any;
      try {
        const res = await fetch(`/api/poll/${jobId}`);
        if (!res.ok) throw new Error('Status check failed');
        job = await res.json();
      } catch {
        // transient network error — just try again next tick
        return;
      }

      // Log when stage label changes (avoids spam)
      if (job.stage_label && job.stage_label !== lastLabel.current) {
        const emoji = job.stage === 1 ? '🔍' : job.stage === 2 ? '✏️' : job.stage === 3 ? '🔧' : job.stage === 4 ? '🧪' : '⏳';
        addLog({ type: 'info', message: `${emoji} ${job.stage_label}` });
        if (job.rows_total > 0) addLog({ type: 'info', message: `   Questions found: ${job.rows_total}` });
        lastLabel.current = job.stage_label;
      }

      if (job.status === 'done') {
        stopPolling();
        addLog({ type: 'success', message: `✅ Complete! ${job.rows_total} questions processed.` });
        addLog({ type: 'info',    message: `📊 Open the dashboard to review results.` });
        addLog({ type: 'done',    message: 'done' });
        setDone(true);
        setProcessing(false);
      } else if (job.status === 'failed') {
        stopPolling();
        addLog({ type: 'error', message: `❌ Pipeline failed: ${job.stage_label}` });
        if (job.error) {
          const firstLine = job.error.split('\n').filter(Boolean).pop() || job.error;
          addLog({ type: 'error', message: firstLine });
        }
        setProcessing(false);
      }
    }, 3000);
  }

  const canProcess = questionPdf && markSchemePdf && paperLabel.trim() && !processing;

  return (
    <div style={{ fontFamily: "'DM Mono', monospace", minHeight: '100vh', background: '#0a0a0f', color: '#e8e6e0', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #111; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        .drop-zone { border: 1px dashed #2a2a35; border-radius: 8px; padding: 28px; text-align: center; cursor: pointer; transition: all 0.2s; }
        .drop-zone:hover, .drop-zone.active { border-color: #6366f1; background: #0f0f1a; }
        .drop-zone input { display: none; }
        .btn-primary { background: #6366f1; color: #fff; border: none; padding: 12px 28px; border-radius: 6px; font-family: inherit; font-size: 13px; letter-spacing: 0.05em; cursor: pointer; transition: all 0.15s; }
        .btn-primary:hover:not(:disabled) { background: #4f46e5; transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-secondary { background: transparent; color: #a5b4fc; border: 1px solid #3d3d6b; padding: 10px 22px; border-radius: 6px; font-family: inherit; font-size: 12px; letter-spacing: 0.05em; cursor: pointer; transition: all 0.15s; }
        .btn-secondary:hover { background: #1e1e35; }
        .input { background: #0e0e18; border: 1px solid #2a2a35; color: #e8e6e0; padding: 10px 14px; border-radius: 6px; font-family: inherit; font-size: 13px; width: 100%; outline: none; transition: border 0.15s; }
        .input:focus { border-color: #6366f1; }
        .pulse { animation: pulse 1.5s infinite; } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .spin { animation: spin 1s linear infinite; } @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: '1px solid #1a1a25', padding: '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>GCSE<span style={{ color: '#6366f1' }}>.</span>eval</div>
          <div style={{ fontSize: 9, color: '#333', letterSpacing: '0.15em', marginTop: 1 }}>AUTOMATED EVALUATION PIPELINE</div>
        </div>
        <button className="btn-secondary" onClick={() => router.push('/dashboard')}>View Dashboard →</button>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ width: '100%', maxWidth: 680 }}>

          <div style={{ marginBottom: 36, textAlign: 'center' }}>
            <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: 8 }}>
              Process a new subject
            </div>
            <div style={{ fontSize: 12, color: '#444', lineHeight: 1.6 }}>
              Upload the question paper and mark scheme PDFs.<br />The pipeline will extract, rewrite, generate prompts and test automatically.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div>
              <div style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em', marginBottom: 8 }}>SUBJECT / PAPER NAME</div>
              <input className="input" placeholder="e.g. Biology Paper 1 AQA 2024" value={paperLabel}
                onChange={e => setPaperLabel(e.target.value)} disabled={processing} />
            </div>

            <div>
              <div style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em', marginBottom: 8 }}>QUESTION PAPER PDF</div>
              <label className={`drop-zone ${questionPdf ? 'active' : ''}`}>
                <input type="file" accept=".pdf" onChange={e => setQuestionPdf(e.target.files?.[0] || null)} disabled={processing} />
                {questionPdf ? (
                  <div>
                    <div style={{ fontSize: 13, color: '#a5b4fc', marginBottom: 4 }}>✓ {questionPdf.name}</div>
                    <div style={{ fontSize: 10, color: '#555' }}>{(questionPdf.size / 1024 / 1024).toFixed(1)} MB</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
                    <div style={{ fontSize: 12, color: '#666' }}>Click to upload question paper PDF</div>
                    <div style={{ fontSize: 10, color: '#333', marginTop: 4 }}>e.g. AQA-84611F-QP-JUN24.PDF</div>
                  </div>
                )}
              </label>
            </div>

            <div>
              <div style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em', marginBottom: 8 }}>MARK SCHEME PDF</div>
              <label className={`drop-zone ${markSchemePdf ? 'active' : ''}`}>
                <input type="file" accept=".pdf" onChange={e => setMarkSchemePdf(e.target.files?.[0] || null)} disabled={processing} />
                {markSchemePdf ? (
                  <div>
                    <div style={{ fontSize: 13, color: '#a5b4fc', marginBottom: 4 }}>✓ {markSchemePdf.name}</div>
                    <div style={{ fontSize: 10, color: '#555' }}>{(markSchemePdf.size / 1024 / 1024).toFixed(1)} MB</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
                    <div style={{ fontSize: 12, color: '#666' }}>Click to upload mark scheme PDF</div>
                    <div style={{ fontSize: 10, color: '#333', marginTop: 4 }}>e.g. AQA-84611F-MS-JUN24.PDF</div>
                  </div>
                )}
              </label>
            </div>

            <button className="btn-primary" onClick={handleProcess} disabled={!canProcess}>
              {processing ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span className="spin" style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} />
                  Processing...
                </span>
              ) : '▶ Run Pipeline'}
            </button>
          </div>

          {log.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <div style={{ fontSize: 10, color: '#444', letterSpacing: '0.1em', marginBottom: 10 }}>PIPELINE PROGRESS</div>
              <div ref={logRef}
                style={{ background: '#080810', border: '1px solid #1a1a25', borderRadius: 6, padding: 16, height: 300, overflowY: 'auto' }}>
                {log.map((p, i) => (
                  <div key={i} style={{ fontSize: 11, lineHeight: 1.8, color: p.type === 'error' ? '#f87171' : p.type === 'success' ? '#4ade80' : p.type === 'done' ? '#a5b4fc' : '#666' }}>
                    <span style={{ color: '#2a2a35', marginRight: 8, userSelect: 'none' }}>{String(i + 1).padStart(3, '0')}</span>
                    {p.message}
                  </div>
                ))}
                {processing && (
                  <div style={{ fontSize: 11, color: '#333', lineHeight: 1.8 }} className="pulse">
                    <span style={{ color: '#1a1a25', marginRight: 8 }}>---</span>polling railway...
                  </div>
                )}
              </div>

              {done && (
                <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button className="btn-primary" onClick={() => router.push('/dashboard')}>
                    View Results in Dashboard →
                  </button>
                  <button className="btn-secondary" onClick={() => { setLog([]); setDone(false); setQuestionPdf(null); setMarkSchemePdf(null); setPaperLabel(''); }}>
                    Process Another
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}