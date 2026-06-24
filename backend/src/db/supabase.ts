import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!

// Fresh client per call — avoids connection pool issues on free tier
export const getClient = () => createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { fetch: fetch as any },
  realtime: { transport: ws },
})

export const BUCKET = 'virtualca-files'
