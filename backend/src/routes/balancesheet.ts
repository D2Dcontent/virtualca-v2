import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getClient, BUCKET } from '../db/supabase'
import { callModel } from '../ai/openrouter'
import * as XLSX from 'xlsx'

const router = Router()

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

// Tally group → Balance Sheet classification
const LIAB_MAP: Record<string, string> = {
  'capital account': 'Equity & Capital',
  "proprietor's account": 'Equity & Capital',
  'reserves & surplus': 'Equity & Capital',
  'reserves and surplus': 'Equity & Capital',
  'secured loans': 'Long-Term Borrowings',
  'unsecured loans': 'Long-Term Borrowings',
  'loans (liability)': 'Long-Term Borrowings',
  'bank od accounts': 'Short-Term Borrowings',
  'bank od a/c': 'Short-Term Borrowings',
  'current liabilities': 'Current Liabilities',
  'duties & taxes': 'Current Liabilities',
  'provisions': 'Current Liabilities',
  'sundry creditors': 'Trade Payables',
  'creditors': 'Trade Payables',
}

const ASSET_MAP: Record<string, string> = {
  'fixed assets': 'Fixed Assets',
  'plant & machinery': 'Fixed Assets',
  'furniture & fixtures': 'Fixed Assets',
  'investments': 'Investments',
  'sundry debtors': 'Trade Receivables',
  'debtors': 'Trade Receivables',
  'cash-in-hand': 'Cash & Bank',
  'cash in hand': 'Cash & Bank',
  'bank accounts': 'Cash & Bank',
  'current assets': 'Current Assets',
  'loans & advances (asset)': 'Current Assets',
  'loans & advances': 'Current Assets',
  'stock-in-hand': 'Inventories',
  'closing stock': 'Inventories',
}

function classify(group: string): { side: 'liability' | 'asset' | null; bucket: string } {
  const g = group.toLowerCase().trim()
  for (const [k, v] of Object.entries(LIAB_MAP)) {
    if (g.includes(k)) return { side: 'liability', bucket: v }
  }
  for (const [k, v] of Object.entries(ASSET_MAP)) {
    if (g.includes(k)) return { side: 'asset', bucket: v }
  }
  return { side: null, bucket: '' }
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

  const liabilities: Record<string, { total: number; items: { ledger: string; balance: number }[] }> = {}
  const assets: Record<string, { total: number; items: { ledger: string; balance: number }[] }> = {}
  const unclassified: { ledger: string; group: string; balance: number }[] = []

  rows.forEach(row => {
    const ledger = String(row.Ledger || row['Ledger Name'] || row['Account'] || row.ledger || '')
    const group = String(row.Group || row['Group Name'] || row.group || '')
    const closing = Number(row['Closing Balance'] || row.Closing || row.Balance || row.Credit || row.credit || 0) -
                    Number(row.Debit || row.debit || 0)
    if (!ledger || closing === 0) return

    const { side, bucket } = classify(group)
    const balance = Math.abs(closing)

    if (side === 'liability') {
      if (!liabilities[bucket]) liabilities[bucket] = { total: 0, items: [] }
      liabilities[bucket].total += balance
      liabilities[bucket].items.push({ ledger, balance })
    } else if (side === 'asset') {
      if (!assets[bucket]) assets[bucket] = { total: 0, items: [] }
      assets[bucket].total += balance
      assets[bucket].items.push({ ledger, balance })
    } else if (ledger && balance > 0) {
      unclassified.push({ ledger, group, balance })
    }
  })

  const total_assets = Object.values(assets).reduce((s, b) => s + b.total, 0)
  const total_liabilities = Object.values(liabilities).reduce((s, b) => s + b.total, 0)
  const difference = Math.abs(total_assets - total_liabilities)
  const tallied = difference < 10

  const summary = `Balance Sheet: Total Assets ${fmt(total_assets)}, Total Liabilities+Equity ${fmt(total_liabilities)}. ${tallied ? 'Tallied.' : `Difference: ${fmt(difference)}.`} Unclassified: ${unclassified.length} ledgers.`
  const ai_insight = await callModel('You are a CA. Summarize this Balance Sheet in 2 lines with key financial health observations.', summary)

  res.json({ liabilities, assets, total_assets, total_liabilities, difference, tallied, unclassified, ai_insight })
})

router.get('/', requireAuth, async (_req, res) => res.json({}))

export default router
