import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getClient, BUCKET } from '../db/supabase'
import { callModel } from '../ai/openrouter'
import * as XLSX from 'xlsx'

const router = Router()

const WB_SLABS = [
  { range: 'Up to ₹10,000/month', pt: '₹0' },
  { range: '₹10,001 – ₹15,000/month', pt: '₹110' },
  { range: '₹15,001 – ₹25,000/month', pt: '₹130' },
  { range: '₹25,001 – ₹40,000/month', pt: '₹150' },
  { range: 'Above ₹40,000/month', pt: '₹200' },
]

function ptForSalary(monthly: number): number {
  if (monthly <= 10000) return 0
  if (monthly <= 15000) return 110
  if (monthly <= 25000) return 130
  if (monthly <= 40000) return 150
  return 200
}

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const cid = req.companyId!
  const sb = getClient()
  const { data: metaRow } = await sb.from('files_meta').select('meta').eq('company_id', cid).single()
  const meta = metaRow?.meta ?? {}
  if (!meta.trial_balance_path) return res.status(400).json({ error: 'Upload Trial Balance first' })

  const { data: fileData } = await sb.storage.from(BUCKET).download(meta.trial_balance_path)
  if (!fileData) return res.status(500).json({ error: 'Failed to download file' })

  const buf = Buffer.from(await fileData.arrayBuffer())
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: any[] = XLSX.utils.sheet_to_json(ws)

  let salaryTotal = 0
  let ptDeducted = 0
  const monthMap: Record<string, { salary: number; pt: number }> = {}

  rows.forEach(row => {
    const ledger = String(row.Ledger || row['Ledger Name'] || row.ledger || '').toLowerCase()
    const amount = Number(row.Amount || row.Debit || row.debit || 0)
    if (amount <= 0) return
    if (/salary|wages|staff|payroll/.test(ledger)) salaryTotal += amount
    if (/professional tax|pt payable|pt deducted/.test(ledger)) ptDeducted += amount
    const dateStr = String(row.Date || row.date || '')
    if (dateStr && /salary|wages/.test(ledger)) {
      const d = new Date(dateStr)
      if (!isNaN(d.getTime())) {
        const key = d.toLocaleString('en-IN', { month: 'short', year: 'numeric' })
        if (!monthMap[key]) monthMap[key] = { salary: 0, pt: 0 }
        monthMap[key].salary += amount
      }
    }
  })

  const months = Object.entries(monthMap).map(([month, { salary, pt }]) => {
    const monthly = salary
    const pt_expected = ptForSalary(monthly / 4)
    return { month, salary_paid: salary, pt_expected: pt_expected * 4, pt_deducted: pt, shortfall: Math.max(0, pt_expected * 4 - pt) }
  })

  const pt_expected = ptForSalary(salaryTotal / 12) * 12
  const pt_shortfall = Math.max(0, pt_expected - ptDeducted)
  const pt_unpaid_govt = ptDeducted > 0 ? 0 : pt_expected

  const findings: any[] = []
  if (pt_shortfall > 0) findings.push({ severity: 'Critical', issue: `PT shortfall of ₹${pt_shortfall.toLocaleString('en-IN')} detected. PT not fully deducted from employee salaries.`, impact: 'Penalty under WB PT Act 1979 — 2% interest per month on late deposit.', law: 'West Bengal PT Act 1979, Section 7' })
  if (ptDeducted === 0 && salaryTotal > 0) findings.push({ severity: 'Important', issue: 'No PT deduction entries found in the ledger.', impact: 'Either PT is not being deducted or ledger naming differs. Check "Professional Tax Payable" ledger.', law: 'WB PT Act 1979' })

  const summary = `Salary total: ₹${salaryTotal.toLocaleString('en-IN')}. PT deducted: ₹${ptDeducted.toLocaleString('en-IN')}. Shortfall: ₹${pt_shortfall.toLocaleString('en-IN')}.`
  const ai_insight = await callModel('You are a CA specializing in WB Professional Tax. Summarize this PT analysis in 2 lines.', summary)

  res.json({ pt_shortfall, pt_unpaid_govt, pt_deducted: ptDeducted, findings, months, wbslabs: WB_SLABS, ai_insight })
})

router.get('/', requireAuth, async (_req, res) => res.json({ pt_shortfall: 0, pt_unpaid_govt: 0, pt_deducted: 0, findings: [], months: [], wbslabs: WB_SLABS }))

export default router
