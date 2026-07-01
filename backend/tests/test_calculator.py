"""Tests for the EI core math — regressions here mean a silently wrong index."""
from datetime import date, timedelta
from app.di.calculator import (_gz_from_events, _corroboration_bonus,
                               SEVERITY_WEIGHT, CONFLICT_BASELINE, REGIONS)
from app.regions import REGIONS as CANON_REGIONS

TODAY = date(2026, 7, 1)


def ev(severity=1, days_ago=0, corroboration=1):
    return {"severity": severity, "corroboration": corroboration,
            "date": (TODAY - timedelta(days=days_ago)).isoformat()}


def test_gz_empty_is_zero():
    assert _gz_from_events([], TODAY) == 0.0


def test_gz_bounded_zero_one():
    heavy = [ev(severity=5, corroboration=20) for _ in range(200)]
    v = _gz_from_events(heavy, TODAY)
    assert 0.0 <= v <= 1.0


def test_severity_dominates_count():
    # one level-5 event must outweigh many level-1 events (tragedy beats noise)
    one_big = _gz_from_events([ev(severity=5)], TODAY)
    ten_small = _gz_from_events([ev(severity=1) for _ in range(10)], TODAY)
    assert one_big > ten_small


def test_severity_weights_convex():
    w = SEVERITY_WEIGHT
    assert w[1] < w[2] < w[3] < w[4] < w[5]
    assert w[5] / w[1] == 40.0  # documented invariant


def test_recent_events_weigh_more():
    recent = _gz_from_events([ev(severity=3, days_ago=1)], TODAY)
    old    = _gz_from_events([ev(severity=3, days_ago=20)], TODAY)
    assert recent > old


def test_corroboration_sublinear_and_capped():
    assert _corroboration_bonus(1) == 1.0
    assert _corroboration_bonus(5) > _corroboration_bonus(2)
    # doubling sources far from doubling the bonus
    assert _corroboration_bonus(20) < 1.5


def test_gz_monotonic_in_events():
    a = _gz_from_events([ev(severity=3)], TODAY)
    b = _gz_from_events([ev(severity=3), ev(severity=3)], TODAY)
    assert b > a


def test_region_lists_in_sync():
    # calculator REGIONS must exactly match canonicalizer REGIONS
    assert set(REGIONS) == set(CANON_REGIONS)
    # every region must have a baseline
    assert set(CONFLICT_BASELINE.keys()) == set(REGIONS)


def test_baselines_sane():
    for r, b in CONFLICT_BASELINE.items():
        assert 0.0 <= b <= 0.5, f"{r} baseline out of sane range"
