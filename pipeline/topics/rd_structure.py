"""研發經費是誰花的、誰出的錢，研發人力（2026-11-07，製作手冊第二十五批 510，候選 1182、1183；擴充「研發與創新」）。

OECD Main Science and Technology Indicators（MSTI，SDMX 資料流 OECD.STI.STP,DSD_MSTI@DF_MSTI,1.3，OECD 資料條款）。
**MSTI 有台灣**（REF_AREA TWN，顯示名 Chinese Taipei），DESIGN.md 第 8 節第 1 點的「研發與創新沒有台灣」在這裡不成立。
- 依執行部門占 GERD（%）：B 企業、H 高等教育、GV 政府、PNP 私人非營利（UNIT PT_GERD）
- 依資金來源占 GERD（%）：G_FB 企業、G_FG 政府、G_FA 國外（PT_GERD）
- 研發人力每千名就業者：T_TT 研發人力、T_RS 研究人員（10P3EMP，全時約當）
陷阱：TRANSFORMATION 混了成長率（GY），一律只取 _Z；OECD、EU27 合計不收（放 aggregates）。
女性研究人員比例「性別平等」主題已經有，不重做。
輸出 public/data/topics/innovation/rd/{performer,funding,personnel}/{item}.json。
"""

from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import oecd
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "innovation" / "rd"
FLOW = "OECD.STI.STP,DSD_MSTI@DF_MSTI,1.3"
GROUPS = {
    "performer": (".A.B+H+GV+PNP......", "PT_GERD", {"business": "B", "higher": "H", "government": "GV", "nonprofit": "PNP"}),
    "funding": (".A.G_FB+G_FG+G_FA......", "PT_GERD", {"business": "G_FB", "government": "G_FG", "abroad": "G_FA"}),
    "personnel": (".A.T_TT+T_RS......", "10P3EMP", {"total": "T_TT", "researchers": "T_RS"}),
}
FIRST = 2000


def build() -> None:
    for folder, (key, unit, measures) in GROUPS.items():
        rows = [r for r in oecd.rows(FLOW, key) if r["UNIT_MEASURE"] == unit and r["TRANSFORMATION"] == "_Z" and r["OBS_VALUE"]]
        for item, code in measures.items():
            data: dict[str, dict[int, float]] = {}
            agg: dict[str, dict[int, float]] = {}
            for r in rows:
                year = int(r["TIME_PERIOD"])
                if r["MEASURE"] != code or year < FIRST:
                    continue
                iso3 = to_iso3(r["REF_AREA"])
                target = data.setdefault(iso3, {}) if iso3 else agg.setdefault(r["REF_AREA"], {})
                target[year] = float(r["OBS_VALUE"])
            years = list(range(FIRST, max(y for s in data.values() for y in s) + 1))
            write_json(OUT / folder / f"{item}.json", indicator_file(
                f"{folder}/{item}", "%" if unit == "PT_GERD" else "per 1000 employed", years,
                {k: [round(s[y], 2) if y in s else None for y in years] for k, s in sorted(data.items())},
                aggregates={k: [round(s[y], 2) if y in s else None for y in years] for k, s in agg.items()},
                latestWithin=3, license="OECD Terms and Conditions"))
            print(f"  {folder} {item}：{len(data)} 國（{years[0]}–{years[-1]}）")
