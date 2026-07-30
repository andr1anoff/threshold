#!/usr/bin/env python3
"""
Bifrost console: the backtest pipeline without the command archaeology.

Everything the individual scripts do, behind a menu that also shows what state
each region is in. The pre-registration guard is preserved rather than made
convenient: the app will refuse to evaluate a region whose threshold and
registered commit are not committed to git, because that guard is the only
thing separating a test from fitting parameters after seeing the answer.

    python3.11 bifrost.py

Requires:
    pip install rich duckdb pandas numpy pyyaml
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import duckdb
import pandas as pd
import yaml
from rich import box
from rich.console import Console, Group
from rich.panel import Panel
from rich.prompt import Prompt
from rich.table import Table
from rich.text import Text

sys.path.insert(0, str(Path(__file__).resolve().parent))
import scorer as S  # noqa: E402

ROOT = Path(__file__).resolve().parent
DB = ROOT / "retro.duckdb"
con: duckdb.DuckDBPyConnection | None = None
cs = Console()

OK, WARN, BAD, DIM = "green", "yellow", "red", "grey62"


# ---------------------------------------------------------------- state


def regions() -> list[str]:
    return sorted(p.stem for p in (ROOT / "regions").glob("*.yaml")
                  if p.stem != "fips_map")


def load_yaml(path: Path) -> dict:
    if not path.exists():
        return {}
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def git(*args: str) -> str:
    try:
        return subprocess.run(["git", *args], cwd=ROOT, capture_output=True,
                              text=True, timeout=15).stdout.strip()
    except Exception:
        return ""


def commit_exists(sha: str) -> bool:
    if not sha:
        return False
    return git("cat-file", "-t", str(sha)) == "commit"


def region_state(name: str) -> dict:
    reg = load_yaml(ROOT / "regions" / f"{name}.yaml")
    gt = load_yaml(ROOT / "groundtruth" / f"{name}.yaml")
    sha = str(gt.get("registered_commit") or "")
    rows = 0
    if con is not None:
        try:
            rows = con.execute(
                "SELECT count(*) FROM incidents_retro_daily WHERE region_key = ?",
                [name]).fetchone()[0]
        except Exception:
            rows = 0
    return {
        "name": name,
        "status": reg.get("status", "?"),
        "rows": rows,
        "events": len(gt.get("events") or []),
        "controls": len(gt.get("control_windows") or []),
        "threshold": gt.get("threshold"),
        "sha": sha,
        "sha_ok": commit_exists(sha),
        "gt": gt,
        "reg": reg,
    }


def phase(st: dict) -> tuple[str, str]:
    if not st["rows"]:
        return "no data", BAD
    if not st["events"]:
        return "no ground truth", BAD
    if st["threshold"] in (None, ""):
        return "threshold unset", WARN
    if not st["sha"]:
        return "not committed", WARN
    if not st["sha_ok"]:
        return "commit missing", BAD
    return "ready to evaluate", OK


# ---------------------------------------------------------------- views


def header() -> Panel:
    dirty = git("status", "--porcelain")
    head = git("rev-parse", "--short", "HEAD") or "no repo"
    line = Text()
    line.append("bifrost", style="bold")
    line.append("   backtest console\n", style=DIM)
    line.append(f"db {DB.name if DB.exists() else 'missing'}", style=DIM)
    line.append("   ")
    line.append(f"HEAD {head}", style=DIM)
    if dirty:
        line.append("   uncommitted changes", style=WARN)
    return Panel(line, box=box.ROUNDED, border_style=DIM)


def overview() -> Table:
    t = Table(box=box.SIMPLE_HEAD, header_style="bold", expand=False)
    for c, j in [("region", "left"), ("role", "left"), ("rows", "right"),
                 ("events", "right"), ("controls", "right"),
                 ("threshold", "right"), ("state", "left")]:
        t.add_column(c, justify=j)
    for name in regions():
        st = region_state(name)
        ph, colour = phase(st)
        thr = f"{st['threshold']:.4f}" if isinstance(st["threshold"], (int, float)) else "-"
        t.add_row(name, st["status"], f"{st['rows']:,}", str(st["events"]),
                  str(st["controls"]), thr, Text(ph, style=colour))
    return t


def registry_panel() -> Panel:
    clusters = ROOT / "data" / "exercise_clusters.csv"
    if not clusters.exists():
        return Panel(Text("no exercise clusters built yet", style=DIM),
                     title="registry", box=box.ROUNDED, border_style=DIM)
    df = pd.read_csv(clusters)
    conf = df[df.get("edition_inferred", 0) == 0] if "edition_inferred" in df else df
    single = int((conf.n_articles == 1).sum()) if "n_articles" in conf else 0
    body = Text()
    body.append(f"{len(conf):,} confirmed editions", style="bold")
    body.append(f"   {len(df) - len(conf):,} unresolved mentions\n", style=DIM)
    body.append(f"{single:,} rest on a single source and carry low confidence",
                style=DIM)
    return Panel(body, title="registry", box=box.ROUNDED, border_style=DIM)


# ---------------------------------------------------------------- actions


def daily_frame(name: str) -> pd.DataFrame:
    """Daily GDELT aggregates for a region, one row per day and root code."""
    return con.execute("""
        SELECT event_date, event_root_code,
               sum(n_events)   AS n_events,
               sum(n_articles) AS n_articles
        FROM incidents_retro_daily WHERE region_key = ?
        GROUP BY 1, 2 ORDER BY 1
    """, [name]).fetch_df().fillna(0.0)


REGION_TO_LIVE = {"baltic": "Baltic", "ukraine": "Ukraine"}


def proxy_warning() -> Panel:
    return Panel(
        Text("Inputs are proxied from GDELT, not taken from the live "
             "classifier.\n\n"
             "severity comes from the CAMEO root code rather than from reading "
             "the article; corroboration comes from article counts rather than "
             "independent confirmation; and GDELT arrives pre-aggregated, so "
             "there is no equivalent of the live grouping step.\n\n"
             "This shows how the formula behaves on weak inputs. It does not "
             "validate the deployed index. Do not report it as if it did.",
             style=WARN),
        title="proxy inputs", box=box.ROUNDED, border_style=WARN)


def build_series(name: str):
    """Score a region with the LIVE formula over proxied GDELT inputs."""
    st = region_state(name)
    if not st["rows"]:
        cs.print(f"[{BAD}]no rows loaded for {name}[/]")
        return None, st
    raw = daily_frame(name)
    events = S.events_from_gdelt(raw)
    # Exercise scale is not in the registry yet, so EX is structurally zero
    # here. That is a missing input, not a measurement.
    exercises = pd.DataFrame(columns=["start_date", "end_date", "scale"])
    win = st["reg"].get("window") or {}
    lo = pd.Timestamp(str(win.get("start", "2015-02-19"))).date()
    hi = pd.Timestamp(str(win.get("end", "2026-07-27"))).date()
    inp = S.Inputs(events, exercises, REGION_TO_LIVE.get(name, name))
    with cs.status(f"scoring {name} day by day, {(hi-lo).days:,} days"):
        scored = S.score_series(inp, lo, hi)
    return scored, st


def show_diagnostics(scored: pd.DataFrame):
    sh = S.term_shares(scored)
    t = Table(box=box.SIMPLE_HEAD, header_style="bold")
    for c in ["term", "realised", "nominal"]:
        t.add_column(c, justify="right" if c != "term" else "left")
    for k, nom in [("GZ", 45.0), ("EX", 35.0), ("BASE", 20.0)]:
        style = OK if abs(sh[k] - nom) < 12 else WARN
        t.add_row(k, Text(f"{sh[k]:.1f}%", style=style), f"{nom:.0f}%")
    body = Group(t, Text(
        f"\nEX is {sh['EX']:.1f}% because the registry carries no exercise "
        f"scale yet, so the term is structurally zero.", style=DIM))
    cs.print(Panel(body, title="term contributions", box=box.ROUNDED,
                   border_style=DIM))


def propose(name: str):
    scored, st = build_series(name)
    if scored is None:
        return
    cs.print(proxy_warning())
    show_diagnostics(scored)
    controls = st["gt"].get("control_windows") or []
    if not controls:
        cs.print(f"[{BAD}]no control windows; false positives cannot be counted[/]")
        return
    s = scored.set_index(pd.to_datetime(scored.date))["ei"]
    segs = [s.loc[str(w["start"]):str(w["end"])].dropna() for w in controls]
    pooled = pd.concat(segs)
    t = Table(box=box.SIMPLE_HEAD, header_style="bold")
    for c in ["n", "mean", "p90", "p95", "p99", "max", "suggested"]:
        t.add_column(c, justify="right")
    t.add_row(f"{len(pooled):,}", f"{pooled.mean():.2f}",
              f"{pooled.quantile(.90):.2f}", f"{pooled.quantile(.95):.2f}",
              f"{pooled.quantile(.99):.2f}", f"{pooled.max():.2f}",
              Text(f"{pooled.quantile(.95):.2f}", style="bold"))
    cs.print(Panel(t, title="threshold proposal, control windows only",
                   subtitle="index is on the live 0-100 scale",
                   box=box.ROUNDED, border_style=DIM))


def evaluate(name: str, variant: str = "norm"):
    st = region_state(name)
    ph, _ = phase(st)
    if ph != "ready to evaluate":
        cs.print(Panel(
            Text(f"{name} is not ready: {ph}.\n\n"
                 "Evaluation stays locked until the threshold and the "
                 "pre-registration commit are both in the file and the commit "
                 "exists in git. That guard is the point, not an obstacle.",
                 style=WARN),
            title="blocked", box=box.ROUNDED, border_style=WARN))
        return
    scored, st = build_series(name)
    if scored is None:
        return
    cs.print(proxy_warning())
    gt = st["gt"]
    thr, lead = float(gt["threshold"]), int(gt["lead_window_days"])
    s = scored.set_index(pd.to_datetime(scored.date))["ei"]

    t = Table(box=box.SIMPLE_HEAD, header_style="bold")
    t.add_column("event"); t.add_column("date")
    t.add_column("tier", justify="right"); t.add_column("peak", justify="right")
    t.add_column("result")
    hits = misses = 0
    for e in gt["events"]:
        d = pd.Timestamp(str(e["event_date"]))
        w = s.loc[d - pd.Timedelta(days=lead): d - pd.Timedelta(days=1)].dropna()
        if w.empty:
            t.add_row(e["event_key"], str(d.date()), str(e["severity_tier"]),
                      "-", Text("no data", style=DIM))
            continue
        peak, started = w.max(), w.iloc[0] >= thr
        if peak >= thr and not started:
            hits += 1; res = Text("HIT", style=f"bold {OK}")
        elif peak >= thr:
            res = Text("hit (inherited)", style=DIM)
        else:
            misses += 1; res = Text("miss", style=BAD)
        t.add_row(e["event_key"], str(d.date()), str(e["severity_tier"]),
                  f"{peak:.2f}", res)
    cs.print(Panel(t, title=f"event study, threshold {thr:.2f}, lead {lead}d",
                   box=box.ROUNDED, border_style=DIM))

    ft = Table(box=box.SIMPLE_HEAD, header_style="bold")
    ft.add_column("control window"); ft.add_column("crossings", justify="right")
    ft.add_column("days", justify="right"); ft.add_column("rate", justify="right")
    fp = days = 0
    for w in gt["control_windows"]:
        seg = s.loc[str(w["start"]):str(w["end"])].dropna()
        n = int((seg >= thr).sum()); fp += n; days += len(seg)
        rate = n / len(seg) if len(seg) else float("nan")
        style = OK if rate < 0.10 else (WARN if rate < 0.25 else BAD)
        ft.add_row(f"{w['start']} .. {w['end']}", f"{n:,}", f"{len(seg):,}",
                   Text(f"{rate:.1%}", style=style))
    ft.add_row("pooled", f"{fp:,}", f"{days:,}",
               Text(f"{fp/days:.1%}" if days else "-", style="bold"))
    cs.print(Panel(ft, title="false positives", box=box.ROUNDED, border_style=DIM))
    cs.print(f"  [bold]hits {hits}   misses {misses}[/]   "
             f"[{DIM}]pre-registered as {st['sha'][:10]}[/]")


def run_script(script: str, *args: str):
    cmd = [sys.executable, str(ROOT / script), *args]
    cs.print(f"[{DIM}]$ {' '.join(cmd[1:])}[/]")
    subprocess.run(cmd, cwd=ROOT)


# ---------------------------------------------------------------- shell


MENU = [
    ("1", "threshold proposal", "reads control windows only"),
    ("2", "evaluate", "locked until pre-registration is committed"),
    ("3", "registry recall", "against the external reference list"),
    ("4", "load GDELT extracts", "csv into the local store"),
    ("5", "cluster exercises", "articles into registry rows"),
    ("q", "quit", ""),
]


def pick_region() -> str | None:
    rs = regions()
    if not rs:
        cs.print(f"[{BAD}]no region definitions found[/]")
        return None
    if len(rs) == 1:
        return rs[0]
    return Prompt.ask("region", choices=rs, default=rs[-1])


def main() -> int:
    global con
    if DB.exists():
        con = duckdb.connect(str(DB), read_only=True)

    while True:
        cs.clear()
        cs.print(header())
        cs.print(overview())
        cs.print(registry_panel())
        m = Table.grid(padding=(0, 2))
        m.add_column(style="bold"); m.add_column(); m.add_column(style=DIM)
        for k, label, hint in MENU:
            m.add_row(k, label, hint)
        cs.print(Panel(m, box=box.ROUNDED, border_style=DIM))

        choice = Prompt.ask("", choices=[k for k, _, _ in MENU], default="1",
                            show_choices=False)
        if choice == "q":
            break
        cs.print()
        try:
            if choice == "1":
                r = pick_region()
                if r:
                    propose(r)
            elif choice == "2":
                r = pick_region()
                if r:
                    evaluate(r)
            elif choice == "3":
                run_script("recall_check.py")
            elif choice == "4":
                run_script("load.py", "--data", "data", "--db", "retro.duckdb")
                if con:
                    con.close()
                con = duckdb.connect(str(DB), read_only=True)
            elif choice == "5":
                run_script("exercises_cluster.py", "--urls",
                           "data/code15_urls.csv", "--out",
                           "data/exercise_clusters.csv", "--confirmed-only")
        except Exception as exc:
            cs.print(Panel(Text(f"{type(exc).__name__}: {exc}", style=BAD),
                           title="failed", box=box.ROUNDED, border_style=BAD))
        Prompt.ask(f"[{DIM}]enter to continue[/]", default="", show_default=False)

    if con:
        con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
