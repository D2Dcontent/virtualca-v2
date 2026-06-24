# VirtualCA — Complete Developer Documentation

**Last Updated:** June 2026  
**Built by:** Sagar Pathak, Kolkata  
**Live URL:** https://virtual-ca.onrender.com

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [All Features](#4-all-features)
5. [All API Endpoints](#5-all-api-endpoints)
6. [Database Schema](#6-database-schema)
7. [File Structure](#7-file-structure)
8. [AI Integration](#8-ai-integration)
9. [Authentication](#9-authentication)
10. [Known Issues and Fixes](#10-known-issues-and-fixes)
11. [Deployment](#11-deployment)
12. [How to Run Locally](#12-how-to-run-locally)

---

## 1. Project Overview

VirtualCA is an AI-powered accounting audit tool built for Indian businesses that use Tally. It allows a business owner or accountant to upload their Tally-exported files (Trial Balance, Daybook, Bank Statement, Balance Sheet, P&L) and instantly get:

- Audit reports with compliance scores
- Detection of cash violations (Section 40A(3))
- TDS compliance gaps
- GST return summaries
- Bank reconciliation
- Party ledger reconciliation
- Shares P&L with capital gains tax
- Professional Tax analysis
- Cash Flow Statement (AS-3 format)
- Missing documents checker
- An AI-powered CA chatbot that can answer questions based on the uploaded data

**Who it is for:** Small and medium businesses in India using Tally (Tally Prime or Tally ERP 9). The user exports their data to Excel from Tally and uploads it to VirtualCA.

**Business purpose:** Replace the need for an expensive CA for routine compliance checking. Provide instant audit reports, flag violations, and give AI-backed explanations — all without needing to understand accounting deeply.

**Multi-company support:** One user can manage multiple companies (e.g., a CA firm managing several clients). Each company gets its own isolated data.

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Backend | Python + Flask | REST API, port 5050 locally |
| Frontend | React 18 | Create React App, served from Flask's build folder |
| Database | Supabase (PostgreSQL) | Auth + all data storage |
| File Storage | Supabase Storage | Bucket: `virtualca-files` |
| AI | OpenRouter → Claude Haiku 4.5 | For CA chat and insights |
| Deployment | Render.com | Free/paid tier, auto-deploy from Git |
| Excel Parsing | pandas + openpyxl | Reads Tally-exported Excel files |
| PDF Parsing | pdfplumber | Bank statement PDFs |

**Python dependencies (requirements.txt):**
```
flask
flask-cors
pandas
openpyxl
pdfplumber
groq
anthropic
python-dotenv
supabase
openai
```

**Frontend dependencies (key):**
- react, react-dom, react-router-dom
- axios (HTTP client)

---

## 3. Architecture

### How the system fits together

```
User's Browser (React SPA)
        |
        | HTTP requests (axios)
        | Auth: Bearer token in header
        | Company: X-Company-ID in header
        v
Flask Backend (app.py)
        |
        |-- Reads/writes files locally (data/company_<cid>/)
        |-- Uploads/downloads files to Supabase Storage
        |-- Reads/writes data to Supabase PostgreSQL tables
        |-- Calls OpenRouter AI (Claude Haiku 4.5)
        v
Supabase
  - Auth (email/password → JWT)
  - Storage bucket: virtualca-files
  - Tables: companies, user_company_map, files_meta,
            audit_result, audit_history, personal_marks,
            feature_cache
```

### Frontend serving

Flask serves the React build as static files. The React app is built with `npm run build` and the output goes to `frontend/build/`. Flask serves `index.html` for all non-API routes (catch-all route), enabling React Router to handle client-side navigation.

### Request flow for a typical audit

1. User uploads Trial Balance (Excel) via the React UI
2. React sends `POST /api/audit` with the file as multipart/form-data
3. Flask saves the file locally under `data/company_<cid>/current_tb.xlsx`
4. Flask also uploads it to Supabase Storage at `company_<cid>/current_tb.xlsx`
5. Flask calls `run_ai_audit(tb_path, db_path)` in `ai_audit_engine.py`
6. Results are filtered for personal marks, cross-checked against bank statement
7. A compliance score is computed
8. Claude AI generates a 3-line insight via OpenRouter
9. Results are saved to `audit_result` table in Supabase
10. A history entry is saved to `audit_history` table
11. JSON response is returned to the React frontend

### Company isolation

Every data operation uses a `company_id` (cid). The cid comes from two sources:
- `X-Company-ID` HTTP header (sent by the frontend from `localStorage.company_id`)
- If the user is authenticated, Flask verifies they own that cid before using it
- If no valid cid found, Flask creates a default "My Books" company for the user

---

## 4. All Features

### 4.1 Quick Audit

**What it does:** Core audit of a Tally Trial Balance + Daybook. The fastest way to check the health of a company's books.

**Inputs:** Trial Balance (Excel), Daybook (Excel, optional)

**What it checks:**
- Ledger classification — are accounts grouped correctly in Tally? (e.g., TDS Receivable must be Current Assets, not Duties & Taxes)
- Cash violations — payments above Rs.10,000 in cash (Section 40A(3) of Income Tax Act)
- Cash receipts above Rs.2,00,000 (Section 269ST)
- Outstanding/abnormal balances — debtors, creditors, loans with unusual positions
- Large expenses — payments that look suspicious or need explanation
- TDS compliance — payments to contractors, professionals, landlords where TDS should have been deducted
- Salary compliance — PF, PT obligations
- Loans and director loans

**Output:** JSON with:
- `summary`: company name, period, score (0-100), critical count, warnings count, questions count
- `ledger_classification`: list of wrongly grouped ledgers
- `cash_violations`: cash payments above threshold
- `outstanding`: unusual balances
- `large_expenses`: big payments
- `loans`: loan ledgers found
- `bank_accounts`: bank account balances
- `tds_compliance`: TDS gaps
- `salary_compliance`: PF/PT issues
- `ai_insight`: 3-line CA commentary from Claude
- `personal_marks`: items the user has already explained as personal

**Score formula:**
```
Score = 100 - (critical_count × 5) - (warning_count × 2) - (question_count × 1)
Minimum score = 0
```

**Personal marks:** The user can mark any cash violation or large expense as "Personal" with a reason. These are stored permanently and excluded from future audit results so they don't keep appearing.

**Bank cross-check:** If a bank statement has been uploaded, cash violations that have a matching debit in the bank statement (same amount ± 1%, within 3 days) are automatically cleared and shown in a separate `cash_violations_bank_cleared` list.

**Frontend route:** `/quickaudit`  
**Backend file:** `ai_audit_engine.py`, `audit_engine.py`

---

### 4.2 Full Audit

**What it does:** Everything in Quick Audit, plus Balance Sheet audit, P&L audit, and Bank Reconciliation — all in one click.

**Inputs:** Balance Sheet (Excel, optional), P&L Statement (Excel, optional). Requires TB and Daybook already uploaded.

**What it adds over Quick Audit:**
- `bs_findings`: Balance Sheet compliance checks (Schedule III, Companies Act 2013)
- `pnl_findings`: P&L compliance checks
- `bankrec`: Bank reconciliation result embedded in the full report

**Frontend route:** `/fullaudit`  
**Backend file:** `audit_engine.py`, `bs_pnl_audit.py`

---

### 4.3 Missing Docs (Doc Checker)

**What it does:** Scans the Daybook for payments that likely lack supporting documents — invoices, receipts, bills.

**Inputs:** Daybook (uses already-uploaded file)

**Logic:** Looks for cash/bank payments to sundry creditors or expense ledgers above a threshold where no voucher number or bill reference is found in the narration.

**Output:**
- `flagged`: list of transactions at risk, each with date, narration, amount, ledger, risk level (High/Medium)
- `total_amount_at_risk`: total rupee amount of undocumented payments
- `ai_insight`: 3-line CA commentary citing IT Act Sec 40A(3) and ICAI SA-500

**Frontend route:** `/doc-checker`  
**Backend file:** `doc_checker.py`

---

### 4.4 Balance Sheet

**What it does:** Generates a structured Balance Sheet from the Trial Balance and checks it for compliance issues.

**Inputs:** Trial Balance (uses already-uploaded file)

**Output structure:**
```
{
  assets: {
    fixed_assets: amount,
    current_assets: amount,
    investments: amount,
    loans_advances: amount
  },
  liabilities: {
    capital: amount,
    long_term: amount,
    current_liabilities: amount,
    duties_taxes: amount
  },
  total_assets: amount,
  findings: [...],
  ai_insight: "3-line CA commentary"
}
```

**Compliance checks:** Checks against Companies Act 2013 Schedule III format requirements.

**Frontend route:** `/balance-sheet`  
**Backend file:** `balance_sheet.py`

---

### 4.5 Cash Flow AS-3

**What it does:** Generates an Indirect Method Cash Flow Statement per Accounting Standard AS-3.

**Inputs:** Trial Balance + Daybook (uses already-uploaded files)

**Output structure:**
```
{
  operating: { items: [...], net: amount },
  investing:  { items: [...], net: amount },
  financing:  { items: [...], net: amount },
  net_change: amount,
  opening_cash: amount,
  closing_cash: amount,
  ai_insight: "3-line CA commentary"
}
```

**Categorisation logic:**
- Operating: revenue, expenses, working capital changes
- Investing: fixed asset purchases/sales, investments
- Financing: loans, capital, dividends

**Frontend route:** `/cash-flow`  
**Backend file:** `cash_flow.py`

---

### 4.6 TDS Detector

**What it does:** Scans the Daybook for payments where TDS should have been deducted but was not.

**Inputs:** Trial Balance + Daybook (uses already-uploaded files)

**TDS thresholds applied:**
| Section | Payment Type | Threshold | Rate |
|---|---|---|---|
| 194C | Contractor payments | Rs.30,000 single / Rs.1,00,000 annual | 1-2% |
| 194J | Professional fees | Rs.50,000 | 10% |
| 194I | Rent | Rs.2,40,000/year | 10% |

**Output:**
- `missed`: list of payments with missed TDS — party, amount, section, estimated TDS amount
- `ai_insight`: 3-line CA commentary citing IT Act sections

**Frontend route:** `/tds-detect`  
**Backend file:** `tds_detector.py`

---

### 4.7 GST Returns

**What it does:** Parses GST-related ledgers from the Trial Balance and Daybook to give a GST summary.

**Inputs:** Trial Balance + Daybook (uses already-uploaded files)

**Output:**
- `output_gst`: total GST on sales (CGST + SGST + IGST output)
- `input_credit`: total Input Tax Credit available
- `net_payable`: output minus input
- `pending`: amount still to be paid
- `ai_insight`: 3-line CA commentary citing CGST Act 2017

**Frontend route:** `/gst-return`  
**Backend file:** `gst_return.py`

---

### 4.8 TDS Analysis

**What it does:** Full TDS liability statement — section-wise breakdown of TDS deducted vs deposited.

**Inputs:** Trial Balance (uses already-uploaded file)

**Output:**
- `sections`: list per TDS section — 194C, 194J, 194I, etc.
  - Each has: `tds_payable`, `tds_deposited`, `gap`
- `ai_insight`: 3-line CA commentary

**Note:** This page exists at `/tds` in the frontend (TDSAnalysis component) and is separate from TDS Detector (which scans the Daybook).

**Frontend route:** `/tds`  
**Backend file:** `audit_engine.py` (tds_compliance section)

---

### 4.9 PT Analysis

**What it does:** Professional Tax analysis for West Bengal (WB PT Act 1979 slabs). Calculates PT liability from salary ledgers and checks if it has been deducted and deposited.

**Inputs:** Trial Balance + Daybook (uses already-uploaded files)

**WB PT Slabs:**
| Monthly Salary | PT per Month |
|---|---|
| Up to Rs.10,000 | Nil |
| Rs.10,001 – Rs.15,000 | Rs.110 |
| Rs.15,001 – Rs.25,000 | Rs.130 |
| Rs.25,001 – Rs.40,000 | Rs.150 |
| Above Rs.40,000 | Rs.200 |

**Output:**
- `total_salary`: total salary in books
- `pt_shortfall`: PT not deducted from employees
- `pt_deducted`: PT deducted correctly
- `pt_unpaid_govt`: PT deducted but not deposited to government
- `findings`: list of individual issues
- `ai_insight`: 3-line CA commentary

**Frontend route:** `/pt-analysis`  
**Backend file:** `pt_engine.py`

---

### 4.10 Compliance Calendar

**What it does:** Shows upcoming and overdue Indian compliance deadlines. No file upload needed — uses the current date.

**Deadlines shown:**
| Compliance | Due Date | Notes |
|---|---|---|
| TDS Deposit | 7th of next month | Section 200, Income Tax Act |
| PT Deposit (WB) | 21st of current month | Deposit via GRIPS portal |
| GSTR-3B | 20th of next month | Monthly GST return + payment |
| Advance Tax | 15 Jun, 15 Sep, 15 Dec, 15 Mar | Cumulative 15%/45%/75%/100% |
| ITR Filing | 31 July | Individual and business ITR |

**Status per item:** `ok` (more than 7 days away), `upcoming` (within 7 days), `overdue` (past due)

**Frontend route:** `/compliance`  
**Backend file:** `app.py` (the `/api/compliance` route, no separate file)

---

### 4.11 Shares P&L

**What it does:** Calculates capital gains (STCG and LTCG) from share/equity trading entries in the books and estimates tax liability.

**Inputs:** Trial Balance + Daybook (uses already-uploaded files)

**Output:**
- `closed_trades`: number of completed buy/sell pairs
- `open_positions`: positions still open
- `stcg_total`: Short Term Capital Gains (held < 12 months)
- `stcg_tax`: Tax on STCG @ 15% (IT Act Sec 111A)
- `ltcg_total`: Long Term Capital Gains (held > 12 months)
- `ltcg_tax`: Tax on LTCG @ 10% above Rs.1 lakh (IT Act Sec 112A)
- `total_gain`: total gain
- `total_tax`: total estimated tax
- `ai_insight`: 3-line CA commentary

**Frontend route:** `/shares-pnl`  
**Backend file:** `shares_pnl.py`

---

### 4.12 Broker Rec

**What it does:** Reconcile Tally books against a broker's trade statement (Zerodha, HDFC Securities, etc.).

**Inputs:** Tally ledger export (Excel), Broker statement (Excel/CSV)

**Current status:** The API accepts both files and parses them correctly, but the column-matching logic is a stub — it returns 0 matched items with a note that manual column mapping is needed. This is a known incomplete feature.

**Frontend route:** `/broker-rec`  
**Backend:** `app.py` (`/api/broker-rec` route)

---

### 4.13 Party Ledger Rec

**What it does:** Reconcile your Tally books against a party's (vendor/customer) statement. Finds transactions in your books not in theirs, and vice versa.

**Inputs:** Your Tally ledger for that party (Excel), Party's statement (Excel), Party name

**Output:**
- `tally_balance`: closing balance per your books
- `party_balance`: closing balance per party's books
- `difference`: gap between the two
- `unmatched_tally`: transactions in your books not matched in party's
- `unmatched_party`: transactions in party's books not matched in yours
- `ai_insight`: 3-line CA commentary

**Frontend route:** `/party-rec`  
**Backend file:** `party_rec.py`

---

### 4.14 Bank Reconciliation

**What it does:** Reconcile the bank statement (PDF or Excel) against Tally's bank ledger (from Daybook).

**Inputs:** Bank Statement (PDF or Excel), Tally Bank Ledger (Excel, optional — falls back to Daybook)

**Supported banks:** ICICI, HDFC, SBI, Axis, Kotak, Yes Bank, PNB, Bank of Baroda

**Matching logic:**
- Matches by amount (exact) and date (within 3 days tolerance)
- Identifies: matched transactions, bank-only (in bank not in Tally), Tally-only (in Tally not in bank), duplicate entries, wrong dates

**Output:**
- `summary`:
  - `matched`: count of matched items
  - `match_pct`: match percentage
  - `bank_only`: items only in bank statement
  - `tally_only`: items only in Tally
  - `wrong_date`: items matched by amount but different date
  - `duplicates`: duplicate entries found
  - `closing_balance_bank`: closing balance per bank
  - `closing_balance_tally`: closing balance per Tally
  - `closing_balance_match`: boolean
- `matched_items`, `bank_only_items`, `tally_only_items`: detailed lists
- `ai_insight`: 3-line CA commentary

**Two modes:**
1. Upload fresh files directly on the Bank Rec page (`POST /api/bankrec`)
2. Use already-uploaded files from the Upload page (`POST /api/bankrec-existing`)

**Frontend route:** `/bankrec`  
**Backend file:** `bankrec_engine.py`

---

### 4.15 Ask Your CA (AI Chat)

**What it does:** An AI-powered CA chatbot that can answer accounting, tax, and compliance questions in plain English. Answers are grounded in the user's actual uploaded data.

**How it works:**
1. User types a question (e.g., "Why is my TDS payable showing under wrong group?")
2. The question is sent to Claude Haiku 4.5 via OpenRouter
3. The model receives: system prompt (Indian CA persona) + knowledge base (markdown files on GST, TDS, Tally, Audit) + the user's audit data (company name, all issues found, amounts)
4. Response is limited to 5 lines max, plain text, WhatsApp-style

**Context used:**
- Last audit result (all ledger issues, cash violations, outstanding balances, large expenses, TDS items, loans)
- Knowledge base: `knowledge/gst/`, `knowledge/income_tax/`, `knowledge/audit/`, `knowledge/accounting/`, `knowledge/tally/`

**History:** Maintains conversation history (last 10 turns) on the client side and sends it with each request.

**AI Explain:** Every audit finding in Quick Audit, Full Audit, and Bank Rec has an "Explain" button that calls `/api/ai-explain` with the specific finding. The system builds a targeted question and gets a focused explanation.

**Frontend route:** `/askca`  
**Backend files:** `ca_agent.py`, `knowledge_loader.py`

---

### 4.16 Journal Entry Guide

**What it does:** Answers journal entry questions. E.g., "What is the journal entry for TDS deduction on professional fees?"

**How it works:** Routes through the CA chat system (`ca_agent.py`). The question is sent as-is with the audit context.

**Note:** The frontend has a `getJournalEntry` API call in `api/index.js` pointing to `/api/journal-entry`, but this route is not present in `app.py` as a separate route — it is handled by the CA chat endpoint. This is a known inconsistency.

---

### 4.17 Dashboard

**What it does:** Landing page after login. Shows a summary of the last audit and recent history.

**Data shown:**
- `total_audits`: how many audits have been run for this company
- `last_score`: compliance score from last audit
- `last_critical`: critical issues from last audit
- `last_warnings`: warnings from last audit
- `recent`: last 3 audit history entries (date, file, score)
- `company`: company name
- `period`: audit period

**Frontend route:** `/dashboard`  
**Backend endpoint:** `GET /api/dashboard`

---

### 4.18 History

**What it does:** Shows all past audit runs for the selected company — date, file, score, critical count, warnings count.

**Data:** Pulled from the `audit_history` Supabase table, ordered by date descending, limit 50.

**Frontend route:** `/history`  
**Backend endpoint:** `GET /api/audit/history`

---

## 5. All API Endpoints

### Authentication

| Method | Route | Purpose | Input | Output |
|---|---|---|---|---|
| POST | `/api/auth/signup` | Create new user | `{email, password}` | `{token, email, user_id}` or `{error}` |
| POST | `/api/auth/login` | Login | `{email, password}` | `{token, email, user_id}` or `{error}` |
| GET | `/api/auth/me` | Get current user info | Bearer token header | `{user_id, company_id}` |

### Companies

| Method | Route | Purpose | Input | Output |
|---|---|---|---|---|
| GET | `/api/companies` | List user's companies | Bearer token | Array of company objects |
| POST | `/api/companies` | Create new company | `{name}` | Company object |
| DELETE | `/api/companies/<cid>` | Delete company | — | `{ok: true}` |
| POST | `/api/companies/<cid>/rename` | Rename company | `{name}` | `{ok: true}` |

### Files

| Method | Route | Purpose | Input | Output |
|---|---|---|---|---|
| POST | `/api/upload/files` | Upload TB + Daybook | Multipart: `trial_balance`, `daybook` | `{saved, status}` |
| POST | `/api/upload/bank-files` | Upload bank statement + tally ledger | Multipart: `bank_statement`, `tally_ledger` | `{saved, status}` |
| GET | `/api/files/status` | Check which files uploaded | — | `{tb, db, bs, pnl, bstmt, btally, tb_exists, ...}` |
| POST | `/api/clear-bank-files` | Clear bank files | — | `{ok: true}` |

### Audit

| Method | Route | Purpose | Input | Output |
|---|---|---|---|---|
| POST | `/api/audit` | Run Quick Audit | Multipart: `trial_balance`, `daybook` (optional if already uploaded) | Full audit result JSON |
| POST | `/api/full-audit` | Run Full Audit | Multipart: `balance_sheet`, `pnl` (optional) | Full audit result with BS/P&L findings |
| GET | `/api/audit/last` | Get last audit result | — | Saved audit result JSON |
| GET | `/api/audit/result` | Get audit result (same as last) | — | Saved audit result JSON |
| POST | `/api/audit/clear` | Clear saved audit result | — | `{ok: true}` |
| GET | `/api/audit/history` | Get audit history | — | Array of history entries |
| POST | `/api/audit/mark-personal` | Mark a violation as personal | `{date, party, amount, reason}` | `{success, total_marks}` |
| DELETE | `/api/audit/mark-personal` | Unmark a personal item | `{date, party}` | `{success}` |
| GET | `/api/audit/personal-marks` | List personal marks | — | Array of marks |

### Bank Reconciliation

| Method | Route | Purpose | Input | Output |
|---|---|---|---|---|
| POST | `/api/bankrec` | Run bank rec with fresh files | Multipart: `bank_statement`, `tally_ledger` | Bank rec result JSON |
| POST | `/api/bankrec-existing` | Run bank rec with saved files | — | Bank rec result JSON |

### AI

| Method | Route | Purpose | Input | Output |
|---|---|---|---|---|
| POST | `/api/ca-chat` | Ask Your CA chat | `{message, context, history}` | `{reply}` |
| POST | `/api/ai-explain` | Explain a specific finding | `{finding, type}` | `{explanation}` |

### Features (all support GET to load cached result, POST to run fresh)

| Method | Route | Feature |
|---|---|---|
| GET/POST | `/api/balance-sheet` | Balance Sheet |
| GET/POST | `/api/tds-detect` | TDS Detector |
| GET/POST | `/api/gst-return` | GST Returns |
| GET/POST | `/api/shares-pnl` | Shares P&L |
| GET/POST | `/api/cash-flow` | Cash Flow AS-3 |
| GET/POST | `/api/doc-checker` | Missing Docs |
| GET/POST | `/api/pt-analysis` | PT Analysis |
| POST | `/api/party-rec` | Party Ledger Rec (always fresh upload) |
| POST | `/api/broker-rec` | Broker Rec (always fresh upload) |

### Dashboard and Compliance

| Method | Route | Purpose | Output |
|---|---|---|---|
| GET | `/api/dashboard` | Dashboard summary | `{total_audits, last_score, last_critical, last_warnings, recent, company, period}` |
| GET | `/api/compliance` | Compliance calendar | Array of deadline objects with status |

### Frontend Serving

| Method | Route | Purpose |
|---|---|---|
| GET | `/` | React app (index.html) |
| GET | `/<any-path>` | React app (catch-all for React Router) |
| GET | `/static/*` | React static assets |
| GET | `/favicon.ico` | Favicon |
| GET | `/asset-manifest.json` | React asset manifest |

---

## 6. Database Schema

All tables are in Supabase (PostgreSQL). The project uses the Supabase Python client with service role key.

### companies

Stores each company (client/business) being audited.

| Column | Type | Notes |
|---|---|---|
| id | int (PK, auto) | Company ID |
| name | text | Company name (e.g., "My Books", "ABC Pvt Ltd") |
| user_id | uuid | FK to Supabase auth.users — owner of this company |
| created_at | timestamp | Auto |

### user_company_map

Maps users to companies they can access. Supports a CA firm where one user manages many companies.

| Column | Type | Notes |
|---|---|---|
| id | int (PK, auto) | — |
| user_id | uuid | FK to auth.users |
| company_id | int | FK to companies.id |

### files_meta

Tracks which files have been uploaded for each company.

| Column | Type | Notes |
|---|---|---|
| id | int (PK, auto) | — |
| company_id | int | FK to companies.id |
| meta | jsonb | Dict with keys: `tb`, `db`, `bs`, `pnl`, `bstmt`, `btally` — each has `{filename, uploaded_at, size}` |

Example meta value:
```json
{
  "tb": {"filename": "TrialBalance.xlsx", "uploaded_at": "2026-06-01T10:00:00", "size": 45678},
  "db": {"filename": "Daybook.xlsx", "uploaded_at": "2026-06-01T10:01:00", "size": 123456}
}
```

### audit_result

Stores the latest audit result for each company. Only one row per company (upserted on each audit run).

| Column | Type | Notes |
|---|---|---|
| id | int (PK, auto) | — |
| company_id | int | FK to companies.id (unique) |
| result | jsonb | Full audit result dict — the entire JSON returned by `/api/audit` |

### audit_history

Stores one row per audit run — a summary (not the full result).

| Column | Type | Notes |
|---|---|---|
| id | int (PK, auto) | — |
| company_id | int | FK to companies.id |
| filename | text | Trial balance filename |
| audited_at | text | ISO datetime string |
| company | text | Company name from TB |
| period | text | Period from TB |
| score | int | Compliance score |
| critical | int | Critical issue count |
| warnings | int | Warning count |
| questions | int | Question count |

### personal_marks

Stores items the user has marked as "personal" — these are excluded from audit results.

| Column | Type | Notes |
|---|---|---|
| id | int (PK, auto) | — |
| company_id | int | FK to companies.id |
| date | text | Transaction date (YYYY-MM-DD) |
| party | text | Party/ledger name |
| amount | float | Transaction amount |
| reason | text | User's explanation |

### feature_cache

Stores the last result of each feature per company. Used so the user doesn't lose their results when navigating between pages.

| Column | Type | Notes |
|---|---|---|
| id | int (PK, auto) | — |
| company_id | int | FK to companies.id |
| feature | text | Feature name: `balance_sheet`, `tds_detect`, `gst_return`, `shares_pnl`, `cash_flow`, `doc_checker`, `pt_analysis` |
| result | jsonb | Full feature result dict |

### Supabase Storage

**Bucket:** `virtualca-files`

Files are stored at path `company_<cid>/<filename>`:
- `company_1/current_tb.xlsx` — Trial Balance
- `company_1/current_db.xlsx` — Daybook
- `company_1/current_bs.xlsx` — Balance Sheet
- `company_1/current_pnl.xlsx` — P&L Statement
- `company_1/current_bank_stmt.xlsx` — Bank Statement
- `company_1/current_bank_tally.xlsx` — Tally Bank Ledger

Files are also cached locally at `data/company_<cid>/` on the server. Flask checks local cache first and downloads from Supabase if not present.

---

## 7. File Structure

```
virtualca/
├── app.py                  Main Flask application — all routes
├── supabase_client.py      Supabase DB + Storage helpers
├── openrouter_client.py    OpenRouter AI client (Claude Haiku 4.5)
├── ca_agent.py             Ask Your CA chatbot logic
├── ai_insights.py          Short AI insight generator for each feature
├── knowledge_loader.py     Loads knowledge base markdown files for AI
├── audit_engine.py         Core audit logic — TB parsing, ledger rules, cash violations
├── ai_audit_engine.py      AI-enhanced audit wrapper
├── bankrec_engine.py       Bank reconciliation engine (PDF/Excel, multi-bank)
├── balance_sheet.py        Balance Sheet generator from TB
├── cash_flow.py            Cash Flow Statement (AS-3) generator
├── tds_detector.py         TDS missed deduction scanner
├── gst_return.py           GST data parser
├── shares_pnl.py           Shares capital gains calculator
├── doc_checker.py          Missing documents checker
├── party_rec.py            Party ledger reconciliation
├── pt_engine.py            Professional Tax analysis (WB slabs)
├── bs_pnl_audit.py         Balance Sheet + P&L compliance checks
├── generate_pdf.py         PDF report generation (utility)
├── analyzer.py             Utility analysis functions
├── requirements.txt        Python dependencies
│
├── knowledge/              AI knowledge base (markdown files)
│   ├── gst/                GST rules, sections, ITC logic
│   ├── income_tax/         TDS sections, advance tax, capital gains
│   ├── audit/              ICAI standards, audit rules
│   ├── accounting/         AS standards, ledger rules
│   └── tally/              Tally groups, voucher types, export formats
│
├── data/                   Local file cache (gitignored)
│   └── company_<cid>/      Per-company files (current_tb.xlsx, etc.)
│
└── frontend/
    ├── package.json
    ├── public/
    └── src/
        ├── App.js           React Router setup — all page routes
        ├── index.js         React entry point
        ├── index.css        Global styles
        ├── api/
        │   └── index.js     Axios client + all API call functions
        ├── components/
        │   ├── Sidebar.js   Navigation sidebar
        │   └── Header.js    Top header with company selector
        └── pages/
            ├── Login.js
            ├── Dashboard.js
            ├── QuickAudit.js
            ├── FullAudit.js
            ├── BankRec.js
            ├── TDSAnalysis.js
            ├── TDSDetect.js
            ├── Compliance.js
            ├── AskCA.js
            ├── History.js
            ├── Admin.js
            ├── BalanceSheet.js
            ├── GSTReturn.js
            ├── SharesPnL.js
            ├── CashFlow.js
            ├── PartyRec.js
            ├── DocChecker.js
            ├── BrokerRec.js
            └── PTAnalysis.js
```

### Utility / one-time scripts (not part of the running app)

| File | Purpose |
|---|---|
| `clean_demo.py` | Cleans demo data |
| `replace_modules.py` | Bulk module replacement script |
| `rewrite_pages.py` | Bulk page rewrite script |
| `replace_brtabs.py` | Replaces BrTabs components |

---

## 8. AI Integration

### Model used

**Claude Haiku 4.5** via OpenRouter (not direct Anthropic API). This is intentional — OpenRouter provides a single OpenAI-compatible endpoint that can route to any model.

```python
# openrouter_client.py
MODEL = 'anthropic/claude-haiku-4-5'
BASE_URL = 'https://openrouter.ai/api/v1'
```

### Where AI is used

| Feature | AI function | Purpose |
|---|---|---|
| Ask Your CA | `ca_agent.chat()` | Full conversation with audit context |
| AI Explain | `ca_agent.chat()` | Explain a specific audit finding |
| Quick Audit | `ai_insights.generate_insight('audit', ...)` | 3-line summary after each audit |
| Balance Sheet | `ai_insights.generate_insight('balance_sheet', ...)` | 3-line insight |
| Cash Flow | `ai_insights.generate_insight('cash_flow', ...)` | 3-line insight |
| TDS Detector | `ai_insights.generate_insight('tds_detect', ...)` | 3-line insight |
| GST Returns | `ai_insights.generate_insight('gst_return', ...)` | 3-line insight |
| PT Analysis | `ai_insights.generate_insight('pt_analysis', ...)` | 3-line insight |
| Bank Rec | `ai_insights.generate_insight('bank_rec', ...)` | 3-line insight |
| Party Rec | `ai_insights.generate_insight('party_rec', ...)` | 3-line insight |
| Shares P&L | `ai_insights.generate_insight('shares_pnl', ...)` | 3-line insight |
| Doc Checker | `ai_insights.generate_insight('doc_checker', ...)` | 3-line insight |

### Knowledge Base

The AI is grounded in domain-specific knowledge loaded from markdown files in `knowledge/`. These files are loaded once at startup by `knowledge_loader.py` and injected into every AI prompt.

Knowledge categories:
- `gst/` — GST rules, ITC, GSTR forms
- `income_tax/` — TDS sections (194C, 194J, 194I, etc.), advance tax, capital gains
- `audit/` — ICAI Auditing Standards (SA-500, etc.)
- `accounting/` — AS standards (AS-1, AS-3), ledger classification rules
- `tally/` — Tally groups, voucher types, how Tally exports work

### Ask Your CA system prompt

The CA persona is set with strict rules:
- Maximum 5 lines per response
- Plain text only (no markdown, no bullet points, no bold)
- Use "Rs." for amounts (not ₹ symbol in text)
- Cite one law section if relevant
- Tone: like a WhatsApp message from a CA — short, direct, useful

### Token limits

- `ca_agent.chat()`: 300 max tokens
- `ai_insights.generate_insight()`: 300 max tokens

---

## 9. Authentication

### How it works

VirtualCA uses Supabase Auth (email/password). Here is the complete auth flow:

**Signup:**
1. User submits email + password on the Login page
2. `POST /api/auth/signup` → `supabase_client.auth_signup()`
3. Supabase creates the user in `auth.users`
4. If email confirmation is disabled (which it is for this project): returns `{token, email, user_id}` immediately
5. If email confirmation is required: returns `{email, needs_confirmation: true}`
6. Frontend stores `token` in `localStorage.auth_token`

**Login:**
1. User submits email + password
2. `POST /api/auth/login` → `supabase_client.auth_login()`
3. Returns `{token, email, user_id}`
4. Frontend stores token in `localStorage`
5. Frontend calls `GET /api/auth/me` to get the `company_id`
6. `company_id` is stored in `localStorage.company_id`

**Every subsequent request:**
1. Axios interceptor reads `localStorage.auth_token`
2. Adds `Authorization: Bearer <token>` header
3. Also adds `X-Company-ID: <company_id>` header
4. Flask reads the Bearer token, calls Supabase to verify it and get the `user_id`
5. Flask verifies the user owns the requested `company_id`

**Company ownership check (get_cid() function):**
1. Check `companies.user_id = user_id` for the requested cid — direct ownership
2. If not: check `user_company_map` for a row linking this user to this cid
3. If the company exists but isn't linked: auto-link it (insert into `user_company_map`)
4. If no cid provided: get or create the user's default company ("My Books")

**Token storage:**
- `localStorage.auth_token` — JWT from Supabase
- `localStorage.company_id` — currently selected company
- `localStorage.logged_in` — boolean flag for guest/demo mode

**No token path (legacy/demo):**
If no Bearer token is present, Flask defaults `company_id = 1` from the `X-Company-ID` header. This allows unauthenticated demo access to company 1.

---

## 10. Known Issues and Fixes

### 10.1 Supabase Thread Safety (FIXED)

**Problem:** The original code created one Supabase client at module import time and reused it across all requests. When Flask handled concurrent requests in multiple threads, the shared socket state caused `[Errno 11] EAGAIN` errors.

**Fix:** `supabase_client.py` now calls `create_client()` fresh on every function call:
```python
def get_client() -> Client:
    # Create a fresh client per call — avoids [Errno 11] EAGAIN from shared
    # socket state when Flask handles concurrent requests in multiple threads.
    return create_client(SUPABASE_URL, SUPABASE_KEY)
```

### 10.2 localStorage Company ID Caching Issue

**Problem:** When a user switched companies in the Header dropdown, some pages still showed data from the old company because they had cached the result in component state.

**Fix:** Feature pages do a GET request on mount to load the cached result for the current company_id. Since the `X-Company-ID` header is always sent from localStorage, switching companies via the header dropdown and then re-running a feature works correctly.

### 10.3 audit_result id Issue (FIXED)

**Problem:** Early versions had a bug where `save_audit_result()` tried to do an upsert using a column named `id` that was auto-generated. This caused duplicate row inserts for the same company.

**Fix:** The code now explicitly checks if a row exists for the company_id before deciding to INSERT or UPDATE:
```python
res = sb.table('audit_result').select('id').eq('company_id', cid).execute()
if res.data:
    sb.table('audit_result').update({'result': result}).eq('company_id', cid).execute()
else:
    sb.table('audit_result').insert({'company_id': cid, 'result': result}).execute()
```
Same pattern is used for `files_meta` and `feature_cache`.

### 10.4 Zero Score Bug

**Problem:** Sometimes a saved audit_result would load and show 0 critical, 0 warnings, score 0 even though the files were present.

**Fix:** `/api/audit/last` adds a `_stale_warning` flag when it detects this condition, prompting the user to re-run the audit:
```python
if (s.get('critical', 0) == 0 and s.get('warnings', 0) == 0
        and s.get('questions', 0) == 0 and s.get('score', 0) == 0
        and sb.load_files_meta(cid).get('tb')):
    data['_stale_warning'] = 'Saved result shows 0 issues — please re-run audit.'
```

### 10.5 Company Auto-Link

**Problem:** Users who existed before the `user_company_map` table was added were not finding their companies.

**Fix:** `get_or_create_company_for_user()` first checks `user_company_map`, then falls back to checking `companies.user_id` directly, and if found, backfills the map table. Also, `get_cid()` auto-links a company to a user if the company exists but isn't in the map yet.

### 10.6 auto_adjust=True Bug (yfinance — not directly in this project)

This is noted in the CLAUDE.md as a general rule: never use `auto_adjust=True` for NSE stocks in yfinance. Not applicable to VirtualCA directly.

### 10.7 Personal Marks Not Filtering

**Problem:** Personal marks were saved but not applied to filter results when loading a saved audit.

**Fix:** The filtering is done in the `/api/audit` endpoint at run time (before saving). The saved result already has personal items removed. When re-running an audit, personal marks are fetched fresh and applied.

### 10.8 Bank Statement Path — Pre-Multi-Company Migration

When downloading the bank statement, there is a fallback to try the old pre-multi-company storage path if the new company-scoped path doesn't exist:
```python
if not bstmt_found:
    bstmt_found = sb.download_file('current_bank_stmt.xlsx', bstmt_lp)
```
This handles users whose files were uploaded before company scoping was added.

### 10.9 Broker Rec — Incomplete Feature

The `/api/broker-rec` route accepts and parses files correctly but the actual column matching is not implemented. It returns a stub response with `matched_count: 0` and a note. This is a known incomplete feature.

---

## 11. Deployment

VirtualCA is deployed on **Render.com**.

### Services needed

1. **Web Service** — Python/Flask backend + serves React build

### Environment variables (set in Render dashboard)

| Variable | Description | Example |
|---|---|---|
| `SUPABASE_URL` | Your Supabase project URL | `https://arlsvbjvsikzdeqfufut.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (not anon key) | `eyJhbG...` |
| `OPENROUTER_API_KEY` | OpenRouter API key | `sk-or-v1-...` |
| `PORT` | Port for Flask (Render sets this automatically) | `10000` |

**Important:** Use the **service role key**, not the anon key. The service role key bypasses Row Level Security (RLS) and is required for server-side operations. Keep it secret — it is only on the server, never in the frontend.

### Build and deploy steps

1. Push code to GitHub
2. In Render, create a new Web Service connected to the repo
3. Set the build command:
   ```
   cd frontend && npm install && npm run build && cd .. && pip install -r requirements.txt
   ```
4. Set the start command:
   ```
   python app.py
   ```
5. Set environment variables as listed above
6. Deploy

### Why manual deploy is sometimes needed

Render's free tier can be slow to detect pushes. If changes don't appear, go to Render dashboard → Manual Deploy → Deploy latest commit. After deploy, do a hard refresh in the browser (Ctrl+Shift+R) because the React app is cached by the browser.

### Supabase setup

The following tables must exist in Supabase (SQL to create them):

```sql
-- Companies
create table companies (
  id serial primary key,
  name text not null,
  user_id uuid references auth.users(id),
  created_at timestamptz default now()
);

-- User-Company mapping
create table user_company_map (
  id serial primary key,
  user_id uuid references auth.users(id),
  company_id int references companies(id)
);

-- Files metadata
create table files_meta (
  id serial primary key,
  company_id int references companies(id),
  meta jsonb default '{}'
);

-- Audit result (latest per company)
create table audit_result (
  id serial primary key,
  company_id int references companies(id),
  result jsonb default '{}'
);

-- Audit history
create table audit_history (
  id serial primary key,
  company_id int references companies(id),
  filename text,
  audited_at text,
  company text,
  period text,
  score int,
  critical int,
  warnings int,
  questions int
);

-- Personal marks
create table personal_marks (
  id serial primary key,
  company_id int references companies(id),
  date text,
  party text,
  amount float,
  reason text
);

-- Feature cache
create table feature_cache (
  id serial primary key,
  company_id int references companies(id),
  feature text,
  result jsonb default '{}'
);
```

Also create the storage bucket:
1. Go to Supabase → Storage → New bucket
2. Name: `virtualca-files`
3. Set as private (the service role key accesses it server-side)

---

## 12. How to Run Locally

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm

### Step 1 — Clone and install Python dependencies

```bash
cd C:\Users\sagar\Downloads\virtualca
pip install -r requirements.txt
```

### Step 2 — Set up environment variables

Create a `.env` file in the `virtualca/` folder:

```
SUPABASE_URL=https://arlsvbjvsikzdeqfufut.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
OPENROUTER_API_KEY=your_openrouter_key_here
```

The `app.py` automatically loads `.env` if `python-dotenv` is installed (it is in `requirements.txt`).

### Step 3 — Build the React frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

This creates `frontend/build/` which Flask will serve.

### Step 4 — Run the Flask server

```bash
python app.py
```

Flask will start on port 5050:
```
VirtualCA backend running on port 5050
```

### Step 5 — Open in browser

```
http://localhost:5050
```

### Development mode (hot reload for frontend)

If you are actively developing the React frontend, run the React dev server separately:

```bash
# Terminal 1 — Backend
python app.py

# Terminal 2 — Frontend dev server
cd frontend
npm start
```

The React dev server runs at `http://localhost:3000` and the `REACT_APP_API_URL` in `frontend/src/api/index.js` defaults to `https://virtual-ca.onrender.com`. For local dev, either:
- Set `REACT_APP_API_URL=http://localhost:5050` in a `.env` file in the `frontend/` folder
- Or just test against the production backend

### File upload location (local)

Uploaded files are saved under `data/company_<cid>/` relative to `app.py`. This directory is created automatically. Example:
```
virtualca/data/company_1/current_tb.xlsx
virtualca/data/company_1/current_db.xlsx
```

These are also uploaded to Supabase Storage for persistence across server restarts.
