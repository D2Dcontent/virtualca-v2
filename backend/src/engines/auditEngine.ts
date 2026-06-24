import * as XLSX from 'xlsx'

// ── INTERFACES ────────────────────────────────────────────────────────────────
export interface Ledger {
  name: string; group: string; debit: number; credit: number; balance: number
}
export interface DaybookRow {
  date: string; particulars: string; vchType: string; vchNo: string
  debit: number; credit: number; vid: number
}
export interface AuditResult {
  summary: { company: string; period: string; score: number; critical: number; warnings: number; questions: number; total_ledgers: number; total_vouchers: number }
  ledger_classification: any[]
  cash_violations: any[]
  tds_compliance: any[]
  outstanding: any[]
  large_expenses: any[]
  loans: any[]
  bank_accounts: any[]
  salary_compliance: any[]
  fixed_assets: any[]
  ai_insight?: string
}

// ── THRESHOLDS (verified against Indian law 2024-25) ─────────────────────────
// Sec 40A(3): cash payment > ₹10,000 disallowed (₹35,000 for transporters)
// Sec 269ST: cash receipt > ₹2,00,000 — penalty 100% u/s 271DA
// Sec 269SS/269T: loan/deposit in cash > ₹20,000 — penalty 100%
// TDS 194C: contractor — 1% individual, 2% company; single ₹30k, annual ₹1,00,000
// TDS 194J: professional — 10%; technical service — 2%; annual ₹50,000
// TDS 194I: rent — 10% land/building, 2% plant/machinery; ₹50,000/month
// TDS 194H: commission — 2% (Finance Act 2024 reduced from 5%); annual ₹20,000
// TDS 194A: interest — 10%; annual ₹5,000
// PF: mandatory if 20+ employees; 12% of basic up to ₹15,000/month
// ESI: mandatory if 10+ employees; gross ≤ ₹21,000; employee 0.75%, employer 3.25%
// WB PT slabs: ≤10k=0, ≤15k=110, ≤25k=130, ≤40k=150, >40k=200

const TDS_RULES = [
  { section: '194C', desc: 'Contractor/Labour/Transport', rate: 1, annualLimit: 100000,
    keywords: ['contractor','construction','repair','maintenance','labour','labor','manpower',
      'transport','freight','cargo','logistics','fabricat','housekeeping','security guard',
      'catering','printing','packing','loading','unloading','courier','civil work'] },
  { section: '194J', desc: 'Professional/Technical Fees', rate: 10, annualLimit: 50000,
    keywords: ['professional fee','consultant','consulting','legal','advocate','lawyer',
      'doctor fee','technical fee','technical service','architect','engineer fee','ca fee',
      'cs fee','audit fee','accountant fee','royalty','software service','it service',
      'design fee','professional charges','technical charges','advisory'] },
  { section: '194I', desc: 'Rent', rate: 10, annualLimit: 600000,
    keywords: ['rent','office rent','shop rent','warehouse rent','godown rent','factory rent',
      'lease rent','hire charge','vehicle hire','machinery hire','equipment hire'] },
  { section: '194H', desc: 'Commission/Brokerage', rate: 2, annualLimit: 20000,
    keywords: ['commission','brokerage','agency fee','referral fee','marketing commission',
      'dealer commission','distributor commission'] },
  { section: '194A', desc: 'Interest on Loans', rate: 10, annualLimit: 5000,
    keywords: ['interest paid','interest on loan','interest on unsecured','interest on borrowing',
      'interest expense','loan interest'] },
]

const LEDGER_RULES = [
  { patterns: ['tds receivable','tds rec','income tax receivable'],
    correctGroup: 'Current Assets', wrongGroups: ['Duties & Taxes','Current Liabilities'],
    severity: 'Critical', rule: 'TDS receivable is money owed by Income Tax dept — it is a Current Asset, not a liability' },
  { patterns: ['tds payable','tax deducted at source'],
    correctGroup: 'Duties & Taxes', wrongGroups: ['Current Assets','Current Liabilities'],
    severity: 'Critical', rule: 'TDS Payable is a statutory liability — must be under Duties & Taxes' },
  { patterns: ['gst input','igst input','cgst input','sgst input','input tax credit','gst itc'],
    correctGroup: 'Current Assets', wrongGroups: ['Duties & Taxes'],
    severity: 'Critical', rule: 'GST Input Credit is recoverable from govt — it is a Current Asset' },
  { patterns: ['gst output','igst output','cgst output','sgst output','gst payable'],
    correctGroup: 'Duties & Taxes', wrongGroups: ['Current Assets'],
    severity: 'Critical', rule: 'GST Output is a statutory liability — must be under Duties & Taxes' },
  { patterns: ['interest received','bank interest','interest income'],
    correctGroup: 'Indirect Incomes', wrongGroups: ['Indirect Expenses','Direct Expenses'],
    severity: 'Critical', rule: 'Interest received is income — booking as expense understates profit' },
  { patterns: ['drawings','drawing'],
    correctGroup: 'Capital Account', wrongGroups: ['Indirect Expenses','Direct Expenses'],
    severity: 'Critical', rule: 'Drawings is reduction of capital — NOT a business expense (will be disallowed u/s 37 IT Act)' },
  { patterns: ['prepaid','prepaid expense','advance rent paid'],
    correctGroup: 'Current Assets', wrongGroups: ['Indirect Expenses','Direct Expenses'],
    severity: 'Critical', rule: 'Prepaid expense is an asset — the expense period has not yet arrived' },
  { patterns: ['credit card','hdfc card','icici card','sbi card'],
    correctGroup: 'Sundry Creditors', wrongGroups: ['Indirect Expenses','Direct Expenses'],
    severity: 'Critical', rule: 'Credit card outstanding is a liability (money owed to bank), not an expense' },
  { patterns: ['advance from customer','customer advance','advance receipt'],
    correctGroup: 'Current Liabilities', wrongGroups: ['Sundry Creditors'],
    severity: 'Review', rule: 'Customer advance is a liability — goods/service not yet delivered (AS 9)' },
  { patterns: ['security deposit','refundable deposit'],
    correctGroup: 'Loans & Advances (Asset)', wrongGroups: ['Fixed Assets','Indirect Expenses'],
    severity: 'Review', rule: 'Security deposit is refundable — it is a Loan & Advance (Asset), not Fixed Asset' },
  { patterns: ['salary payable','salary outstanding'],
    correctGroup: 'Current Liabilities', wrongGroups: ['Indirect Expenses'],
    severity: 'Review', rule: 'Salary payable is accrued liability — not an expense ledger' },
]

