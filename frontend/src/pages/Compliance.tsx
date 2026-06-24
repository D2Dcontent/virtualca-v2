import { useEffect, useState } from 'react'
import API from '../api'

const STATUS_COLOR: Record<string, { text: string; bg: string; badge: string }> = {
  overdue: { text: '#f87171', bg: 'rgba(239,68,68,0.15)', badge: 'OVERDUE' },
  upcoming: { text: '#fbbf24', bg: 'rgba(245,158,11,0.15)', badge: 'UPCOMING' },
  done: { text: '#34d399', bg: 'rgba(52,211,153,0.12)', badge: '✓ DONE' },
}

export default function Compliance() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    API.get('/api/compliance').then(r => { setItems(r.data.items || []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const overdue = items.filter(i => i.status === 'overdue').length
  const upcoming = items.filter(i => i.status === 'upcoming').length
  const done = items.filter(i => i.status === 'done').length

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Overdue', count: overdue, color: '#DC2626', textColor: '#f87171' },
          { label: 'Due This Week', count: upcoming, color: '#D97706', textColor: '#fbbf24' },
          { label: 'On Track', count: done, color: '#15803D', textColor: '#34d399' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 12, padding: '16px 18px', borderTop: `2px solid ${s.color}` }}>
            <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ color: s.textColor, fontSize: 32, fontWeight: 700 }}>{s.count}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 16, padding: 24 }}>
        <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 14, marginBottom: 20 }}>Upcoming Due Dates — Real Time</div>
        {loading
          ? <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748b', fontSize: 13 }}>Loading...</div>
          : items.length === 0
          ? <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748b', fontSize: 13 }}>No compliance items found</div>
          : items.map((item, i) => {
            const s = STATUS_COLOR[item.status] || STATUS_COLOR.upcoming
            return (
              <div key={i} style={{ background: item.status === 'overdue' ? 'rgba(239,68,68,0.05)' : 'transparent', border: `1px solid ${item.status === 'overdue' ? 'rgba(239,68,68,0.2)' : 'var(--navy-600)'}`, borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textAlign: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18, lineHeight: 1, color: s.text }}>{item.day}</div>
                    <div style={{ fontSize: 11, color: s.text }}>{item.month}</div>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9' }}>{item.title}</span>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: s.bg, color: s.text }}>{s.badge}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{item.description}</div>
                  {item.note && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{item.note}</div>}
                </div>
                {item.status !== 'done' && (
                  <button style={{ padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 500, background: s.bg, color: s.text, border: `1px solid ${s.text}33`, cursor: 'pointer' }}>Mark Done</button>
                )}
                {item.status === 'done' && <span style={{ color: '#34d399', fontSize: 20 }}>✓</span>}
              </div>
            )
          })
        }
      </div>
    </div>
  )
}
