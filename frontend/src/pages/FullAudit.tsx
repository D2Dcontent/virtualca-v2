import { useState } from 'react'
import { uploadAPI, auditAPI } from '../api'

const FILE_FIELDS = [
  { key: 'trial_balance', label: 'Trial Balance', required: true, color: '#818cf8' },
  { key: 'daybook', label: 'Daybook', required: true, color: '#34d399' },
  { key: 'balance_sheet', label: 'Balance Sheet', required: false, color: '#60a5fa' },
  { key: 'profit_loss', label: 'Profit & Loss', required: false, color: '#f59e0b' },
  { key: 'bank_statement', label: 'Bank Statement', required: false, color: '#f87171' },
  { key: 'bank_tally', label: 'Bank Ledger (Tally)', required: false, color: '#a78bfa' },
]

export default function FullAudit() {
  const [files, setFiles] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)

  const uploadFile = async (key: string, file: File | null) => {
    if (!file) return
    const form = new FormData()
    form.append(key, file)
    await uploadAPI.uploadFiles(form)
    setFiles(prev => ({ ...prev, [key]: file.name }))
  }

  const runAudit = async () => {
    setLoading(true)
    try {
      const r = await auditAPI.run()
      setResults(r.data)
    } catch { alert('Error running audit') }
    setLoading(false)
  }

  const score = results?.score
  const scoreColor = score >= 75 ? '#34d399' : score >= 50 ? '#f59e0b' : '#f87171'
  const card = { background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 16 }

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {FILE_FIELDS.map(f => (
          <div key={f.key} style={{ ...card, padding: 16, border: `1px solid ${files[f.key] ? f.color + '55' : 'var(--navy-600)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{f.label}</span>
              {f.required && <span style={{ fontSize: 11, color: '#f87171' }}>*</span>}
              {files[f.key] && <span className="tag-ok" style={{ marginLeft: 'auto' }}>✓</span>}
            </div>
            <label className="upload-zone" htmlFor={f.key} style={{ display: 'block', borderRadius: 12, padding: 12, textAlign: 'center', cursor: 'pointer' }}>
              <i className={`fas fa-cloud-upload-alt`} style={{ color: f.color, fontSize: 18, display: 'block', marginBottom: 6 }}></i>
              <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>{files[f.key] || 'Drop Excel here'}</p>
              <input type="file" id={f.key} accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => uploadFile(f.key, e.target.files?.[0] || null)} />
              <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: f.color, color: '#070E1A' }}>Choose</span>
            </label>
          </div>
        ))}
      </div>

      {files.trial_balance && !loading && (
        <button onClick={runAudit} className="btn-gold" style={{ width: '100%', padding: '16px 0', borderRadius: 16, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
          <i className="fas fa-clipboard-check"></i> Run Full Audit
        </button>
      )}

      {loading && (
        <div style={{ ...card, padding: 32, textAlign: 'center' }}>
          <i className="fas fa-cog spin" style={{ color: 'var(--gold-400)', fontSize: 32, display: 'block', marginBottom: 12 }}></i>
          <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>Running full audit + Critic AI verification...</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>Two AI models analyzing your books. This may take 1–2 minutes.</div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(52,211,153,0.1)', border: '1px solid #34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>
                <i className="fas fa-magnifying-glass" style={{ color: '#34d399', fontSize: 14 }}></i>
              </div>
              <div style={{ color: '#34d399', fontSize: 11, fontWeight: 600 }}>Audit AI</div>
              <div style={{ color: '#64748b', fontSize: 10 }}>Haiku · Detection</div>
            </div>
            <div style={{ color: '#334155', fontSize: 18, lineHeight: '36px', marginTop: 6 }}>→</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(167,139,250,0.1)', border: '1px solid #a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>
                <i className="fas fa-shield-halved" style={{ color: '#a78bfa', fontSize: 14 }}></i>
              </div>
              <div style={{ color: '#a78bfa', fontSize: 11, fontWeight: 600 }}>Critic AI</div>
              <div style={{ color: '#64748b', fontSize: 10 }}>Sonnet · Verification</div>
            </div>
          </div>
        </div>
      )}

      {results && (
        <>
          <div style={{ ...card, padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 52, fontWeight: 900, color: scoreColor }}>{score}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Health Score</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>Full Audit Complete</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10 }}>
                  {results.summary?.critical || 0} Critical · {results.summary?.warnings || 0} Warnings
                  {results.critic_review?.length > 0 && (
                    <span style={{ marginLeft: 12, background: 'rgba(167,139,250,0.12)', color: '#a78bfa', fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
                      Critic AI verified {results.critic_review.length} findings
                    </span>
                  )}
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: score + '%' }}></div></div>
              </div>
            </div>
            {results.ai_insight && (
              <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ color: '#a78bfa', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>🤖 AUDIT AI INSIGHT</div>
                <div style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.6 }}>{results.ai_insight}</div>
              </div>
            )}
          </div>

          {/* Critic AI Review Panel */}
          {results.critic_review?.length > 0 && (
            <div style={{ ...card, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(167,139,250,0.12)', border: '1px solid #a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fas fa-shield-halved" style={{ color: '#a78bfa', fontSize: 13 }}></i>
                </div>
                <div>
                  <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14 }}>Critic AI Verification</div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>Claude Sonnet reviewed every critical finding before showing it to you</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <span style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', fontSize: 11, padding: '3px 10px', borderRadius: 99, fontWeight: 600 }}>
                    {results.critic_review.filter((c: any) => c.confirmed).length} Confirmed
                  </span>
                  <span style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: 11, padding: '3px 10px', borderRadius: 99, fontWeight: 600 }}>
                    {results.critic_review.filter((c: any) => !c.confirmed).length} Rejected
                  </span>
                </div>
              </div>

              {results.critic_review.map((c: any, i: number) => (
                <div key={i} style={{ borderRadius: 12, padding: '14px 16px', marginBottom: 10, background: c.confirmed ? 'rgba(239,68,68,0.05)' : 'rgba(52,211,153,0.04)', border: `1px solid ${c.confirmed ? 'rgba(239,68,68,0.2)' : 'rgba(52,211,153,0.2)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: c.confirmed ? 'rgba(239,68,68,0.15)' : 'rgba(52,211,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <i className={`fas ${c.confirmed ? 'fa-triangle-exclamation' : 'fa-check'}`} style={{ color: c.confirmed ? '#f87171' : '#34d399', fontSize: 10 }}></i>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ color: c.confirmed ? '#f87171' : '#34d399', fontSize: 12, fontWeight: 700 }}>
                          {c.confirmed ? '⚠ CONFIRMED CRITICAL' : '✓ FALSE POSITIVE — REMOVED'}
                        </span>
                        <span style={{ background: c.confidence === 'high' ? 'rgba(52,211,153,0.1)' : c.confidence === 'medium' ? 'rgba(245,158,11,0.1)' : 'rgba(100,116,139,0.1)', color: c.confidence === 'high' ? '#34d399' : c.confidence === 'medium' ? '#fbbf24' : '#94a3b8', fontSize: 10, padding: '1px 6px', borderRadius: 99 }}>{c.confidence} confidence</span>
                        <span style={{ background: 'rgba(100,116,139,0.1)', color: '#94a3b8', fontSize: 10, padding: '1px 6px', borderRadius: 99 }}>{c.type}</span>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: c.confirmed && (c.penalty || c.action) ? 8 : 0 }}>{c.detail}</div>
                      {c.reason && <div style={{ color: '#cbd5e1', fontSize: 11, marginBottom: 4, fontStyle: 'italic' }}>Critic: {c.reason}</div>}
                      {c.confirmed && c.penalty && (
                        <div style={{ background: 'rgba(239,68,68,0.08)', borderRadius: 8, padding: '8px 10px', marginTop: 6 }}>
                          <div style={{ color: '#f87171', fontSize: 11, fontWeight: 600, marginBottom: 2 }}>Penalty under Indian Law</div>
                          <div style={{ color: '#fca5a5', fontSize: 11 }}>{c.penalty}</div>
                        </div>
                      )}
                      {c.confirmed && c.action && (
                        <div style={{ background: 'rgba(245,158,11,0.08)', borderRadius: 8, padding: '8px 10px', marginTop: 6 }}>
                          <div style={{ color: '#fbbf24', fontSize: 11, fontWeight: 600, marginBottom: 2 }}>Required Action</div>
                          <div style={{ color: '#fde68a', fontSize: 11 }}>{c.action}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
