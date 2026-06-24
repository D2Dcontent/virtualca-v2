import { useState } from 'react'
import API from '../api'

const card = { background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 12, padding: 16, marginBottom: 10 }

const ENTRIES = [
  {
    category: 'Sales & Revenue',
    color: '#34d399',
    entries: [
      { title: 'Cash Sale', dr: 'Cash / Bank A/c', cr: 'Sales A/c', note: 'For direct cash sales' },
      { title: 'Credit Sale', dr: 'Sundry Debtors A/c', cr: 'Sales A/c', note: 'When payment is due later' },
      { title: 'Sales Return', dr: 'Sales Returns A/c', cr: 'Sundry Debtors A/c', note: 'When customer returns goods' },
    ],
  },
  {
    category: 'Purchases & Expenses',
    color: '#f87171',
    entries: [
      { title: 'Cash Purchase', dr: 'Purchases A/c', cr: 'Cash / Bank A/c', note: 'Direct cash payment to supplier' },
      { title: 'Credit Purchase', dr: 'Purchases A/c', cr: 'Sundry Creditors A/c', note: 'Payment due to supplier' },
      { title: 'Purchase Return', dr: 'Sundry Creditors A/c', cr: 'Purchase Returns A/c', note: 'Returning goods to supplier' },
      { title: 'Salary Payment', dr: 'Salary A/c', cr: 'Cash / Bank A/c', note: 'Monthly payroll' },
      { title: 'Rent Payment', dr: 'Rent A/c', cr: 'Cash / Bank A/c', note: 'Office / shop rent' },
    ],
  },
  {
    category: 'TDS Entries',
    color: '#fbbf24',
    entries: [
      { title: 'TDS on Professional Fees (194J)', dr: 'Professional Fees A/c', cr: 'TDS Payable A/c + Vendor A/c', note: 'Deduct 10% TDS before paying vendor' },
      { title: 'TDS Deposit to Govt', dr: 'TDS Payable A/c', cr: 'Bank A/c', note: 'Deposit via Challan 281 by 7th of next month' },
      { title: 'TDS on Contractor (194C)', dr: 'Contractor Charges A/c', cr: 'TDS Payable A/c + Contractor A/c', note: 'Deduct 1% (individual) or 2% (company)' },
    ],
  },
  {
    category: 'GST Entries',
    color: '#60a5fa',
    entries: [
      { title: 'GST on Sales (Output)', dr: 'Sundry Debtors / Cash', cr: 'Sales A/c + Output CGST/SGST', note: 'Collect GST from customer' },
      { title: 'GST on Purchase (Input ITC)', dr: 'Purchases A/c + Input CGST/SGST', cr: 'Sundry Creditors / Cash', note: 'Claim ITC on eligible purchases' },
      { title: 'GST Payment to Govt', dr: 'Output CGST/SGST A/c', cr: 'Input CGST/SGST A/c + Bank A/c', note: 'Net GST payable after adjusting ITC' },
    ],
  },
  {
    category: 'Banking & Loans',
    color: '#a78bfa',
    entries: [
      { title: 'Loan Received', dr: 'Bank A/c', cr: 'Loan A/c', note: 'When bank loan is credited' },
      { title: 'Loan Repayment (Principal)', dr: 'Loan A/c', cr: 'Bank A/c', note: 'Monthly EMI principal portion' },
      { title: 'Loan Interest', dr: 'Interest on Loan A/c', cr: 'Bank A/c', note: 'EMI interest portion' },
      { title: 'Bank Charges', dr: 'Bank Charges A/c', cr: 'Bank A/c', note: 'Service charges debited by bank' },
    ],
  },
  {
    category: 'Fixed Assets',
    color: '#fb923c',
    entries: [
      { title: 'Asset Purchase', dr: 'Fixed Asset A/c', cr: 'Bank / Creditor A/c', note: 'Buy machinery, furniture, computer' },
      { title: 'Depreciation', dr: 'Depreciation A/c', cr: 'Fixed Asset A/c (or Accumulated Dep.)', note: 'Year-end — use Companies Act / IT Act rates' },
      { title: 'Asset Sale (Profit)', dr: 'Bank A/c', cr: 'Fixed Asset A/c + Profit on Sale A/c', note: 'Sale price > book value' },
    ],
  },
  {
    category: 'Capital & Drawings',
    color: '#C9A84C',
    entries: [
      { title: 'Capital Introduced', dr: 'Bank A/c', cr: "Proprietor's Capital A/c", note: 'Owner puts money into business' },
      { title: "Proprietor's Drawings", dr: "Proprietor's Drawings A/c", cr: 'Cash / Bank A/c', note: 'Owner withdraws money from business' },
      { title: 'Closing Drawings to Capital', dr: "Proprietor's Capital A/c", cr: "Proprietor's Drawings A/c", note: 'Year-end adjustment' },
    ],
  },
]

