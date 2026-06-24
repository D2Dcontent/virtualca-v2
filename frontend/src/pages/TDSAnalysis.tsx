import { useState } from 'react'
import API from '../api'

export default function TDSAnalysis() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setLoading(true); setError(null)
    try { const r = await API.post('/api/tds-detect'); setData(r.data) }
    catch (e: any) { setError(e.response?.data?.error || 'Upload Trial Balance first, then run TDS Analysis.') }
    setLoading(false)
  }

  const items = data?.items || []
  const missed = items.filter((i: any) => !i.tds_already_deducted)
  const covered = items.filter((i: any) => i.tds_already_deducted)

  return (
    <div style={{ padding: '24px 28px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 20 }}>TDS Analysis</div>
          <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>Scans all ledgers for missed TDS — Sec 194C, 194J, 194I, 194H, 194A</div>
        </div>
        <button onClick={run} disabled={loading} style={{ background: 'var(--gold-500)', color: 'var(--navy-900)', border: 'none', borderRadius: 10, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Analysing…' : data ? 'Re-run' : 'Run TDS Analysis'}
        </button>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', color: '#f87171', fontSize: 13, marginBottom: 20 }}>{error}</div>}

      {!data && !loading && !error && (
        <div style={{ background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 16, padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, color: '#334155', marginBottom: 16 }}>%</div>
          <div style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: 6 }}>No TDS data yet</div>
          <div style={{ color: '#64748b', fontSize: 12, marginBottom: 20 }}>Upload your Trial Balance and run TDS Analysis to detect all missed deductions</div>
          <button onClick={run} style={{ background: 'var(--gold-500)', color: 'var(--navy-900)', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Run TDS Analysis</button>
        </div>
      )}

      {loading && (
        <div style={{ background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 16, padding: '40px 24px', textAlign: 'center' }}>
          <i className="fas fa-cog spin" style={{ fontSize: 28, color: 'var(--gold-400)', display: 'block', marginBottom: 12 }}></i>
          <div style={{ color: '#f1f5f9' }}>Scanning all ledgers for TDS thresholds…</div>
        </div>
      )}

      {data && (
        <>
          {data.ai_insight && (
            <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12, padding: '14px 16px', marginBottom: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <div><div style={{ color: '#a78bfa', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>CA AI INSIGHT</div><div style={{ color: '#e2e8f0', fontSize: 12, lineHeight: 1.6 }}>{data.ai_insight}</div></div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
            <SummaryCard label="Missed TDS" value={missed.length} sub={`₹${Number(data.total_exposure || 0).toLocaleString('en-IN')} total exposure`} color="#ef4444" />
            <SummaryCard label="Est. Interest Penalty" value={`₹${Number(data.total_interest || 0).toLocaleString('en-IN')}`} sub="@1.5%/month · avg 3 months delay" color="#f97316" />
            <SummaryCard label="TDS Already Covered" value={covered.length} sub="TDS deducted correctly" color="#34d399" />
          </div>

          {missed.length > 0 && (
            <div style={{ background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 14, marginBottom: 20, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--navy-600)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 13 }}>Missed TDS Deductions ({missed.length})</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--navy-900)' }}>
                      {['Ledger / Party', 'Section', 'Description', 'Amount Paid', 'Rate', 'TDS Due', 'Interest Est.', 'What to do'].map(h => (
                        <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, borderBottom: '1px solid var(--navy-600)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {missed.map((item: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--navy-700)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ padding: '10px 14px', color: '#e2e8f0', fontWeight: 600 }}>{item.ledger}</td>
                        <td style={{ padding: '10px 14px' }}><span style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{item.section}</span></td>
                        <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{item.description}</td>
                        <td style={{ padding: '10px 14px', color: '#e2e8f0', fontWeight: 600 }}>₹{Number(item.total_paid).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{item.rate}%</td>
                        <td style={{ padding: '10px 14px', color: '#ef4444', fontWeight: 700 }}>₹{Number(item.tds_due).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '10px 14px', color: '#f97316', fontWeight: 600 }}>₹{Number(item.interest_est).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 11, maxWidth: 240, lineHeight: 1.5 }}>{item.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {covered.length > 0 && (
            <div style={{ background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--navy-600)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 13 }}>TDS Already Deducted ({covered.length})</span>
              </div>
              {covered.map((item: any, i: number) => (
                <div key={i} style={{ padding: '10px 18px', borderBottom: '1px solid var(--navy-700)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#34d399', fontSize: 11 }}>✓</span>
                  <span style={{ color: '#e2e8f0', fontSize: 12, flex: 1 }}>{item.ledger}</span>
                  <span style={{ color: '#64748b', fontSize: 11 }}>{item.section}</span>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>₹{Number(item.total_paid).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value, sub, color }: { label: string; value: any; sub: string; color: string }) {
  return (
    <div style={{ background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 12, padding: '16px 18px', borderTop: `2px solid ${color}` }}>
      <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>{label}</div>
      <div style={{ color: '#f1f5f9', fontSize: 26, fontWeight: 800 }}>{value}</div>
      <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>{sub}</div>
    </div>
  )
}
