"""
Seed known JMEs into Supabase.
Run once: python scripts/seed_exercises.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.db.supabase import get_client
from app.llm.exercise_classifier import classify_exercise

EXERCISES = [
    {"name":"STEADFAST DETERRENCE 2026","lead_nation":"NATO/SHAPE","region":"Baltic","start_date":"2026-05-01","end_date":"2026-05-31","scale":None,"signal_target":"Russia","rhetoric_score":0.82,"source_url":"https://shape.nato.int","statements":{"raw_summary":"Nuclear deterrence procedures and SWHQ certification exercise across all 32 NATO nations in the Baltic and High North."}},
    {"name":"DYNAMIC MONGOOSE 26","lead_nation":"NATO/SHAPE","region":"Baltic","start_date":"2026-05-05","end_date":"2026-05-20","scale":3000,"signal_target":"Russia","rhetoric_score":0.65,"source_url":"https://shape.nato.int","statements":{"raw_summary":"Anti-submarine warfare exercise in the North Atlantic and High North involving 14 NATO nations."}},
    {"name":"AURORA 26","lead_nation":"Sweden","region":"Baltic","start_date":"2026-06-01","end_date":"2026-06-30","scale":20000,"signal_target":"Russia","rhetoric_score":0.58,"source_url":"https://www.mil.se","statements":{"raw_summary":"Swedish national exercise in the Baltic Sea focused on maritime and air defence of the Baltic flank."}},
    {"name":"NEPTUNE STRIKE 26","lead_nation":"NATO/SHAPE","region":"Mediterranean","start_date":"2026-05-10","end_date":"2026-05-25","scale":8000,"signal_target":"Russia","rhetoric_score":0.60,"source_url":"https://shape.nato.int","statements":{"raw_summary":"NATO carrier strike group exercise in the Mediterranean focusing on sea control and power projection."}},
    {"name":"IRON UNION 26","lead_nation":"US (CENTCOM)","region":"Gaza & Middle East","start_date":"2026-04-01","end_date":"2026-04-15","scale":None,"signal_target":"Iran","rhetoric_score":0.71,"source_url":"https://www.centcom.mil","statements":{"raw_summary":"US-Israel bilateral command post exercise focused on integrated air and missile defence."}},
    {"name":"TALISMAN SABRE 2026","lead_nation":"US (INDOPACOM)","region":"South China Sea","start_date":"2026-07-01","end_date":"2026-07-25","scale":30000,"signal_target":"China","rhetoric_score":0.55,"source_url":"https://www.pacom.mil","statements":{"raw_summary":"US-Australia combined arms live exercise in the Indo-Pacific involving 15 nations focused on amphibious operations."}},
    {"name":"RIMPAC 2026","lead_nation":"US Pacific Fleet","region":"South China Sea","start_date":"2026-06-01","end_date":"2026-08-01","scale":25000,"signal_target":"General deterrence","rhetoric_score":0.45,"source_url":"https://www.cpf.navy.mil","statements":{"raw_summary":"World's largest international maritime warfare exercise involving 26 nations in the Pacific Ocean."}},
    {"name":"STEADFAST DART 2025","lead_nation":"NATO/SHAPE","region":"South Caucasus","start_date":"2025-01-20","end_date":"2025-02-28","scale":10000,"signal_target":"Russia","rhetoric_score":0.60,"source_url":"https://shape.nato.int","statements":{"raw_summary":"NATO rapid deployment exercise in Romania and Greece testing Allied Reaction Force capability."}},
    {"name":"STEADFAST DEFENDER 2024","lead_nation":"NATO/SHAPE","region":"Baltic","start_date":"2024-01-22","end_date":"2024-05-31","scale":90000,"signal_target":"Russia","rhetoric_score":0.85,"source_url":"https://shape.nato.int","statements":{"raw_summary":"NATO's largest exercise since the Cold War. Tested ability to reinforce Europe across all domains. 90,000 troops, 32 nations."}},
    {"name":"CYBER COALITION 2025","lead_nation":"NATO/SHAPE","region":"Baltic","start_date":"2025-11-01","end_date":"2025-11-30","scale":1300,"signal_target":"Russia","rhetoric_score":0.55,"source_url":"https://shape.nato.int","statements":{"raw_summary":"NATO's flagship cyber defence exercise. 1,300 participants from 32 nations in Tallinn, Estonia."}},
]

def main():
    db = get_client()
    inserted = 0
    classified = 0
    for ex in EXERCISES:
        try:
            existing = db.table("exercises").select("id").eq("name", ex["name"]).execute()
            if existing.data:
                print(f"Skip (exists): {ex['name']}")
                continue
            # LLM classify
            context = ex["statements"]["raw_summary"]
            result = classify_exercise(ex["name"], context)
            if result:
                ex["exercise_type"] = result.get("exercise_type")
                ex["domain"] = result.get("domain")
                ex["scale_label"] = result.get("scale")
                ex["signal_type"] = result.get("signal_type")
                classified += 1
                print(f"Classified: {ex['name']} → {ex['exercise_type']} / {ex['signal_type']}")
            db.table("exercises").insert(ex).execute()
            inserted += 1
            print(f"Inserted: {ex['name']}")
        except Exception as e:
            print(f"Error {ex['name']}: {e}")
    print(f"\nDone: {inserted} inserted, {classified} LLM-classified")

main()
