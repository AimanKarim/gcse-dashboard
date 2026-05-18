'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

type ProgressEvent = {
  type: 'info' | 'success' | 'error' | 'done';
  message: string;
};

export default function Home() {
  const router = useRouter();
  const [questionPdf, setQuestionPdf] = useState<File | null>(null);
  const [markSchemePdf, setMarkSchemePdf] = useState<File | null>(null);
  const [paperLabel, setPaperLabel] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<ProgressEvent[]>([]);
  const [done, setDone] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  function addProgress(event: ProgressEvent) {
    setProgress(prev => {
      const updated = [...prev, event];
      setTimeout(() => progressRef.current?.scrollTo({ top: progressRef.current.scrollHeight, behavior: 'smooth' }), 50);
      return updated;
    });
  }

  async function handleProcess() {
    if (!questionPdf || !markSchemePdf || !paperLabel.trim()) return;

    setProcessing(true);
    setProgress([]);
    setDone(false);

    const formData = new FormData();
    formData.append('questionPdf', questionPdf);
    formData.append('markSchemePdf', markSchemePdf);
    formData.append('paperLabel', paperLabel.trim());

    try {
      const res = await fetch('/api/process', { method: 'POST', body: formData });
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        const text = decoder.decode(value);
        const lines = text.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          try {
            const event: ProgressEvent = JSON.parse(line.replace('data: ', ''));
            addProgress(event);
            if (event.type === 'done') setDone(true);
          } catch {}
        }
      }
    } catch (err: any) {
      addProgress({ type: 'error', message: err.message });
    }

    setProcessing(false);
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

          {/* Title */}
          <div style={{ marginBottom: 36, textAlign: 'center' }}>
            <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: 8 }}>
              Process a new subject
            </div>
            <div style={{ fontSize: 12, color: '#444', lineHeight: 1.6 }}>
              Upload the question paper and mark scheme PDFs.<br />The pipeline will extract, rewrite, generate prompts and test automatically.
            </div>
          </div>

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Paper label */}
            <div>
              <div style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em', marginBottom: 8 }}>SUBJECT / PAPER NAME</div>
              <input
                className="input"
                placeholder="e.g. Biology Paper 1 AQA 2024"
                value={paperLabel}
                onChange={e => setPaperLabel(e.target.value)}
                disabled={processing}
              />
            </div>

            {/* Question PDF */}
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

            {/* Mark scheme PDF */}
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

            {/* Process button */}
            <button className="btn-primary" onClick={handleProcess} disabled={!canProcess}>
              {processing ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span className="spin" style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} />
                  Processing...
                </span>
              ) : '▶ Run Pipeline'}
            </button>
          </div>

          {/* Progress log */}
          {progress.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <div style={{ fontSize: 10, color: '#444', letterSpacing: '0.1em', marginBottom: 10 }}>PIPELINE PROGRESS</div>
              <div
                ref={progressRef}
                style={{ background: '#080810', border: '1px solid #1a1a25', borderRadius: 6, padding: 16, height: 300, overflowY: 'auto', fontFamily: 'DM Mono, monospace' }}
              >
                {progress.map((p, i) => (
                  <div key={i} style={{ fontSize: 11, lineHeight: 1.8, color: p.type === 'error' ? '#f87171' : p.type === 'success' ? '#4ade80' : p.type === 'done' ? '#a5b4fc' : '#666' }}>
                    <span style={{ color: '#2a2a35', marginRight: 8, userSelect: 'none' }}>{String(i + 1).padStart(3, '0')}</span>
                    {p.message}
                  </div>
                ))}
                {processing && (
                  <div style={{ fontSize: 11, color: '#333', lineHeight: 1.8 }} className="pulse">
                    <span style={{ color: '#1a1a25', marginRight: 8 }}>---</span>running...
                  </div>
                )}
              </div>

              {done && (
                <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button className="btn-primary" onClick={() => router.push('/dashboard')}>
                    View Results in Dashboard →
                  </button>
                  <button className="btn-secondary" onClick={() => { setProgress([]); setDone(false); setQuestionPdf(null); setMarkSchemePdf(null); setPaperLabel(''); }}>
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