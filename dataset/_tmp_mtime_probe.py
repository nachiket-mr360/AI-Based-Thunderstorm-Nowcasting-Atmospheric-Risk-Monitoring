"""Temporary probe: mtimes of Phase 1-7 protected artifacts."""
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CUTOFF = datetime(2026, 9, 15, 4, 44, tzinfo=timezone.utc)

newest = []
for pattern in ("models/*", "outputs/*", "dataset/**/*", "ml/*", "dataset/*"):
    for path in ROOT.glob(pattern):
        if not path.is_file():
            continue
        mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
        newest.append((mtime, path.relative_to(ROOT).as_posix()))

newest.sort(reverse=True)
print("PHASE 8 WORK-START CUTOFF:", CUTOFF.isoformat())
for mtime, name in newest[:15]:
    flag = "AFTER-CUTOFF" if mtime >= CUTOFF else "ok"
    print(f"  {flag:12} {mtime.isoformat()}  {name}")
