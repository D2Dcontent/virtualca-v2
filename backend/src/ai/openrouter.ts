import OpenAI from 'openai'
import * as XLSX from 'xlsx'

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
export async function parseTBWithAI(buffer: Buffer): Promise<{ ledgers: any[]; company: string; period: string }> {
  try {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]

    // Convert to plain text rows for AI
    const textRows = raw.slice(0, 200).map(row =>
      row.map(c => String(c ?? '').trim()).filter(Boolean).join(' | ')
    ).filter(Boolean).join('\n')

    const system = `You are an expert Indian CA and Tally accounting software specialist.
You will be given raw rows from a Tally Trial Balance Excel export.
Your job: parse every ledger and return a JSON array.

RULES:
1. Identify company name (usually in first 3 rows) and period (contains "to" and year)
2. Group hierarchy: Tally shows group names (like "Capital Account", "Indirect Expenses") followed by ledger names with debit/credit amounts
3. For each ledger return its name, group (from Tally hierarchy), debit amount, credit amount
4. Also classify each ledger as per Schedule III Companies Act 2013:
   - "Asset" = Fixed Assets, Current Assets, Cash, Bank, Debtors, Investments, Loans Given
   - "Liability" = Capital, Loans Taken, Creditors, Current Liabilities, Duties & Taxes
   - "Income" = Sales, Revenue, Income, Fees Received, Interest Received
   - "Expense" = All expense ledgers — Rent, Salary, Commission, Marketing, etc.
5. Identify the correct_group as per Schedule III (e.g. "Indirect Expenses", "Current Assets", "Trade Payables" etc.)

Return ONLY valid JSON in this exact format, no explanation:
{
  "company": "company name",
  "period": "period string",
  "ledgers": [
    {
      "name": "ledger name",
      "tally_group": "group from Tally",
      "debit": 12345,
      "credit": 0,
      "classification": "Asset|Liability|Income|Expense",
      "correct_group": "correct Schedule III group",
      "bs_or_pl": "BS|PL"
    }
  ]
}`

    const client = getClient()
    const resp = await client.chat.completions.create({
      model: CRITIC_MODEL,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Parse this Tally Trial Balance:\n\n${textRows}` },
      ],
    })

    const raw2 = resp.choices[0].message.content?.trim() ?? '{}'
    const match = raw2.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in AI response')
    const parsed = JSON.parse(match[0])
    return {
      company: parsed.company || 'Company',
      period: parsed.period || 'FY 2025-26',
      ledgers: (parsed.ledgers || []).map((l: any) => ({
        name: l.name,
        group: l.tally_group || '',
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        balance: (Number(l.debit) || 0) - (Number(l.credit) || 0),
        classification: l.classification || '',
        correct_group: l.correct_group || '',
        bs_or_pl: l.bs_or_pl || 'BS',
      }))
    }
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
