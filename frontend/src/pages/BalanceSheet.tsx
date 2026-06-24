import { useState, useEffect } from 'react'
import API from '../api'

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const card = { background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 12, padding: 16, marginBottom: 10 }

function Section({ title, data: d, color }: { title: string; data: Record<string, { total: number; items: { ledger: string; balance: number }[] }>; color: string }) {
  return (
    <div style={card}>
      <div style={{ color, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>{title}</div>
      {Object.entries(d).map(([sub, info]) => (
        <div key={sub} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--navy-600)' }}>
            <span style={{ color: '#8AA8C0', fontSize: 12, fontWeight: 500 }}>{sub}</span>
            <span style={{ color: '#F5F0E6', fontSize: 12, fontWeight: 600 }}>{fmt(info.total)}</span>
          </div>
          {info.items.map((it, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0 4px 12px' }}>
              <span style={{ color: '#4A6A8A', fontSize: 11 }}>{it.ledger}</span>
              <span style={{ color: '#8AA8C0', fontSize: 11 }}>{fmt(it.balance)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function BalanceSheet() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => { API.get('/api/balance-sheet').then(r => { if (r.data && Object.keys(r.data).length > 0) setData(r.data) }).catch(() => {}) }, [])

  const run = async () => {
    setLoading(true); setError('')
    try { const r = await API.post('/api/balance-sheet'); setData(r.data) }
    catch (e: any) { setError(e.response?.data?.error || e.message) }
    setLoading(false)
  }

  return (
    <div style={{ padding: 20 }}>
      {!data && !loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚖️</div>
          <div style={{ color: '#F5F0E6', fontWeight: 600, marginBottom: 6 }}>Balance Sheet Generator</div>
          <div style={{ color: '#4A6A8A', fontSize: 13, marginBottom: 20 }}>Auto-generates from Trial Balance · Schedule III format</div>
          <button onClick={run} style={{ background: 'var(--gold-500)', color: 'var(--navy-900)', border: 'none', borderRadius: 10, padding: '12px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Generate Balance Sheet
          </button>
          {error && <div style={{ color: '#f87171', marginTop: 12, fontSize: 12 }}>{error}</div>}
        </div>
      )}
      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#C9A84C' }}>Generating...</div>}
      {data && (
        <>
          {data.ai_insight && (
            <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12, padding: '14px 16px', marginBottom: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <div>
                <div style={{ color: '#a78bfa', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>CA AI INSIGHT</div>
                <div style={{ color: '#e2e8f0', fontSize: 12, lineHeight: 1.6 }}>{data.ai_insight}</div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ ...card, flex: 1, minWidth: 140, margin: 0 }}>
              <div style={{ color: '#4A6A8A', fontSize: 11 }}>Total Assets</div>
              <div style={{ color: '#60a5fa', fontSize: 22, fontWeight: 700 }}>{fmt(data.total_assets)}</div>
            </div>
            <div style={{ ...card, flex: 1, minWidth: 140, margin: 0 }}>
              <div style={{ color: '#4A6A8A', fontSize: 11 }}>Total Liabilities + Equity</div>
              <div style={{ color: '#C9A84C', fontSize: 22, fontWeight: 700 }}>{fmt(data.total_liabilities)}</div>
            </div>
            <div style={{ ...card, flex: 1, minWidth: 140, margin: 0 }}>
              <div style={{ color: '#4A6A8A', fontSize: 11 }}>Balance Check</div>
              <div style={{ color: data.tallied ? '#34d399' : '#f87171', fontSize: 16, fontWeight: 700 }}>
                {data.tallied ? '✓ Tallied' : '✗ Difference: ' + fmt(Math.abs(data.difference))}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Section title="Liabilities & Equity" data={data.liabilities || {}} color="#C9A84C" />
            <Section title="Assets" data={data.assets || {}} color="#60a5fa" />
          </div>
          {/* ── DIFFERENCE DIAGNOSIS ── */}
          {data.diagnosis && (
            <div style={{ marginBottom: 12 }}>
              {/* Header */}
              <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '12px 12px 0 0', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <div>
                  <div style={{ color: '#f87171', fontSize: 13, fontWeight: 700 }}>Balance Sheet Difference — {fmt(data.diagnosis.difference)}</div>
                  <div style={{ color: '#4A6A8A', fontSize: 11, marginTop: 2 }}>AI has diagnosed the reason and Tally fix steps below</div>
                </div>
              </div>

              {/* AI Diagnosis */}
              <div style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderLeft: 'none', borderRight: 'none', padding: '14px 16px' }}>
                <div style={{ color: '#a78bfa', fontSize: 10, fontWeight: 700, marginBottom: 6, letterSpacing: '0.08em' }}>CA AI DIAGNOSIS</div>
                <div style={{ color: '#e2e8f0', fontSize: 12, lineHeight: 1.8 }}>{data.diagnosis.ai_diagnosis}</div>
              </div>

              {/* Law */}
              <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', borderLeft: 'none', borderRight: 'none', padding: '10px 16px', display: 'flex', gap: 8 }}>
                <span style={{ color: '#fbbf24', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>LAW</span>
                <span style={{ color: '#8AA8C0', fontSize: 11, lineHeight: 1.6 }}>{data.diagnosis.law}</span>
              </div>

              {/* Tally Fix */}
              <div style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)', borderLeft: 'none', borderRight: 'none', padding: '10px 16px', display: 'flex', gap: 8 }}>
                <span style={{ color: '#34d399', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>TALLY FIX</span>
                <span style={{ color: '#8AA8C0', fontSize: 11, lineHeight: 1.6 }}>{data.diagnosis.tally_fix}</span>
              </div>

              {/* Wrong expense ledgers */}
              {data.diagnosis.wrong_expenses?.length > 0 && (
                <div style={{ background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderLeft: 'none', borderRight: 'none', padding: '10px 16px' }}>
                  <div style={{ color: '#f87171', fontSize: 10, fontWeight: 700, marginBottom: 8, letterSpacing: '0.08em' }}>GUILTY LEDGERS — MOVE TO "INDIRECT EXPENSES" IN TALLY</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
                    {data.diagnosis.wrong_expenses.map((e: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 8, padding: '6px 10px' }}>
                        <span style={{ color: '#e2e8f0', fontSize: 11 }}>{e.name}</span>
                        <span style={{ color: '#f87171', fontSize: 11, fontWeight: 600 }}>{fmt(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Critic Stamp */}
              {data.critic_verdict && (
                <div style={{ background: data.critic_verdict.confirmed ? 'rgba(248,113,113,0.08)' : 'rgba(52,211,153,0.08)', border: `1px solid ${data.critic_verdict.confirmed ? 'rgba(248,113,113,0.25)' : 'rgba(52,211,153,0.25)'}`, borderRadius: '0 0 12px 12px', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{data.critic_verdict.confirmed ? '⚠' : '✓'}</span>
                    <div>
                      <div style={{ color: data.critic_verdict.confirmed ? '#f87171' : '#34d399', fontSize: 11, fontWeight: 700 }}>
                        {data.critic_verdict.confirmed ? 'CONFIRMED RISK' : 'LOW RISK'} — Critic AI Verified · {data.critic_verdict.confidence} confidence
                      </div>
                      <div style={{ color: '#4A6A8A', fontSize: 10, marginTop: 2 }}>{data.critic_verdict.reason}</div>
                    </div>
                  </div>
                  {data.critic_verdict.penalty && (
                    <div style={{ color: '#fbbf24', fontSize: 10, fontWeight: 600, textAlign: 'right', maxWidth: 200 }}>PENALTY: {data.critic_verdict.penalty}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {data.unclassified?.length > 0 && (
            <div style={{ ...card, borderLeft: '3px solid #fbbf24', borderRadius: '0 12px 12px 0' }}>
              <div style={{ color: '#fbbf24', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>⚠️ {data.unclassified.length} ledgers not classified — unknown group</div>
              {data.unclassified.map((u: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--navy-600)' }}>
                  <span style={{ color: '#8AA8C0', fontSize: 11 }}>{u.ledger} ({u.group || 'No group'})</span>
                  <span style={{ color: '#4A6A8A', fontSize: 11 }}>{fmt(u.balance)}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={() => window.print()} style={{ fontSize: 12, padding: '7px 14px', background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, cursor: 'pointer' }}>Download PDF</button>
            <button onClick={() => setData(null)} style={{ fontSize: 12, padding: '7px 14px', background: 'var(--navy-700)', color: '#8AA8C0', border: '1px solid var(--navy-600)', borderRadius: 8, cursor: 'pointer' }}>Regenerate</button>
          </div>
        </>
      )}
    </div>
  )
}
