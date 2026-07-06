# Threshold

Open-source monitoring of geopolitical escalation. Threshold reads open-source conflict and security reporting across 20 theatres, classifies incidents, and computes a per-region **Escalation Index (EI)**. It also tracks a curated layer of joint military exercises.

**Status:** public beta. Methodology is versioned per record (current: `v18`). The index is a transparent heuristic, not a forecast.

Live: [threshold-osint.com](https://threshold-osint.com)

---

## What the Escalation Index is, and what it is not

The EI measures **relative escalation pressure** in a theatre against that theatre's own recent baseline. It is not a casualty counter and not a severity score for human suffering.

This distinction matters and it produces behaviour that looks counterintuitive at first. In a high-violence theatre, a day with several lethal incidents can still show a falling EI if that day's weighted event load sits below the region's recent norm. A rising EI means activity above the observed baseline, not simply that bad things happened. Reading the number as a body count will mislead you.

Because the index normalises each region against its own history, scores are comparable across theatres by construction rather than by raw volume. A quiet theatre and an active war zone are placed on the same relative scale.

## How the index is built

The composite is a weighted sum of three components, scaled to 0 to 100:

```
EI = (GZ * 0.45 + EX * 0.35 + BASE * 0.20) * 100
```

- **GZ, gray-zone load (0.45).** Deduplicated event load over a 30-day window with a 7-day recency boost. Not a raw report count. Multiple media reports about the same strike collapse into one event before scoring, so the index is not inflated by coverage volume.
- **EX, exercise signal (0.35).** Active and upcoming joint military exercises assigned to the theatre, drawn from the curated registry.
- **BASE, structural baseline (0.20).** A per-region constant reflecting the standing conflict floor.

Each region is normalised by a trailing 90-day median (per-region κ), so a fixed κ does not have to cover the large volume spread between theatres. Regions without enough history fall back to a legacy calibration and are flagged `RECALIBRATING` in the interface until their median stabilises.

The weights are theory-driven and fixed. They are documented, not tuned to make any single region look a particular way. Empirical calibration against historical anchors is a planned research step, not a claim the project makes today.

## Pipeline

```
scrape  ->  keyword pre-gate  ->  LLM classification  ->  event grouping (dedup)  ->  per-region κ  ->  EI
```

Scraping and classification run twice daily (06:00 and 18:00 UTC) on GitHub Actions, with a Sunday resweep pass for anything left unclassified. A keyword pre-gate runs before the LLM to cut classification calls on irrelevant items. The classifier uses a fallback chain (Groq, then OpenRouter) so a single provider outage does not stall the pipeline. Raw reports are never deleted; deduplication happens at read time.

## Data sources

38 feeds across 25 grouped sources, tiered by confidence. The full list with per-source notes is documented in the interface under About. Summary:

**Institutional and academic (high confidence).** OCHA / ReliefWeb, UCDP Uppsala, UN News, UN Security Council. Primary verification layer.

**Regional and local press.** One or more dedicated feeds per theatre, added in July 2026 as a coverage floor: Baltic (ERR, LSM, LRT, Yle), Taiwan Strait (Taipei Times, Focus Taiwan), Korean Peninsula (38 North, NK News), South Caucasus (OC Media, JAMnews, Civil.ge), Kosovo (Balkan Insight), Ukraine (Kyiv Independent, Kyiv Post), Sudan (Radio Dabanga, Sudan Tribune), Libya / Somalia / Ethiopia / Mozambique (Libya Herald, Somali Guardian, Ethiopia Observer, Zitamar), Myanmar (Myanmar Now, DVB), Haiti and Arctic (Haitian Times, Eye on the Arctic).

**Defence and global OSINT.** Bellingcat, defence trade press (Breaking Defense, Defense News, Naval News), analysis (RUSI, War on the Rocks, The Diplomat), Middle East Eye, DeepState (tactical context only).

**Exercise registry (curated).** NATO exercise programme and SHAPE releases, service and command press releases (USFK, US Pacific Fleet, national MoDs), named-exercise reference pages for projected cycle entries.

**Discovery and secondary.** Guardian API, GDELT, Wikipedia Current Events. Used to surface events for verification, never as sole evidence.

## Exercise layer

The joint-military-exercise layer is a hand-curated registry, not an automated scrape. Each entry carries a source URL, announced dates, and an announcement status (confirmed, or projected from an established cycle). An exercise feeds a theatre's EX component only when it takes place in that theatre; power-projection exercises elsewhere appear on the map but do not affect any theatre's score. The registry is versioned in this repository and reviewed monthly.

## Interface

Overview, Incidents, Exercises, War Room (map), Briefs, and per-region dossiers. Empty states are shown as empty. No displayed value is ever synthetic.

## Stack

- Frontend: React, Vite (Vercel)
- Backend: FastAPI (Railway)
- Database: Supabase / PostgreSQL
- Pipeline: GitHub Actions, Python, LLM classification (Groq with OpenRouter fallback)

## Limitations

- The index is relative, not absolute. A score of 100 means "top of the current observed watch-list," not a fixed catastrophe anchor.
- No backtesting has been run yet. Validation against historical episodes (Crimea 2014, Nagorno-Karabakh 2020, February 2022) is planned.
- Regional coverage is uneven. Theatres with thinner source pools produce noisier scores and are flagged accordingly.
- LLM classification carries a known error rate. The pipeline mitigates this with a defined rubric, a pre-gate, and corroboration weighting, but does not eliminate it.

These limitations are stated deliberately. Threshold is an accountability and transparency instrument built on open data, not a predictive black box.

## Roadmap

Classifier refactor from scheduler to queue (classify only new incidents at scrape time), backtesting against historical anchors, per-region methodology exposed through the API, and a public methodology paper.

## Author

Ivan Andrianov. Built solo.
[evandrianov.pro](https://evandrianov.pro) · [Substack](https://evandrianov.substack.com)

## License

Released under the GNU AGPL-3.0. See [LICENSE](LICENSE).
