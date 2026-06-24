import * as XLSX from 'xlsx'

export interface Ledger {
  name: string; group: string; debit: number; credit: number; balance: number
}

export interface DaybookRow {
  date: string; particulars: string; vchType: string; vchNo: string
  debit: number; credit: number; vid: number
}

const SKIP = new Set(['nan','particulars','grand total','debit','credit',
  'closing balance','trial balance','opening balance','','name','ledger'])

const LEVEL1 = new Set(['capital account','loans (liability)','fixed assets','investments',
  'current assets','current liabilities','direct incomes','indirect incomes','sales accounts',
  'direct expenses','indirect expenses','purchase accounts','stock-in-hand',
  'branch / divisions','reserves & surplus','profit & loss a/c','misc. expenses (asset)'])

const LEVEL2 = new Set(['duties & taxes','sundry creditors','sundry debtors','cash-in-hand',
  'bank accounts','bank od a/c','loans & advances (asset)','deposits (asset)',
  'suspense a/c','suspense'])

export function parseTallyTrialBalance(buffer: Buffer): { ledgers: Ledger[]; company: string; period: string } {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]

  let dataStart = 0
  let company = ''
  let period = ''

  for (let i = 0; i < Math.min(25, raw.length); i++) {
    const vals = raw[i].map(v => String(v ?? '').trim().toLowerCase()).filter(Boolean)
    if (vals.includes('debit') || vals.includes('credit')) dataStart = i + 1
  }

  for (let i = 0; i < dataStart; i++) {
    const val = String(raw[i]?.[0] ?? '').trim()
    if (!val || SKIP.has(val.toLowerCase())) continue
    if (val.toLowerCase().includes(' to ') && /\d/.test(val)) { period = val; continue }
    const looksAddr = /road|floor|unit|street|nagar|colony|tower|building|plot|sector/i.test(val)
    const looksPin = /^\d{6}$/.test(val.replace(/\s/g, ''))
    if (!looksAddr && !looksPin && !company && val.length > 3) company = val
  }

  const ledgers: Ledger[] = []
  let currentGroup = ''
  let currentLevel1 = ''

  for (let i = dataStart; i < raw.length; i++) {
    const row = raw[i]
    const rawName = String(row[0] ?? '').trimEnd()
    const name = rawName.trim()
    if (!name || SKIP.has(name.toLowerCase())) continue
    const debit = parseFloat(String(row[1] ?? '0').replace(/,/g, '')) || 0
    const credit = parseFloat(String(row[2] ?? '0').replace(/,/g, '')) || 0
    const nl = name.toLowerCase()

    if (row[1] !== undefined && row[1] !== '' && isNaN(Number(String(row[1]).replace(/,/g, '')))) continue

    if (LEVEL1.has(nl)) { currentGroup = name; currentLevel1 = name; continue }
    if (LEVEL2.has(nl)) {
      if (debit !== 0 || credit !== 0)
        ledgers.push({ name, group: currentLevel1 || currentGroup || nl, debit, credit, balance: debit - credit })
      currentGroup = currentLevel1
      continue
    }
    ledgers.push({ name, group: currentGroup || currentLevel1 || '', debit, credit, balance: debit - credit })
  }

  return { ledgers, company: company || 'Company', period: period || 'FY 2025-26' }
}

const VOUCHER_TYPES = new Set(['Payment','Receipt','Journal','Contra','Sales','Purchase',
  'Credit Note','Debit Note','Memo'])

export function parseTallyDaybook(buffer: Buffer): DaybookRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]

  let headerRow = -1
  for (let i = 0; i < Math.min(15, raw.length); i++) {
    const vals = raw[i].map(v => String(v ?? '').trim().toLowerCase())
    if (vals.includes('date') && vals.includes('particulars')) { headerRow = i; break }
  }
  if (headerRow === -1) headerRow = 5

  const dataRows = raw.slice(headerRow + 1)
  const ncols = Math.max(...dataRows.slice(0, 10).map(r => r.length))

  const rows: DaybookRow[] = []
  let vid = 0
  let lastVchType = ''
  let lastVchNo = ''
  let lastDate = ''

  for (const row of dataRows) {
    if (!row || row.every((c: any) => !c)) continue
    const col = (n: number) => String(row[n] ?? '').trim()

    let date = col(0)
    let vchType = ''
    let vchNo = ''
    let particulars = ''
    let debit = 0
    let credit = 0

    if (ncols >= 8) {
      vchType = col(1); vchNo = col(2); particulars = col(3)
      debit = parseFloat(col(6).replace(/,/g,'')) || 0
      credit = parseFloat(col(7).replace(/,/g,'')) || 0
    } else if (ncols === 7) {
      vchType = col(1); particulars = col(2); vchNo = col(3)
      debit = parseFloat(col(5).replace(/,/g,'')) || 0
      credit = parseFloat(col(6).replace(/,/g,'')) || 0
    } else {
      particulars = col(1)
      debit = parseFloat(col(3).replace(/,/g,'')) || 0
      credit = parseFloat(col(4).replace(/,/g,'')) || 0
    }

    if (!particulars || particulars.toLowerCase() === 'particulars') continue

    if (date && /\d/.test(date)) lastDate = date
    else date = lastDate

    if (VOUCHER_TYPES.has(vchType)) { lastVchType = vchType; lastVchNo = vchNo; vid++ }
    else if (!vchType) { vchType = lastVchType; vchNo = lastVchNo }

    if (debit === 0 && credit === 0) continue

    rows.push({ date, particulars, vchType, vchNo, debit, credit, vid })
  }

  return rows
}
