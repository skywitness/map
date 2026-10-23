"""外匯存底與外債主題：外匯存底（含黃金）、可支應幾個月進口、外債占 GDP、經常帳占 GDP。

- 外匯存底：世界銀行 WDI 的 `FI.RES.TOTL.CD`（含黃金的總準備，來源是 IMF 國際金融統計，黃金以年底的倫敦市價計）。
- 可支應進口月數：WDI 的 `FI.RES.TOTL.MO` = 總準備 ÷（商品、服務與初次所得的進口 `BM.GSR.TOTL.CD` ÷ 12），
  自己用這兩個序列重算，各國都跟世界銀行的數字相同。
- 外債占 GDP：外債總額（美元，年底）÷ IMF WEO 的名目 GDP（美元）。
  - 中低所得國家用世界銀行國際債務統計（IDS，WDI 的 `DT.DOD.DECT.CD`）；IDS 公布的比率是占 GNI
    （`DT.DOD.DECT.GN.ZS`），這裡改成自己除以 GDP，跟其他國家同一個分母。
  - 不在 IDS 的國家（高所得國家）用 QEDS 的外債總額（`sources/worldbank_qeds.py`）。
  - 兩邊都有的 74 國，QEDS ÷ IDS 的中位數是 0.99，所以 IDS 國家一律用 IDS，不混用（混用會讓同一國的序列跳動）；
    只有後來不在 IDS 裡的國家（保加利亞、俄羅斯）在 IDS 停止之後接 QEDS。
  - 2003 年起：QEDS 在 2003 年以前只有少數高所得國家，地圖上幾乎只有中低所得國家。
- 經常帳占 GDP：IMF WEO 的 `BCA_NGDPD`（DataMapper，含台灣與推估值）。
- 台灣（WDI、IDS、QEDS 都沒有）：
  - 外匯存底：中央銀行的年底外匯存底（不含黃金）＋ 央行黃金 1,362 萬盎司 × 當年 12 月的平均金價（IMF PCPS），
    跟其他國家「黃金以市價計」的口徑一致。央行國際投資部位表的「準備資產」黃金以帳面成本計，只寫在附註。
  - 進口月數：上面的總準備 ÷（央行國際收支的商品、服務與初次所得支出 ÷ 12），跟世界銀行同一個算法。
  - 外債：央行國際投資部位表的債務工具負債（直接投資、證券投資、其他投資三項），也就是 IMF《外債統計指南》、
    QEDS 的外債總額定義；÷ 主計總處的名目 GDP（以央行的年平均匯率換算成美元，跟主計總處公布的美元 GDP 相同）。
    央行另外公布的「外債」統計範圍較窄（2024 年底 2,199 億美元，債務工具負債是 3,514 億美元），只寫在附註。
  - 經常帳：IMF 本身有台灣，附註對照央行國際收支的經常帳 ÷ 主計總處的 GDP。
- 有些國家最新一年還沒公布（香港的外匯存底 2024 年起、俄羅斯 2025 年），指標檔加 latestWithin: 1，顯示前一年的值。
"""
from __future__ import annotations

import statistics

from common import OUT_DIR, indicator_file, latest_year_span, now_iso, to_series, write_json, year_span
from sources import cbc, cbc_fx, cbc_reserves, dgbas, imf, imf_pcps, worldbank, worldbank_qeds

Series = dict[str, dict[int, float]]

LATEST_WITHIN = 1
DEBT_FIRST_YEAR = 2003
# 央行的黃金：1,362 萬盎司（約 424 公噸）。2020–2025 年央行報告立法院的是 1,358–1,363 萬盎司，
# 大多是 1980 年代買進、之後只買不賣，早年也用同一個數字
TAIWAN_GOLD_OZ = 13.62e6
WORLD_GDP_COVERAGE = 0.9  # 有資料國家的 GDP 至少占世界多少，才算世界合計
IMPORT_COLUMNS = ["商品-支出", "服務-支出", "初次所得-支出"]  # 世界銀行的進口含初次所得（BM.GSR.TOTL.CD）
QEDS_IDS_GAP = 0.25  # IDS 國家的 QEDS 差超過這個比例時，附註寫出 QEDS 的數字


