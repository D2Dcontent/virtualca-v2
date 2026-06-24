import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getClient, BUCKET } from '../db/supabase'
import { callModel } from '../ai/openrouter'
import { parseTallyTrialBalance } from '../engines/tallyParser'

const router = Router()

function detectGSTRate(ledger: string): number {
  const l = ledger.toLowerCase()
  if (/exempt|nil|zero/.test(l)) return 0
  if (/5%|five percent/.test(l)) return 5
  if (/12%|twelve/.test(l)) return 12
  if (/28%|twenty.?eight/.test(l)) return 28
  return 18
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
  const { ledgers } = parseTallyTrialBalance(buf)

  const sales_entries: any[] = []
  const purchase_entries: any[] = []
  const missing_gstin: string[] = []

  ledgers.forEach(l => {
    const key = l.name.toLowerCase()
    const isSales = /sales|revenue|income/.test(key)
    const isPurchase = /purchase|buy|procure/.test(key)
    if (!isSales && !isPurchase) return

    const rate = detectGSTRate(l.name)
    const taxable_value = isSales ? l.credit : l.debit
    if (taxable_value <= 0) return

    const gst_amount = Math.round(taxable_value * rate / 100)
    const is_igst = /igst|interstate|inter-state/.test(key)

    if (isSales && taxable_value > 2500) missing_gstin.push(l.name)

    const entry = {
      ledger: l.name,
      taxable_value,
      rate,
      cgst: is_igst ? 0 : Math.round(gst_amount / 2),
      sgst: is_igst ? 0 : Math.round(gst_amount / 2),
      igst: is_igst ? gst_amount : 0,
      has_gstin: false,
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
  const summary = `Sales entries: ${sales_entries.length}. Outward taxable: ${fmt(outward_taxable)}. ITC available: ${fmt(itc_available)}. Net GST payable: ${fmt(net_payable)}.`
  const ai_insight = await callModel('You are a senior CA in India. Answer in plain text only, no markdown, no stars. Maximum 2 lines.', summary)

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
