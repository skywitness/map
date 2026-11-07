"""再生能源的政策工具：躉購費率與競標（2026-11-07，製作手冊第二十五批 527，候選 1203、1204；新主題「電力市場管制與再生能源補貼」）。

- 候選 1203（OECD 產品市場管制 PMR 的電力、天然氣分項）在「市場管制」主題（pipeline/topics/market_regulation.py）已經有了，
  前端直接讀那邊的 sector/{electricity,gas}.json，這裡不再下載。
- 候選 1204：OECD 環境政策嚴格度指數（EPS，`OECD.ECO.MAD,DSD_EPS@DF_EPS`，sdmx.oecd.org，條款同 DESIGN.md 第 8 節第 129 點）
  的 FIT_SOLAR、FIT_WIND（太陽能、風力的躉購費率與競標支持，0–6 分），1990–2020，40 國。
- 台灣：EPS 沒有。經濟部能源署「再生能源電能躉購費率及其計算公式」（data.gov.tw 6031，set_id=6，政府資料開放授權條款第 1 版），
  民國 99–112 年（2010–2023）。分類名稱年年換（屋頂型、第一期、免競標、有無併聯特高壓、上限費率…），依規則挑四條線給側欄：
  屋頂型太陽光電最小級距（第一期；沒有分期的年用不分期的）、地面型太陽光電（第一期、無併聯特高壓）、陸域風力（10／20／30 瓩以上，
  有 LVRT 的）、離岸風力（固定 20 年的費率）。
輸出 public/data/topics/energy-market/{res-support/{solar,wind},tw-fit}.json。
"""

from __future__ import annotations

import csv
import re
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from sources import oecd
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "energy-market"
TW_URL = "https://www.moeaea.gov.tw/ECW/populace/opendata/wHandOpenData_File.ashx?set_id=6"
POLICIES = {"solar": "FIT_SOLAR", "wind": "FIT_WIND"}


def _eps() -> None:
    data: dict[str, dict[str, dict[int, float]]] = defaultdict(lambda: defaultdict(dict))
    for r in oecd.rows("OECD.ECO.MAD,DSD_EPS@DF_EPS,", "all"):
        item = next((k for k, v in POLICIES.items() if v == r["CLIM_POL"]), None)
        iso3 = to_iso3(r["REF_AREA"])
        if item and iso3 and r["OBS_VALUE"] not in ("", None):
            data[item][iso3][int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    for item, by in data.items():
        years = list(range(min(y for s in by.values() for y in s), max(y for s in by.values() for y in s) + 1))
        write_json(OUT / "res-support" / f"{item}.json", indicator_file(
            f"res-support/{item}", "score", years, {k: [s.get(y) for y in years] for k, s in sorted(by.items())},
            license="CC BY 4.0", attribution="OECD, Environmental Policy Stringency Index"))
        last = years[-1]
        print(f"  EPS {item} {years[0]}–{last}：{len(by)} 國；{last} 年 6 分 {sorted(k for k, s in by.items() if s.get(last) == 6)}，"
              f"0 分 {sorted(k for k, s in by.items() if s.get(last) == 0)}")


def _pick(cat: str, sub: str, tier: str, series: str) -> bool:
    """這一列是不是這條線要的（規則見檔頭）"""
    if series == "rooftop":
        return cat == "太陽光電" and (sub in ("無區分", "屋頂型") or ("屋頂型" in sub and "第一期" in sub and "有併聯" not in sub)) \
            and tier.startswith("1瓩以上") and ("不及" in tier or "至" in tier)
    if series == "ground":
        # 2016 年地面型只有「地面型(競標)」的上限費率，一起收（2015 年它跟免競標第一期同一個值）
        return cat == "太陽光電" and "地面型" in sub and ("第一期" in sub or sub in ("地面型", "地面型(競標)")) \
            and "有併聯" not in sub and "有併聯" not in tier
    if series == "onshore":
        return cat == "風力發電" and sub.startswith("陸域") and "未加裝" not in sub and "無安裝" not in sub \
            and re.match(r"^(10|20|30)瓩以上$", tier) is not None
    if series == "offshore":
        return cat == "風力發電" and (sub == "離岸" or ("離岸" in sub and "固定20年" in sub))
    return False


def _taiwan() -> None:
    path = download(TW_URL, "moeaea", "fit-rates-set6.csv")
    out: dict[str, dict[int, float]] = defaultdict(dict)
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            y = int(r["民國年"]) + 1911
            for s in ("rooftop", "ground", "onshore", "offshore"):
                if _pick(r["再生能源類別"], r["分類"], r["裝置容量級距"], s):
                    v = float(r["躉購費率（元/度）(數值)"])
                    if y in out[s] and out[s][y] != v:
                        raise RuntimeError(f"台灣躉購費率 {s} {y} 年挑到兩個不同的值：{out[s][y]}、{v}（{r['分類']} {r['裝置容量級距']}）")
                    out[s][y] = v
    years = list(range(min(min(v) for v in out.values()), max(max(v) for v in out.values()) + 1))
    write_json(OUT / "tw-fit.json", {"years": years, "series": {s: [out[s].get(y) for y in years] for s in ("rooftop", "ground", "onshore", "offshore")},
                                     "license": "政府資料開放授權條款第 1 版", "attribution": "經濟部能源署"})
    for s, v in out.items():
        print(f"  台灣 {s}：{[(y, v.get(y)) for y in years]}")


def build() -> None:
    _eps()
    _taiwan()
