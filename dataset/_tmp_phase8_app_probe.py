"""Temporary probe: import the Flask app and print its URL map."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import app as application  # noqa: E402

print("APP IMPORT OK")
for rule in sorted(application.app.url_map.iter_rules(), key=lambda r: str(r)):
    print(f"  {sorted(rule.methods - {'HEAD', 'OPTIONS'})} {rule}")
