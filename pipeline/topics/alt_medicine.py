"""傳統與替代醫學的據點（新主題，2026-11-08，製作手冊第二十九批 688，候選 1563–1567；步驟 alt-medicine，輸出 topics/alt-medicine/）。

- **據點**：OpenStreetMap 的 `healthcare=alternative`，加上任何物件的 `healthcare:speciality` 有下面七類之一（台灣、南韓、中國的
  中醫診所多半標成 `amenity=clinic` ＋ speciality，只看 healthcare=alternative 會漏掉）。QLever 一支全球查詢拿點與代表點
  （不在 SPARQL 裡做國界的空間連接：手冊 688 的 M2 實測四次 HTTP 500），再用 `geoindex.countries_at`（Natural Earth）判國，
  所以香港、澳門與海外屬地照第〇節 1-f 的口徑分開算。
- **種類**：speciality 用分號分開，依 KINDS 的順序取第一個對上的（`acupuncture;traditional_chinese_medicine` 算中醫）；
  都沒對上而且是 healthcare=alternative 的算「其他或沒寫」。中醫這一類含 oriental_medicine、traditional_korean_medicine
  （南韓的韓醫多半也標成 traditional_chinese_medicine）。
- **以哪一種為主**（類別圖）：七類合計至少 10 處的國家才上色，取最多的一類。
- **草藥店**：`shop=herbalist`，計數與點都用 `osm_qlever`（國界口徑，子屬地從母國減掉，同 1-f）；每 100 家藥局的比例只算
  `amenity=pharmacy` 至少 200 家的國家。
- **台灣的官方數字**（提示裡對照，計數不改）：衛福部統計處表 1.6（中醫醫院、中醫診所）、表 2.2.2（22 個縣市的中藥販賣業加總；
  每個縣市一張工作表，第一張新北市的「總計」只是新北市）。
- 資料 ODbL 1.0（© OpenStreetMap contributors）；點的清單是衍生資料庫，同樣以 ODbL 提供。
"""
from __future__ import annotations

from collections import Counter

import openpyxl

from common import OUT_DIR, indicator_file, points_file, write_json, write_points
from geoindex import countries_at
from sources import mohw_tables, osm_coverage, osm_qlever, wpp

OUT = OUT_DIR / "topics" / "alt-medicine"
YEAR = 2026
KINDS = [  # (代號, speciality 的值)
    ("tcm", {"traditional_chinese_medicine", "chinese_medicine", "oriental_medicine", "traditional_korean_medicine",
             "korean_medicine", "tuina"}),
    ("acupuncture", {"acupuncture"}),
    ("chiropractic", {"chiropractic"}),
    ("osteopathy", {"osteopathy"}),
    ("homeopathy", {"homeopathy"}),
    ("naturopathy", {"naturopathy"}),
    ("ayurveda", {"ayurveda"}),
]
OTHER = len(KINDS) + 1  # 其他或沒寫
MIN_MAIN = 10  # 「以哪一種為主」：七類合計至少幾處才上色
MIN_PHARMACIES = 200
MIN_CARE = 300  # 比例的分母（診所＋藥局）至少幾處
MIN_PER = 10  # 每百萬人：至少幾處才上色
REGEX = "chinese_medicine|oriental_medicine|korean_medicine|tuina|acupuncture|chiropractic|osteopathy|homeopathy|naturopathy|ayurveda"


def _kind(h: str | None, sp: str | None) -> int | None:
    tokens = [t.strip().lower() for t in (sp or "").split(";") if t.strip()]
    for i, (_, values) in enumerate(KINDS, 1):
        if any(t in values for t in tokens):
            return i
    return OTHER if h == "alternative" else None


