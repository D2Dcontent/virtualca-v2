import { useState } from 'react'
import API from '../api'

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const card = { background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 12, padding: 16, marginBottom: 10 }

export default function TDSDetect() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')

  const run = async () => {
    setLoading(true); setError('')
    try { const r = await API.post('/api/tds-detect'); setData(r.data) }
    catch (e: any) { setError(e.response?.data?.error || e.message) }
    setLoading(false)
  }

  return (
    <div style={{ padding: 20 }}>
      {!data && !loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🧾</div>
          <div style={{ color: '#F5F0E6', fontWeight: 600, marginBottom: 6 }}>TDS Detection</div>
          <div style={{ color: '#4A6A8A', fontSize: 13, marginBottom: 20 }}>Scans every ledger · flags missed TDS with section + AI action</div>
          <button onClick={run} style={{ background: 'var(--gold-500)', color: 'var(--navy-900)', border: 'none', borderRadius: 10, padding: '12px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Scan for Missed TDS
          </button>
          {error && <div style={{ color: '#f87171', marginTop: 12, fontSize: 12 }}>{error}</div>}
        </div>
      )}
      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#C9A84C' }}>Scanning ledgers...</div>}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
            <div style={{ ...card, margin: 0 }}><div style={{ color: '#4A6A8A', fontSize: 11 }}>Missed TDS</div><div style={{ color: '#f87171', fontSize: 22, fontWeight: 700 }}>{data.missed_count}</div><div style={{ color: '#4A6A8A', fontSize: 10 }}>parties</div></div>
            <div style={{ ...card, margin: 0 }}><div style={{ color: '#4A6A8A', fontSize: 11 }}>Total Exposure</div><div style={{ color: '#fbbf24', fontSize: 22, fontWeight: 700 }}>{fmt(data.total_exposure)}</div><div style={{ color: '#4A6A8A', fontSize: 10 }}>TDS due</div></div>
            <div style={{ ...card, margin: 0 }}><div style={{ color: '#4A6A8A', fontSize: 11 }}>Interest Est.</div><div style={{ color: '#f87171', fontSize: 22, fontWeight: 700 }}>{fmt(data.total_interest)}</div><div style={{ color: '#4A6A8A', fontSize: 10 }}>@ 1.5%/month</div></div>
          </div>
          {(data.items || []).map((item: any, i: number) => (
            <div key={i} style={{ ...card, borderLeft: `3px solid ${item.tds_already_deducted ? '#34d399' : '#f87171'}`, borderRadius: '0 12px 12px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ color: '#F5F0E6', fontWeight: 600, fontSize: 13 }}>{item.ledger}</div>
                  <div style={{ color: '#4A6A8A', fontSize: 11 }}>{item.description}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ background: 'rgba(96,165,250,0.15)', color: '#93c5fd', fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>Sec {item.section}</span>
                  {item.tds_already_deducted
                    ? <span style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', fontSize: 11, padding: '2px 8px', borderRadius: 99 }}>✓ TDS Deducted</span>
                    : <span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', fontSize: 11, padding: '2px 8px', borderRadius: 99 }}>TDS Missed</span>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: item.tds_already_deducted ? 0 : 10 }}>
                <div style={{ background: '#091526', borderRadius: 8, padding: 8 }}><div style={{ color: '#4A6A8A', fontSize: 10 }}>Total Paid</div><div style={{ color: '#F5F0E6', fontSize: 12, fontWeight: 600 }}>{fmt(item.total_paid)}</div></div>
                <div style={{ background: '#091526', borderRadius: 8, padding: 8 }}><div style={{ color: '#4A6A8A', fontSize: 10 }}>Rate</div><div style={{ color: '#C9A84C', fontSize: 12, fontWeight: 600 }}>{item.rate}%</div></div>
                <div style={{ background: '#091526', borderRadius: 8, padding: 8 }}><div style={{ color: '#4A6A8A', fontSize: 10 }}>TDS Due</div><div style={{ color: item.tds_already_deducted ? '#34d399' : '#f87171', fontSize: 12, fontWeight: 600 }}>{fmt(item.tds_due)}</div></div>
              </div>
              {!item.tds_already_deducted && (
                <div style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, padding: 10 }}>
                  <div style={{ color: '#C9A84C', fontSize: 10, fontWeight: 600, marginBottom: 4 }}>AI Recommendation</div>
                  <div style={{ color: '#8AA8C0', fontSize: 11 }}>{item.action}</div>
                </div>
              )}
            </div>
          ))}
          <button onClick={() => setData(null)} style={{ fontSize: 12, padding: '7px 14px', background: 'var(--navy-700)', color: '#8AA8C0', border: '1px solid var(--navy-600)', borderRadius: 8, cursor: 'pointer', marginTop: 4 }}>Re-scan</button>
        </>
      )}
    </div>
  )
}
