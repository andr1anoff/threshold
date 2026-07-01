"""Weekly maintenance: retry stale 'unclassifiable' incidents. Run by GH Action."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.llm.classifier import resweep_unclassifiable
from app.db.supabase import get_client

result = resweep_unclassifiable(get_client(), limit=300)
print(f"Resweep: {result}")
