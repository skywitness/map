"""隕石撞擊坑與海溝（2026-11-06，參考 tectonicplatemap.org，使用者選「板7」）：Wikidata（CC0）。

兩個步驟共用這支程式：
- impact-craters（build_craters）：P31/P279* 撞擊坑（Q55818）、座標在地球上（P625 的 globe 是 Q2，月球、火星的不收）。
  直徑 P2386（換成公里）、形成的年代 P571（「-6600 萬年」這種負的年份，換成百萬年前）、維基條目數（點的大小）。
  輸出 public/data/topics/special-landforms/craters.json（特殊地形主題的一個圖層）。
- ocean-trenches（build_trenches）：P31/P279* 海溝（Q119253）、座標在地球上；最深處 P4511（垂直深度）或 P2044
  （海拔，取負值）、長度 P2043。輸出 public/data/topics/oceans/trenches.json（海洋與漁業主題的一個圖層）。
國家依座標判斷（geoindex）；名稱用繁中、簡中轉繁（OpenCC）、英文，跟特殊地形一樣。
"""
from __future__ import annotations

import re

from common import OUT_DIR, points_file, write_json
from geoindex import countries_at
from sources.wikidata_attractions import _cached
from zh_names import wikidata_zh

CRATERS_OUT = OUT_DIR / "topics" / "special-landforms" / "craters.json"
TRENCHES_OUT = OUT_DIR / "topics" / "oceans" / "trenches.json"

LABELS = """
  OPTIONAL {{ ?item rdfs:label ?en FILTER(LANG(?en) = "en") }}
  OPTIONAL {{ ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }}
  OPTIONAL {{ ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }}
  OPTIONAL {{ ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }}"""

CRATERS = """SELECT ?item ?lat ?lon ?sl ?diam ?age ?en ?zhtw ?zhhant ?zh WHERE {{
  ?item wdt:P31/wdt:P279* wd:Q55818 ;
        p:P625/psv:P625 [ wikibase:geoGlobe wd:Q2 ; wikibase:geoLatitude ?lat ; wikibase:geoLongitude ?lon ] ;
        wikibase:sitelinks ?sl .
  OPTIONAL {{ ?item p:P2386/psn:P2386/wikibase:quantityAmount ?diam }}
  OPTIONAL {{ ?item wdt:P571 ?age }}{labels}
}}""".format(labels=LABELS)

# 手工補的海溝：馬里亞納海溝（Q510）的 P31 是一個英文標籤叫「Cacá」的項目（Q21285941，2026-11-06 查），不在海溝的類別裡
HAND_TRENCHES = ["Q510"]

TRENCHES = """SELECT ?item ?lat ?lon ?sl ?depth ?elev ?len ?en ?zhtw ?zhhant ?zh WHERE {{
  {{ ?item wdt:P31/wdt:P279* wd:Q119253 . }} UNION {{ VALUES ?item {{ {hand} }} }}
  ?item p:P625/psv:P625 [ wikibase:geoGlobe wd:Q2 ; wikibase:geoLatitude ?lat ; wikibase:geoLongitude ?lon ] ;
        wikibase:sitelinks ?sl .
  OPTIONAL {{ ?item p:P4511/psn:P4511/wikibase:quantityAmount ?depth }}
  OPTIONAL {{ ?item p:P2044/psn:P2044/wikibase:quantityAmount ?elev }}
  OPTIONAL {{ ?item p:P2043/psn:P2043/wikibase:quantityAmount ?len }}{labels}
}}""".format(labels=LABELS, hand=" ".join(f"wd:{q}" for q in HAND_TRENCHES))


