import { useState, useEffect, useCallback } from 'react'
import { uploadAPI, auditAPI } from '../api'

interface AuditResult {
  summary: { company: string; period: string; score: number; critical: number; warnings: number; questions: number }
  cash_violations: any[]
  tds_compliance: any[]
  outstanding: any[]
  large_expenses: any[]
  loans: any[]
  bank_accounts: any[]
  salary_compliance: any[]
  ai_insight?: string
}

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const card: React.CSSProperties = { background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 12, padding: 16, marginBottom: 12 }

function Section({ title, sub, badge, children }: { title: string; sub: string; badge?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={card}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <div>
          <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>{title}</div>
          <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>{sub}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {badge && <span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', fontSize: 11, padding: '3px 10px', borderRadius: 99 }}>{badge}</span>}
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && <div style={{ marginTop: 14 }}>{children}</div>}
    </div>
  )
}

export default function QuickAudit() {
  const [filesStatus, setFilesStatus] = useState<Record<string, any>>({})
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<AuditResult | null>(null)

  const cid = localStorage.getItem('company_id') || '1'

  useEffect(() => {
    // Load from server
    auditAPI.result().then(r => { if (r.data?.summary) setResults(r.data) }).catch(() => {})
    uploadAPI.status().then(r => { if (r.data?.tb_exists) setFilesStatus(r.data) }).catch(() => {})
  }, [])

  const uploadFile = async (key: string, file: File) => {
    setUploading(u => ({ ...u, [key]: true }))
    const form = new FormData()
    form.append(key, file)
    try {
      await uploadAPI.uploadFiles(form)
      setFilesStatus(s => ({ ...s, [`${key}_exists`]: true, [key]: { filename: file.name } }))
      // Clear old result when new file uploaded
      setResults(null)
    } catch {}
    setUploading(u => ({ ...u, [key]: false }))
  }

  const runAudit = useCallback(async () => {
    setLoading(true); setProgress(0); setResults(null)
    const iv = setInterval(() => setProgress(p => Math.min(p + 3, 90)), 800)
    try {
      const r = await auditAPI.run()
      clearInterval(iv); setProgress(100)
      setResults(r.data)
    } catch (e: any) {
      clearInterval(iv)
      alert(e.response?.data?.error || 'Audit failed')
    }
    setLoading(false)
  }, [])

  const scoreColor = results ? (results.summary.score >= 70 ? '#34d399' : results.summary.score >= 40 ? '#f97316' : '#ef4444') : '#94a3b8'

  return (
    <div style={{ padding: 20 }}>
      {/* Upload section */}
      {!results && !loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[
              { key: 'trial_balance', label: 'Trial Balance', color: '#818cf8' },
              { key: 'daybook', label: 'Daybook', color: '#34d399' },
            ].map(f => (
              <div key={f.key} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ color: 'var(--text)', fontWeight: 600 }}>{f.label}</div>
                  {filesStatus[`${f.key}_exists`] && <span style={{ marginLeft: 'auto', background: 'rgba(52,211,153,0.12)', color: '#34d399', fontSize: 11, padding: '2px 8px', borderRadius: 99, border: '1px solid rgba(52,211,153,0.3)' }}>Loaded</span>}
                </div>
                <label style={{ display: 'block', border: '2px dashed var(--navy-500)', borderRadius: 10, padding: 14, textAlign: 'center', cursor: 'pointer' }}>
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 8 }}>{filesStatus[f.key]?.filename || 'Drop file here'}</div>
                  <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadFile(f.key, e.target.files[0])} />
                  <span style={{ background: uploading[f.key] ? 'var(--muted)' : f.color, color: 'var(--navy-900)', fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 8 }}>
                    {uploading[f.key] ? 'Uploading...' : 'Choose File'}
                  </span>
                </label>
              </div>
            ))}
          </div>
          {filesStatus.trial_balance_exists && (
            <button onClick={runAudit} style={{ width: '100%', padding: '14px 0', background: 'var(--gold-500)', color: 'var(--navy-900)', borderRadius: 12, fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              Run Quick Audit
            </button>
          )}
        </>
      )}

      {/* Progress */}
      {loading && (
        <div style={{ ...card, textAlign: 'center', padding: 32 }}>
          <div style={{ color: 'var(--gold-400)', fontSize: 28, marginBottom: 12 }}>⚙</div>
          <div style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>Analyzing your books... {progress}%</div>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 14 }}>This takes 30–60 seconds</div>
          <div style={{ height: 6, background: 'var(--navy-700)', borderRadius: 99 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--gold-500)', borderRadius: 99, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <>
          {/* Score header */}
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 20, marginBottom: 12 }}>
            <div style={{ textAlign: 'center', width: 80 }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: scoreColor }}>{results.summary.score}</div>
              <div style={{ color: 'var(--muted)', fontSize: 10 }}>/100</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 16 }}>{results.summary.company || 'Audit Complete'}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 10 }}>{results.summary.period}</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <span style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', padding: '4px 12px', borderRadius: 99, fontSize: 12 }}>{results.summary.critical} Critical</span>
                <span style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)', padding: '4px 12px', borderRadius: 99, fontSize: 12 }}>{results.summary.warnings} Warnings</span>
                <span style={{ background: 'rgba(96,165,250,0.1)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.2)', padding: '4px 12px', borderRadius: 99, fontSize: 12 }}>{results.summary.questions} Questions</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={runAudit} style={{ fontSize: 12, padding: '7px 14px', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 10, cursor: 'pointer' }}>Re-run Audit</button>
              <button onClick={() => setResults(null)} style={{ fontSize: 12, padding: '7px 14px', background: 'var(--navy-700)', color: 'var(--muted)', border: '1px solid var(--navy-600)', borderRadius: 10, cursor: 'pointer' }}>Change Files</button>
            </div>
          </div>

          {/* Sections */}
          <Section title="Cash Violations" sub="Sec 40A(3) >₹10k · Sec 269ST >₹2L" badge={results.cash_violations.length ? `${results.cash_violations.length} issues` : undefined}>
            {results.cash_violations.length === 0
              ? <div style={{ color: '#34d399', fontSize: 13 }}>✓ No cash violations found</div>
              : results.cash_violations.map((v, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--navy-600)', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>{v.date}</span> · <span style={{ color: 'var(--text)' }}>{v.party}</span> · <span style={{ color: '#f87171', fontWeight: 600 }}>{fmt(v.amount)}</span> · <span style={{ color: 'var(--muted)', fontSize: 11 }}>Sec {v.section}</span>
                </div>
              ))
            }
          </Section>

          <Section title="TDS Compliance" sub="Sec 194C · 194J · 194I · 194H" badge={results.tds_compliance.length ? `₹${results.tds_compliance.reduce((s, t) => s + t.tds_expected, 0).toLocaleString('en-IN')} exposure` : undefined}>
            {results.tds_compliance.length === 0
              ? <div style={{ color: '#34d399', fontSize: 13 }}>✓ No TDS issues found</div>
              : results.tds_compliance.map((t, i) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--navy-600)' }}>
                  <div style={{ color: 'var(--text)', fontWeight: 600 }}>{t.party}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{t.issue}</div>
                </div>
              ))
            }
          </Section>

          <Section title="Outstanding Balances" sub="Suspense accounts · abnormal balances" badge={results.outstanding.length ? `${results.outstanding.length} items` : undefined}>
            {results.outstanding.length === 0
              ? <div style={{ color: '#34d399', fontSize: 13 }}>✓ All balances look normal</div>
              : results.outstanding.map((o, i) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--navy-600)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text)', fontWeight: 600 }}>{o.ledger}</span>
                    <span style={{ color: '#f87171', fontWeight: 700 }}>{fmt(o.balance)}</span>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{o.issue}</div>
                </div>
              ))
            }
          </Section>

          <Section title="Large Expenses" sub="Payments above ₹1L · bill & TDS verification" badge={results.large_expenses.length ? `${results.large_expenses.length} entries` : undefined}>
            {results.large_expenses.slice(0, 15).map((e, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--navy-600)', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>{e.date}</span>
                <span style={{ color: 'var(--text)', flex: 1, marginLeft: 12 }}>{e.party}</span>
                <span style={{ color: '#fbbf24', fontWeight: 600 }}>{fmt(e.amount)}</span>
              </div>
            ))}
          </Section>

          <Section title="Loans & Director Advances" sub="Sec 269SS/269T · long-pending advances" badge={results.loans.length ? `${results.loans.length} loans` : undefined}>
            {results.loans.map((l, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--navy-600)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{l.ledger}</span>
                  <span style={{ color: '#f87171', fontWeight: 700 }}>{fmt(Math.abs(l.balance))}</span>
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{l.note}</div>
              </div>
            ))}
          </Section>

          <Section title="Bank Accounts in Books" sub="All bank ledgers detected · reconcile with statement" badge={results.bank_accounts.length ? `${results.bank_accounts.length} accounts` : undefined}>
            {results.bank_accounts.map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--navy-600)', fontSize: 13 }}>
                <span style={{ color: 'var(--text)' }}>{b.ledger}</span>
                <span style={{ color: '#34d399', fontWeight: 600 }}>{fmt(b.balance)} {b.dr_cr}</span>
              </div>
            ))}
          </Section>

          <Section title="Salary / PF / PT Compliance" sub="EPF Act · Professional Tax · salary deductions" badge={results.salary_compliance.filter((s: any) => s.severity === 'Critical').length ? `${results.salary_compliance.filter((s: any) => s.severity === 'Critical').length} critical` : undefined}>
            {results.salary_compliance.map((s, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--navy-600)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 99, background: s.severity === 'Critical' ? 'rgba(239,68,68,0.15)' : s.severity === 'Important' ? 'rgba(245,158,11,0.15)' : 'rgba(52,211,153,0.15)', color: s.severity === 'Critical' ? '#f87171' : s.severity === 'Important' ? '#fbbf24' : '#34d399', flexShrink: 0 }}>{s.severity}</span>
                <span style={{ color: 'var(--text)', fontSize: 13 }}>{s.issue}</span>
              </div>
            ))}
          </Section>

          {/* AI Insight */}
          {results.ai_insight && (
            <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 12, padding: '16px 20px', marginTop: 4 }}>
              <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: 12, marginBottom: 8 }}>🤖 CA AI INSIGHT</div>
              <div style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{results.ai_insight}</div>
            </div>
          )}

          {/* Footer */}
          <div style={{ ...card, textAlign: 'center', marginTop: 4 }}>
            <div style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>Audit Complete</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>All sections analysed. Use Ask Your CA for specific questions.</div>
          </div>
        </>
      )}
    </div>
  )
}
