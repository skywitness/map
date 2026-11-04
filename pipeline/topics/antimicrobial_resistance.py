"""抗藥性：細菌對抗生素的抗藥比例（2026-11-03，製作手冊第十九批 293；醫藥分類的藥物組）。

**資料**：WHO Global Health Observatory 的後端（xmart，`sources/who_xmart.py`）：
- `AMR_INFECT_ECOLI`：血流感染的大腸桿菌對第三代頭孢菌素有抗藥性的比例（%），GLASS 通報，2016–2023 年。
- `AMR_INFECT_MRSA`：血流感染的金黃色葡萄球菌裡抗甲氧西林（MRSA）的比例（%）。
- 抗藥性結核（rifampicin 抗藥或多重抗藥，RR/MDR-TB）的估計新病例數：2026-11-04 起改讀 data.who.int 的版本
  （指標頁 https://data.who.int/indicators/i/A38EC3D/A18C32A ，`TB_e_rr_num`，頁面的圖表讀後端 RELAY_TB，
  `sources/who_datadot.relay()`；數字跟原本 GHO 的 `TB_e_inc_rr_num` 一樣）。使用者 2026-11-04 決定只在 GHO 的指標不用。
  每 10 萬人自己用聯合國《世界人口展望 2024》的年中人口算（WHO 結核 CSV 裡的比例欄適用 WHO 網站的條款，不用）。
**授權**：大腸桿菌與 MRSA 在 data.who.int 有指標頁（CC BY 4.0，加附加條款）；抗藥性結核同上。
**台灣**：WHO 沒有台灣。用疾管署「抗藥性監測通報之抗生素敏感性統計資料分析」（data.gov.tw 43600，`sources/cdc_antibiogram.py`，
本機 session 2026-11-03 下載到 map-plan 的 data/cdc/）的全國統計：大腸桿菌對 ceftriaxone（第三代頭孢菌素裡檢測最多的兩種之一，
cefotaxime 的比例幾乎一樣）、金黃色葡萄球菌對 oxacillin（MRSA）的非敏感比例。定義跟 WHO 不同（所有檢體、不只血流感染；
非敏感含中間型），附註寫明；地圖年份以後的年份（2024、2025）寫在附註。
"""
from __future__ import annotations

from common import OUT_DIR, append_note, indicator_file, later_years_note, latest_year_span, now_iso, to_series, write_json
from sources import cdc_antibiogram, who_datadot, who_xmart, wpp

OUT = OUT_DIR / "topics" / "antimicrobial-resistance"
WITHIN = 2  # GLASS 每年通報的國家不一樣，用 2 年內最近的一年
# 台灣（疾管署）：指標 → (菌種, 抗生素, 中文說明, 英文說明)
TAIWAN = {
    "ecoli": ("Escherichia coli", "Ceftriaxone", "大腸桿菌對 ceftriaxone（第三代頭孢菌素）", "E. coli isolates non-susceptible to ceftriaxone (a third-generation cephalosporin)"),
    "mrsa": ("Staphylococcus aureus", "Oxacillin", "金黃色葡萄球菌對 oxacillin（即 MRSA）", "S. aureus isolates non-susceptible to oxacillin (i.e. MRSA)"),
}


def _series(code: str) -> dict[str, dict[int, float]]:
    out: dict[str, dict[int, float]] = {}
    for r in who_xmart.facts(code):
        if r["LOCATION_TYPE"] != "COUNTRY" or r["VALUE_NUMERIC"] is None:
            continue
        out.setdefault(r["LOCATION_CODE"], {})[int(r["PERIOD_CODE"])] = float(r["VALUE_NUMERIC"])
    return out


def _write(name: str, unit: str, data: dict[str, dict[int, float]], digits: int, within: int | None, **extra) -> list[int]:
    years = latest_year_span(data, within) if within else sorted({y for s in data.values() for y in s})
    if within:
        extra["latestWithin"] = within
    write_json(OUT / f"{name}.json", indicator_file(
        name, unit, years, {c: to_series(s, years, digits) for c, s in sorted(data.items())}, **extra))
    return years


