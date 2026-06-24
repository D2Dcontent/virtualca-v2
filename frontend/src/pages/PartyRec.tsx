import { useState, useRef } from 'react'
import API from '../api'

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const card = { background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 12, padding: 16, marginBottom: 10 }

export default function PartyRec() {
  const [tallyFile, setTallyFile] = useState<File | null>(null)
  const [partyFile, setPartyFile] = useState<File | null>(null)
  const [partyName, setPartyName] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('unmatched')
  const tallyRef = useRef<HTMLInputElement>(null)
  const partyRef = useRef<HTMLInputElement>(null)

  const run = async () => {
    if (!tallyFile || !partyFile || !partyName.trim()) { setError('Please upload both files and enter party name'); return }
    setLoading(true); setError('')
    const fd = new FormData()
    fd.append('tally_file', tallyFile)
    fd.append('party_file', partyFile)
    fd.append('party_name', partyName)
    try { const r = await API.post('/api/party-rec', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setData(r.data) }
    catch (e: any) { setError(e.response?.data?.error || e.message) }
    setLoading(false)
  }

  const TabBtn = ({ id, label, count }: { id: string; label: string; count?: number }) => (
    <button onClick={() => setTab(id)} style={{ fontSize: 12, padding: '6px 14px', background: tab === id ? 'rgba(201,168,76,0.15)' : 'transparent', color: tab === id ? '#C9A84C' : '#4A6A8A', border: `1px solid ${tab === id ? 'rgba(201,168,76,0.3)' : 'var(--navy-600)'}`, borderRadius: 8, cursor: 'pointer' }}>
      {label} {count !== undefined && <span style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 99, padding: '1px 6px', fontSize: 10, marginLeft: 4 }}>{count}</span>}
    </button>
  )

  const TxnTable = ({ rows, emptyMsg }: { rows: any[]; emptyMsg: string }) => (
    rows?.length === 0 ? <div style={{ color: '#4A6A8A', fontSize: 12, padding: 8 }}>{emptyMsg}</div> :
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
      <thead><tr style={{ borderBottom: '1px solid var(--navy-600)' }}>
        {['Date', 'Narration', 'Amount', 'Source'].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#4A6A8A', fontSize: 10 }}>{h}</th>)}
      </tr></thead>
      <tbody>
        {rows?.map((r: any, i: number) => (
          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <td style={{ padding: '8px 10px', color: '#8AA8C0' }}>{r.date}</td>
            <td style={{ padding: '8px 10px', color: '#e2e8f0' }}>{r.narration}</td>
            <td style={{ padding: '8px 10px', color: '#F5F0E6', fontWeight: 600 }}>{fmt(r.amount)}</td>
            <td style={{ padding: '8px 10px' }}><span style={{ background: 'rgba(96,165,250,0.1)', color: '#93c5fd', fontSize: 10, padding: '2px 6px', borderRadius: 99 }}>{r.source || '—'}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <div style={{ padding: 20 }}>
      {!data && (
        <>
          <div style={{ color: '#F5F0E6', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Party Ledger Reconciliation</div>
          <div style={{ color: '#4A6A8A', fontSize: 12, marginBottom: 16 }}>Compare your Tally ledger with party's statement — find mismatches</div>

          <div style={card}>
            <div style={{ color: '#8AA8C0', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Party Name</div>
            <input value={partyName} onChange={e => setPartyName(e.target.value)} placeholder="e.g. Reliance Industries Ltd"
              style={{ width: '100%', background: '#091526', border: '1px solid var(--navy-600)', borderRadius: 8, padding: '10px 12px', color: '#F5F0E6', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ ...card, cursor: 'pointer' }} onClick={() => tallyRef.current?.click()}>
              <input ref={tallyRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => setTallyFile(e.target.files?.[0] || null)} />
              <div style={{ textAlign: 'center', padding: 16 }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📋</div>
                <div style={{ color: '#F5F0E6', fontWeight: 600, fontSize: 12, marginBottom: 4 }}>Tally Ledger</div>
                <div style={{ color: tallyFile ? '#34d399' : '#4A6A8A', fontSize: 11 }}>{tallyFile ? tallyFile.name : 'Click to upload Excel/CSV'}</div>
              </div>
            </div>
            <div style={{ ...card, cursor: 'pointer' }} onClick={() => partyRef.current?.click()}>
              <input ref={partyRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => setPartyFile(e.target.files?.[0] || null)} />
              <div style={{ textAlign: 'center', padding: 16 }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📄</div>
                <div style={{ color: '#F5F0E6', fontWeight: 600, fontSize: 12, marginBottom: 4 }}>Party Statement</div>
                <div style={{ color: partyFile ? '#34d399' : '#4A6A8A', fontSize: 11 }}>{partyFile ? partyFile.name : 'Click to upload Excel/CSV'}</div>
              </div>
            </div>
          </div>

          {error && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 10 }}>{error}</div>}
          {loading
            ? <div style={{ textAlign: 'center', color: '#C9A84C', padding: 20 }}>Reconciling...</div>
            : <button onClick={run} style={{ width: '100%', background: 'var(--gold-500)', color: 'var(--navy-900)', border: 'none', borderRadius: 10, padding: '12px 0', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Reconcile</button>
          }
        </>
      )}

      {data && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
            <div>
              <div style={{ color: '#F5F0E6', fontWeight: 600, fontSize: 14 }}>{partyName} — Reconciliation Result</div>
              <div style={{ color: data.is_reconciled ? '#34d399' : '#f87171', fontSize: 12, marginTop: 2 }}>{data.is_reconciled ? '✓ Fully Reconciled' : '✗ Differences Found'}</div>
            </div>
            <button onClick={() => setData(null)} style={{ fontSize: 11, padding: '6px 12px', background: 'var(--navy-700)', color: '#8AA8C0', border: '1px solid var(--navy-600)', borderRadius: 8, cursor: 'pointer' }}>New Rec</button>
          </div>

          {data.ai_insight && (
            <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12, padding: '14px 16px', marginBottom: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <div><div style={{ color: '#a78bfa', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>CA AI INSIGHT</div><div style={{ color: '#e2e8f0', fontSize: 12, lineHeight: 1.6 }}>{data.ai_insight}</div></div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
            <div style={{ ...card, margin: 0 }}><div style={{ color: '#4A6A8A', fontSize: 10 }}>Matched</div><div style={{ color: '#34d399', fontSize: 18, fontWeight: 700 }}>{data.matched?.length || 0}</div></div>
            <div style={{ ...card, margin: 0 }}><div style={{ color: '#4A6A8A', fontSize: 10 }}>Only in Tally</div><div style={{ color: '#fbbf24', fontSize: 18, fontWeight: 700 }}>{data.only_tally?.length || 0}</div></div>
            <div style={{ ...card, margin: 0 }}><div style={{ color: '#4A6A8A', fontSize: 10 }}>Only in Party</div><div style={{ color: '#f87171', fontSize: 18, fontWeight: 700 }}>{data.only_party?.length || 0}</div></div>
            <div style={{ ...card, margin: 0 }}><div style={{ color: '#4A6A8A', fontSize: 10 }}>Balance Diff</div><div style={{ color: data.balance_diff === 0 ? '#34d399' : '#f87171', fontSize: 18, fontWeight: 700 }}>{fmt(Math.abs(data.balance_diff || 0))}</div></div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <TabBtn id="unmatched" label="Only in Tally" count={data.only_tally?.length} />
            <TabBtn id="party_only" label="Only in Party" count={data.only_party?.length} />
            <TabBtn id="matched" label="Matched" count={data.matched?.length} />
          </div>

          <div style={card}>
            {tab === 'unmatched' && <TxnTable rows={data.only_tally || []} emptyMsg="All Tally entries matched" />}
            {tab === 'party_only' && <TxnTable rows={data.only_party || []} emptyMsg="All party entries matched" />}
            {tab === 'matched' && <TxnTable rows={data.matched || []} emptyMsg="No matches found" />}
          </div>
        </>
      )}
    </div>
  )
}
