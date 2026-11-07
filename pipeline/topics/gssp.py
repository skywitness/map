"""地質年代的「金釘子」（GSSP，全球界線層型剖面和點）（新主題，2026-11-07，製作手冊第二十七批 544，候選 1228；
步驟 gssp，輸出 topics/gssp/）。

資料：Wikidata（CC0，經 QLever）P31/P279* = Q37402（Global Boundary Stratotype Section and Point）的 88 個項目：
座標 P625、國家 P17、所在地 P131、界線兩側的地層單位 P527（例如「托阿爾階」與「阿連階」，GSSP 定義的是比較年輕的那一個
的底界）、各單位的起訖 P580／P582。國際地層委員會（ICS）自己的 GSSP 清單寫「all rights reserved」，不用。

- 界線的年代：兩側裡比較年輕的那一個單位的起點（P580）。Wikidata 的起訖多半照 ICS 2012–2020 年版的年代表，跟最新版可能
  差幾十萬年（例如達瑞威爾階的底記成 4.673 億年，2023 年版是 4.694 億年），說明寫明。
- 沒有 P527 的 7 個：4 個從 Wikidata 自己的其他欄位認得出來（Green Point 的 P4330「GSSP for the base of Tremadocian」、
  里奧阿爾戈斯的標籤「GSSP for the base of the Barremian」、Diabasbrottet 的描述「Floian GSSP」、Wetteldorf 的描述
  「boundary between Emsium … and Eifelium」）；2 個威爾斯的道路（Trefawr Track、Cefn-cerig Road）是埃隆階與特列奇階
  原本的金釘子，2024 年國際地層委員會把這兩條界線搬到捷克的 Hlásná Třebaň 與西班牙的 El Pintado（英文維基百科
  「Aeronian」revid 1318292949 引 ICS 的公告「Silurian Telychian and Aeronian stage GSSPs have been relocated」），
  Wikidata 新舊都收，這裡排除舊的；突尼西亞那一個（Q65946851）連名稱都沒有，是 El Kef 丹麥階金釘子列入世界遺產預備名單的
  項目（離 Q133886032 不到 5 公里）。
- 重複的項目：同一條界線、同一國、相距 20 公里內的算同一個金釘子，留有 P527 的那一個（加拿大的特馬豆克階、瑞典的弗洛階、
  德國的艾菲爾階、突尼西亞的丹麥階各有兩個項目）。沒有界線、但 20 公里內有同一國的金釘子的也算重複。
- 澳洲的埃迪卡拉紀金釘子（Q112181350，Enorama Creek）Wikidata 沒有座標：不畫點，但算進澳洲的數量。
- 手冊說要排掉 GSSA（用年代數字定義、沒有剖面）：這 88 個的 P31 都是 GSSP，沒有 GSSA，不必排。
"""
from __future__ import annotations

import math
import re
from collections import Counter

import geoindex
from common import OUT_DIR, indicator_file, points_file, write_json
from sources import qlever_wikidata as q
from sources.countries import from_alpha2
from zh_names import wikidata_zh

