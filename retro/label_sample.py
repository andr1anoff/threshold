#!/usr/bin/env python3
"""
Measure the funnel instead of trusting it.

exercises_funnel.py keeps 3,061 URLs out of 275,250 by matching a hand-written
list of 24 exercise names. That list can only find exercises somebody already
thought of, so the yield figure is unverified until somebody labels a sample by
hand. This is that tool.

Sampling is stratified, because a uniform sample of 200 from 275,250 URLs would
turn up almost nothing: the base rate outside the filter is very low, and a
sample of zero positives tells you nothing about how many you are missing.

  A  kept by the filter                   3,061   -> measures PRECISION
  B  rejected, but has an exercise word  ~11,170  -> where recall loss hides
  C  rejected, no exercise word         ~261,000  -> should be near zero;
                                                     confirm, do not assume

The seed is fixed. Rerunning draws the same sample, so the measurement is
reproducible and a second labeller can be compared against the first.

Labelling: y = the page is about a specific military exercise
           n = it is not
           s = cannot tell without reading the article
           q = save and quit, resume later

Progress is written after every label, so quitting midway loses nothing.

Usage:
    python3.11 label_sample.py --urls data/code15_urls.csv --out data/labels.csv
    python3.11 label_sample.py --out data/labels.csv --report

Requires:
    pip install duckdb requests
"""

from __future__ import annotations

import argparse
import csv
import math
import random
import re
import sys
from pathlib import Path

import duckdb

sys.path.insert(0, str(Path(__file__).resolve().parent))
from exercises_funnel import classify, GEN_RE  # noqa: E402

SEED = 20260728
N_A, N_B, N_C = 100, 80, 20
TITLE_TIMEOUT = 6

# Auto-labelling. The model decides only "is this article about a specific
# military exercise", from a headline. That is a far easier call than the
# extraction task it is meant to size, so using a model here does not make the
# measurement circular -- provided a human checks a subset and the agreement
# rate is reported alongside the result. --verify enforces that.
AUTO_MODEL = "llama-3.3-70b-versatile"
AUTO_BASE = "https://api.groq.com/openai/v1/chat/completions"
VERIFY_N = 30

AUTO_PROMPT = (
    "You decide whether a news article is about a specific military exercise, "
    "drill, or war game.\n"
    "YES: a named or clearly identified exercise, drill, manoeuvre, or war game.\n"
    "NO: real deployments, actual combat, procurement, policy, commentary, "
    "anything else.\n"
    "UNCLEAR: the headline genuinely does not say.\n"
    "Answer with exactly one word: YES, NO, or UNCLEAR."
)


def wilson(k: int, n: int) -> tuple[float, float, float]:
    """Wilson score interval. Normal approximation breaks down near 0 and 1,
    which is exactly where stratum C will sit."""
    if n == 0:
        return (0.0, 0.0, 1.0)
    z = 1.96
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (p, max(0.0, c - h), min(1.0, c + h))


def strata(urls: list[str]) -> dict[str, list[str]]:
    out = {"A": [], "B": [], "C": []}
    for u in urls:
        named, generic, preferred = classify(u)
        if named or (generic and preferred):
            out["A"].append(u)
        elif generic or GEN_RE.search(u.lower()):
            out["B"].append(u)
        else:
            out["C"].append(u)
    return out


def draw(urls: list[str]) -> list[tuple[str, str]]:
    st = strata(urls)
    print("stratum sizes:")
    for k in "ABC":
        print(f"  {k}  {len(st[k]):>9,}")
    rng = random.Random(SEED)
    sample: list[tuple[str, str]] = []
    for k, n in [("A", N_A), ("B", N_B), ("C", N_C)]:
        pool = st[k]
        take = rng.sample(pool, min(n, len(pool)))
        sample += [(k, u) for u in take]
    rng.shuffle(sample)          # blind the labeller to the stratum
    return sample, {k: len(v) for k, v in st.items()}


def title_of(url: str) -> str:
    try:
        import requests
        r = requests.get(url, timeout=TITLE_TIMEOUT, headers={
            "User-Agent": "ThresholdBifrost/0.1 (academic research)"})
        m = re.search(r"<title[^>]*>(.*?)</title>", r.text, re.S | re.I)
        return re.sub(r"\s+", " ", m.group(1)).strip()[:150] if m else ""
    except Exception:
        return ""


