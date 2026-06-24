import { useState, useEffect } from 'react'
import API from '../api'

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const card = { background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 12, padding: 16, marginBottom: 10 }

const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  LTCG: { bg: 'rgba(52,211,153,0.1)', color: '#34d399' },
  STCG: { bg: 'rgba(245,158,11,0.1)', color: '#fbbf24' },
  LOSS: { bg: 'rgba(96,165,250,0.1)', color: '#93c5fd' },
}

export default function SharesPnL() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    API.get('/api/shares-pnl').then(r => { if (r.data && Object.keys(r.data).length > 0) setData(r.data) }).catch(() => {})
  }, [])

  const run = async () => {
    setLoading(true); setError('')
    try { const r = await API.post('/api/shares-pnl'); setData(r.data) }
    catch (e: any) { setError(e.response?.data?.error || e.message) }
    setLoading(false)
  }

  return (
    <div style={{ padding: 20 }}>
      {!data && !loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📈</div>
          <div style={{ color: '#F5F0E6', fontWeight: 600, marginBottom: 6 }}>Shares & Mutual Funds P&L</div>
          <div style={{ color: '#4A6A8A', fontSize: 13, marginBottom: 20 }}>FIFO method · STCG/LTCG auto-classified · tax impact</div>
          <button onClick={run} style={{ background: 'var(--gold-500)', color: 'var(--navy-900)', border: 'none', borderRadius: 10, padding: '12px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Calculate P&L
          </button>
          {error && <div style={{ color: '#f87171', marginTop: 12, fontSize: 12 }}>{error}</div>}
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#C9A84C' }}>Calculating...</div>}

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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
            <div style={{ ...card, margin: 0 }}>
              <div style={{ color: '#4A6A8A', fontSize: 11 }}>STCG</div>
              <div style={{ color: '#fbbf24', fontSize: 18, fontWeight: 700 }}>{fmt(data.stcg_total)}</div>
              <div style={{ color: '#4A6A8A', fontSize: 10 }}>Tax: {fmt(data.stcg_tax)} @ 15%</div>
            </div>
            <div style={{ ...card, margin: 0 }}>
              <div style={{ color: '#4A6A8A', fontSize: 11 }}>LTCG</div>
              <div style={{ color: '#34d399', fontSize: 18, fontWeight: 700 }}>{fmt(data.ltcg_total)}</div>
              <div style={{ color: '#4A6A8A', fontSize: 10 }}>Tax: {fmt(data.ltcg_tax)} @ 10%</div>
            </div>
            <div style={{ ...card, margin: 0 }}>
              <div style={{ color: '#4A6A8A', fontSize: 11 }}>Net Gain</div>
              <div style={{ color: data.total_gain >= 0 ? '#C9A84C' : '#f87171', fontSize: 18, fontWeight: 700 }}>{fmt(data.total_gain)}</div>
              <div style={{ color: '#4A6A8A', fontSize: 10 }}>Total P&L</div>
            </div>
            <div style={{ ...card, margin: 0 }}>
              <div style={{ color: '#4A6A8A', fontSize: 11 }}>Total Tax</div>
              <div style={{ color: '#f87171', fontSize: 18, fontWeight: 700 }}>{fmt(data.total_tax)}</div>
              <div style={{ color: '#4A6A8A', fontSize: 10 }}>Add to ITR Sch. CG</div>
            </div>
          </div>

          {/* Tax summary */}
          <div style={{ ...card, borderLeft: '3px solid #3b82f6', borderRadius: '0 12px 12px 0', marginBottom: 14 }}>
            <div style={{ color: '#93c5fd', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>📋 ITR Filing Summary — Schedule CG</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                ['STCG u/s 111A (Listed equity < 12m)', fmt(data.stcg_total), '#fbbf24'],
                ['Tax on STCG @ 15%', fmt(data.stcg_tax), '#f87171'],
                ['LTCG u/s 112A (Listed equity > 12m)', fmt(data.ltcg_total), '#34d399'],
                ['Tax on LTCG @ 10% (after ₹1L exempt)', fmt(data.ltcg_tax), '#f87171'],
              ].map(([label, val, color]) => (
                <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ color: '#8AA8C0', fontSize: 11 }}>{label}</span>
                  <span style={{ color: color as string, fontSize: 12, fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={card}>
            <div style={{ color: '#F5F0E6', fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Transaction Breakdown (FIFO)</div>
            {data.trades?.length === 0
              ? <div style={{ color: '#4A6A8A', fontSize: 12 }}>No closed trades found. Upload daybook with buy/sell entries for detailed P&L.</div>
              : <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--navy-600)' }}>
                        {['Scrip', 'Buy Date', 'Sell Date', 'Cost', 'Sale Value', 'Gain/Loss', 'Holding', 'Type', 'Tax'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#4A6A8A', fontSize: 10, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.trades?.map((t: any, i: number) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '8px 10px', color: '#e2e8f0', fontWeight: 500 }}>{t.scrip}</td>
                          <td style={{ padding: '8px 10px', color: '#8AA8C0' }}>{t.buy_date}</td>
                          <td style={{ padding: '8px 10px', color: '#8AA8C0' }}>{t.sell_date}</td>
                          <td style={{ padding: '8px 10px', color: '#8AA8C0' }}>{fmt(t.buy_value)}</td>
                          <td style={{ padding: '8px 10px', color: '#F5F0E6' }}>{fmt(t.sell_value)}</td>
                          <td style={{ padding: '8px 10px', color: t.gain >= 0 ? '#34d399' : '#f87171', fontWeight: 600 }}>{t.gain >= 0 ? '+' : ''}{fmt(t.gain)}</td>
                          <td style={{ padding: '8px 10px', color: '#8AA8C0' }}>{t.holding_months ? t.holding_months + 'm' : '—'}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ background: (TYPE_STYLE[t.type] || TYPE_STYLE.LOSS).bg, color: (TYPE_STYLE[t.type] || TYPE_STYLE.LOSS).color, fontSize: 10, padding: '2px 6px', borderRadius: 99 }}>{t.type}</span>
                          </td>
                          <td style={{ padding: '8px 10px', color: '#f87171' }}>{t.tax ? fmt(t.tax) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>

          {data.note && (
            <div style={{ ...card, borderLeft: '3px solid #C9A84C', borderRadius: '0 12px 12px 0' }}>
              <div style={{ color: '#C9A84C', fontSize: 11 }}>💡 {data.note}</div>
            </div>
          )}

          <button onClick={() => setData(null)} style={{ fontSize: 12, padding: '7px 14px', background: 'var(--navy-700)', color: '#8AA8C0', border: '1px solid var(--navy-600)', borderRadius: 8, cursor: 'pointer' }}>Recalculate</button>
        </>
      )}
    </div>
  )
}
