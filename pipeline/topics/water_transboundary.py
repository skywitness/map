"""跨境水資源與水庫容量（2026-11-07，製作手冊第二十五批 494，候選 1159、1160；擴充「各國水資源與森林」）。

- FAO AQUASTAT 批次檔（`sources/aquastat.py`，CC BY 4.0）：
  - Dependency ratio（%）：可再生水資源有多少比例來自國外。台灣是島、沒有跨境河川，依定義是 0（不是 AQUASTAT 的值），
    用 hints 寫明。
  - 流入水量有條約保障的比例＝Surface water: inflow secured through treaties ÷ Surface water: entering the country (total)，
    只算有流入的國家。0 不一定是沒有條約（各國申報，巴西、印度可能是沒申報），說明寫明。
  - Total dam capacity（km³）與每人水庫容量（÷ WPP 2024 年中人口；不用 AQUASTAT 自己的人均）。
- 台灣：經濟部水利署「水庫淤積量」（data.gov.tw 32727，政府資料開放授權條款第 1 版，民國 114 年 96 座）：
  總容量用「最新施測總容量」（萬立方公尺）加總，赤崁地下水庫不算；寫在 2025 年。
輸出 public/data/topics/water-forest/：dependency.json、treaty-inflow.json、dam-capacity.json（立方公尺）、dam-capacity-pc.json。
"""

from __future__ import annotations

import csv

from common import OUT_DIR, download, indicator_file, write_json
from sources import aquastat, wpp

OUT = OUT_DIR / "topics" / "water-forest"
DEP = "Dependency ratio"
ENTER = "Surface water: entering the country (total)"
SECURED = "Surface water: inflow secured through treaties"
DAM = "Total dam capacity"
SEDIMENT_URL = "https://opendata.wra.gov.tw/api/v2/572bda99-0593-4aee-9409-03c82423f8eb?format=CSV"
FIRST = 1961


def _num(v: str) -> float | None:
    try:
        return float(v)
    except ValueError:
        return None


def build() -> None:
    aq = aquastat.series({DEP, ENTER, SECURED, DAM})
    last = max(y for s in aq[DEP][0].values() for y in s)
    years = list(range(FIRST, last + 1))
    lic = "CC BY 4.0"

    dep = aq[DEP][0]
    values = {k: [round(s[y], 1) if y in s else None for y in years] for k, s in dep.items()}
    values["TWN"] = [0.0 if y >= 1990 else None for y in years]
    write_json(OUT / "dependency.json", indicator_file(
        "dependency", "%", years, values, license=lic,
        hints={"TWN": "台灣是島、沒有跨境河川，依定義是 0（不是 AQUASTAT 的值）"},
        hintsEn={"TWN": "Taiwan is an island with no transboundary rivers, so the ratio is 0 by definition (not an AQUASTAT figure)"}))

    enter, secured = aq[ENTER][0], aq[SECURED][0]
    treaty = {}
    for k, s in enter.items():
        row = [round(secured[k][y] / s[y] * 100, 1) if y in s and s[y] > 0 and y in secured.get(k, {}) else None for y in years]
        if any(x is not None for x in row):
            treaty[k] = row
    write_json(OUT / "treaty-inflow.json", indicator_file("treaty-inflow", "%", years, treaty, license=lic))

    dam = aq[DAM][0]
    path = download(SEDIMENT_URL, "wra", "sedimentation.csv")
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    tw_total = sum(v for r in rows if "地下" not in r["水庫名稱"] and (v := _num(r["最新施測總容量"])) is not None)  # 萬 m³
    design = [(d, m) for r in rows if (d := _num(r["設計有效容量"])) is not None and (m := _num(r["最新施測有效容量"])) is not None]
    tw_year = 1911 + int(rows[0]["民國年"])
    cap = {k: [round(s[y] * 1e9) if y in s else None for y in years] for k, s in dam.items()}
    pop = wpp.demographic(["TPopulation1July"], max(tw_year, last))["TPopulation1July"]  # 千人
    years_tw = sorted(set(years) | {tw_year})
    cap = {k: v + [None] * (len(years_tw) - len(years)) for k, v in cap.items()}
    cap["TWN"] = [round(tw_total * 1e4) if y == tw_year else None for y in years_tw]
    # 台灣的值在 2025 年，其他國家到 2023 年：latestWithin 2 讓 2025 年也畫得出其他國家最近一年的值
    write_json(OUT / "dam-capacity.json", indicator_file("dam-capacity", "立方公尺", years_tw, cap, license=lic, latestWithin=2))
    pc = {}
    for k, row in cap.items():
        if k not in pop:
            continue
        out = [round(v / (pop[k][y] * 1000), 1) if v is not None and pop[k].get(y) else None for v, y in zip(row, years_tw)]
        if any(x is not None for x in out):
            pc[k] = out
    write_json(OUT / "dam-capacity-pc.json", indicator_file("dam-capacity-pc", "立方公尺/人", years_tw, pc, license=lic, latestWithin=2))
    print(f"  AQUASTAT 依賴度 {len(dep)} 國、條約保障 {len(treaty)} 國、水庫容量 {len(dam)} 國（到 {last}）；"
          f"台灣 {tw_year} 年 {tw_total * 1e4 / 1e9:.3f} km³、設計有效 {sum(d for d, _ in design) / 1e5:.3f} → 最新 {sum(m for _, m in design) / 1e5:.3f} km³（{len(design)} 座）")
