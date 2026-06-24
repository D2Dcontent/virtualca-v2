import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { companyAPI } from '../api'

interface Company { id: number; name: string }

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [companies, setCompanies] = useState<Company[]>([])
  const [current, setCurrent] = useState<Company | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const email = localStorage.getItem('email') || ''
  const initial = email.charAt(0).toUpperCase()

  useEffect(() => {
    companyAPI.list().then(r => {
      setCompanies(r.data)
      const saved = localStorage.getItem('company_id')
      const found = r.data.find((c: Company) => String(c.id) === saved) || r.data[0]
      if (found) { setCurrent(found); localStorage.setItem('company_id', String(found.id)) }
    }).catch(() => {})
  }, [])

  const switchCompany = (c: Company) => {
    setCurrent(c)
    localStorage.setItem('company_id', String(c.id))
    setShowMenu(false)
    window.location.reload()
  }

  const deleteCompany = (e: React.MouseEvent, c: Company) => {
    e.stopPropagation()
    if (!window.confirm(`Delete "${c.name}"?`)) return
    companyAPI.delete(c.id).then(() => {
      const updated = companies.filter(x => x.id !== c.id)
      setCompanies(updated)
      if (current?.id === c.id) {
        const next = updated[0] || null
        if (next) switchCompany(next)
        else { setCurrent(null); localStorage.removeItem('company_id') }
      }
    })
  }

  const addCompany = async () => {
    if (!newName.trim() || addLoading) return
    setAddError('')
    setAddLoading(true)
    try {
      const r = await companyAPI.create(newName.trim())
      if (!r.data?.id) { setAddError('Server error — please try again'); setAddLoading(false); return }
      setCompanies(prev => [...prev, r.data])
      switchCompany(r.data)
      setShowAddModal(false)
      setNewName('')
    } catch (e: any) {
      setAddError(e?.response?.data?.error || 'Failed to add company — please try again')
    }
    setAddLoading(false)
  }

  const nav = (path: string) => navigate(path)
  const active = (path: string) => location.pathname === path ? 'nav-item active' : 'nav-item'

  return (
    <div className="sidebar flex flex-col" style={{ position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 50 }}>
      {/* Logo */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.25)', flexShrink: 0 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" stroke="#C9A84C" strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="M12 22V12M2 7l10 5 10-5" stroke="#C9A84C" strokeWidth="1.8"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#F0EAD8', letterSpacing: '-0.3px' }}>VirtualCA</div>
            <div style={{ fontSize: 11, color: '#2E4A62' }}>AI Accountant</div>
          </div>
        </div>
      </div>

      {/* User chip */}
      <div style={{ margin: '12px 16px 0', padding: '10px 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: 'rgba(201,168,76,0.2)', color: 'var(--gold-400)', border: '1px solid rgba(201,168,76,0.3)', flexShrink: 0 }}>{initial}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#D0C8B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.split('@')[0]}</div>
          <div style={{ fontSize: 11, color: '#2E7D32', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }}></span>Active
          </div>
        </div>
      </div>

      {/* Company switcher */}
      <div style={{ margin: '12px 16px 0', position: 'relative' }}>
        <div style={{ fontSize: 10, marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#2E4A62' }}>Company</div>
        <button onClick={() => setShowMenu(!showMenu)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 12, textAlign: 'left', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--gold-300)', cursor: 'pointer' }}>
          <i className="fas fa-building" style={{ fontSize: 11, color: 'var(--gold-500)' }}></i>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current?.name || 'Loading…'}</span>
          <i className="fas fa-chevron-down" style={{ fontSize: 10, color: '#2E4A62' }}></i>
        </button>
        {showMenu && (
          <div style={{ position: 'absolute', left: 0, right: 0, marginTop: 4, borderRadius: 12, overflow: 'hidden', zIndex: 50, background: 'var(--navy-700)', border: '1px solid var(--navy-500)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <div style={{ maxHeight: 160, overflowY: 'auto', padding: '4px 0' }}>
              {companies.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <button onClick={() => switchCompany(c)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', fontSize: 12, color: c.id === current?.id ? 'var(--gold-400)' : '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <i className="fas fa-building" style={{ fontSize: 11 }}></i>{c.name}
                    {c.id === current?.id && <i className="fas fa-check" style={{ marginLeft: 'auto', color: 'var(--gold-400)', fontSize: 10 }}></i>}
                  </button>
                  <button onClick={e => deleteCompany(e, c)} style={{ padding: '8px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}>
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--navy-600)' }}>
              <button onClick={() => { setShowAddModal(true); setShowMenu(false) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', fontSize: 12, fontWeight: 500, color: '#34d399', background: 'none', border: 'none', cursor: 'pointer' }}>
                <i className="fas fa-plus" style={{ fontSize: 11 }}></i> Add Company
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '4px 12px 16px', marginTop: 8, overflowY: 'auto' }}>
        <div className="nav-section-label">Workspace</div>
        <div className={active('/dashboard')} onClick={() => nav('/dashboard')}><i className="fas fa-th-large nav-icon"></i><span className="nav-label">Dashboard</span></div>
        <div className={active('/history')} onClick={() => nav('/history')}><i className="fas fa-clock-rotate-left nav-icon"></i><span className="nav-label">History</span></div>

        <div className="nav-section-label">Audit</div>
        <div className={active('/quickaudit')} onClick={() => nav('/quickaudit')}><i className="fas fa-magnifying-glass-dollar nav-icon"></i><span className="nav-label">Quick Audit</span></div>
        <div className={active('/fullaudit')} onClick={() => nav('/fullaudit')}>
          <i className="fas fa-clipboard-check nav-icon"></i><span className="nav-label">Full Audit</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(201,168,76,0.15)', color: 'var(--gold-400)' }}>New</span>
        </div>
        <div className={active('/doc-checker')} onClick={() => nav('/doc-checker')}><i className="fas fa-file-circle-exclamation nav-icon"></i><span className="nav-label">Missing Docs</span></div>

        <div className="nav-section-label">Financial Reports</div>
        <div className={active('/balance-sheet')} onClick={() => nav('/balance-sheet')}><i className="fas fa-scale-balanced nav-icon"></i><span className="nav-label">Balance Sheet</span></div>
        <div className={active('/cash-flow')} onClick={() => nav('/cash-flow')}><i className="fas fa-water nav-icon"></i><span className="nav-label">Cash Flow (AS-3)</span></div>

        <div className="nav-section-label">Tax & Compliance</div>
        <div className={active('/tds-detect')} onClick={() => nav('/tds-detect')}><i className="fas fa-triangle-exclamation nav-icon"></i><span className="nav-label">TDS Detector</span></div>
        <div className={active('/gst-return')} onClick={() => nav('/gst-return')}><i className="fas fa-file-invoice nav-icon"></i><span className="nav-label">GST Returns</span></div>
        <div className={active('/tds')} onClick={() => nav('/tds')}><i className="fas fa-percent nav-icon"></i><span className="nav-label">TDS Analysis</span></div>
        <div className={active('/pt-analysis')} onClick={() => nav('/pt-analysis')}><i className="fas fa-building-columns nav-icon"></i><span className="nav-label">PT Analysis</span></div>
        <div className={active('/compliance')} onClick={() => nav('/compliance')}><i className="fas fa-calendar-check nav-icon"></i><span className="nav-label">Compliance Calendar</span></div>

        <div className="nav-section-label">Investments</div>
        <div className={active('/shares-pnl')} onClick={() => nav('/shares-pnl')}><i className="fas fa-chart-line nav-icon"></i><span className="nav-label">Shares P&L</span></div>
        <div className={active('/broker-rec')} onClick={() => nav('/broker-rec')}><i className="fas fa-handshake nav-icon"></i><span className="nav-label">Broker Rec</span></div>

        <div className="nav-section-label">Reconciliation</div>
        <div className={active('/party-rec')} onClick={() => nav('/party-rec')}><i className="fas fa-right-left nav-icon"></i><span className="nav-label">Party Ledger Rec</span></div>
        <div className={active('/bankrec')} onClick={() => nav('/bankrec')}><i className="fas fa-building-columns nav-icon"></i><span className="nav-label">Bank Reconciliation</span></div>

        <div className="nav-section-label">AI & Guides</div>
        <div className={active('/askca')} onClick={() => nav('/askca')}>
          <i className="fas fa-comments nav-icon"></i><span className="nav-label">Ask Your CA</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(201,168,76,0.15)', color: 'var(--gold-400)' }}>AI</span>
        </div>
        <div className={active('/journal')} onClick={() => nav('/journal')}><i className="fas fa-book-open nav-icon"></i><span className="nav-label">Journal Entry Guide</span></div>

        <div className="nav-section-label">Admin</div>
        <div className={active('/admin')} onClick={() => nav('/admin')}><i className="fas fa-sliders nav-icon"></i><span className="nav-label">Admin Panel</span></div>
      </nav>

      {/* Sign out */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => { localStorage.clear(); window.location.href = '/' }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer' }}>
          <i className="fas fa-arrow-right-from-bracket" style={{ color: '#2E4A62', fontSize: 13, width: 16 }}></i>
          <span style={{ fontSize: 12, color: '#2E4A62' }}>Sign out</span>
        </button>
      </div>

      {/* Add Company Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => { setShowAddModal(false); setAddError('') }}>
          <div className="modal-box" style={{ maxWidth: 360, padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16, color: '#f1f5f9' }}>Add Company</div>
            <input value={newName} onChange={e => { setNewName(e.target.value); setAddError('') }} onKeyDown={e => e.key === 'Enter' && addCompany()}
              type="text" placeholder="Company name (e.g. ABC Pvt Ltd)" autoFocus
              style={{ width: '100%', fontSize: 13, borderRadius: 12, padding: '12px 14px', marginBottom: addError ? 8 : 16, background: 'var(--navy-700)', border: `1px solid ${addError ? '#ef4444' : 'var(--navy-500)'}`, color: '#e2e8f0', outline: 'none' }} />
            {addError && <div style={{ color: '#f87171', fontSize: 11, marginBottom: 12 }}>{addError}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={addCompany} disabled={addLoading} className="btn-gold" style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 13, opacity: addLoading ? 0.7 : 1 }}>{addLoading ? 'Adding…' : 'Add'}</button>
              <button onClick={() => { setShowAddModal(false); setAddError('') }} className="btn-primary" style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 13 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
