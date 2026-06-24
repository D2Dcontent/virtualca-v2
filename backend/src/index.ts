import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'

import authRoutes from './routes/auth'
import dashboardRoutes from './routes/dashboard'
import docCheckerRoutes from './routes/docchecker'
import companyRoutes from './routes/companies'
import uploadRoutes from './routes/upload'
import auditRoutes from './routes/audit'
import askcaRoutes from './routes/askca'
import tdsRoutes from './routes/tds'
import ptRoutes from './routes/ptanalysis'
import gstRoutes from './routes/gst'
import complianceRoutes from './routes/compliance'
import balancesheetRoutes from './routes/balancesheet'
import cashflowRoutes from './routes/cashflow'
import partyrecRoutes from './routes/partyrec'
import bankrecRoutes from './routes/bankrec'
import brokerrecRoutes from './routes/brokerrec'
import sharespnlRoutes from './routes/sharespnl'

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/doc-checker', docCheckerRoutes)
app.use('/api/companies', companyRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/files', uploadRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/ca-chat', askcaRoutes)
app.use('/api/tds-detect', tdsRoutes)
app.use('/api/pt-analysis', ptRoutes)
app.use('/api/gst-return', gstRoutes)
app.use('/api/compliance', complianceRoutes)
app.use('/api/balance-sheet', balancesheetRoutes)
app.use('/api/cash-flow', cashflowRoutes)
app.use('/api/party-rec', partyrecRoutes)
app.use('/api/bankrec', bankrecRoutes)
app.use('/api/broker-rec', brokerrecRoutes)
app.use('/api/shares-pnl', sharespnlRoutes)

// Serve React frontend in production
const BUILD_DIR = path.join(process.cwd(), 'public')
app.use(express.static(BUILD_DIR))
app.get('*', (_req, res) => res.sendFile(path.join(BUILD_DIR, 'index.html')))

app.listen(PORT, () => {
  console.log(`VirtualCA V2 running on port ${PORT}`)
})
