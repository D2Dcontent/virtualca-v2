import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getClient } from '../db/supabase'

const router = Router()

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const cid = req.companyId!
  const sb = getClient()

  const { data: history } = await sb
    .from('audit_history')
    .select('score, critical, warnings, audited_at, filename')
    .eq('company_id', cid)
    .order('audited_at', { ascending: false })
    .limit(5)

  const last = history?.[0]
  res.json({
    last_score: last?.score ?? null,
    last_critical: last?.critical ?? null,
    last_warnings: last?.warnings ?? null,
    total_audits: history?.length ?? 0,
    recent: history ?? [],
  })
})

export default router
