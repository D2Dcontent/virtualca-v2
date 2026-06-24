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
  ledger_classification: any[]
  fixed_assets: any[]
  critic_review: any[]
  ai_insight?: string
}

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const card: React.CSSProperties = { background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 14, padding: 20, marginBottom: 14 }

const sevColor = (s: string) => s === 'Critical' ? '#ef4444' : s === 'Important' ? '#f97316' : s === 'Review' ? '#60a5fa' : '#34d399'
const sevBg = (s: string) => s === 'Critical' ? 'rgba(239,68,68,0.08)' : s === 'Important' ? 'rgba(249,115,22,0.08)' : s === 'Review' ? 'rgba(96,165,250,0.08)' : 'rgba(52,211,153,0.08)'

// Timeline finding card
function Finding({ dot, title, badge, issue, law, penalty, action, stamp, children }: {
  dot: string; title: string; badge?: string; issue: string;
  law?: string; penalty?: string; action?: string;
  stamp?: { confirmed: boolean; confidence: string; reason: string }
  children?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      {/* Timeline dot */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3, flexShrink: 0 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: dot, boxShadow: `0 0 6px ${dot}` }} />
        <div style={{ width: 1, flex: 1, background: 'rgba(255,255,255,0.06)', marginTop: 6 }} />
      </div>
      {/* Content */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14 }}>{title}</span>
          {badge && <span style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.3)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>{badge}</span>}
        </div>
        <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>{issue}</div>

        {children}

        {/* LAW / PENALTY / ACTION rows */}
        {(law || penalty || action) && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 14px', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {law && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: '#60a5fa', fontWeight: 700, fontSize: 11, minWidth: 60 }}>LAW</span>
                <span style={{ color: '#e2e8f0', fontSize: 12 }}>{law}</span>
              </div>
            )}
            {penalty && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: '#f87171', fontWeight: 700, fontSize: 11, minWidth: 60 }}>PENALTY</span>
                <span style={{ color: '#e2e8f0', fontSize: 12 }}>{penalty}</span>
              </div>
            )}
            {action && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 11, minWidth: 60 }}>ACTION</span>
                <span style={{ color: '#e2e8f0', fontSize: 12 }}>{action}</span>
              </div>
            )}
          </div>
        )}

        {/* Verification stamp */}
        {stamp && (
          <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, background: stamp.confirmed ? 'rgba(239,68,68,0.08)' : 'rgba(52,211,153,0.08)', border: `1px solid ${stamp.confirmed ? 'rgba(239,68,68,0.25)' : 'rgba(52,211,153,0.25)'}` }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: stamp.confirmed ? '#f87171' : '#34d399' }}>
              {stamp.confirmed ? '⚠ CONFIRMED RISK' : '✓ NOT A VIOLATION'}
            </span>
            <span style={{ color: '#64748b', fontSize: 11 }}>·</span>
            <span style={{ color: '#94a3b8', fontSize: 11 }}>{stamp.confidence} confidence</span>
            {stamp.reason && <><span style={{ color: '#64748b', fontSize: 11 }}>·</span><span style={{ color: '#94a3b8', fontSize: 11, fontStyle: 'italic' }}>{stamp.reason}</span></>}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, sub, icon, badge, badgeColor, empty, children }: {
  title: string; sub: string; icon: string; badge?: string; badgeColor?: string; empty?: string; children?: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  const bc = badgeColor || '#f87171'
  return (
    <div style={card}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: open ? 8 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <div>
            <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14 }}>{title}</div>
            <div style={{ color: '#475569', fontSize: 11, marginTop: 1 }}>{sub}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {badge && <span style={{ background: bc + '22', color: bc, border: `1px solid ${bc}55`, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>{badge}</span>}
          <span style={{ color: '#475569', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && (
        empty
          ? <div style={{ color: '#34d399', fontSize: 13, padding: '12px 0', display: 'flex', alignItems: 'center', gap: 8 }}><span>✓</span>{empty}</div>
          : <div>{children}</div>
      )}
    </div>
  )
}

export default function QuickAudit() {
  const [filesStatus, setFilesStatus] = useState<Record<string, any>>({})
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<AuditResult | null>(null)

  useEffect(() => {
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
      setResults(null)
    } catch {}
    setUploading(u => ({ ...u, [key]: false }))
  }

  const runAudit = useCallback(async () => {
    setLoading(true); setProgress(0); setResults(null)
    const iv = setInterval(() => setProgress(p => Math.min(p + 3, 800)), 800)
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

  // Build critic lookup by detail string
  const criticMap: Record<string, any> = {}
  results?.critic_review?.forEach((c: any) => { criticMap[c.detail] = c })

  return (
    <div style={{ padding: 20 }}>
      {/* Upload */}
      {!results && !loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[
              { key: 'trial_balance', label: 'Trial Balance', color: '#818cf8' },
              { key: 'daybook', label: 'Daybook', color: '#34d399' },
            ].map(f => (
              <div key={f.key} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ color: '#f1f5f9', fontWeight: 600 }}>{f.label}</div>
                  {filesStatus[`${f.key}_exists`] && <span style={{ marginLeft: 'auto', background: 'rgba(52,211,153,0.12)', color: '#34d399', fontSize: 11, padding: '2px 8px', borderRadius: 99, border: '1px solid rgba(52,211,153,0.3)' }}>Loaded</span>}
                </div>
                <label style={{ display: 'block', border: '2px dashed var(--navy-500)', borderRadius: 10, padding: 14, textAlign: 'center', cursor: 'pointer' }}>
                  <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>{filesStatus[f.key]?.filename || 'Drop file here'}</div>
                  <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadFile(f.key, e.target.files[0])} />
                  <span style={{ background: uploading[f.key] ? '#64748b' : f.color, color: '#070E1A', fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 8 }}>
                    {uploading[f.key] ? 'Uploading...' : 'Choose File'}
                  </span>
                </label>
              </div>
            ))}
          </div>
          {filesStatus.trial_balance_exists && (
            <button onClick={runAudit} style={{ width: '100%', padding: '14px 0', background: 'var(--gold-500)', color: '#070E1A', borderRadius: 12, fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              Run Quick Audit
            </button>
          )}
        </>
      )}

      {/* Progress */}
      {loading && (
        <div style={{ ...card, textAlign: 'center', padding: 32 }}>
          <div style={{ color: 'var(--gold-400)', fontSize: 28, marginBottom: 12 }}>⚙</div>
          <div style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: 4 }}>Analyzing your books... {progress}%</div>
          <div style={{ color: '#64748b', fontSize: 12, marginBottom: 14 }}>This takes 30–60 seconds</div>
          <div style={{ height: 6, background: 'var(--navy-700)', borderRadius: 99 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--gold-500)', borderRadius: 99, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <>
          {/* Score header */}
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 20, marginBottom: 14 }}>
            <div style={{ textAlign: 'center', width: 80 }}>
              <div style={{ fontSize: 44, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{results.summary.score}</div>
              <div style={{ color: '#475569', fontSize: 10, marginTop: 2 }}>/100</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 16 }}>{results.summary.company || 'Audit Complete'}</div>
              <div style={{ color: '#64748b', fontSize: 12, marginBottom: 10 }}>{results.summary.period}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', padding: '3px 10px', borderRadius: 99, fontSize: 12 }}>{results.summary.critical} Critical</span>
                <span style={{ background: 'rgba(249,115,22,0.1)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.2)', padding: '3px 10px', borderRadius: 99, fontSize: 12 }}>{results.summary.warnings} Warnings</span>
                <span style={{ background: 'rgba(96,165,250,0.1)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.2)', padding: '3px 10px', borderRadius: 99, fontSize: 12 }}>{results.summary.questions} Questions</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={runAudit} style={{ fontSize: 12, padding: '7px 14px', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 10, cursor: 'pointer' }}>Re-run</button>
              <button onClick={() => setResults(null)} style={{ fontSize: 12, padding: '7px 14px', background: 'var(--navy-700)', color: '#64748b', border: '1px solid var(--navy-600)', borderRadius: 10, cursor: 'pointer' }}>Change Files</button>
            </div>
          </div>

          {/* AI Insight */}
          {results.ai_insight && (
            <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 14, padding: '16px 20px', marginBottom: 14 }}>
              <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', marginBottom: 8 }}>CA AUDIT SUMMARY</div>
              <div style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.7 }}>{results.ai_insight}</div>
            </div>
          )}

          {/* TDS Compliance */}
          <Section title="TDS Compliance" sub="Sec 194C · 194J · 194I · 194H · 194A" icon="📋"
            badge={results.tds_compliance?.length ? `₹${results.tds_compliance.reduce((s: number, t: any) => s + (t.tds_expected || 0), 0).toLocaleString('en-IN')} exposure` : undefined}
            empty={!results.tds_compliance?.length ? 'No TDS issues found' : undefined}>
            {results.tds_compliance?.map((t: any, i: number) => {
              const key = `Party: ${t.party}, Amount: Rs.${t.tds_expected}, Section: ${t.section}`
              const critic = criticMap[key] || results.critic_review?.find((c: any) => c.detail?.includes(t.party))
              return (
                <Finding key={i}
                  dot="#ef4444"
                  title={t.party}
                  badge={`Sec ${t.section}`}
                  issue={t.issue || `Total payments ₹${Number(t.total_paid||0).toLocaleString('en-IN')}. TDS under Sec ${t.section} @ ${t.rate}% applies — TDS should have been ${fmt(t.tds_expected)}.`}
                  law={`Sec ${t.section} Income Tax Act — ${t.description || 'TDS applicable'} @ ${t.rate}%`}
                  penalty={`Interest @ 1.5%/month u/s 201(1A) for non-deduction. Penalty equal to TDS amount u/s 271C.`}
                  action={`Deduct TDS ${fmt(t.tds_expected)}, deposit via challan 281, file TDS return in Form 26Q.`}
                  stamp={critic ? { confirmed: critic.confirmed, confidence: critic.confidence, reason: critic.reason } : undefined}
                >
                  <div style={{ display: 'flex', gap: 20, marginBottom: 4 }}>
                    <div><div style={{ color: '#64748b', fontSize: 10, fontWeight: 600 }}>TOTAL PAID</div><div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14 }}>{fmt(t.total_paid)}</div></div>
                    <div><div style={{ color: '#64748b', fontSize: 10, fontWeight: 600 }}>TDS DUE</div><div style={{ color: '#f87171', fontWeight: 700, fontSize: 14 }}>{fmt(t.tds_expected)} <span style={{ fontSize: 11, color: '#64748b' }}>@{t.rate}%</span></div></div>
                  </div>
                </Finding>
              )
            })}
          </Section>

          {/* Cash Violations */}
          <Section title="Cash Violations" sub="Sec 40A(3) · Sec 269ST · Sec 269SS" icon="💵"
            badge={results.cash_violations?.length ? `${results.cash_violations.length} violations` : undefined}
            empty={!results.cash_violations?.length ? 'No cash violations found' : undefined}>
            {results.cash_violations?.map((v: any, i: number) => {
              const key = `Party: ${v.party}, Amount: Rs.${v.amount}, Section: ${v.section}`
              const critic = criticMap[key] || results.critic_review?.find((c: any) => c.detail?.includes(v.party))
              return (
                <Finding key={i}
                  dot="#ef4444"
                  title={v.party}
                  badge={`Sec ${v.section}`}
                  issue={v.impact || `Cash ${v.voucher_type === 'Receipt' ? 'receipt' : 'payment'} of ${fmt(v.amount)} on ${v.date} violates Sec ${v.section}.`}
                  law={v.law || `Sec ${v.section} Income Tax Act`}
                  penalty={`Penalty 100% of transaction amount = ${fmt(v.amount)} u/s ${v.section === '269ST' ? '271DA' : '271D'}`}
                  action={`Reverse cash transaction. Use banking channel (NEFT/RTGS/cheque) for payments above ₹${v.section === '269ST' ? '2,00,000' : '10,000'}.`}
                  stamp={critic ? { confirmed: critic.confirmed, confidence: critic.confidence, reason: critic.reason } : undefined}
                >
                  <div style={{ display: 'flex', gap: 20, marginBottom: 4 }}>
                    <div><div style={{ color: '#64748b', fontSize: 10, fontWeight: 600 }}>DATE</div><div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 13 }}>{v.date}</div></div>
                    <div><div style={{ color: '#64748b', fontSize: 10, fontWeight: 600 }}>AMOUNT</div><div style={{ color: '#f87171', fontWeight: 700, fontSize: 14 }}>{fmt(v.amount)}</div></div>
                  </div>
                </Finding>
              )
            })}
          </Section>

          {/* Outstanding Balances */}
          <Section title="Outstanding Balances" sub="Suspense · abnormal debtors · negative cash" icon="⚖️"
            badge={results.outstanding?.length ? `${results.outstanding.length} items` : undefined}
            badgeColor="#f97316"
            empty={!results.outstanding?.length ? 'All balances look normal' : undefined}>
            {results.outstanding?.map((o: any, i: number) => {
              const critic = results.critic_review?.find((c: any) => c.detail?.includes(o.ledger))
              return (
                <Finding key={i}
                  dot={sevColor(o.severity)}
                  title={o.ledger}
                  issue={o.issue}
                  law={o.law}
                  penalty={o.severity === 'Critical' ? 'Qualifies as audit qualification. Affects financial statements under AS 1.' : undefined}
                  action={`Investigate and clear this balance before year-end closing.`}
                  stamp={critic ? { confirmed: critic.confirmed, confidence: critic.confidence, reason: critic.reason } : undefined}
                >
                  {o.amount > 0 && <div style={{ marginBottom: 4 }}><div style={{ color: '#64748b', fontSize: 10, fontWeight: 600 }}>BALANCE</div><div style={{ color: sevColor(o.severity), fontWeight: 700, fontSize: 14 }}>{fmt(o.amount)}</div></div>}
                </Finding>
              )
            })}
          </Section>

          {/* Loans */}
          <Section title="Loans & Director Advances" sub="Sec 269SS/269T · Director loans · pending advances" icon="🏦"
            badge={results.loans?.length ? `${results.loans.length} accounts` : undefined}
            badgeColor="#a78bfa"
            empty={!results.loans?.length ? 'No loan issues found' : undefined}>
            {results.loans?.map((l: any, i: number) => (
              <Finding key={i}
                dot="#a78bfa"
                title={l.ledger}
                badge={l.is_director ? 'DIRECTOR' : undefined}
                issue={l.question || `Loan/advance balance of ${fmt(l.balance)} pending. Verify nature and compliance.`}
                law={l.law || 'Sec 269SS/269T Income Tax Act — cash loans above ₹20,000 prohibited'}
                penalty={`Penalty 100% of loan amount if cash mode used u/s 271D/271E`}
                action={`Obtain written loan agreement. Ensure repayment via banking channel. Report in ITR Schedule AL.`}
              >
                <div style={{ marginBottom: 4 }}><div style={{ color: '#64748b', fontSize: 10, fontWeight: 600 }}>BALANCE</div><div style={{ color: '#a78bfa', fontWeight: 700, fontSize: 14 }}>{fmt(Math.abs(l.balance))}</div></div>
              </Finding>
            ))}
          </Section>

          {/* Salary */}
          <Section title="Salary / PF / PT Compliance" sub="EPF Act · ESI Act · WB Professional Tax Act 1979" icon="👥"
            badge={results.salary_compliance?.filter((s: any) => s.severity === 'Critical').length ? `${results.salary_compliance.filter((s: any) => s.severity === 'Critical').length} critical` : undefined}
            empty={!results.salary_compliance?.length ? 'No salary compliance issues' : undefined}>
            {results.salary_compliance?.map((s: any, i: number) => {
              const critic = results.critic_review?.find((c: any) => c.detail?.includes(s.issue?.substring(0, 30)))
              return (
                <Finding key={i}
                  dot={sevColor(s.severity)}
                  title={s.severity === 'Critical' ? 'Critical Issue' : s.severity === 'Important' ? 'Important' : 'Review'}
                  issue={s.issue}
                  law={s.law}
                  penalty={s.impact}
                  action={s.action}
                  stamp={critic ? { confirmed: critic.confirmed, confidence: critic.confidence, reason: critic.reason } : undefined}
                />
              )
            })}
          </Section>

          {/* Large Expenses */}
          <Section title="Large Payments" sub="Payments above ₹1L — verify bill + TDS" icon="💰"
            badge={results.large_expenses?.length ? `${results.large_expenses.length} entries` : undefined}
            badgeColor="#fbbf24"
            empty={!results.large_expenses?.length ? 'No large payments found' : undefined}>
            {results.large_expenses?.slice(0, 20).map((e: any, i: number) => (
              <Finding key={i}
                dot="#fbbf24"
                title={e.party}
                issue={`Payment of ${fmt(e.amount)} on ${e.date}. Verify supporting bill and check TDS applicability.`}
                law="Sec 40A(3) — cash payments above ₹10,000 disallowed. Check TDS under relevant section."
                action="Obtain invoice/bill. Check if TDS deductible. Ensure payment via bank if cash."
              >
                <div style={{ display: 'flex', gap: 20, marginBottom: 4 }}>
                  <div><div style={{ color: '#64748b', fontSize: 10, fontWeight: 600 }}>DATE</div><div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 13 }}>{e.date}</div></div>
                  <div><div style={{ color: '#64748b', fontSize: 10, fontWeight: 600 }}>AMOUNT</div><div style={{ color: '#fbbf24', fontWeight: 700, fontSize: 14 }}>{fmt(e.amount)}</div></div>
                </div>
              </Finding>
            ))}
          </Section>

          {/* Bank Accounts */}
          <Section title="Bank Accounts in Books" sub="All bank ledgers — reconcile with bank statement" icon="🏛️"
            badge={results.bank_accounts?.length ? `${results.bank_accounts.length} accounts` : undefined}
            badgeColor="#34d399"
            empty={!results.bank_accounts?.length ? 'No bank accounts found' : undefined}>
            {results.bank_accounts?.map((b: any, i: number) => (
              <Finding key={i}
                dot="#34d399"
                title={b.ledger}
                issue={`Balance as per books: ${fmt(b.balance)} ${b.dr_cr}. Reconcile with bank statement to identify unmatched entries.`}
                action="Obtain bank statement. Match every entry. Prepare Bank Reconciliation Statement (BRS)."
              >
                <div style={{ marginBottom: 4 }}><div style={{ color: '#64748b', fontSize: 10, fontWeight: 600 }}>BOOK BALANCE</div><div style={{ color: '#34d399', fontWeight: 700, fontSize: 14 }}>{fmt(b.balance)} <span style={{ fontSize: 11, color: '#64748b' }}>{b.dr_cr}</span></div></div>
              </Finding>
            ))}
          </Section>

          {/* Fixed Assets */}
          {results.fixed_assets?.length > 0 && (
            <Section title="Fixed Assets" sub="Schedule II Companies Act · CARO 2020 · AS 10" icon="🏗️"
              badge={`${results.fixed_assets.length} items`} badgeColor="#60a5fa">
              {results.fixed_assets.map((f: any, i: number) => (
                <Finding key={i}
                  dot="#60a5fa"
                  title="Fixed Asset Issue"
                  issue={f.issue}
                  law={f.law}
                  action={f.action}
                />
              ))}
            </Section>
          )}

          {/* Ledger Classification */}
          {results.ledger_classification?.length > 0 && (
            <Section title="Ledger Classification" sub="ICAI Chart of Accounts · Tally group conventions" icon="📂"
              badge={`${results.ledger_classification.length} issues`} badgeColor="#f97316">
              {results.ledger_classification.map((lc: any, i: number) => (
                <Finding key={i}
                  dot={sevColor(lc.severity)}
                  title={lc.ledger}
                  issue={`Currently placed under "${lc.current_group}". Should be under "${lc.correct_group}".`}
                  law={lc.rule}
                  action={`Move ledger to correct group "${lc.correct_group}" in Tally before generating final reports.`}
                />
              ))}
            </Section>
          )}

          {/* Footer */}
          <div style={{ ...card, textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: 4 }}>Audit Complete</div>
            <div style={{ color: '#475569', fontSize: 12 }}>All sections analysed. Use Ask Your CA for specific questions.</div>
          </div>
        </>
      )}
    </div>
  )
}
