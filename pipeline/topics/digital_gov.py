"""數位政府與開放資料指數（2026-11-07，製作手冊第二十五批 508，候選 1180；擴充「數位」）。

候選 289「數位政府指數」的替代來源：聯合國 EGDI 的條款禁止轉載與改作，改用 OECD 自己的兩個指數
（Government at a Glance 2025，SDMX 資料流 OECD.GOV.GIP,DSD_GOV@DF_GOV_DGOGD_2025,1.0，OECD 資料條款）：
- 數位政府指數 DGI（DG）與六個子面向：Digital by design、Data-driven public sector、Government as a platform、
  Open by default、User-driven、Proactiveness
- 開放資料指數 OURdata（OUR）與三個子面向：Data availability、Data accessibility、Government support for data re-use
0–1 分，2022 與 2025 兩期（題目有調整，OECD 提醒不要直接比名次，methodBreak 2025）。約 45 個經濟體，沒有台灣、美國、德國（DGI）。
輸出 public/data/topics/digital/gov/{dgi,ourdata}/{item}.json。
"""

from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import oecd
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "digital" / "gov"
FLOW = "OECD.GOV.GIP,DSD_GOV@DF_GOV_DGOGD_2025,1.0"
DGI = {"total": "DG", "design": "DG_D", "data": "DG_DD", "platform": "DG_PL", "open": "DG_OD", "user": "DG_UD", "proactive": "DG_PR"}
OUR = {"total": "OUR", "availability": "OUR_DAV", "accessibility": "OUR_DAC", "reuse": "OUR_GSR"}
YEARS = [2022, 2023, 2024, 2025]


def build() -> None:
    rows = oecd.rows(FLOW)
    for folder, measures in (("dgi", DGI), ("ourdata", OUR)):
        for item, code in measures.items():
            data: dict[str, dict[int, float]] = {}
            for r in rows:
                if r["MEASURE"] == code and r["OBS_VALUE"] and (iso3 := to_iso3(r["REF_AREA"])):
                    data.setdefault(iso3, {})[int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
            write_json(OUT / folder / f"{item}.json", indicator_file(
                f"{folder}/{item}", "index", YEARS,
                {k: [round(s[y], 3) if y in s else None for y in YEARS] for k, s in sorted(data.items())},
                methodBreak=2025, latestWithin=2, license="OECD Terms and Conditions"))
            print(f"  {folder} {item}：{len(data)} 國")
