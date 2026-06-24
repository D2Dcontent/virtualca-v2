import { useState } from 'react'
import './index.css'
import Login from './pages/Login'
import QuickAudit from './pages/QuickAudit'
import AskCA from './pages/AskCA'

type Tab = 'audit' | 'askca'

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: 'audit', label: 'Quick Audit', icon: '📊' },
  { id: 'askca', label: 'Ask Your CA', icon: '🤖' },
]

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('token'))
  const [tab, setTab] = useState<Tab>('audit')

  const logout = () => {
    localStorage.clear()
    setAuthed(false)
  }

  if (!authed) return <Login onLogin={() => setAuthed(true)} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--navy-900)' }}>
      {/* Header */}
      <div style={{ background: 'var(--navy-800)', borderBottom: '1px solid var(--navy-600)', padding: '0 20px', display: 'flex', alignItems: 'center', height: 56, flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--gold-500)', marginRight: 32 }}>VirtualCA</div>
        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{
              padding: '6px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: tab === n.id ? 'rgba(201,168,76,0.15)' : 'transparent',
              color: tab === n.id ? 'var(--gold-400)' : 'var(--muted)',
            }}>{n.icon} {n.label}</button>
          ))}
        </div>
        <button onClick={logout} style={{ fontSize: 12, color: 'var(--muted)', background: 'transparent', border: '1px solid var(--navy-600)', padding: '6px 14px', borderRadius: 10, cursor: 'pointer' }}>Logout</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'audit' && <QuickAudit />}
        {tab === 'askca' && <AskCA />}
      </div>
    </div>
  )
}