OUT = OUT_DIR / "topics" / "gssp"
YEAR = 2026
ITEMS_QUERY = """SELECT ?item ?coord ?iso ?en ?zhtw ?zhhant ?zh ?loc ?locEn ?locZhtw ?locZhhant ?locZh ?sl WHERE {
  ?item wdt:P31/wdt:P279* wd:Q37402 ; wikibase:sitelinks ?sl .
  OPTIONAL { ?item wdt:P625 ?coord }
  OPTIONAL { ?item wdt:P17 ?c . ?c wdt:P297 ?iso }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
  OPTIONAL { ?item wdt:P131 ?loc .
    OPTIONAL { ?loc rdfs:label ?locEn FILTER(LANG(?locEn) = "en") }
    OPTIONAL { ?loc rdfs:label ?locZhtw FILTER(LANG(?locZhtw) = "zh-tw") }
    OPTIONAL { ?loc rdfs:label ?locZhhant FILTER(LANG(?locZhhant) = "zh-hant") }
    OPTIONAL { ?loc rdfs:label ?locZh FILTER(LANG(?locZh) = "zh") } }
}"""
STAGES_QUERY = """SELECT ?item ?stage ?start ?end ?en ?zhtw ?zhhant ?zh WHERE {
  ?item wdt:P31/wdt:P279* wd:Q37402 ; wdt:P527 ?stage .
  OPTIONAL { ?stage wdt:P580 ?start }
  OPTIONAL { ?stage wdt:P582 ?end }
  OPTIONAL { ?stage rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?stage rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?stage rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?stage rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
}"""
# 沒有 P527 的：界線上面那一階的英文名（理由見檔頭）
MANUAL = {"Q3116110": "Tremadocian", "Q134002699": "Barremian", "Q249846": "Floian", "Q40719228": "Eifelian"}
# 2024 年被取代的舊金釘子（埃隆階、特列奇階搬到捷克與西班牙）
SUPERSEDED = {"Q7837759": "Aeronian", "Q5057241": "Telychian"}
DUPLICATE_KM = 20
# Wikidata 的中文標籤明顯錯的（標成「世」、轉換錯字或不是通行的譯名），改成通行的階名
STAGE_ZH = {"Calabrian": "卡拉布里雅階", "Chibanian": "千葉階", "Gelasian": "傑拉階", "Piacenzian": "皮亞琴察階",
            "Zanclean": "贊克爾階", "Artinskian": "亞丁斯克階"}
# 所在地的中文標籤是玩笑翻譯（Fortune 標成「一夜暴富鎮」），用英文
PLACE_ZH_BAD = {"Fortune"}
EXTRA_QUERY = """SELECT ?stage ?en ?start ?prevEn ?zhtw ?zhhant ?zh ?pzhtw ?pzhhant ?pzh WHERE {
  VALUES ?en { %s }
  ?stage rdfs:label ?en ; wdt:P580 ?start ; wdt:P155 ?prev .
  ?prev rdfs:label ?prevEn FILTER(LANG(?prevEn)="en")
  OPTIONAL { ?stage rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?stage rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?stage rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
  OPTIONAL { ?prev rdfs:label ?pzhtw FILTER(LANG(?pzhtw) = "zh-tw") }
  OPTIONAL { ?prev rdfs:label ?pzhhant FILTER(LANG(?pzhhant) = "zh-hant") }
  OPTIONAL { ?prev rdfs:label ?pzh FILTER(LANG(?pzh) = "zh") }
}""" % " ".join(f'"{n}"@en' for n in sorted(set([*MANUAL.values()])))
# 代（點的顏色）：界線年代（百萬年）落在哪一代；邊界本身算年輕的那一代（6600 萬年的丹麥階屬新生代）
ERAS = [(66.0, 1), (251.902, 2), (538.8, 3)]  # 新生代、中生代、古生代；更老的是 4（前寒武紀）


def _v(r: dict, k: str) -> str | None:
    return r.get(k, {}).get("value")


def _ma(t: str | None) -> float | None:
    """Wikidata 的地質時間「-174100000-01-01T00:00:00」→ 174.1（百萬年）。全新世的三條界線 Wikidata 記成西元前的年份
    （格陵蘭階 -9700、諾斯格瑞比階 -6200、梅加拉亞階 -2200），ICS 的年代是距西元 2000 年（b2k）：11,700、8,200、
    4,200 年，所以兩萬年內的加 2000"""
    m = re.match(r"^-(\d+)-", t or "")
    if not m:
        return None
    years = int(m.group(1))
    return (years + 2000 if years < 20000 else years) / 1e6


