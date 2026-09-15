"""Temporary probe: run the Phase 7 engine live and dump the payload keys."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from ml.predict_thunderstorm_nowcast import (  # noqa: E402
    ThunderstormNowcastError,
    predict_current_thunderstorm_risk,
)

try:
    result = predict_current_thunderstorm_risk()
except ThunderstormNowcastError as exc:
    print("ENGINE ERROR", exc.code, exc.message)
    print(json.dumps(exc.detail, indent=2, default=str))
    raise SystemExit(2)

print("PROBABILITY", result["probability"])
print("CLASS", result["predicted_class"])
print("LABEL", result["risk_label"])
print("THRESHOLD", result["threshold"])
print("LEAD", result["lead_time_hours"])
print("PRED_TS", result["prediction_timestamp"])
print("FEAT_TS", result["feature_timestamp"])
print("TARGET_TS", result["target_timestamp"])
print("MODEL", result["model"]["name"], result["model"]["file"])
print("PROV", json.dumps(result["source"]["provenance"], indent=2, default=str))
print("TOPLINE", sorted(result.keys()))
