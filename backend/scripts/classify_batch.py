#!/usr/bin/env python3
"""
classify_batch.py — the live classifier, run at scale against any OpenAI-compatible endpoint.

One tool, two uses:

  today, against Groq's larger tier, to answer a question the audit raised.
  61% of indexed incidents sit at escalation_level 4, which is not a shape real
  severity takes. Running the same prompt through a bigger model on the same
  texts separates two explanations: a rubric that invites the answer, or a
  small model defaulting to it. That costs almost nothing and needs no new
  infrastructure.

  later, against vLLM on KISSKI, to classify a historical corpus. The README
  names Crimea 2014, Nagorno-Karabakh 2020 and February 2022 as the intended
  validation anchors. The feeds are RSS and carry no archive, so incidents for
  those dates have to be produced rather than fetched, and that is the job this
  script exists for.

The prompt is copied verbatim from app/llm/classifier.py, including the 600
character truncation. If that file changes, this one changes with it. A
historical run whose prompt has drifted from the live one produces incidents
the deployed index would never have generated, which is the same class of error
as scoring a reconstructed formula.

Usage:

    # today: re-classify a sample of existing incidents with a larger model
    python3.11 classify_batch.py --mode resample --limit 250 \\
        --endpoint https://api.groq.com/openai/v1/chat/completions \\
        --model llama-3.3-70b-versatile --api-key-env GROQ_API_KEY \\
        --out data/resample.jsonl

    # on KISSKI: classify a historical corpus served by vLLM
    python3.11 classify_batch.py --mode corpus --input data/anchor_articles.jsonl \\
        --endpoint http://localhost:8000/v1/chat/completions \\
        --model meta-llama/Llama-3.3-70B-Instruct --out data/anchor_classified.jsonl

Resumable: already-classified ids are skipped, so an interrupted run continues.
Read-only against the database. Writes JSONL only; loading into Supabase is a
separate, deliberate step.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections import Counter
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Copied verbatim from app/llm/classifier.py. Do not paraphrase, do not tidy.

CLASSIFY_PROMPT = """Classify this gray zone incident. Return ONLY valid JSON, no explanation.

Text: {text}

JSON schema:
{{
  "category": "cyber|airspace|maritime|disinfo|proxy|economic|military|diplomatic|civilian|unknown",
  "escalation_level": 1-5,
  "region": "region name or null",
  "actors": ["actor1"],
  "summary": "one sentence"
}}

