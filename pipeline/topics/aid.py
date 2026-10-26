"""國際援助與僑匯主題：政府開發援助（ODA）的援助國與受援國、援助的流向，以及僑匯（個人匯款）的收入與支出。

資料：
- ODA：OECD DAC 的統計（sources/oecd_dac.py，OECD 的資料條款：可轉載、改作，要註明出處）。
  - 援助國（DAC1）：ODA 總額與占 GNI 比例。2017 年以前是淨撥付，2018 年起是 DAC 的新口徑「贈與等值」
    （貸款只算贈與成分），指標檔的 methodBreak 標出接縫。最新一年（2025）是 2026 年 4 月的初步數字，
    寫在說明裡（前端的 projectionFrom 是「推估值」的意思，不適用）。
    台灣不是 DAC 會員，但向 OECD 申報（Chinese Taipei），定義相同。
  - 受援國（DAC2A）：所有官方援助者（雙邊加多邊，ALLD）給的 ODA 淨撥付、占 GNI、人均。
  - 流向（DAC2A 援助國 × 受援國，淨撥付）：flows/<年>.json。export 是援助國給哪些國家（只畫國家，總額是給所有
    開發中國家的雙邊 ODA，含沒有分到特定國家的），import 是受援國從哪些「國家」收到援助（總額是所有官方援助者），
    multilateral 是受援國從哪些多邊機構收到援助（地圖上沒有位置，只列在側欄），unspecified 是援助國沒有分到特定國家的金額。
  - 側欄的援助國明細（countries/<ISO3>.json）：雙邊與多邊的組成、給各類多邊機構的核心捐款、在捐助國境內的難民支出。
- 僑匯：世界銀行 WDI（CC BY 4.0）的個人匯款（personal remittances = 個人移轉 + 受僱人員報酬，IMF 國際收支手冊第 6 版），
  收入、占 GDP、支出。WDI 沒有台灣，台灣用中央銀行國際收支統計（BPP2Y01）的「二次所得－其他部門－個人移轉」加
  「初次所得－薪資」，定義跟 WDI 相同；占 GDP 用主計總處的 GDP（topics/reserves.py 的 taiwan_gdp_usd()）。
- 雙邊的僑匯流向沒有開放授權的資料（KNOMAD 2021 年的矩陣沒有寫授權、CGD 2024 年版是 CC BY-NC 4.0 還要事先通知），
  所以沒有畫僑匯的弧線（見 DESIGN.md 第 8 節）。

輸出（public/data/topics/aid/）：
- oda.json、oda-gni.json、oda-received.json、oda-received-gni.json、oda-received-pc.json
- remit-in.json、remit-gdp.json、remit-out.json
- flows/<年>.json、agencies.json（多邊機構的中英文名稱）、countries/<ISO3>.json（援助國與台灣的明細）
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json, year_span
from sources import cbc, oecd_dac, worldbank
from sources.countries import to_iso3
from topics.reserves import taiwan_gdp_usd

OUT = OUT_DIR / "topics" / "aid"
TOP_N = 15  # 流向檔每個國家留前幾名的國家
TOP_AGENCIES = 10  # 受援國留前幾名的多邊機構
GE_FROM = 2018  # DAC 的官方口徑從 2018 年起改成贈與等值
TAIWAN = "TWN"

Series = dict[int, float]

# 多邊機構：OECD 的代碼 → (中文, 英文)。同一個機構只取一層（歐盟機構、國際貨幣基金、非洲、亞洲、美洲開發銀行用整個
# 集團；世界銀行、聯合國、其他區域開發銀行與其他多邊組織用個別機構），加起來就是多邊機構的合計（ALLM）。
AGENCIES: dict[str, tuple[str, str]] = {
    "4EU001": ("歐盟機構", "EU institutions"),
    "5IMF0": ("國際貨幣基金（優惠貸款）", "International Monetary Fund (concessional)"),
    "5WB001": ("國際復興開發銀行（世界銀行）", "IBRD (World Bank)"),
    "5WB002": ("國際開發協會（世界銀行）", "International Development Association (World Bank)"),
    "5WB003": ("國際開發協會的多邊債務減免（世界銀行）", "IDA Multilateral Debt Relief Initiative (World Bank)"),
    "5WB004": ("多邊投資擔保機構（世界銀行）", "MIGA (World Bank)"),
    "5WBG002": ("國際金融公司（世界銀行）", "International Finance Corporation (World Bank)"),
    "5WBG003": ("世界銀行的其他機構", "Other World Bank (AMCs)"),
    "5AFDB0": ("非洲開發銀行", "African Development Bank"),
    "5ASDB0": ("亞洲開發銀行", "Asian Development Bank"),
    "5IDB0": ("美洲開發銀行", "Inter-American Development Bank"),
    "5RDB001": ("亞洲基礎設施投資銀行", "Asian Infrastructure Investment Bank"),
    "5RDB002": ("黑海貿易與開發銀行", "Black Sea Trade and Development Bank"),
    "5RDB003": ("中美洲經濟整合銀行", "Central American Bank for Economic Integration"),
    "5RDB004": ("加勒比開發銀行", "Caribbean Development Bank"),
    "5RDB005": ("歐洲理事會開發銀行", "Council of Europe Development Bank"),
    "5RDB006": ("拉丁美洲開發銀行", "Development Bank of Latin America (CAF)"),
    "5RDB007": ("歐洲復興開發銀行", "European Bank for Reconstruction and Development"),
    "5RDB008": ("國際投資銀行", "International Investment Bank"),
    "5RDB009": ("伊斯蘭開發銀行", "Islamic Development Bank"),
    "5RDB010": ("新開發銀行", "New Development Bank"),
    "5RDB011": ("北美開發銀行", "North American Development Bank"),
    "5RDB999": ("其他區域開發銀行", "Other regional development banks"),
    "9OTH002": ("阿拉伯非洲經濟發展銀行", "Arab Bank for Economic Development in Africa (BADEA)"),
    "1UN001": ("聯合國中央緊急應變基金", "Central Emergency Response Fund (CERF)"),
    "1UN002": ("聯合國 COVID-19 應變與復原基金", "UN COVID-19 Response and Recovery Fund"),
    "1UN003": ("聯合國糧食及農業組織", "Food and Agriculture Organization (FAO)"),
    "1UN004": ("國際農業發展基金", "International Fund for Agricultural Development (IFAD)"),
    "1UN005": ("國際原子能總署", "International Atomic Energy Agency (IAEA)"),
    "1UN006": ("國際勞工組織", "International Labour Organization (ILO)"),
    "1UN007": ("聯合國永續發展目標聯合基金", "Joint SDG Fund"),
    "1UN008": ("聯合國資本發展基金", "UN Capital Development Fund (UNCDF)"),
    "1UN009": ("聯合國剛果基金", "UN Fund for Congo"),
    "1UN010": ("聯合國裁軍研究所", "UN Institute for Disarmament Research (UNIDIR)"),
    "1UN011": ("聯合國建設和平基金", "UN Peacebuilding Fund"),
    "1UN012": ("聯合國婦女署", "UN Women"),
    "1UN013": ("聯合國愛滋病規劃署", "UNAIDS"),
    "1UN014": ("聯合國開發計畫署", "UN Development Programme (UNDP)"),
    "1UN015": ("聯合國歐洲經濟委員會", "UN Economic Commission for Europe (UNECE)"),
    "1UN016": ("聯合國環境規劃署", "UN Environment Programme (UNEP)"),
    "1UN017": ("聯合國人口基金", "UN Population Fund (UNFPA)"),
    "1UN018": ("聯合國難民署", "UN Refugee Agency (UNHCR)"),
    "1UN019": ("聯合國兒童基金會", "UNICEF"),
    "1UN020": ("聯合國貿易和發展會議", "UN Conference on Trade and Development (UNCTAD)"),
    "1UN021": ("聯合國工業發展組織", "UN Industrial Development Organization (UNIDO)"),
    "1UN022": ("聯合國近東巴勒斯坦難民救濟工程處", "UNRWA"),
    "1UN023": ("聯合國技術援助計畫", "UN Technical Assistance (UNTA)"),
    "1UN024": ("世界糧食計劃署", "World Food Programme (WFP)"),
    "1UN025": ("世界衛生組織的 COVID-19 應變計畫", "WHO Strategic Preparedness and Response Plan"),
    "1UN026": ("世界衛生組織", "World Health Organization (WHO)"),
    "1UN027": ("聯合國觀光組織", "UN Tourism"),
    "1UN028": ("世界貿易組織", "World Trade Organization"),
    "1UN029": ("國際貿易中心", "International Trade Centre (ITC)"),
    "1UN030": ("聯合國發展協調辦公室", "UN Development Coordination Office"),
    "1UN031": ("聯合國西亞經濟社會委員會", "UN Economic and Social Commission for Western Asia"),
    "1UN032": ("聯合國毒品和犯罪問題辦公室", "UN Office on Drugs and Crime"),
    "1UN999": ("其他聯合國機構", "Other UN agencies"),
    "9OTH001": ("調適基金", "Adaptation Fund"),
    "9OTH003": ("阿拉伯經濟社會發展基金", "Arab Fund for Economic and Social Development"),
    "9OTH004": ("亞洲森林合作組織", "Asian Forest Cooperation Organisation"),
    "9OTH005": ("金融卓越中心", "Center of Excellence in Finance"),
    "9OTH006": ("氣候投資基金", "Climate Investment Funds"),
    "9OTH007": ("信用擔保與投資機制", "Credit Guarantee and Investment Facility"),
    "9OTH008": ("歐亞穩定與發展基金", "Eurasian Fund for Stabilization and Development"),
    "9OTH009": ("全球疫苗免疫聯盟", "Gavi, the Vaccine Alliance"),
    "9OTH010": ("全球能源效率與再生能源基金", "Global Energy Efficiency and Renewable Energy Fund"),
    "9OTH011": ("全球環境基金", "Global Environment Facility"),
    "9OTH012": ("全球基金（愛滋病、結核病、瘧疾）", "Global Fund"),
    "9OTH013": ("全球綠色成長研究所", "Global Green Growth Institute"),
    "9OTH014": ("全球教育夥伴關係", "Global Partnership for Education"),
    "9OTH015": ("綠色氣候基金", "Green Climate Fund"),
    "9OTH016": ("國際遺傳工程與生物技術中心", "International Centre for Genetic Engineering and Biotechnology"),
    "9OTH017": ("國際失蹤人員委員會", "International Commission on Missing Persons"),
    "9OTH018": ("蒙特婁議定書多邊基金", "Montreal Protocol Multilateral Fund"),
    "9OTH019": ("北歐發展基金", "Nordic Development Fund"),
    "9OTH020": ("OPEC 國際發展基金", "OPEC Fund for International Development"),
    "9OTH021": ("歐洲安全與合作組織", "OSCE"),
    "9OTH022": ("私人基礎建設發展集團", "Private Infrastructure Development Group"),
    "9OTH023": ("世界動物衛生組織", "World Organisation for Animal Health"),
    "9OTH024": ("國際農業研究磋商組織", "CGIAR"),
    "9OTH998": ("其他多邊組織", "Other multilateral organisations"),
    "9OTH999": ("其他多邊組織", "Other multilateral organisations"),
}

# 援助國的組成（DAC1）：檔裡的鍵 → (2017 年以前的 MEASURE（淨撥付）, 2018 年起的 MEASURE（贈與等值）)
MIX = {
    "bilateral": ("1015", "11015"),
    "refugees": ("1820", "1820"),  # 在捐助國境內的難民支出（雙邊 ODA 的一部分）
    "multilateral": ("2000", "12000"),
    "un": ("2101", "2101"),
    "eu": ("2102", "2102"),
    "ida": ("2103", "2103"),
    "wb": ("2104", "2104"),  # 世界銀行的其他機構（IBRD、IFC、MIGA）
    "rdb": ("2105", "2105"),
    "other": (("2106", "2107", "2108"), ("2106", "2107", "2108")),  # 全球環境基金、蒙特婁議定書、其他機構
}


def headline(d1: dict, donor: str, net: str | tuple[str, ...], ge: str | tuple[str, ...]) -> Series:
    """2017 年以前用淨撥付（1140），2018 年起用贈與等值（1160）；measure 是 tuple 時加總。"""
    def pick(measures: str | tuple[str, ...], flow: str, keep) -> Series:
        out: Series = {}
        for m in (measures,) if isinstance(measures, str) else measures:
            for y, v in d1.get((donor, m, flow), {}).items():
                if keep(y):
                    out[y] = out.get(y, 0.0) + v
        return out
    return pick(net, "1140", lambda y: y < GE_FROM) | pick(ge, "1160", lambda y: y >= GE_FROM)


def build() -> None:
    # ── 援助國（DAC1） ──
    d1 = oecd_dac.dac1()
    donors = sorted({iso for (code, _, _) in d1 if (iso := to_iso3(code))})
    oda = {iso: {y: v * 1e6 for y, v in headline(d1, iso, "1010", "11010").items()} for iso in donors}
    oda = {iso: s for iso, s in oda.items() if s}
    gni = {iso: headline(d1, iso, "2", "11002") for iso in donors}
    gni = {iso: s for iso, s in gni.items() if s}
    dac_total = {y: v * 1e6 for y, v in headline(d1, "DAC", "1010", "11010").items()}
    non_dac = {y: v * 1e6 for y, v in headline(d1, "WXDAC", "1010", "11010").items()}
    world_oda = {y: v + non_dac.get(y, 0.0) for y, v in dac_total.items()}
    dac_gni = headline(d1, "DAC", "2", "11002")
    preliminary = max(y for s in oda.values() for y in s)
    oda_years = list(range(1960, preliminary + 1))
    check = sum(s.get(preliminary - 1, 0.0) for s in oda.values())
    print(f"  ODA {preliminary - 1} 年：各國加總 {check / 1e9:.1f}B，DAC＋非 DAC 合計 {world_oda[preliminary - 1] / 1e9:.1f}B")

    tw_span, tw_span_en = _ranges(oda[TAIWAN])
    tw_gni_span, tw_gni_span_en = _ranges(gni[TAIWAN])
    notes_tw = {
        TAIWAN: (
            f"台灣不是 DAC 會員，但向 OECD 申報援助的數字（OECD 列為「Chinese Taipei」），定義跟 DAC 會員相同："
            f"ODA 金額有 {tw_span} 年，占 GNI 比例有 {tw_gni_span} 年；2018 年起是贈與等值。"
        )
    }
    notes_tw_en = {
        TAIWAN: (
            "Taiwan is not a DAC member but reports its aid to the OECD (as “Chinese Taipei”) under the same definitions: "
            f"ODA amounts for {tw_span_en}, the share of GNI for {tw_gni_span_en}; grant equivalents from 2018."
        )
    }
    # 最新一年是初步數字，但前端的 projectionFrom 會寫成「推估值」，所以只在說明裡寫，不標 projectionFrom
    common_meta = {"methodBreak": GE_FROM}
    write_json(OUT / "oda.json", indicator_file(
        "oda", "美元", oda_years, {c: to_series(s, oda_years, 0) for c, s in oda.items()},
        aggregates={"WLD": to_series(world_oda, oda_years, 0), "DAC": to_series(dac_total, oda_years, 0)},
        notes=notes_tw, notesEn=notes_tw_en, **common_meta,
    ))
    write_json(OUT / "oda-gni.json", indicator_file(
        "oda-gni", "%", oda_years, {c: to_series(s, oda_years, 2) for c, s in gni.items()},
        aggregates={"DAC": to_series(dac_gni, oda_years, 2)},
        notes=notes_tw, notesEn=notes_tw_en, **common_meta,
    ))

    # ── 受援國（DAC2A） ──
    pairs = oecd_dac.dac2a_pairs()
    ratios = oecd_dac.dac2a_recipient_ratios()
    received = {iso: {y: v * 1e6 for y, v in s.items()} for (d, r), s in pairs.items() if d == "ALLD" and (iso := to_iso3(r))}
    world_received = {y: v * 1e6 for y, v in pairs[("ALLD", "DPGC")].items()}
    recv_years = year_span(received)
    by_gni = {iso: s for r, s in ratios["286"].items() if (iso := to_iso3(r))}
    per_capita = {iso: s for r, s in ratios["296"].items() if (iso := to_iso3(r))}
    tw_recv = received.get(TAIWAN, {})
    tw_first, tw_last = min(tw_recv), max(y for y, v in tw_recv.items() if v)
    # 1960 年代的美援：美國占台灣收到的 ODA 的比例（1960–1965 年）
    us_years = [y for y in range(tw_first, 1966) if y in tw_recv]
    us_share = sum(pairs.get(("USA", TAIWAN), {}).get(y, 0.0) for y in us_years) / sum(tw_recv[y] / 1e6 for y in us_years)
    # 其他援助國那幾年有償還（負的淨撥付），美國的比例可能超過 100%
    us_zh, us_en = ("幾乎全部", "almost all of it") if us_share >= 0.95 else (f"有 {us_share * 100:.0f}% ", f"{us_share * 100:.0f}% of it")
    notes_recv = {
        TAIWAN: (
            f"台灣在 OECD 的資料裡 {tw_first}–{tw_last} 年是受援國：{tw_first} 年收到 {tw_recv[tw_first] / 1e8:.2f} 億美元，"
            f"{tw_first}–{us_years[-1]} 年{us_zh}來自美國（美援在 1965 年結束）；{tw_last + 1} 年起沒有台灣收到 ODA 的資料。"
        )
    }
    notes_recv_en = {
        TAIWAN: (
            f"In the OECD data Taiwan was an aid recipient in {tw_first}–{tw_last}: US${tw_recv[tw_first] / 1e6:.0f} million in "
            f"{tw_first}, {us_en} from the United States in {tw_first}–{us_years[-1]} (US aid ended in 1965); "
            f"there are no data on ODA received by Taiwan from {tw_last + 1}."
        )
    }
    # 淨撥付是負的年份（償還的本金比新的援助多）：寫在附註裡
    for iso, s in sorted(received.items()):
        neg = [y for y, v in s.items() if v < 0]
        if not neg:
            continue
        zh, en = _ranges(neg)
        notes_recv[iso] = (notes_recv.get(iso, "") + f"淨撥付扣掉償還的貸款本金，{zh} 年償還的比新收到的援助多，所以是負的。")
        notes_recv_en[iso] = (
            (notes_recv_en[iso] + " " if iso in notes_recv_en else "")
            + f"Net disbursements subtract repayments of loan principal; in {en} repayments exceeded new aid, so the figure is negative."
        )
    write_json(OUT / "oda-received.json", indicator_file(
        "oda-received", "美元", recv_years, {c: to_series(s, recv_years, 0) for c, s in received.items()},
        aggregates={"WLD": to_series(world_received, recv_years, 0)}, notes=notes_recv, notesEn=notes_recv_en,
    ))
    write_json(OUT / "oda-received-gni.json", indicator_file(
        "oda-received-gni", "%", recv_years, {c: to_series(s, recv_years, 3) for c, s in by_gni.items()},
        notes=notes_recv, notesEn=notes_recv_en,
    ))
    write_json(OUT / "oda-received-pc.json", indicator_file(
        "oda-received-pc", "美元", recv_years, {c: to_series(s, recv_years, 2) for c, s in per_capita.items()},
        notes=notes_recv, notesEn=notes_recv_en,
    ))

    # ── 流向 ──
    flow_years = recv_years
    used_agencies: set[str] = set()
    off = []
    for year in flow_years:
        used_agencies |= _write_flows(year, pairs, off)
    if off:
        print(f"  注意：多邊機構加總跟 ALLM 差超過 1% 的受援國年份 {len(off)} 筆，例如 {off[:5]}")
    unknown = sorted({d for (d, _) in pairs if _agency_like(d) and d not in AGENCIES and d not in AGENCY_GROUPS})
    if unknown:
        print(f"  注意：沒有中文名稱的多邊機構代碼 {unknown}")
    write_json(OUT / "agencies.json", {code: list(AGENCIES[code]) for code in sorted(used_agencies)})

    # ── 援助國的明細（側欄） ──
    for iso in sorted(oda):
        if iso == TAIWAN:
            continue  # 台灣跟僑匯的明細一起寫（下面）
        mix = {key: headline(d1, iso, net, ge) for key, (net, ge) in MIX.items()}
        values = {key: to_series({y: v * 1e6 for y, v in s.items()}, oda_years, 0) for key, s in mix.items() if s}
        write_json(OUT / "countries" / f"{iso}.json", indicator_file("mix", "美元", oda_years, values), quiet=True)

    # ── 僑匯 ──
    remit_in, world_in = worldbank.fetch("BX.TRF.PWKR.CD.DT")
    remit_gdp, world_gdp_share = worldbank.fetch("BX.TRF.PWKR.DT.GD.ZS")
    remit_out, world_out = worldbank.fetch("BM.TRF.PWKR.CD.DT")
    bop = cbc.balance_of_payments(TW_BOP)
    tw_parts = {key: {y: v * 1e6 for y, v in bop[col].items()} for key, col in TW_BOP_KEYS.items()}
    tw_in = _sum(tw_parts["comp-in"], tw_parts["transfer-in"])
    tw_out = _sum(tw_parts["comp-out"], tw_parts["transfer-out"])
    tw_gdp = taiwan_gdp_usd()
    remit_in[TAIWAN] = tw_in
    remit_out[TAIWAN] = tw_out
    remit_gdp[TAIWAN] = {y: v / tw_gdp[y] * 100 for y, v in tw_in.items() if y in tw_gdp}
    ty = max(tw_in)
    tw_note = (
        f"WDI 沒有台灣，台灣用中央銀行國際收支統計：「二次所得－其他部門－個人移轉」加「初次所得－薪資」，定義跟 WDI 相同。"
        f"{ty} 年收入 {tw_in[ty] / 1e8:,.0f} 億美元、支出 {tw_out[ty] / 1e8:,.0f} 億美元，支出大多是在台移工匯回母國的個人移轉"
        f"（{tw_parts['transfer-out'][ty] / 1e8:,.0f} 億）。"
    )
    tw_note_en = (
        "Taiwan is not in the WDI; its figures are from the central bank’s balance of payments: personal transfers (secondary "
        "income, other sectors) plus compensation of employees (primary income), the same definition as the WDI. "
        f"In {ty}: received US${tw_in[ty] / 1e9:.1f} billion, paid US${tw_out[ty] / 1e9:.1f} billion, mostly personal transfers "
        f"(US${tw_parts['transfer-out'][ty] / 1e9:.1f} billion) sent home by migrant workers in Taiwan."
    )
    for key, series, world, digits, unit in [
        ("remit-in", remit_in, world_in, 0, "美元"),
        ("remit-gdp", remit_gdp, world_gdp_share, 2, "%"),
        ("remit-out", remit_out, world_out, 0, "美元"),
    ]:
        years = year_span(series)
        write_json(OUT / f"{key}.json", indicator_file(
            key, unit, years, {c: to_series(s, years, digits) for c, s in series.items() if s},
            aggregates={"WLD": to_series(world, years, digits)},
            notes={TAIWAN: tw_note}, notesEn={TAIWAN: tw_note_en},
        ))

    # 台灣的明細：援助的組成加上僑匯的四個項目
    tw_years = sorted(set(oda_years) | set(tw_in))
    tw_mix = {key: headline(d1, TAIWAN, net, ge) for key, (net, ge) in MIX.items()}
    tw_values = {key: to_series({y: v * 1e6 for y, v in s.items()}, tw_years, 0) for key, s in tw_mix.items() if s}
    tw_values |= {key: to_series(s, tw_years, 0) for key, s in tw_parts.items()}
    write_json(OUT / "countries" / f"{TAIWAN}.json", indicator_file("mix", "美元", tw_years, tw_values))

    write_json(OUT / "manifest.json", {
        "topic": "aid",
        "generatedAt": now_iso(),
        "source": (
            "OECD (2026), DAC1: Flows by provider (ODA+OOF+Private); DAC2A: Aid (ODA) disbursements to countries and regions, "
            "OECD Data Explorer, https://data-explorer.oecd.org/ (accessed on 2026-10-26); World Bank, World Development "
            "Indicators (personal remittances, CC BY 4.0); Central Bank of the Republic of China (Taiwan), balance of payments"
        ),
        "odaYears": [oda_years[0], oda_years[-1]],
        "preliminary": preliminary,
        "receivedYears": [recv_years[0], recv_years[-1]],
        "flowYears": [flow_years[0], flow_years[-1]],
    })
    last = recv_years[-1]
    print(
        f"  援助國 {len(oda)} 國（{oda_years[0]}–{preliminary}，{preliminary} 年是初步數字），受援國 {len(received)} 國"
        f"（{recv_years[0]}–{last}）；台灣 {preliminary} 年 ODA {oda[TAIWAN][preliminary] / 1e6:.0f} 百萬美元、"
        f"占 GNI {gni[TAIWAN].get(preliminary)}%；僑匯收入 {tw_in[ty] / 1e9:.2f}B、支出 {tw_out[ty] / 1e9:.2f}B（{ty}）"
    )


# 台灣的僑匯：中央銀行國際收支（BPP2Y01，百萬美元）
TW_BOP_KEYS = {
    "transfer-in": "二次所得-其他部門-個人移轉-收入",
    "transfer-out": "二次所得-其他部門-個人移轉-支出",
    "comp-in": "初次所得-薪資-收入",
    "comp-out": "初次所得-薪資-支出",
}
TW_BOP = list(TW_BOP_KEYS.values())


def _sum(a: Series, b: Series) -> Series:
    """兩個序列都有的年份相加（個人移轉的支出 1984–1986 年是「-」，那幾年不算）"""
    return {y: a[y] + b[y] for y in a if y in b}


# 多邊機構的合計與子機構（AGENCIES 已經用了上一層或下一層，不重複算）
AGENCY_GROUPS = {
    "1UN0", "9OTH0", "5RDB0", "5WBG0", "5WB0", "4EU002", "4EU003", "4EU004", "4EU999",
    "5IMF01", "5IMF02", "5IMF03", "5AFDB001", "5AFDB002", "5ASDB01", "5ASDB02", "5IDB001", "5IDB002", "5IDB003",
}


def _agency_like(code: str) -> bool:
    """看起來是多邊機構的代碼（聯合國、歐盟、國際貨幣基金、開發銀行、其他多邊組織），用來找出還沒有中文名稱的"""
    return code[:3] in ("1UN", "4EU") or code[:2] in ("5W", "5I", "5A", "5R") or code[:4] == "9OTH"


def _ranges(years) -> tuple[str, str]:
    """[1988, 1989, …, 1998, 2004, …] → ("1988–1998、2004–2025", "1988–1998 and 2004–2025")"""
    runs: list[list[int]] = []
    for y in sorted(years):
        if runs and y == runs[-1][1] + 1:
            runs[-1][1] = y
        else:
            runs.append([y, y])
    parts = [f"{a}–{b}" if a != b else f"{a}" for a, b in runs]
    return "、".join(parts), (" and ".join(parts) if len(parts) <= 2 else ", ".join(parts[:-1]) + " and " + parts[-1])


def _write_flows(year: int, pairs: dict, off: list) -> set[str]:
    """一年的流向檔；回傳用到的多邊機構代碼。數值存成千美元的整數（scale 1000 → 美元）。"""
    export: dict[str, dict[str, float]] = defaultdict(dict)
    imports: dict[str, dict[str, float]] = defaultdict(dict)
    agencies: dict[str, dict[str, float]] = defaultdict(dict)
    totals_export: dict[str, float] = {}
    totals_import: dict[str, float] = {}
    totals_multi: dict[str, float] = {}
    for (donor, recipient), s in pairs.items():
        v = s.get(year)
        if v is None:
            continue
        d_iso, r_iso = to_iso3(donor), to_iso3(recipient)
        if d_iso and recipient == "DPGC":
            totals_export[d_iso] = v
        elif donor == "ALLD" and r_iso:
            totals_import[r_iso] = v
        elif donor == "ALLM" and r_iso:
            totals_multi[r_iso] = v
        elif d_iso and r_iso and d_iso != r_iso:
            export[d_iso][r_iso] = v
            imports[r_iso][d_iso] = v
        elif donor in AGENCIES and r_iso:
            agencies[r_iso][donor] = v

    def ranked(partners: dict[str, float], n: int) -> list[list]:
        top = sorted(((p, v) for p, v in partners.items() if v > 0), key=lambda kv: -kv[1])[:n]
        return [[p, round(v * 1000)] for p, v in top if round(v * 1000) > 0]

    data: dict[str, object] = {"item": "aid", "year": year, "unit": "千美元", "scale": 1000}
    data["export"] = {
        c: [round(totals_export.get(c, sum(p.values())) * 1000), r]
        for c, p in sorted(export.items()) if (r := ranked(p, TOP_N))
    }
    data["import"] = {
        c: [round(totals_import.get(c, sum(p.values())) * 1000), r]
        for c, p in sorted(imports.items()) if (r := ranked(p, TOP_N))
    }
    # 援助國沒有分到特定國家的（區域計畫、在捐助國境內的難民支出、行政費用…）：總額減掉給所有國家的
    data["unspecified"] = {
        c: u for c, total in sorted(totals_export.items())
        if (u := round((total - sum(export.get(c, {}).values())) * 1000)) > 0
    }
    data["multilateral"] = {
        c: [round(totals_multi.get(c, sum(p.values())) * 1000), r]
        for c, p in sorted(agencies.items()) if (r := ranked(p, TOP_AGENCIES))
    }
    for c, p in agencies.items():
        total = totals_multi.get(c)
        if total and total > 1 and abs(sum(p.values()) - total) > abs(total) * 0.01:
            off.append((year, c, round(sum(p.values()), 1), round(total, 1)))
    write_json(OUT / "flows" / f"{year}.json", data, quiet=True)
    return {code for c in data["multilateral"].values() for code, _ in c[1]}
