import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getClient, BUCKET } from '../db/supabase'
import { callModel } from '../ai/openrouter'
import * as XLSX from 'xlsx'

const router = Router()

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

// AS-3 Cash Flow classification by ledger group
const OPERATING_IN = /sales|revenue|income|receipts from customers/i
const OPERATING_OUT = /purchase|expenses|wages|salary|rent|professional|repair|maintenance|printing|travelling|freight|commission|power|telephone|conveyance/i
const INVESTING_IN = /sale of asset|sale of investment|interest received|dividend received/i
const INVESTING_OUT = /purchase of asset|capital expenditure|fixed asset|investment made/i
const FINANCING_IN = /capital introduced|loan received|bank loan|term loan|unsecured loan/i
const FINANCING_OUT = /loan repaid|drawings|repayment|interest paid on loan/i
const CASH_LEDGERS = /cash.in.hand|bank account|bank od/i

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const cid = req.companyId!
  const sb = getClient()
  const { data: metaRow } = await sb.from('files_meta').select('meta').eq('company_id', cid).single()
  const meta = metaRow?.meta ?? {}
  if (!meta.daybook_path && !meta.trial_balance_path) return res.status(400).json({ error: 'Upload Daybook or Trial Balance first' })

  const path = meta.daybook_path || meta.trial_balance_path
  const { data: fileData } = await sb.storage.from(BUCKET).download(path)
  if (!fileData) return res.status(500).json({ error: 'Failed to download file' })

  const buf = Buffer.from(await fileData.arrayBuffer())
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: any[] = XLSX.utils.sheet_to_json(ws)

  let opening_cash = 0
  const operating = { inflows: [] as any[], outflows: [] as any[], net: 0 }
  const investing = { inflows: [] as any[], outflows: [] as any[], net: 0 }
  const financing = { inflows: [] as any[], outflows: [] as any[], net: 0 }

  rows.forEach(row => {
    const ledger = String(row.Ledger || row['Ledger Name'] || row.ledger || '')
    const group = String(row.Group || row.group || '')
    const debit = Number(row.Debit || row.debit || 0)
    const credit = Number(row.Credit || row.credit || 0)
    const amount = Math.max(debit, credit)
    if (!ledger || amount === 0) return

    const key = (ledger + ' ' + group).toLowerCase()

    if (CASH_LEDGERS.test(key)) {
      opening_cash += credit - debit
      return
    }

    if (OPERATING_IN.test(key) && credit > 0) {
      operating.inflows.push({ label: ledger, amount: credit })
    } else if (OPERATING_OUT.test(key) && debit > 0) {
      operating.outflows.push({ label: ledger, amount: debit })
    } else if (INVESTING_IN.test(key) && credit > 0) {
      investing.inflows.push({ label: ledger, amount: credit })
    } else if (INVESTING_OUT.test(key) && debit > 0) {
      investing.outflows.push({ label: ledger, amount: debit })
    } else if (FINANCING_IN.test(key) && credit > 0) {
      financing.inflows.push({ label: ledger, amount: credit })
    } else if (FINANCING_OUT.test(key) && debit > 0) {
      financing.outflows.push({ label: ledger, amount: debit })
    }
  })

  operating.net = operating.inflows.reduce((s, i) => s + i.amount, 0) - operating.outflows.reduce((s, i) => s + i.amount, 0)
  investing.net = investing.inflows.reduce((s, i) => s + i.amount, 0) - investing.outflows.reduce((s, i) => s + i.amount, 0)
  financing.net = financing.inflows.reduce((s, i) => s + i.amount, 0) - financing.outflows.reduce((s, i) => s + i.amount, 0)

  const net_cash_flow = operating.net + investing.net + financing.net
  const closing_cash = opening_cash + net_cash_flow

  const summary = `Cash Flow: Operating ${fmt(operating.net)}, Investing ${fmt(investing.net)}, Financing ${fmt(financing.net)}. Net flow: ${fmt(net_cash_flow)}. Closing cash: ${fmt(closing_cash)}.`
  const ai_insight = await callModel('You are a CA. Summarize this Cash Flow Statement (AS-3) in 2 lines with key observations.', summary)

  res.json({ opening_cash, operating, investing, financing, net_cash_flow, closing_cash, ai_insight })
})

router.get('/', requireAuth, async (_req, res) => res.json({}))

export default router
