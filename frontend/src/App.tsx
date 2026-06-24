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
import TDSDetect from './pages/TDSDetect'
import TDSAnalysis from './pages/TDSAnalysis'
import PTAnalysis from './pages/PTAnalysis'
import GSTReturn from './pages/GSTReturn'
import Compliance from './pages/Compliance'
import BalanceSheet from './pages/BalanceSheet'
import CashFlow from './pages/CashFlow'
import PartyRec from './pages/PartyRec'
import BankRec from './pages/BankRec'
import BrokerRec from './pages/BrokerRec'
import SharesPnL from './pages/SharesPnL'
import Admin from './pages/Admin'
import JournalGuide from './pages/JournalGuide'
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
          <Route path="/balance-sheet" element={<BalanceSheet />} />
          <Route path="/cash-flow" element={<CashFlow />} />
          <Route path="/tds-detect" element={<TDSDetect />} />
          <Route path="/gst-return" element={<GSTReturn />} />
          <Route path="/tds" element={<TDSAnalysis />} />
          <Route path="/pt-analysis" element={<PTAnalysis />} />
          <Route path="/compliance" element={<Compliance />} />
          <Route path="/shares-pnl" element={<SharesPnL />} />
          <Route path="/broker-rec" element={<BrokerRec />} />
          <Route path="/party-rec" element={<PartyRec />} />
          <Route path="/bankrec" element={<BankRec />} />
          <Route path="/journal" element={<JournalGuide />} />
          <Route path="/admin" element={<Admin />} />
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