const WB_PT = (monthly: number) => {
  if (monthly <= 10000) return 0
  if (monthly <= 15000) return 110
  if (monthly <= 25000) return 130
  if (monthly <= 40000) return 150
  return 200
}

// ── TALLY TRIAL BALANCE PARSER ────────────────────────────────────────────────
// Tally TB export: no clean header row. Company name in row 0-2, period in row 2-4,
// column header row has "Debit" and "Credit" as cell values. Data starts after that.
// Columns: col[0]=name, col[1]=debit, col[2]=credit (by position)
export function parseTallyTrialBalance(buffer: Buffer): { ledgers: Ledger[]; company: string; period: string } {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]

  const SKIP = new Set(['nan','particulars','grand total','debit','credit',
    'closing balance','trial balance','opening balance','','name','ledger'])

  let dataStart = 0
  let company = ''
  let period = ''

  // Find where data starts — scan first 25 rows for "debit"/"credit" header row
  for (let i = 0; i < Math.min(25, raw.length); i++) {
    const vals = raw[i].map(v => String(v ?? '').trim().toLowerCase()).filter(Boolean)
    if (vals.includes('debit') || vals.includes('credit')) {
      dataStart = i + 1
    }
  }

  // Extract company and period from header rows
  for (let i = 0; i < dataStart; i++) {
    const val = String(raw[i]?.[0] ?? '').trim()
    if (!val || SKIP.has(val.toLowerCase())) continue
    if (val.toLowerCase().includes(' to ') && /\d/.test(val)) { period = val; continue }
    const looksAddr = /road|floor|unit|street|nagar|colony|tower|building|plot|sector/i.test(val)
    const looksPin = /^\d{6}$/.test(val.replace(/\s/g, ''))
    if (!looksAddr && !looksPin && !company && val.length > 3) company = val
  }

  const LEVEL1 = new Set(['capital account','loans (liability)','fixed assets','investments',
    'current assets','current liabilities','direct incomes','indirect incomes','sales accounts',
    'direct expenses','indirect expenses','purchase accounts','stock-in-hand',
    'branch / divisions','reserves & surplus','profit & loss a/c','misc. expenses (asset)'])
  const LEVEL2 = new Set(['duties & taxes','sundry creditors','sundry debtors','cash-in-hand',
    'bank accounts','bank od a/c','loans & advances (asset)','deposits (asset)',
    'suspense a/c','suspense'])

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

    // Skip non-numeric second column (sub-header rows)
    if (row[1] !== undefined && row[1] !== '' && isNaN(Number(String(row[1]).replace(/,/g, '')))) continue

    if (LEVEL1.has(nl)) {
      currentGroup = name; currentLevel1 = name; continue
    }
    if (LEVEL2.has(nl)) {
      if (debit !== 0 || credit !== 0) {
        ledgers.push({ name, group: currentLevel1 || currentGroup || nl, debit, credit, balance: debit - credit })
      }
      currentGroup = currentLevel1
      continue
    }
    const group = currentGroup || currentLevel1 || ''
    ledgers.push({ name, group, debit, credit, balance: debit - credit })
  }

  return { ledgers, company: company || 'Company', period: period || 'FY 2025-26' }
}

// ── TALLY DAYBOOK PARSER ──────────────────────────────────────────────────────
// Tally daybook: row 0-N has company/report info. Header row has "Date" and "Particulars".
// Tally exports in 6, 7, or 8 column formats. Voucher type only on first row of each voucher.
const VOUCHER_TYPES = new Set(['Payment','Receipt','Journal','Contra','Sales','Purchase',
  'Credit Note','Debit Note','Memo'])

export function parseTallyDaybook(buffer: Buffer): DaybookRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]

  // Find header row — row with "Date" and "Particulars"
  let headerRow = -1
  for (let i = 0; i < Math.min(15, raw.length); i++) {
    const vals = raw[i].map(v => String(v ?? '').trim().toLowerCase())
    if (vals.includes('date') && vals.includes('particulars')) { headerRow = i; break }
  }
  if (headerRow === -1) headerRow = 5

  const dataRows = raw.slice(headerRow + 1)
  const ncols = Math.max(...dataRows.slice(0, 10).map(r => r.length))

  // Map columns by position based on format detected
  // 8-col: Date(0) Particulars(1) ?(2) ?(3) VchType(4) VchNo(5) Debit(6) Credit(7)
  // 7-col: Date(0) Particulars(1) ?(2) VchType(3) VchNo(4) Debit(5) Credit(6)
  // 6-col: Date(0) Particulars(1) VchType(2) VchNo(3) Debit(4) Credit(5)
  const colMap = ncols >= 8 ? [0,1,4,5,6,7] : ncols === 7 ? [0,1,3,4,5,6] : [0,1,2,3,4,5]

  let vid = 0
  let currentVchType = ''
  const rows: DaybookRow[] = []

  for (const row of dataRows) {
    const particulars = String(row[colMap[1]] ?? '').trim()
    if (!particulars || particulars.toLowerCase() === 'nan') continue

    const rawDate = row[colMap[0]]
    const vchTypeRaw = String(row[colMap[2]] ?? '').trim()
    const debit = parseFloat(String(row[colMap[4]] ?? '0').replace(/,/g, '')) || 0
    const credit = parseFloat(String(row[colMap[5]] ?? '0').replace(/,/g, '')) || 0

    if (VOUCHER_TYPES.has(vchTypeRaw)) {
      vid++
      currentVchType = vchTypeRaw
    }

    let dateStr = ''
    if (rawDate instanceof Date) dateStr = rawDate.toISOString().slice(0, 10)
    else if (typeof rawDate === 'number') {
      const d = XLSX.SSF.parse_date_code(rawDate)
      dateStr = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
    } else dateStr = String(rawDate ?? '').trim()

    rows.push({ date: dateStr, particulars, vchType: currentVchType, vchNo: String(row[colMap[3]] ?? ''), debit, credit, vid })
  }
  return rows
}

