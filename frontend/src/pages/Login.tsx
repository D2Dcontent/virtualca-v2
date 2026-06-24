import { useState } from 'react'
import { authAPI } from '../api'

interface Props { onLogin: () => void }

export default function Login({ onLogin }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true); setError('')
    try {
      const fn = mode === 'login' ? authAPI.login : authAPI.signup
      const r = await fn(email, password)
      localStorage.setItem('token', r.data.token)
      localStorage.setItem('company_id', String(r.data.company_id))
      localStorage.setItem('email', r.data.email)
      onLogin()
    } catch (e: any) {
      setError(e.response?.data?.error || 'Something went wrong')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy-900)' }}>
      <div style={{ width: 380, background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 16, padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold-500)', marginBottom: 4 }}>VirtualCA</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>AI-Powered Accounting Intelligence</div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['login', 'signup'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: mode === m ? 'var(--gold-500)' : 'var(--navy-700)',
              color: mode === m ? 'var(--navy-900)' : 'var(--muted)',
            }}>{m === 'login' ? 'Sign In' : 'Sign Up'}</button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email"
            style={{ padding: '12px 14px', background: 'var(--navy-700)', border: '1px solid var(--navy-600)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none' }} />
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password"
            onKeyDown={e => e.key === 'Enter' && submit()}
            style={{ padding: '12px 14px', background: 'var(--navy-700)', border: '1px solid var(--navy-600)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none' }} />
          {error && <div style={{ color: '#f87171', fontSize: 12 }}>{error}</div>}
          <button onClick={submit} disabled={loading} style={{
            padding: '13px 0', background: 'var(--gold-500)', color: 'var(--navy-900)', border: 'none',
            borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 4,
          }}>{loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}</button>
        </div>
      </div>
    </div>
  )
}
