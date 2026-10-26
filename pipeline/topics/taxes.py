"""稅率主題：營利事業所得稅（公司稅）、個人所得稅最高稅率與起徵點、加值型營業稅標準稅率、勞動稅負。

- 公司稅：OECD Corporate Tax Statistics（146 個轄區，2000–2026 年，中央加地方的法定稅率）。
- 個人所得稅最高稅率、起徵點（平均薪資的幾倍）、勞動稅負：OECD Tax Database 與 Taxing Wages，只有 OECD 38 個會員國。
- 加值型營業稅：OECD《Consumption Tax Trends 2024》的表（OECD 會員國，美國沒有全國性的 VAT），
  2025、2026 年依 OECD《Tax Policy Reforms》寫的調整（`sources/oecd_tax.py`）。
- 都是 CC BY 4.0。OECD 以外的國家沒有開放授權、又有逐國出處的跨國資料：PwC、KPMG、EY 的稅務摘要是商業內容，
  Tax Foundation 是 CC BY-NC 4.0（非商業），英文維基百科的表多半引用 PwC、也有過時的數字，都沒有用，這些國家留灰色
  （DESIGN.md 第 8 節第 72 點）。
- 台灣不在 OECD 的資料裡：稅率依所得稅法、加值型及非加值型營業稅法，級距與扣除額依財政部的公告與統計專冊
  （`sources/tw_tax_law.py`）；起徵點用主計總處的平均薪資換算成倍數。勞動稅負沒有同口徑的數字，留灰色。
- 實際收到多少稅（稅收占 GDP）在「物價與財政」主題（`topics/fiscal.py`），這裡只放法定稅率。
"""
from __future__ import annotations

from statistics import mean, median

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import dgbas_wages, oecd_tax
from sources import tw_tax_law as tw

Series = dict[str, dict[int, float]]

LAST_YEAR = 2026  # 公司稅、營業稅有 2026 年；個人所得稅與勞動稅負到 2025 年
MIN_MEMBERS = 0.95  # OECD 平均：當年至少 95% 的會員國有值才算（公司稅 2026 年只有 35 國，不算）


def oecd_average(series: Series, years: list[int], how=mean) -> list[float | None]:
    """OECD 會員國的簡單平均（OECD 公布的平均也是簡單平均；起徵點的倍數用中位數）。這一年還沒開始有資料的會員國
    （例如哥斯大黎加 2019 年才有 VAT）不算在分母；其他會員國缺值超過 5% 時不算。"""
    started = {c: min(series[c]) for c in oecd_tax.OECD_MEMBERS if series.get(c)}
    out: list[float | None] = []
    for y in years:
        expected = [c for c, first in started.items() if first <= y]
        have = [series[c][y] for c in expected if y in series[c]]
        out.append(round(how(have), 2) if expected and len(have) >= len(expected) * MIN_MEMBERS else None)
    return out


def write(out, name: str, unit: str, years: list[int], series: Series, digits: int, notes: dict, notes_en: dict,
          aggregate: list[float | None] | None = None, key: str = "OECD") -> None:
    values = {c: to_series(s, years, digits) for c, s in series.items() if not c.startswith(("OECD", "EU"))}
    values = {c: v for c, v in values.items() if any(x is not None for x in v)}
    if aggregate is None:
        aggregate = oecd_average(series, years)
    extra = {"aggregates": {key: aggregate}} if any(v is not None for v in aggregate) else {}
    write_json(
        out / f"{name}.json",
        indicator_file(name, unit, years, values, **extra,
                       notes={c: n for c, n in notes.items() if c in values},
                       notesEn={c: n for c, n in notes_en.items() if c in values}),
        quiet=True,
    )
    last = max(y for y in years if any(series[c].get(y) is not None for c in values))
    latest = sorted(((s[last], c) for c, s in series.items() if last in s and c in values), reverse=True)
    avg = dict(zip(years, aggregate)).get(last)
    print(
        f"  {name}：{years[0]}–{years[-1]}，{len(values)} 個（{last} 年 {len(latest)} 個）；最高 "
        f"{', '.join(f'{c} {v:g}' for v, c in latest[:3])}；最低 {', '.join(f'{c} {v:g}' for v, c in latest[-3:])}；"
        f"台灣 {series.get('TWN', {}).get(last, float('nan')):g}；OECD 平均 {avg}"
    )


