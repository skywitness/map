"""法律與制度主題：死刑（類別圖，1950–2026 年每年年底的狀態）。

- 死刑：自行整理的表（`sources/death_penalty.py`，依英文維基百科，CC BY-SA 4.0），分全面廢除、只廢除普通犯罪、
  事實上廢除（法律上保留，但 10 年以上沒有執行）、保留四類；附註寫各國廢除的年份與最後一次執行。
  資料檔依 CC BY-SA 4.0 分享。
"""
from __future__ import annotations

import json

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import death_penalty


def build() -> None:
    out = OUT_DIR / "topics" / "laws"
    countries = sorted(json.loads((OUT_DIR / "countries.json").read_text(encoding="utf-8")))

    status, notes = death_penalty.status(countries)
    years = list(range(death_penalty.FIRST_YEAR, death_penalty.LAST_YEAR + 1))
    write_json(out / "death-penalty.json", indicator_file(
        "death-penalty", "", years, {c: to_series(s, years, 0) for c, s in status.items()},
        notes={c: n[0] for c, n in notes.items()}, notesEn={c: n[1] for c, n in notes.items()},
    ))
    write_json(out / "manifest.json", {
        "topic": "laws", "generatedAt": now_iso(),
        "source": "Wikipedia (CC BY-SA 4.0); 法務部",
    })
