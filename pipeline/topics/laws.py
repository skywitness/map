"""法律與制度主題：死刑（類別圖，1950–2026 年每年年底的狀態）與法定年齡（2026 年的現況）。

- 死刑：自行整理的表（`sources/death_penalty.py`，依英文維基百科，CC BY-SA 4.0），分全面廢除、只廢除普通犯罪、
  事實上廢除（法律上保留，但 10 年以上沒有執行）、保留四類；附註寫各國廢除的年份與最後一次執行。
  資料檔依 CC BY-SA 4.0 分享。
- 法定年齡：投票、飲酒、結婚、汽車駕照、刑事責任（`sources/legal_ages.py`，依英文維基百科自行整理，CC BY-SA 4.0），
  值是歲數或類別代碼（0 沒有規定、1 禁止），只有 2026 年；各地不同的國家列在指標檔的 `varies`（tooltip 標「各地不同」）。
"""
from __future__ import annotations

import json

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import death_penalty, legal_ages


def build() -> None:
    out = OUT_DIR / "topics" / "laws"
    countries = sorted(json.loads((OUT_DIR / "countries.json").read_text(encoding="utf-8")))

    status, notes = death_penalty.status(countries)
    years = list(range(death_penalty.FIRST_YEAR, death_penalty.LAST_YEAR + 1))
    write_json(out / "death-penalty.json", indicator_file(
        "death-penalty", "", years, {c: to_series(s, years, 0) for c, s in status.items()},
        notes={c: n[0] for c, n in notes.items()}, notesEn={c: n[1] for c, n in notes.items()},
    ))
    for kind in legal_ages.AGES:
        values, notes, varies = legal_ages.indicator(kind, countries)
        write_json(out / f"{kind}-age.json", indicator_file(
            f"{kind}-age", "", [legal_ages.YEAR], {c: [v] for c, v in values.items()},
            notes={c: n[0] for c, n in notes.items()}, notesEn={c: n[1] for c, n in notes.items()},
            varies=sorted(varies),
        ))
    write_json(out / "manifest.json", {
        "topic": "laws", "generatedAt": now_iso(),
        "source": "Wikipedia (CC BY-SA 4.0); 法務部",
    })