def latest(series: dict[int, float], year: int, within: int = LATEST_WITHIN) -> tuple[int, float] | None:
    """year 往前 within 年內最近一年的 (年, 值)，跟前端的 latestAt() 同一個規則。"""
    found = [y for y in series if year - within <= y <= year]
    return (max(found), series[max(found)]) if found else None


def quantiles(name: str, series: Series, year: int) -> None:
    """印出某一年的分布（含 latestWithin 補上的值），挑分級門檻用。"""
    vals = sorted(found[1] for s in series.values() if (found := latest(s, year)))
    if len(vals) < 20:
        return
    qs = statistics.quantiles(vals, n=20)
    print(
        f"  {name} {year} 年 {len(vals)} 國：最小 {vals[0]:.1f}、P10 {qs[1]:.1f}、P25 {qs[4]:.1f}、"
        f"中位數 {qs[9]:.1f}、P75 {qs[14]:.1f}、P90 {qs[17]:.1f}、最大 {vals[-1]:.1f}"
    )


def taiwan_gdp_usd() -> dict[int, float]:
    """主計總處名目 GDP（新臺幣）÷ 央行年平均匯率 = 美元，跟主計總處公布的美元 GDP 相同。"""
    gdp = {y: v["GDP"] * 1e6 for y, v in dgbas.gdp_by_industry().items() if "GDP" in v}
    rate = cbc_fx.ntd_per_usd()
    return {y: v / rate[y] for y, v in gdp.items() if y in rate}


def yi(v: float) -> str:
    """美元 → 「5,767 億」這樣的字串（附註用）"""
    return f"{v / 1e8:,.0f}"


def bn(v: float) -> str:
    """美元 → 「576.7 billion」這樣的字串（英文附註用）"""
    return f"{v / 1e9:,.1f} billion"


