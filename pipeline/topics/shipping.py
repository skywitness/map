"""航運與港口主題：貨櫃吞吐量、班輪航運連結指數、商船隊（船旗國與實質船東）、造船，以及世界港口的點。

資料：
- UNCTAD Data Hub（UNCTADstat，sources/unctadstat.py，CC BY 3.0 IGO）：
  - 貨櫃吞吐量（US.ContPortThroughput）：各國港口裝卸的貨櫃，TEU，2010–2024 年。轉運櫃在中轉港算兩次（卸、裝各一次）。
  - 班輪航運連結指數 LSCI（US.LSCI）：每季一筆（2023 年第 1 季的平均 = 100），這裡取每年各季的平均；
    最新一年（2026）只有第 1–3 季。
  - 商船隊，依船旗國（US.MerchantFleet）：在各國登記的 100 總噸以上商船的載重噸（dwt），1980–2026 年（每年 1 月 1 日），
    側欄有船種（油輪、散裝船、雜貨船、貨櫃船、其他）。
  - 商船隊，依實質船東所在國（US.FleetBeneficialOwners）：1,000 總噸以上的商船，2014–2026 年；側欄有這些船掛哪國的旗
    （UNCTAD 只列出 28 個主要船旗國，其餘併成「其他」）。
  - 造船（US.ShipBuilding）：各國當年交船的總噸（GT），2014–2025 年。
  - 港口的班輪航運連結指數 PLSCI（US.PLSCI）：900 多個貨櫃港，每季一筆，畫在港口的點上（最新一季）。
  - UNCTAD 的底層資料來自商業資料庫（船隊是 Clarksons Research、LSCI 是 MDS Transmodal），UNCTAD 把算好的彙總數字
    放在 Data Hub 以 CC BY 3.0 IGO 公開，這裡只用這些彙總數字。
  - 「China, Taiwan Province of」（M49 158）是台灣，ISO 代碼 TWN，地圖上照其他主題寫「台灣」。
- 港口的點：NGA World Port Index（sources/wpi.py，美國政府的公有領域資料），3,807 個港口的大小與類型。
- 主要貨櫃港自己公布的 2025 年吞吐量（sources/port_teu.py，引用事實並註明出處），台灣四個國際商港用臺灣港務公司的
  開放資料（sources/tipc.py，政府資料開放授權條款）。
- 航運密度的網格圖磚另外在部署時產生（topics/shipping_density_tiles.py）。

輸出（public/data/topics/shipping/）：container.json、lsci.json、fleet-flag.json、fleet-owner.json、shipbuilding.json、
ports.json（點）、countries/<ISO3>.json（側欄的明細）、manifest.json。
"""
from __future__ import annotations

import re
import statistics
import unicodedata
from collections import defaultdict

from common import OUT_DIR, compact_indicator, indicator_file, now_iso, points_file, to_series, write_json
from sources import port_teu, tipc, unctadstat, wpi
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "shipping"
TAIWAN = "TWN"
WORLD = unctadstat.WORLD

Series = dict[int, float]

# 船種（US.MerchantFleet 的 ShipType）→ 側欄的鍵
SHIP_TYPES = {"1": "oil", "2": "bulk", "3": "general", "4": "container", "5": "other"}
# 實質船東資料表的船旗：全部、外國旗、本國旗
ALL_FLAGS, FOREIGN_FLAG, NATIONAL_FLAG = "0000", "0000u", "C00001"
TOP_OWNERS = 10  # 側欄列出船旗國的前幾名船東國

