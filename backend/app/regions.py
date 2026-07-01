"""
regions.py — single source of truth for region canonicalization.

Problem this solves:
  Incidents get a `region` from two places — the scraper's keyword detector
  and the LLM classifier's free-text output. Both can produce values that do
  NOT exactly match one of the 20 canonical regions (e.g. "Lebanon",
  "Middle East", "Iran", "Estonia", or None). The DI calculator filters
  incidents with `.eq("region", <canonical>)`, so anything non-canonical
  silently vanishes from the index — it is indexed nowhere.

  This module guarantees every incident is mapped to exactly one canonical
  region (or "Unknown" only when truly nothing matches).

Usage:
  from app.regions import canonicalize, resolve
  canonicalize("Lebanon")            -> "Gaza & Middle East"
  canonicalize("middle east")        -> "Gaza & Middle East"
  canonicalize("Ukraine")            -> "Ukraine"   (idempotent)
  resolve("Israeli strike near Beirut kills 3") -> "Gaza & Middle East"
"""
from __future__ import annotations

# The 20 canonical regions. MUST match di/calculator.py REGIONS exactly.
REGIONS = [
    "Gaza & Middle East", "Ukraine", "Sudan", "South China Sea", "Taiwan Strait",
    "Yemen", "Sahel", "Korean Peninsula", "Myanmar", "DRC", "Syria", "Somalia",
    "Baltic", "Haiti", "Ethiopia", "South Caucasus", "Libya", "Kosovo", "Arctic",
    "Mozambique",
]
_CANON = {r.lower(): r for r in REGIONS}