def _taiwan(name: str, who_years: list[int]) -> tuple[dict[int, float], tuple[str, str]]:
    """台灣（疾管署的全國統計）：地圖年份內的值與附註"""
    species, antibiotic, zh, en = TAIWAN[name]
    data = cdc_antibiogram.national(species, antibiotic)
    hospitals = cdc_antibiogram.hospitals()
    shown = max(y for y in data if y <= who_years[-1])
    pct, ns, tested = data[shown]
    note = (
        f"WHO 沒有台灣；這是疾管署抗藥性監測通報的全國統計（{shown} 年 {hospitals[shown]} 家醫院通報）：{zh}不敏感的比例，"
        f"{shown} 年 {tested:,} 株裡 {ns:,} 株。所有檢體都算、不只血流感染，「不敏感」也含中間型，定義跟 WHO 不同，只能大略比較；"
        "疾管署 2026 年 5 月改了資料來源，數字從 2021 年開始",
        f"Taiwan is not in WHO’s data; this is the national figure from Taiwan CDC’s antimicrobial resistance surveillance "
        f"({hospitals[shown]} reporting hospitals in {shown}): the share of {en}, "
        f"{ns:,} of {tested:,} in {shown}. It covers all specimen types, not just bloodstream infections, and non-susceptible "
        "includes intermediate, so it is only roughly comparable with WHO’s definition; Taiwan CDC changed its data source in May 2026, "
        "and the figures start in 2021",
    )
    return {y: v[0] for y, v in data.items()}, note


def build() -> None:
    for name, code in (("ecoli", "AMR_INFECT_ECOLI"), ("mrsa", "AMR_INFECT_MRSA")):
        data = _series(code)
        latest = {c: s[max(s)] for c, s in data.items()}
        years = latest_year_span(data, WITHIN)
        tw, note = _taiwan(name, years)
        notes, notes_en = {"TWN": note[0] + "。"}, {"TWN": note[1] + "."}
        append_note(notes, notes_en, "TWN", later_years_note(tw, years, lambda v: f"{v:.1f}%"))
        data["TWN"] = {y: v for y, v in tw.items() if y <= years[-1]}
        assert _write(name, "%", data, 1, WITHIN, notes=notes, notesEn=notes_en) == years
        top = sorted(latest.items(), key=lambda kv: -kv[1])
        print(f"  {name}：{len(data)} 國，{years[0]}–{years[-1]}；最高 {top[:4]}，最低 {top[-3:]}")
        print(f"  台灣 {name}：{ {y: round(v, 1) for y, v in tw.items()} }")
    tb: dict[str, dict[int, float]] = {}
    for r in who_datadot.relay("RELAY_TB", "TB_e_rr_num"):
        tb.setdefault(r["iso3"], {})[int(r["DIM_TIME"])] = float(r["VALUE_NUMERIC"])
    pop = wpp.demographic(["TPopulation1July"], last_year=max(max(s) for s in tb.values()))["TPopulation1July"]
    rate = {c: {y: v / pop[c][y] * 100 for y, v in s.items() if pop.get(c, {}).get(y)} for c, s in tb.items()}
    rate = {c: s for c, s in rate.items() if s}
    _write("mdr-tb", "每 10 萬人", rate, 2, None)
    _write("mdr-tb-cases", "人", tb, 0, None)
    write_json(OUT / "manifest.json", {
        "topic": "antimicrobial-resistance", "generatedAt": now_iso(),
        "source": "WHO data.who.int (AMR_INFECT_ECOLI, AMR_INFECT_MRSA, TB_e_rr_num); UN WPP 2024; "
                  "Taiwan CDC antimicrobial susceptibility statistics (data.gov.tw 43600)",
        "license": "CC BY 4.0; Open Government Data License, Taiwan 1.0",
    })
    last = max(max(s) for s in tb.values())
    top = sorted(((s.get(last, 0), c) for c, s in rate.items()), reverse=True)[:5]
    print(f"  抗藥性結核：{len(tb)} 國，{last} 年每 10 萬人最高 {[(c, round(v, 1)) for v, c in top]}；"
          f"全世界 {sum(s.get(last, 0) for s in tb.values()):,.0f} 例")


if __name__ == "__main__":
    build()
