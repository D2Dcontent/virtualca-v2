import * as XLSX from 'xlsx'

export interface AuditRow {
  date: string
  ledger: string
  voucher_type: string
  debit: number
  credit: number
  narration: string
  group: string
}

export interface AuditResult {
  summary: {
    company: string
    period: string
    score: number
    critical: number
    warnings: number
    questions: number
  }
  cash_violations: CashViolation[]
  tds_compliance: TDSIssue[]
  outstanding: OutstandingBalance[]
  large_expenses: LargeExpense[]
  loans: Loan[]
  bank_accounts: BankAccount[]
  salary_compliance: SalaryIssue[]
  ledger_classification: LedgerIssue[]
  ai_insight?: string
}

interface CashViolation { date: string; party: string; amount: number; section: string }
interface TDSIssue { party: string; section: string; total_paid: number; tds_expected: number; rate: number; issue: string }
interface OutstandingBalance { ledger: string; balance: number; severity: string; issue: string }
interface LargeExpense { date: string; party: string; amount: number; voucher: string }
interface Loan { ledger: string; balance: number; note: string }
interface BankAccount { ledger: string; balance: number; dr_cr: string }
interface SalaryIssue { severity: string; issue: string; amount?: number }
interface LedgerIssue { ledger: string; group: string; issue: string; severity: string; amount: number }

function parseExcel(buffer: Buffer): AuditRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[]

  return raw.map(r => ({
    date: String(r['Date'] || r['date'] || r['Dt'] || r['DATE'] || ''),
    ledger: String(r['Ledger'] || r['Particulars'] || r['ledger'] || r['Account'] || r['Name'] || r['LEDGER'] || r['Ledger Name'] || ''),
    voucher_type: String(r['Voucher Type'] || r['Vch Type'] || r['VchType'] || r['voucher_type'] || r['Type'] || r['VOUCHER TYPE'] || ''),
    debit: Number(r['Debit'] || r['Dr'] || r['Debit Amount'] || r['DR'] || r['DEBIT'] || r['debit'] || 0),
    credit: Number(r['Credit'] || r['Cr'] || r['Credit Amount'] || r['CR'] || r['CREDIT'] || r['credit'] || 0),
    narration: String(r['Narration'] || r['narration'] || r['Description'] || r['Remarks'] || r['NARRATION'] || ''),
    group: String(r['Group'] || r['group'] || r['Under'] || r['GROUP'] || r['Ledger Group'] || ''),
  }))
}

function detectCashViolations(rows: AuditRow[]): CashViolation[] {
  const violations: CashViolation[] = []
  const cashLedgers = ['cash', 'petty cash', 'cash in hand']

  // Group by party for 269ST (>2L aggregate)
  const partyTotals: Record<string, number> = {}

  for (const r of rows) {
    const isPayment = r.voucher_type.toLowerCase().includes('payment')
    const isCash = cashLedgers.some(c => r.ledger.toLowerCase().includes(c))

    if (isPayment && r.debit > 10000) {
      violations.push({ date: r.date, party: r.ledger, amount: r.debit, section: '40A(3)' })
    }

    if (isCash) {
      partyTotals[r.ledger] = (partyTotals[r.ledger] || 0) + r.credit
    }
  }

  for (const [party, total] of Object.entries(partyTotals)) {
    if (total > 200000) {
      violations.push({ date: '', party, amount: total, section: '269ST' })
    }
  }

  return violations
}

function detectTDS(rows: AuditRow[]): TDSIssue[] {
  const TDS_RULES: { keywords: string[]; section: string; rate: number; threshold: number }[] = [
    { keywords: ['contractor', 'contract', 'labour'], section: '194C', rate: 1, threshold: 30000 },
    { keywords: ['professional', 'consultant', 'legal', 'ca ', 'audit'], section: '194J', rate: 10, threshold: 30000 },
    { keywords: ['rent', 'lease'], section: '194I', rate: 10, threshold: 240000 },
    { keywords: ['commission', 'brokerage'], section: '194H', rate: 5, threshold: 15000 },
  ]

  const partyTotals: Record<string, { total: number; section: string; rate: number }> = {}

  for (const r of rows) {
    const isExpense = r.debit > 0
    if (!isExpense) continue
    const ledgerLower = r.ledger.toLowerCase()

    for (const rule of TDS_RULES) {
      if (rule.keywords.some(k => ledgerLower.includes(k))) {
        const key = `${r.ledger}__${rule.section}`
        if (!partyTotals[key]) partyTotals[key] = { total: 0, section: rule.section, rate: rule.rate }
        partyTotals[key].total += r.debit
      }
    }
  }

  const issues: TDSIssue[] = []
  for (const [key, info] of Object.entries(partyTotals)) {
    const party = key.split('__')[0]
    const threshold = TDS_RULES.find(r => r.section === info.section)?.threshold || 0
    if (info.total > threshold) {
      const tds = Math.round(info.total * info.rate / 100)
      issues.push({
        party,
        section: info.section,
        total_paid: info.total,
        tds_expected: tds,
        rate: info.rate,
        issue: `TDS of Rs.${tds.toLocaleString('en-IN')} @ ${info.rate}% not deducted under Sec ${info.section}`,
      })
    }
  }
  return issues
}

