# VirtualCA V2 — How to Start

## One-time setup

### 1. Supabase (Pro plan)
- Go to Supabase → SQL Editor → paste contents of `SUPABASE_SETUP.sql` → Run
- Go to Storage → New bucket → Name: `virtualca-files` → Private

### 2. Fill in backend/.env
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...   (service_role key from Settings → API)
OPENROUTER_API_KEY=sk-or-v1-...
```

### 3. Install dependencies (first time only)
```
cd "virtual ca v2/backend"
npm install

cd "virtual ca v2/frontend"
npm install
```

---

## Every time — Start the app

### Terminal 1: Backend
```
cd "C:\Users\sagar\Downloads\virtual ca v2\backend"
npm run dev
```

### Terminal 2: Frontend
```
cd "C:\Users\sagar\Downloads\virtual ca v2\frontend"
npm start
```

Then open: http://localhost:3000

---

## Done — Phase 1 features
- Sign up / Login
- Upload Trial Balance + Daybook
- Run Quick Audit (score + 7 sections + AI insight)
- Ask Your CA (issue-by-issue chat)
