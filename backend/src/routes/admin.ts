import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getClient } from '../db/supabase'

const router = Router()

router.get('/stats', requireAuth, async (req: AuthRequest, res) => {
  const cid = req.companyId!
  const sb = getClient()

  const { data: history } = await sb
    .from('audit_history')
    .select('score, critical, warnings, audited_at, filename')
    .eq('company_id', cid)
    .order('audited_at', { ascending: false })
    .limit(20)

  const total_audits = history?.length || 0
  const last = history?.[0]

  res.json({
    total_audits,
    last_score: last?.score ?? null,
    last_critical: last?.critical ?? null,
    last_warnings: last?.warnings ?? null,
    history: history || [],
  })
})

router.delete('/history/:id', requireAuth, async (req: AuthRequest, res) => {
  const sb = getClient()
  await sb.from('audit_history').delete().eq('id', req.params.id).eq('company_id', req.companyId!)
  res.json({ ok: true })
})

export default router
