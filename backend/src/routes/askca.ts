import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getClient } from '../db/supabase'
import { chatCA } from '../ai/openrouter'
import { AuditResult } from '../engines/auditEngine'

const router = Router()

function buildContext(audit: AuditResult): string {
  if (!audit?.summary) return 'No audit data available.'
  const s = audit.summary
  const lines = [
    `Company: ${s.company} | Period: ${s.period}`,
    `Score: ${s.score}/100 | Critical: ${s.critical} | Warnings: ${s.warnings} | Questions: ${s.questions}`,
  ]
  if (audit.tds_compliance?.length) {
    lines.push(`TDS Issues: ${audit.tds_compliance.map(t => `${t.party} Rs.${t.tds_expected.toLocaleString('en-IN')} (${t.section})`).join(', ')}`)
  }
  if (audit.cash_violations?.length) {
    lines.push(`Cash Violations: ${audit.cash_violations.length} entries`)
  }
  if (audit.loans?.length) {
    lines.push(`Loans: ${audit.loans.map(l => `${l.ledger} Rs.${Math.abs(l.balance).toLocaleString('en-IN')}`).join(', ')}`)
  }
  if (audit.salary_compliance?.length) {
    lines.push(`Salary Issues: ${audit.salary_compliance.map(s => s.issue).join('; ')}`)
  }
  return lines.join('\n')
}

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const { question, context, history = [] } = req.body
  if (!question) return res.status(400).json({ error: 'question required' })

  const sb = getClient()
  const { data } = await sb.from('audit_result').select('result').eq('company_id', req.companyId!).single()
  const auditData = data?.result as AuditResult

  const ctx = context
    ? `${buildContext(auditData)}\n\nSelected Issue:\n${context}`
    : buildContext(auditData)

  try {
    const reply = await chatCA(question, ctx, history, 300)
    return res.json({ reply })
  } catch (e) {
    console.error('[AskCA]', e)
    return res.status(500).json({ error: 'AI error' })
  }
})

export default router