def _rows(bindings: list[dict], extra: tuple[str, ...]) -> list[dict]:
    """同一個項目可能有好幾列（好幾個座標、直徑）：取第一個座標、每個欄位第一個有的值"""
    items: dict[str, dict] = {}
    for b in bindings:
        v = lambda k: b[k]["value"] if k in b else None  # noqa: E731
        q = v("item").rsplit("/", 1)[1]
        d = items.setdefault(q, {"q": q, "lon": float(v("lon")), "lat": float(v("lat")), "sl": int(v("sl"))})
        for k in ("en", "zhtw", "zhhant", "zh", *extra):
            if v(k) and k not in d:
                d[k] = v(k)
    out = []
    for d in items.values():
        # 繁中的標籤原樣用（再轉一次 OpenCC 會把「里亞尚」轉成「裡亞尚」、「瓦克夫」轉成「瓦剋夫」）；只有簡中的才轉，
        # 兩種都修正音譯地名常見的錯字（Wikidata 的繁中標籤本身也有「瓦剋夫」「里奧誇爾托」，多半是機器轉的；zh_names.py）
        zh = wikidata_zh(d.get("zhtw") or d.get("zhhant"), d.get("zh"), place=True)
        en = d.get("en")
        if not (en or zh):
            continue
        d["zh_name"] = zh if zh and zh != en else None
        out.append(d)
    return out


def _age_ma(value: str | None) -> float | None:
    """P571 的時間（「-65999999-01-01T00:00:00Z」）→ 百萬年前；公元後的（觀測到的年份）不算"""
    if not value:
        return None
    m = re.match(r"^(-?\d+)-", value)
    if not m:
        return None
    year = int(m.group(1))
    return round(-year / 1e6, 3) if year < 0 else None


def build_craters() -> None:
    rows = []
    for d in _rows(_cached("impact-craters-2026-11-06", CRATERS), ("diam", "age")):
        diam = float(d["diam"]) / 1000 if d.get("diam") else None
        rows.append({
            "lon": round(d["lon"], 3), "lat": round(d["lat"], 3), "sl": d["sl"],
            "dkm": round(diam, 2) if diam else None, "ma": _age_ma(d.get("age")),
            "en": d.get("en"), "zh": d["zh_name"], "q": d["q"],
        })
    for r, iso3 in zip(rows, countries_at([r["lon"] for r in rows], [r["lat"] for r in rows])):
        r["iso3"] = iso3
    # 直徑大的畫在上面
    rows.sort(key=lambda r: (r["dkm"] or 0, r["q"]))
    write_json(CRATERS_OUT, points_file(rows, ["lon", "lat", "sl", "dkm", "ma", "iso3", "en", "zh"],
                                        {"lon": 0.001, "lat": 0.001, "sl": 1, "dkm": 0.01, "ma": 0.001}, strings=("iso3",)))
    big = sorted((r for r in rows if r["dkm"]), key=lambda r: -r["dkm"])[:5]
    print(f"  撞擊坑 {len(rows)} 處（有直徑 {sum(1 for r in rows if r['dkm'])}、有年代 {sum(1 for r in rows if r['ma'] is not None)}）；"
          f"最大：{[(r['en'], r['dkm'], r['ma']) for r in big]}")


def build_trenches() -> None:
    rows = []
    for d in _rows(_cached("ocean-trenches-2026-11-06-v2", TRENCHES), ("depth", "elev", "len")):
        depth = float(d["depth"]) if d.get("depth") else (-float(d["elev"]) if d.get("elev") and float(d["elev"]) < 0 else None)
        rows.append({
            "lon": round(d["lon"], 3), "lat": round(d["lat"], 3), "sl": d["sl"],
            "depth": round(depth) if depth else None, "km": round(float(d["len"]) / 1000) if d.get("len") else None,
            "en": d.get("en"), "zh": d["zh_name"], "q": d["q"],
        })
    for q in HAND_TRENCHES:
        if not any(r["q"] == q for r in rows):
            raise RuntimeError(f"手工補的海溝 {q} 沒有查到（沒有座標？）")
    rows.sort(key=lambda r: (r["depth"] or 0, r["q"]))
    write_json(TRENCHES_OUT, points_file(rows, ["lon", "lat", "sl", "depth", "km", "en", "zh"],
                                         {"lon": 0.001, "lat": 0.001, "sl": 1, "depth": 1, "km": 1}))
    deep = sorted((r for r in rows if r["depth"]), key=lambda r: -r["depth"])[:5]
    print(f"  海溝 {len(rows)} 條（有深度 {sum(1 for r in rows if r['depth'])}）；最深：{[(r['zh'] or r['en'], r['depth']) for r in deep]}")


def build() -> None:
    build_craters()
    build_trenches()
