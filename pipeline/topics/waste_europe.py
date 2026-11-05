"""都市垃圾的去處、焚化廠與掩埋場（2026-11-05，製作手冊第二十二批 389；步驟 waste-europe，輸出 topics/waste/，
前端 src/topics/waste-routes.ts 併在「廢棄物與回收」主題）。

- 歐洲各國：Eurostat env_wasmun（CC BY 4.0）的都市垃圾，1995–2024 年，每人每年公斤（unit=KG_HAB）：
  產生 GEN、掩埋與其他處置 DSP_L_OTH、焚化 DSP_I_RCV_E（不回收能源的 D10 加上回收能源的 R1；DSP_I 與 RCV_E 是它的兩個部分，
  不要再加）、回收 RCY（物質回收 RCY_M、堆肥與厭氧消化 RCY_C_D，加上準備再使用）。各項加起來不一定等於產生量
  （出口、庫存、統計差），比例的分母用處理總量 TRT。
  Eurostat 的條款：歐盟、EFTA、候選國以外的資料只准非商業使用，科索沃（潛在候選國）不收；這個資料集已經沒有英國。
  喬治亞只有 TRT，沒有分項，畫不出來。
- 台灣：環境部「全國一般廢棄物處理量」（STAT_P_128，政府資料開放授權條款，民國 110 年起）的回收再利用、焚化、衛生掩埋、
  其他處理量；產生量用「一般廢棄物清理情況資料」（STAT_P_45，各縣市加總）。人口用聯合國 WPP 2024。
  台灣的「回收再利用」含資源回收、廚餘與巨大垃圾再利用，跟歐洲的「回收」（物質回收、堆肥、厭氧消化）口徑不同，
  使用者決定照畫（2026-11-05），附註寫明；台灣沒有分物質回收與堆肥。產生量 2018 年起含事業員工生活垃圾（廢棄物清理法的
  定義修正），之前的年份不畫。
- 台灣各縣市的一般廢棄物回收率：環境部 STAT_P_46（民國 100 年起），側欄用。
- 台灣的垃圾焚化廠：環境部「焚化廠基本資料」（FAC_S_01，27 座）只有地址，位置用 OpenStreetMap 上同一座廠的物件
  （TW_INCINERATORS 一座一座對過名稱與地址）。發電廠地圖（GEM，20 MW 以上）也有幾座焚化廠，是另一個主題，不會疊在一起。
- 掩埋場：OpenStreetMap 的 landuse=landfill（經 QLever，ODbL 1.0）。OSM 的掩埋場同時在量各國畫得多完整，也有人拿來標
  土方、廢土堆置場，只畫點、不算每百萬人。
"""
from __future__ import annotations

import re

from common import OUT_DIR, indicator_file, to_series, write_json, write_layered_points, points_file
from sources import eurostat, moenv, osm_qlever, wpp

OUT = OUT_DIR / "topics" / "waste"
EXCLUDED = {"XKX"}  # Eurostat：歐盟、EFTA、候選國以外只准非商業
WITHIN = 3
ROUTES = {
    "generated": "GEN",
    "landfilled": "DSP_L_OTH",
    "incinerated": "DSP_I_RCV_E",
    "recycled": "RCY",
    "material": "RCY_M",
    "composted": "RCY_C_D",
}
TW_FIRST = 2018  # 產生量的定義修正（含事業員工生活垃圾）
TW_BREAKDOWN = "STAT_P_128"
TW_RATES = "STAT_P_46"
INCINERATORS = "FAC_S_01"