def places() -> list[dict]:
    rows = osm_qlever.query(f"""PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
SELECT ?x ?h ?sp ?name ?name_zh ?name_en ?c WHERE {{
  {{ SELECT DISTINCT ?x WHERE {{
      {{ ?x osmkey:healthcare "alternative" . }}
      UNION
      {{ ?x osmkey:healthcare:speciality ?s . FILTER(REGEX(?s, "{REGEX}")) }}
  }} }}
  OPTIONAL {{ ?x osmkey:healthcare ?h }}
  OPTIONAL {{ ?x osmkey:healthcare:speciality ?sp }}
  OPTIONAL {{ ?x osmkey:name ?name }}
  OPTIONAL {{ ?x osmkey:name:zh ?name_zh }}
  OPTIONAL {{ ?x osmkey:name:en ?name_en }}
  ?x geo:hasGeometry/geo:asWKT ?wkt .
  BIND(geof:centroid(?wkt) AS ?c)
}}""", "alt-medicine-places")
    seen: set[str] = set()
    out = []
    for r in rows:
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        if v("x") in seen:
            continue
        k = _kind(v("h"), v("sp"))
        c = osm_qlever.centroid(v("c") or "")
        if k is None or not c:
            continue
        seen.add(v("x"))
        out.append({"lon": round(c[0], 4), "lat": round(c[1], 4), "k": k, "n": v("name"), "nz": v("name_zh"), "ne": v("name_en")})
    for p, iso in zip(out, countries_at([p["lon"] for p in out], [p["lat"] for p in out])):
        p["iso3"] = iso
    return [p for p in out if p["iso3"]]


def herbalist_points() -> list[dict]:
    """shop=herbalist 的點：同 places()，全球一支查詢、不做國界的空間連接（osm_qlever.features 帶國界跑了十幾分鐘沒有回來），
    用 geoindex 判國，所以點的國家跟草藥店的計數（國界口徑）可能差幾處"""
    rows = osm_qlever.query("""PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
SELECT ?x ?name ?name_zh ?name_en ?c WHERE {
  ?x osmkey:shop "herbalist" ; geo:hasGeometry/geo:asWKT ?wkt .
  OPTIONAL { ?x osmkey:name ?name }
  OPTIONAL { ?x osmkey:name:zh ?name_zh }
  OPTIONAL { ?x osmkey:name:en ?name_en }
  BIND(geof:centroid(?wkt) AS ?c)
}""", "alt-medicine-herbalists")
    seen: set[str] = set()
    out = []
    for r in rows:
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        c = osm_qlever.centroid(v("c") or "")
        if v("x") in seen or not c:
            continue
        seen.add(v("x"))
        out.append({"lon": round(c[0], 4), "lat": round(c[1], 4), "n": v("name"), "nz": v("name_zh"), "ne": v("name_en")})
    for p, iso in zip(out, countries_at([p["lon"] for p in out], [p["lat"] for p in out])):
        p["iso3"] = iso
    return [p for p in out if p["iso3"]]