def _stage_zh(r: dict, prefix: str = "") -> str | None:
    """地層單位的中文名：統一寫「階」（GSSP 定義的是年代地層的階；Wikidata 的中文標籤「期」與「階」混用）"""
    en = _v(r, "prevEn" if prefix == "p" else "en")
    if en in STAGE_ZH:
        return STAGE_ZH[en]
    name = wikidata_zh(_v(r, prefix + "zhtw") or _v(r, prefix + "zhhant"), _v(r, prefix + "zh"))
    return re.sub(r"期$", "階", name) if name else None


def _era(age: float) -> int:
    for limit, era in ERAS:
        if age <= limit + 1e-9:
            return era
    return 4


def _km(a: dict, b: dict) -> float:
    la1, la2 = math.radians(a["lat"]), math.radians(b["lat"])
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(math.radians(b["lon"] - a["lon"]) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def _dedupe(rows: list[dict]) -> list[dict]:
    """同一條界線、同一國、相距 DUPLICATE_KM 內的是同一個金釘子：留有 P527 的；沒有界線的、附近有同一國的金釘子也算重複"""
    keep: list[dict] = []
    for r in sorted(rows, key=lambda r: (not r["parts"], r["q"])):
        twin = next((k for k in keep if k["iso3"] == r["iso3"] and _km(k, r) <= DUPLICATE_KM
                     and (r["uEn"] is None or k["uEn"] == r["uEn"])), None)
        if twin:
            print(f"  重複：{r['q']} {r['en']}（{r['uEn']}）＝ {twin['q']} {twin['en']}（{twin['uEn']}），相距 {_km(twin, r):.1f} 公里")
            continue
        keep.append(r)
    return keep


def build() -> None:
    items: dict[str, dict] = {}
    for r in q.cached("gssp-items", ITEMS_QUERY):
        qid = r["item"]["value"].rsplit("/", 1)[1]
        d = items.setdefault(qid, {"q": qid, "sl": int(r["sl"]["value"])})
        if "coord" in r and "lon" not in d:
            m = re.match(r"POINT\(([-\d.eE]+) ([-\d.eE]+)\)", r["coord"]["value"])
            d["lon"], d["lat"] = float(m.group(1)), float(m.group(2))
        d.setdefault("iso", _v(r, "iso"))
        d.setdefault("en", _v(r, "en"))
        d.setdefault("zh", wikidata_zh(_v(r, "zhtw") or _v(r, "zhhant"), _v(r, "zh"), place=True))
        if _v(r, "locEn") or _v(r, "locZh"):
            d.setdefault("locEn", _v(r, "locEn"))
            d.setdefault("locZh", wikidata_zh(_v(r, "locZhtw") or _v(r, "locZhhant"), _v(r, "locZh"), place=True))

    parts: dict[str, list[dict]] = {}
    for r in q.cached("gssp-stages", STAGES_QUERY):
        qid = r["item"]["value"].rsplit("/", 1)[1]
        stage = r["stage"]["value"].rsplit("/", 1)[1]
        if any(p["stage"] == stage for p in parts.get(qid, [])):
            continue
        parts.setdefault(qid, []).append({"stage": stage, "start": _ma(_v(r, "start")), "end": _ma(_v(r, "end")), "en": _v(r, "en"), "zh": _stage_zh(r)})
    extra = {_v(r, "en"): r for r in q.cached("gssp-extra-stages", EXTRA_QUERY)}

    rows = []
    no_coord: list[str] = []
    for qid, d in items.items():
        if qid in SUPERSEDED:
            print(f"  排除 2024 年被取代的：{qid} {d.get('en')}（{SUPERSEDED[qid]}）")
            continue
        if "lon" not in d:
            print(f"  沒有座標（不畫、算進數量）：{qid} {d.get('en')} {d.get('iso')}")
            no_coord.append(from_alpha2(d["iso"]))
            continue
        iso3 = from_alpha2(d["iso"]) if d.get("iso") else None
        at = geoindex.countries_at([d["lon"]], [d["lat"]])[0]
        if iso3 is None:
            iso3 = at
        elif at and at != iso3:
            print(f"  國家不同：{qid} {d.get('en')} P17 {iso3}、座標在 {at}（用 P17）")
        upper = lower = None
        age = None
        if qid in parts and len(parts[qid]) == 2:
            # 起點比較晚（百萬年的數字小）的是上面那一階；界線是它的起點，但 Wikidata 有幾階的起訖寫反了（印度階記成
            # 起 2.49 億、訖 2.519 億，達瑞威爾階同樣），起點比訖點還年輕的，改用下面那一階的訖點
            upper, lower = sorted(parts[qid], key=lambda p: p["start"] if p["start"] is not None else 1e9)
            valid = upper["start"] is not None and (upper["end"] is None or upper["start"] > upper["end"])
            age = upper["start"] if valid else lower["end"]
        elif qid in MANUAL:
            r = extra[MANUAL[qid]]
            upper = {"en": _v(r, "en"), "zh": _stage_zh(r)}
            lower = {"en": _v(r, "prevEn"), "zh": _stage_zh(r, "p")}
            age = _ma(_v(r, "start"))
        elif qid in parts:
            print(f"  P527 不是兩個：{qid} {d.get('en')} {parts[qid]}")
        en = d.get("en")
        # 標籤是「GSSP for the base of …」的，名稱改用所在地
        generic = bool(en and en.lower().startswith("gssp"))
        name_en = d.get("locEn") if generic else en
        name_zh = d.get("locZh") if generic else (d.get("zh") or None)
        if generic and d.get("locEn") in PLACE_ZH_BAD:
            name_zh = None
        rows.append({
            "lon": d["lon"], "lat": d["lat"], "q": qid, "iso3": iso3, "sl": d["sl"], "parts": qid in parts,
            "a": round(age, 5) if age is not None else None,
            "e": _era(age) if age is not None else 0,
            "u": upper["zh"] if upper else None, "uEn": upper["en"] if upper else None,
            "l": lower["zh"] if lower else None, "lEn": lower["en"] if lower else None,
            "zh": name_zh, "en": name_en,
            "loc": None if generic else d.get("locZh"), "locEn": None if generic else d.get("locEn"),
        })
    rows = _dedupe(rows)
    for r in rows:
        r.pop("parts")
    rows.sort(key=lambda r: r["lon"])
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "gssp.json", points_file(
        rows, ["lon", "lat", "q", "iso3", "sl", "a", "e", "u", "uEn", "l", "lEn", "zh", "en", "loc", "locEn"],
        {"lon": 0.0001, "lat": 0.0001, "a": 0.00001}, delta=("lon",), strings=("iso3",)))
    counts = Counter([*(r["iso3"] for r in rows if r["iso3"]), *no_coord])
    write_json(OUT / "count.json", indicator_file("gssp", "個", [YEAR], {c: [n] for c, n in sorted(counts.items())},
                                                  license="CC0"))

    print(f"  {len(items)} 個項目、畫出 {len(rows)} 個；有界線的 {sum(1 for r in rows if r['a'] is not None)} 個")
    print("  各國：" + "、".join(f"{c} {n}" for c, n in counts.most_common()))
    print("  各代：" + "、".join(f"{e} {n}" for e, n in sorted(Counter(r['e'] for r in rows).items())))
    for r in sorted(rows, key=lambda r: r["a"] if r["a"] is not None else 1e9)[:6] + \
            sorted(rows, key=lambda r: -(r["a"] or 0))[:4]:
        print(f"  {r['iso3']} {r['zh'] or r['en']}：{r['l']} → {r['u']}（{r['lEn']} → {r['uEn']}）{r['a']} 百萬年")
    missing_zh = [r for r in rows if r["a"] is not None and (not r["u"] or not r["l"])]
    print(f"  沒有中文階名：{len(missing_zh)}；沒有中文地名：{sum(1 for r in rows if not r['zh'])}")