// ── MODULE 1: LEDGER CLASSIFICATION ──────────────────────────────────────────
const EXPENSE_KEYWORDS = ['rent','salary','wages','commission','food','hotel','travel','conveyance',
  'telephone','electricity','power','printing','stationery','repair','maintenance','insurance',
  'advertisement','marketing','postage','freight','discount allowed','donation','subscription',
  'fee','fees','expense','expenses','audit fee','professional fee','consultant','legal',
  'petrol','diesel','fuel','vehicle','office expense','admin','general expense','misc']

const INCOME_KEYWORDS = ['sales','revenue','income','service income','consulting income',
  'commission received','interest received','rent received','dividend','discount received']

const BS_GROUPS = ['fixed assets','current assets','current liabilities','loans (liability)',
  'capital account','reserves','sundry debtors','sundry creditors','bank accounts',
  'cash-in-hand','investments','loans & advances','deposits']

function detectLedgerIssues(ledgers: Ledger[]) {
  const findings: any[] = []

  for (const l of ledgers) {
    const nl = l.name.toLowerCase()
    const grp = (l.group || '').toLowerCase()

    // Check known rule patterns first
    for (const rule of LEDGER_RULES) {
      if (rule.patterns.some(p => nl.includes(p))) {
        if (rule.wrongGroups.some(wg => grp.includes(wg.toLowerCase()))) {
          findings.push({
            severity: rule.severity, ledger: l.name, current_group: l.group,
            correct_group: rule.correctGroup, balance: Math.abs(l.balance), rule: rule.rule,
            law: 'Schedule III Companies Act 2013 — items must be correctly classified between Balance Sheet and P&L',
            fix: `Gateway of Tally → Accounts Info → Ledgers → Alter → ${l.name} → Change Group to "${rule.correctGroup}" → Save → Re-export Trial Balance`,
          })
        }
        break
      }
    }

    // Detect expenses sitting in Balance Sheet groups (causes BS difference)
    const isExpense = EXPENSE_KEYWORDS.some(k => nl.includes(k))
    const inBSGroup = BS_GROUPS.some(g => grp.includes(g))
    const hasDebitBal = l.debit > 0 && l.balance > 0

    if (isExpense && inBSGroup && hasDebitBal && grp && !grp.includes('advance') && !grp.includes('prepaid')) {
      // Not already caught by LEDGER_RULES
      const alreadyCaught = LEDGER_RULES.some(r => r.patterns.some(p => nl.includes(p)))
      if (!alreadyCaught) {
        findings.push({
          severity: 'Critical',
          ledger: l.name,
          current_group: l.group,
          correct_group: 'Indirect Expenses',
          balance: Math.abs(l.balance),
          rule: `"${l.name}" is an expense but is classified under Balance Sheet group "${l.group}". This inflates assets and causes Balance Sheet to not tally.`,
          law: 'Schedule III of Companies Act 2013 — expenses must appear in Statement of Profit & Loss, NOT in Balance Sheet. Sec 129 Companies Act — non-compliant financial statements attract penalty up to ₹1,00,000.',
          fix: `Gateway of Tally → Accounts Info → Ledgers → Alter → ${l.name} → Change Group from "${l.group}" to "Indirect Expenses" → Save → Re-export Trial Balance`,
          impact: 'This ledger is causing your Balance Sheet difference. Fixing the group in Tally will resolve the mismatch.'
        })
      }
    }

    // Detect income sitting in Balance Sheet groups
    const isIncome = INCOME_KEYWORDS.some(k => nl.includes(k))
    const hasCreditBal = l.credit > 0 && l.balance < 0

    if (isIncome && inBSGroup && hasCreditBal && grp) {
      const alreadyCaught = LEDGER_RULES.some(r => r.patterns.some(p => nl.includes(p)))
      if (!alreadyCaught) {
        findings.push({
          severity: 'Critical',
          ledger: l.name,
          current_group: l.group,
          correct_group: 'Indirect Incomes',
          balance: Math.abs(l.balance),
          rule: `"${l.name}" is income but is classified under Balance Sheet group "${l.group}". This understates liabilities and causes Balance Sheet to not tally.`,
          law: 'Schedule III of Companies Act 2013 — income must appear in Statement of Profit & Loss. AS-1 (Disclosure of Accounting Policies) requires consistent and correct classification.',
          fix: `Gateway of Tally → Accounts Info → Ledgers → Alter → ${l.name} → Change Group from "${l.group}" to "Indirect Incomes" → Save → Re-export Trial Balance`,
          impact: 'This ledger is causing your Balance Sheet difference. Fixing the group in Tally will resolve the mismatch.'
        })
      }
    }
  }
  return findings
}