# 環境部焚化廠（FAC_S_01 的 _id）→ OSM 上同一座廠（名稱、地址逐一對過；2026-11-05 的 QLever 查詢）
TW_INCINERATORS = {
    1: "relation/16129356",  # 木柵垃圾焚化廠
    2: "way/300909121",  # 內湖垃圾焚化廠
    3: "way/188843193",  # 北投焚化爐
    4: "way/300909119",  # 台中市垃圾資源回收廠（南屯區文山）
    5: "way/163191816",  # 城西垃圾焚化廠
    6: "way/210772592",  # 中區資源回收廠
    7: "way/208065322",  # 南區資源回收廠
    8: "way/189784502",  # 新店垃圾焚化廠
    9: "way/235149503",  # 樹林焚化爐
    10: "way/665170366",  # 桃園市南區垃圾焚化廠（中壢區松江北路）
    11: "way/300909125",  # 利澤垃圾焚化廠
    12: "way/300909123",  # 嘉義市垃圾焚化廠
    13: "way/300909120",  # 臺中市烏日垃圾資源回收廠
    14: "way/427745975",  # 后里垃圾焚化廠
    15: "way/221639524",  # 天外天垃圾焚化廠
    16: "way/265765731",  # 溪州垃圾資源回收場（溪州焚化爐）
    17: "way/1229242331",  # 新竹市垃圾焚化廠
    18: "way/211599907",  # 岡山垃圾資源回收廠
    19: "relation/11041623",  # 仁武焚化爐
    20: "way/272297699",  # 崁頂垃圾資源回收廠
    21: "way/300909124",  # 八里垃圾焚化廠
    22: "way/222486466",  # 鹿草焚化爐
    23: "way/442006486",  # 苗栗縣垃圾焚化廠（竹南鎮）
    24: "way/163120819",  # 台南永康垃圾資源回收(焚化)廠
    25: "way/300909122",  # 台東縣垃圾資源回收廠
    26: "way/1004258192",  # 桃園市生質能中心
    27: "way/967511425",  # 新竹縣垃圾焚化廠（竹北市西濱路，興建中）
}
OWNERSHIP = {"公有公營": 0, "公有民營": 1, "民有民營": 2}


def _number(text: str) -> float | None:
    text = (text or "").replace(",", "").replace("%", "").strip()
    return float(text) if re.fullmatch(r"-?\d+(\.\d+)?", text) else None


def _taiwan_breakdown() -> dict[int, dict[str, float]]:
    """環境部的全年處理量（公噸）：{年: {total, recycled, incinerated, landfilled, other}}"""
    out: dict[int, dict[str, float]] = {}
    for row in moenv._dataset(TW_BREAKDOWN):
        year = moenv._roc_year(row["item1"])
        if year is None:
            continue  # 月資料
        values = [_number(row[f"value{i}"]) for i in range(1, 6)]
        if values[0] is None:
            raise RuntimeError(f"{TW_BREAKDOWN} {year} 年沒有總處理量")
        total, recycled, incinerated, landfilled, other = (v or 0.0 for v in values)
        if abs(total - recycled - incinerated - landfilled - other) > 10:
            raise RuntimeError(f"{TW_BREAKDOWN} {year} 年的總處理量不等於各項合計，欄位可能改了")
        out[year] = {"total": total, "recycled": recycled, "incinerated": incinerated, "landfilled": landfilled, "other": other}
    if not out or min(out) > 2021:
        raise RuntimeError(f"{TW_BREAKDOWN} 讀不到年資料")
    return dict(sorted(out.items()))


def _taiwan_rates() -> tuple[list[int], dict[str, list[float | None]]]:
    by_county: dict[str, dict[int, float]] = {}
    for row in moenv._dataset(TW_RATES):
        value = _number(row["municipal_waste_recycling_rate"])
        year = moenv._roc_year(row["year"])
        if value is not None and year is not None:
            by_county.setdefault(row["county"].replace("台", "臺"), {})[year] = value
    years = sorted({y for s in by_county.values() for y in s})
    if len(by_county) != 22:
        raise RuntimeError(f"{TW_RATES} 應該有 22 縣市，讀到 {len(by_county)}")
    return years, {c: [s.get(y) for y in years] for c, s in sorted(by_county.items())}


def _incinerators() -> list[dict]:
    rows = {int(r["_id"]): r for r in moenv._dataset(INCINERATORS)}
    if set(rows) != set(TW_INCINERATORS):
        raise RuntimeError(f"{INCINERATORS} 的廠跟對照表不同：多了 {set(rows) - set(TW_INCINERATORS)}，少了 {set(TW_INCINERATORS) - set(rows)}")
    found = osm_qlever.query(f"""SELECT ?x ?name ?wkt WHERE {{
  {osm_qlever.COUNTRIES}
  FILTER(?iso = "TW")
  ?x osmkey:name ?name ; geo:hasGeometry/geo:asWKT ?wkt .
  FILTER(REGEX(?name, "焚化|資源回收廠|再生能源中心|生質能中心"))
}}""", "tw-incinerator-names")
    wkt = {"/".join(r["x"]["value"].rsplit("/", 2)[-2:]): r["wkt"]["value"] for r in found}
    out = []
    for fid, osm in TW_INCINERATORS.items():
        row = rows[fid]
        if osm not in wkt:
            raise RuntimeError(f"OSM 找不到 {row['icnrtname']}（{osm}），可能被改名或刪除")
        lon, lat = osm_qlever.centroid(wkt[osm])
        opened = re.match(r"(\d{4})年", row["opendate"] or "")
        out.append({
            "lon": lon, "lat": lat, "n": row["icnrtname"].strip(), "cap": _number(row["dsnprcqt"]),
            "mw": _number(row["dsneleqt"]), "y": int(opened.group(1)) if opened else None,
            "own": OWNERSHIP[row["weptype"].strip()], "osm": osm,
        })
    return out


