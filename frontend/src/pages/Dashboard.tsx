import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { dashboardAPI, uploadAPI } from '../api'

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<any>({})
  const [meta, setMeta] = useState<any>({})

  useEffect(() => {
    Promise.all([dashboardAPI.get(), uploadAPI.status()])
      .then(([d, m]) => { setData(d.data); setMeta(m.data) })
      .catch(() => {})
  }, [])

  const score = data.last_score
  const critical = data.last_critical
  const warnings = data.last_warnings
  const total = data.total_audits || 0
  const files = ['tb', 'db', 'bs', 'pnl', 'bstmt', 'btally']
  const present = files.filter(f => meta[f + '_exists'] || meta[f]).length
  const pct = Math.round((present / files.length) * 100)

  const scoreColor = score >= 75 ? '#34d399' : score >= 50 ? '#f59e0b' : score != null ? '#f87171' : '#64748b'
  const scoreLabel = score >= 75 ? 'Good' : score >= 50 ? 'Needs Attention' : score != null ? 'High Risk' : 'No audit yet'

  const card = { background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 16 }

  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', height: '100%' }}>

      {/* ROW 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* AI Audit Manager */}
        <div style={{ ...card, padding: 20, opacity: 0.75 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>AI Audit Manager</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(201,168,76,0.2)', color: 'var(--gold-400)', border: '1px solid rgba(201,168,76,0.3)' }}>Beta</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#1e293b', color: '#475569', border: '1px solid #334155' }}>Soon</span>
          </div>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Your personal AI auditor that analyzes, explains and guides you to 100% compliance</p>
          <button className="btn-gold" style={{ padding: '8px 16px', borderRadius: 12, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, opacity: 0.5 }}>
            <i className="fas fa-play" style={{ fontSize: 10 }}></i> Start AI Audit
          </button>
        </div>

        {/* AI Auditor Status */}
        <div style={{ ...card, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>AI Auditor Status</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#1e293b', color: '#475569', border: '1px solid #334155' }}>Soon</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', flexShrink: 0 }}>
              <i className="fas fa-robot" style={{ fontSize: 22, color: 'var(--gold-400)', opacity: 0.5 }}></i>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>AI analysis not available</div>
              <div style={{ fontSize: 11, color: '#334155' }}>Coming soon</div>
            </div>
          </div>
        </div>

        {/* Next Action */}
        <div style={{ ...card, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 12 }}>Next Action Required</div>
          {!meta.tb_exists
            ? <>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>Upload Trial Balance</div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>Required to start audit</div>
                <button onClick={() => navigate('/quickaudit')} style={{ width: '100%', padding: '8px 0', borderRadius: 12, fontSize: 12, fontWeight: 700, background: 'rgba(201,168,76,0.15)', color: 'var(--gold-300)', border: '1px solid rgba(201,168,76,0.3)', cursor: 'pointer' }}>
                  <i className="fas fa-upload" style={{ marginRight: 6 }}></i>Upload Now
                </button>
              </>
            : critical > 0
            ? <>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171', marginBottom: 4 }}>{critical} Critical Issues Found</div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>Review and resolve before filing</div>
                <button onClick={() => navigate('/quickaudit')} style={{ width: '100%', padding: '8px 0', borderRadius: 12, fontSize: 12, fontWeight: 700, background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', cursor: 'pointer' }}>
                  <i className="fas fa-eye" style={{ marginRight: 6 }}></i>View Issues
                </button>
              </>
            : <>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#34d399', marginBottom: 4 }}>All Clear!</div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>No critical issues found</div>
                <button onClick={() => navigate('/askca')} style={{ width: '100%', padding: '8px 0', borderRadius: 12, fontSize: 12, fontWeight: 700, background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)', cursor: 'pointer' }}>
                  <i className="fas fa-comments" style={{ marginRight: 6 }}></i>Ask Your CA
                </button>
              </>
          }
        </div>
      </div>

      {/* ROW 2: 5 score cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Health Score', value: score != null ? score + '%' : '—', sub: scoreLabel, color: scoreColor, bar: score },
          { label: 'Audit Status', value: critical != null ? (critical === 0 ? 'PASSED' : 'ISSUES') : '—', sub: critical != null ? `${critical} Critical · ${warnings || 0} Warnings` : 'Not run yet', color: critical === 0 ? '#34d399' : '#f87171' },
          { label: 'GST Readiness', value: '—', sub: 'Coming Soon', color: '#64748b', soon: true },
          { label: 'ITR Readiness', value: '—', sub: 'Coming Soon', color: '#64748b', soon: true },
          { label: 'Data Completeness', value: pct + '%', sub: `${present} of 6 files uploaded`, color: pct >= 80 ? '#34d399' : pct >= 50 ? '#f59e0b' : '#f87171' },
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: 16, position: 'relative' }}>
            {s.soon && <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99, background: '#1e293b', color: '#475569', border: '1px solid #334155' }}>Soon</span>}
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: i === 1 ? 18 : 26, fontWeight: 900, color: s.color, marginBottom: 4 }}>{s.value}</div>
            {i === 0 && <div className="progress-bar" style={{ marginBottom: 4 }}><div className="progress-fill" style={{ width: (score || 0) + '%' }}></div></div>}
            <div style={{ fontSize: 11, color: '#64748b' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ROW 3: Recent + Journey */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Recent Analyses */}
        <div style={{ ...card, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Recent Analyses</span>
            <button onClick={() => navigate('/history')} style={{ fontSize: 12, fontWeight: 500, color: 'var(--gold-400)', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
          </div>
          {!data.recent || data.recent.length === 0
            ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', gap: 8 }}>
                <i className="fas fa-folder-open" style={{ fontSize: 20, color: '#334155' }}></i>
                <div style={{ fontSize: 12, color: '#475569' }}>No audits yet</div>
                <button onClick={() => navigate('/quickaudit')} className="btn-gold" style={{ marginTop: 8, fontSize: 12, padding: '8px 16px', borderRadius: 12 }}>Run First Audit</button>
              </div>
            : data.recent.map((a: any, i: number) => {
                const dt = a.audited_at ? new Date(a.audited_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
                return (
                  <div key={i} onClick={() => navigate('/quickaudit')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, cursor: 'pointer', marginBottom: 8, border: '1px solid var(--navy-600)', background: 'var(--navy-700)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(201,168,76,0.15)', flexShrink: 0 }}>
                      <i className="fas fa-file-excel" style={{ fontSize: 12, color: 'var(--gold-400)' }}></i>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.filename || 'Trial Balance'}</div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{dt}</div>
                    </div>
                    {a.critical > 0 ? <span className="tag-critical">{a.critical} Critical</span> : <span className="tag-ok">Clear</span>}
                  </div>
                )
              })
          }
        </div>

        {/* Audit Journey */}
        <div style={{ ...card, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Audit Journey</span>
            <button onClick={() => navigate('/fullaudit')} style={{ fontSize: 12, fontWeight: 500, color: 'var(--gold-400)', background: 'none', border: 'none', cursor: 'pointer' }}>View full →</button>
          </div>
          {[
            { label: 'Trial Balance Uploaded', done: !!meta.tb },
            { label: 'P&L Uploaded', done: !!meta.pnl },
            { label: 'Balance Sheet Uploaded', done: !!meta.bs },
            { label: 'Bank Statement Uploaded', done: !!meta.bstmt },
            { label: 'Initial Audit Completed', done: total > 0 },
            { label: 'GST Analysis', done: false, soon: true },
            { label: 'ITR Readiness', done: false, soon: true },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: s.done ? 'rgba(52,211,153,0.2)' : 'var(--navy-700)', border: `1px solid ${s.done ? 'rgba(52,211,153,0.4)' : 'var(--navy-500)'}`, flexShrink: 0 }}>
                <i className={`fas ${s.done ? 'fa-check' : 'fa-circle'}`} style={{ color: s.done ? '#34d399' : '#334155', fontSize: 8 }}></i>
              </div>
              <span style={{ fontSize: 12, flex: 1, color: s.done ? '#e2e8f0' : '#475569' }}>{s.label}</span>
              {s.soon && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: '#1e293b', color: '#334155', border: '1px solid #334155' }}>Soon</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ROW 4: Quick Actions */}
      <div style={{ ...card, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 16 }}>Quick Actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {[
            { icon: 'fa-clipboard-check', color: '#818cf8', bg: 'rgba(129,140,248,0.15)', label: 'Run Full Audit', desc: 'Deep analysis of all transactions', path: '/fullaudit' },
            { icon: 'fa-right-left', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', label: 'Bank Reconciliation', desc: 'Reconcile bank statements', path: '/bankrec' },
            { icon: 'fa-percent', color: '#34d399', bg: 'rgba(52,211,153,0.15)', label: 'GST Analysis', desc: 'Check GST compliance & mismatches', path: null },
            { icon: 'fa-file-invoice-dollar', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)', label: 'Generate Reports', desc: 'Generate financial & compliance reports', path: null },
            { icon: 'fa-calendar-check', color: '#f87171', bg: 'rgba(248,113,113,0.15)', label: 'Compliance Calendar', desc: 'View upcoming deadlines', path: '/compliance' },
          ].map((a, i) => (
            <button key={i} onClick={() => a.path && navigate(a.path)} style={{ borderRadius: 12, padding: 16, textAlign: 'left', background: 'var(--navy-700)', border: '1px solid var(--navy-600)', opacity: a.path ? 1 : 0.6, cursor: a.path ? 'pointer' : 'default' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: a.bg, marginBottom: 8 }}>
                <i className={`fas ${a.icon}`} style={{ fontSize: 14, color: a.color }}></i>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>{a.label}</div>
              <div style={{ fontSize: 11, color: '#475569' }}>{a.desc}</div>
              {!a.path && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: '#1e293b', color: '#475569', border: '1px solid #334155', display: 'inline-block', marginTop: 4 }}>Soon</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