# PLSCI 的港口代碼（UN/LOCODE）跟 World Port Index 對不上的大港：WPI 用舊的代碼或沒有代碼
PLSCI_TO_WPI = {
    "CNSHA": 59970,  # 上海（WPI 是 CNSGH）
    "CNNGB": 59940,  # 寧波（CNNBO）
    "SGSIN": 50000,  # 新加坡（WPI 分成幾個港區，吉寶港區是主要的）
    "CNTAO": 60140,  # 青島（CN QIN）
    "CNNSA": 57830,  # 南沙（WPI 沒有，畫在廣州）
    "CNXMN": 57870,  # 廈門（CN XMG）
    "CNXGG": 60190,  # 天津新港（CN TXG）
    "CNDLC": 60250,  # 大連（CN DAL）
    "TRPAM": 43388,  # 安巴利（TR AMR）
    "USNFF": 8280,  # 諾福克（US ORF）
    "USHKA": 9240,  # 休士頓（US HOU）
    "JPHTD": 62430,  # 博多（JP HKT）
    "USKND": 16340,  # 奧克蘭（US OAK）
    "USPDP": 8110,  # 費城（US PHL）
    "USIJX": 8580,  # 傑克森維爾（US JAX）
    "MYPGU": 49982,  # 巴西古當（WPI 叫 Johor）
    "NGAPP": 46130,  # 阿帕帕（拉哥斯）
    "IEDUB": 34480,  # 都柏林（IE MTL）
}
# 名稱比對時不算的字（WPI 的「Qingdao Gang」「Tokyo Ko」跟 PLSCI 的「Qingdao」「Tokyo」是同一個港）
NAME_NOISE = {"gang", "ko", "kang", "port", "harbor", "harbour", "of", "mina", "puerto", "porto", "terminal"}


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    tw_ports = tipc.annual()
    container = container_throughput(tw_ports)
    lsci()
    fleet = merchant_fleet()
    owners = beneficial_owners()
    shipbuilding()
    ports = port_points(tw_ports)
    details(fleet, owners, ports, tw_ports)
    write_json(
        OUT / "manifest.json",
        {
            "topic": "shipping",
            "generatedAt": now_iso(),
            "sources": [
                "UNCTAD Data Hub (UNCTADstat): US.ContPortThroughput, US.LSCI, US.PLSCI, US.MerchantFleet, "
                "US.FleetBeneficialOwners, US.ShipBuilding (bulk downloads, 2026-10-26). "
                "Source: United Nations Trade and Development Data Hub, CC BY 3.0 IGO.",
                "National Geospatial-Intelligence Agency, World Port Index (Pub. 150), UpdatedPub150.csv (public domain).",
                "Port authorities' own 2025 container throughput (pipeline/sources/port_teu.py).",
                "臺灣港務股份有限公司，臺灣地區國際商港貨櫃裝卸量（政府資料開放平臺 8368，政府資料開放授權條款第 1 版）。",
            ],
            "license": "CC BY 3.0 IGO (UNCTAD data); public domain (World Port Index)",
            "containerYears": container,
        },
    )


# ── 指標 ────────────────────────────────────────────


# 已經不存在、沒有 ISO 代碼的經濟體（捷克斯洛伐克、東西德、蘇聯、南斯拉夫、2011 年以前的蘇丹…），UNCTAD 的歷史資料才有
HISTORICAL = {"200", "230", "278", "280", "530", "590", "720", "736", "810", "886", "890", "891", "960"}


def by_economy(rows: list[dict[str, str]], value_col: str, year_col: str = "Year", **match: str) -> tuple[
    dict[str, Series], Series, dict[str, list[int]]
]:
    """(各國 {iso3: {年: 值}}, 世界 {年: 值}, 有「Estimated」註記的 {iso3: [年…]})；match 是其他欄位要等於的值"""
    out: dict[str, Series] = defaultdict(dict)
    world: Series = {}
    estimated: dict[str, list[int]] = defaultdict(list)
    unknown: set[tuple[str, str]] = set()
    foot = f"{value_col} Footnote"
    for r in rows:
        if any(r[k] != v for k, v in match.items()):
            continue
        v = unctadstat.number(r[value_col])
        if v is None:
            continue
        year = int(r[year_col])
        code = r["Economy"]
        if code == WORLD:
            world[year] = v
        elif iso3 := unctadstat.iso3(code):
            out[iso3][year] = v
            if r.get(foot) == "Estimated":
                estimated[iso3].append(year)
        elif len(code) == 3:
            unknown.add((code, r["Economy Label"]))
    if unknown := {u for u in unknown if u[0] not in HISTORICAL}:
        raise ValueError(f"UNCTAD 的經濟體對不到 ISO 代碼：{sorted(unknown)}")
    return dict(out), world, dict(estimated)


