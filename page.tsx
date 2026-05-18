'use client';

import { useState, useEffect } from 'react';

const CATEGORIES = [
  'Correct Answer',
  'Incorrect Answer',
  'Incomplete Answer',
  'Hallucinations',
  'Correct Answer but outside of Points to Discuss',
  'Partially Correct with Incorrect Information',
  'Invalid Answer',
  'Correct Answer with New Line',
  'Incorrect Answer with Formatting/Grammar Issue',
  'Correct Answer with Formatting/Grammar Issue',
];

type CategoryResult = { score: number; max: number; pass: boolean; answer: string; feedback: string; };
type Scoring = { overall_pass: boolean; status: string; results: Record<string, CategoryResult>; samples: Record<string, string>; };
type Question = { rowNum: number; question: string; marks: string; answer: string; rewriting: string; prompts: string; identity: string; scoring: Scoring | null; paper: string; qnum: string; };

export default function Dashboard() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Question | null>(null);
  const [filter, setFilter] = useState<'all' | 'pass' | 'fail' | 'pending'>('all');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => { fetchQuestions(); }, []);

  async function fetchQuestions() {
    setLoading(true);
    const res = await fetch('/api/questions');
    const data = await res.json();
    setQuestions(data.questions || []);
    setLoading(false);
  }

  async function handleApprove(q: Question) {
    setActionLoading(true); setActionMsg('Approving...');
    await fetch('/api/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rowNum: q.rowNum }) });
    setActionMsg('✅ Approved!');
    await fetchQuestions();
    setActionLoading(false);
  }

  async function handleRepairAndRetest(q: Question) {
    setActionLoading(true); setActionMsg('🔧 AI repairing prompt...');
    const repairRes = await fetch('/api/repair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rowNum: q.rowNum, identity: q.identity, scoring: q.scoring, marks: q.marks }) });
    const repairData = await repairRes.json();
    if (!repairData.success) { setActionMsg('❌ Repair failed: ' + repairData.error); setActionLoading(false); return; }
    setActionMsg('🧪 Retesting...');
    const retestRes = await fetch('/api/retest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rowNum: q.rowNum, identity: repairData.repairedPrompt, samples: q.scoring?.samples || {}, marks: q.marks }) });
    const retestData = await retestRes.json();
    setActionMsg(retestData.success ? (retestData.scoring.overall_pass ? '✅ All tests passing!' : '⚠️ Some tests still failing') : '❌ Retest failed');
    await fetchQuestions();
    setActionLoading(false);
  }

  const filtered = questions.filter(q => {
    if (filter === 'all') return true;
    if (filter === 'pending') return !q.scoring;
    if (filter === 'pass') return q.scoring?.status === 'approved' || q.scoring?.overall_pass;
    if (filter === 'fail') return q.scoring && !q.scoring.overall_pass && q.scoring.status !== 'approved';
    return true;
  });

  const stats = {
    total: questions.length,
    passed: questions.filter(q => q.scoring?.status === 'approved' || q.scoring?.overall_pass).length,
    failed: questions.filter(q => q.scoring && !q.scoring.overall_pass && q.scoring.status !== 'approved').length,
    pending: questions.filter(q => !q.scoring).length,
  };

  return (
    <div style={{ fontFamily: "'DM Mono', monospace", minHeight: '100vh', background: '#0a0a0f', color: '#e8e6e0' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #111; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        .qrow { transition: all 0.15s; cursor: pointer; border-bottom: 1px solid #1a1a25; }
        .qrow:hover { background: #12121a !important; }
        .qrow.active { background: #14141f !important; border-left: 2px solid #6366f1 !important; }
        .cat-row:hover { background: #1a1a25; }
        .btn { cursor: pointer; transition: all 0.15s; border: none; font-family: inherit; }
        .btn:hover { opacity: 0.85; transform: translateY(-1px); }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
        .fbtn { background: transparent; border: 1px solid #2a2a35; color: #888; padding: 5px 12px; border-radius: 4px; font-size: 11px; letter-spacing: 0.05em; font-family: inherit; cursor: pointer; transition: all 0.15s; }
        .fbtn.active { background: #1e1e2e; border-color: #6366f1; color: #a5b4fc; }
        .fbtn:hover { border-color: #444; color: #ccc; }
        .pulse { animation: pulse 1.5s infinite; } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      <div style={{ borderBottom: '1px solid #1a1a25', padding: '18px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>GCSE<span style={{ color: '#6366f1' }}>.</span>eval</div>
          <div style={{ fontSize: 9, color: '#333', letterSpacing: '0.15em', marginTop: 1 }}>EVALUATION REVIEW DASHBOARD</div>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          {[['TOTAL', stats.total, '#666'], ['PASSED', stats.passed, '#4ade80'], ['FAILED', stats.failed, '#f87171'], ['PENDING', stats.pending, '#fbbf24']].map(([l, v, c]) => (
            <div key={l as string} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: c as string, fontFamily: 'Syne,sans-serif' }}>{v}</div>
              <div style={{ fontSize: 9, color: '#333', letterSpacing: '0.1em' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 65px)' }}>
        <div style={{ width: 320, borderRight: '1px solid #1a1a25', overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a1a25', display: 'flex', gap: 6 }}>
            {(['all', 'fail', 'pass', 'pending'] as const).map(f => (
              <button key={f} className={`fbtn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f.toUpperCase()}</button>
            ))}
          </div>
          {loading ? <div style={{ padding: 24, color: '#333', textAlign: 'center', fontSize: 11 }} className="pulse">Loading...</div> : filtered.map(q => {
            const status = !q.scoring ? 'pending' : q.scoring.status === 'approved' || q.scoring.overall_pass ? 'pass' : 'fail';
            const passCount = q.scoring ? Object.values(q.scoring.results).filter(r => r.pass).length : 0;
            return (
              <div key={q.rowNum} className={`qrow ${selected?.rowNum === q.rowNum ? 'active' : ''}`}
                style={{ padding: '11px 14px', paddingLeft: selected?.rowNum === q.rowNum ? 12 : 14 }}
                onClick={() => { setSelected(q); setActionMsg(''); setExpandedCategory(null); }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#a5b4fc' }}>{q.qnum || '—'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: status === 'pass' ? '#4ade80' : status === 'fail' ? '#f87171' : '#fbbf24' }} />
                    <span style={{ fontSize: 10, color: '#444' }}>{q.marks}mk</span>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#555', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{q.question.substring(0, 80)}</div>
                {q.scoring && <div style={{ marginTop: 5, fontSize: 10, color: status === 'pass' ? '#4ade80' : '#f87171' }}>{passCount}/10 passing</div>}
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
          {!selected ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e1e2a', fontSize: 12, letterSpacing: '0.12em' }}>SELECT A QUESTION TO REVIEW</div>
          ) : (
            <div>
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                  <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 700, color: '#fff' }}>{selected.qnum}</div>
                  <div style={{ fontSize: 10, color: '#6366f1', background: '#1e1e35', padding: '2px 8px', borderRadius: 3, border: '1px solid #3d3d6b' }}>{selected.marks} mark{parseInt(selected.marks) !== 1 ? 's' : ''}</div>
                  <div style={{ fontSize: 10, color: '#444', background: '#111', padding: '2px 8px', borderRadius: 3, border: '1px solid #1a1a1a' }}>{selected.paper}</div>
                  {selected.scoring && <div style={{ fontSize: 10, color: selected.scoring.status === 'approved' || selected.scoring.overall_pass ? '#4ade80' : '#f87171', background: selected.scoring.status === 'approved' || selected.scoring.overall_pass ? '#0f2a1a' : '#2a0f0f', padding: '2px 8px', borderRadius: 3, border: `1px solid ${selected.scoring.status === 'approved' || selected.scoring.overall_pass ? '#1a4a2a' : '#4a1a1a'}` }}>{selected.scoring.status === 'approved' ? 'APPROVED' : selected.scoring.overall_pass ? 'PASSING' : 'NEEDS REVIEW'}</div>}
                </div>
                <div style={{ background: '#0d0d16', border: '1px solid #1a1a25', borderRadius: 6, padding: 14, marginBottom: 10 }}>
                  <div style={{ fontSize: 9, color: '#333', letterSpacing: '0.1em', marginBottom: 6 }}>ORIGINAL</div>
                  <div style={{ fontSize: 11, color: '#888', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selected.question}</div>
                </div>
                {selected.rewriting && <div style={{ background: '#0d0d16', border: '1px solid #1e1e2e', borderRadius: 6, padding: 14 }}>
                  <div style={{ fontSize: 9, color: '#6366f1', letterSpacing: '0.1em', marginBottom: 6 }}>REWRITTEN</div>
                  <div style={{ fontSize: 11, color: '#bbb', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selected.rewriting}</div>
                </div>}
              </div>

              {selected.scoring ? (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 9, color: '#333', letterSpacing: '0.1em', marginBottom: 10 }}>EVALUATION CATEGORIES</div>
                  <div style={{ border: '1px solid #1a1a25', borderRadius: 6, overflow: 'hidden' }}>
                    {CATEGORIES.map((cat, i) => {
                      const result = selected.scoring!.results[cat];
                      const isExp = expandedCategory === cat;
                      if (!result) return null;
                      return (
                        <div key={cat} style={{ borderBottom: i < 9 ? '1px solid #1a1a25' : 'none' }} className="cat-row">
                          <div style={{ display: 'flex', alignItems: 'center', padding: '9px 14px', cursor: 'pointer' }} onClick={() => setExpandedCategory(isExp ? null : cat)}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: result.pass ? '#4ade80' : '#f87171', marginRight: 10, flexShrink: 0 }} />
                            <div style={{ flex: 1, fontSize: 11, color: result.pass ? '#ccc' : '#777' }}>{cat}</div>
                            <div style={{ fontSize: 11, color: result.pass ? '#4ade80' : '#f87171', marginRight: 10 }}>{result.score}/{result.max}</div>
                            <div style={{ fontSize: 9, color: '#2a2a35' }}>{isExp ? '▲' : '▼'}</div>
                          </div>
                          {isExp && <div style={{ padding: '0 14px 12px 30px' }}>
                            {result.answer && <div style={{ marginBottom: 8 }}>
                              <div style={{ fontSize: 9, color: '#333', letterSpacing: '0.1em', marginBottom: 4 }}>SAMPLE ANSWER</div>
                              <div style={{ fontSize: 11, color: '#777', background: '#080810', padding: '8px 10px', borderRadius: 4, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{result.answer}</div>
                            </div>}
                            {result.feedback && <div>
                              <div style={{ fontSize: 9, color: '#333', letterSpacing: '0.1em', marginBottom: 4 }}>EVALUATOR RESPONSE</div>
                              <div style={{ fontSize: 11, color: '#666', background: '#080810', padding: '8px 10px', borderRadius: 4, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{result.feedback}</div>
                            </div>}
                          </div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ padding: 20, background: '#0d0d16', border: '1px solid #1a1a25', borderRadius: 6, marginBottom: 24, textAlign: 'center', color: '#444', fontSize: 11 }}>
                  No test results yet. Run <code style={{ color: '#6366f1' }}>python tester.py</code> to generate results.
                </div>
              )}

              {selected.scoring && selected.scoring.status !== 'approved' && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button className="btn" onClick={() => handleApprove(selected)} disabled={actionLoading}
                    style={{ background: '#0f2a0f', border: '1px solid #1a4a1a', color: '#4ade80', padding: '9px 18px', borderRadius: 5, fontSize: 11, letterSpacing: '0.04em' }}>
                    ✓ Approve
                  </button>
                  <button className="btn" onClick={() => handleRepairAndRetest(selected)} disabled={actionLoading}
                    style={{ background: '#0f0f2a', border: '1px solid #1a1a5a', color: '#a5b4fc', padding: '9px 18px', borderRadius: 5, fontSize: 11, letterSpacing: '0.04em' }}>
                    🔧 AI Fix & Retest
                  </button>
                  {actionMsg && <div style={{ fontSize: 11, color: actionMsg.includes('❌') ? '#f87171' : '#4ade80' }} className={actionLoading ? 'pulse' : ''}>{actionMsg}</div>}
                </div>
              )}

              {selected.scoring?.status === 'approved' && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: '#4ade80' }}>✓ This question is approved and ready to go live</div>
                  <button className="btn" onClick={() => handleApprove(selected)} disabled={actionLoading}
                    style={{ background: 'transparent', border: '1px solid #222', color: '#444', padding: '6px 12px', borderRadius: 4, fontSize: 10 }}>
                    Re-approve
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