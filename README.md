# Threshold — Geopolitical Escalation Monitor

Open-source intelligence platform monitoring escalation dynamics across 20 UN-recognized conflict zones. Developed at JFKI, Freie Universität Berlin.

**Live:** https://threshold-lyart.vercel.app

---

## Stack

| Layer | Service |
|-------|---------|
| Frontend | React + Vite → Vercel |
| Backend | FastAPI (Python) → Railway |
| Database | Supabase (PostgreSQL) |
| LLM | Groq (Llama 3.1-8b / 3.3-70b) |

---

## Full Setup from Scratch

### 1. Clone

```bash
git clone https://github.com/andr1anoff/threshold.git
cd threshold
```

---

### 2. Supabase (Database)

1. Go to [supabase.com](https://supabase.com) → New project → choose Frankfurt region
2. Go to **SQL Editor** → paste and run `backend/schema.sql`
3. Run this to disable RLS (development):
```sql
ALTER TABLE incidents DISABLE ROW LEVEL SECURITY;
ALTER TABLE exercises DISABLE ROW LEVEL SECURITY;
ALTER TABLE deterrence_index DISABLE ROW LEVEL SECURITY;
ALTER TABLE correlations DISABLE ROW LEVEL SECURITY;
```
4. Copy **Project URL** and **anon public key** from Settings → API

---

### 3. Groq (LLM — free)

1. Go to [console.groq.com](https://console.groq.com) → Sign up
2. API Keys → Create API Key
3. Copy the key (starts with `gsk_...`)
4. Free tier: 14,400 requests/day on Llama 3.1-8b — sufficient for this project

---

### 4. Railway (Backend)

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo → select `threshold`
2. Set **Root Directory** to `backend`
3. Add environment variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
GROQ_API_KEY=gsk_...
FRONTEND_URL=https://your-app.vercel.app
```

Optional (ACLED — requires approval at acleddata.com):
```
ACLED_EMAIL=your@email.com
ACLED_PASSWORD=your-password
```

4. Railway auto-deploys on every `git push` to main

---

### 5. Vercel (Frontend)

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Set **Root Directory** to `frontend`
3. Add environment variable:
```
VITE_API_URL=https://your-railway-app.up.railway.app
```
4. Deploy → Vercel auto-deploys on every `git push`

---

### 6. Populate data (first time)

After both services are deployed:

```bash
# Run all scrapers
curl -X POST https://your-railway-app.up.railway.app/api/admin/scrape

# Classify events with LLM
curl -X POST https://your-railway-app.up.railway.app/api/admin/classify

# Calculate Deterrence Index for all 20 regions
curl -X POST https://your-railway-app.up.railway.app/api/admin/calculate-di
```

Or run the full pipeline at once (slower, ~10 min due to rate limits):
```bash
curl -X POST https://your-railway-app.up.railway.app/api/admin/pipeline
```

---

### 7. Daily automation (Railway Cron)

In Railway → your service → Settings → Cron Jobs:
```
0 6 * * *   curl -X POST $RAILWAY_STATIC_URL/api/admin/pipeline
```
Runs every day at 06:00 UTC.

---

## Local Development

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env from template
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_KEY, GROQ_API_KEY

uvicorn app.main:app --reload --port 8000
```

API available at `http://localhost:8000`
Docs at `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install

# Create .env.local
echo "VITE_API_URL=http://localhost:8000" > .env.local

npm run dev
```

App at `http://localhost:5173`

---

## Admin API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/scrape` | POST | Run all scrapers |
| `/api/admin/scrape/reliefweb` | POST | ReliefWeb/OCHA only |
| `/api/admin/scrape/ucdp` | POST | UCDP Uppsala only |
| `/api/admin/scrape/wikipedia` | POST | Wikipedia Current Events |
| `/api/admin/scrape/un-news` | POST | UN News RSS |
| `/api/admin/scrape/ukraine` | POST | DeepState + CIT |
| `/api/admin/classify` | POST | LLM classify all unknown events |
| `/api/admin/calculate-di` | POST | Recalculate DI for all 20 regions |
| `/api/admin/pipeline` | POST | Full pipeline (scrape → classify → DI) |
| `/api/admin/narrative/{region}` | GET | Generate AI narrative for region |
| `/api/admin/status` | GET | Event/exercise/DI counts |

---

## Data Sources

| Source | Type | API Key needed |
|--------|------|---------------|
| ReliefWeb / OCHA | Humanitarian reports | No |
| UCDP Uppsala | Verified conflict events | No |
| Wikipedia Current Events | Daily chronicle | No |
| UN News RSS | Official UN press releases | No |
| UNOCHA Situation Reports | Field situation reports | No |
| DeepState (Ukraine) | Frontline tracker | No |
| CIT / Leviev | OSINT verification | No |
| ACLED | Conflict event database | Yes (free, apply at acleddata.com) |

---

## Deterrence Index Formula

```
DI = log(GZ) × 0.45 + EX × 0.30 + BASELINE × 0.25

GZ  = logarithmic normalization of weighted incident escalation (30d)
      recent events (7d) are double-weighted
EX  = exercise scale + rhetoric score, ±14 day window
BASE = per-region structural constant (conflict vs tension zone)
```

Scores are logarithmically normalized to prevent sparse data from producing identical values across all regions.

---

## Monitored Regions

All 20 regions based on UN Security Council agenda items and OCHA Global Humanitarian Overview:

Gaza & Middle East · Ukraine · Sudan · South China Sea · Taiwan Strait · Yemen · Sahel · Korean Peninsula · Myanmar · DRC · Syria · Somalia · Baltic · Haiti · Ethiopia · South Caucasus · Libya · Kosovo · Arctic · Mozambique

---

## Project Context

Developed as part of MA North American Studies, seminar *Multilateral Military Maneuvers and Joint Exercises* (Dr. David Bosold, JFKI, FU Berlin, Summer Term 2026).

The Deterrence Index is a research indicator — not an official intelligence assessment.

**Contact:** ivan@easily.berlin
