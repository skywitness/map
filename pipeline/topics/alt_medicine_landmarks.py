"""傳統與替代醫學的據點：傳統醫學的大學、醫院與博物館（2026-11-08，製作手冊第二十九批 708，候選 1576；步驟 alt-medicine-landmarks）。

- Wikidata 經 QLever（CC0），三支查詢、一次一支：
  - 高等教育機構（Q38723 與子類）裡英文名稱含傳統醫學體系的字（Chinese Medicine、Ayurved、Unani、Siddha、Homoeopath…）；
  - 醫院（Q16917 與子類）裡中文名稱含「中醫／中医」或英文名稱含那些字的；
  - 博物館（Q33506 與子類）裡中文名稱含「中醫／中医／中藥／中药」或英文名稱含 Chinese Medicine、Ayurved、Traditional Medicine 的
    （一般的藥學博物館不算）。
- **這是靠名字找、不是靠分類**：Wikidata 的「health specialty」（P1995）幾乎沒有人用在傳統醫學（手冊實測全庫 9 筆），
  所以只能比對名稱；會漏（名稱沒有這些字的，例如台灣的中國醫藥大學），也可能誤判。只當地標，不做各國的計數。
- 每一筆依名稱判斷體系（中醫、阿育吠陀、順勢療法、尤納尼、悉達、韓醫或東洋醫學、其他），點的顏色是類型（大學、醫院、博物館）。
"""
from __future__ import annotations

import re
from collections import Counter

from common import OUT_DIR, indicator_file, points_file, write_json, write_points
from sources import qlever_wikidata
from zh_names import wikidata_zh

OUT = OUT_DIR / "topics" / "alt-medicine"
SYSTEM_RX = "Chinese Medicine|Chinese Materia|Ayurved|Unani|Siddha|Homoeopath|Homeopath|Oriental Medicine|Korean Medicine|Kampo|Traditional Medicine|Tibetan Medicine|Mongolian Medicine"
LABELS = """
  OPTIONAL { ?i rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?i rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?i rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?i rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
  OPTIONAL { ?i wdt:P17 ?cty . ?cty wdt:P298 ?iso }"""
ZH_ANY = "CONCAT(STR(COALESCE(?zh, \"\")), \" \", STR(COALESCE(?zhtw, \"\")), \" \", STR(COALESCE(?zhhant, \"\")))"
QUERIES = {
    # 1 大學與學院、2 醫院、3 博物館（src/topics/alt-medicine.ts 的 LANDMARK_KINDS 同代碼）
    1: f"""SELECT DISTINCT ?i ?en ?zh ?zhtw ?zhhant ?c ?iso WHERE {{
  ?i wdt:P31/wdt:P279* wd:Q38723 . ?i wdt:P625 ?c .{LABELS}
  FILTER(REGEX(STR(?en), "{SYSTEM_RX}", "i"))
}}""",
    2: f"""SELECT DISTINCT ?i ?en ?zh ?zhtw ?zhhant ?c ?iso WHERE {{
  ?i wdt:P31/wdt:P279* wd:Q16917 . ?i wdt:P625 ?c .{LABELS}
  FILTER(REGEX({ZH_ANY}, "中医|中醫") || REGEX(STR(COALESCE(?en, "")), "{SYSTEM_RX}", "i"))
}}""",
    3: f"""SELECT DISTINCT ?i ?en ?zh ?zhtw ?zhhant ?c ?iso WHERE {{
  ?i wdt:P31/wdt:P279* wd:Q33506 . ?i wdt:P625 ?c .{LABELS}
  FILTER(REGEX({ZH_ANY}, "中医|中醫|中药|中藥") || REGEX(STR(COALESCE(?en, "")), "Chinese Medicine|Ayurved|Traditional Medicine|Oriental Medicine|Korean Medicine", "i"))
}}""",
}
# 名稱 → 體系（src/topics/alt-medicine.ts 的 LANDMARK_SYSTEMS 同代碼）
SYSTEMS = [(1, r"chinese medicine|chinese materia|中醫|中医|中藥|中药"), (2, r"ayurved"), (3, r"hom(o)?eopath"), (4, r"unani"),
           (5, r"siddha"), (6, r"korean medicine|oriental medicine|kampo|韓醫|한의")]


