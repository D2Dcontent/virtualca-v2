import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'

import authRoutes from './routes/auth'
import dashboardRoutes from './routes/dashboard'
import companyRoutes from './routes/companies'
import uploadRoutes from './routes/upload'
import auditRoutes from './routes/audit'
import askcaRoutes from './routes/askca'

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/companies', companyRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/files', uploadRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/ca-chat', askcaRoutes)

// Serve React frontend in production
const BUILD_DIR = path.join(process.cwd(), 'public')
app.use(express.static(BUILD_DIR))
app.get('*', (_req, res) => res.sendFile(path.join(BUILD_DIR, 'index.html')))

app.listen(PORT, () => {
  console.log(`VirtualCA V2 running on port ${PORT}`)
})
