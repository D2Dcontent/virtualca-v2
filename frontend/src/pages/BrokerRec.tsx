import { useState, useRef } from 'react'
import API from '../api'

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const card = { background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 12, padding: 16, marginBottom: 10 }

const BROKER_TIPS: Record<string, string> = {
  zerodha: 'Console → Reports → P&L → Download as Excel (FY-wise)',
  groww: 'Groww App → Portfolio → Profit & Loss → Export',
  angel: 'Angel One → Reports → Trade Book → Download Excel',
  upstox: 'Upstox → P&L Report → Export CSV',
}

export default function BrokerRec() {
  const [tallyFile, setTallyFile] = useState<File | null>(null)
  const [brokerFile, setBrokerFile] = useState<File | null>(null)
  const [broker, setBroker] = useState('zerodha')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const tallyRef = useRef<HTMLInputElement>(null)
  const brokerRef = useRef<HTMLInputElement>(null)

  const run = async () => {
    if (!tallyFile || !brokerFile) { setError('Please upload both files'); return }
    setLoading(true); setError('')
    const fd = new FormData()
    fd.append('tally_file', tallyFile)
    fd.append('broker_file', brokerFile)
    fd.append('broker', broker)
    try { const r = await API.post('/api/broker-rec', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setData(r.data) }
    catch (e: any) { setError(e.response?.data?.error || e.message) }
    setLoading(false)
  }

  return (
    <div style={{ padding: 20 }}>
      {!data && (
        <>
          <div style={{ color: '#F5F0E6', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Broker Reconciliation</div>
          <div style={{ color: '#4A6A8A', fontSize: 12, marginBottom: 16 }}>Match Tally entries with broker contract notes (Zerodha / Groww / Angel / Upstox)</div>

          <div style={card}>
            <div style={{ color: '#8AA8C0', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Broker</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['zerodha', 'groww', 'angel', 'upstox'].map(b => (
                <button key={b} onClick={() => setBroker(b)} style={{ padding: '7px 14px', background: broker === b ? 'rgba(201,168,76,0.15)' : 'var(--navy-700)', color: broker === b ? '#C9A84C' : '#8AA8C0', border: `1px solid ${broker === b ? 'rgba(201,168,76,0.3)' : 'var(--navy-600)'}`, borderRadius: 8, fontSize: 12, cursor: 'pointer', textTransform: 'capitalize' }}>
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ ...card, cursor: 'pointer' }} onClick={() => tallyRef.current?.click()}>
              <input ref={tallyRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => setTallyFile(e.target.files?.[0] || null)} />
              <div style={{ textAlign: 'center', padding: 16 }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📋</div>
                <div style={{ color: '#F5F0E6', fontWeight: 600, fontSize: 12, marginBottom: 4 }}>Tally Ledger</div>
                <div style={{ color: tallyFile ? '#34d399' : '#4A6A8A', fontSize: 11 }}>{tallyFile ? tallyFile.name : 'Upload shares/trading ledger'}</div>
              </div>
            </div>
            <div style={{ ...card, cursor: 'pointer' }} onClick={() => brokerRef.current?.click()}>
              <input ref={brokerRef} type="file" accept=".xlsx,.xls,.csv,.pdf" style={{ display: 'none' }} onChange={e => setBrokerFile(e.target.files?.[0] || null)} />
              <div style={{ textAlign: 'center', padding: 16 }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>🏢</div>
                <div style={{ color: '#F5F0E6', fontWeight: 600, fontSize: 12, marginBottom: 4 }}>Broker Statement</div>
                <div style={{ color: brokerFile ? '#34d399' : '#4A6A8A', fontSize: 11 }}>{brokerFile ? brokerFile.name : `Upload ${broker} P&L / contract note`}</div>
              </div>
            </div>
          </div>

          <div style={{ ...card, borderLeft: '3px solid rgba(201,168,76,0.4)', borderRadius: '0 12px 12px 0', marginBottom: 12 }}>
            <div style={{ color: '#C9A84C', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>How to export from {broker}?</div>
            <div style={{ color: '#8AA8C0', fontSize: 11 }}>{BROKER_TIPS[broker]}</div>
          </div>

          {error && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 10 }}>{error}</div>}
          {loading
            ? <div style={{ textAlign: 'center', color: '#C9A84C', padding: 20 }}>Reconciling...</div>
            : <button onClick={run} style={{ width: '100%', background: 'var(--gold-500)', color: 'var(--navy-900)', border: 'none', borderRadius: 10, padding: '12px 0', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Reconcile with {broker.charAt(0).toUpperCase() + broker.slice(1)}
              </button>
          }
        </>
      )}

      {data && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
            <div>
              <div style={{ color: '#F5F0E6', fontWeight: 600, fontSize: 14 }}>{broker.charAt(0).toUpperCase() + broker.slice(1)} Reconciliation</div>
              <div style={{ color: data.is_reconciled ? '#34d399' : '#f87171', fontSize: 12 }}>{data.is_reconciled ? '✓ Matches' : '✗ Differences Found'}</div>
            </div>
            <button onClick={() => setData(null)} style={{ fontSize: 11, padding: '6px 12px', background: 'var(--navy-700)', color: '#8AA8C0', border: '1px solid var(--navy-600)', borderRadius: 8, cursor: 'pointer' }}>New Rec</button>
          </div>

          {data.ai_insight && (
            <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12, padding: '14px 16px', marginBottom: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <div><div style={{ color: '#a78bfa', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>CA AI INSIGHT</div><div style={{ color: '#e2e8f0', fontSize: 12, lineHeight: 1.6 }}>{data.ai_insight}</div></div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
            <div style={{ ...card, margin: 0 }}><div style={{ color: '#4A6A8A', fontSize: 10 }}>Matched Trades</div><div style={{ color: '#34d399', fontSize: 18, fontWeight: 700 }}>{data.matched_count || 0}</div></div>
            <div style={{ ...card, margin: 0 }}><div style={{ color: '#4A6A8A', fontSize: 10 }}>Unmatched</div><div style={{ color: '#f87171', fontSize: 18, fontWeight: 700 }}>{data.unmatched_count || 0}</div></div>
            <div style={{ ...card, margin: 0 }}><div style={{ color: '#4A6A8A', fontSize: 10 }}>Value Diff</div><div style={{ color: !data.value_diff || data.value_diff === 0 ? '#34d399' : '#f87171', fontSize: 18, fontWeight: 700 }}>{fmt(Math.abs(data.value_diff || 0))}</div></div>
          </div>

          {data.unmatched?.length > 0 && (
            <div style={card}>
              <div style={{ color: '#f87171', fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Unmatched Entries</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead><tr style={{ borderBottom: '1px solid var(--navy-600)' }}>
                  {['Date', 'Scrip', 'Qty', 'Value', 'Source'].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#4A6A8A', fontSize: 10 }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {data.unmatched.map((u: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '8px 10px', color: '#8AA8C0' }}>{u.date}</td>
                      <td style={{ padding: '8px 10px', color: '#e2e8f0', fontWeight: 500 }}>{u.scrip}</td>
                      <td style={{ padding: '8px 10px', color: '#8AA8C0' }}>{u.qty}</td>
                      <td style={{ padding: '8px 10px', color: '#F5F0E6', fontWeight: 600 }}>{fmt(u.value)}</td>
                      <td style={{ padding: '8px 10px' }}><span style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', fontSize: 10, padding: '2px 6px', borderRadius: 99 }}>{u.source}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.is_reconciled && (
            <div style={{ ...card, borderLeft: '3px solid #34d399', borderRadius: '0 12px 12px 0' }}>
              <div style={{ color: '#34d399', fontSize: 12 }}>✓ All trades match. Tally books agree with broker statement.</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