# 地名剛好接著「中醫院」的（「衛生福利部臺中醫院」是臺中的醫院，不是中醫院）：比對前先拿掉
PLACE_PREFIX = re.compile(r"臺中|台中|华中|華中")


def _is_tcm_hospital(en: str, zhs: list[str]) -> bool:
    return any(re.search(r"中醫|中医", PLACE_PREFIX.sub("", z)) for z in zhs) or bool(re.search(SYSTEM_RX, en, re.I))


def _system(text: str) -> int:
    return next((code for code, rx in SYSTEMS if re.search(rx, text, re.I)), 7)


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    seen: dict[str, dict] = {}
    for kind, q in QUERIES.items():
        for r in qlever_wikidata.cached(f"alt-medicine-landmarks-{kind}", q):
            qid = r["i"]["value"].rsplit("/", 1)[-1]
            if qid in seen:  # 同時是學院與醫院的（「Ayurvedic Medical College and Hospital」）算前面那一類
                continue
            m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", r["c"]["value"], re.I)
            if not m:
                continue
            v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
            en = v("en") or ""
            if kind == 2 and not _is_tcm_hospital(en, [v("zh") or "", v("zhtw") or "", v("zhhant") or ""]):
                continue
            zh = wikidata_zh(v("zhtw") or v("zhhant"), v("zh"), place=True, terms=False) or ""
            iso = v("iso") or ""
            seen[qid] = {"lon": round(float(m.group(1)), 4), "lat": round(float(m.group(2)), 4), "kind": kind,
                         "sys": _system(f"{en} {v('zh') or ''} {v('zhtw') or ''} {v('zhhant') or ''}"), "iso3": iso, "qid": qid,
                         "name": zh or en, "nameEn": en or zh}
    rows = sorted(seen.values(), key=lambda r: (r["kind"], r["iso3"], r["nameEn"]))
    # Wikidata 沒有國家（P17）的用座標判國（Natural Earth）
    from geoindex import country_at
    for r in rows:
        if not r["iso3"]:
            r["iso3"] = country_at(r["lon"], r["lat"]) or ""
    write_points(OUT / "landmarks.json", points_file(rows, ["lon", "lat", "kind", "sys", "iso3", "qid", "name", "nameEn"],
                                                     {"lon": 0.0001, "lat": 0.0001, "kind": 1, "sys": 1}, strings=("iso3", "qid")),
                 ("name", "nameEn"))
    # 指標檔只給滑過的提示用（地圖不上色：名字找的地標不能當各國的統計）
    per = Counter(r["iso3"] for r in rows if r["iso3"])
    write_json(OUT / "landmark-count.json", indicator_file("landmark-count", "處", [2026], {c: [n] for c, n in sorted(per.items())},
                                                           license="CC0（Wikidata）"))
    kinds = Counter(r["kind"] for r in rows)
    print(f"  傳統醫學的地標（Wikidata）{len(rows)} 處：大學與學院 {kinds[1]}、醫院 {kinds[2]}、博物館 {kinds[3]}")
    for k in (1, 2, 3):
        print(f"    類型 {k}：" + "、".join(f"{c} {n}" for c, n in Counter(r['iso3'] for r in rows if r['kind'] == k).most_common(10)))
    print("    體系：" + "、".join(f"{s} {n}" for s, n in sorted(Counter(r['sys'] for r in rows).items())))
    print("    台灣：" + "、".join(r["name"] for r in rows if r["iso3"] == "TWN"))
    print("    博物館：" + "、".join(f"{r['name']}（{r['iso3']}）" for r in rows if r["kind"] == 3))