function detectOutstanding(rows: AuditRow[]): OutstandingBalance[] {
  const issues: OutstandingBalance[] = []
  const ledgerBalances: Record<string, { debit: number; credit: number; group: string }> = {}

  for (const r of rows) {
    if (!ledgerBalances[r.ledger]) ledgerBalances[r.ledger] = { debit: 0, credit: 0, group: r.group }
    ledgerBalances[r.ledger].debit += r.debit
    ledgerBalances[r.ledger].credit += r.credit
  }

  for (const [ledger, bal] of Object.entries(ledgerBalances)) {
    const net = bal.debit - bal.credit
    const ledgerLower = ledger.toLowerCase()

    if (ledgerLower.includes('suspense') && Math.abs(net) > 0) {
      issues.push({ ledger, balance: net, severity: 'Critical', issue: 'Suspense account must be nil at year-end per ICAI standards' })
    }
  }
  return issues
}

function detectLargeExpenses(rows: AuditRow[]): LargeExpense[] {
  return rows
    .filter(r => r.debit >= 100000)
    .map(r => ({ date: r.date, party: r.ledger, amount: r.debit, voucher: r.voucher_type }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 50)
}

function detectLoans(rows: AuditRow[]): Loan[] {
  const loanLedgers: Record<string, number> = {}
  for (const r of rows) {
    if (r.ledger.toLowerCase().includes('loan')) {
      loanLedgers[r.ledger] = (loanLedgers[r.ledger] || 0) + r.credit - r.debit
    }
  }
  return Object.entries(loanLedgers)
    .filter(([, bal]) => Math.abs(bal) > 0)
    .map(([ledger, balance]) => ({
      ledger,
      balance,
      note: balance > 200000 ? 'Check Sec 269SS — loans >Rs.20,000 must be via banking channel' : 'Verify loan agreement exists',
    }))
}

function detectBankAccounts(rows: AuditRow[]): BankAccount[] {
  const banks: Record<string, number> = {}
  for (const r of rows) {
    const grp = r.group.toLowerCase()
    if (grp.includes('bank') || r.ledger.toLowerCase().includes('bank')) {
      banks[r.ledger] = (banks[r.ledger] || 0) + r.debit - r.credit
    }
  }
  return Object.entries(banks).map(([ledger, balance]) => ({
    ledger,
    balance: Math.abs(balance),
    dr_cr: balance >= 0 ? 'Dr' : 'Cr',
  }))
}

function detectSalaryIssues(rows: AuditRow[]): SalaryIssue[] {
  const issues: SalaryIssue[] = []
  let totalSalary = 0
  let ptDeducted = 0
  let ptPaid = 0

  for (const r of rows) {
    if (r.ledger.toLowerCase().includes('salary') || r.ledger.toLowerCase().includes('wages')) {
      totalSalary += r.debit
    }
    if (r.ledger.toLowerCase().includes('professional tax') || r.ledger.toLowerCase().includes('ptax')) {
      ptDeducted += r.debit
    }
    if (r.ledger.toLowerCase().includes('pt payable')) {
      ptPaid += r.credit
    }
  }

  if (totalSalary > 0) {
    issues.push({ severity: 'Info', issue: `Total salary/wages in books: Rs.${totalSalary.toLocaleString('en-IN')}`, amount: totalSalary })
    if (totalSalary > 500000 && ptDeducted === 0) {
      issues.push({ severity: 'Important', issue: 'No PF/ESI ledger found. If employees earn above threshold, PF @ 12% and ESI @ 3.25% are mandatory under EPF Act.' })
    }
    if (ptDeducted > 0 && ptPaid === 0) {
      issues.push({ severity: 'Critical', issue: `PT deducted Rs.${ptDeducted.toLocaleString('en-IN')} but not deposited to government. Deposit via Grips portal before 21st of next month.`, amount: ptDeducted })
    }
  }
  return issues
}

function computeScore(result: Omit<AuditResult, 'summary' | 'ai_insight'>): { score: number; critical: number; warnings: number; questions: number } {
  let score = 100
  let critical = 0
  let warnings = 0
  let questions = 0

  critical += result.cash_violations.length
  critical += result.outstanding.filter(o => o.severity === 'Critical').length
  critical += result.salary_compliance.filter(s => s.severity === 'Critical').length
  warnings += result.tds_compliance.length
  warnings += result.salary_compliance.filter(s => s.severity === 'Important').length
  questions += result.large_expenses.length
  questions += result.loans.length

  score -= critical * 15
  score -= warnings * 8
  score -= questions * 0.5
  score = Math.max(0, Math.min(100, Math.round(score)))

  return { score, critical, warnings, questions }
}

export function runAudit(primaryBuffer: Buffer, tbBuffer: Buffer | null = null, company = '', period = ''): AuditResult {
  // primaryBuffer = daybook (transactions) — used for cash, TDS, large expenses
  // tbBuffer = trial balance (balances) — used for outstanding, loans, bank accounts, salary
  // If only one file provided, use it for everything
  const txRows = parseExcel(primaryBuffer)
  const balRows = tbBuffer ? parseExcel(tbBuffer) : txRows

  const partial = {
    cash_violations: detectCashViolations(txRows),
    tds_compliance: detectTDS(txRows),
    outstanding: detectOutstanding(balRows),
    large_expenses: detectLargeExpenses(txRows),
    loans: detectLoans(balRows),
    bank_accounts: detectBankAccounts(balRows),
    salary_compliance: detectSalaryIssues(balRows),
    ledger_classification: [] as LedgerIssue[],
  }

  const { score, critical, warnings, questions } = computeScore(partial)

  return {
    summary: { company, period, score, critical, warnings, questions },
    ...partial,
  }
}
