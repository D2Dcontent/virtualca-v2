import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rgszzzydbvxgcnraphfx.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnc3p6enlkYnZ4Z2NucmFwaGZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI5OTM2MCwiZXhwIjoyMDk3ODc1MzYwfQ._bYPF2AZA54rNmY9DQd95gXZqAApok3pwEOaEA0HNFs'

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

const SQL = `
CREATE TABLE IF NOT EXISTS companies (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_company_map (
  user_id UUID,
  company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'owner',
  PRIMARY KEY (user_id, company_id)
);
CREATE TABLE IF NOT EXISTS files_meta (
  company_id BIGINT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  meta JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_result (
  company_id BIGINT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  result JSONB NOT NULL,
  audited_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_history (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
  audited_at TIMESTAMPTZ DEFAULT now(),
  company TEXT,
  period TEXT,
  score INT,
  critical INT,
  warnings INT,
  questions INT
);
`

const { data, error } = await sb.rpc('exec_sql', { sql: SQL }).catch(() => ({ data: null, error: 'rpc not available' }))

if (error) {
  // Fallback: try each table via raw fetch to Supabase SQL API
  const PROJECT_REF = 'rgszzzydbvxgcnraphfx'
  const MGMT_ENDPOINT = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`

  const statements = SQL.split(';').map(s => s.trim()).filter(Boolean)

  for (const stmt of statements) {
    try {
      const r = await fetch(MGMT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ query: stmt + ';' })
      })
      const j = await r.json()
      console.log(stmt.split('\n')[0].trim(), '→', r.status === 200 ? 'OK' : JSON.stringify(j))
    } catch (e) {
      console.log('Error:', e.message)
    }
  }
} else {
  console.log('Tables created OK')
}

// Test connection
const { data: test, error: testErr } = await sb.from('companies').select('count').limit(1)
if (testErr) {
  console.log('Connection test failed:', testErr.message)
} else {
  console.log('✓ Supabase connected and tables ready')
}
