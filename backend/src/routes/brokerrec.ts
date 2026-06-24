import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { callModel } from '../ai/openrouter'
import * as XLSX from 'xlsx'
import multer from 'multer'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

function parseSheet(buf: Buffer): any[] {
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws)
}

function normalizeTally(row: any): any {
  return {
    date: String(row.Date || row.date || ''),
    scrip: String(row.Scrip || row.scrip || row.Stock || row.Ledger || row.ledger || '').toUpperCase(),
    qty: Number(row.Qty || row.qty || row.Quantity || 0),
    value: Math.abs(Number(row.Amount || row.amount || row.Value || 0)),
  }
}

function normalizeBroker(row: any, broker: string): any {
  // Handle different broker export formats
  const scrip = String(
    row['Symbol'] || row['ISIN'] || row['Scrip'] || row['Stock'] || row['instrument'] || ''
  ).toUpperCase().replace(/(-EQ|-BE|-NS)$/, '')
  const qty = Math.abs(Number(row['Qty'] || row['Quantity'] || row['qty'] || 0))
  const value = Math.abs(Number(
    row['Net Amount'] || row['Sell Value'] || row['Buy Value'] || row['Turnover'] || row['P&L'] || row['value'] || 0
  ))
  const date = String(row['Date'] || row['Trade Date'] || row['date'] || '')
  return { date, scrip, qty, value }
}

router.post('/', requireAuth, upload.fields([{ name: 'tally_file' }, { name: 'broker_file' }]), async (req: AuthRequest, res) => {
  const files = req.files as Record<string, Express.Multer.File[]>
  const broker = String(req.body.broker || 'zerodha')

  if (!files?.tally_file?.[0] || !files?.broker_file?.[0]) {
    return res.status(400).json({ error: 'Upload both Tally ledger and Broker statement' })
  }

  const tallyRows = parseSheet(files.tally_file[0].buffer).map(normalizeTally).filter(r => r.value > 0)
  const brokerRows = parseSheet(files.broker_file[0].buffer).map(r => normalizeBroker(r, broker)).filter(r => r.value > 0)

  const matched: any[] = []
  const unmatched: any[] = []
  const usedBroker = new Set<number>()

  tallyRows.forEach(tr => {
    const idx = brokerRows.findIndex((br, i) =>
      !usedBroker.has(i) &&
      (br.scrip.includes(tr.scrip) || tr.scrip.includes(br.scrip)) &&
      Math.abs(br.value - tr.value) / Math.max(br.value, 1) < 0.05
    )
    if (idx >= 0) {
      usedBroker.add(idx)
      matched.push({ ...tr, source: 'Tally' })
    } else {
      unmatched.push({ ...tr, source: 'Tally only' })
    }
  })

  brokerRows.forEach((br, i) => {
    if (!usedBroker.has(i)) unmatched.push({ ...br, source: 'Broker only' })
  })

  const tally_total = tallyRows.reduce((s, r) => s + r.value, 0)
  const broker_total = brokerRows.reduce((s, r) => s + r.value, 0)
  const value_diff = Math.round((tally_total - broker_total) * 100) / 100
  const is_reconciled = unmatched.length === 0

  const fmt = (n: number) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
  const summary = `Broker: ${broker}. Matched: ${matched.length}. Unmatched: ${unmatched.length}. Value diff: ${fmt(Math.abs(value_diff))}.`
  const ai_insight = await callModel('You are a CA. Summarize this broker reconciliation in 2 lines with action items.', summary)

  res.json({ matched_count: matched.length, unmatched_count: unmatched.length, unmatched, value_diff, is_reconciled, ai_insight })
})

export default router