def taiwan_check(unctad: Series, official: Series, what: str) -> None:
    """UNCTAD 的台灣跟臺灣港務公司的開放資料要一致（附註寫「相差不到 0.1%」，2010–2024 年最多差 0.02%）"""
    for y, v in unctad.items():
        o = official.get(y)
        if o and abs(v - o) / o > 0.001:
            raise ValueError(f"{what}：{y} 年 UNCTAD 的台灣 {v:,.0f} 跟臺灣港務公司的 {o:,.0f} 差太多")


def container_throughput(tw_ports: dict[str, Series]) -> list[int]:
    rows = unctadstat.rows("US.ContPortThroughput")
    series, world, estimated = by_economy(rows, "TEU (Twenty foot Equivalent Unit)")
    years = sorted({y for s in series.values() for y in s})
    tw_total = tw_ports[tipc.TOTAL]
    taiwan_check(series[TAIWAN], tw_total, "貨櫃吞吐量")
    last_tw = max(tw_total)
    notes: dict[str, str] = {}
    notes_en: dict[str, str] = {}
    for iso3, ys in estimated.items():
        span = "、".join(str(y) for y in sorted(ys))
        notes[iso3] = f"{span} 年是 UNCTAD 的估計值。"
        notes_en[iso3] = f"{', '.join(str(y) for y in sorted(ys))}: UNCTAD estimate."
    tw_y = max(series[TAIWAN])
    notes[TAIWAN] = (
        f"UNCTAD 的台灣（「China, Taiwan Province of」）跟臺灣港務公司公布的國際商港合計一致（各年相差不到 0.1%；"
        f"{tw_y} 年臺灣港務公司是 {tw_total[tw_y]:,.0f} TEU）。{last_tw} 年臺灣港務公司公布 {tw_total[last_tw]:,.0f} TEU"
        f"（UNCTAD 還沒有這一年），高雄港占 {tw_ports['高雄港'][last_tw] / tw_total[last_tw]:.0%}。"
    )
    notes_en[TAIWAN] = (
        f"UNCTAD’s figure for Taiwan (“China, Taiwan Province of”) matches the total for the international commercial ports "
        f"published by Taiwan International Ports Corporation (within 0.1% every year; {tw_total[tw_y]:,.0f} TEU in {tw_y}). For {last_tw} the "
        f"corporation reports {tw_total[last_tw]:,.0f} TEU (not yet in UNCTAD), {tw_ports['高雄港'][last_tw] / tw_total[last_tw]:.0%} "
        f"of it at Kaohsiung."
    )
    china_zh = "UNCTAD 的中國不含香港、澳門與台灣（各自分開列）。"
    china_en = "UNCTAD’s China excludes Hong Kong, Macao and Taiwan, which are listed separately."
    notes["CHN"] = china_zh + notes.get("CHN", "")
    notes_en["CHN"] = china_en + (" " + notes_en["CHN"] if "CHN" in notes_en else "")
    values = {iso3: to_series(s, years, 0) for iso3, s in series.items()}
    write_json(OUT / "container.json", indicator_file(
        "container", "TEU", years, values,
        aggregates={"WLD": to_series(world, years, 0)}, notes=notes, notesEn=notes_en,
    ))
    top = sorted(series, key=lambda k: -series[k].get(years[-1], 0))[:5]
    print(f"  貨櫃吞吐量 {years[0]}–{years[-1]}：{len(values)} 國；{years[-1]} 年前 5 名 {top}，"
          f"台灣 {series[TAIWAN][years[-1]]:,.0f} TEU（臺灣港務公司 {last_tw} 年 {tw_total[last_tw]:,.0f}）")
    return years