// ── MODULE 2: OUTSTANDING BALANCES ───────────────────────────────────────────
function detectOutstanding(ledgers: Ledger[]) {
  const findings: any[] = []
  for (const l of ledgers) {
    const nl = l.name.toLowerCase()
    const grp = (l.group || '').toLowerCase()

    // Suspense account non-zero — Critical per ICAI
    if (nl.includes('suspense') && (l.debit > 0 || l.credit > 0)) {
      findings.push({ severity: 'Critical', type: 'suspense', ledger: l.name,
        amount: Math.abs(l.balance || l.credit || l.debit),
        issue: `Suspense account has ₹${Math.abs(l.balance || l.debit || l.credit).toLocaleString('en-IN')} balance. Must be nil at year-end per ICAI standards.`,
        law: 'ICAI Guidance Note — suspense must be cleared before finalising accounts' })
    }

    // Sundry Debtors — credit balance (should be liability) or large outstanding
    if (grp.includes('sundry debtor') || grp.includes('debtors')) {
      if (l.credit > l.debit && l.credit > 0) {
        findings.push({ severity: 'Review', type: 'debtor_credit_balance', ledger: l.name,
          amount: l.credit - l.debit,
          issue: `${l.name} is a Debtor but has CREDIT balance ₹${(l.credit-l.debit).toLocaleString('en-IN')} — advance received? Move to Current Liabilities.`,
          law: 'AS 9 Revenue Recognition — advance received is a liability' })
      }
      if (l.debit > 100000) {
        findings.push({ severity: 'Review', type: 'outstanding_debtor', ledger: l.name,
          amount: l.debit,
          issue: `Large outstanding debtor ₹${l.debit.toLocaleString('en-IN')} from ${l.name}. If >3 years old and irrecoverable — write off u/s 36(1)(vii) IT Act.`,
          law: 'Sec 36(1)(vii) IT Act — bad debt write-off deductible' })
      }
    }

    // Sundry Creditors — debit balance (advance paid?) or large payable
    if (grp.includes('sundry creditor') || grp.includes('creditors')) {
      if (l.debit > l.credit && l.debit > 0) {
        findings.push({ severity: 'Review', type: 'creditor_debit_balance', ledger: l.name,
          amount: l.debit - l.credit,
          issue: `${l.name} is a Creditor but has DEBIT balance ₹${(l.debit-l.credit).toLocaleString('en-IN')} — advance paid? Move to Loans & Advances (Asset).`,
          law: 'AS 2 / Balance Sheet — advance paid is an asset' })
      }
      if (l.credit > 100000) {
        findings.push({ severity: 'Review', type: 'large_creditor', ledger: l.name,
          amount: l.credit,
          issue: `₹${l.credit.toLocaleString('en-IN')} payable to ${l.name}. If MSME supplier and >45 days unpaid → disallowed u/s 43B(h). If >3 years → taxable u/s 41(1).`,
          law: 'Sec 43B(h) IT Act (MSME 45-day rule) | Sec 41(1) (cessation of liability)' })
      }
    }

    // Cash-in-hand — negative balance
    if (grp.includes('cash-in-hand') || grp.includes('cash in hand') || nl === 'cash') {
      if (l.balance < 0) {
        findings.push({ severity: 'Critical', type: 'negative_cash', ledger: l.name,
          amount: Math.abs(l.balance),
          issue: `Cash-in-Hand shows NEGATIVE balance ₹${Math.abs(l.balance).toLocaleString('en-IN')} — impossible. A payment entry is missing or wrong.`,
          law: 'Basic accounting — cash balance cannot be negative' })
      } else if (l.balance > 200000) {
        findings.push({ severity: 'Review', type: 'high_cash', ledger: l.name,
          amount: l.balance,
          issue: `Very high cash balance ₹${l.balance.toLocaleString('en-IN')}. Physical count done? Cash receipt >₹2L from one person in one day = violation u/s 269ST.`,
          law: 'Sec 269ST IT Act — cash receipt >₹2L prohibited; penalty = 100% u/s 271DA' })
      }
    }

    // Opening balance difference
    if (nl.includes('difference in opening') && (l.debit > 0 || l.credit > 0)) {
      findings.push({ severity: 'Critical', type: 'opening_diff', ledger: l.name,
        amount: Math.abs(l.debit || l.credit),
        issue: `Difference in Opening Balances = ₹${Math.abs(l.debit || l.credit).toLocaleString('en-IN')}. Last year closing ≠ this year opening. Must be corrected before audit.`,
        law: 'AS 1 — opening balance must equal prior year closing balance' })
    }
  }
  return findings
}

// ── MODULE 3: CASH VIOLATIONS ─────────────────────────────────────────────────
// Sec 40A(3): cash payment >₹10k → disallowed; ₹35k for transporters
// Sec 269ST: cash receipt >₹2L → penalty 100% u/s 271DA
function detectCashViolations(daybook: DaybookRow[]) {
  if (!daybook.length) return []
  const CASH_NAMES = ['cash', 'petty cash', 'hand cash', 'cash in hand', 'cash-in-hand']
  const TRANSPORT = ['transport','freight','cargo','logistics','trucking','carrier']

  // Find voucher IDs where cash ledger is used
  const cashVids = new Set<number>()
  for (const r of daybook) {
    if (CASH_NAMES.some(c => r.particulars.toLowerCase() === c || r.particulars.toLowerCase().startsWith(c))) {
      cashVids.add(r.vid)
    }
  }

  const seen = new Set<number>()
  const findings: any[] = []

  for (const r of daybook) {
    if (!cashVids.has(r.vid) || seen.has(r.vid)) continue
    if (CASH_NAMES.some(c => r.particulars.toLowerCase().includes(c))) continue
    seen.add(r.vid)

    const isTransport = TRANSPORT.some(t => r.particulars.toLowerCase().includes(t))
    const limit = isTransport ? 35000 : 10000

    if (r.debit > limit) {
      findings.push({
        severity: 'Critical', date: r.date, party: r.particulars, amount: r.debit,
        section: '40A(3)', type: 'cash_expense',
        issue: `Cash payment ₹${r.debit.toLocaleString('en-IN')} to ${r.particulars} exceeds ₹${limit.toLocaleString('en-IN')} limit`,
        impact: `₹${r.debit.toLocaleString('en-IN')} will be DISALLOWED as business expense. Pay via bank to avoid disallowance.`,
        law: 'Sec 40A(3) IT Act — cash payments >₹10,000 (₹35,000 for transporters) per person per day disallowed'
      })
    }
    if (r.credit > 200000) {
      findings.push({
        severity: 'Critical', date: r.date, party: r.particulars, amount: r.credit,
        section: '269ST', type: 'cash_receipt',
        issue: `Cash receipt ₹${r.credit.toLocaleString('en-IN')} from ${r.particulars} exceeds ₹2,00,000 limit`,
        impact: `Penalty = 100% of amount = ₹${r.credit.toLocaleString('en-IN')} u/s 271DA. Accept via bank transfer only.`,
        law: 'Sec 269ST IT Act — receiving ₹2L+ in cash from one person in one day is prohibited'
      })
    }
  }
  return findings
}

