```
                                    ████████████████
                                    ████████████████
                                    ▒▒▒▒
                                    ▒▒▒▒
                                    ▒▒▒▒
                                    ▒▒▒▒
                    ████████████████
                    ████████████████
                    ▒▒▒▒
                    ▒▒▒▒
                    ▒▒▒▒
                    ▒▒▒▒
                    ▒▒▒▒
                    ▒▒▒▒
    ████████████████
    ████████████████
    ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔

    T H R E S H O L D   β
```

> Geopolitical escalation monitoring through open sources.

**Live:** [threshold-lyart.vercel.app](https://threshold-lyart.vercel.app)

---

## What it is

Threshold is an OSINT-based platform that tracks escalation dynamics across 20 active conflict and strategic tension regions. It aggregates open-source event data, computes a daily Escalation Index per region, and surfaces structured intelligence through a clean web interface.

Developed as a research project at the John-F.-Kennedy-Institut, Freie Universität Berlin. Not an official intelligence assessment.

---

## Regions

**Active conflict** — Gaza, Ukraine, Sudan, Yemen, Sahel, DRC, Myanmar, Somalia, Haiti, Ethiopia, Libya, Mozambique, Syria

**Strategic tension** — South China Sea, Taiwan Strait, Korean Peninsula, Baltic, South Caucasus, Kosovo, Arctic

---

## Escalation Index

The EI is a composite heuristic indicator, not a predictive model. It combines three weighted components:

| Component | Weight | Description |
|---|---|---|
| Gray Zone Score | 45% | Log-normalized incident frequency and severity over 7 and 30-day windows |
| Exercise Signal | 35% | Scale and rhetoric of active military exercises within a 14-day window |
| Conflict Baseline | 20% | Region-specific structural instability prior, calibrated against UCDP historical data |

```
EI = ( GZ × 0.45  +  EX × 0.35  +  BASELINE × 0.20 ) × 100
```

Scores range from 0 to 100. All methodology is transparent and documented.

---

## Data sources

| Source | Type |
|---|---|
| UCDP Uppsala | Academic conflict database |
| ReliefWeb / OCHA | UN humanitarian reporting |
| GDELT | Global event data |
| UN News | Official releases |
| Wikipedia Current Events | Discovery layer |
| SHAPE NATO | Exercise signals |

---

## Stack

| Layer | Service |
|---|---|
| Frontend | React + Vite → Vercel |
| Backend | FastAPI (Python) → Railway |
| Database | Supabase (PostgreSQL) |
| LLM | Groq — LLaMA 3.3-70B |

---

## Status

Public beta. Actively developed.

---

*JFKI · Freie Universität Berlin · North American Studies MA · 2026*
