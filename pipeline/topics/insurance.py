"""保險的規模與普及程度（新主題，2026-11-07，製作手冊第二十五批 462，合併候選 1104、1125；步驟 insurance，
輸出 topics/insurance/）。

- OECD Global Insurance Statistics（`OECD.DAF.CM,DSD_INS@DF_IND,1.0`，sources/oecd.py，CC BY 4.0）：這個資料流有
  15 個維度，key 要補滿 15 段（少了會回 403「Not enough key values」）。1983–2024 年、69 個經濟體，**含台灣**
  （Chinese Taipei）。各國最新一年不同（2024 年 52 國、2023 年 57 國），前端用 1 年內最近一年（latestWithin）。
  - penetration/<total|life|nonlife>.json：保險滲透度（MEASURE=PEN，毛保費占 GDP，%）。
  - density/<total|life|nonlife>.json：保險密度（DST，每人毛保費，美元，市場匯率）。
  - life-share.json：壽險占毛保費的比例（LIS）。芬蘭 2022 年等少數幾筆是 100%（非壽險缺報），≥ 99.95 的不用。
  - aggregates 的 OECD 是 OECD 的合計（側欄的對照線）。
- 台灣：OECD 的台灣數字就是保險事業發展中心報的。保發中心「保險密度、滲透度及人壽保險投保率表」（data.gov.tw 13514，
  提供機關金管會保險局，政府資料開放授權條款第 1 版；`openapi.tii.org.tw` 的 CSV，TableID=I03）另外存 taiwan.json：
  新台幣的保險密度、滲透度（GDP 版本不同，2024 年 10.54%，OECD 是 10.79%）與人壽保險及年金保險投保率（有效契約件數
  ÷ 人口）、普及率，2002 年起，比 OECD 多一年（2025）。
"""
from __future__ import annotations

import csv
import io
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, now_iso, to_series, write_json
from sources import oecd
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "insurance"
FLOW = "OECD.DAF.CM,DSD_INS@DF_IND,1.0"
KEY = ".A.PEN+DST+LIS" + "." * 12
TII = "https://openapi.tii.org.tw/TIIOPENDATA/API/CSV_EXPORT?TableID=I03"
TYPES = {"_T": "total", "LIFE": "life", "NLIFE": "nonlife"}
WITHIN = 1
FIRST = 1983


def _oecd() -> dict[tuple[str, str], tuple[dict[str, dict[int, float]], dict[int, float]]]:
    """{(measure, 險種): ({iso3: {年: 值}}, OECD 合計 {年: 值})}"""
    out: dict[tuple[str, str], tuple[dict, dict]] = defaultdict(lambda: (defaultdict(dict), {}))
    for r in oecd.rows(FLOW, KEY):
        if not r["OBS_VALUE"] or r["PREMIUMS"] != "GRS":
            continue
        k = (r["MEASURE"], r["INSURANCE_TYPE"])
        year, value = int(r["TIME_PERIOD"]), float(r["OBS_VALUE"])
        if r["REF_AREA"] == "OECD":
            out[k][1][year] = value
        elif iso3 := to_iso3(r["REF_AREA"]):
            out[k][0][iso3][year] = value
    return out


def _write(path, indicator: str, unit: str, series: dict[str, dict[int, float]], oecd_total: dict[int, float], digits: int,
           last: int) -> None:
    years = list(range(FIRST, last + 1))
    values = {c: to_series(s, years, digits) for c, s in sorted(series.items()) if s}
    extra = {"aggregates": {"OECD": to_series(oecd_total, years, digits)}} if oecd_total else {}
    write_json(path, indicator_file(indicator, unit, years, values, latestWithin=WITHIN, license="CC BY 4.0",
                                    **extra), quiet=True)


def _latest(series: dict[str, dict[int, float]], last: int) -> list[tuple[float, str, int]]:
    out = []
    for c, s in series.items():
        ys = [y for y in s if last - WITHIN <= y <= last]
        if ys:
            y = max(ys)
            out.append((round(s[y], 2), c, y))
    return sorted(out, reverse=True)


def _taiwan() -> dict:
    path = download(TII, "tii", "I03.csv")
    text = path.read_text(encoding="utf-8-sig")
    cols = {"density": "保險密度總計_元", "densityLife": "保險密度人身保險_元", "densityNonlife": "保險密度財產保險_元",
            "penetration": "保險滲透度總計%", "ownership": "人壽保險及年金保險投保率%", "coverage": "人壽保險及年金保險普及率%"}
    rows = [r for r in csv.DictReader(io.StringIO(text)) if (r.get("年") or "").strip().isdigit()]
    if not rows or any(c not in rows[0] for c in cols.values()):
        raise RuntimeError(f"保發中心 I03 的欄位變了：{list(rows[0]) if rows else '沒有資料列'}")
    years = [int(r["年"]) for r in rows]
    out = {"years": years}
    for key, col in cols.items():
        out[key] = [float(r[col]) if (r.get(col) or "").strip() else None for r in rows]
    return out


def build() -> None:
    data = _oecd()
    last = max(y for (m, _), (s, _) in data.items() for c in s.values() for y in c)
    for measure, name, unit, digits in (("PEN", "penetration", "%", 2), ("DST", "density", "美元/人", 0)):
        for code, key in TYPES.items():
            series, total = data[(measure, code)]
            _write(OUT / name / f"{key}.json", name, unit, series, total, digits, last)
        top = _latest(data[(measure, "_T")][0], last)
        print(f"  {name} {len(top)} 國：最高 {top[:10]}；最低 {top[-6:]}")
    life, total = data[("LIS", "LIFE")]
    life = {c: {y: v for y, v in s.items() if v < 99.95} for c, s in life.items()}
    _write(OUT / "life-share.json", "life-share", "%", life, total, 1, last)
    top = _latest(life, last)
    print(f"  壽險占比 {len(top)} 國：最高 {top[:8]}；最低 {top[-6:]}")
    tw = _taiwan()
    write_json(OUT / "taiwan.json", {**tw, "source": "財團法人保險事業發展中心（data.gov.tw 13514）",
                                     "license": "政府資料開放授權條款第 1 版"})
    print(f"  台灣（保發中心）{tw['years'][0]}–{tw['years'][-1]}：投保率 {tw['ownership'][-3:]}，滲透度 {tw['penetration'][-3:]}")
    write_json(OUT / "manifest.json", {"topic": "insurance", "generatedAt": now_iso(),
                                       "sources": ["OECD Global Insurance Statistics (DSD_INS@DF_IND)",
                                                   "財團法人保險事業發展中心 保險密度、滲透度及人壽保險投保率表"]})
