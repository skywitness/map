"""菜系走到哪裡：各國餐廳的菜系從哪裡來（新主題，2026-11-07，製作手冊第二十四批 431；步驟 cuisines，輸出 topics/cuisines/）。

- 資料：OpenStreetMap 的 cuisine 標籤經 QLever（sources/osm_qlever.py；ODbL 1.0，© OpenStreetMap contributors），
  一支查詢取各國每一種 cuisine 寫法的物件數（2026 年 11 月的快照）。cuisine 可以寫好幾個值（「italian;pizza」），
  拆開來比對，一家店寫了兩國菜就兩邊各算一次。
- 只收有明確單一原產國的菜系（CUISINES：chinese→中國、italian→義大利…）；pizza、sushi、kebab、burger、asian 這類
  不是國名的不算（披薩、壽司走得再遠，標籤上也分不出是不是「義大利菜」「日本菜」）。
- 台灣、香港、澳門標 chinese 的中式餐廳與北韓的朝鮮菜不算「外國菜」（HOMES），也不算中國菜、韓國菜「流到國外」的店。
- 原產國本國常常不標（在義大利，義大利菜是預設，沒人標 cuisine=italian），所以本國的數字偏低、「流到國外的比例」
  會偏高，地圖只畫外國的店數與密度，說明寫明。
- 每百萬人只替 OSM 覆蓋良好的國家上色（sources/osm_coverage.py）；占比（這國有標菜系的店裡某菜系占幾成）只畫
  有標菜系的店至少 MIN_TAGGED 家的國家。流向檔：原產國 → 有這國菜的國家（依店數，前 40 名）。
"""
from __future__ import annotations

from collections import Counter, defaultdict

from common import OUT_DIR, indicator_file, write_json, write_manifest_part
from sources import osm_coverage, osm_qlever, wpp
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "cuisines"
YEAR = 2026
MIN_TAGGED = 200
MIN_POPULATION = 100  # 千人
TOP_PARTNERS = 40
# cuisine 標籤 → 原產國（src/topics/cuisines.ts 的 CUISINES 要跟這裡一樣）
CUISINES = {
    "chinese": "CHN", "italian": "ITA", "mexican": "MEX", "japanese": "JPN", "indian": "IND", "thai": "THA",
    "korean": "KOR", "vietnamese": "VNM", "turkish": "TUR", "french": "FRA", "greek": "GRC", "lebanese": "LBN",
    "spanish": "ESP", "german": "DEU", "peruvian": "PER", "ethiopian": "ETH", "georgian": "GEO", "persian": "IRN",
    "filipino": "PHL", "indonesian": "IDN", "nepalese": "NPL", "portuguese": "PRT", "brazilian": "BRA",
    "taiwanese": "TWN", "malaysian": "MYS", "moroccan": "MAR", "russian": "RUS", "pakistani": "PAK",
    "polish": "POL", "argentinian": "ARG", "syrian": "SYR", "ukrainian": "UKR",
}
# 同一個飲食圈、不算「外國菜」的地方：台灣、香港、澳門標 chinese 的中式餐廳，北韓的朝鮮菜
HOMES = {"chinese": {"CHN", "HKG", "MAC", "TWN"}, "korean": {"KOR", "PRK"}}
QUERY = """SELECT ?iso ?c (COUNT(DISTINCT ?x) AS ?n) WHERE {
  %s
  ?x osmkey:cuisine ?c .
} GROUP BY ?iso ?c"""