def build() -> None:
    out = OUT_DIR / "topics" / "reserves"
    release, projection_from = imf.weo_release()
    gdp_imf, gdp_imf_world = imf.fetch("NGDPD")  # 十億美元
    gdp = {iso: {y: v * 1e9 for y, v in s.items()} for iso, s in gdp_imf.items()}
    world_gdp = {y: v * 1e9 for y, v in gdp_imf_world.items()}
    tw_gdp = taiwan_gdp_usd()
    gdp["TWN"] = {**gdp.get("TWN", {}), **tw_gdp}  # 台灣用主計總處的（IMF 也是用主計總處的數字）

    def covered(series: Series, year: int) -> bool:
        """有資料國家（latestWithin 內）的 GDP 占世界的比例夠不夠"""
        if year not in world_gdp:
            return False
        total = sum(gdp[iso][year] for iso, s in series.items() if latest(s, year) and year in gdp.get(iso, {}))
        return total >= world_gdp[year] * WORLD_GDP_COVERAGE

    def write(key: str, unit: str, years: list[int], series: Series, digits: int, notes: dict[str, tuple[str, str]],
              **extra: object) -> None:
        values = {iso: to_series(s, years, digits) for iso, s in series.items()}
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, unit, years, {iso: s for iso, s in values.items() if any(v is not None for v in s)},
                notes={iso: n[0] for iso, n in notes.items()},
                notesEn={iso: n[1] for iso, n in notes.items()},
                **extra,
            ),
        )

    # ── 台灣的外匯存底（含黃金市值） ─────────────────────────
    fx = cbc_reserves.fx_reserves()
    gold_price = imf_pcps.december_gold_price()
    tw_gold = {y: TAIWAN_GOLD_OZ * gold_price[y] for y in fx if y in gold_price}
    tw_reserves = {y: fx[y] + tw_gold[y] for y in tw_gold}
    iip_reserves = cbc_reserves.reserve_assets()
    bop = cbc.balance_of_payments(IMPORT_COLUMNS + ["經常帳-淨額"])
    tw_imports = {y: sum(bop[c][y] for c in IMPORT_COLUMNS) * 1e6 for y in bop[IMPORT_COLUMNS[0]]
                  if all(y in bop[c] for c in IMPORT_COLUMNS)}

    # ── 外匯存底（含黃金） ──────────────────────────────────
    reserves, _ = worldbank.fetch("FI.RES.TOTL.CD")
    last = max(y for s in reserves.values() for y in s)
    reserves["TWN"] = {y: v for y, v in tw_reserves.items() if y <= last}
    years = latest_year_span(reserves, LATEST_WITHIN)
    world = {y: sum(found[1] for s in reserves.values() if (found := latest(s, y))) for y in years if covered(reserves, y)}
    ty = max(y for y in reserves["TWN"] if y in iip_reserves)
    notes = {
        "TWN": (
            f"台灣不在世界銀行（IMF 國際金融統計）的資料中。改用中央銀行公布的年底外匯存底（不含黃金），加上央行持有的"
            f"黃金約 1,362 萬盎司（約 424 公噸）乘上當年 12 月的平均金價（IMF）估算的市值，跟其他國家「黃金以年底市價計」"
            f"的口徑一致。{ty} 年底外匯存底 {yi(fx[ty])} 億美元、黃金約 {yi(tw_gold[ty])} 億美元，合計 {yi(tw_reserves[ty])} 億美元；"
            f"央行國際投資部位表的「準備資產」把黃金以帳面成本計，是 {yi(iip_reserves[ty])} 億美元。{min(reserves['TWN'])} 年起",
            f"Taiwan is not in the World Bank (IMF International Financial Statistics) data. The central bank's year-end "
            f"foreign exchange reserves (which exclude gold) are used instead, plus the market value of its roughly 13.62 "
            f"million troy ounces (about 424 tonnes) of gold at the December average price (IMF), matching the other "
            f"countries' figures, where gold is valued at year-end market prices. End-{ty}: foreign exchange reserves "
            f"US${bn(fx[ty])} and gold about US${bn(tw_gold[ty])}, US${bn(tw_reserves[ty])} in total; the reserve assets "
            f"in the central bank's international investment position carry gold at book value, US${bn(iip_reserves[ty])}. "
            f"From {min(reserves['TWN'])}",
        )
    }
    write("reserves", "美元", years, reserves, 0, notes, latestWithin=LATEST_WITHIN, aggregates={"WLD": to_series(world, years, 0)})
    print(f"  外匯存底：{years[0]}–{years[-1]}，世界合計 {min(world)}–{max(world)} 年（{last - 1} 年 {world[last - 1] / 1e12:.2f} 兆美元）；"
          f"台灣 {ty} 年 {yi(tw_reserves[ty])} 億美元")
    for y in (last - 1, last):
        top = sorted(((found[1], iso) for iso, s in reserves.items() if (found := latest(s, y))), reverse=True)[:8]
        print(f"    {y} 年前幾名：" + "、".join(f"{iso} {v / 1e9:,.0f}" for v, iso in top))

    # ── 可支應幾個月的進口 ───────────────────────────────────
    imports, _ = worldbank.fetch("BM.GSR.TOTL.CD")
    imports["TWN"] = tw_imports
    months_wb, _ = worldbank.fetch("FI.RES.TOTL.MO")
    months = {
        iso: {y: v / (imports[iso][y] / 12) for y, v in s.items() if imports.get(iso, {}).get(y)}
        for iso, s in reserves.items()
    }
    months = {iso: s for iso, s in months.items() if s}
    # 自己算的跟世界銀行的 FI.RES.TOTL.MO 對照（世界銀行有月數的國家，兩邊應該相同）
    diffs = [abs(months[iso][y] / v - 1) for iso, s in months_wb.items() for y, v in s.items()
             if v and y in months.get(iso, {})]
    print(f"  進口月數：跟世界銀行 FI.RES.TOTL.MO 比對 {len(diffs)} 筆，差超過 1% 的 {sum(d > 0.01 for d in diffs)} 筆")
    years = latest_year_span(months, LATEST_WITHIN)
    # 世界：有資料國家的總準備合計 ÷ 進口合計（各國用地圖上顯示的那一年）
    world = {}
    for y in years:
        total_reserves = total_imports = 0.0
        for iso, s in months.items():
            if found := latest(s, y):
                total_reserves += reserves[iso][found[0]]
                total_imports += imports[iso][found[0]]
        if covered(months, y) and total_imports:
            world[y] = total_reserves / (total_imports / 12)
    m_tw = months["TWN"][ty]
    notes = {
        "TWN": (
            f"台灣不在世界銀行的資料中。改用中央銀行的外匯存底加上黃金的市值（見「外匯存底」的附註），除以中央銀行國際收支統計"
            f"的商品、服務與初次所得支出（÷ 12），跟世界銀行的算法相同。{ty} 年 {m_tw:.1f} 個月；只算外匯存底（不含黃金）是 "
            f"{fx[ty] / (tw_imports[ty] / 12):.1f} 個月",
            f"Taiwan is not in the World Bank data. The central bank's foreign exchange reserves plus the market value of "
            f"its gold (see the note on reserves) are divided by imports of goods, services and primary income from the "
            f"central bank's balance of payments (÷ 12), the same calculation as the World Bank's. {ty}: {m_tw:.1f} "
            f"months; {fx[ty] / (tw_imports[ty] / 12):.1f} months counting foreign exchange reserves only (without gold)",
        )
    }
    write("reserves-months", "個月", years, months, 2, notes, latestWithin=LATEST_WITHIN,
          aggregates={"WLD": to_series(world, years, 2)})
    print(f"  進口月數：{years[0]}–{years[-1]}，世界 {min(world)}–{max(world)} 年（{max(world)} 年 {world[max(world)]:.1f} 個月）")
    quantiles("進口月數", months, years[-2])

    # ── 外債占 GDP ─────────────────────────────────────────
    ids, _ = worldbank.fetch("DT.DOD.DECT.CD")
    qeds = worldbank_qeds.year_end()
    ids_last = max(y for s in ids.values() for y in s)
    debt: Series = {}
    notes = {}
    for iso in set(ids) | set(qeds):
        s_ids, s_q = ids.get(iso, {}), qeds.get(iso, {})
        merged = dict(s_ids)
        if not s_ids:
            merged = dict(s_q)
        elif max(s_ids) <= ids_last - 2 and any(y > max(s_ids) for y in s_q):
            # 後來不在 IDS 裡的國家（成為高所得國家）：IDS 停止之後接 QEDS
            switch = min(y for y in s_q if y > max(s_ids))
            merged.update({y: v for y, v in s_q.items() if y >= switch})
            notes[iso] = (
                f"{switch - 1} 年以前用世界銀行國際債務統計（IDS），{switch} 年起用 IMF 與世界銀行的季度外債統計（QEDS）",
                f"World Bank International Debt Statistics (IDS) up to {switch - 1}; Quarterly External Debt Statistics "
                f"(QEDS) from {switch}",
            )
        ratio = {y: v / gdp[iso][y] * 100 for y, v in merged.items() if y >= DEBT_FIRST_YEAR and gdp.get(iso, {}).get(y)}
        if ratio:
            debt[iso] = ratio
        # IDS 國家的 QEDS 差很多時，附註寫出 QEDS 的數字（例如模里西斯的 QEDS 含離岸的全球商業公司）
        # 只比最近 5 年（奈及利亞的 QEDS 停在 2012 年，那時只報了一小部分）
        common_years = [y for y in s_ids if y in s_q and y in ratio and y > ids_last - 5]
        if iso not in notes and s_ids and common_years:
            y = max(common_years)
            if abs(s_q[y] / s_ids[y] - 1) > QEDS_IDS_GAP:
                q = s_q[y] / gdp[iso][y] * 100
                notes[iso] = (
                    f"用世界銀行國際債務統計（IDS）。IMF 與世界銀行的季度外債統計（QEDS）{y} 年是占 GDP {q:,.1f}%，"
                    f"兩者的涵蓋範圍不同",
                    f"World Bank International Debt Statistics (IDS). The Quarterly External Debt Statistics (QEDS) "
                    f"put it at {q:,.1f}% of GDP in {y}; the two differ in coverage",
                )
    tw_debt = cbc_reserves.external_debt_liabilities()
    official = cbc_reserves.official_external_debt()
    debt["TWN"] = {y: v / tw_gdp[y] * 100 for y, v in tw_debt.items() if y in tw_gdp and y >= DEBT_FIRST_YEAR}
    dy = max(debt["TWN"])
    notes["TWN"] = (
        f"台灣不在 QEDS 與世界銀行的資料中。改用中央銀行國際投資部位表的債務工具負債（直接投資的公司間債務、證券投資的債務證券、"
        f"其他投資的存款、借款、貿易信用與其他應付款），跟 QEDS 的外債總額同一個定義，除以主計總處的 GDP（以央行的年平均匯率"
        f"換算成美元）。{dy} 年底 {yi(tw_debt[dy])} 億美元、占 GDP {debt['TWN'][dy]:.1f}%。央行另外公布的「外債」統計範圍較窄，"
        f"同年是 {yi(official[dy])} 億美元、占 GDP {official[dy] / tw_gdp[dy] * 100:.1f}%",
        f"Taiwan is not in the QEDS or World Bank data. Debt liabilities in the central bank's international investment "
        f"position (intercompany debt under direct investment, debt securities under portfolio investment, and deposits, "
        f"loans, trade credit and other payables under other investment) are used instead, the same definition as gross "
        f"external debt in the QEDS, divided by GDP from DGBAS (converted to US dollars at the central bank's annual "
        f"average exchange rate). End-{dy}: US${bn(tw_debt[dy])}, {debt['TWN'][dy]:.1f}% of GDP. The central bank's "
        f"separate external debt statistics have a narrower scope: US${bn(official[dy])} in the same year, "
        f"{official[dy] / tw_gdp[dy] * 100:.1f}% of GDP",
    )
    years = [y for y in latest_year_span(debt, LATEST_WITHIN) if y >= DEBT_FIRST_YEAR]
    write("external-debt", "%", years, debt, 1, notes, latestWithin=LATEST_WITHIN)
    print(f"  外債：{years[0]}–{years[-1]}，IDS {sum(1 for k in debt if k in ids)} 國、QEDS {sum(1 for k in debt if k not in ids and k != 'TWN')} 國；"
          f"台灣 {dy} 年 {debt['TWN'][dy]:.1f}%（央行外債統計 {official[dy] / tw_gdp[dy] * 100:.1f}%）；附註 {sorted(notes)}")
    quantiles("外債占 GDP", debt, ids_last)

    # ── 經常帳占 GDP ───────────────────────────────────────
    ca, _ = imf.fetch("BCA_NGDPD")
    years = year_span(ca)
    cy = max(y for y in bop["經常帳-淨額"] if y in tw_gdp)
    tw_ca = bop["經常帳-淨額"][cy] * 1e6
    notes = {
        "TWN": (
            f"IMF 的台灣數字來自中央銀行的國際收支統計：{cy} 年經常帳順差 {yi(tw_ca)} 億美元，除以主計總處的 GDP 是 "
            f"{tw_ca / tw_gdp[cy] * 100:.1f}%（IMF {ca['TWN'].get(cy, float('nan')):.1f}%）",
            f"The IMF's figures for Taiwan come from the central bank's balance of payments: a current account surplus of "
            f"US${bn(tw_ca)} in {cy}, {tw_ca / tw_gdp[cy] * 100:.1f}% of GDP from DGBAS (IMF: "
            f"{ca['TWN'].get(cy, float('nan')):.1f}%)",
        )
    }
    write("current-account", "%", years, ca, 2, notes, projectionFrom=projection_from)
    print(f"  經常帳：{years[0]}–{years[-1]}（{projection_from} 年起推估）")
    quantiles("經常帳占 GDP", ca, projection_from - 1)

    write_json(
        out / "manifest.json",
        {
            "topic": "reserves",
            "generatedAt": now_iso(),
            "source": (
                f"World Bank WDI (IMF IFS, IDS); World Bank/IMF QEDS; IMF World Economic Outlook ({release}); "
                "IMF Primary Commodity Prices; 中央銀行; 行政院主計總處"
            ),
            "projectionFrom": projection_from,
        },
    )
