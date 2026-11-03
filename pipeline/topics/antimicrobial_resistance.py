"""抗藥性：細菌對抗生素的抗藥比例（2026-11-03，製作手冊第十九批 293；醫藥分類的藥物組）。

**資料**：WHO Global Health Observatory 的後端（xmart，`sources/who_xmart.py`）：
- `AMR_INFECT_ECOLI`：血流感染的大腸桿菌對第三代頭孢菌素有抗藥性的比例（%），GLASS 通報，2016–2023 年。
- `AMR_INFECT_MRSA`：血流感染的金黃色葡萄球菌裡抗甲氧西林（MRSA）的比例（%）。
- `TB_e_inc_rr_num`：抗藥性結核（rifampicin 抗藥或多重抗藥，RR/MDR-TB）的估計新病例數；每 10 萬人自己用聯合國
  《世界人口展望 2024》的年中人口算（WHO 結核 CSV 裡的比例欄適用 WHO 網站的條款，不用）。
**授權**：GHO 的資料 CC BY 4.0。
**台灣**：WHO 沒有台灣。疾管署「抗藥性監測通報之抗生素敏感性統計資料分析」（data.gov.tw 43600）的下載點
od.cdc.gov.tw 從 cloud 連不上，已請本機 session 下載到 map-plan 的 data/cdc/；這次先不放。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, latest_year_span, now_iso, to_series, write_json
from sources import who_xmart, wpp

OUT = OUT_DIR / "topics" / "antimicrobial-resistance"
WITHIN = 2  # GLASS 每年通報的國家不一樣，用 2 年內最近的一年


def _series(code: str) -> dict[str, dict[int, float]]:
    out: dict[str, dict[int, float]] = {}
    for r in who_xmart.facts(code):
        if r["LOCATION_TYPE"] != "COUNTRY" or r["VALUE_NUMERIC"] is None:
            continue
        out.setdefault(r["LOCATION_CODE"], {})[int(r["PERIOD_CODE"])] = float(r["VALUE_NUMERIC"])
    return out


def _write(name: str, unit: str, data: dict[str, dict[int, float]], digits: int, within: int | None) -> list[int]:
    years = latest_year_span(data, within) if within else sorted({y for s in data.values() for y in s})
    extra = {"latestWithin": within} if within else {}
    write_json(OUT / f"{name}.json", indicator_file(
        name, unit, years, {c: to_series(s, years, digits) for c, s in sorted(data.items())}, **extra))
    return years


def build() -> None:
    for name, code in (("ecoli", "AMR_INFECT_ECOLI"), ("mrsa", "AMR_INFECT_MRSA")):
        data = _series(code)
        years = _write(name, "%", data, 1, WITHIN)
        latest = {c: s[max(s)] for c, s in data.items()}
        top = sorted(latest.items(), key=lambda kv: -kv[1])
        print(f"  {name}：{len(data)} 國，{years[0]}–{years[-1]}；最高 {top[:4]}，最低 {top[-3:]}")
    tb = _series("TB_e_inc_rr_num")
    pop = wpp.demographic(["TPopulation1July"], last_year=max(max(s) for s in tb.values()))["TPopulation1July"]
    rate = {c: {y: v / pop[c][y] * 100 for y, v in s.items() if pop.get(c, {}).get(y)} for c, s in tb.items()}
    rate = {c: s for c, s in rate.items() if s}
    _write("mdr-tb", "每 10 萬人", rate, 2, None)
    _write("mdr-tb-cases", "人", tb, 0, None)
    write_json(OUT / "manifest.json", {
        "topic": "antimicrobial-resistance", "generatedAt": now_iso(),
        "source": "WHO Global Health Observatory (AMR_INFECT_ECOLI, AMR_INFECT_MRSA, TB_e_inc_rr_num); UN WPP 2024",
        "license": "CC BY 4.0",
    })
    last = max(max(s) for s in tb.values())
    top = sorted(((s.get(last, 0), c) for c, s in rate.items()), reverse=True)[:5]
    print(f"  抗藥性結核：{len(tb)} 國，{last} 年每 10 萬人最高 {[(c, round(v, 1)) for v, c in top]}；"
          f"全世界 {sum(s.get(last, 0) for s in tb.values()):,.0f} 例")


if __name__ == "__main__":
    build()
