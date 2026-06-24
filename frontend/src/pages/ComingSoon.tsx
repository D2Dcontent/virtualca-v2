interface Props { title: string; icon: string }

export default function ComingSoon({ title, icon }: Props) {
  return (
    <div className="coming-soon-page">
      <i className={`fas ${icon}`} style={{ fontSize: 40, color: '#1E3A5F' }}></i>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#334155' }}>{title}</div>
      <div style={{ fontSize: 13, color: '#1E3A5F' }}>Coming in a future phase</div>
    </div>
  )
}
