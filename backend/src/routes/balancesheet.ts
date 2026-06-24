import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getClient, BUCKET } from '../db/supabase'
import { callModel } from '../ai/openrouter'
import { parseTallyTrialBalance } from '../engines/tallyParser'

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

// Keyword fallback — classify by ledger NAME when group is missing
function classifyByName(name: string): { side: 'liability' | 'asset' | null; bucket: string } {
  const n = name.toLowerCase()

  // Cash & Bank
  if (/^cash$|cash in hand|petty cash/.test(n)) return { side: 'asset', bucket: 'Cash & Bank' }
  if (/icici|hdfc|axis|kotak|sbi|bank|a\/c\.|account no|credit card/.test(n)) return { side: 'asset', bucket: 'Cash & Bank' }

  // Trade Receivables
  if (/debtor|receivable/.test(n)) return { side: 'asset', bucket: 'Trade Receivables' }

  // Trade Payables
  if (/creditor|payable|supplier/.test(n)) return { side: 'liability', bucket: 'Trade Payables' }

  // Loans given out (asset)
  if (/advance to|loan to|advance given|staff advance/.test(n)) return { side: 'asset', bucket: 'Current Assets' }

  // Loans taken (liability)
  if (/loan from|loan taken|borrowed|anjali.*loan|laddha.*loan/.test(n)) return { side: 'liability', bucket: 'Long-Term Borrowings' }

  // Fixed Assets
  if (/furniture|fixture|equipment|machinery|computer|vehicle|laptop|office asset|leasehold/.test(n)) return { side: 'asset', bucket: 'Fixed Assets' }

  // Capital
  if (/capital|owner|proprietor/.test(n)) return { side: 'liability', bucket: 'Equity & Capital' }

  // Expenses (P&L — go to Current Liabilities if credit, Current Assets if debit)
  if (/expense|rent|salary|wages|commission paid|discount allowed|food|hotel|travel|printing|telephone|electricity|power|repair|maintenance|professional fee|consulta|legal|audit fee|advertisement/.test(n)) {
    return { side: 'asset', bucket: 'Prepaid & Other Assets' }  // debit balance expenses
  }

  // Income / Revenue
  if (/income|revenue|sales|receipt|training|service/.test(n)) return { side: 'liability', bucket: 'Equity & Capital' }

  // GST / Tax
  if (/gst|tds|tax|duty|igst|cgst|sgst|tcs/.test(n)) return { side: 'liability', bucket: 'Current Liabilities' }

  return { side: null, bucket: '' }
}

function classify(group: string, name: string): { side: 'liability' | 'asset' | null; bucket: string } {
  const g = group.toLowerCase().trim()

  // Try group first
  for (const [k, v] of Object.entries(LIAB_MAP)) {
    if (g.includes(k)) return { side: 'liability', bucket: v }
  }
  for (const [k, v] of Object.entries(ASSET_MAP)) {
    if (g.includes(k)) return { side: 'asset', bucket: v }
  }

  // Fallback: classify by ledger name keywords
  return classifyByName(name)
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
  const { ledgers, company, period } = parseTallyTrialBalance(buf)

  const liabilities: Record<string, { total: number; items: { ledger: string; balance: number }[] }> = {}
  const assets: Record<string, { total: number; items: { ledger: string; balance: number }[] }> = {}
  const unclassified: { ledger: string; group: string; balance: number }[] = []

  ledgers.forEach(l => {
    const { side, bucket } = classify(l.group, l.name)
    const balance = Math.abs(l.balance)
    if (!balance) return

    if (side === 'liability') {
      if (!liabilities[bucket]) liabilities[bucket] = { total: 0, items: [] }
      liabilities[bucket].total += balance
      liabilities[bucket].items.push({ ledger: l.name, balance })
    } else if (side === 'asset') {
      if (!assets[bucket]) assets[bucket] = { total: 0, items: [] }
      assets[bucket].total += balance
      assets[bucket].items.push({ ledger: l.name, balance })
    } else if (balance > 0) {
      unclassified.push({ ledger: l.name, group: l.group || 'No group', balance })
    }
  })

  const total_assets = Object.values(assets).reduce((s, b) => s + b.total, 0)
  const total_liabilities = Object.values(liabilities).reduce((s, b) => s + b.total, 0)
  const difference = Math.abs(total_assets - total_liabilities)
  const tallied = difference < 10

  const summary = `Company: ${company}. Period: ${period}. Balance Sheet: Total Assets ${fmt(total_assets)}, Total Liabilities+Equity ${fmt(total_liabilities)}. ${tallied ? 'Tallied.' : `Difference: ${fmt(difference)}.`} Unclassified: ${unclassified.length} ledgers.`
  const ai_insight = await callModel('You are a senior CA in India. Answer in plain text only, no markdown, no stars. Maximum 2 lines.', summary)

  res.json({ liabilities, assets, total_assets, total_liabilities, difference, tallied, unclassified, ai_insight, company, period })
})

router.get('/', requireAuth, async (_req, res) => res.json({}))

export default router
