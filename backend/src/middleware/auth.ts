import { Request, Response, NextFunction } from 'express'
import { getClient } from '../db/supabase'

export interface AuthRequest extends Request {
  userId?: string
  companyId?: number
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const companyId = parseInt(req.headers['x-company-id'] as string)

  if (!token) return res.status(401).json({ error: 'No token' })

  const sb = getClient()

  // Verify token
  const { data: { user }, error } = await sb.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'Invalid token' })

  // Verify company ownership
  if (companyId) {
    const { data } = await sb.from('user_company_map')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .single()

    if (!data) return res.status(403).json({ error: 'Access denied to this company' })
  }

  req.userId = user.id
  req.companyId = companyId || undefined
  next()
}