def _taiwan_official() -> dict[str, int]:
    """衛福部統計處：最新一年底的中醫醫院、中醫診所（表 1.6）與全國的中藥販賣業、藥局（表 2.2.2，22 張工作表加總）"""
    path, _, _ = mohw_tables.table("5301", "1.6", "醫療院所家數")
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True)["院所數"]
    last = None
    for r in ws.iter_rows(min_row=6, values_only=True):
        if isinstance(r[0], str) and r[0].strip().endswith("年") and isinstance(r[1], (int, float)):
            last = r
    head = [c for c in next(ws.iter_rows(min_row=4, max_row=4, values_only=True))]
    assert head[6] and "中" in head[6] and head[16] and "中" in head[16], head  # 醫院的中醫在 G 欄、診所的中醫在 Q 欄
    out = {"year": mohw_tables.roc(last[0].strip().rstrip("年").strip()), "tcm_hospitals": int(last[6]), "tcm_clinics": int(last[16])}
    path, _, _ = mohw_tables.table("5301", "2.2.2", "藥商")
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    herb = pharm = 0
    for ws in wb.worksheets:
        r = next(ws.iter_rows(min_row=13, max_row=13, values_only=True))
        assert r[0] == "總計", (ws.title, r[0])
        herb += int(r[14]) + int(r[19])  # 中藥販賣業：藥事法第 28 條二項小計＋第 103 條小計
        pharm += int(r[2])
    out.update(sheets=len(wb.worksheets), herbalists=herb, pharmacies=pharm)
    return out


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    pts = places()
    tw = _taiwan_official()
    by = {i: Counter(p["iso3"] for p in pts if p["k"] == i) for i in range(1, OTHER + 1)}
    allc = Counter(p["iso3"] for p in pts)
    tcm = by[1]
    tw_tcm = tw["tcm_hospitals"] + tw["tcm_clinics"]
    tw_hint = (f"OpenStreetMap 上有 {tcm.get('TWN', 0):,} 處；衛福部統計處的官方數字是 {tw['year']} 年底中醫醫院 {tw['tcm_hospitals']} 家、"
               f"中醫診所 {tw['tcm_clinics']:,} 家，OSM 只畫到約 {tcm.get('TWN', 0) / tw_tcm:.0%}")
    tw_hint_en = (f"{tcm.get('TWN', 0):,} on OpenStreetMap; official Ministry of Health and Welfare figures for the end of {tw['year']}: "
                  f"{tw['tcm_hospitals']} Chinese medicine hospitals and {tw['tcm_clinics']:,} clinics, so OSM has only about "
                  f"{tcm.get('TWN', 0) / tw_tcm:.0%} of them")
    write_json(OUT / "tcm.json", indicator_file("tcm", "處", [YEAR], {c: [v] for c, v in sorted(tcm.items())},
                                                hints={"TWN": tw_hint}, hintsEn={"TWN": tw_hint_en}, license="ODbL 1.0"))
    write_json(OUT / "alternative.json", indicator_file("alternative", "處", [YEAR], {c: [v] for c, v in sorted(allc.items())},
                                                        license="ODbL 1.0"))
    # 以哪一種為主
    main, nv, nv_en, hints, hints_en = {}, {}, {}, {}, {}
    for c in sorted(allc):
        counts = {i: by[i].get(c, 0) for i in range(1, OTHER)}
        total = sum(counts.values())
        if total < MIN_MAIN:
            nv[c] = f"七類合計只有 {total} 處（不到 {MIN_MAIN} 處），OpenStreetMap 的標籤不夠，不畫"
            nv_en[c] = f"Only {total} places in the seven types (fewer than {MIN_MAIN}): too few OpenStreetMap tags, so not shown"
            continue
        best = max(counts, key=lambda i: (counts[i], -i))
        main[c] = [best]
        hints[c] = f"七類合計 {total:,} 處，最多的占 {counts[best] / total:.0%}"
        hints_en[c] = f"{total:,} places in the seven types; the largest is {counts[best] / total:.0%}"
    write_json(OUT / "main-kind.json", indicator_file("main-kind", "類", [YEAR], main, noValue=nv, noValueEn=nv_en, hints=hints,
                                                      hintsEn=hints_en, license="ODbL 1.0"))
    # 第二十九批 699：每一種的分國計數（子項目）
    for i, (name, _) in enumerate(KINDS, 1):
        write_json(OUT / "kinds" / f"{name}.json", indicator_file(f"kind-{name}", "處", [YEAR], {c: [v] for c, v in sorted(by[i].items())},
                                                                  license="ODbL 1.0"))
    # 第二十九批 698：占診所＋藥局的比例（分母至少 MIN_CARE 處）、每百萬人（只替 OSM 覆蓋良好、至少 MIN_PER 處的國家上色）
    clinics = osm_qlever.counts("amenity", "clinic")
    pharmacies = osm_qlever.counts("amenity", "pharmacy")
    share, snv, snv_en, sh, sh_en = {}, {}, {}, {}, {}
    for c in sorted(set(allc) | set(clinics) | set(pharmacies)):
        care = clinics.get(c, 0) + pharmacies.get(c, 0)
        if care < MIN_CARE:
            if allc.get(c):
                snv[c] = f"OpenStreetMap 上的診所加藥局只有 {care} 處（不到 {MIN_CARE} 處），比例不穩，不畫"
                snv_en[c] = f"Only {care} clinics and pharmacies on OpenStreetMap (fewer than {MIN_CARE}), too few for a stable ratio, so not shown"
            continue
        share[c] = [round(allc.get(c, 0) / care * 100, 1)]
        sh[c] = f"傳統與替代醫學 {allc.get(c, 0):,} 處；診所 {clinics.get(c, 0):,}、藥局 {pharmacies.get(c, 0):,} 處"
        sh_en[c] = f"{allc.get(c, 0):,} traditional and alternative medicine places; {clinics.get(c, 0):,} clinics, {pharmacies.get(c, 0):,} pharmacies"
    write_json(OUT / "share-of-care.json", indicator_file("share-of-care", "%", [YEAR], share, noValue=snv, noValueEn=snv_en, hints=sh,
                                                          hintsEn=sh_en, license="ODbL 1.0"))
    pop = {c: s[2024] for c, s in wpp.demographic(["TPopulation1July"], last_year=2024)["TPopulation1July"].items() if s.get(2024)}
    cov, covered = osm_coverage.coverage(), osm_coverage.well_covered()
    per, pnv, pnv_en = {}, {}, {}
    for c in sorted(set(allc) | covered):
        if c not in pop:
            continue
        if c not in covered:
            pnv[c], pnv_en[c] = osm_coverage.reason(c, cov.get(c))
        elif allc.get(c, 0) < MIN_PER:
            pnv[c] = f"OpenStreetMap 上只有 {allc.get(c, 0)} 處（不到 {MIN_PER} 處），不畫"
            pnv_en[c] = f"Only {allc.get(c, 0)} places on OpenStreetMap (fewer than {MIN_PER}), so not shown"
        else:
            per[c] = [round(allc[c] / (pop[c] * 1000) * 1e6, 1)]
    write_json(OUT / "per-million.json", indicator_file("per-million", "處/百萬人", [YEAR], per, noValue=pnv, noValueEn=pnv_en, license="ODbL 1.0"))
    rs = sorted(share.items(), key=lambda kv: -kv[1][0])
    print(f"  占診所＋藥局（分母 ≥{MIN_CARE} 的 {len(share)} 國）：" + "、".join(f"{c} {v[0]}" for c, v in rs[:18]) + " … "
          + "、".join(f"{c} {share[c][0]}" for c in ("TWN", "CHN", "JPN", "KOR", "ITA", "BRA", "RUS", "DEU", "USA") if c in share))
    rp = sorted(per.items(), key=lambda kv: -kv[1][0])
    print(f"  每百萬人（覆蓋良好且 ≥{MIN_PER} 處的 {len(per)} 國）：" + "、".join(f"{c} {v[0]}" for c, v in rp[:15]) + " … "
          + "、".join(f"{c} {per[c][0]}" for c in ("TWN", "CHN", "JPN", "KOR", "DEU", "USA", "FRA", "IND") if c in per))
    pts.sort(key=lambda p: (p["k"], p["iso3"], p["lon"]))
    write_points(OUT / "places.json", points_file(pts, ["lon", "lat", "k", "iso3", "n", "nz", "ne"], {"lon": 0.0001, "lat": 0.0001, "k": 1},
                                                  strings=("iso3",)), ("n", "nz", "ne"))
    # 草藥店
    herb = osm_qlever.counts("shop", "herbalist")
    pharm = osm_qlever.counts("amenity", "pharmacy")
    herb_hint = (f"OpenStreetMap 上有 {herb.get('TWN', 0):,} 處；衛福部統計處 {tw['year']} 年底全國的中藥販賣業 {tw['herbalists']:,} 家"
                 f"（{tw['sheets']} 個縣市加總）")
    herb_hint_en = (f"{herb.get('TWN', 0):,} on OpenStreetMap; the Ministry of Health and Welfare counted {tw['herbalists']:,} licensed "
                    f"Chinese herbal medicine dealers nationwide at the end of {tw['year']}")
    write_json(OUT / "herbalists.json", indicator_file("herbalists", "處", [YEAR], {c: [v] for c, v in sorted(herb.items())},
                                                       hints={"TWN": herb_hint}, hintsEn={"TWN": herb_hint_en}, license="ODbL 1.0"))
    ratio, rnv, rnv_en, rh, rh_en = {}, {}, {}, {}, {}
    for c in sorted(set(herb) | set(pharm)):
        p = pharm.get(c, 0)
        if p < MIN_PHARMACIES:
            if herb.get(c):
                rnv[c] = f"OpenStreetMap 上的藥局只有 {p} 家（不到 {MIN_PHARMACIES} 家），比例不穩，不畫"
                rnv_en[c] = f"Only {p} pharmacies on OpenStreetMap (fewer than {MIN_PHARMACIES}), too few for a stable ratio, so not shown"
            continue
        ratio[c] = [round(herb.get(c, 0) / p * 100, 2)]
        rh[c] = f"草藥店 {herb.get(c, 0):,} 處、藥局 {p:,} 家"
        rh_en[c] = f"{herb.get(c, 0):,} herbalists, {p:,} pharmacies"
    write_json(OUT / "herbalists-per-pharmacy.json",
               indicator_file("herbalists-per-pharmacy", "家/百家藥局", [YEAR], ratio, noValue=rnv, noValueEn=rnv_en, hints=rh,
                              hintsEn=rh_en, license="ODbL 1.0"))
    hp = herbalist_points()
    hp.sort(key=lambda p: (p["iso3"], p["lon"]))
    write_points(OUT / "herbalist-points.json", points_file(hp, ["lon", "lat", "iso3", "n", "nz", "ne"], {"lon": 0.0001, "lat": 0.0001},
                                                            strings=("iso3",)), ("n", "nz", "ne"))

    # ── 摘要（說明用） ──
    def top(cnt, n=12):
        return "、".join(f"{c} {v:,}" for c, v in cnt.most_common(n))
    print(f"  據點 {len(pts):,} 處、{len(allc)} 國：{top(allc)}；台灣 {allc.get('TWN')}；有名稱 {sum(1 for p in pts if p['n']):,}")
    for i, (name, _) in enumerate(KINDS + [("other", None)], 1):
        print(f"    {name}：{sum(by[i].values()):,} 處、{len(by[i])} 國：{top(by[i], 10)}；台灣 {by[i].get('TWN')}")
    mk = Counter(v[0] for v in main.values())
    print(f"  以哪一種為主：{len(main)} 國上色；" + "、".join(f"{KINDS[i - 1][0]} {n}" for i, n in sorted(mk.items())))
    for i in sorted(mk):
        print(f"    {KINDS[i - 1][0]}：" + "、".join(c for c, v in main.items() if v[0] == i))
    print(f"  台灣官方：{tw}；OSM 中醫 {tcm.get('TWN')}（{tcm.get('TWN', 0) / tw_tcm:.1%}）")
    hc = Counter(herb)
    print(f"  草藥店 {sum(herb.values()):,} 處、{len(herb)} 國：{top(hc, 15)}；台灣 {herb.get('TWN')}；點 {len(hp):,}")
    rr = sorted(((c, v[0]) for c, v in ratio.items()), key=lambda x: -x[1])
    print(f"  每百家藥局的草藥店（藥局 ≥{MIN_PHARMACIES} 的 {len(ratio)} 國）：" + "、".join(f"{c} {v}" for c, v in rr[:20]) + " … "
          + "、".join(f"{c} {ratio[c][0]}" for c in ("TWN", "CHN", "JPN", "KOR", "DEU", "USA") if c in ratio))
