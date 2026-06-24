import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getClient, BUCKET } from '../db/supabase'
import { callModel } from '../ai/openrouter'
import { parseTallyDaybook } from '../engines/tallyParser'

const router = Router()

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

function parseDate(s: string): Date | null {
  if (!s) return null
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d
  // try DD-MM-YYYY or DD/MM/YYYY
  const parts = s.split(/[-\/]/)
  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number)
    if (c > 1000) return new Date(c, b - 1, a)
    if (a > 1000) return new Date(a, b - 1, c)
  }
  return null
}

function holdingMonths(buyDate: Date, sellDate: Date): number {
  return (sellDate.getFullYear() - buyDate.getFullYear()) * 12 +
    (sellDate.getMonth() - buyDate.getMonth())
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
  const { data: fileData } = await sb.storage.from(BUCKET).download(path)
  if (!fileData) return res.status(500).json({ error: 'Failed to download file' })

  const buf = Buffer.from(await fileData.arrayBuffer())
  const rows = parseTallyDaybook(buf)

  const buys: Record<string, { date: Date; qty: number; value: number }[]> = {}
  const sells: { scrip: string; date: Date; qty: number; value: number }[] = []

  rows.forEach(row => {
    const combined = (row.particulars + ' ' + row.vchType).toLowerCase()
    const date = parseDate(row.date)
    if (!date) return

    const scripMatch = row.particulars.match(/^([A-Z0-9&\s]+?)(?:\s+shares?|\s+stock|\s+eq|\s+nse)?$/i)
    const scrip = scripMatch ? scripMatch[1].trim().toUpperCase() : row.particulars.toUpperCase()

    const isBuy = /purchase|buy|bought/.test(combined) || (/shares?|stock|equity/i.test(combined) && row.debit > 0)
    const isSell = /sale|sell|sold/.test(combined) || (/shares?|stock|equity/i.test(combined) && row.credit > 0)

    if (isBuy && row.debit > 0 && /share|stock|equity|invest/i.test(combined)) {
      if (!buys[scrip]) buys[scrip] = []
      buys[scrip].push({ date, qty: 1, value: row.debit })
    } else if (isSell && row.credit > 0 && /share|stock|equity|invest/i.test(combined)) {
      sells.push({ scrip, date, qty: 1, value: row.credit })
    }
  })

  // FIFO matching
  const trades: any[] = []

  sells.forEach(sell => {
    const queue = buys[sell.scrip]
    if (!queue || queue.length === 0) return

    const buy = queue.shift()!
    const gain = sell.value - buy.value
    const months = holdingMonths(buy.date, sell.date)
    const isLTCG = months >= 12
    const type = gain < 0 ? 'LOSS' : isLTCG ? 'LTCG' : 'STCG'
    const tax = gain <= 0 ? 0 : isLTCG
      ? Math.max(0, gain - 100000) * 0.10   // LTCG: exempt up to 1L
      : gain * 0.15                            // STCG: flat 15%

    trades.push({
      scrip: sell.scrip,
      buy_date: buy.date.toLocaleDateString('en-IN'),
      sell_date: sell.date.toLocaleDateString('en-IN'),
      buy_value: buy.value,
      sell_value: sell.value,
      gain: Math.round(gain),
      holding_months: months,
      type,
      tax: Math.round(tax),
    })
  })

  const stcg_trades = trades.filter(t => t.type === 'STCG')
  const ltcg_trades = trades.filter(t => t.type === 'LTCG')
  const loss_trades = trades.filter(t => t.type === 'LOSS')

  const stcg_total = stcg_trades.reduce((s, t) => s + t.gain, 0)
  const ltcg_total = ltcg_trades.reduce((s, t) => s + t.gain, 0)
  const total_gain = stcg_total + ltcg_total + loss_trades.reduce((s, t) => s + t.gain, 0)
  const stcg_tax = stcg_trades.reduce((s, t) => s + t.tax, 0)
  const ltcg_tax = ltcg_trades.reduce((s, t) => s + t.tax, 0)
  const total_tax = stcg_tax + ltcg_tax

  const note = trades.length === 0
    ? 'No closed trades detected. Ensure daybook has buy/sell entries with "shares", "stock" or "equity" in ledger/narration.'
    : `FIFO method used. ${stcg_trades.length} STCG trades @ 15%, ${ltcg_trades.length} LTCG trades @ 10% (₹1L exempt). Add to ITR Schedule CG.`

  const summary = `Shares P&L: STCG ${fmt(stcg_total)} (tax ${fmt(stcg_tax)}), LTCG ${fmt(ltcg_total)} (tax ${fmt(ltcg_tax)}), Net gain ${fmt(total_gain)}, Total tax ${fmt(total_tax)}.`
  const ai_insight = await callModel('You are a CA. Summarize this Shares P&L in 2 lines with ITR filing guidance.', summary)

  res.json({ trades, stcg_total, stcg_tax, ltcg_total, ltcg_tax, total_gain, total_tax, note, ai_insight })
})

router.get('/', requireAuth, async (_req, res) => res.json({}))

export default router
