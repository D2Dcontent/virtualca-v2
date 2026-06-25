import OpenAI from 'openai'
import * as XLSX from 'xlsx'
import * as pdfParseModule from 'pdf-parse'
const pdfParse = (pdfParseModule as any).default ?? pdfParseModule

const AUDIT_MODEL = 'anthropic/claude-haiku-4-5'
const CRITIC_MODEL = 'anthropic/claude-sonnet-4-5'

const getClient = () => new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
})

export async function callModel(system: string, user: string, maxTokens = 300, model = AUDIT_MODEL): Promise<string> {
  try {
    const client = getClient()
    const resp = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    })
    const text = resp.choices[0].message.content?.trim() ?? ''
    return text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/^#+\s*/gm, '').replace(/^[-*]\s+/gm, '').trim()
  } catch (e) {
    console.error('[OpenRouter] error:', e)
    return ''
  }
}

// ── AI TRIAL BALANCE PARSER ───────────────────────────────────────────────────
// Strategy: code parser extracts amounts (reliable), AI classifies ledgers (smart)
export async function parseTBWithAI(buffer: Buffer): Promise<{ ledgers: any[]; company: string; period: string }> {
  try {
    // Step 1: Code parser gets accurate amounts
    const { parseTallyTrialBalance } = await import('../engines/tallyParser')
    const { ledgers: codeLedgers, company, period } = parseTallyTrialBalance(buffer)

    if (!codeLedgers.length) return { company, period, ledgers: [] }

    // Step 2: AI classifies each ledger (name + tally group → Schedule III classification)
    const ledgerList = codeLedgers.map((l, i) => `${i + 1}. "${l.name}" | Group: "${l.group || 'Unknown'}" | Dr: ${l.debit} | Cr: ${l.credit}`).join('\n')

    const system = `You are an expert Indian CA. Classify each ledger as per Schedule III Companies Act 2013.
For EACH ledger return JSON with:
- "i": index number (1-based, same as input)
- "classification": exactly one of "Asset", "Liability", "Income", "Expense"
- "correct_group": the correct Schedule III group name
- "bs_or_pl": "BS" for Balance Sheet items (Assets/Liabilities), "PL" for P&L items (Income/Expense)

Classification rules:
Asset = Cash, Bank, Debtors, Fixed Assets, Investments, Loans Given, Prepaid, Deposits Paid, TDS Receivable, GST Input Credit
Liability = Capital, Loans Taken, Creditors, Current Liabilities, Duties & Taxes, GST Payable, TDS Payable, Provisions, Advance from Customer
Income = Sales, Revenue, Service Income, Commission Received, Interest Received, Discount Received
Expense = Rent, Salary, Commission Paid, Marketing, Utilities, Repairs, Professional Fees, Depreciation, any cost/charge/expense

Return ONLY a JSON array. No explanation.
[{"i":1,"classification":"Asset","correct_group":"Cash & Bank","bs_or_pl":"BS"},...]`

    const client = getClient()
    const resp = await client.chat.completions.create({
      model: CRITIC_MODEL,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Classify these ${codeLedgers.length} ledgers:\n\n${ledgerList}` },
      ],
    })

    const raw2 = resp.choices[0].message.content?.trim() ?? '[]'
    const match = raw2.match(/\[[\s\S]*\]/)
    const aiResults: any[] = match ? JSON.parse(match[0]) : []

    // Build lookup by index
    const aiMap: Record<number, any> = {}
    aiResults.forEach(r => { if (r.i) aiMap[r.i] = r })

    // Step 3: Merge code amounts + AI classification
    const ledgers = codeLedgers.map((l, idx) => {
      const ai = aiMap[idx + 1] || {}
      return {
        name: l.name,
        group: l.group || '',
        debit: l.debit,
        credit: l.credit,
        balance: l.balance,
        classification: ai.classification || '',
        correct_group: ai.correct_group || l.group || '',
        bs_or_pl: ai.bs_or_pl || 'BS',
      }
    })

    return { company, period, ledgers }
  } catch (e) {
    console.error('[parseTBWithAI] error:', e)
    return { company: 'Company', period: 'FY 2025-26', ledgers: [] }
  }
}

// ── AI DAYBOOK PARSER ─────────────────────────────────────────────────────────
export async function parseDaybookWithAI(buffer: Buffer): Promise<any[]> {
  try {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]

    // Send in chunks of 150 rows max
    const dataRows = raw.slice(0, 300)
    const textRows = dataRows.map(row =>
      row.map(c => String(c ?? '').trim()).filter(Boolean).join(' | ')
    ).filter(Boolean).join('\n')

    const system = `You are an expert in Tally accounting software daybook exports.
Parse this Tally Daybook and return a JSON array of transactions.

Each row in Tally daybook has: Date, Particulars (party/ledger name), Voucher Type (Payment/Receipt/Journal/Contra/Sales/Purchase), Voucher No, Debit amount, Credit amount.
Some rows are continuation rows of the same voucher (same voucher number, no date).

Return ONLY valid JSON array, no explanation:
[
  {
    "date": "YYYY-MM-DD",
    "particulars": "party or ledger name",
    "vchType": "Payment|Receipt|Journal|Contra|Sales|Purchase|Credit Note|Debit Note",
    "vchNo": "voucher number",
    "debit": 12345,
    "credit": 0,
    "vid": 1
  }
]`

    const client = getClient()
    const resp = await client.chat.completions.create({
      model: AUDIT_MODEL,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Parse this Tally Daybook:\n\n${textRows}` },
      ],
    })

    const raw2 = resp.choices[0].message.content?.trim() ?? '[]'
    const match = raw2.match(/\[[\s\S]*\]/)
    if (!match) return []
    return JSON.parse(match[0])
  } catch (e) {
    console.error('[parseDaybookWithAI] error:', e)
    return []
  }
}

