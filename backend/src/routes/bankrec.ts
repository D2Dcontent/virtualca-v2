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

function normalizeRow(row: any, source: string): any {
  const amount = Math.abs(Number(row.Amount || row.amount || row.Debit || row.debit || row.Credit || row.credit || row['Withdrawal Amt'] || row['Deposit Amt'] || 0))
  const narration = String(row.Narration || row.narration || row.Description || row.description || row.Particulars || row['Transaction Remarks'] || '')
  const date = String(row.Date || row.date || row['Value Date'] || row['Transaction Date'] || '')
  const dr_cr = row['Dr/Cr'] || row['dr_cr'] || (Number(row.Debit || row['Withdrawal Amt'] || 0) > 0 ? 'DR' : 'CR')
  return { date, narration, amount, dr_cr, source }
}

router.post('/', requireAuth, upload.fields([{ name: 'bank_file' }, { name: 'tally_file' }]), async (req: AuthRequest, res) => {
  const files = req.files as Record<string, Express.Multer.File[]>

  if (!files?.bank_file?.[0] || !files?.tally_file?.[0]) {
    return res.status(400).json({ error: 'Upload both Bank Statement and Tally Bank Ledger' })
  }

  const bankRows = parseSheet(files.bank_file[0].buffer).map(r => normalizeRow(r, 'Bank')).filter(r => r.amount > 0)
  const tallyRows = parseSheet(files.tally_file[0].buffer).map(r => normalizeRow(r, 'Tally')).filter(r => r.amount > 0)

  const matched: any[] = []
  const wrong_date: any[] = []
  const bank_only: any[] = []
  const tally_only: any[] = []
  const duplicates: any[] = []
  const usedTally = new Set<number>()

  // detect duplicates in tally
  const tallyAmounts = tallyRows.map(r => r.amount)
  tallyAmounts.forEach((amt, i) => {
    if (tallyAmounts.indexOf(amt) !== i) duplicates.push({ ...tallyRows[i], source: 'Tally duplicate' })
  })

  bankRows.forEach(br => {
    // exact match: amount + date
    const exactIdx = tallyRows.findIndex((tr, i) =>
      !usedTally.has(i) && Math.abs(tr.amount - br.amount) < 1 && tr.date === br.date
    )
    if (exactIdx >= 0) {
      usedTally.add(exactIdx)
      matched.push({ ...br, source: 'Matched' })
      return
    }
    // wrong date: same amount, different date
    const wrongIdx = tallyRows.findIndex((tr, i) =>
      !usedTally.has(i) && Math.abs(tr.amount - br.amount) < 1
    )
    if (wrongIdx >= 0) {
      usedTally.add(wrongIdx)
      wrong_date.push({ ...br, tally_date: tallyRows[wrongIdx].date, source: 'Wrong date in Tally' })
      return
    }
    bank_only.push({ ...br, source: 'Missing in Tally' })
  })

  tallyRows.forEach((tr, i) => {
    if (!usedTally.has(i)) tally_only.push({ ...tr, source: 'Extra in Tally' })
  })

  const summary = `Bank Rec: Matched ${matched.length}, Wrong date ${wrong_date.length}, Missing in Tally ${bank_only.length}, Extra in Tally ${tally_only.length}, Duplicates ${duplicates.length}.`
  const ai_insight = await callModel('You are a CA. Summarize this bank reconciliation in 2 lines with action items.', summary)

  res.json({
    matched, wrong_date, bank_only, tally_only, duplicates,
    summary: { matched: matched.length, wrong_date: wrong_date.length, bank_only: bank_only.length, tally_only: tally_only.length, duplicates: duplicates.length },
    ai_insight,
  })
})

router.get('/status', requireAuth, async (_req, res) => res.json({ bstmt_exists: false }))

export default router
