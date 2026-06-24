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

function normalizeRow(row: any): { date: string; narration: string; amount: number } {
  const amount = Math.abs(Number(row.Amount || row.amount || row.Debit || row.debit || row.Credit || row.credit || 0))
  const narration = String(row.Narration || row.narration || row.Description || row.description || row.Particulars || '')
  const date = String(row.Date || row.date || '')
  return { date, narration, amount }
}

router.post('/', requireAuth, upload.fields([{ name: 'tally_file' }, { name: 'party_file' }]), async (req: AuthRequest, res) => {
  const files = req.files as Record<string, Express.Multer.File[]>
  const partyName = String(req.body.party_name || 'Party')

  if (!files?.tally_file?.[0] || !files?.party_file?.[0]) {
    return res.status(400).json({ error: 'Upload both Tally ledger and Party statement' })
  }

  const tallyRows = parseSheet(files.tally_file[0].buffer).map(normalizeRow).filter(r => r.amount > 0)
  const partyRows = parseSheet(files.party_file[0].buffer).map(normalizeRow).filter(r => r.amount > 0)

  const matched: any[] = []
  const only_tally: any[] = []
  const usedParty = new Set<number>()

  tallyRows.forEach(tr => {
    const idx = partyRows.findIndex((pr, i) =>
      !usedParty.has(i) && Math.abs(pr.amount - tr.amount) < 1
    )
    if (idx >= 0) {
      usedParty.add(idx)
      matched.push({ ...tr, source: 'Both' })
    } else {
      only_tally.push({ ...tr, source: 'Tally only' })
    }
  })

  const only_party = partyRows
    .filter((_, i) => !usedParty.has(i))
    .map(r => ({ ...r, source: 'Party only' }))

  const tally_total = tallyRows.reduce((s, r) => s + r.amount, 0)
  const party_total = partyRows.reduce((s, r) => s + r.amount, 0)
  const balance_diff = Math.round((tally_total - party_total) * 100) / 100
  const is_reconciled = only_tally.length === 0 && only_party.length === 0

  const fmt = (n: number) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
  const summary = `Party: ${partyName}. Matched: ${matched.length}. Only in Tally: ${only_tally.length}. Only in Party: ${only_party.length}. Balance diff: ${fmt(Math.abs(balance_diff))}.`
  const ai_insight = await callModel('You are a CA. Summarize this party ledger reconciliation in 2 lines with action items.', summary)

  res.json({ matched, only_tally, only_party, balance_diff, is_reconciled, ai_insight })
})

export default router
