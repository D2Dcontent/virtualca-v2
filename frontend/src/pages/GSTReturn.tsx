import { useState, useEffect } from 'react'
import API from '../api'

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const card = { background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 12, padding: 16, marginBottom: 10 }

export default function GSTReturn() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [tab, setTab] = useState('gstr1')
  const [error, setError] = useState('')

  useEffect(() => { API.get('/api/gst-return').then(r => { if (r.data && Object.keys(r.data).length > 0) setData(r.data) }).catch(() => {}) }, [])

  const run = async () => {
    setLoading(true); setError('')
    try { const r = await API.post('/api/gst-return'); setData(r.data) }
    catch (e: any) { setError(e.response?.data?.error || e.message) }
    setLoading(false)
  }

  const TabBtn = ({ id, label }: { id: string; label: string }) => (
    <button onClick={() => setTab(id)} style={{ fontSize: 12, padding: '6px 14px', background: tab === id ? 'rgba(201,168,76,0.15)' : 'transparent', color: tab === id ? '#C9A84C' : '#4A6A8A', border: `1px solid ${tab === id ? 'rgba(201,168,76,0.3)' : 'var(--navy-600)'}`, borderRadius: 8, cursor: 'pointer' }}>
      {label}
    </button>
  )

  return (
    <div style={{ padding: 20 }}>
      {!data && !loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
          <div style={{ color: '#F5F0E6', fontWeight: 600, marginBottom: 6 }}>GST Return Generator</div>
          <div style={{ color: '#4A6A8A', fontSize: 13, marginBottom: 20 }}>Tally data → GSTR-1 / GSTR-3B ready file</div>
          <button onClick={run} style={{ background: 'var(--gold-500)', color: 'var(--navy-900)', border: 'none', borderRadius: 10, padding: '12px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Generate GST Returns
          </button>
          {error && <div style={{ color: '#f87171', marginTop: 12, fontSize: 12 }}>{error}</div>}
        </div>
      )}
      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#C9A84C' }}>Processing GST data...</div>}
      {data && data.total_sales_entries === 0 && (data.purchase_entries?.length || 0) === 0 && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚫</div>
          <div style={{ color: '#F5F0E6', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>No GST Ledgers Found</div>
          <div style={{ color: '#4A6A8A', fontSize: 13, maxWidth: 360, margin: '0 auto 20px', lineHeight: 1.7 }}>
            Your Trial Balance has no Sales, Purchase, or GST ledgers.<br/>
            This could mean the company is <strong style={{ color: '#C9A84C' }}>not registered under GST</strong> or ledger names don't match standard Tally names.
          </div>
          <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 12, padding: 16, maxWidth: 380, margin: '0 auto', textAlign: 'left' }}>
            <div style={{ color: '#C9A84C', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>GST REGISTRATION THRESHOLDS</div>
            {[
              ['Goods supply', 'Turnover > ₹40 lakh'],
              ['Service supply', 'Turnover > ₹20 lakh'],
              ['Special category states', 'Turnover > ₹10 lakh'],
            ].map(([type, rule]) => (
              <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12 }}>
                <span style={{ color: '#8AA8C0' }}>{type}</span>
                <span style={{ color: '#F5F0E6' }}>{rule}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setData(null)} style={{ marginTop: 20, fontSize: 12, padding: '8px 18px', background: 'var(--navy-700)', color: '#8AA8C0', border: '1px solid var(--navy-600)', borderRadius: 8, cursor: 'pointer' }}>Try Again</button>
        </div>
      )}
      {data && (data.total_sales_entries > 0 || (data.purchase_entries?.length || 0) > 0) && (
        <>
          {data.ai_insight && (
            <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12, padding: '14px 16px', marginBottom: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <div><div style={{ color: '#a78bfa', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>CA AI INSIGHT</div><div style={{ color: '#e2e8f0', fontSize: 12, lineHeight: 1.6 }}>{data.ai_insight}</div></div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
            <div style={{ ...card, margin: 0 }}><div style={{ color: '#4A6A8A', fontSize: 11 }}>Total Sales Entries</div><div style={{ color: '#F5F0E6', fontSize: 22, fontWeight: 700 }}>{data.total_sales_entries}</div></div>
            <div style={{ ...card, margin: 0 }}><div style={{ color: '#4A6A8A', fontSize: 11 }}>Net GST Payable</div><div style={{ color: '#C9A84C', fontSize: 22, fontWeight: 700 }}>{fmt(data.net_gst_payable)}</div></div>
            <div style={{ ...card, margin: 0 }}><div style={{ color: '#4A6A8A', fontSize: 11 }}>Missing GSTIN</div><div style={{ color: data.missing_gstin?.length ? '#f87171' : '#34d399', fontSize: 22, fontWeight: 700 }}>{data.missing_gstin?.length || 0}</div></div>
          </div>

          {data.missing_gstin?.length > 0 && (
            <div style={{ ...card, borderLeft: '3px solid #fbbf24', borderRadius: '0 12px 12px 0', marginBottom: 12 }}>
              <div style={{ color: '#fbbf24', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>⚠️ GSTIN missing for {data.missing_gstin.length} entries — fix before filing</div>
              {data.missing_gstin.slice(0, 5).map((n: string, i: number) => <div key={i} style={{ color: '#8AA8C0', fontSize: 11, padding: '2px 0' }}>{n}</div>)}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <TabBtn id="gstr1" label="GSTR-1 (Sales)" />
            <TabBtn id="gstr3b" label="GSTR-3B (Summary)" />
            <TabBtn id="purchases" label="Purchase ITC" />
          </div>

          {tab === 'gstr1' && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ color: '#F5F0E6', fontWeight: 600, fontSize: 13 }}>GSTR-1 — Outward Supplies</span>
                <span style={{ color: '#4A6A8A', fontSize: 11 }}>Table 4 (B2B) + Table 5 (B2C)</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead><tr style={{ borderBottom: '1px solid var(--navy-600)' }}>
                    {['Ledger', 'Taxable Value', 'Rate', 'CGST', 'SGST', 'IGST', 'Type'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#4A6A8A', fontSize: 10, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {(data.sales_entries || []).slice(0, 20).map((e: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '8px 10px', color: '#e2e8f0' }}>{e.ledger}</td>
                        <td style={{ padding: '8px 10px', color: '#F5F0E6', fontWeight: 600 }}>{fmt(e.taxable_value)}</td>
                        <td style={{ padding: '8px 10px', color: '#C9A84C' }}>{e.rate}%</td>
                        <td style={{ padding: '8px 10px', color: '#8AA8C0' }}>{e.cgst ? fmt(e.cgst) : '—'}</td>
                        <td style={{ padding: '8px 10px', color: '#8AA8C0' }}>{e.sgst ? fmt(e.sgst) : '—'}</td>
                        <td style={{ padding: '8px 10px', color: '#8AA8C0' }}>{e.igst ? fmt(e.igst) : '—'}</td>
                        <td style={{ padding: '8px 10px' }}><span style={{ background: e.has_gstin ? 'rgba(52,211,153,0.1)' : 'rgba(245,158,11,0.1)', color: e.has_gstin ? '#34d399' : '#fbbf24', fontSize: 10, padding: '2px 6px', borderRadius: 99 }}>{e.has_gstin ? 'B2B' : 'B2C'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'gstr3b' && (
            <div style={card}>
              <div style={{ color: '#F5F0E6', fontWeight: 600, fontSize: 13, marginBottom: 12 }}>GSTR-3B — Monthly Summary</div>
              {[
                ['Outward Taxable Supplies', fmt(data.gstr3b?.outward_taxable), '#F5F0E6'],
                ['Total Tax Collected', fmt(data.gstr3b?.outward_tax), '#f87171'],
                ['ITC Available', fmt(data.gstr3b?.itc_available), '#34d399'],
                ['CGST Payable', fmt(data.gstr3b?.cgst_payable), '#fbbf24'],
                ['SGST Payable', fmt(data.gstr3b?.sgst_payable), '#fbbf24'],
                ['IGST Payable', fmt(data.gstr3b?.igst_payable), '#fbbf24'],
                ['Net GST Payable', fmt(data.gstr3b?.net_payable), '#C9A84C'],
              ].map(([label, val, color]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--navy-600)' }}>
                  <span style={{ color: '#8AA8C0', fontSize: 12 }}>{label}</span>
                  <span style={{ color, fontSize: 12, fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'purchases' && (
            <div style={card}>
              <div style={{ color: '#F5F0E6', fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Purchase Entries — ITC Eligible</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead><tr style={{ borderBottom: '1px solid var(--navy-600)' }}>
                  {['Ledger', 'Taxable Value', 'GST Rate', 'ITC'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#4A6A8A', fontSize: 10 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {(data.purchase_entries || []).slice(0, 20).map((e: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '8px 10px', color: '#e2e8f0' }}>{e.ledger}</td>
                      <td style={{ padding: '8px 10px', color: '#F5F0E6', fontWeight: 600 }}>{fmt(e.taxable_value)}</td>
                      <td style={{ padding: '8px 10px', color: '#C9A84C' }}>{e.rate}%</td>
                      <td style={{ padding: '8px 10px' }}><span style={{ color: '#34d399', fontSize: 10 }}>✓ Eligible</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button style={{ fontSize: 12, padding: '7px 14px', background: 'rgba(201,168,76,0.15)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 8, cursor: 'pointer' }}>Download GSTR-1 JSON</button>
            <button style={{ fontSize: 12, padding: '7px 14px', background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, cursor: 'pointer' }}>GSTR-3B Excel</button>
            <button onClick={() => setData(null)} style={{ fontSize: 12, padding: '7px 14px', background: 'var(--navy-700)', color: '#8AA8C0', border: '1px solid var(--navy-600)', borderRadius: 8, cursor: 'pointer' }}>Regenerate</button>
          </div>
        </>
      )}
    </div>
  )
}