def auto_label(url: str, title: str, key: str) -> str:
    import requests
    body = {
        "model": AUTO_MODEL,
        "max_tokens": 4,
        "temperature": 0,
        "messages": [
            {"role": "system", "content": AUTO_PROMPT},
            {"role": "user", "content": f"URL: {url}\nHeadline: {title or '(none)'}"},
        ],
    }
    try:
        r = requests.post(AUTO_BASE, json=body, timeout=40,
                          headers={"Authorization": f"Bearer {key}"})
        r.raise_for_status()
        ans = r.json()["choices"][0]["message"]["content"].strip().upper()
    except Exception as e:
        print(f"    auto-label failed: {type(e).__name__}")
        return "s"
    return {"YES": "y", "NO": "n"}.get(ans.split()[0] if ans else "", "s")


def agreement(rows: list[dict]) -> None:
    both = [r for r in rows if r.get("human") in ("y", "n")
            and r.get("label") in ("y", "n")]
    if not both:
        return
    same = sum(1 for r in both if r["human"] == r["label"])
    p, lo, hi = wilson(same, len(both))
    print(f"\n  human/model agreement  {same}/{len(both)} = {p:.1%}"
          f"  [95% CI {lo:.1%} .. {hi:.1%}]")
    if p < 0.85:
        print("  Below 85%: the auto labels are not a usable ground truth.")
        print("  Label the rest by hand rather than reporting this run.")
    else:
        print("  Report this figure next to the funnel numbers. An auto-labelled")
        print("  measurement without a stated agreement rate is not evidence.")