Escalation levels:
1 = rhetoric, threats, diplomatic pressure
2 = troop movements, buildup, sanctions
3 = cyberattack, airspace violation, naval incident
4 = attack with casualties, airstrike
5 = full-scale combat, mass casualties"""

TEXT_TRUNCATE = 600          # matches classifier.py
MAX_TOKENS = 200             # matches classifier.py

VALID_CATEGORIES = frozenset({
    "cyber", "airspace", "maritime", "disinfo", "proxy", "economic",
    "military", "diplomatic", "civilian", "unknown", "unclassifiable", "none",
})


def call(endpoint: str, model: str, key: str | None, text: str,
         timeout: int = 90) -> dict | None:
    body = {
        "model": model,
        "max_tokens": MAX_TOKENS,
        "temperature": 0,
        "messages": [{"role": "user",
                      "content": CLASSIFY_PROMPT.format(text=text[:TEXT_TRUNCATE])}],
    }
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    try:
        r = requests.post(endpoint, json=body, headers=headers, timeout=timeout)
        if r.status_code == 429:
            return {"_retry": True}
        r.raise_for_status()
        raw = r.json()["choices"][0]["message"]["content"]
    except Exception as exc:
        return {"_error": f"{type(exc).__name__}: {exc}"}
    raw = raw.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"_error": "json parse", "_raw": raw[:200]}


def load_done(path: Path) -> set[str]:
    if not path.exists():
        return set()
    done = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            done.add(str(json.loads(line)["id"]))
        except Exception:
            continue
    return done


def source_rows(a) -> list[dict]:
    """Either existing incidents from the database, or a corpus file."""
    if a.mode == "corpus":
        if not a.input or not a.input.exists():
            raise SystemExit(f"--input is required in corpus mode and must exist")
        rows = []
        for line in a.input.read_text(encoding="utf-8").splitlines():
            if line.strip():
                rows.append(json.loads(line))
        return rows[:a.limit] if a.limit else rows

    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from app.db.supabase import get_client
    db = get_client()
    out, start = [], 0
    while len(out) < a.limit:
        page = db.table("incidents").select(
            "id,date,title,raw_text,region,category,escalation_level"
        ).range(start, start + 999).execute().data
        out.extend(page)
        if len(page) < 1000:
            break
        start += 1000
    return out[:a.limit]


def text_of(row: dict) -> str:
    """
    Exactly what the live pipeline feeds the classifier.

    From the reclassification loop in the scrape pipeline:

        raw = (inc.get("raw_text") or inc.get("title") or "").strip()
        result = classify_incident(raw)

    So it is raw_text when present and the title otherwise, never both
    concatenated. There is no summary column on incidents; assuming one is what
    made the first version of this script fail against the real schema.
    """
    return (row.get("raw_text") or row.get("title") or row.get("text") or "").strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["resample", "corpus"], required=True)
    ap.add_argument("--input", type=Path, default=None)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--endpoint", required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--api-key-env", default=None)
    ap.add_argument("--limit", type=int, default=250)
    ap.add_argument("--delay", type=float, default=0.0,
                    help="seconds between calls; needed for rate-limited APIs, "
                         "not for a dedicated endpoint")
    a = ap.parse_args()

    key = os.environ.get(a.api_key_env) if a.api_key_env else None
    if a.api_key_env and not key:
        print(f"{a.api_key_env} is not set")
        return 1

    rows = source_rows(a)
    done = load_done(a.out)
    todo = [r for r in rows if str(r.get("id")) not in done]
    print(f"{len(rows):,} rows, {len(done):,} already done, {len(todo):,} to classify")
    print(f"model {a.model} at {a.endpoint}")

    a.out.parent.mkdir(parents=True, exist_ok=True)
    fh = a.out.open("a", encoding="utf-8")
    errors = Counter()
    t0 = time.time()

    for i, row in enumerate(todo, 1):
        res = call(a.endpoint, a.model, key, text_of(row))
        if res and res.get("_retry"):
            time.sleep(20)
            res = call(a.endpoint, a.model, key, text_of(row))
        if not res or "_error" in (res or {}):
            errors[(res or {}).get("_error", "no response")[:40]] += 1
            continue
        # Mirror the live allowlist guard and clamp, so the comparison is
        # against what would actually have been stored, not raw model output.
        cat = (res.get("category") or "").strip().lower()
        if cat not in VALID_CATEGORIES or cat in ("none", "unclassifiable"):
            cat = "unknown"
        res["category"] = cat
        try:
            res["escalation_level"] = max(1, min(5, int(res.get("escalation_level", 2) or 2)))
        except (TypeError, ValueError):
            res["escalation_level"] = 2
        fh.write(json.dumps({
            "id": row.get("id"),
            "date": row.get("date"),
            "title": row.get("title"),
            "old_level": row.get("escalation_level"),
            "old_category": row.get("category"),
            "old_region": row.get("region"),
            "new_level": res.get("escalation_level"),
            "new_category": res.get("category"),
            "new_region": res.get("region"),
            "actors": res.get("actors"),
            "summary": res.get("summary"),
            "model": a.model,
        }, ensure_ascii=False) + "\n")
        fh.flush()
        if a.delay:
            time.sleep(a.delay)
        if i % 25 == 0:
            rate = i / max(time.time() - t0, 1e-6)
            print(f"  {i}/{len(todo)}  {rate:.1f}/s")
    fh.close()

    if errors:
        print("\nerrors")
        for k, v in errors.most_common():
            print(f"  {v:5d}  {k}")

    report(a.out, a.mode)
    return 0


def report(path: Path, mode: str) -> None:
    rows = [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
    if not rows:
        print("nothing classified")
        return
    print(f"\n--- {len(rows):,} classified ---")

    new = Counter(r.get("new_level") for r in rows)
    print("  new escalation_level   " + "  ".join(
        f"{k}:{new.get(k,0)}" for k in sorted(x for x in new if x is not None)))
    top = max(new.items(), key=lambda kv: kv[1])
    print(f"                         level {top[0]} is {100*top[1]/len(rows):.0f}% of the sample")

    if mode == "resample":
        old = Counter(r.get("old_level") for r in rows)
        print("  old escalation_level   " + "  ".join(
            f"{k}:{old.get(k,0)}" for k in sorted(x for x in old if x is not None)))
        agree = sum(1 for r in rows if r.get("old_level") == r.get("new_level"))
        print(f"\n  the two models agree on {agree}/{len(rows)} = "
              f"{100*agree/len(rows):.0f}% of levels")
        moved = Counter((r.get("old_level"), r.get("new_level")) for r in rows
                        if r.get("old_level") != r.get("new_level"))
        if moved:
            print("  largest disagreements  " + ", ".join(
                f"{o}->{n}:{c}" for (o, n), c in moved.most_common(5)))
        cat_agree = sum(1 for r in rows if r.get("old_category") == r.get("new_category"))
        print(f"  categories agree on    {100*cat_agree/len(rows):.0f}%")
        print("\n  If the larger model spreads the levels out, the 61% pile-up")
        print("  is the small model and the fix is the model. If it piles up")
        print("  the same way, the rubric invites it and the fix is the prompt.")

    bad = [r for r in rows if r.get("new_category") not in VALID_CATEGORIES]
    if bad:
        print(f"\n  {len(bad)} rows carry a category outside the database "
              f"constraint and would fail on insert: "
              f"{sorted({r.get('new_category') for r in bad})[:6]}")


if __name__ == "__main__":
    sys.exit(main())
