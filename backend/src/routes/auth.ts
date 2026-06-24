import { Router } from 'express'
import { getClient } from '../db/supabase'

const router = Router()

router.post('/signup', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  const sb = getClient()
  const { data, error } = await sb.auth.signUp({ email, password })
  if (error) return res.status(400).json({ error: error.message })

  const user = data.user
  if (!user) return res.status(400).json({ error: 'Signup failed' })

  // Create default company
  const { data: co } = await sb.from('companies').insert({ name: 'My Books', user_id: user.id }).select().single()
  if (co) {
    await sb.from('user_company_map').insert({ user_id: user.id, company_id: co.id })
    await sb.from('files_meta').insert({ company_id: co.id, meta: {} })
  }

  return res.json({
    token: data.session?.access_token,
    email: user.email,
    user_id: user.id,
    company_id: co?.id,
  })
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  const sb = getClient()
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) return res.status(400).json({ error: 'Invalid email or password' })

  const user = data.user
  const { data: map } = await sb.from('user_company_map').select('company_id').eq('user_id', user.id).limit(1).single()

  return res.json({
    token: data.session.access_token,
    email: user.email,
    user_id: user.id,
    company_id: map?.company_id,
  })
})

export default router
