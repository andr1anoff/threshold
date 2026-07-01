"""Tests for event_grouper — the layer that makes the EI source-count invariant."""
from app.scrapers.event_grouper import group_into_events, _similar


def test_identical_titles_merge():
    incs = [
        {"id": 1, "title": "Russia holds massive military drills near border", "date": "2026-06-01", "escalation_level": 2},
        {"id": 2, "title": "Russia holds massive military drills near border", "date": "2026-06-01", "escalation_level": 3},
    ]
    events = group_into_events(incs)
    assert len(events) == 1
    assert events[0]["corroboration"] == 2
    assert events[0]["severity"] == 3  # worst framing wins


def test_similar_titles_same_event():
    incs = [
        {"id": 1, "title": "Israeli airstrike hits Damascus suburb, three killed", "date": "2026-06-01", "escalation_level": 4},
        {"id": 2, "title": "Three killed in Israeli airstrike on Damascus suburb", "date": "2026-06-02", "escalation_level": 4},
    ]
    assert len(group_into_events(incs)) == 1


def test_different_events_stay_separate():
    incs = [
        {"id": 1, "title": "Chinese coast guard water-cannons Philippine vessel at shoal", "date": "2026-06-01", "escalation_level": 2},
        {"id": 2, "title": "North Korea launches ballistic missile into Sea of Japan", "date": "2026-06-01", "escalation_level": 3},
    ]
    assert len(group_into_events(incs)) == 2


def test_date_window_blocks_merge():
    incs = [
        {"id": 1, "title": "Drone strike on energy infrastructure in Sumy oblast", "date": "2026-06-01", "escalation_level": 3},
        {"id": 2, "title": "Drone strike on energy infrastructure in Sumy oblast", "date": "2026-06-10", "escalation_level": 3},
    ]
    # 9 days apart > DATE_WINDOW=1 — same wording, but different events
    assert len(group_into_events(incs)) == 2


def test_event_date_is_earliest():
    incs = [
        {"id": 1, "title": "Border clash reported in Tavush section", "date": "2026-06-02", "escalation_level": 2},
        {"id": 2, "title": "Border clash reported in Tavush section", "date": "2026-06-01", "escalation_level": 2},
    ]
    assert group_into_events(incs)[0]["date"] == "2026-06-01"


def test_empty_input():
    assert group_into_events([]) == []


def test_similarity_separates_threshold():
    same = _similar("NATO begins Baltic naval exercise", "Baltic naval exercise begun by NATO")
    diff = _similar("NATO begins Baltic naval exercise", "Sudan RSF advances on El Fasher")
    assert same >= 70.0
    assert diff < 70.0