def build() -> None:
    out = OUT_DIR / "topics" / "taxes"
    tw.check()

    # ── 公司稅 ──────────────────────────────────────────────
    cit = oecd_tax.corporate_rates()
    central = oecd_tax.corporate_central_rates()
    if "TWN" in cit:
        raise RuntimeError("OECD 的公司稅資料有台灣了，改用 OECD 的數字並比對所得稅法")
    cit_years = list(range(2000, LAST_YEAR + 1))
    cit["TWN"] = {y: tw.cit_rate(y) for y in cit_years}
    cit_zh = {
        "TWN": "OECD 的資料沒有台灣，依所得稅法第 5 條：2009 年以前 25%、2010 年 17%、2018 年起 20%"
        "（課稅所得額 12 萬元以下免稅；未分配盈餘另加徵 5%，2017 年以前 10%，不算在這裡）",
    }
    cit_en = {
        "TWN": "Not in the OECD data; rates are from Article 5 of Taiwan's Income Tax Act: 25% until 2009, 17% from "
        "2010 and 20% from 2018 (taxable income up to NT$120,000 is exempt; a separate 5% surtax on undistributed "
        "earnings, 10% until 2017, is not included)",
    }
    for c, s in cit.items():
        y = max(y for y in s if y <= 2025) if any(y <= 2025 for y in s) else None
        if y is None or c == "TWN":
            continue
        own = central.get(c, {}).get(y)
        if own is not None and s[y] - own >= 0.05:
            cit_zh[c] = f"{y} 年中央政府 {own:g}%，其餘 {s[y] - own:.1f} 個百分點是地方政府的稅（各地不同的，是 OECD 的代表值）"
            cit_en[c] = (
                f"In {y}, {own:g}% central government plus {s[y] - own:.1f} percentage points of sub-central tax "
                "(where it varies by place, a representative rate chosen by the OECD)"
            )
    write(out, "cit", "%", cit_years, cit, 3, cit_zh, cit_en)

    # ── 個人所得稅最高稅率與起徵點 ─────────────────────────────
    pit, threshold = oecd_tax.top_income_tax()
    pit_years = list(range(2000, 2026))
    wage = {y: v * 12 for y, v in dgbas_wages.monthly_earnings().items()}  # 主計總處每人每月總薪資 × 12
    pit["TWN"] = {y: float(tw.PIT[y]["rate"]) for y in pit_years}
    threshold["TWN"] = {y: tw.gross_threshold(y) / wage[y] for y in pit_years if y in wage}
    pit_zh = {
        "TWN": "OECD 的資料沒有台灣，依所得稅法第 5 條：2015–2017 年綜合所得淨額超過 1,000 萬元"
        "（2017 年 1,031 萬元）的部分 45%，其他年份最高 40%",
        "LVA": "OECD 的表 2025 年寫 0，拉脫維亞是累進稅率，不可能是 0，沒有收",
        "FRA": "OECD 的表 2013 年寫 122.8%，法定稅率不會超過 100%（前後兩年都是 54.5% 左右），沒有收",
    }
    pit_en = {
        "TWN": "Not in the OECD data; from Article 5 of Taiwan's Income Tax Act: 45% on net taxable income above "
        "NT$10 million (NT$10.31 million in 2017) in 2015–2017, 40% at most in other years",
        "LVA": "The OECD table shows 0 for 2025, which cannot be right for Latvia's progressive tax, so it is left out",
        "FRA": "The OECD table shows 122.8% for 2013, which cannot be a statutory rate (about 54.5% in the years either side), so it is left out",
    }
    write(out, "pit-top", "%", pit_years, pit, 3, pit_zh, pit_en)

    last = tw.PIT[2025]
    th_zh = {
        "TWN": "OECD 的資料沒有台灣，自己換算：最高稅率開始的綜合所得淨額（2025 年 498 萬元）加上免稅額、標準扣除額、"
        "薪資所得特別扣除額（單身、只有薪資），除以主計總處工業及服務業受僱員工的平均年薪（每月總薪資 × 12，"
        "含部分工時，OECD 的平均薪資只算全時）",
        "LVA": pit_zh["LVA"],
        "FRA": pit_zh["FRA"],
    }
    th_en = {
        "TWN": "Not in the OECD data; computed here: the net taxable income at which the top rate starts (NT$4.98 "
        "million in 2025) plus the personal exemption, standard deduction and salary deduction (single, wages only), "
        "divided by DGBAS average annual earnings in industry and services (monthly earnings × 12, including "
        "part-timers, whereas the OECD average wage covers full-time workers)",
        "LVA": pit_en["LVA"],
        "FRA": pit_en["FRA"],
    }
    # 起徵點的倍數差很多（哥倫比亞 50 倍、匈牙利 0），平均被少數國家拉高，OECD 的對照用中位數
    write(out, "pit-threshold", "倍", pit_years, threshold, 2, th_zh, th_en,
          aggregate=oecd_average(threshold, pit_years, how=median), key="OECD_MEDIAN")
    print(f"  台灣 2025 年的起徵點：{tw.gross_threshold(2025):,.0f} 元 ÷ 平均年薪 {wage[2025]:,.0f} 元 = "
          f"{threshold['TWN'][2025]:.2f} 倍（淨額 {last['top_from']:,} 元）")

    # ── 加值型營業稅 ─────────────────────────────────────────
    vat, vat_zh, vat_en = oecd_tax.vat_rates()
    vat_years = sorted({y for s in vat.values() for y in s})
    vat["TWN"] = {y: tw.VAT for y in vat_years}
    vat_zh["TWN"] = "OECD 的資料沒有台灣，依加值型及非加值型營業稅法：1986 年 4 月實施加值型營業稅起一直是 5%（法律規定 5–10%）"
    vat_en["TWN"] = "Not in the OECD data; from Taiwan's Value-added and Non-value-added Business Tax Act: 5% since VAT began in April 1986 (the law allows 5–10%)"
    write(out, "vat", "%", vat_years, vat, 2, vat_zh, vat_en)

    # ── 勞動稅負 ────────────────────────────────────────────
    wedge = oecd_tax.tax_wedge()
    wedge_years = list(range(2000, 2026))
    published = to_series(wedge.get("OECD_REP", {}), wedge_years, 3)
    ours = oecd_average(wedge, wedge_years)
    worst = max(abs(a - b) for a, b in zip(published, ours) if a is not None and b is not None)
    if worst > 0.1:
        raise RuntimeError(f"勞動稅負的 OECD 平均跟自己算的差 {worst:.2f} 個百分點")
    write(out, "tax-wedge", "%", wedge_years, wedge, 3, {}, {}, aggregate=published)

    # ── 台灣的側欄 ──────────────────────────────────────────
    taiwan = {
        "pit": {
            str(y): {
                **{k: tw.PIT[y][k] for k in ("rate", "top_from", "exemption", "standard", "salary")},
                "brackets": list(tw.BRACKETS[y][0]),
                "rates": list(tw.BRACKETS[y][1]),
                "gross": tw.gross_threshold(y),
                "wage": round(wage[y]) if y in wage else None,
                "assumed": [k for k, years in tw.ASSUMED.items() if y in years],
            }
            for y in sorted(tw.PIT)
        },
        "cit": {str(y): r for y, r in tw.CIT.items()},
        "vat": tw.VAT,
        "vatSince": tw.VAT_SINCE,
        "sources": tw.PIT_SOURCES,
    }
    write_json(out / "taiwan.json", taiwan)
    write_json(
        out / "manifest.json",
        {
            "topic": "taxes",
            "generatedAt": now_iso(),
            "source": "OECD Corporate Tax Statistics, OECD Tax Database (Table I.7), OECD Taxing Wages, "
            + oecd_tax.VAT_SOURCE
            + "; OECD Tax Policy Reforms 2025, 2026 (CC BY 4.0); 所得稅法、財政部財政資訊中心綜合所得稅申報核定統計專冊、"
            "財政部賦稅署公告、臺北國稅局、主計總處薪資及生產力統計（政府資料開放授權條款）",
        },
    )
