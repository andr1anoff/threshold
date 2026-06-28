"""
event_grouper.py — collapse many raw incidents into distinct EVENTS.

Why: the index used to count raw incidents, so 7 outlets reporting 1 strike =
7 escalation points. That measured media volume, not escalation. Grouping
incidents that describe the SAME event makes the index invariant to source count.

Method (no ML, zero cost, milliseconds for hundreds of rows):
  - caller pre-filters incidents to one region
  - greedy clustering: an incident joins a cluster if its title is similar
    enough to the cluster's representative AND their dates are within DATE_WINDOW
  - each cluster = one event:
       severity      = max escalation_level among members (worst framing wins)
       corroboration = number of members
       date          = earliest member date
       title         = longest member title

Similarity: rapidfuzz max(token_set, token_sort, partial) if available
(threshold 70 cleanly separates same-event ~75-83 from different ~41-45).
Falls back to a difflib token-sort scorer (stdlib) if rapidfuzz is missing.

Upgrade path (v2): swap _similar() for sentence-embedding cosine. Same interface.
"""
from __future__ import annotations
from datetime import date, datetime, timedelta

SIM_THRESHOLD = 70.0   # 0..100
DATE_WINDOW = 1        # days; incidents this far apart can still be one event

try:
    from rapidfuzz import fuzz
    def _similar(a: str, b: str) -> float:
        return max(fuzz.token_set_ratio(a, b),
                   fuzz.token_sort_ratio(a, b),
                   fuzz.partial_ratio(a.lower(), b.lower()))
except Exception:  # stdlib fallback
    from difflib import SequenceMatcher
    def _similar(a: str, b: str) -> float:
        a1, b1 = a.lower(), b.lower()
        raw = SequenceMatcher(None, a1, b1).ratio()
        sa = " ".join(sorted(a1.split()))
        sb = " ".join(sorted(b1.split()))
        srt = SequenceMatcher(None, sa, sb).ratio()
        return max(raw, srt) * 100.0


def _parse_date(d) -> date | None:
    if isinstance(d, date):
        return d
    if not d:
        return None
    try:
        return datetime.fromisoformat(str(d)[:10]).date()
    except Exception:
        return None


def _dates_close(a: date | None, b: date | None) -> bool:
    if a is None or b is None:
        return True  # missing date -> don't block merge on date
    return abs((a - b).days) <= DATE_WINDOW


def group_into_events(incidents: list[dict]) -> list[dict]:
    """
    incidents: dicts with at least {title, date, escalation_level} (one region).
    returns:   event dicts {severity, corroboration, date, title, member_ids}
    """
    clusters: list[list[dict]] = []
    for inc in incidents:
        title = (inc.get("title") or "").strip()
        d = _parse_date(inc.get("date"))
        item = {**inc, "_date": d}
        placed = False
        for cluster in clusters:
            rep = cluster[0]
            rep_title = rep.get("title") or ""
            if (title and rep_title
                    and _dates_close(d, rep.get("_date"))
                    and _similar(title, rep_title) >= SIM_THRESHOLD):
                cluster.append(item)
                placed = True
                break
        if not placed:
            clusters.append([item])

    events: list[dict] = []
    for cluster in clusters:
        levels = [int(m.get("escalation_level") or 1) for m in cluster]
        dates = [m["_date"] for m in cluster if m.get("_date")]
        titles = [m.get("title") or "" for m in cluster]
        events.append({
            "severity": max(levels) if levels else 1,
            "corroboration": len(cluster),
            "date": min(dates).isoformat() if dates else None,
            "title": max(titles, key=len) if titles else "",
            "member_ids": [m.get("id") for m in cluster if m.get("id")],
        })
    return events
