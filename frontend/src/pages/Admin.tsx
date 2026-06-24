import { useEffect, useState } from 'react'
import API from '../api'

const card = { background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 12, padding: 16, marginBottom: 10 }

export default function Admin() {
  const [stats, setStats] = useState<any>({})

  useEffect(() => {
    API.get('/api/admin/stats').then(r => setStats(r.data)).catch(() => {})
  }, [])

  const deleteEntry = async (id: string) => {
    await API.delete(`/api/admin/history/${id}`)
    setStats((prev: any) => ({ ...prev, history: prev.history?.filter((h: any) => h.id !== id) }))
  }

  const scoreColor = (s: number) => s >= 80 ? '#34d399' : s >= 60 ? '#fbbf24' : '#f87171'

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Admin Panel</div>
      <div style={{ color: '#64748b', fontSize: 12, marginBottom: 24 }}>Company audit history and usage stats</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Audits Run', value: stats.total_audits ?? '—', color: '#f1f5f9' },
          { label: 'Last Score', value: stats.last_score != null ? stats.last_score + '%' : '—', color: '#f59e0b' },
          { label: 'Critical Issues (last)', value: stats.last_critical != null ? stats.last_critical : '—', color: '#f87171' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>{s.label}</div>
            <div style={{ color: s.color, fontSize: 32, fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 16, padding: 24 }}>
        <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Audit History</div>
        {!stats.history || stats.history.length === 0
          ? <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No audits run yet</div>
          : stats.history.map((h: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, marginBottom: 8, background: 'var(--navy-700)', border: '1px solid var(--navy-600)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 500 }}>{h.filename || 'Trial Balance'}</div>
                <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{h.audited_at ? new Date(h.audited_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</div>
              </div>
              <div style={{ color: scoreColor(h.score), fontSize: 15, fontWeight: 700 }}>{h.score}%</div>
              {h.critical > 0
                ? <span style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>{h.critical} Critical</span>
                : <span style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>Clear</span>
              }
              {h.warnings > 0 && <span style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', fontSize: 10, padding: '2px 8px', borderRadius: 99 }}>{h.warnings} Warn</span>}
              {h.id && (
                <button onClick={() => deleteEntry(h.id)} style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '3px 8px', fontSize: 10, cursor: 'pointer' }}>Delete</button>
              )}
            </div>
          ))
        }
      </div>

      {/* Data management */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Data Management</div>
        <div style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>Uploaded files are stored securely in Supabase Storage per company. Each company's data is isolated.</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, background: 'var(--navy-700)', border: '1px solid var(--navy-600)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ color: '#60a5fa', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>📁 Storage</div>
            <div style={{ color: '#94a3b8', fontSize: 11 }}>Trial Balance, Daybook, Bank Statement files stored per company</div>
          </div>
          <div style={{ flex: 1, background: 'var(--navy-700)', border: '1px solid var(--navy-600)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ color: '#a78bfa', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>🔒 Security</div>
            <div style={{ color: '#94a3b8', fontSize: 11 }}>Row-level isolation — companies cannot access each other's data</div>
          </div>
          <div style={{ flex: 1, background: 'var(--navy-700)', border: '1px solid var(--navy-600)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ color: '#34d399', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>🤖 AI Model</div>
            <div style={{ color: '#94a3b8', fontSize: 11 }}>OpenRouter → claude-haiku-4-5 · Fast · Cost-efficient</div>
          </div>
        </div>
      </div>
    </div>
  )
}