export interface CriticVerdict {
  confirmed: boolean
  confidence: 'high' | 'medium' | 'low'
  reason: string
  penalty: string
  action: string
}

export async function runCriticAI(findings: { type: string; detail: string }[]): Promise<CriticVerdict[]> {
  if (findings.length === 0) return []

  const client = getClient()
  const system = `You are a senior Chartered Accountant and tax lawyer in India with 20 years of experience.
You are reviewing audit findings generated by an automated rule engine.
Your job: verify each finding for accuracy. The rule engine sometimes flags false positives.

For EACH finding respond with a JSON object in this exact format:
{"confirmed": true/false, "confidence": "high/medium/low", "reason": "one sentence why confirmed or rejected", "penalty": "exact penalty under Indian law if confirmed, else empty string", "action": "one specific action the CA must take, else empty string"}

Respond with a JSON array — one object per finding, in the same order.
No explanation outside the JSON array. Only valid JSON.`

  const userContent = `Verify these ${findings.length} audit findings:\n\n` +
    findings.map((f, i) => `${i + 1}. [${f.type}] ${f.detail}`).join('\n')

  try {
    const resp = await client.chat.completions.create({
      model: CRITIC_MODEL,
      max_tokens: 150 * findings.length + 200,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    })

    const raw = resp.choices[0].message.content?.trim() ?? '[]'
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return findings.map(() => ({ confirmed: true, confidence: 'medium' as const, reason: 'Critic AI parse error — defaulting to confirmed', penalty: '', action: '' }))
    return JSON.parse(match[0]) as CriticVerdict[]
  } catch (e) {
    console.error('[CriticAI] error:', e)
    return findings.map(() => ({ confirmed: true, confidence: 'low' as const, reason: 'Critic AI unavailable — manually verify', penalty: '', action: '' }))
  }
}

export async function chatCA(
  userMessage: string,
  context: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  maxTokens = 300
): Promise<string> {
  const system = `You are a senior CA in India. Answer in plain text only — no markdown, no stars, no hashes.
STRICT RULES:
- Maximum 5 lines. Never more.
- Plain sentences only.
- Use Rs. for amounts.
- Cite one law section if relevant.
- If you don't have the data, say so in one line.
Tone: WhatsApp message from a CA. Short, direct, useful.

CLIENT DATA:
${context}`

  const client = getClient()
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    ...history.slice(-10),
    { role: 'user', content: userMessage },
  ]

  const resp = await client.chat.completions.create({
    model: AUDIT_MODEL,
    max_tokens: maxTokens,
    messages,
  })
  return resp.choices[0].message.content?.trim() ?? ''
}


// ── AI BANK STATEMENT PARSER (PDF or Excel) ───────────────────────────────────
export async function parseBankStatementWithAI(buffer: Buffer, filename: string): Promise<any[]> {
  try {
    let text = ''

    if (filename.toLowerCase().endsWith('.pdf')) {
      // Extract text from PDF
      const pdfData = await pdfParse(buffer)
      text = pdfData.text.slice(0, 8000) // limit to avoid token overflow
    } else {
      // Excel bank statement
      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]
      text = raw.slice(0, 300).map(row =>
        row.map(c => String(c ?? '').trim()).join(' | ')
      ).filter(Boolean).join('\n').slice(0, 8000)
    }

    const system = `You are an expert at reading Indian bank statements (HDFC, ICICI, SBI, Axis, Kotak etc).
Parse every transaction and return a JSON array.

Return ONLY valid JSON array, no explanation:
[
  {
    "date": "YYYY-MM-DD",
    "description": "narration/description",
    "debit": 5000,
    "credit": 0,
    "balance": 125000,
    "ref_no": "reference number if available"
  }
]

Rules:
- date must be YYYY-MM-DD format
- debit = money going OUT of account (withdrawal, payment)
- credit = money coming IN to account (deposit, receipt)
- balance = closing balance after transaction (0 if not shown)
- Skip header rows, opening balance rows, closing balance rows`

    const client = getClient()
    const resp = await client.chat.completions.create({
      model: CRITIC_MODEL,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Parse this bank statement:\n\n${text}` },
      ],
    })

    const raw2 = resp.choices[0].message.content?.trim() ?? '[]'
    const match = raw2.match(/\[[\s\S]*\]/)
    if (!match) return []
    return JSON.parse(match[0])
  } catch (e) {
    console.error('[parseBankStatementWithAI] error:', e)
    return []
  }
}

