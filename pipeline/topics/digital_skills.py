"""上網都在做什麼、數位技能的五種能力（2026-11-07，製作手冊第二十五批 502＋503，候選 1173、1174；擴充「數位」）。

UNESCO 統計研究所（UIS）公開 API（轉載 ITU 的家戶調查，免登入免金鑰；條款「The work of the UIS is licensed under the
Creative Commons Attribution-ShareAlike 4.0 International license.」，衍生的檔標 CC BY-SA 4.0）：
- 502 活動（過去三個月有上網的人裡做過這件事的比例，分母是網路使用者不是全人口）：ICTSKILLSNTWK 社群網路、INTBNK 網路銀行、
  FGSPUR 網購、FONLCRS 線上課程、PCPR 寫程式、VOIP 網路通話、HLTHINF 找健康資訊、ONLCNS 線上參與公共事務。
- 503 SDG 4.4.1 的五個能力領域「進階以上」（ICTSKILL*ABAS：資訊與資料素養、溝通與協作、數位內容創作、安全、問題解決）。
  「基本」與「進階以上」互斥，這裡只畫進階以上。
各國調查年份不同（2015–2024），latestWithin 4。沒有台灣與印度；美國只有 2015 年。
輸出 public/data/topics/digital/activity/{item}.json、skills/{item}.json（%）。
"""

from __future__ import annotations

import json

from common import OUT_DIR, download, indicator_file, write_json
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "digital"
URL = "https://api.uis.unesco.org/api/public/data/indicators?indicator={}&start=2015&end=2025"
ACTIVITIES = {"social": "ICTSKILLSNTWK", "banking": "ICTSKILLINTBNK", "shopping": "ICTSKILLFGSPUR", "course": "ICTSKILLFONLCRS",
              "coding": "ICTSKILLPCPR", "calls": "ICTSKILLVOIP", "health": "ICTSKILLHLTHINF", "civic": "ICTSKILLONLCNS"}
SKILLS = {"information": "ICTSKILLINFOABAS", "communication": "ICTSKILLCOMMABAS", "content": "ICTSKILLCONTABAS",
          "safety": "ICTSKILLSAFEABAS", "problem": "ICTSKILLPROBABAS"}
WITHIN = 4


def _uis(code: str) -> dict[str, dict[int, float]]:
    data = json.loads(download(URL.format(code), "uis", f"{code}-2015.json").read_text(encoding="utf-8"))
    out: dict[str, dict[int, float]] = {}
    for r in data["records"]:
        iso3 = to_iso3(r["geoUnit"])
        if iso3 and r["value"] is not None:
            out.setdefault(iso3, {})[int(r["year"])] = float(r["value"])
    return out


def build() -> None:
    for folder, codes in (("activity", ACTIVITIES), ("skills", SKILLS)):
        series = {item: _uis(code) for item, code in codes.items()}
        years = list(range(min(y for s in series.values() for v in s.values() for y in v),
                           max(y for s in series.values() for v in s.values() for y in v) + 1))
        for item, data in series.items():
            write_json(OUT / folder / f"{item}.json", indicator_file(
                folder, "%", years, {k: [round(s[y], 1) if y in s else None for y in years] for k, s in data.items()},
                latestWithin=WITHIN, license="CC BY-SA 4.0"))
        print(f"  UIS {folder}：" + "、".join(f"{k} {len(v)} 國" for k, v in series.items()) + f"（{years[0]}–{years[-1]}）")