def build() -> None:
    raw = {key: eurostat.series("env_wasmun", freq="A", wst_oper=op, unit="KG_HAB") for key, op in ROUTES.items()}
    treated = eurostat.series("env_wasmun", freq="A", wst_oper="TRT", unit="KG_HAB")
    kg = {key: {c: s for c, s in series.items() if c not in EXCLUDED} for key, series in raw.items()}
    share = {
        key: {
            c: {y: v / treated[c][y] * 100 for y, v in s.items() if treated.get(c, {}).get(y)}
            for c, s in kg[key].items()
        }
        for key in ROUTES if key != "generated"
    }

    tw = _taiwan_breakdown()
    generated = {y: v["generated"] for y, v in moenv.municipal_waste().items() if y >= TW_FIRST}
    last = max(max(tw), max(generated))
    pop = {y: v * 1000 for y, v in wpp.demographic(["TPopulation1July"], last_year=last)["TPopulation1July"]["TWN"].items()}
    kg["generated"]["TWN"] = {y: v / pop[y] * 1000 for y, v in generated.items()}
    for key in ("landfilled", "incinerated", "recycled"):
        kg[key]["TWN"] = {y: v[key] / pop[y] * 1000 for y, v in tw.items()}
        share[key]["TWN"] = {y: v[key] / v["total"] * 100 for y, v in tw.items()}

    latest_tw = max(tw)
    tw_note = {
        "zh": (f"台灣是環境部的一般廢棄物處理量（{min(tw)} 年起）：「回收再利用」含資源回收、廚餘與巨大垃圾再利用，"
               "跟歐洲的回收（物質回收、堆肥、厭氧消化）口徑不同；另有少量「其他處理」"
               f"（{latest_tw} 年 {tw[latest_tw]['other'] / tw[latest_tw]['total'] * 100:.1f}%）。人口用聯合國 WPP 2024。"),
        "en": (f"Taiwan’s figures are the Ministry of Environment’s municipal waste treatment amounts (from {min(tw)}): "
               "“recycled” includes recyclables, food waste and reused bulky waste, a broader scope than Europe’s recycling "
               "(material recycling, composting and digestion); a small amount is “other treatment” "
               f"({tw[latest_tw]['other'] / tw[latest_tw]['total'] * 100:.1f}% in {latest_tw}). Population from UN WPP 2024."),
    }
    gen_note = {
        "zh": (f"台灣是環境部的一般廢棄物產生量（各縣市加總）÷ 聯合國 WPP 2024 的人口；{TW_FIRST} 年起含事業員工的生活垃圾"
               "（廢棄物清理法的定義修正），之前的年份口徑不同，沒有畫。"),
        "en": (f"Taiwan: the Ministry of Environment’s municipal waste generated (sum of cities and counties) divided by "
               f"UN WPP 2024 population. From {TW_FIRST}, waste from employees at businesses is included under the revised "
               "definition, so earlier years are not shown."),
    }
    no_split = {
        "zh": "環境部的處理量沒有分物質回收與堆肥（回收再利用含資源回收、廚餘與巨大垃圾再利用）",
        "en": "Taiwan’s treatment statistics do not split material recycling from composting",
    }

    years = list(range(1995, last + 1))
    for key, series in kg.items():
        extra: dict = {"latestWithin": WITHIN}
        if key in ("material", "composted"):
            extra |= {"noValue": {"TWN": no_split["zh"]}, "noValueEn": {"TWN": no_split["en"]}}
        else:
            note = gen_note if key == "generated" else tw_note
            extra |= {"notes": {"TWN": note["zh"]}, "notesEn": {"TWN": note["en"]}}
        write_json(OUT / "routes" / f"{key}.json", indicator_file(
            f"routes-{key}", "公斤/人/年", years, {c: to_series(s, years, 1) for c, s in sorted(series.items())}, **extra,
        ), quiet=True)
        if key in share:
            write_json(OUT / "routes-share" / f"{key}.json", indicator_file(
                f"routes-share-{key}", "%", years, {c: to_series(s, years, 1) for c, s in sorted(share[key].items())},
                **extra,
            ), quiet=True)
        top = sorted(((c, max(s), s[max(s)]) for c, s in series.items()), key=lambda t: -t[2])
        print(f"  {key}：{len(series)} 國；最多 {[(c, y, round(v)) for c, y, v in top[:5]]}；最少 {[(c, y, round(v)) for c, y, v in top[-3:]]}；"
              f"台灣 {({y: round(v) for y, v in series['TWN'].items()} if 'TWN' in series else None)}")

    # 側欄：各國的去處（每人公斤），台灣的縣市回收率
    detail_countries = {}
    for c in sorted(kg["landfilled"]):
        if c == "TWN":
            continue
        rows = {key: to_series(kg[key].get(c, {}), years, 1) for key in ROUTES}
        other = [
            None if r is None else round(max(r - (m or 0) - (k or 0), 0), 1)
            for r, m, k in zip(rows["recycled"], rows["material"], rows["composted"])
        ]
        detail_countries[c] = {**{k: v for k, v in rows.items() if k != "recycled"}, "otherRecycled": other}
    rate_years, rates = _taiwan_rates()
    write_json(OUT / "routes-detail.json", {
        "years": years,
        "countries": detail_countries,
        "taiwan": {
            "years": sorted(tw),
            "landfilled": [round(tw[y]["landfilled"] / pop[y] * 1000, 1) for y in sorted(tw)],
            "incinerated": [round(tw[y]["incinerated"] / pop[y] * 1000, 1) for y in sorted(tw)],
            "recycled": [round(tw[y]["recycled"] / pop[y] * 1000, 1) for y in sorted(tw)],
            "other": [round(tw[y]["other"] / pop[y] * 1000, 1) for y in sorted(tw)],
            "rateYears": rate_years,
            "rates": rates,
        },
    })
    latest_rates = {c: s[-1] for c, s in rates.items()}
    print(f"  台灣 {rate_years[-1]} 年縣市回收率：最高 {sorted(latest_rates.items(), key=lambda kv: -(kv[1] or 0))[:3]}；"
          f"最低 {sorted(latest_rates.items(), key=lambda kv: kv[1] or 0)[:2]}")

    plants = _incinerators()
    write_json(OUT / "incinerators-tw.json", points_file(
        [{k: v for k, v in p.items() if k != "osm"} for p in plants],
        ["lon", "lat", "n", "cap", "mw", "y", "own"], {"lon": 0.0001, "lat": 0.0001, "mw": 0.01, "cap": 1, "y": 1, "own": 1},
    ))
    print(f"  台灣焚化廠 {len(plants)} 座；設計處理量合計 {sum(p['cap'] or 0 for p in plants):,.0f} 公噸/日、"
          f"發電 {sum(p['mw'] or 0 for p in plants):,.1f} MW；未營運 {[p['n'] for p in plants if p['y'] is None]}")

    rows, seen = [], set()
    for r in osm_qlever.features("landuse", "landfill", extra=("name",)):
        if r["osm"] in seen:
            continue
        seen.add(r["osm"])
        c = osm_qlever.centroid(r["wkt"])
        if c:
            rows.append({"lon": c[0], "lat": c[1], "iso3": r["iso3"], "n": r["name"]})
    rows.sort(key=lambda p: (p["iso3"], p["lon"]))
    write_layered_points(
        OUT / "landfills.json", rows, lambda r: bool(r["n"]), ["lon", "lat", "iso3", "n"],
        {"lon": 0.0001, "lat": 0.0001}, strings=("iso3",),
    )
    by_country: dict[str, int] = {}
    for r in rows:
        by_country[r["iso3"]] = by_country.get(r["iso3"], 0) + 1
    print(f"  OSM 掩埋場 {len(rows):,} 個、{len(by_country)} 國；{sorted(by_country.items(), key=lambda kv: -kv[1])[:8]}；"
          f"台灣 {by_country.get('TWN')}、日本 {by_country.get('JPN')}")