# Direct country / actor / city -> region. Lowercase keys. Order doesn't matter;
# longer, more specific keys are checked first (see _match below) to avoid
# e.g. "iran" stealing a headline that's really about something else.
COUNTRY_MAP = {
    # --- Gaza & Middle East (broad bucket: Israel-centred conflict system) ---
    "palestine": "Gaza & Middle East", "palestinian": "Gaza & Middle East",
    "gaza": "Gaza & Middle East", "israel": "Gaza & Middle East",
    "israeli": "Gaza & Middle East", "west bank": "Gaza & Middle East",
    "jerusalem": "Gaza & Middle East", "idf": "Gaza & Middle East",
    "hamas": "Gaza & Middle East", "rafah": "Gaza & Middle East",
    # Lebanon / Hezbollah — the gap that hid the 2026 Lebanon war
    "lebanon": "Gaza & Middle East", "lebanese": "Gaza & Middle East",
    "hezbollah": "Gaza & Middle East", "hizbollah": "Gaza & Middle East",
    "beirut": "Gaza & Middle East", "nabatieh": "Gaza & Middle East",
    "tyre": "Gaza & Middle East", "litani": "Gaza & Middle East",
    # Iran (currently folded into the ME conflict system, 2026 Iran war)
    "iran": "Gaza & Middle East", "iranian": "Gaza & Middle East",
    "tehran": "Gaza & Middle East", "irgc": "Gaza & Middle East",

    # --- Ukraine ---
    "ukraine": "Ukraine", "ukrainian": "Ukraine", "kyiv": "Ukraine",
    "kiev": "Ukraine", "donetsk": "Ukraine", "kharkiv": "Ukraine",
    "zaporizhzhia": "Ukraine", "crimea": "Ukraine", "kherson": "Ukraine",
    "odesa": "Ukraine", "odessa": "Ukraine", "mykolaiv": "Ukraine",
    "sumy": "Ukraine", "lviv": "Ukraine", "dnipro": "Ukraine",

    # --- Sudan ---
    "sudan": "Sudan", "sudanese": "Sudan", "khartoum": "Sudan",
    "darfur": "Sudan", "rsf": "Sudan", "el fasher": "Sudan",

    # --- South China Sea ---
    "south china sea": "South China Sea", "spratly": "South China Sea",
    "scarborough": "South China Sea", "philippine": "South China Sea",
    "philippines": "South China Sea", "manila": "South China Sea",
    "second thomas shoal": "South China Sea",

    # --- Taiwan Strait ---
    "taiwan": "Taiwan Strait", "taipei": "Taiwan Strait",
    "taiwanese": "Taiwan Strait", "taiwan strait": "Taiwan Strait",

    # --- Yemen ---
    "yemen": "Yemen", "yemeni": "Yemen", "houthi": "Yemen",
    "sanaa": "Yemen", "red sea": "Yemen", "hodeidah": "Yemen",

    # --- Sahel ---
    "mali": "Sahel", "malian": "Sahel", "burkina faso": "Sahel",
    "niger": "Sahel", "sahel": "Sahel", "wagner": "Sahel",
    "bamako": "Sahel", "jnim": "Sahel",

    # --- Korean Peninsula ---
    "north korea": "Korean Peninsula", "dprk": "Korean Peninsula",
    "pyongyang": "Korean Peninsula", "south korea": "Korean Peninsula",
    "seoul": "Korean Peninsula", "korean peninsula": "Korean Peninsula",

    # --- Myanmar ---
    "myanmar": "Myanmar", "burma": "Myanmar", "burmese": "Myanmar",
    "naypyidaw": "Myanmar", "rohingya": "Myanmar", "rakhine": "Myanmar",

    # --- DRC ---
    "democratic republic of congo": "DRC", "dr congo": "DRC", "drc": "DRC",
    "kivu": "DRC", "goma": "DRC", "m23": "DRC", "kinshasa": "DRC",

    # --- Syria ---
    "syria": "Syria", "syrian": "Syria", "damascus": "Syria",
    "aleppo": "Syria", "idlib": "Syria",

    # --- Somalia ---
    "somalia": "Somalia", "somali": "Somalia", "mogadishu": "Somalia",
    "al-shabaab": "Somalia", "al shabaab": "Somalia",

    # --- Haiti ---
    "haiti": "Haiti", "haitian": "Haiti", "port-au-prince": "Haiti",

    # --- Ethiopia ---
    "ethiopia": "Ethiopia", "ethiopian": "Ethiopia", "addis ababa": "Ethiopia",
    "tigray": "Ethiopia", "amhara": "Ethiopia",

    # --- South Caucasus ---
    "armenia": "South Caucasus", "armenian": "South Caucasus",
    "azerbaijan": "South Caucasus", "azerbaijani": "South Caucasus",
    "nagorno": "South Caucasus", "karabakh": "South Caucasus",
    "yerevan": "South Caucasus", "baku": "South Caucasus", "georgia": "South Caucasus",

    # --- Libya ---
    "libya": "Libya", "libyan": "Libya", "tripoli": "Libya",
    "benghazi": "Libya", "haftar": "Libya",

    # --- Kosovo ---
    "kosovo": "Kosovo", "pristina": "Kosovo", "kosovan": "Kosovo",

    # --- Baltic ---
    "estonia": "Baltic", "latvia": "Baltic", "lithuania": "Baltic",
    "estonian": "Baltic", "latvian": "Baltic", "lithuanian": "Baltic",
    "kaliningrad": "Baltic", "suwalki": "Baltic", "baltic": "Baltic",

    # --- Arctic ---
    "svalbard": "Arctic", "greenland": "Arctic", "arctic": "Arctic",
    "barents": "Arctic", "murmansk": "Arctic",

    # --- Mozambique ---
    "mozambique": "Mozambique", "cabo delgado": "Mozambique", "maputo": "Mozambique",

    # --- aliases that mean an existing canonical region ---
    "middle east": "Gaza & Middle East",
    "south caucasus": "South Caucasus",
}

# Multi-word keys must be tested before single-word keys so "south china sea"
# wins over "china"-like partials. Pre-sort by length descending, once.
_SORTED_KEYS = sorted(COUNTRY_MAP.keys(), key=len, reverse=True)


def canonicalize(value: str | None) -> str | None:
    """
    Map any region-ish string to a canonical region, or None if no match.
    Idempotent: a canonical region maps to itself.
    """
    if not value:
        return None
    v = value.strip().lower()
    if v in _CANON:                      # already canonical
        return _CANON[v]
    if v in COUNTRY_MAP:                 # exact alias / country name
        return COUNTRY_MAP[v]
    # substring scan (handles "Lebanon: Israeli airstrikes ...")
    for key in _SORTED_KEYS:
        if key in v:
            return COUNTRY_MAP[key]
    return None


def resolve(*texts: str) -> str | None:
    """
    Resolve a region from one or more free-text fields (title, raw_text, ...).
    Returns canonical region or None. Use at insert time as a safety net.
    """
    blob = " ".join(t for t in texts if t).lower()
    if not blob:
        return None
    for key in _SORTED_KEYS:
        if key in blob:
            return COUNTRY_MAP[key]
    return None


def is_canonical(value: str | None) -> bool:
    return bool(value) and value in REGIONS
