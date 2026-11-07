"""國家資安指數的五個支柱（2026-11-07，製作手冊第二十五批 509，候選 1181；擴充「數位」）。

ITU GCI 2024 國別頁的五個支柱分數（pipeline/data/digital/gci-2024-pillars.json，OCR 加人工判讀，見檔頭 about），
CC BY-NC-SA 3.0 IGO（非商業、同授權，跟數位主題既有的五級一樣）。輸出 public/data/topics/digital/gci/{total,<支柱>}.json，只有 2024 年。
"""

from __future__ import annotations

import json
from pathlib import Path

from common import OUT_DIR, indicator_file, write_json

DATA = Path(__file__).resolve().parent.parent / "data" / "digital" / "gci-2024-pillars.json"
OUT = OUT_DIR / "topics" / "digital" / "gci"
YEAR = 2024
EXTRA = {"license": "CC BY-NC-SA 3.0 IGO",
         "attribution": "International Telecommunication Union (ITU), Global Cybersecurity Index 2024"}


def build() -> None:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    for i, pillar in enumerate(data["pillars"]):
        write_json(OUT / f"{pillar}.json", indicator_file(
            f"gci/{pillar}", "score", [YEAR], {k: [v[i]] for k, v in data["countries"].items()}, **EXTRA))
    write_json(OUT / "total.json", indicator_file(
        "gci/total", "score", [YEAR], {k: [round(sum(v), 2)] for k, v in data["countries"].items()}, **EXTRA))
    print(f"  GCI 五個支柱：{len(data['countries'])} 國")