export default function JournalGuide() {
  const [search, setSearch] = useState('')
  const [active, setActive] = useState<string | null>(null)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([])

  const filtered = ENTRIES.map(cat => ({
    ...cat,
    entries: cat.entries.filter(e =>
      !search || e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.dr.toLowerCase().includes(search.toLowerCase()) ||
      e.cr.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.entries.length > 0)

  const askAI = async () => {
    if (!aiQuestion.trim()) return
    const q = aiQuestion.trim()
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setAiQuestion('')
    setAiLoading(true)
    try {
      const r = await API.post('/api/ca-chat', { message: q, context: 'Journal entry guide — help with accounting entries, Tally, GST, TDS, debit/credit rules.' })
      const answer = r.data.reply || r.data.message || 'Sorry, could not get a response.'
      setMessages(prev => [...prev, { role: 'ai', text: answer }])
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Error — please try again.' }])
    }
    setAiLoading(false)
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 20, marginBottom: 4 }}>Journal Entry Guide</div>
      <div style={{ color: '#64748b', fontSize: 12, marginBottom: 20 }}>Double-entry rules · Tally-ready · Ask AI for any entry</div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search entries... (e.g. salary, GST, depreciation)"
        style={{ width: '100%', background: '#091526', border: '1px solid var(--navy-600)', borderRadius: 10, padding: '11px 16px', color: '#F5F0E6', fontSize: 13, outline: 'none', marginBottom: 20, boxSizing: 'border-box' }}
      />

      {/* Golden rules banner */}
      <div style={{ background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
        <div style={{ color: '#C9A84C', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>📚 Golden Rules of Accounting</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {[
            { type: 'Personal A/c', dr: 'Debit the Receiver', cr: 'Credit the Giver' },
            { type: 'Real A/c', dr: 'Debit what comes in', cr: 'Credit what goes out' },
            { type: 'Nominal A/c', dr: 'Debit all Expenses & Losses', cr: 'Credit all Income & Gains' },
          ].map(r => (
            <div key={r.type} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ color: '#C9A84C', fontSize: 10, fontWeight: 700, marginBottom: 4 }}>{r.type}</div>
              <div style={{ color: '#34d399', fontSize: 11, marginBottom: 2 }}>Dr: {r.dr}</div>
              <div style={{ color: '#f87171', fontSize: 11 }}>Cr: {r.cr}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Entry categories */}
      {filtered.map(cat => (
        <div key={cat.category} style={{ marginBottom: 16 }}>
          <div
            onClick={() => setActive(active === cat.category ? null : cat.category)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--navy-800)', border: `1px solid var(--navy-600)`, borderRadius: active === cat.category ? '12px 12px 0 0' : 12, cursor: 'pointer', borderLeft: `3px solid ${cat.color}` }}
          >
            <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 13 }}>{cat.category}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: `${cat.color}20`, color: cat.color, fontSize: 10, padding: '2px 8px', borderRadius: 99 }}>{cat.entries.length} entries</span>
              <span style={{ color: '#64748b', fontSize: 12 }}>{active === cat.category ? '▲' : '▼'}</span>
            </div>
          </div>

          {active === cat.category && (
            <div style={{ border: '1px solid var(--navy-600)', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--navy-900)' }}>
                    {['Entry Type', 'Debit (Dr)', 'Credit (Cr)', 'Note'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '9px 14px', color: '#64748b', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--navy-600)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cat.entries.map((e, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'var(--navy-800)' : 'rgba(255,255,255,0.01)' }}>
                      <td style={{ padding: '10px 14px', color: '#f1f5f9', fontWeight: 600 }}>{e.title}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', padding: '3px 8px', borderRadius: 6, fontSize: 11 }}>{e.dr}</span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: '3px 8px', borderRadius: 6, fontSize: 11 }}>{e.cr}</span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 11 }}>{e.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {/* Ask AI */}
      <div style={{ ...card, marginTop: 8 }}>
        <div style={{ color: '#a78bfa', fontSize: 12, fontWeight: 700, marginBottom: 12 }}>🤖 Ask AI — Any Journal Entry</div>

        {messages.length > 0 && (
          <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: m.role === 'user' ? '12px 12px 0 12px' : '12px 12px 12px 0', background: m.role === 'user' ? 'rgba(201,168,76,0.15)' : 'rgba(167,139,250,0.1)', border: `1px solid ${m.role === 'user' ? 'rgba(201,168,76,0.3)' : 'rgba(167,139,250,0.25)'}`, color: m.role === 'user' ? '#C9A84C' : '#e2e8f0', fontSize: 12, lineHeight: 1.6 }}>
                  {m.text}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
                <div style={{ padding: '10px 14px', borderRadius: '12px 12px 12px 0', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa', fontSize: 12 }}>Thinking...</div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={aiQuestion}
            onChange={e => setAiQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && askAI()}
            placeholder="e.g. How to pass entry for advance from customer?"
            style={{ flex: 1, background: '#091526', border: '1px solid var(--navy-600)', borderRadius: 8, padding: '10px 12px', color: '#F5F0E6', fontSize: 12, outline: 'none' }}
          />
          <button onClick={askAI} disabled={aiLoading} style={{ background: 'var(--gold-500)', color: 'var(--navy-900)', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: aiLoading ? 0.6 : 1 }}>
            Ask
          </button>
        </div>
      </div>
    </div>
  )
}
