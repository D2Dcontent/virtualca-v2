import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getClient } from '../db/supabase'

const router = Router()

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const sb = getClient()
  const { data } = await sb.from('user_company_map')
    .select('company_id, companies(id, name)')
    .eq('user_id', req.userId!)
  return res.json(data?.map((d: any) => d.companies) ?? [])
})

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const { name } = req.body
  if (!name) return res.status(400).json({ error: 'Name required' })
  const sb = getClient()
  const { data: co } = await sb.from('companies').insert({ name, user_id: req.userId }).select().single()
  if (!co) return res.status(500).json({ error: 'Failed to create company' })
  await sb.from('user_company_map').insert({ user_id: req.userId, company_id: co.id })
  await sb.from('files_meta').insert({ company_id: co.id, meta: {} })
  return res.json(co)
})

router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  const cid = parseInt(req.params.id)
  const sb = getClient()
  await sb.from('companies').delete().eq('id', cid)
  await sb.from('user_company_map').delete().eq('company_id', cid)
  await sb.from('files_meta').delete().eq('company_id', cid)
  await sb.from('audit_result').delete().eq('company_id', cid)
  return res.json({ ok: true })
})

export default router
