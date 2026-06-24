import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getClient, BUCKET } from '../db/supabase'
import { callModel } from '../ai/openrouter'
import { parseTallyTrialBalance } from '../engines/tallyParser'

const router = Router()

const TDS_RULES = [
  { keyword: /contractor|contract|labour|job work/i, section: '194C', rate: 1, desc: 'Contractor payments', threshold: 30000 },
  { keyword: /professional|consultant|legal|ca |chartered|advocate|doctor/i, section: '194J', rate: 10, desc: 'Professional/Technical fees', threshold: 30000 },
  { keyword: /rent|lease|hire/i, section: '194I', rate: 10, desc: 'Rent payments', threshold: 240000 },
  { keyword: /commission|brokerage/i, section: '194H', rate: 5, desc: 'Commission/Brokerage', threshold: 15000 },
  { keyword: /interest/i, section: '194A', rate: 10, desc: 'Interest payments', threshold: 5000 },
]

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const cid = req.companyId!
  const sb = getClient()
  const { data: metaRow } = await sb.from('files_meta').select('meta').eq('company_id', cid).single()
  const meta = metaRow?.meta ?? {}
  if (!meta.trial_balance_path) return res.status(400).json({ error: 'Upload Trial Balance first' })

  const { data: fileData } = await sb.storage.from(BUCKET).download(meta.trial_balance_path)
  if (!fileData) return res.status(500).json({ error: 'Failed to download file' })

  const buf = Buffer.from(await fileData.arrayBuffer())
  const { ledgers } = parseTallyTrialBalance(buf)

  const ledgerTotals: Record<string, { total: number; hasTDS: boolean }> = {}
  ledgers.forEach(l => {
    if (l.debit <= 0) return
    if (!ledgerTotals[l.name]) ledgerTotals[l.name] = { total: 0, hasTDS: false }
    ledgerTotals[l.name].total += l.debit
    if (/tds|tax deducted/i.test(l.name)) {
      const parent = Object.keys(ledgerTotals).find(k => k !== l.name)
      if (parent) ledgerTotals[parent].hasTDS = true
    }
  })

  const items: any[] = []
  Object.entries(ledgerTotals).forEach(([ledger, { total, hasTDS }]) => {
    const rule = TDS_RULES.find(r => r.keyword.test(ledger))
    if (!rule || total < rule.threshold) return
    const tds_due = Math.round(total * rule.rate / 100)
    const interest_est = Math.round(tds_due * 1.5 / 100 * 3)
    items.push({
      ledger, section: rule.section, description: rule.desc,
      total_paid: total, rate: rule.rate, tds_due, interest_est,
      tds_already_deducted: hasTDS,
      action: hasTDS ? 'TDS deducted correctly' : `File TDS return u/s ${rule.section}. Deposit ₹${tds_due.toLocaleString('en-IN')} + interest. Use Challan 281.`,
    })
  })

  const missed = items.filter(i => !i.tds_already_deducted)
  const total_exposure = missed.reduce((s, i) => s + i.tds_due, 0)
  const total_interest = missed.reduce((s, i) => s + i.interest_est, 0)

  const summary = `${missed.length} missed TDS deductions. Total exposure: ${fmt(total_exposure)}. Interest: ${fmt(total_interest)}.`
  const ai_insight = await callModel('You are a senior CA in India. Answer in plain text only, no markdown, no stars. Maximum 2 lines.', summary)

  res.json({ items, missed_count: missed.length, total_exposure, total_interest, ai_insight })
})

router.get('/', requireAuth, async (_req, res) => res.json({ items: [], missed_count: 0, total_exposure: 0, total_interest: 0 }))

export default router
