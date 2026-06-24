import { useState, useEffect } from 'react'
import API from '../api'

const SEV_COLOR: Record<string, string> = { Critical: '#ef4444', Important: '#f97316', Info: '#34d399' }
const SEV_BG: Record<string, string> = { Critical: 'rgba(239,68,68,0.08)', Important: 'rgba(249,115,22,0.08)', Info: 'rgba(52,211,153,0.08)' }
const SEV_BORDER: Record<string, string> = { Critical: 'rgba(239,68,68,0.2)', Important: 'rgba(249,115,22,0.2)', Info: 'rgba(52,211,153,0.2)' }

export default function PTAnalysis() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { API.get('/api/pt-analysis').then(r => { if (r.data && Object.keys(r.data).length > 0) setData(r.data) }).catch(() => {}) }, [])

  const run = async () => {
    setLoading(true); setError(null)
    try { const r = await API.post('/api/pt-analysis'); setData(r.data) }
    catch (e: any) { setError(e.response?.data?.error || 'Upload Trial Balance first, then run PT Analysis.') }
    setLoading(false)
  }

  const findings = data?.findings || []
  const months = data?.months_missing || []

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 20 }}>Professional Tax (PT) Analysis</div>
          <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>West Bengal PT Act 1979 — checks deduction, deposit, and compliance per salary voucher</div>
        </div>
        <button onClick={run} disabled={loading} style={{ background: 'var(--gold-500)', color: 'var(--navy-900)', border: 'none', borderRadius: 10, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Analysing…' : data ? 'Re-run' : 'Run PT Analysis'}
        </button>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', color: '#f87171', fontSize: 13, marginBottom: 20 }}>{error}</div>}

      {!data && !loading && !error && (
        <div style={{ background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 16, padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🏛️</div>
          <div style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: 6 }}>No PT data yet</div>
          <div style={{ color: '#64748b', fontSize: 12, marginBottom: 20 }}>Upload Trial Balance (and Daybook for month-wise analysis) then run PT Analysis</div>
          <button onClick={run} style={{ background: 'var(--gold-500)', color: 'var(--navy-900)', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Run PT Analysis</button>
        </div>
      )}

      {loading && (
        <div style={{ background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 16, padding: '40px 24px', textAlign: 'center' }}>
          <i className="fas fa-cog spin" style={{ fontSize: 28, color: 'var(--gold-400)', display: 'block', marginBottom: 12 }}></i>
          <div style={{ color: '#f1f5f9' }}>Analysing salary vouchers for PT compliance…</div>
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
            <SummaryCard label="PT Shortfall" value={`₹${Number(data.pt_shortfall || 0).toLocaleString('en-IN')}`} sub="PT not deducted from employees" color="#ef4444" />
            <SummaryCard label="Not Paid to Govt" value={`₹${Number(data.pt_unpaid_govt || 0).toLocaleString('en-IN')}`} sub="PT deducted but not deposited" color="#f97316" />
            <SummaryCard label="PT Deducted OK" value={`₹${Number(data.pt_deducted || 0).toLocaleString('en-IN')}`} sub="Correctly deducted from salary" color="#34d399" />
          </div>

          {findings.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              {findings.map((f: any, i: number) => {
                const sev = f.severity || 'Info'
                return (
                  <div key={i} style={{ background: SEV_BG[sev] || 'var(--navy-800)', border: `1px solid ${SEV_BORDER[sev] || 'var(--navy-600)'}`, borderRadius: 12, padding: '16px 18px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: SEV_BG[sev], color: SEV_COLOR[sev] || '#60a5fa', border: `1px solid ${SEV_BORDER[sev]}`, textTransform: 'uppercase' }}>{sev}</span>
                    </div>
                    <div style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.6, marginBottom: f.impact ? 8 : 0 }}>{f.issue}</div>
                    {f.impact && <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6, marginBottom: f.law ? 6 : 0 }}>{f.impact}</div>}
                    {f.law && <div style={{ color: '#60a5fa', fontSize: 11, marginTop: 4 }}>⚖️ {f.law}</div>}
                  </div>
                )
              })}
            </div>
          )}

          {months.length > 0 && (
            <div style={{ background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 14, marginBottom: 20, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--navy-600)' }}>
                <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 13 }}>Month-wise PT Gap ({months.length} months)</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--navy-900)' }}>
                    {['Month', 'Salary Paid', 'PT Expected', 'PT Deducted', 'Shortfall'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, borderBottom: '1px solid var(--navy-600)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {months.map((m: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--navy-700)' }}>
                      <td style={{ padding: '10px 14px', color: '#e2e8f0', fontWeight: 600 }}>{m.month}</td>
                      <td style={{ padding: '10px 14px', color: '#94a3b8' }}>₹{Number(m.salary_paid).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '10px 14px', color: '#e2e8f0' }}>₹{Number(m.pt_expected).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '10px 14px', color: m.pt_deducted > 0 ? '#34d399' : '#ef4444' }}>₹{Number(m.pt_deducted).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '10px 14px', color: '#ef4444', fontWeight: 700 }}>₹{Number(m.shortfall).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--navy-600)' }}>
              <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 13 }}>West Bengal PT Slabs (FY 2024-25)</span>
            </div>
            {(data.wbslabs || []).map((s: any, i: number) => (
              <div key={i} style={{ padding: '10px 18px', borderBottom: '1px solid var(--navy-700)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>{s.range}</span>
                <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 13 }}>{s.pt}</span>
              </div>
            ))}
            <div style={{ padding: '10px 18px', color: '#64748b', fontSize: 11 }}>Deposit by 21st of every month · Portal: wbifms.gov.in (Grips) · Interest 2%/month on late deposit</div>
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value, sub, color }: { label: string; value: any; sub: string; color: string }) {
  return (
    <div style={{ background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 12, padding: '16px 18px', borderTop: `2px solid ${color}` }}>
      <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>{label}</div>
      <div style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 800 }}>{value}</div>
      <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>{sub}</div>
    </div>
  )
}