def lsci() -> None:
    rows = unctadstat.rows("US.LSCI")
    col = "Index (average Q1 2023 = 100)"
    quarterly: dict[str, dict[int, list[float]]] = defaultdict(lambda: defaultdict(list))
    quarters: dict[int, set[str]] = defaultdict(set)
    for r in rows:
        v = unctadstat.number(r[col])
        iso3 = unctadstat.iso3(r["Economy"])
        if v is None or not iso3:
            continue
        year = int(r["Quarter"][:4])
        quarterly[iso3][year].append(v)
        quarters[year].add(r["Quarter"][4:])
    years = sorted(quarters)
    partial = [y for y in years if len(quarters[y]) < 4]
    if partial != [years[-1]]:
        raise ValueError(f"LSCI 只有最新一年可以不到 4 季：{ {y: sorted(quarters[y]) for y in partial} }")
    values = {
        iso3: to_series({y: round(statistics.fmean(v), 1) for y, v in by_year.items()}, years)
        for iso3, by_year in quarterly.items()
    }
    last = years[-1]
    write_json(OUT / "lsci.json", indicator_file(
        "lsci", "指數", years, values, partialYear={"year": last, "quarters": len(quarters[last])},
    ))
    tw = statistics.fmean(quarterly[TAIWAN][last])
    print(f"  LSCI {years[0]}–{last}（{last} 年 {len(quarters[last])} 季）：{len(values)} 國；台灣 {last} 年 {tw:.1f}")


def merchant_fleet() -> dict[str, dict[str, Series]]:
    """各國船旗的船隊（千載重噸）：回傳 {iso3: {船種: {年: 值}}}，指標檔用總計（載重噸）"""
    rows = unctadstat.rows("US.MerchantFleet")
    col = "Dead weight tons in thousands"
    total, world, _ = by_economy(rows, col, ShipType="0")
    years = sorted({y for s in total.values() for y in s})
    by_type: dict[str, dict[str, Series]] = defaultdict(dict)
    for code, key in SHIP_TYPES.items():
        s, _, _ = by_economy(rows, col, ShipType=code)
        for iso3, by_year in s.items():
            by_type[iso3][key] = by_year
    breaks: dict[str, list[int]] = defaultdict(list)
    for r in rows:
        if r["ShipType"] == "0" and r[f"{col} Footnote"] == "Break" and (iso3 := unctadstat.iso3(r["Economy"])):
            breaks[iso3].append(int(r["Year"]))
    notes = {k: f"{'、'.join(map(str, sorted(v)))} 年 UNCTAD 標示統計有斷層（跟前一年不完全可比）。" for k, v in breaks.items()}
    notes_en = {k: f"UNCTAD marks a break in series in {', '.join(map(str, sorted(v)))}." for k, v in breaks.items()}
    values = {iso3: to_series({y: v * 1000 for y, v in s.items()}, years, 0) for iso3, s in total.items()}
    write_json(OUT / "fleet-flag.json", indicator_file(
        "fleet-flag", "載重噸", years, values,
        aggregates={"WLD": to_series({y: v * 1000 for y, v in world.items()}, years, 0)},
        notes=notes, notesEn=notes_en,
    ))
    last = years[-1]
    top = sorted(total, key=lambda k: -total[k].get(last, 0))[:5]
    print(f"  船隊（船旗國）{years[0]}–{last}：{len(values)} 國；{last} 年前 5 名 {top}；台灣 {total[TAIWAN][last]:,.0f} 千載重噸；"
          f"斷層 {dict(breaks)}")
    return by_type


