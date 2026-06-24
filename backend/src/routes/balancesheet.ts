import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getClient, BUCKET } from '../db/supabase'
import { callModel, runCriticAI } from '../ai/openrouter'
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

  // ── AUTO-DIAGNOSE DIFFERENCE ──────────────────────────────────────────────
  let diagnosis: any = null
  let critic_verdict: any = null

  if (!tallied && difference > 0) {
    // Find expense/income ledgers sitting on wrong BS side
    const EXPENSE_KW = ['rent','salary','wages','commission','food','hotel','travel','telephone',
      'electricity','printing','stationery','repair','maintenance','advertisement','marketing',
      'subscription','fee','fees','expense','expenses','petrol','diesel','fuel','misc']
    const INCOME_KW = ['sales','revenue','income','service income','commission received',
      'interest received','rent received','dividend','discount received']

    const wrongExpenses = ledgers.filter(l => {
      const nl = l.name.toLowerCase()
      return EXPENSE_KW.some(k => nl.includes(k)) && l.debit > 0
    })
    const wrongIncomes = ledgers.filter(l => {
      const nl = l.name.toLowerCase()
      return INCOME_KW.some(k => nl.includes(k)) && l.credit > 0
    })

    const wrongExpenseTotal = wrongExpenses.reduce((s, l) => s + l.debit, 0)
    const wrongIncomeTotal = wrongIncomes.reduce((s, l) => s + l.credit, 0)

    // Transposition check: difference divisible by 9 = likely transposition error
    const isTransposition = difference % 9 === 0
    // Duplication check: difference divisible by 2 = likely duplicate entry
    const isDuplicate = difference % 2 === 0 && !isTransposition

    // Build diagnosis context for AI
    const diagCtx = `
Company: ${company} | Period: ${period}
Balance Sheet Difference: ${fmt(difference)} (Assets ${fmt(total_assets)} vs Liabilities ${fmt(total_liabilities)})

POTENTIAL CAUSES DETECTED:
1. Expense ledgers found on Balance Sheet (should be in P&L): ${wrongExpenses.length} ledgers totalling ${fmt(wrongExpenseTotal)}
   Ledgers: ${wrongExpenses.slice(0,10).map(l => `${l.name} (${fmt(l.debit)})`).join(', ')}

2. Income ledgers found on Balance Sheet (should be in P&L): ${wrongIncomes.length} ledgers totalling ${fmt(wrongIncomeTotal)}
   Ledgers: ${wrongIncomes.slice(0,5).map(l => `${l.name} (${fmt(l.credit)})`).join(', ')}

3. Unclassified ledgers: ${unclassified.length} ledgers totalling ${fmt(unclassified.reduce((s,l) => s + l.balance, 0))}
   Ledgers: ${unclassified.slice(0,10).map(l => `${l.ledger} (${fmt(l.balance)})`).join(', ')}

4. Arithmetic pattern: ${isTransposition ? 'Difference divisible by 9 — possible transposition error (e.g. ₹16,000 entered as ₹61,000)' : isDuplicate ? 'Difference divisible by 2 — possible duplicate entry' : 'No specific pattern detected'}

Most likely cause: ${wrongExpenses.length > 0 ? `${wrongExpenses.length} expense ledgers (${fmt(wrongExpenseTotal)}) are in Balance Sheet groups instead of Indirect Expenses in Tally` : unclassified.length > 0 ? `${unclassified.length} unclassified ledgers need to be assigned correct groups in Tally` : 'Check for one-sided journal entries or data entry errors'}`

    const aiSystem = `You are a senior Chartered Accountant in India with 20 years of audit experience.
Answer in plain text only — no markdown, no stars, no bullet symbols.
You must cite specific Indian accounting law: Schedule III Companies Act 2013, AS-1, AS-2, AS-10, Section 129 Companies Act 2013.
Give: 1) Most likely reason for the difference 2) Which specific ledgers are causing it 3) Exact fix steps in Tally 4) Legal consequence if not fixed.
Maximum 5 lines. Plain sentences only.`

    const ai_diagnosis = await callModel(aiSystem, diagCtx, 400)

    // Critic AI verifies the diagnosis
    const criticFindings = [{
      type: 'Balance Sheet Difference',
      detail: `Difference of ${fmt(difference)} in Balance Sheet. ${wrongExpenses.length} expense ledgers (${fmt(wrongExpenseTotal)}) sitting in Balance Sheet groups instead of P&L. Company: ${company}, Period: ${period}.`
    }]
    const criticResults = await runCriticAI(criticFindings)

    diagnosis = {
      difference,
      wrong_expenses: wrongExpenses.slice(0, 15).map(l => ({ name: l.name, amount: l.debit, group: l.group })),
      wrong_incomes: wrongIncomes.slice(0, 5).map(l => ({ name: l.name, amount: l.credit, group: l.group })),
      wrong_expense_total: wrongExpenseTotal,
      wrong_income_total: wrongIncomeTotal,
      is_transposition: isTransposition,
      is_duplicate: isDuplicate,
      ai_diagnosis,
      law: 'Schedule III Companies Act 2013 — expenses must appear in Statement of Profit & Loss. Sec 129 Companies Act 2013 — non-compliant financial statements: penalty up to ₹1,00,000 + ₹1,000/day. AS-1 requires consistent accounting policies.',
      tally_fix: wrongExpenses.length > 0
        ? `In Tally: Gateway → Accounts Info → Ledgers → Alter → [each expense ledger] → Change Group to "Indirect Expenses" → Save. Then re-export Trial Balance. Do this for: ${wrongExpenses.slice(0,5).map(l => l.name).join(', ')}${wrongExpenses.length > 5 ? ` and ${wrongExpenses.length - 5} more` : ''}.`
        : 'Review unclassified ledgers and assign correct groups in Tally. Check for one-sided journal entries.'
    }

    critic_verdict = criticResults[0] ?? null
  }

  const summary = `Company: ${company}. Period: ${period}. Balance Sheet: Total Assets ${fmt(total_assets)}, Total Liabilities+Equity ${fmt(total_liabilities)}. ${tallied ? 'Tallied perfectly.' : `Difference: ${fmt(difference)}.`} Unclassified: ${unclassified.length} ledgers.`
  const ai_insight = await callModel('You are a senior CA in India. Answer in plain text only, no markdown, no stars. Maximum 2 lines.', summary)

  res.json({ liabilities, assets, total_assets, total_liabilities, difference, tallied, unclassified, ai_insight, company, period, diagnosis, critic_verdict })
})

router.get('/', requireAuth, async (_req, res) => res.json({}))

export default router