// ── MODULE 4: TDS COMPLIANCE ──────────────────────────────────────────────────
// Rates confirmed: 194C=1%, 194J=10%, 194I=10%, 194H=2% (Finance Act 2024), 194A=10%
// Annual limits: 194C=₹1L, 194J=₹50k, 194I=₹6L, 194H=₹20k, 194A=₹5k
function detectTDS(ledgers: Ledger[], daybook: DaybookRow[]) {
  const findings: any[] = []
  const alreadyFlagged = new Set<string>()

  // A. Aggregate daybook payments by party name
  const partyTotals: Record<string, number> = {}
  for (const r of daybook) {
    if ((r.vchType === 'Payment' || r.vchType === 'Journal') && r.debit > 0) {
      partyTotals[r.particulars] = (partyTotals[r.particulars] || 0) + r.debit
    }
  }
  for (const [party, total] of Object.entries(partyTotals)) {
    const pl = party.toLowerCase()
    for (const rule of TDS_RULES) {
      if (rule.keywords.some(k => pl.includes(k)) && total > rule.annualLimit) {
        const tds = Math.round(total * rule.rate / 100)
        const interest = Math.round(tds * 0.015 * 12)
        findings.push({
          party, section: rule.section, description: rule.desc,
          total_paid: total, rate: rule.rate, tds_expected: tds, interest_est: interest,
          severity: 'Critical', type: 'payment_check',
          issue: `Total payments to '${party}' = ₹${total.toLocaleString('en-IN')}. TDS u/s ${rule.section} (${rule.desc}) @ ${rule.rate}% = ₹${tds.toLocaleString('en-IN')} should have been deducted.`,
          impact: `Interest @ 1%/month till deduction + 1.5%/month till deposit. Est. exposure = ₹${interest.toLocaleString('en-IN')}. File 26Q now.`,
          law: `Sec ${rule.section} IT Act — TDS @ ${rule.rate}% | Interest u/s 201(1A) | Penalty u/s 271C`
        })
        alreadyFlagged.add(party)
        break
      }
    }
  }

  // B. Trial balance expense ledger scan (catches ledger names like "Office Rent", "Professional Charges")
  for (const l of ledgers) {
    if (alreadyFlagged.has(l.name)) continue
    const nl = l.name.toLowerCase()
    const bal = Math.abs(l.debit || l.balance || 0)
    for (const rule of TDS_RULES) {
      if (rule.keywords.some(k => nl.includes(k)) && bal > rule.annualLimit) {
        const tds = Math.round(bal * rule.rate / 100)
        findings.push({
          party: l.name, section: rule.section, description: rule.desc,
          total_paid: bal, rate: rule.rate, tds_expected: tds, interest_est: 0,
          severity: 'Critical', type: 'ledger_check',
          issue: `Expense ledger '${l.name}' = ₹${bal.toLocaleString('en-IN')}. TDS u/s ${rule.section} @ ${rule.rate}% — TDS of ₹${tds.toLocaleString('en-IN')} should have been deducted.`,
          impact: `Verify TDS was deducted. If not: interest @ 1.5%/month applies.`,
          law: `Sec ${rule.section} IT Act`
        })
        break
      }
    }
  }
  return findings
}

// ── MODULE 5: LOANS ───────────────────────────────────────────────────────────
// Sec 269SS: loan acceptance in cash >₹20k → penalty 100% u/s 271D
// Sec 269T: loan repayment in cash >₹20k → penalty 100% u/s 271E
function detectLoans(ledgers: Ledger[], daybook: DaybookRow[]) {
  const findings: any[] = []
  const loanGroups = ['loans (liability)', 'loans & advances (asset)', 'loan']

  for (const l of ledgers) {
    const grp = l.group?.toLowerCase() || ''
    const nl = l.name.toLowerCase()
    if (!loanGroups.some(g => grp.includes(g)) && !nl.includes('loan')) continue
    const bal = Math.abs(l.balance)
    if (bal < 10000) continue

    const isDirector = /director|partner|proprietor|shareholder|promoter/.test(nl)
    findings.push({
      ledger: l.name, group: l.group, balance: bal, is_director: isDirector,
      question: `${isDirector ? 'Director/Partner' : 'Loan'} account '${l.name}' has balance ₹${bal.toLocaleString('en-IN')}. Was this received/given via banking channel? Any cash acceptance/repayment >₹20,000 = penalty u/s 269SS/269T.`,
      documents: ['Bank statement showing loan transaction','Loan agreement with repayment schedule',
        ...(isDirector ? ['Board resolution (mandatory for companies)','Form DPT-3 filed with ROC'] : [])],
      law: 'Sec 269SS IT Act — cash loan acceptance >₹20k: penalty 100% u/s 271D | Sec 269T — cash repayment >₹20k: penalty 100% u/s 271E | Form 3CD Clause 13 reporting'
    })
  }
  return findings
}