def beneficial_owners() -> dict:
    """實質船東所在國的船隊（千載重噸）：指標檔用「所有船旗」的合計；回傳最新一年的船東 × 船旗矩陣給側欄"""
    rows = unctadstat.rows("US.FleetBeneficialOwners")
    col = "Dead weight tons in thousands"
    total: dict[str, Series] = defaultdict(dict)
    world: Series = {}
    unknown: set[tuple[str, str]] = set()
    for r in rows:
        if r["FlagOfRegistration"] != ALL_FLAGS:
            continue
        v = unctadstat.number(r[col])
        if v is None:
            continue
        code, year = r["BeneficialOwnership"], int(r["Year"])
        if code == WORLD:
            world[year] = v
        elif iso3 := unctadstat.iso3(code):
            total[iso3][year] = v
        elif len(code) != 4:
            unknown.add((code, r["BeneficialOwnership Label"]))
    if unknown:
        print(f"  （實質船東沒收的代碼：{sorted(unknown)}）")
    years = sorted({y for s in total.values() for y in s})
    last = years[-1]
    values = {iso3: to_series({y: v * 1000 for y, v in s.items()}, years, 0) for iso3, s in total.items()}
    write_json(OUT / "fleet-owner.json", indicator_file(
        "fleet-owner", "載重噸", years, values,
        aggregates={"WLD": to_series({y: v * 1000 for y, v in world.items()}, years, 0)},
    ))
    # 最新一年：船東國 → 船旗（千載重噸）
    matrix: dict[str, dict[str, float]] = defaultdict(dict)
    for r in rows:
        if int(r["Year"]) != last:
            continue
        v = unctadstat.number(r[col])
        owner = unctadstat.iso3(r["BeneficialOwnership"])
        if not v or not owner:
            continue
        flag = r["FlagOfRegistration"]
        key = flag if flag in (ALL_FLAGS, FOREIGN_FLAG, NATIONAL_FLAG) else unctadstat.iso3(flag)
        if key:
            matrix[owner][key] = v
    top = sorted(total, key=lambda k: -total[k].get(last, 0))[:5]
    print(f"  船隊（實質船東）{years[0]}–{last}：{len(values)} 國；{last} 年前 5 名 {top}；台灣 {total[TAIWAN][last]:,.0f} 千載重噸")
    return {"year": last, "matrix": matrix}


def shipbuilding() -> None:
    rows = unctadstat.rows("US.ShipBuilding")
    series, world, _ = by_economy(rows, "Gross Tonnage")
    years = sorted({y for s in series.values() for y in s})
    values = {iso3: to_series(s, years, 0) for iso3, s in series.items() if any(s.values())}
    write_json(OUT / "shipbuilding.json", indicator_file(
        "shipbuilding", "總噸", years, values, aggregates={"WLD": to_series(world, years, 0)},
    ))
    last = years[-1]
    top = sorted(series, key=lambda k: -series[k].get(last, 0))[:5]
    print(f"  造船 {years[0]}–{last}：{len(values)} 國；{last} 年前 5 名 {top}；台灣 {series[TAIWAN].get(last, 0):,.0f} 總噸")


# ── 港口 ────────────────────────────────────────────


def _norm(name: str) -> str:
    text = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    text = re.sub(r"\(.*?\)", " ", text)
    words = [w for w in re.split(r"[^a-z0-9]+", text) if w and w not in NAME_NOISE]
    return "".join(words)