def report(rows: list[dict], sizes: dict[str, int]) -> None:
    print("\n" + "=" * 62)
    print("FUNNEL MEASUREMENT")
    print("=" * 62)
    est_total = 0.0
    lo_total = hi_total = 0.0
    for k in "ABC":
        sub = [r for r in rows if r["stratum"] == k and r["label"] in ("y", "n")]
        yes = sum(1 for r in sub if r["label"] == "y")
        skipped = sum(1 for r in rows if r["stratum"] == k and r["label"] == "s")
        p, lo, hi = wilson(yes, len(sub))
        N = sizes.get(k, 0)
        est_total += p * N
        lo_total += lo * N
        hi_total += hi * N
        name = {"A": "kept by filter", "B": "rejected, exercise word",
                "C": "rejected, no exercise word"}[k]
        print(f"\n  {k}  {name}")
        print(f"     labelled {len(sub)} ({skipped} unclear)   "
              f"exercises {yes}")
        print(f"     rate {p:.1%}  [95% CI {lo:.1%} .. {hi:.1%}]")
        print(f"     implies {p*N:>10,.0f} exercise URLs in {N:,}")

    a = [r for r in rows if r["stratum"] == "A" and r["label"] in ("y", "n")]
    prec = sum(1 for r in a if r["label"] == "y") / max(len(a), 1)
    kept_true = prec * sizes.get("A", 0)
    recall = kept_true / est_total if est_total else 0.0

    print("\n" + "-" * 62)
    print(f"  precision of the filter      {prec:.1%}")
    print(f"  estimated true exercise URLs {est_total:>10,.0f}"
          f"   [{lo_total:,.0f} .. {hi_total:,.0f}]")
    print(f"  captured by the filter       {kept_true:>10,.0f}")
    print(f"  RECALL                       {recall:.1%}")
    print("-" * 62)

    c = [r for r in rows if r["stratum"] == "C" and r["label"] in ("y", "n")]
    c_yes = sum(1 for r in c if r["label"] == "y")
    if len(c) and c_yes == 0:
        _, _, c_hi = wilson(0, len(c))
        print(f"\n  Stratum C returned no positives in {len(c)} labels, so its"
              f" true rate\n  sits somewhere below {c_hi:.1%} -- which across"
              f" {sizes.get('C',0):,} URLs is a range\n  wide enough to swamp"
              f" everything else. Treat the total as a LOWER\n  bound. If C ever"
              f" returns a positive, label 100 more there before\n  quoting any"
              f" figure from this run.")
    elif c_yes:
        print(f"\n  Stratum C returned {c_yes} positive(s). The 'no exercise word'"
              f"\n  assumption is wrong and C now dominates the estimate."
              f" Label 100\n  more in C before using any number here.")

    if recall < 0.5:
        print("\n  The name list is missing more than it finds. Scaling beyond")
        print("  the Baltic will not work on a hand-written list at all, since")
        print("  it contains no non-NATO, non-Russian names. Either bootstrap")
        print("  names from stratum A output and rescan, or drop the name")
        print("  requirement and pay for the larger candidate set.")
    tokens = est_total * (1800 + 220)
    print(f"\n  Extracting every estimated true exercise URL would cost about")
    print(f"  {tokens/1e6:,.1f} M tokens per pass, against {3061*2020/1e6:.1f} M")
    print(f"  for the current candidate set. Revise the compute request if the")
    print(f"  gap is large, rather than quietly under-delivering on coverage.")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--urls", type=Path, default=Path("data/code15_urls.csv"))
    ap.add_argument("--out", type=Path, default=Path("data/labels.csv"))
    ap.add_argument("--no-titles", action="store_true",
                    help="do not fetch page titles; label from the URL alone")
    ap.add_argument("--report", action="store_true",
                    help="recompute the measurement from an existing label file")
    ap.add_argument("--auto", action="store_true",
                    help="label with an LLM instead of by hand; needs GROQ_API_KEY")
    ap.add_argument("--verify", action="store_true",
                    help=f"hand-check {VERIFY_N} auto labels and report agreement")
    ap.add_argument("--n-per-stratum", type=int, default=None,
                    help="override sample sizes, e.g. 40 for a quicker run")
    a = ap.parse_args()

    if a.n_per_stratum:
        globals()["N_A"] = a.n_per_stratum
        globals()["N_B"] = a.n_per_stratum
        globals()["N_C"] = max(20, a.n_per_stratum // 4)

    con = duckdb.connect(":memory:")
    urls = [r[0] for r in con.execute(
        f"SELECT DISTINCT SOURCEURL FROM "
        f"read_csv_auto('{a.urls.as_posix()}', header=true) "
        f"WHERE SOURCEURL IS NOT NULL").fetchall()]
    sample, sizes = draw(urls)

    done: dict[str, dict] = {}
    if a.out.exists():
        with a.out.open() as fh:
            for r in csv.DictReader(fh):
                done[r["url"]] = r

    if a.report:
        agreement(list(done.values()))
        report(list(done.values()), sizes)
        return 0

    if a.verify:
        import os
        pool = [r for r in done.values()
                if r.get("label") in ("y", "n") and not r.get("human")]
        rng = random.Random(SEED + 1)
        pick = rng.sample(pool, min(VERIFY_N, len(pool)))
        print(f"\nhand-checking {len(pick)} auto labels. You are NOT shown the")
        print("model's answer, so your call stays independent.\n")
        for i, r in enumerate(pick, 1):
            print(f"[{i}/{len(pick)}] {r['url']}")
            if r.get("title"):
                print(f"          {r['title']}")
            while True:
                ans = input("          > ").strip().lower()
                if ans in ("y", "n", "s", "q"):
                    break
            if ans == "q":
                break
            r["human"] = ans
            print()
        with a.out.open("w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=["url", "stratum", "label",
                                               "title", "human"])
            w.writeheader()
            for r in done.values():
                w.writerow({k: r.get(k, "") for k in
                            ["url", "stratum", "label", "title", "human"]})
        agreement(list(done.values()))
        report(list(done.values()), sizes)
        return 0

    remaining = [(k, u) for k, u in sample if u not in done]
    print(f"\n{len(done)} already labelled, {len(remaining)} to go")
    print("y = military exercise   n = not   s = unclear   q = quit\n")

    key = None
    if a.auto:
        import os
        key = os.environ.get("GROQ_API_KEY")
        if not key:
            print("GROQ_API_KEY not set. export it, or drop --auto.")
            return 1
        est = len(remaining) * 155
        print(f"auto mode: ~{est:,} tokens against a 100k/day free tier\n")

    a.out.parent.mkdir(parents=True, exist_ok=True)
    new = not a.out.exists()
    fh = a.out.open("a", newline="")
    w = csv.DictWriter(fh, fieldnames=["url", "stratum", "label", "title",
                                       "human"])
    if new:
        w.writeheader()

    for i, (k, u) in enumerate(remaining, 1):
        t = "" if a.no_titles else title_of(u)
        if a.auto:
            ans = auto_label(u, t, key)
            print(f"[{i}/{len(remaining)}] {ans}  {t or u[:70]}")
        else:
            print(f"[{i}/{len(remaining)}] {u}")
            if t:
                print(f"          {t}")
            while True:
                ans = input("          > ").strip().lower()
                if ans in ("y", "n", "s", "q"):
                    break
            if ans == "q":
                break
            print()
        w.writerow({"url": u, "stratum": k, "label": ans, "title": t,
                    "human": ""})
        fh.flush()
        done[u] = {"url": u, "stratum": k, "label": ans, "title": t, "human": ""}
    fh.close()

    print(f"\nsaved {len(done)} labels -> {a.out}")
    if a.auto:
        print("\nNow hand-check a subset before using any of this:")
        print(f"  python3.11 label_sample.py --out {a.out} --verify")
    if len(done) >= 30:
        agreement(list(done.values()))
        report(list(done.values()), sizes)
    else:
        print("Label at least 30 before reading anything into the numbers.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
