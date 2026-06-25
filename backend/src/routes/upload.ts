import { Router } from 'express'
import multer from 'multer'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getClient, BUCKET } from '../db/supabase'
import { parseTBWithAI, parseDaybookWithAI } from '../ai/openrouter'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

router.post('/files', requireAuth, upload.fields([
  { name: 'trial_balance', maxCount: 1 },
  { name: 'daybook', maxCount: 1 },
  { name: 'balance_sheet', maxCount: 1 },
  { name: 'profit_loss', maxCount: 1 },
  { name: 'bank_statement', maxCount: 1 },
  { name: 'bank_tally', maxCount: 1 },
]), async (req: AuthRequest, res) => {
  const cid = req.companyId!
  const files = req.files as Record<string, Express.Multer.File[]>
  const sb = getClient()
  const meta: Record<string, any> = {}

  for (const [key, fileArr] of Object.entries(files)) {
    const file = fileArr[0]
    const remotePath = `company_${cid}/${key}_${Date.now()}.xlsx`
    await sb.storage.from(BUCKET).upload(remotePath, file.buffer, { upsert: true, contentType: file.mimetype })
    meta[key] = { filename: file.originalname, uploaded_at: new Date().toISOString() }
    meta[`${key}_exists`] = true
    meta[`${key}_path`] = remotePath
  }

  const { data: existing } = await sb.from('files_meta').select('meta').eq('company_id', cid).single()
  const merged = { ...(existing?.meta ?? {}), ...meta }
  await sb.from('files_meta').upsert({ company_id: cid, meta: merged })

  const buffers: Record<string, Buffer> = {}
  for (const [key, fileArr] of Object.entries(files)) buffers[key] = fileArr[0].buffer

  ;(async () => {
    try {
      const updates: Record<string, any> = {}
      if (buffers['trial_balance']) {
        console.log(`[upload] AI parsing TB for company ${cid}...`)
        const parsed = await parseTBWithAI(buffers['trial_balance'])
        updates['parsed_tb'] = parsed
        updates['parsed_tb_at'] = new Date().toISOString()
        console.log(`[upload] TB parsed: ${parsed.ledgers.length} ledgers`)
      }
      if (buffers['daybook']) {
        console.log(`[upload] AI parsing Daybook for company ${cid}...`)
        const parsed = await parseDaybookWithAI(buffers['daybook'])
        updates['parsed_daybook'] = parsed
        updates['parsed_daybook_at'] = new Date().toISOString()
        console.log(`[upload] Daybook parsed: ${parsed.length} entries`)
      }
      if (Object.keys(updates).length) {
        const { data: cur } = await sb.from('files_meta').select('meta').eq('company_id', cid).single()
        await sb.from('files_meta').upsert({ company_id: cid, meta: { ...(cur?.meta ?? {}), ...updates } })
      }
    } catch (err) {
      console.error('[upload] AI parse error:', err)
    }
  })()

  return res.json({ ok: true, files: meta, parsing: true })
})

router.get('/status', requireAuth, async (req: AuthRequest, res) => {
  const sb = getClient()
  const { data } = await sb.from('files_meta').select('meta').eq('company_id', req.companyId!).single()
  const m = data?.meta ?? {}
  const { parsed_tb, parsed_daybook, ...rest } = m
  return res.json({ ...rest, tb_parsed: !!parsed_tb, daybook_parsed: !!parsed_daybook })
})

export default router