def plsci_by_port(ports: list[wpi.Port]) -> tuple[dict[int, tuple[float, int]], str, int]:
    """最新一季的 PLSCI 對到 WPI 的港口：{WPI 編號: (指數, 名次)}、那一季、那一季有指數的港口數"""
    rows = unctadstat.rows("US.PLSCI")
    col = "Index (average Q1 2023 = 100)"
    quarter = max(r["Quarter"] for r in rows if r[col])
    latest = {r["Port"]: (float(r[col]), r["Port Label"]) for r in rows if r["Quarter"] == quarter and r[col]}
    ranked = sorted(latest, key=lambda p: -latest[p][0])
    rank = {p: i + 1 for i, p in enumerate(ranked)}

    by_locode = {p.locode: p for p in ports if p.locode}
    by_name: dict[tuple[str, str], list[wpi.Port]] = defaultdict(list)
    for p in ports:
        for n in [p.name, *p.alternate.split(";")]:
            if key := _norm(n):
                by_name[(p.iso3, key)].append(p)

    matched: dict[int, tuple[float, int, str]] = {}
    how = defaultdict(int)
    missed = []
    for code, (value, label) in latest.items():
        port = None
        if code in PLSCI_TO_WPI:
            port = next(p for p in ports if p.number == PLSCI_TO_WPI[code])
            how["對照表"] += 1
        elif code in by_locode:
            port = by_locode[code]
            how["UN/LOCODE"] += 1
        else:
            iso3 = from_alpha2(code[:2])
            candidates = {p.number: p for p in by_name.get((iso3, _norm(label.rsplit(", ", 1)[-1])), [])}
            if len(candidates) == 1:
                port = next(iter(candidates.values()))
                how["名稱"] += 1
        if port is None:
            missed.append((value, code, label))
            continue
        # 好幾個 PLSCI 港口對到同一個 WPI 港口（例如廣州與南沙）時留指數高的
        if port.number not in matched or matched[port.number][0] < value:
            matched[port.number] = (value, rank[code], code)
    missed.sort(reverse=True)
    print(f"  PLSCI {quarter}：{len(latest)} 個港口，對到 WPI {len(matched)} 個（{dict(how)}）；"
          f"對不到的前幾名 {[f'{c} {v:.0f}' for v, c, _ in missed[:8]]}")
    return {k: (v, r) for k, (v, r, _) in matched.items()}, quarter, len(latest)


def port_points(tw_ports: dict[str, Series]) -> list[dict]:
    ports = wpi.load()
    plsci, quarter, n_plsci = plsci_by_port(ports)
    numbers = {p.number for p in ports}
    teu = {t.wpi: t for t in port_teu.PORTS}
    if missing := set(teu) - numbers:
        raise ValueError(f"port_teu.py 的 WPI 編號不在 World Port Index 裡：{missing}")
    # 台灣四港的官方數字要跟臺灣港務公司的開放資料一樣
    for t in port_teu.PORTS:
        if t.publisher.startswith("臺灣港務公司"):
            official = tw_ports[f"{t.zh}"][t.year]
            if round(official) != t.teu:
                raise ValueError(f"{t.zh} {t.year} 年：port_teu.py 寫 {t.teu:,}，開放資料加總是 {official:,.0f}")

    rows = []
    for p in sorted(ports, key=lambda p: p.lon):
        cite = teu.get(p.number)
        zh, en = (cite.zh, cite.en) if cite else port_teu.NAMES.get(p.number, (None, None))
        value, rank = plsci.get(p.number, (None, None))
        rows.append({
            "lon": p.lon, "lat": p.lat, "name": p.name, "zh": zh, "en": en, "iso3": p.iso3,
            "size": p.size, "type": p.type, "box": 1 if p.container else None,
            "plsci": None if value is None else round(value), "prank": rank,
            "teu": cite.teu if cite else None, "teuYear": cite.year if cite else None,
            "scope": cite.scope or None if cite else None, "scopeEn": cite.scope_en or None if cite else None,
        })
    data = points_file(
        rows,
        ["lon", "lat", "name", "zh", "en", "iso3", "size", "type", "box", "plsci", "prank", "teu", "teuYear", "scope", "scopeEn"],
        {"lon": 0.001, "lat": 0.001, "size": 1, "type": 1, "box": 1, "plsci": 1, "prank": 1, "teu": 1, "teuYear": 1},
        delta=("lon",),
    )
    data["plsciQuarter"] = quarter
    data["plsciPorts"] = n_plsci
    write_json(OUT / "ports.json", data)
    print(f"  港口 {len(rows)} 個（大型 {sum(p.size == 4 for p in ports)}、中型 {sum(p.size == 3 for p in ports)}），"
          f"有 PLSCI {len(plsci)} 個、有官方吞吐量 {len(teu)} 個")
    return rows


