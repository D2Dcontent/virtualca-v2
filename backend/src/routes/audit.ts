import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getClient, BUCKET } from '../db/supabase'
import { runAuditFromParsed, runAudit } from '../engines/auditEngine'
import { callModel, runCriticAI, CriticVerdict } from '../ai/openrouter'

const router = Router()

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const cid = req.companyId!
  const sb = getClient()

  const { data: metaRow } = await sb.from('files_meta').select('meta').eq('company_id', cid).single()
  const meta = metaRow?.meta ?? {}

  if (!meta.trial_balance_path && !meta.daybook_path) return res.status(400).json({ error: 'Trial balance file not uploaded' })

  // If we have AI-parsed data, use it — otherwise fall back to raw Excel
  let result: any
  if (meta.parsed_tb) {
    result = runAuditFromParsed(meta.parsed_tb, meta.parsed_daybook ?? null)
  } else {
    // Legacy: download raw files and parse with code parser
    let daybookBuffer: Buffer | null = null
    let tbBuffer: Buffer | null = null
    if (meta.daybook_path) {
      const { data: dbData } = await sb.storage.from(BUCKET).download(meta.daybook_path)
      if (dbData) daybookBuffer = Buffer.from(await dbData.arrayBuffer())
    }
    if (meta.trial_balance_path) {
      const { data: tbData } = await sb.storage.from(BUCKET).download(meta.trial_balance_path)
      if (tbData) tbBuffer = Buffer.from(await tbData.arrayBuffer())
    }
    const primaryBuffer = daybookBuffer ?? tbBuffer
    if (!primaryBuffer) return res.status(500).json({ error: 'Could not load uploaded files' })
    result = runAudit(primaryBuffer, tbBuffer, meta.company_name ?? '', meta.period ?? '')
  }

  const aiPrompt = `You are a senior CA in India. Answer in plain text only, no markdown, no stars. Maximum 3 lines. Plain sentences. Use Rs. for amounts.`
  const aiData = `Company: ${result.summary.company}\nScore: ${result.summary.score}/100\nCritical: ${result.summary.critical} | Warnings: ${result.summary.warnings} | Questions: ${result.summary.questions}\nGive a 3-line audit summary with top risk and urgent action.`
  result.ai_insight = await callModel(aiPrompt, aiData, 200)

  const criticsInput: { type: string; detail: string }[] = [
    ...result.cash_violations.map((v: any) => ({ type: 'Cash Violation', detail: `Party: ${v.party}, Amount: Rs.${v.amount}, Section: ${v.section}` })),
    ...result.tds_compliance.map((t: any) => ({ type: 'TDS Issue', detail: t.issue })),
    ...result.outstanding.filter((o: any) => o.severity === 'Critical').map((o: any) => ({ type: 'Outstanding', detail: o.issue })),
    ...result.salary_compliance.filter((s: any) => s.severity === 'Critical').map((s: any) => ({ type: 'Salary/PT', detail: s.issue })),
  ]

  let critic_review: (CriticVerdict & { type: string; detail: string; confirmed_critical: boolean })[] = []
  if (criticsInput.length > 0) {
    const verdicts = await runCriticAI(criticsInput)
    critic_review = criticsInput.map((f, i) => ({
      ...f,
      ...(verdicts[i] ?? { confirmed: true, confidence: 'low', reason: '', penalty: '', action: '' }),
      confirmed_critical: verdicts[i]?.confirmed ?? true,
    }))
    const falsePositives = critic_review.filter(c => !c.confirmed_critical).length
    if (falsePositives > 0) {
      result.summary.critical = Math.max(0, result.summary.critical - falsePositives)
      result.summary.score = Math.min(100, result.summary.score + falsePositives * 15)
    }
  }
  ;(result as any).critic_review = critic_review

  const { data: existing } = await sb.from('audit_result').select('id').eq('company_id', cid).single()
  if (existing) {
    await sb.from('audit_result').update({ result, audited_at: new Date().toISOString() }).eq('company_id', cid)
  } else {
    await sb.from('audit_result').insert({ company_id: cid, result, audited_at: new Date().toISOString() })
  }

  await sb.from('audit_history').insert({
    company_id: cid,
    audited_at: new Date().toISOString(),
    company: result.summary.company,
    period: result.summary.period,
    score: result.summary.score,
    critical: result.summary.critical,
    warnings: result.summary.warnings,
    questions: result.summary.questions,
  })

  return res.json(result)
})

router.get('/result', requireAuth, async (req: AuthRequest, res) => {
  const sb = getClient()
  const { data } = await sb.from('audit_result').select('result, audited_at').eq('company_id', req.companyId!).single()
  return res.json(data?.result ?? {})
})

router.get('/history', requireAuth, async (req: AuthRequest, res) => {
  const sb = getClient()
  const { data } = await sb.from('audit_history')
    .select('*')
    .eq('company_id', req.companyId!)
    .order('audited_at', { ascending: false })
    .limit(20)
  return res.json(data ?? [])
})

export default router
