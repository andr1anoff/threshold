"""Tests for region canonicalization — non-canonical regions vanish from the index."""
from app.regions import canonicalize, resolve, REGIONS


def test_canonical_idempotent():
    for r in REGIONS:
        assert canonicalize(r) == r


def test_case_insensitive():
    assert canonicalize("ukraine") == "Ukraine"
    assert canonicalize("BALTIC") == "Baltic"


def test_country_folding():
    assert canonicalize("Lebanon") == "Gaza & Middle East"
    assert canonicalize("Iran") == "Gaza & Middle East"


def test_none_and_garbage():
    assert canonicalize(None) is None
    assert canonicalize("") is None
    assert canonicalize("Atlantis") is None


def test_resolve_from_text():
    assert resolve("Israeli strike near Beirut kills 3") == "Gaza & Middle East"
    assert resolve("PLA aircraft cross Taiwan median line") == "Taiwan Strait"
    assert resolve("Drone wave hits Odesa overnight") == "Ukraine"
