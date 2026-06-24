import { useState, useEffect, useRef } from 'react'
import { auditAPI, askCAAPI } from '../api'

interface Message { role: 'user' | 'ai'; text: string }
interface Issue { id: string; title: string; category: string; severity: string; amount?: number; context: string }

function buildIssues(data: any): Issue[] {
  if (!data?.summary) return []
  const issues: Issue[] = []

  ;(data.tds_compliance || []).forEach((t: any, i: number) => {
    issues.push({ id: `tds_${i}`, title: t.party, category: 'TDS', severity: 'Warning', amount: t.tds_expected, context: `Party: ${t.party}\nSection: ${t.section}\nAmount paid: Rs.${t.total_paid?.toLocaleString('en-IN')}\nTDS expected: Rs.${t.tds_expected?.toLocaleString('en-IN')} @ ${t.rate}%\nIssue: ${t.issue}` })
  })
  ;(data.outstanding || []).forEach((o: any, i: number) => {
    issues.push({ id: `out_${i}`, title: o.ledger, category: 'Outstanding', severity: o.severity, amount: o.balance, context: `Ledger: ${o.ledger}\nBalance: Rs.${o.balance?.toLocaleString('en-IN')}\nIssue: ${o.issue}` })
  })
  ;(data.salary_compliance || []).filter((s: any) => s.severity !== 'Info').forEach((s: any, i: number) => {
    issues.push({ id: `sal_${i}`, title: 'Salary/PF/PT Issue', category: 'Compliance', severity: s.severity, context: s.issue })
  })
  ;(data.loans || []).slice(0, 10).forEach((l: any, i: number) => {
    issues.push({ id: `loan_${i}`, title: l.ledger, category: 'Loan', severity: 'Warning', amount: Math.abs(l.balance), context: `Ledger: ${l.ledger}\nBalance: Rs.${Math.abs(l.balance)?.toLocaleString('en-IN')}\nNote: ${l.note}` })
  })

  return issues
}

const SEV_COLOR: Record<string, string> = { Critical: '#f87171', Warning: '#fbbf24', Important: '#fbbf24', Info: '#34d399' }

export default function AskCA() {
  const [issues, setIssues] = useState<Issue[]>([])
  const [selected, setSelected] = useState<Issue | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'All' | 'Critical' | 'Warning' | 'Info'>('All')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    auditAPI.result().then(r => {
      if (r.data?.summary) setIssues(buildIssues(r.data))
      else setMessages([{ role: 'ai', text: 'No audit data found. Please run a Quick Audit first, then come back here.' }])
    }).catch(() => {
      setMessages([{ role: 'ai', text: 'No audit data found. Please run a Quick Audit first.' }])
    })
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const selectIssue = (issue: Issue) => {
    setSelected(issue)
    setMessages([{ role: 'ai', text: `I have selected the ${issue.category} issue for ${issue.title}.\n\n${issue.context}\n\nWhat would you like to know about this?` }])
  }

  const send = async (text?: string) => {
    const q = text || input.trim()
    if (!q || !selected) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)
    try {
      const history = messages.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user' as const, content: m.text }))
      const r = await askCAAPI.chat(q, selected.context, history)
      setMessages(prev => [...prev, { role: 'ai', text: r.data.reply || 'No response.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Error connecting to AI. Please try again.' }])
    }
    setLoading(false)
  }

  const filtered = issues.filter(i => filter === 'All' || i.severity === filter || (filter === 'Warning' && i.severity === 'Important'))

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
      {/* Issues panel */}
      <div style={{ width: 280, borderRight: '1px solid var(--navy-600)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '14px 14px 8px', borderBottom: '1px solid var(--navy-600)' }}>
          <div style={{ color: 'var(--text)', fontWeight: 700, marginBottom: 8 }}>Issues Found</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['All', 'Critical', 'Warning', 'Info'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 99, border: `1px solid ${filter === f ? 'var(--gold-500)' : 'var(--navy-600)'}`, background: filter === f ? 'rgba(201,168,76,0.15)' : 'transparent', color: filter === f ? 'var(--gold-500)' : 'var(--muted)', cursor: 'pointer' }}>{f}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 && <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>Run a Quick Audit first to see issues here.</div>}
          {filtered.map(issue => (
            <div key={issue.id} onClick={() => selectIssue(issue)} style={{ padding: '12px 14px', borderBottom: '1px solid var(--navy-700)', cursor: 'pointer', background: selected?.id === issue.id ? 'var(--navy-700)' : 'transparent' }}>
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: `${SEV_COLOR[issue.severity] || '#94a3b8'}22`, color: SEV_COLOR[issue.severity] || '#94a3b8', marginBottom: 4, display: 'inline-block' }}>{issue.category}</span>
              <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>{issue.title}</div>
              {issue.amount && <div style={{ color: SEV_COLOR[issue.severity] || '#94a3b8', fontSize: 12, marginTop: 2 }}>₹{issue.amount.toLocaleString('en-IN')}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Chat panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--navy-600)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
          <div>
            <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>Ask Your CA <span style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa', fontSize: 10, padding: '2px 7px', borderRadius: 99 }}>AI</span></div>
            <div style={{ color: 'var(--muted)', fontSize: 11 }}>{selected ? `Discussing: ${selected.title}` : 'Select an issue from the left to begin'}</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: 60, color: 'var(--muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>←</div>
              <div>Select an issue from the left panel</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Then ask anything about it</div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: 12, background: m.role === 'user' ? 'var(--gold-500)' : 'var(--navy-700)', color: m.role === 'user' ? 'var(--navy-900)' : 'var(--text)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Thinking...</div>}
          <div ref={bottomRef} />
        </div>

        {selected && (
          <>
            <div style={{ display: 'flex', gap: 8, padding: '8px 16px', flexWrap: 'wrap' }}>
              {['What is the exact penalty for this?', 'How do I fix this in Tally?', 'Which section of law applies?', 'What journal entry is needed?'].map(q => (
                <button key={q} onClick={() => send(q)} style={{ fontSize: 11, padding: '5px 12px', background: 'var(--navy-700)', color: 'var(--muted)', border: '1px solid var(--navy-600)', borderRadius: 99, cursor: 'pointer' }}>{q}</button>
              ))}
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--navy-600)', display: 'flex', gap: 10 }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder={`Ask anything about "${selected.title}"...`}
                style={{ flex: 1, padding: '10px 14px', background: 'var(--navy-700)', border: '1px solid var(--navy-600)', borderRadius: 10, color: 'var(--text)', fontSize: 13, outline: 'none' }} />
              <button onClick={() => send()} disabled={loading} style={{ padding: '10px 16px', background: 'var(--gold-500)', color: 'var(--navy-900)', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>→</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
