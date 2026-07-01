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


# ── v18: per-region κ normalization ──────────────────────────────────
from app.di.calculator import (_load_from_events, _kappa_for_region, _median,
                               KAPPA_FLOOR, NORM_C, GZ_AT_NORM)


def _steady_events(weight_level=3, per_day=1, days=120, ref=TODAY):
    """Synthetic steady theatre: `per_day` level-N events daily for `days`."""
    out = []
    for d in range(days):
        for i in range(per_day):
            out.append({"severity": weight_level, "corroboration": 1,
                        "date": (ref - timedelta(days=d)).isoformat()})
    return out


def test_median_basic():
    assert _median([]) == 0.0
    assert _median([5]) == 5
    assert _median([1, 3, 100]) == 3
    assert _median([1, 2, 3, 4]) == 2.5


def test_kappa_floor_on_empty_history():
    assert _kappa_for_region([], TODAY) == KAPPA_FLOOR


def test_load_respects_30d_window():
    evs = _steady_events(per_day=1, days=120)
    load_now = _load_from_events(evs, TODAY)
    # only ~30 days of events should be counted, not all 120
    single = _load_from_events([evs[40]], TODAY - timedelta(days=40))
    assert load_now < single * 40


def test_normalization_steady_state():
    """A steady theatre must sit at GZ_AT_NORM regardless of its volume."""
    quiet = _steady_events(weight_level=2, per_day=1)    # low-volume region
    loud  = _steady_events(weight_level=3, per_day=8)    # 20x the load
    for evs in (quiet, loud):
        kappa = _kappa_for_region(evs, TODAY)
        gz = _gz_from_events(evs, TODAY, kappa=kappa)
        assert abs(gz - GZ_AT_NORM) < 0.06, f"steady state gz={gz}"


def test_spike_detected_against_own_norm():
    """Same relative spike -> similar GZ response in quiet and loud theatres."""
    def spiked(base):
        evs = list(base)
        for d in range(5):  # 5 recent level-4 events on top of the norm
            evs.append({"severity": 4, "corroboration": 3,
                        "date": (TODAY - timedelta(days=d)).isoformat()})
        return evs

    quiet = _steady_events(weight_level=2, per_day=1)   # genuinely quiet norm
    loud  = _steady_events(per_day=8)
    gz_q_base = _gz_from_events(quiet, TODAY, kappa=_kappa_for_region(quiet, TODAY))
    gz_q_spike = _gz_from_events(spiked(quiet), TODAY, kappa=_kappa_for_region(spiked(quiet), TODAY))
    gz_l_spike = _gz_from_events(spiked(loud), TODAY, kappa=_kappa_for_region(spiked(loud), TODAY))
    # spike must move the quiet theatre substantially...
    assert gz_q_spike - gz_q_base > 0.25
    # ...and much more than the same absolute spike moves the loud theatre
    assert gz_q_spike > gz_l_spike + 0.2


def test_source_step_decays_via_median():
    """Doubling observability shifts GZ up, but the trailing median absorbs it
    once the new volume dominates the baseline window."""
    old = _steady_events(per_day=2, days=120)
    # simulate: 100 days at doubled volume (new sources connected 100d ago)
    absorbed = _steady_events(per_day=4, days=100) + \
               [e for e in _steady_events(per_day=2, days=120)
                if e["date"] < (TODAY - timedelta(days=100)).isoformat()]
    gz_old = _gz_from_events(old, TODAY, kappa=_kappa_for_region(old, TODAY))
    gz_abs = _gz_from_events(absorbed, TODAY, kappa=_kappa_for_region(absorbed, TODAY))
    assert abs(gz_abs - gz_old) < 0.08  # step absorbed after recalibration window


def test_dead_region_single_event_is_loud():
    evs = [{"severity": 4, "corroboration": 2,
            "date": (TODAY - timedelta(days=1)).isoformat()}]
    kappa = _kappa_for_region(evs, TODAY)
    assert kappa == KAPPA_FLOOR
    gz = _gz_from_events(evs, TODAY, kappa=kappa)
    assert gz > 0.5  # early-warning by design
