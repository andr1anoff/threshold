"""
JME Classifier — LLM-based classification of military exercises.

JME taxonomy based on:
- NATO standardized exercise types (STANAG 6082)
- NATO exercise classification framework
- Academic literature on military signaling
"""
import os, json, logging
from groq import Groq

logger = logging.getLogger(__name__)

MODEL = "llama-3.1-8b-instant"

# NATO/Academic JME classification taxonomy
JME_TAXONOMY = {
    "exercise_type": {
        "LIVEX": "Live Exercise — real troops, equipment, field operations with physical maneuver",
        "CPX":   "Command Post Exercise — HQ/staff exercise, simulated forces, no physical maneuver",
        "CAX":   "Computer-Assisted Exercise — simulation-based, no live forces",
        "MAREX": "Maritime Exercise — naval-focused live operations",
        "ADEX":  "Air Defence Exercise — air domain focused",
        "FTX":   "Field Training Exercise — maneuver and field craft, unit-level",
        "TTX":   "Tabletop Exercise — planning and decision-making, no forces",
        "CX":    "Coordinated Exercise — multi-domain coordination",
    },
    "domain": ["Air", "Maritime", "Land", "Cyber", "Space", "Multi-domain", "Joint"],
    "scale": {
        "Small":     "< 5,000 troops or equivalent",
        "Medium":    "5,000–20,000 troops or equivalent",
        "Large":     "20,000–50,000 troops or equivalent",
        "Strategic": "> 50,000 troops or strategic-level command (regardless of size)",
    },
    "signal_type": {
        "Reassurance":  "Signal toward allies — demonstrating commitment and capability",
        "Deterrence":   "Signal toward adversary — demonstrating capability and will to defend",
        "Coercion":     "Signal toward adversary — demonstrating offensive capability",
        "Compellence":  "Signal toward adversary — demanding behavior change through threat",
        "Ambiguous":    "Mixed or unclear signaling intent",
    },
    "classification": {
        "Routine":    "Regular, scheduled exercise in established programme",
        "Elevated":   "Increased scale, frequency, or urgency relative to baseline",
        "Crisis":     "Explicitly linked to an ongoing or imminent crisis",
        "Declaratory":"Primarily symbolic or political, limited operational content",
    }
}

PROMPT_TEMPLATE = """You are a military exercise analyst with expertise in NATO doctrine and deterrence theory.

Classify this military exercise using the NATO/academic taxonomy. Return ONLY valid JSON.

Exercise: {name}
Context: {context}

Taxonomy reference:
- exercise_type: LIVEX, CPX, CAX, MAREX, ADEX, FTX, TTX, CX
- domain: Air, Maritime, Land, Cyber, Space, Multi-domain, Joint
- scale: Small (<5k), Medium (5-20k), Large (20-50k), Strategic (>50k or strategic HQ)
- signal_type: Reassurance, Deterrence, Coercion, Compellence, Ambiguous
- classification: Routine, Elevated, Crisis, Declaratory
- rhetoric_score: float from -1.0 (de-escalatory) to +1.0 (highly escalatory)
- escalation_contribution: float 0.0-1.0 (contribution to regional escalation index)

Return:
{{"exercise_type":"CPX","domain":"Multi-domain","scale":"Strategic","signal_type":"Deterrence","classification":"Elevated","signal_target":"Russia","rhetoric_score":0.75,"escalation_contribution":0.65,"rationale":"One sentence academic rationale"}}"""

def classify_exercise(name: str, context: str = "") -> dict | None:
    try:
        client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        r = client.chat.completions.create(
            model=MODEL,
            messages=[{"role":"user","content":PROMPT_TEMPLATE.format(name=name, context=context[:400])}],
            max_tokens=200, temperature=0.1,
        )
        txt = r.choices[0].message.content.strip().replace("```json","").replace("```","").strip()
        return json.loads(txt)
    except Exception as e:
        logger.exception(f"[exercise_classifier] {name}: {e}")
        return None

def classify_all_exercises(db) -> int:
    classified = 0
    unclassified = db.table("exercises").select("id,name,statements").is_("exercise_type","null").limit(30).execute()
    for ex in unclassified.data:
        name = ex.get("name","")
        stmts = ex.get("statements") or {}
        context = stmts.get("raw_summary","") or name
        result = classify_exercise(name, context)
        if not result:
            continue
        update = {
            "exercise_type":   result.get("exercise_type"),
            "domain":          result.get("domain"),
            "scale":           result.get("scale"),
            "signal_type":     result.get("signal_type"),
            "classification":  result.get("classification"),
            "signal_target":   result.get("signal_target"),
            "rhetoric_score":  result.get("rhetoric_score"),
        }
        try:
            db.table("exercises").update(update).eq("id", ex["id"]).execute()
            classified += 1
            logger.info(f"[exercise_classifier] {name}: {result.get('exercise_type')} / {result.get('signal_type')}")
        except Exception as e:
            logger.warning(f"[exercise_classifier] update error: {e}")
    return classified

def generate_exercise_brief(exercise: dict) -> str:
    """Generate analytical brief for a specific exercise."""
    prompt = f"""You are a senior military analyst at JFKI, Freie Universität Berlin.
Write a 2-paragraph analytical assessment (max 120 words) of this military exercise.
Focus on: (1) deterrence signaling intent and target audience, (2) contribution to regional escalation dynamics.
Be precise and academic. Do not speculate beyond available evidence.

Exercise: {exercise.get('name','')}
Type: {exercise.get('exercise_type','')} | Domain: {exercise.get('domain','')}
Scale: {exercise.get('scale','')} | Signal type: {exercise.get('signal_type','')}
Signal target: {exercise.get('signal_target','')} | Rhetoric score: {exercise.get('rhetoric_score','')}
Context: {str(exercise.get('statements',{}))[:300]}"""
    try:
        client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        r = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role":"user","content":prompt}],
            max_tokens=300, temperature=0.6,
        )
        return r.choices[0].message.content.strip()
    except Exception as e:
        logger.exception(f"[exercise_brief] {e}")
        return ""
