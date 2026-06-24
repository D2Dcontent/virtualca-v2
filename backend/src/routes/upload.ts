import { Router } from 'express'
import multer from 'multer'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getClient, BUCKET } from '../db/supabase'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

router.post('/files', requireAuth, upload.fields([
  { name: 'trial_balance', maxCount: 1 },
  { name: 'daybook', maxCount: 1 },
]), async (req: AuthRequest, res) => {
  const cid = req.companyId!
  const files = req.files as Record<string, Express.Multer.File[]>
  const sb = getClient()
  const meta: Record<string, { filename: string; uploaded_at: string }> = {}

  for (const [key, fileArr] of Object.entries(files)) {
    const file = fileArr[0]
    const remotePath = `company_${cid}/${key}_${Date.now()}.xlsx`
    await sb.storage.from(BUCKET).upload(remotePath, file.buffer, { upsert: true, contentType: file.mimetype })
    meta[key] = { filename: file.originalname, uploaded_at: new Date().toISOString() }
    meta[`${key}_exists`] = true as any
    meta[`${key}_path`] = remotePath as any
  }

  // Merge with existing meta
  const { data: existing } = await sb.from('files_meta').select('meta').eq('company_id', cid).single()
  const merged = { ...(existing?.meta ?? {}), ...meta }
  await sb.from('files_meta').upsert({ company_id: cid, meta: merged })

  return res.json({ ok: true, files: meta })
})

router.get('/status', requireAuth, async (req: AuthRequest, res) => {
  const sb = getClient()
  const { data } = await sb.from('files_meta').select('meta').eq('company_id', req.companyId!).single()
  return res.json(data?.meta ?? {})
})

export default router
