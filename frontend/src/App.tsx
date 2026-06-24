import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Login from './pages/Login'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import QuickAudit from './pages/QuickAudit'
import AskCA from './pages/AskCA'
import History from './pages/History'
import FullAudit from './pages/FullAudit'
import DocChecker from './pages/DocChecker'
import ComingSoon from './pages/ComingSoon'

function Layout() {
  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--navy-900)' }}>
      <Sidebar />
      <div style={{ marginLeft: 256, flex: 1, overflowY: 'auto' }}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/quickaudit" element={<QuickAudit />} />
          <Route path="/askca" element={<AskCA />} />
          <Route path="/history" element={<History />} />
          <Route path="/fullaudit" element={<FullAudit />} />
          <Route path="/doc-checker" element={<DocChecker />} />
          <Route path="/balance-sheet" element={<ComingSoon title="Balance Sheet" icon="fa-scale-balanced" />} />
          <Route path="/cash-flow" element={<ComingSoon title="Cash Flow (AS-3)" icon="fa-water" />} />
          <Route path="/tds-detect" element={<ComingSoon title="TDS Detector" icon="fa-triangle-exclamation" />} />
          <Route path="/gst-return" element={<ComingSoon title="GST Returns" icon="fa-file-invoice" />} />
          <Route path="/tds" element={<ComingSoon title="TDS Analysis" icon="fa-percent" />} />
          <Route path="/pt-analysis" element={<ComingSoon title="PT Analysis" icon="fa-building-columns" />} />
          <Route path="/compliance" element={<ComingSoon title="Compliance Calendar" icon="fa-calendar-check" />} />
          <Route path="/shares-pnl" element={<ComingSoon title="Shares P&L" icon="fa-chart-line" />} />
          <Route path="/broker-rec" element={<ComingSoon title="Broker Rec" icon="fa-handshake" />} />
          <Route path="/party-rec" element={<ComingSoon title="Party Ledger Rec" icon="fa-right-left" />} />
          <Route path="/bankrec" element={<ComingSoon title="Bank Reconciliation" icon="fa-building-columns" />} />
          <Route path="/journal" element={<ComingSoon title="Journal Entry Guide" icon="fa-book-open" />} />
          <Route path="/admin" element={<ComingSoon title="Admin Panel" icon="fa-sliders" />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('token'))

  if (!authed) return <Login onLogin={() => setAuthed(true)} />

  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  )
}
