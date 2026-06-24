import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rgszzzydbvxgcnraphfx.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnc3p6enlkYnZ4Z2NucmFwaGZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI5OTM2MCwiZXhwIjoyMDk3ODc1MzYwfQ._bYPF2AZA54rNmY9DQd95gXZqAApok3pwEOaEA0HNFs'
const PROJECT_REF = 'rgszzzydbvxgcnraphfx'

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

async function runSQL(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ query })
  })
  return { status: r.status, body: await r.json() }
}

const tables = {
  companies: `CREATE TABLE IF NOT EXISTS companies (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, user_id UUID, created_at TIMESTAMPTZ DEFAULT now())`,
  user_company_map: `CREATE TABLE IF NOT EXISTS user_company_map (user_id UUID, company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE, role TEXT DEFAULT 'owner', PRIMARY KEY (user_id, company_id))`,
  files_meta: `CREATE TABLE IF NOT EXISTS files_meta (company_id BIGINT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE, meta JSONB DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ DEFAULT now())`,
  audit_result: `CREATE TABLE IF NOT EXISTS audit_result (company_id BIGINT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE, result JSONB NOT NULL, audited_at TIMESTAMPTZ DEFAULT now())`,
  audit_history: `CREATE TABLE IF NOT EXISTS audit_history (id BIGSERIAL PRIMARY KEY, company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE, audited_at TIMESTAMPTZ DEFAULT now(), company TEXT, period TEXT, score INT, critical INT, warnings INT, questions INT)`,
}

console.log('Setting up VirtualCA V2 database...\n')

for (const [name, sql] of Object.entries(tables)) {
  const { status, body } = await runSQL(sql)
  if (status === 200 || status === 201 || (body && !body.error)) {
    console.log(`✓ ${name}`)
  } else {
    console.log(`  ${name} — ${JSON.stringify(body).slice(0, 120)}`)
  }
}

// Test connection
const { data, error } = await sb.from('companies').select('id').limit(1)
if (error) {
  console.log('\n✗ Connection test:', error.message)
} else {
  console.log('\n✓ All done — database ready')
}
