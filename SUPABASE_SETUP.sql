-- =============================================
-- VirtualCA V2 — Supabase Schema Setup
-- Run this in Supabase SQL Editor (once)
-- =============================================

-- 1. Companies
CREATE TABLE IF NOT EXISTS companies (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Map user → company (many-to-many)
CREATE TABLE IF NOT EXISTS user_company_map (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'owner',
  PRIMARY KEY (user_id, company_id)
);

-- 3. Files metadata (JSON blob per company)
CREATE TABLE IF NOT EXISTS files_meta (
  company_id BIGINT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  meta JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Latest audit result per company (upsert pattern)
CREATE TABLE IF NOT EXISTS audit_result (
  company_id BIGINT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  result JSONB NOT NULL,
  audited_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Full audit history
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

-- 6. Storage bucket for uploaded files
-- Run this via Supabase dashboard → Storage → New bucket:
--   Name: virtualca-files
--   Private: YES (not public)

-- 7. RLS Policies (optional but recommended)
-- Enable RLS on all tables via dashboard, then add policies:
-- For now, service key bypasses RLS so it works without policies.

-- =============================================
-- Auth: Supabase handles auth.users automatically
-- Just enable Email/Password in Auth settings
-- =============================================
