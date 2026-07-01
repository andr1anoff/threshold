"""Tests for insert-time dedup hashing."""
from app.scrapers.deduplicator import make_hash


def test_hash_stable():
    assert make_hash("Title A", "https://x.com/1") == make_hash("Title A", "https://x.com/1")


def test_hash_differs_on_url():
    assert make_hash("Title A", "https://x.com/1") != make_hash("Title A", "https://x.com/2")


def test_hash_differs_on_title():
    assert make_hash("Title A", "https://x.com/1") != make_hash("Title B", "https://x.com/1")


def test_hash_truncates_title_at_100():
    long_a = "x" * 100 + "AAA"
    long_b = "x" * 100 + "BBB"
    # identical first 100 chars + same url -> same hash by design
    assert make_hash(long_a, "u") == make_hash(long_b, "u")