# ── 側欄明細 ────────────────────────────────────────────


def details(fleet: dict[str, dict[str, Series]], owners: dict, ports: list[dict], tw_ports: dict[str, Series]) -> None:
    years = sorted({y for types in fleet.values() for s in types.values() for y in s})
    matrix: dict[str, dict[str, float]] = owners["matrix"]
    # 船旗國 → 各船東國（只有 UNCTAD 列出的 28 個船旗國）
    flag_owners: dict[str, dict[str, float]] = defaultdict(dict)
    for owner, flags in matrix.items():
        for flag, v in flags.items():
            if len(flag) == 3 and flag.isalpha():
                flag_owners[flag][owner] = v
    cites: dict[str, list[dict]] = defaultdict(list)
    for t in port_teu.PORTS:
        iso3 = next(p["iso3"] for p in ports if p["teu"] == t.teu and p["zh"] == t.zh)
        cites[iso3].append({
            "zh": t.zh, "en": t.en, "year": t.year, "teu": t.teu, "publisher": t.publisher, "publisherEn": t.publisher_en,
            "url": t.url, "published": t.published, "scope": t.scope, "scopeEn": t.scope_en, "rounded": t.rounded,
        })

    countries = set(fleet) | set(matrix) | set(flag_owners) | set(cites)
    for iso3 in sorted(countries):
        detail: dict[str, object] = {}
        if types := fleet.get(iso3):
            # 船種的載重噸（values，前端的 fetchJson 會還原差分編碼）
            detail["years"] = years
            detail["values"] = {
                k: to_series({y: v * 1000 for y, v in types.get(k, {}).items()}, years, 0) for k in SHIP_TYPES.values()
            }
        if flags := matrix.get(iso3):
            listed = {k: round(v) for k, v in flags.items() if len(k) == 3 and k.isalpha() and k != iso3 and v >= 0.5}
            detail["owner"] = {
                "year": owners["year"],
                "total": round(flags.get(ALL_FLAGS, 0)),
                "national": round(flags.get(NATIONAL_FLAG, 0)),
                "foreign": round(flags.get(FOREIGN_FLAG, 0)),
                "flags": sorted(listed.items(), key=lambda kv: -kv[1]),
            }
        if by_owner := flag_owners.get(iso3):
            ranked = sorted(((k, round(v)) for k, v in by_owner.items() if v >= 0.5), key=lambda kv: -kv[1])
            detail["flagOwners"] = {"year": owners["year"], "owners": ranked[:TOP_OWNERS],
                                    "rest": round(sum(v for _, v in ranked[TOP_OWNERS:]))}
        if iso3 in cites:
            detail["ports"] = sorted(cites[iso3], key=lambda c: -c["teu"])
        if iso3 == TAIWAN:
            tw_years = sorted(tw_ports[tipc.TOTAL])
            detail["taiwanPorts"] = {
                "years": tw_years,
                "total": [round(tw_ports[tipc.TOTAL][y]) for y in tw_years],
                "ports": {en: [round(tw_ports[zh].get(y, 0)) for y in tw_years] for zh, en in tipc.PORTS.items()},
                "source": tipc.INFO_URL,
            }
        if detail:
            write_json(OUT / "countries" / f"{iso3}.json", compact_indicator(detail) if "values" in detail else detail, quiet=True)
    print(f"  側欄明細：{len(countries)} 個檔（countries/）")
