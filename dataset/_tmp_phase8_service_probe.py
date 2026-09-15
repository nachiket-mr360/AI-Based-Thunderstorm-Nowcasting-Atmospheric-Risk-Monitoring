"""Temporary probe: exercise the Phase 8 service layer directly."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend import nowcast_service as svc  # noqa: E402

health = svc.health_snapshot(probe_upstream=False)
print("HEALTH STATUS", health["status"])
print("MODEL", json.dumps(health["checks"]["primary_model"], indent=2, default=str))
print("ENGINE", json.dumps(health["checks"]["prediction_engine"], indent=2, default=str))

payload = svc.live_nowcast()
print("PROB", payload["probability"])
print("CLASS", payload["predicted_class"])
print("LABEL", payload["risk_label"])
print("THRESHOLD", payload["threshold"])
print("LEAD", payload["lead_time_hours"])
print("MODEL_ID", payload["model_identifier"])
print("GRID", payload["served_grid_cell"])
print("FEAT_COMPLETE", json.dumps(payload["feature_completeness"], indent=2, default=str))
print("ENVELOPE", json.dumps(payload["api"], indent=2, default=str))