// ── MODULE 6: LARGE EXPENSES ──────────────────────────────────────────────────
function detectLargeExpenses(daybook: DaybookRow[]) {
  return daybook
    .filter(r => r.vchType === 'Payment' && r.debit >= 100000)
    .map(r => ({
      date: r.date, party: r.particulars, amount: r.debit, voucher: r.vchType,
      question: `Large payment ₹${r.debit.toLocaleString('en-IN')} to ${r.particulars}. Provide supporting bill/invoice/agreement. Verify TDS was deducted if applicable.`
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 50)
}

// ── MODULE 7: BANK ACCOUNTS ───────────────────────────────────────────────────
function detectBankAccounts(ledgers: Ledger[], daybook: DaybookRow[]) {
  const findings: any[] = []
  const BANK_GROUPS = ['bank accounts', 'bank od a/c', 'bank account']
  const NOT_BANK = ['advance','staff','salary','wages','receivable','payable','tds','gst',
    'tax','deposit refund','security deposit','investment','mutual fund','loan','expense',
    'income','sales','purchase','sundry','creditor','debtor','suspense']
  const foundInTB = new Set<string>()

  // Pass 1: TB group-based
  for (const l of ledgers) {
    const grp = l.group?.toLowerCase() || ''
    if (!BANK_GROUPS.some(g => grp.includes(g))) continue
    const nl = l.name.toLowerCase()
    if (NOT_BANK.some(k => nl.includes(k))) continue
    const bal = Math.abs(l.balance)
    foundInTB.add(nl)
    findings.push({
      ledger: l.name, balance: bal, dr_cr: l.balance >= 0 ? 'Dr' : 'Cr (OD)',
      group: l.group, source: 'TB Group',
      question: `Bank account '${l.name}' — book balance ₹${bal.toLocaleString('en-IN')} ${l.balance >= 0 ? 'Dr' : 'Cr (OD)'}. Reconcile with bank statement.`
    })
  }

  // Pass 2: Daybook-based (finds banks in wrong group)
  const fundingCount: Record<string, number> = {}
  const fundingAmt: Record<string, number> = {}
  for (const r of daybook) {
    const pl = r.particulars.toLowerCase()
    const amt = r.debit + r.credit
    if (r.vchType === 'Payment' && r.credit > 0) {
      fundingCount[pl] = (fundingCount[pl] || 0) + 1
      fundingAmt[pl] = (fundingAmt[pl] || 0) + r.credit
    } else if (r.vchType === 'Receipt' && r.debit > 0) {
      fundingCount[pl] = (fundingCount[pl] || 0) + 1
      fundingAmt[pl] = (fundingAmt[pl] || 0) + r.debit
    } else if (r.vchType === 'Contra') {
      fundingCount[pl] = (fundingCount[pl] || 0) + 1
      fundingAmt[pl] = (fundingAmt[pl] || 0) + amt
    }
  }
  const CASH_KW = ['cash', 'petty cash', 'cash in hand']
  for (const [acc, count] of Object.entries(fundingCount)) {
    if (foundInTB.has(acc) || count < 3) continue
    if (NOT_BANK.some(k => acc.includes(k)) || CASH_KW.some(k => acc.includes(k))) continue
    const tb = ledgers.find(l => l.name.toLowerCase() === acc)
    findings.push({
      ledger: tb?.name || acc, balance: Math.abs(tb?.balance || 0),
      dr_cr: (tb?.balance ?? 0) >= 0 ? 'Dr' : 'Cr', group: tb?.group || 'Unknown',
      source: 'Daybook', warning: true,
      question: `'${tb?.name || acc}' acts as a bank account in daybook (${count} transactions, ₹${(fundingAmt[acc]||0).toLocaleString('en-IN')} total) but NOT under Bank Accounts group. Move to Bank Accounts in Tally.`
    })
  }
  return findings
}

// ── MODULE 8: SALARY / PF / PT ────────────────────────────────────────────────
// PF: mandatory if 20+ employees; 12% of basic up to ₹15,000; deposit by 15th
// ESI: mandatory if 10+ employees; gross ≤ ₹21,000; employer 3.25%; deposit by 15th
// WB PT: deduct monthly per slab; deposit by 21st via Grips portal
function detectSalaryCompliance(ledgers: Ledger[], daybook: DaybookRow[]) {
  const findings: any[] = []
  const SALARY_KW = ['salary','wages','remuneration','staff cost','staff salary']
  const PF_KW = ['provident fund','pf payable','epf','pf contribution','pf employer']
  const ESI_KW = ['esi','esic','employee state insurance']
  const PT_KW = ['professional tax','pt payable','p.tax','ptax','prof tax']

  const salaryLedgers = ledgers.filter(l => SALARY_KW.some(k => l.name.toLowerCase().includes(k)))
  const pfLedgers = ledgers.filter(l => PF_KW.some(k => l.name.toLowerCase().includes(k)))
  const esiLedgers = ledgers.filter(l => ESI_KW.some(k => l.name.toLowerCase().includes(k)))
  const ptLedgers = ledgers.filter(l => PT_KW.some(k => l.name.toLowerCase().includes(k)))
  const totalSalary = salaryLedgers.reduce((s, l) => s + (l.debit || 0), 0)

  if (!totalSalary) return []

  findings.push({ type: 'salary_summary', severity: 'Info', amount: totalSalary,
    issue: `Total salary/wages = ₹${totalSalary.toLocaleString('en-IN')}`,
    question: `Total salary expense = ₹${totalSalary.toLocaleString('en-IN')}. How many employees? Monthly salary register maintained? Form 16 issued?` })

  if (!pfLedgers.length) {
    const expPF = Math.round(totalSalary * 0.12)
    findings.push({ type: 'pf_missing', severity: 'Important', amount: expPF,
      issue: `No PF/EPF ledger found. Salary = ₹${totalSalary.toLocaleString('en-IN')}. If any employee earns ≤₹15,000/month, PF @ 12% of basic is mandatory (20+ employee establishments).`,
      impact: `Estimated employer PF (12%) = ₹${expPF.toLocaleString('en-IN')}. Non-deduction: penalty u/s 14B EPF Act up to 25% of dues.`,
      law: 'EPF & Miscellaneous Provisions Act 1952 — 12% of basic up to ₹15,000/month; deposit by 15th of next month' })
  }

  if (!esiLedgers.length) {
    findings.push({ type: 'esi_missing', severity: 'Important',
      issue: `No ESI ledger found. If any employee earns ≤₹21,000/month, ESI is mandatory (10+ employee establishments).`,
      impact: `Employee: 0.75% of gross. Employer: 3.25% of gross. Deposit by 15th of each month.`,
      law: 'ESI Act 1948 — applicable to establishments with 10+ employees in notified areas' })
  }

  // Voucher-level PT analysis from daybook
  if (daybook.length) {
    const SAL_KW_DB = ['salary','wages','staff salary','staff wages','remuneration']
    const PT_KW_DB = ['professional tax','pt payable','p.tax','ptax','prof tax']
    const ptGovtKW = ['professional tax','pt payable','p.tax','grips','wbifms']

    let ptExpected = 0, ptDeducted = 0, ptPaidGovt = 0
    const missingMonths: any[] = []

    // Group by voucher
    const voucherMap = new Map<number, DaybookRow[]>()
    for (const r of daybook) {
      if (!voucherMap.has(r.vid)) voucherMap.set(r.vid, [])
      voucherMap.get(r.vid)!.push(r)
    }

    for (const [, rows] of voucherMap) {
      const vtype = rows[0]?.vchType
      if (vtype !== 'Payment' && vtype !== 'Journal') continue
      const salRows = rows.filter(r => SAL_KW_DB.some(k => r.particulars.toLowerCase().includes(k)) && r.debit > 0)
      if (!salRows.length) continue
      const salAmt = salRows.reduce((s, r) => s + r.debit, 0)
      const ptRows = rows.filter(r => PT_KW_DB.some(k => r.particulars.toLowerCase().includes(k)) && r.credit > 0)
      const ptAmt = ptRows.reduce((s, r) => s + r.credit, 0)
      const exp = WB_PT(salAmt)
      ptExpected += exp
      ptDeducted += ptAmt
      if (exp > 0 && ptAmt < exp) {
        missingMonths.push({ month: rows[0].date?.slice(0,7), salary: salAmt, expected: exp, deducted: ptAmt, shortfall: exp - ptAmt })
      }
    }

    // PT paid to govt
    const ptGovtRows = daybook.filter(r => r.vchType === 'Payment' && ptGovtKW.some(k => r.particulars.toLowerCase().includes(k)))
    ptPaidGovt = ptGovtRows.reduce((s, r) => s + r.debit, 0)

    if (missingMonths.length > 0) {
      const totalShortfall = missingMonths.reduce((s, m) => s + m.shortfall, 0)
      findings.push({ type: 'pt_not_deducted', severity: 'Critical', months: missingMonths,
        issue: `PT NOT deducted in ${missingMonths.length} salary vouchers. Total PT shortfall = ₹${totalShortfall.toLocaleString('en-IN')}.`,
        impact: `Employer liable to pay undeducted PT + interest @ 2%/month. Deposit via Grips portal (wbifms.gov.in) by 21st of each month.`,
        law: 'WB Professional Tax Act 1979 — employer must deduct and deposit PT; liable even if not deducted' })
    } else if (ptDeducted > 0) {
      findings.push({ type: 'pt_ok', severity: 'Info', amount: ptDeducted,
        issue: `PT deducted correctly in all salary vouchers. Total PT deducted = ₹${ptDeducted.toLocaleString('en-IN')}.`, law: 'WB PT Act 1979' })
    }

    const ptUnpaid = Math.max(0, ptDeducted - ptPaidGovt)
    if (ptUnpaid > 0) {
      findings.push({ type: 'pt_not_paid_govt', severity: 'Critical', amount: ptUnpaid,
        issue: `PT deducted from employees = ₹${ptDeducted.toLocaleString('en-IN')} but deposited to govt = ₹${ptPaidGovt.toLocaleString('en-IN')}. Outstanding = ₹${ptUnpaid.toLocaleString('en-IN')}.`,
        impact: `Late deposit: interest @ 2%/month on ₹${ptUnpaid.toLocaleString('en-IN')}. Pay via Grips portal immediately.`,
        law: 'WB PT Act 1979 Sec 7 — interest @ 2%/month on delayed deposit' })
    }
  } else if (!ptLedgers.length) {
    findings.push({ type: 'pt_missing', severity: 'Important',
      issue: `No PT ledger found. Salary = ₹${totalSalary.toLocaleString('en-IN')}. WB PT slabs: ≤₹10k=₹0, ≤₹15k=₹110, ≤₹25k=₹130, ≤₹40k=₹150, >₹40k=₹200/month.`,
      impact: `Deposit by 21st of every month via Grips portal. Late deposit: interest @ 2%/month.`,
      law: 'WB Professional Tax Act 1979' })
  }

  return findings
}

// ── MODULE 9: FIXED ASSETS ────────────────────────────────────────────────────
function detectFixedAssets(ledgers: Ledger[]) {
  const findings: any[] = []
  const faLedgers = ledgers.filter(l => (l.group || '').toLowerCase().includes('fixed asset') || (l.group || '').toLowerCase().includes('fixed assets'))
  if (!faLedgers.length) return []

  const totalGross = faLedgers.reduce((s, l) => s + (l.debit || 0), 0)
  const depLedgers = ledgers.filter(l => /depreciation|accum\. dep|accumulated dep/i.test(l.name))

  if (!depLedgers.length && totalGross > 50000) {
    findings.push({ type: 'no_depreciation', severity: 'Critical', amount: totalGross,
      issue: `Fixed assets ₹${totalGross.toLocaleString('en-IN')} but NO depreciation ledger found. Depreciation is mandatory every year.`,
      action: `Create 'Depreciation' ledger under Indirect Expenses. Use Schedule II Companies Act 2013 rates (useful life method) or IT Act WDV rates.`,
      law: 'Schedule II Companies Act 2013 — mandatory depreciation | AS 10 Fixed Assets | CARO 2020 Clause 3(i)' })
  } else if (depLedgers.length) {
    const totalDep = depLedgers.reduce((s, l) => s + Math.abs(l.balance), 0)
    findings.push({ type: 'depreciation_summary', severity: 'Review', gross: totalGross, dep: totalDep,
      issue: `Fixed assets gross = ₹${totalGross.toLocaleString('en-IN')}. Accumulated depreciation = ₹${totalDep.toLocaleString('en-IN')} (${totalGross > 0 ? Math.round(totalDep/totalGross*100) : 0}% of gross). Verify rates match Schedule II.`,
      law: 'Schedule II Companies Act 2013 — residual value must be ≥5% of cost' })
  }
  findings.push({ type: 'caro', severity: 'Review', amount: totalGross,
    issue: `CARO 2020 Clause 3(i): Maintain Fixed Asset Register with description, location, quantity, cost, accumulated depreciation, net book value per asset.`,
    law: 'CARO 2020 Clause 3(i) — mandatory for companies; best practice for all entities' })
  return findings
}

// ── SCORING ───────────────────────────────────────────────────────────────────
function computeScore(r: Partial<AuditResult>): { score: number; critical: number; warnings: number; questions: number } {
  const critical = (r.ledger_classification?.filter((f: any) => f.severity === 'Critical').length || 0)
    + (r.outstanding?.filter((f: any) => f.severity === 'Critical').length || 0)
    + (r.salary_compliance?.filter((f: any) => f.severity === 'Critical').length || 0)
    + (r.fixed_assets?.filter((f: any) => f.severity === 'Critical').length || 0)
  const tdsCritical = r.tds_compliance?.length || 0
  const cashCount = r.cash_violations?.length || 0
  const warnings = (r.ledger_classification?.filter((f: any) => f.severity === 'Review').length || 0)
    + (r.outstanding?.filter((f: any) => f.severity === 'Review').length || 0)
    + (r.salary_compliance?.filter((f: any) => f.severity === 'Important').length || 0)
    + cashCount
  const questions = (r.loans?.length || 0) + (r.large_expenses?.length || 0) + (r.bank_accounts?.length || 0)
  const cashPenalty = Math.min(20, cashCount)
  const score = Math.max(0, Math.min(100, Math.round(
    100 - (critical * 8) - (warnings * 1) - (questions * 2) - (tdsCritical * 6) - cashPenalty
  )))
  return { score, critical, warnings, questions }
}

// ── MAIN ENTRY ────────────────────────────────────────────────────────────────
export function runAudit(primaryBuffer: Buffer, tbBuffer: Buffer | null = null, company = '', period = ''): AuditResult {
  // Parse trial balance
  const tbParsed = parseTallyTrialBalance(tbBuffer || primaryBuffer)
  const ledgers = tbParsed.ledgers
  const companyName = company || tbParsed.company
  const periodStr = period || tbParsed.period

  // Parse daybook (if separate file provided)
  let daybook: DaybookRow[] = []
  if (primaryBuffer !== tbBuffer && primaryBuffer) {
    try { daybook = parseTallyDaybook(primaryBuffer) } catch {}
  }
  // Also try parsing primaryBuffer as daybook if no separate TB
  if (!daybook.length && !tbBuffer) {
    try { daybook = parseTallyDaybook(primaryBuffer) } catch {}
  }

  const partial: Partial<AuditResult> = {
    ledger_classification: detectLedgerIssues(ledgers),
    outstanding: detectOutstanding(ledgers),
    cash_violations: detectCashViolations(daybook),
    tds_compliance: detectTDS(ledgers, daybook),
    loans: detectLoans(ledgers, daybook),
    large_expenses: detectLargeExpenses(daybook),
    bank_accounts: detectBankAccounts(ledgers, daybook),
    salary_compliance: detectSalaryCompliance(ledgers, daybook),
    fixed_assets: detectFixedAssets(ledgers),
  }

  const { score, critical, warnings, questions } = computeScore(partial)

  return {
    summary: {
      company: companyName, period: periodStr, score, critical, warnings, questions,
      total_ledgers: ledgers.length, total_vouchers: daybook.length,
    },
    ...(partial as Omit<AuditResult, 'summary'>),
  }
}

// ── ENTRY POINT FROM AI-PARSED DATA ──────────────────────────────────────────
// Called when parsed_tb / parsed_daybook are already in Supabase (no re-parsing)
export function runAuditFromParsed(parsedTB: { ledgers: Ledger[]; company: string; period: string }, parsedDaybook: DaybookRow[] | null): AuditResult {
  const ledgers = (parsedTB.ledgers || []).map(l => ({
    name: l.name,
    group: l.group || '',
    debit: Number(l.debit) || 0,
    credit: Number(l.credit) || 0,
    balance: Number((l as any).balance ?? l.debit - l.credit) || 0,
  }))
  const daybook: DaybookRow[] = (parsedDaybook || []).map((r: any) => ({
    date: r.date || '',
    particulars: r.particulars || '',
    vchType: r.vchType || '',
    vchNo: String(r.vchNo || ''),
    debit: Number(r.debit) || 0,
    credit: Number(r.credit) || 0,
    vid: Number(r.vid) || 0,
  }))

  const partial: Partial<AuditResult> = {
    ledger_classification: detectLedgerIssues(ledgers),
    outstanding: detectOutstanding(ledgers),
    cash_violations: detectCashViolations(daybook),
    tds_compliance: detectTDS(ledgers, daybook),
    loans: detectLoans(ledgers, daybook),
    large_expenses: detectLargeExpenses(daybook),
    bank_accounts: detectBankAccounts(ledgers, daybook),
    salary_compliance: detectSalaryCompliance(ledgers, daybook),
    fixed_assets: detectFixedAssets(ledgers),
  }

  const { score, critical, warnings, questions } = computeScore(partial)

  return {
    summary: {
      company: parsedTB.company || 'Company',
      period: parsedTB.period || 'FY 2025-26',
      score, critical, warnings, questions,
      total_ledgers: ledgers.length,
      total_vouchers: daybook.length,
    },
    ...(partial as Omit<AuditResult, 'summary'>),
  }
}
