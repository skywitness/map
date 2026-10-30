"""大學入學考試主題（新主題，製作手冊第六批 93）：各國上大學的主要方式（類別圖），各國的考試名稱寫在附註。

資料是 `sources/admission_tests.py` 依英文維基百科整理的表（CC BY-SA 4.0），只有 2026 年；資料檔依 CC BY-SA 4.0 分享。
"""
from __future__ import annotations

import json

from common import OUT_DIR, indicator_file, now_iso, write_json
from sources import admission_tests


def build() -> None:
    out = OUT_DIR / "topics" / "university-entrance"
    countries = set(json.loads((OUT_DIR / "countries.json").read_text(encoding="utf-8")))
    routes = {c: r for c, r in admission_tests.routes().items() if c in countries}
    missing = sorted(set(admission_tests.routes()) - countries)
    if missing:
        raise RuntimeError(f"地圖上沒有這些國家：{missing}")
    write_json(out / "main-route.json", indicator_file(
        "main-route", "", [admission_tests.YEAR], {c: [r[0]] for c, r in sorted(routes.items())},
        notes={c: r[1] for c, r in routes.items()}, notesEn={c: r[2] for c, r in routes.items()},
        license="CC BY-SA 4.0",
    ))
    counts = {k: sum(1 for r in routes.values() if r[0] == k) for k in (1, 2, 3, 4)}
    print(f"  {len(routes)} 國：統一考試 {counts[1]}、會考 {counts[2]}、申請審查 {counts[3]}、各校自辦 {counts[4]}")
    write_json(out / "manifest.json", {
        "topic": "university-entrance", "generatedAt": now_iso(),
        "source": "Wikipedia: List of admission tests to colleges and universities (revid 1381783633); "
                  "List of secondary school leaving qualifications (revid 1368870013)",
    })
