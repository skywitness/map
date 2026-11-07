"""碳邊境調整機制（CBAM）會課到誰（新主題，2026-11-07，製作手冊第二十五批 482，候選 1141；環境的「碳與氣候政策」）。

範圍：歐盟執委會 CBAM 頁（https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en）
「CBAM applies to imports of selected goods in the following carbon-intensive sectors: cement, iron and steel, aluminium,
fertilisers, electricity and hydrogen.」「As of 1 January 2026, CBAM is applicable under its definitive regime.」
貿易：Eurostat Comext API 的 DS-045409（EU trade since 1988 by HS2-4-6 and CN8，CC BY 4.0），歐盟 27 國從各國的進口
（flow=1，VALUE_IN_EUROS），一次查全部夥伴。CBAM 附件一是 CN8 的清單（EUR-Lex 從雲端被擋），這裡用 HS 近似：
水泥 2523、鋼鐵 72 整章、鋁 76 扣掉 7615（家用器具）、化肥 2808＋2814＋3102＋3105、電力 2716、氫 280410；
HS 73 的鋼鐵製品只有一部分在附件一，照手冊不算。英國、科索沃照 sources/eurostat.py 的 NONCOMMERCIAL 不收；
歐盟成員國（內部貿易）與附件三不課 CBAM 的冰島、列支敦斯登、挪威、瑞士不畫（後四國 noValue 寫原因）。

輸出 public/data/topics/cbam/：share.json（CBAM 產品占這一國對歐盟出口的 %）、value/{all,steel,…}.json（歐元）、manifest.json。
"""

from __future__ import annotations

import json
import urllib.parse
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, now_iso, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "cbam"
API = "https://ec.europa.eu/eurostat/api/comext/dissemination/statistics/1.0/data/DS-045409?"
FIRST, LAST = 2015, 2025
GROUPS = {
    "steel": ["72"],
    "aluminium": ["76"],
    "cement": ["2523"],
    "fertilisers": ["2808", "2814", "3102", "3105"],
    "electricity": ["2716"],
    "hydrogen": ["280410"],
}
SUBTRACT = {"aluminium": ["7615"]}
# 歐盟 27 國（reporter=EU27_2020 時夥伴是成員國的是歐盟內部貿易，不算）
EU27 = {"AUT", "BEL", "BGR", "HRV", "CYP", "CZE", "DNK", "EST", "FIN", "FRA", "DEU", "GRC", "HUN", "IRL", "ITA", "LVA", "LTU",
        "LUX", "MLT", "NLD", "POL", "PRT", "ROU", "SVK", "SVN", "ESP", "SWE"}
# CBAM 法規附件三：跟歐盟碳排放交易體系連結、不課 CBAM 的國家（冰島、列支敦斯登、挪威、瑞士）
EXEMPT = {"ISL", "LIE", "NOR", "CHE"}
EXEMPT_NOTE = "跟歐盟碳排放交易體系連結，不課 CBAM"
EXEMPT_NOTE_EN = "Linked to the EU Emissions Trading System; exempt from CBAM"


def _fetch(products: list[str]) -> dict[str, dict[str, dict[int, float]]]:
    """{product: {iso3: {年: 歐元}}}"""
    params = [("freq", "A"), ("reporter", "EU27_2020"), ("flow", "1"), ("indicators", "VALUE_IN_EUROS")]
    params += [("product", p) for p in products] + [("time", str(y)) for y in range(FIRST, LAST + 1)]
    url = API + urllib.parse.urlencode(params)
    d = json.loads(download(url, "comext", f"DS-045409-{'-'.join(products)}-{FIRST}-{LAST}.json").read_text(encoding="utf-8"))
    ids, sizes = d["id"], d["size"]
    cats = {k: {i: c for c, i in d["dimension"][k]["category"]["index"].items()} for k in ids}
    strides = [1] * len(ids)
    for i in range(len(ids) - 2, -1, -1):
        strides[i] = strides[i + 1] * sizes[i + 1]
    out: dict[str, dict[str, dict[int, float]]] = defaultdict(lambda: defaultdict(dict))
    for flat, value in d["value"].items():
        idx = int(flat)
        pos = {}
        for k, s, n in zip(ids, strides, sizes):
            pos[k], idx = divmod(idx, s)
        geo = cats["partner"][pos["partner"]]
        iso3 = eurostat._iso3(geo)
        if (not iso3 or eurostat.noncommercial(geo) or iso3 in eurostat.NONCOMMERCIAL or value is None
                or iso3 in EU27 or iso3 in EXEMPT):
            continue
        out[cats["product"][pos["product"]]][iso3][int(cats["time"][pos["time"]])] = float(value)
    return out


def build() -> None:
    codes = sorted({c for v in GROUPS.values() for c in v} | {c for v in SUBTRACT.values() for c in v} | {"TOTAL"})
    data = _fetch(codes)
    years = list(range(FIRST, LAST + 1))
    group_value: dict[str, dict[str, dict[int, float]]] = {}
    for g, prods in GROUPS.items():
        series: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
        for p in prods:
            for iso3, s in data.get(p, {}).items():
                for y, v in s.items():
                    series[iso3][y] += v
        for p in SUBTRACT.get(g, []):
            for iso3, s in data.get(p, {}).items():
                for y, v in s.items():
                    series[iso3][y] -= v
        group_value[g] = series
    allv: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    for series in group_value.values():
        for iso3, s in series.items():
            for y, v in s.items():
                allv[iso3][y] += v
    group_value = {"all": allv, **group_value}
    for g, series in group_value.items():
        write_json(OUT / "value" / f"{g}.json", indicator_file(
            "value", "歐元", years, {k: [round(s.get(y, 0)) if any(s.values()) else None for y in years]
                                    for k, s in series.items() if sum(s.values()) > 0}, license="CC BY 4.0",
            noValue={k: EXEMPT_NOTE for k in EXEMPT}, noValueEn={k: EXEMPT_NOTE_EN for k in EXEMPT}))
    total = data["TOTAL"]
    share = {}
    for iso3, s in total.items():
        row = [round(allv.get(iso3, {}).get(y, 0) / s[y] * 100, 2) if s.get(y, 0) >= 1e6 else None for y in years]
        if any(v is not None for v in row):
            share[iso3] = row
    write_json(OUT / "share.json", indicator_file("share", "%", years, share, license="CC BY 4.0",
                                                  noValue={k: EXEMPT_NOTE for k in EXEMPT},
                                                  noValueEn={k: EXEMPT_NOTE_EN for k in EXEMPT}))
    write_json(OUT / "manifest.json", {"topic": "cbam", "generatedAt": now_iso(),
                                       "sources": [f"Eurostat Comext DS-045409 ({FIRST}–{LAST})"]})
    last = max(y for s in total.values() for y in s)
    top = sorted(((allv[k].get(last, 0), k) for k in allv), reverse=True)[:8]
    print(f"  {len(share)} 個貿易夥伴；{last} 年 CBAM 產品最多：" + "、".join(f"{k} {v / 1e8:.1f} 億歐元" for v, k in top))
