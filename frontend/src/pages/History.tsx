import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auditAPI } from '../api'

export default function History() {
  const [history, setHistory] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const navigate = useNavigate()

  useEffect(() => {
    auditAPI.history().then(r => setHistory(r.data.history || r.data || [])).catch(() => {})
  }, [])

  const filtered = history.filter(h => {
    const matchSearch = !search || (h.filename || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || (filter === 'critical' && h.critical > 0) || (filter === 'ok' && h.critical === 0)
    return matchSearch && matchFilter
  })

  const card = { background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 16 }

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ ...card, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>Audit History</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13, background: 'var(--navy-700)', border: '1px solid var(--navy-500)', color: '#e2e8f0', outline: 'none' }} />
            <select value={filter} onChange={e => setFilter(e.target.value)}
              style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13, background: 'var(--navy-700)', border: '1px solid var(--navy-500)', color: '#94a3b8', outline: 'none' }}>
              <option value="all">All Status</option>
              <option value="critical">Critical</option>
              <option value="ok">All OK</option>
            </select>
          </div>
        </div>

        {filtered.length === 0
          ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 10 }}>
              <i className="fas fa-folder-open" style={{ fontSize: 36, color: '#1e3a5f' }}></i>
              <div style={{ fontSize: 13, color: '#475569' }}>No audit history yet</div>
              <button onClick={() => navigate('/quickaudit')} className="btn-gold" style={{ marginTop: 8, fontSize: 13, padding: '10px 20px', borderRadius: 12 }}>Run First Audit</button>
            </div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map((h, i) => {
                const dt = h.audited_at ? new Date(h.audited_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
                const scoreColor = h.score >= 75 ? '#34d399' : h.score >= 50 ? '#f59e0b' : '#f87171'
                return (
                  <div key={i} onClick={() => navigate('/quickaudit')} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, borderRadius: 12, cursor: 'pointer', background: 'var(--navy-700)', border: '1px solid var(--navy-600)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(201,168,76,0.15)', flexShrink: 0 }}>
                      <i className="fas fa-file-excel" style={{ color: 'var(--gold-400)' }}></i>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.filename || 'Trial Balance'}</div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{dt}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: scoreColor }}>{h.score}%</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Score</div>
                    </div>
                    {h.critical > 0 ? <span className="tag-critical">{h.critical} Critical</span> : <span className="tag-ok">Clear</span>}
                    <i className="fas fa-chevron-right" style={{ color: '#334155', fontSize: 11 }}></i>
                  </div>
                )
              })}
            </div>
        }
      </div>
    </div>
  )
}
