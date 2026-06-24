import { useState, useRef } from 'react'
import API from '../api'

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const card = { background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 12, padding: 16, marginBottom: 10 }

export default function BankRec() {
  const [bankFile, setBankFile] = useState<File | null>(null)
  const [tallyFile, setTallyFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('wrongdate')
  const [error, setError] = useState('')
  const bankRef = useRef<HTMLInputElement>(null)
  const tallyRef = useRef<HTMLInputElement>(null)

  const run = async () => {
    if (!bankFile || !tallyFile) { setError('Upload both files first'); return }
    setLoading(true); setError('')
    const fd = new FormData()
    fd.append('bank_file', bankFile)
    fd.append('tally_file', tallyFile)
    try { const r = await API.post('/api/bankrec', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setResults(r.data); setActiveTab('wrongdate') }
    catch (e: any) { setError(e.response?.data?.error || e.message) }
    setLoading(false)
  }

  const tabs = [
    { id: 'wrongdate', label: '📅 Wrong Date', data: results?.wrong_date || [] },
    { id: 'unmatched', label: '🔴 Missing in Tally', data: results?.bank_only || [] },
    { id: 'tally', label: '🟡 Extra in Tally', data: results?.tally_only || [] },
    { id: 'duplicate', label: '🟠 Duplicates', data: results?.duplicates || [] },
    { id: 'matched', label: '✅ Matched', data: results?.matched || [] },
  ]

  const UploadBox = ({ label, sub, icon, color, file, inputRef, onChange }: any) => (
    <div style={{ ...card, cursor: 'pointer' }} onClick={() => inputRef.current?.click()}>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={onChange} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{icon}</div>
        <div><div style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 600 }}>{label}</div><div style={{ color: '#64748b', fontSize: 11 }}>{sub}</div></div>
      </div>
      <div style={{ border: `1px dashed ${file ? '#34d399' : 'var(--navy-500)'}`, borderRadius: 10, padding: '20px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 22, marginBottom: 6 }}>☁️</div>
        <div style={{ color: file ? '#34d399' : '#64748b', fontSize: 12 }}>{file ? file.name : 'Click to upload'}</div>
      </div>
    </div>
  )

  return (
    <div style={{ padding: 20 }}>
      {!results && (
        <>
          <div style={{ color: '#F5F0E6', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Bank Reconciliation</div>
          <div style={{ color: '#4A6A8A', fontSize: 12, marginBottom: 16 }}>Match bank statement vs Tally — find wrong dates, missing entries, duplicates</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <UploadBox label="Bank Statement" sub="HDFC, ICICI, SBI, Axis, Kotak" icon="🏦" color="#60a5fa" file={bankFile} inputRef={bankRef} onChange={(e: any) => setBankFile(e.target.files?.[0] || null)} />
            <UploadBox label="Tally Bank Ledger" sub="Tally → Account Books → Bank Ledger → Export" icon="📒" color="#a78bfa" file={tallyFile} inputRef={tallyRef} onChange={(e: any) => setTallyFile(e.target.files?.[0] || null)} />
          </div>

          {error && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 10 }}>{error}</div>}

          {loading
            ? <div style={{ ...card, textAlign: 'center', padding: 32 }}>
                <i className="fas fa-cog spin" style={{ fontSize: 28, color: '#60a5fa', display: 'block', marginBottom: 10 }}></i>
                <div style={{ color: '#f1f5f9' }}>Reconciling transactions...</div>
                <div style={{ color: '#64748b', fontSize: 12 }}>Matching bank statement vs Tally entries</div>
              </div>
            : <button onClick={run} style={{ width: '100%', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 10, padding: '14px 0', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                ⚖️ Run Reconciliation
              </button>
          }
        </>
      )}

      {results && (
        <>
          {results.ai_insight && (
            <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12, padding: '14px 16px', marginBottom: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <div><div style={{ color: '#a78bfa', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>CA AI INSIGHT</div><div style={{ color: '#e2e8f0', fontSize: 12, lineHeight: 1.6 }}>{results.ai_insight}</div></div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button onClick={() => { setResults(null); setBankFile(null); setTallyFile(null) }} style={{ fontSize: 12, padding: '7px 14px', background: 'var(--navy-700)', color: '#8AA8C0', border: '1px solid var(--navy-600)', borderRadius: 8, cursor: 'pointer' }}>← Change Files</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Matched', color: '#34d399', val: results.summary?.matched || 0 },
              { label: 'Wrong Date', color: '#a78bfa', val: results.summary?.wrong_date || 0 },
              { label: 'Missing in Tally', color: '#f87171', val: results.summary?.bank_only || 0 },
              { label: 'Extra in Tally', color: '#fbbf24', val: results.summary?.tally_only || 0 },
              { label: 'Duplicates', color: '#fb923c', val: results.summary?.duplicates || 0 },
            ].map((s, i) => (
              <div key={i} style={{ background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 12, padding: '14px 10px', textAlign: 'center', borderTop: `3px solid ${s.color}` }}>
                <div style={{ color: s.color, fontSize: 24, fontWeight: 700 }}>{s.val}</div>
                <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ fontSize: 12, padding: '7px 14px', background: activeTab === t.id ? '#3b82f6' : 'var(--navy-700)', color: activeTab === t.id ? 'white' : '#94a3b8', border: `1px solid ${activeTab === t.id ? '#3b82f6' : 'var(--navy-500)'}`, borderRadius: 8, cursor: 'pointer' }}>
                {t.label} ({t.data.length})
              </button>
            ))}
          </div>

          <div style={card}>
            {(tabs.find(t => t.id === activeTab)?.data || []).length === 0
              ? <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 20 }}>No items in this category</div>
              : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead><tr style={{ borderBottom: '1px solid var(--navy-600)' }}>
                    {['Date', 'Narration', 'Amount', 'Dr/Cr'].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#4A6A8A', fontSize: 10 }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {tabs.find(t => t.id === activeTab)?.data.map((row: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '8px 10px', color: '#8AA8C0' }}>{row.date}</td>
                        <td style={{ padding: '8px 10px', color: '#e2e8f0' }}>{row.narration || row.description || '—'}</td>
                        <td style={{ padding: '8px 10px', color: '#34d399', fontWeight: 600 }}>{fmt(row.amount || 0)}</td>
                        <td style={{ padding: '8px 10px' }}><span style={{ background: 'var(--navy-600)', color: '#94a3b8', fontSize: 10, padding: '2px 6px', borderRadius: 99 }}>{row.dr_cr || '—'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        </>
      )}
    </div>
  )
}
