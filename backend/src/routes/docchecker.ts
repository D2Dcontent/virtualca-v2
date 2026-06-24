import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getClient, BUCKET } from '../db/supabase'
import { callModel } from '../ai/openrouter'
import * as XLSX from 'xlsx'

const router = Router()

function fmt(n: number) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

function checkEntry(row: any): { risk: string; issue: string } | null {
  const narration = String(row.Narration || row.narration || row.Description || '').toLowerCase()
  const ledger = String(row.Ledger || row.ledger || row['Ledger Name'] || '').toLowerCase()
  const amount = Number(row.Amount || row.amount || row.Debit || row.debit || 0)

  if (amount <= 0) return null

  const hasDoc = /bill|invoice|receipt|voucher|ref|no\.|#\d|inv/.test(narration)
  if (hasDoc) return null

  const isExpense = /expense|purchase|payment|wages|salary|rent|professional|repair|maintenance|printing|travelling|freight|commission/.test(ledger + ' ' + narration)
  if (!isExpense) return null

  const risk = amount >= 100000 ? 'high' : amount >= 10000 ? 'medium' : 'low'
  const issue = amount >= 100000 ? 'Large expense — bill mandatory u/s 37(1)' : 'No bill/invoice reference found'
  return { risk, issue }
}

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const cid = req.companyId!
  const sb = getClient()

  const { data: metaRow } = await sb.from('files_meta').select('meta').eq('company_id', cid).single()
  const meta = metaRow?.meta ?? {}

  if (!meta.daybook_path && !meta.trial_balance_path) {
    return res.status(400).json({ error: 'Upload Daybook or Trial Balance first' })
  }

  const path = meta.daybook_path || meta.trial_balance_path
  const { data: fileData, error } = await sb.storage.from(BUCKET).download(path)
  if (error || !fileData) return res.status(500).json({ error: 'Failed to download file' })

  const buf = Buffer.from(await fileData.arrayBuffer())
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: any[] = XLSX.utils.sheet_to_json(ws)

  const flagged: any[] = []
  let documented = 0

  rows.forEach(row => {
    const result = checkEntry(row)
    const amount = Number(row.Amount || row.amount || row.Debit || row.debit || 0)
    if (amount <= 0) return
    if (result) {
      flagged.push({
        date: row.Date || row.date || '',
        ledger: row.Ledger || row['Ledger Name'] || row.ledger || '',
        narration: row.Narration || row.narration || row.Description || '',
        amount,
        risk: result.risk,
        issue: result.issue,
      })
    } else {
      documented++
    }
  })

  const highRisk = flagged.filter(f => f.risk === 'high')
  const totalAtRisk = flagged.reduce((s, f) => s + f.amount, 0)

  const context = `${flagged.length} entries flagged for missing documents. High risk: ${highRisk.length}. Total amount at risk: ${fmt(totalAtRisk)}. Top entries: ${flagged.slice(0, 3).map(f => `${f.ledger} ${fmt(f.amount)} (${f.risk})`).join(', ')}`
  const aiInsight = await callModel(`You are a CA. Summarize this missing docs audit in 2 lines. ${context}`)

  res.json({
    flagged,
    high_risk_count: highRisk.length,
    total_amount_at_risk: totalAtRisk,
    documented,
    ai_insight: aiInsight,
  })
})

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  res.json({ flagged: [], high_risk_count: 0, total_amount_at_risk: 0, documented: 0 })
})

export default router
