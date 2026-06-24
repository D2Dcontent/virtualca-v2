import { useState } from 'react'
import { docCheckerAPI } from '../api'

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const RISK_COLOR: Record<string, string> = { high: '#f87171', medium: '#fbbf24', low: '#34d399' }
const RISK_BG: Record<string, string> = { high: 'rgba(239,68,68,0.1)', medium: 'rgba(245,158,11,0.1)', low: 'rgba(52,211,153,0.1)' }

export default function DocChecker() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  const run = async () => {
    setLoading(true); setError('')
    try { const r = await docCheckerAPI.run(); setData(r.data) }
    catch (e: any) { setError(e.response?.data?.error || e.message) }
    setLoading(false)
  }

  const filtered = data?.flagged?.filter((f: any) => filter === 'all' || f.risk === filter) || []
  const card = { background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 12, padding: 16, marginBottom: 10 }

  return (
    <div style={{ padding: '24px 28px' }}>
      {!data && !loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📎</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Missing Document Checker</div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Flags entries without bill/invoice reference — audit-critical</div>
          <button onClick={run} className="btn-gold" style={{ padding: '12px 28px', borderRadius: 12, fontSize: 14 }}>Check Documents</button>
          {error && <div style={{ color: '#f87171', marginTop: 12, fontSize: 12 }}>{error}</div>}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--gold-400)' }}>
          <i className="fas fa-cog spin" style={{ fontSize: 32, display: 'block', marginBottom: 12 }}></i>
          <div style={{ fontSize: 14 }}>Scanning daybook for missing documents...</div>
        </div>
      )}

      {data && (
        <>
          {data.ai_insight && (
            <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <div>
                <div style={{ color: '#a78bfa', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>CA AI INSIGHT</div>
                <div style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.6 }}>{data.ai_insight}</div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Flagged', value: data.flagged?.length || 0, color: '#f87171', sub: 'entries' },
              { label: 'High Risk', value: data.high_risk_count || 0, color: '#f87171', sub: 'missing bills' },
              { label: 'Amount at Risk', value: fmt(data.total_amount_at_risk), color: '#fbbf24', sub: 'no docs' },
              { label: 'With Docs', value: data.documented || 0, color: '#34d399', sub: 'entries OK' },
            ].map((s, i) => (
              <div key={i} style={{ background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{s.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {['all', 'high', 'medium', 'low'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ fontSize: 11, padding: '5px 12px', background: filter === f ? 'rgba(201,168,76,0.15)' : 'transparent', color: filter === f ? '#C9A84C' : '#64748b', border: `1px solid ${filter === f ? 'rgba(201,168,76,0.3)' : 'var(--navy-600)'}`, borderRadius: 8, cursor: 'pointer', textTransform: 'capitalize' }}>
                {f === 'all' ? `All (${data.flagged?.length || 0})` : f + ' risk'}
              </button>
            ))}
          </div>

          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            {filtered.length === 0
              ? <div style={{ padding: 20, color: '#64748b', fontSize: 13 }}>No entries in this category.</div>
              : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--navy-600)' }}>
                      {['Date', 'Ledger', 'Narration', 'Amount', 'Risk', 'Issue'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#64748b', fontSize: 11, fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((f: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{f.date}</td>
                        <td style={{ padding: '10px 14px', color: '#e2e8f0', fontWeight: 500 }}>{f.ledger}</td>
                        <td style={{ padding: '10px 14px', color: '#94a3b8', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.narration}</td>
                        <td style={{ padding: '10px 14px', color: '#F5F0E6', fontWeight: 600 }}>{fmt(f.amount)}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ background: RISK_BG[f.risk], color: RISK_COLOR[f.risk], fontSize: 10, padding: '2px 8px', borderRadius: 99, textTransform: 'capitalize' }}>{f.risk}</span>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 11 }}>{f.issue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>

          {data.flagged?.length > 0 && (
            <div style={{ background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderLeft: '3px solid var(--gold-500)', borderRadius: '0 12px 12px 0', padding: 16, marginBottom: 12 }}>
              <div style={{ color: 'var(--gold-400)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Auditor's Note</div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Collect bills/invoices for all {data.flagged.length} flagged entries before tax filing. High-risk entries without documents can be disallowed as expenses under Section 37(1) of Income Tax Act.</div>
            </div>
          )}
          <button onClick={() => setData(null)} style={{ fontSize: 12, padding: '8px 16px', background: 'var(--navy-700)', color: '#94a3b8', border: '1px solid var(--navy-600)', borderRadius: 8, cursor: 'pointer' }}>Re-check</button>
        </>
      )}
    </div>
  )
}
