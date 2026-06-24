import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getClient, BUCKET } from '../db/supabase'
import { callModel } from '../ai/openrouter'
import * as XLSX from 'xlsx'

const router = Router()

const GST_RATES = [0, 5, 12, 18, 28]

function detectGSTRate(ledger: string): number {
  const l = ledger.toLowerCase()
  if (/exempt|nil|zero/.test(l)) return 0
  if (/5%|five percent/.test(l)) return 5
  if (/12%|twelve/.test(l)) return 12
  if (/28%|twenty.?eight/.test(l)) return 28
  return 18 // default
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

  const sales_entries: any[] = []
  const purchase_entries: any[] = []
  const missing_gstin: string[] = []

  rows.forEach(row => {
    const ledger = String(row.Ledger || row['Ledger Name'] || row.ledger || '')
    const narration = String(row.Narration || row.narration || row.Description || '')
    const amount = Number(row.Credit || row.credit || row.Amount || 0)
    const debit = Number(row.Debit || row.debit || 0)

    if (amount <= 0 && debit <= 0) return

    const isSales = /sales|revenue|income/.test(ledger.toLowerCase())
    const isPurchase = /purchase|buy|procure/.test(ledger.toLowerCase())

    if (!isSales && !isPurchase) return

    const rate = detectGSTRate(ledger)
    const taxable_value = isSales ? amount : debit
    const gst_amount = Math.round(taxable_value * rate / 100)
    const is_igst = /igst|interstate|inter-state/.test(narration.toLowerCase() + ledger.toLowerCase())
    const has_gstin = /\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}/.test(narration)

    if (isSales && !has_gstin && amount > 2500) missing_gstin.push(ledger)

    const entry = {
      ledger,
      taxable_value,
      rate,
      cgst: is_igst ? 0 : Math.round(gst_amount / 2),
      sgst: is_igst ? 0 : Math.round(gst_amount / 2),
      igst: is_igst ? gst_amount : 0,
      has_gstin,
    }

    if (isSales) sales_entries.push(entry)
    else purchase_entries.push(entry)
  })

  const outward_taxable = sales_entries.reduce((s, e) => s + e.taxable_value, 0)
  const outward_tax = sales_entries.reduce((s, e) => s + e.cgst + e.sgst + e.igst, 0)
  const itc_available = purchase_entries.reduce((s, e) => s + e.cgst + e.sgst + e.igst, 0)
  const cgst_payable = sales_entries.reduce((s, e) => s + e.cgst, 0) - Math.round(itc_available / 2)
  const sgst_payable = sales_entries.reduce((s, e) => s + e.sgst, 0) - Math.round(itc_available / 2)
  const igst_payable = sales_entries.reduce((s, e) => s + e.igst, 0)
  const net_payable = Math.max(0, cgst_payable + sgst_payable + igst_payable)

  const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
  const summary = `Sales entries: ${sales_entries.length}. Net GST payable: ${fmt(net_payable)}. Missing GSTIN: ${missing_gstin.length}.`
  const ai_insight = await callModel('You are a CA. Summarize this GST analysis in 2 lines with key actions.', summary)

  res.json({
    total_sales_entries: sales_entries.length,
    net_gst_payable: net_payable,
    missing_gstin: [...new Set(missing_gstin)],
    sales_entries,
    purchase_entries,
    gstr3b: { outward_taxable, outward_tax, itc_available, cgst_payable: Math.max(0, cgst_payable), sgst_payable: Math.max(0, sgst_payable), igst_payable, net_payable },
    ai_insight,
  })
})

router.get('/', requireAuth, async (_req, res) => res.json({ total_sales_entries: 0, net_gst_payable: 0, missing_gstin: [], sales_entries: [], purchase_entries: [], gstr3b: {} }))

export default router