def build() -> None:
    rows = osm_qlever.query(QUERY % osm_qlever.COUNTRIES, "cuisine-by-country")
    n: dict[str, Counter] = defaultdict(Counter)  # 國家 → 菜系 → 店數
    tagged: Counter = Counter()  # 國家 → 有標 cuisine 的店數
    for r in rows:
        iso3 = from_alpha2(r["iso"]["value"])
        if not iso3:
            continue
        k = int(r["n"]["value"])
        tagged[iso3] += k
        for token in {t.strip().lower() for t in r["c"]["value"].split(";")}:
            if token in CUISINES:
                n[iso3][token] += k

    pop = {c: s[YEAR] for c, s in wpp.demographic(["TPopulation1July"], last_year=YEAR)["TPopulation1July"].items() if YEAR in s}
    cov, covered = osm_coverage.coverage(), osm_coverage.well_covered()
    (OUT / "density").mkdir(parents=True, exist_ok=True)
    (OUT / "share").mkdir(parents=True, exist_ok=True)
    flows: dict[str, object] = {"item": "cuisines", "year": YEAR, "unit": "家", "scale": 1, "export": {}, "import": {}}
    abroad: dict[str, int] = {}
    summary = []
    for cuisine, origin in CUISINES.items():
        counts = {c: v[cuisine] for c, v in n.items() if v[cuisine]}
        total = sum(counts.values())
        home_set = HOMES.get(cuisine, {origin})
        foreign = {c: v for c, v in counts.items() if c not in home_set}
        abroad[origin] = sum(foreign.values())
        flows["export"][origin] = [abroad[origin], sorted(([c, v] for c, v in foreign.items()), key=lambda x: -x[1])[:TOP_PARTNERS]]
        density, share, nv, nv_en = {}, {}, {}, {}
        for c in sorted(set(counts) | covered):
            if c not in pop:
                continue
            if c in covered and pop[c] >= MIN_POPULATION:
                density[c] = [round(counts.get(c, 0) / pop[c] * 1000, 2)]
            elif c in counts:
                nv[c], nv_en[c] = osm_coverage.reason(c, cov.get(c)) if c not in covered else (
                    "人口不到 10 萬，一兩家就差很多，不畫", "Population under 100,000, too small for a stable rate, so not shown")
        for c, t in tagged.items():
            if t >= MIN_TAGGED:
                share[c] = [round(counts.get(c, 0) / t * 100, 2)]
        hints = {c: f"OpenStreetMap 上有 {counts.get(c, 0):,} 家（這國有標菜系的店 {tagged[c]:,} 家）" for c in tagged}
        hints_en = {c: f"{counts.get(c, 0):,} on OpenStreetMap (of {tagged[c]:,} places with a cuisine tag)" for c in tagged}
        home = ("本國的店常常不標這個菜系，數字偏低", "Places in the home country often omit this tag, so the count is low")
        extra = {"hints": dict(sorted(hints.items())), "hintsEn": dict(sorted(hints_en.items())), "license": "ODbL 1.0",
                 "notes": {origin: home[0]}, "notesEn": {origin: home[1]}}
        write_json(OUT / "density" / f"{cuisine}.json", indicator_file(
            "cuisine-density", "家／百萬人", [YEAR], density, noValue=nv, noValueEn=nv_en, **extra))
        write_json(OUT / "share" / f"{cuisine}.json", indicator_file("cuisine-share", "%", [YEAR], share, **extra))
        top = sorted(foreign.items(), key=lambda kv: -kv[1])[:4]
        summary.append((cuisine, total, len(counts), counts.get(origin, 0), top, counts.get("TWN", 0),
                        round(abroad[origin] / total * 100, 1) if total else None))

    # 進口方向：這國有哪些外國菜
    for c, v in n.items():
        partners = sorted(([CUISINES[k], cnt] for k, cnt in v.items() if c not in HOMES.get(k, {CUISINES[k]})), key=lambda x: -x[1])
        if partners:
            flows["import"][c] = [sum(p[1] for p in partners), partners]
    write_json(OUT / "flows.json", flows)
    write_json(OUT / "abroad.json", indicator_file(
        "abroad", "家", [YEAR], {o: [v] for o, v in sorted(abroad.items()) if v}, license="ODbL 1.0",
        hints={o: f"國外有 {abroad[o]:,} 家標成這國菜的店（{sum(1 for c, v in n.items() if c not in HOMES.get(k, {o}) and v[k])} 國）" for k, o in CUISINES.items()},
        hintsEn={o: f"{abroad[o]:,} places abroad tagged with this cuisine ({sum(1 for c, v in n.items() if c not in HOMES.get(k, {o}) and v[k])} countries)" for k, o in CUISINES.items()}))
    foreign_total = {c: v[0] for c, v in flows["import"].items()}
    write_json(OUT / "foreign.json", indicator_file(
        "foreign", "%", [YEAR], {c: [round(foreign_total.get(c, 0) / t * 100, 1)] for c, t in sorted(tagged.items()) if t >= MIN_TAGGED},
        license="ODbL 1.0",
        hints={c: f"有標菜系的店 {t:,} 家，外國菜 {foreign_total.get(c, 0):,} 家（只算 {len(CUISINES)} 個有原產國的菜系）" for c, t in tagged.items()},
        hintsEn={c: f"{foreign_total.get(c, 0):,} foreign-cuisine places of {t:,} with a cuisine tag (only the {len(CUISINES)} national cuisines)" for c, t in tagged.items()}))
    write_manifest_part(OUT, "cuisines", "cuisines", {"sources": ["© OpenStreetMap contributors (ODbL 1.0), via QLever"]})

    print(f"  有 cuisine 標籤的物件 {sum(tagged.values()):,}、{len(tagged)} 國；台灣 {tagged.get('TWN')}")
    for cuisine, total, ncty, home, top, tw, out in sorted(summary, key=lambda s: -s[1]):
        print(f"    {cuisine}：{total:,} 家、{ncty} 國；本國 {home:,}；國外最多 {top}；台灣 {tw}；國外占 {out}%")
    tw = n.get("TWN", Counter())
    print(f"  台灣：{tw.most_common()}")
    print(f"  台灣菜在國外：{flows['export']['TWN']}")
