import { useState } from 'react'
import { uploadAPI, auditAPI } from '../api'

const FILE_FIELDS = [
  { key: 'trial_balance', label: 'Trial Balance', required: true, color: '#818cf8' },
  { key: 'daybook', label: 'Daybook', required: true, color: '#34d399' },
  { key: 'balance_sheet', label: 'Balance Sheet', required: false, color: '#60a5fa' },
  { key: 'profit_loss', label: 'Profit & Loss', required: false, color: '#f59e0b' },
  { key: 'bank_statement', label: 'Bank Statement', required: false, color: '#f87171' },
  { key: 'bank_tally', label: 'Bank Ledger (Tally)', required: false, color: '#a78bfa' },
]

export default function FullAudit() {
  const [files, setFiles] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)

  const uploadFile = async (key: string, file: File | null) => {
    if (!file) return
    const form = new FormData()
    form.append(key, file)
    await uploadAPI.uploadFiles(form)
    setFiles(prev => ({ ...prev, [key]: file.name }))
  }

  const runAudit = async () => {
    setLoading(true)
    try {
      const r = await auditAPI.run()
      setResults(r.data)
    } catch { alert('Error running audit') }
    setLoading(false)
  }

  const score = results?.score
  const scoreColor = score >= 75 ? '#34d399' : score >= 50 ? '#f59e0b' : '#f87171'
  const card = { background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 16 }

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {FILE_FIELDS.map(f => (
          <div key={f.key} style={{ ...card, padding: 16, border: `1px solid ${files[f.key] ? f.color + '55' : 'var(--navy-600)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{f.label}</span>
              {f.required && <span style={{ fontSize: 11, color: '#f87171' }}>*</span>}
              {files[f.key] && <span className="tag-ok" style={{ marginLeft: 'auto' }}>✓</span>}
            </div>
            <label className="upload-zone" htmlFor={f.key} style={{ display: 'block', borderRadius: 12, padding: 12, textAlign: 'center', cursor: 'pointer' }}>
              <i className={`fas fa-cloud-upload-alt`} style={{ color: f.color, fontSize: 18, display: 'block', marginBottom: 6 }}></i>
              <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>{files[f.key] || 'Drop Excel here'}</p>
              <input type="file" id={f.key} accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => uploadFile(f.key, e.target.files?.[0] || null)} />
              <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: f.color, color: '#070E1A' }}>Choose</span>
            </label>
          </div>
        ))}
      </div>

      {files.trial_balance && !loading && (
        <button onClick={runAudit} className="btn-gold" style={{ width: '100%', padding: '16px 0', borderRadius: 16, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
          <i className="fas fa-clipboard-check"></i> Run Full Audit
        </button>
      )}

      {loading && (
        <div style={{ ...card, padding: 32, textAlign: 'center' }}>
          <i className="fas fa-cog spin" style={{ color: 'var(--gold-400)', fontSize: 32, display: 'block', marginBottom: 12 }}></i>
          <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>Running full audit...</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>Analyzing all files. This may take 1–2 minutes.</div>
        </div>
      )}

      {results && (
        <div style={{ ...card, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 52, fontWeight: 900, color: scoreColor }}>{score}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Health Score</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>Full Audit Complete</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10 }}>{results.summary?.critical || 0} Critical · {results.summary?.warnings || 0} Warnings</div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: score + '%' }}></div></div>
            </div>
          </div>
          {results.ai_insight && (
            <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ color: '#a78bfa', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>🤖 CA AI INSIGHT</div>
              <div style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.6 }}>{results.ai_insight}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
