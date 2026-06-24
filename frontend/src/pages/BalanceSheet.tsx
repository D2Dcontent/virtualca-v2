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
