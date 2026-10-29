"""城市主題：全球約 1.1 萬個城市（GHSL Urban Centre Database 2025）與各國的都市化。

- 城市的點：UCDB R2024A 的 11,422 個城市（urban centre：每 km² 1,500 人以上的 1 km 格子連成一片、合計 5 萬人以上），
  1975–2030 每 5 年一期的人口與面積用多時期城市（MTUC：每一期用那一期的範圍，還不是城市的期沒有值），
  位置是 UCDB 的人口加權中心點。點依 2025 年人口由大到小排，地圖照順序畫，小城市疊在大城市上面。
- 各國：GHS-COUNTRY-STATS R2024A（同一套網格）的城市、城鎮與半密集區、鄉村人口算都市化率與住在城市的比例；
  最大城市占全國人口、百萬人口以上的城市數、最大城市的人口用 MTUC 那一期的城市算（同一國、那一期是城市的）。
- 國家：UCDB 用 GADM 的國名，換成 ISO；GADM 的中國含香港、澳門（GHSL 的國家統計也是），統計算在中國，
  但香港、澳門的點標成 HKG、MAC（地圖上的形狀），滑過時標出香港、點一下選取香港。科索沃 XKO → XKX、北賽普勒斯 ZNC → _CYN。
- 中文名稱：Wikidata（CC0）裡人口 3 萬以上、在城市範圍附近、英文（或 mul）名稱或別名跟 UCDB 的主要名稱相同的項目
  （sources/wikidata_places.py），名稱用 zh-tw、zh-hant、zh-hk，沒有時用伺服器轉成台灣用字的（sources/nobel.py）。
  對不到的用 UCDB 的英文名稱，不自己翻譯。
- 台灣：側欄的對照（`taiwan.json`）把主要的城市跟內政部戶政司的縣市戶籍人口放在一起（sources/ris.py）。
"""
from __future__ import annotations

import math
import re
import unicodedata
from collections import defaultdict

import geoindex
from common import OUT_DIR, indicator_file, now_iso, points_file, write_json
from sources import ghsl_ucdb, ris, wikidata_places
from sources.countries import from_name
from sources.nobel import zh_labels

OUT = OUT_DIR / "topics" / "cities"
EPOCHS = ghsl_ucdb.EPOCHS
MILLION = 1_000_000
# GADM 的代碼跟地圖不同的；其他沒有形狀、幾乎沒有人的（亞克羅提利與德凱利亞、裏海、克利珀頓島、西沙、南沙）不輸出
GADM_TO_MAP = {"XKO": "XKX", "ZNC": "_CYN"}
GADM_SKIP = {"XAD", "XCA", "XCL", "XPI", "XSP"}
# GADM 的中國含港澳：點在這兩個形狀裡的城市標成港澳（統計仍算在中國）
CHINA_PARTS = {"HKG", "MAC"}
MORE_NAMES = 4  # tooltip 列出範圍內的其他地名，最多幾個
POP_UNIT = 100  # 城市人口存到百人（最小的城市 5 萬人，誤差 0.1% 以內）

# 台灣主要的城市跟哪些縣市對照（UCDB 的 ID、主要名稱，對不上時報錯）。
# 臺北的城市範圍是臺北、新北、桃園、基隆連成一片的市區；臺中與彰化、臺南與高雄在 UCDB 是分開的城市。
TAIWAN_AREAS = [
    (1142, "Taipei", ("臺北市", "新北市", "桃園市", "基隆市")),
    (906, "Taichung", ("臺中市",)),
    (1919, "Kaohsiung", ("高雄市",)),
    (1744, "Tainan", ("臺南市",)),
    (501, "Hsinchu", ("新竹市", "新竹縣")),
    (349, "Zhanghua City", ("彰化縣",)),
]
COUNTY_EN = {
    "臺北市": "Taipei City", "新北市": "New Taipei City", "桃園市": "Taoyuan City", "基隆市": "Keelung City",
    "臺中市": "Taichung City", "高雄市": "Kaohsiung City", "臺南市": "Tainan City",
    "新竹市": "Hsinchu City", "新竹縣": "Hsinchu County", "彰化縣": "Changhua County",
}
MOI_YEAR = 2025

# ── 名稱比對 ──────────────────────────────────────────────
# 比對前去掉的字（城市、鎮的通稱）；縣、省、區不去掉，否則「Miaoli」會對到苗栗縣
GENERIC = re.compile(r"\b(city of|city|shi|municipality|municipal corporation|town|township|metropolitan city|metropolis)\b")
# 名稱或別名裡有這些字的是行政區：只靠別名對到的行政區不用（例如 Kocaeli 對到科賈埃利省）
ADMIN = re.compile(
    r"\b(county|district|province|prefecture|region|state|governorate|division|department|oblast|krai|regency|"
    r"municipality|metropolitan area|urban area|agglomeration|landkreis|kreis|bezirk|arrondissement|raion|rayon|"
    r"okrug|powiat|voivodeship|canton|comarca)\b",
    re.I,
)
# Wikidata 中文名稱裡的消歧義括號（「萊昂 (瓜納華托州)」）
DISAMBIGUATION = re.compile(r"\s*[（(][^）)]*[）)]\s*$")
CJK = re.compile(r"[㐀-鿿豈-﫿]")
# 行政區的中文名稱結尾；東亞的城市常常就叫「某某區、某某縣」，不算（UCDB 的 GADM 國名）
ADMIN_ZH = re.compile(r"(省|州|縣|郡|區|府|地區|專區)$")
EAST_ASIA = {"China", "Taiwan", "Japan", "South Korea", "North Korea"}
CANDIDATES = 3  # 每個城市最多查幾個 Wikidata 候選的中文名稱
# zh-tw 名稱裡偶爾有 sources/nobel.py 的 S2T 沒收的簡體字（2026-10 實際出現的）
EXTRA_S2T = str.maketrans("县镇区乡红颠图锡横梦敍", "縣鎮區鄉紅顛圖錫橫夢敘")


def _norm(text: str) -> str:
    s = unicodedata.normalize("NFKD", text)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"[‘’'`ʼ‘]", "", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = GENERIC.sub(" ", s)
    return re.sub(r"\s+", " ", s).strip()


def _variants(name: str) -> set[str]:
    """UCDB 的名稱有「Salinas [Santa Elena]」「Ô-á-liâu / Kezihliao」這種寫法，每一段都試"""
    parts = {name, *(p for p in re.split(r" / |\[|\]|\(|\)", name))}
    return {n for n in (_norm(p) for p in parts if p.strip()) if n}


def _km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    x = math.radians(lon2 - lon1) * math.cos(math.radians((lat1 + lat2) / 2))
    return 6371 * math.hypot(x, math.radians(lat2 - lat1))


def _match_wikidata(centres: list[ghsl_ucdb.UrbanCentre]) -> dict[int, list[str]]:
    """UCDB 的城市 ID → 候選的 Wikidata QID（好的在前，最多 CANDIDATES 個）。

    候選：中心點在城市範圍附近（15 km 加上跟城市面積同大的圓的半徑的 1.5 倍）、正式名稱或別名正規化後跟 UCDB 的
    主要名稱相同的項目。依序優先：正式名稱對到的、不是行政區的、比較近的、人口比較少的（州、省的座標常常就是首府，
    距離一樣時人口少的才是城市本身）。只靠別名對到的行政區不用。名稱有逗號的（「Washington, D.C.」）逗號前那段也當別名。
    """
    index: dict[str, list[tuple[int, wikidata_places.Place]]] = defaultdict(list)
    for place in wikidata_places.places():
        for label in place.labels:
            index[_norm(label)].append((0, place))
        for alias in place.aliases | {n.split(",")[0] for n in place.labels | place.aliases if "," in n}:
            index[_norm(alias)].append((1, place))
    out: dict[int, list[str]] = {}
    for c in centres:
        radius = 15 + 1.5 * math.sqrt(c.area[2025] / math.pi)
        ranked: dict[str, tuple] = {}
        for key in _variants(c.name):
            for kind, place in index.get(key, ()):
                admin = any(ADMIN.search(n) for n in place.labels)
                if kind == 1 and admin:
                    continue
                d = _km(c.lat, c.lon, place.lat, place.lon)
                if d > radius:
                    continue
                rank = (kind, int(admin), round(d, 1), place.population)
                if place.qid not in ranked or rank < ranked[place.qid]:
                    ranked[place.qid] = rank
        if ranked:
            out[c.id] = sorted(ranked, key=ranked.__getitem__)[:CANDIDATES]
    return out


def _zh_names(centres: list[ghsl_ucdb.UrbanCentre], matched: dict[int, list[str]]) -> dict[int, str]:
    """依序取第一個合用的中文名稱：要有漢字（zh 名稱偶爾填的是原文「Quixadá」）；東亞以外的城市，
    名稱是「省、州、縣、郡、區」結尾的是行政區（「Chihuahua」對到赤瓦瓦州、「Antwerp」對到安特衛普省），
    除非 UCDB 的英文名稱本身就是行政區（「Huaiyin District」）。都不合用就用英文名稱。"""
    labels = zh_labels(sorted({q for qids in matched.values() for q in qids}), prefix="cities")
    by_id = {c.id: c for c in centres}
    out = {}
    for cid, qids in matched.items():
        c = by_id[cid]
        for qid in qids:
            name, _lang = labels.get(qid, (None, None))
            if not name or not CJK.search(name):
                continue
            name = DISAMBIGUATION.sub("", name).translate(EXTRA_S2T)
            if c.country not in EAST_ASIA and ADMIN_ZH.search(name) and not ADMIN.search(c.name):
                continue
            out[cid] = name
            break
    return out


# ── 國家 ─────────────────────────────────────────────────
def _plain(text: str) -> str:
    s = unicodedata.normalize("NFKD", text)
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


def _country_codes(centres: list[ghsl_ucdb.UrbanCentre], stats: ghsl_ucdb.CountryStats) -> dict[str, str]:
    """UCDB 的 GADM 國名 → GADM ISO（UCDB 的國名有重音，GHS-COUNTRY-STATS 的沒有：México / Mexico）"""
    plain = {_plain(name): iso for name, iso in stats.names.items()}
    out = {}
    for name in {c.country for c in centres}:
        iso = stats.names.get(name) or plain.get(_plain(name)) or from_name(name)
        if not iso or iso not in stats.pop:
            raise RuntimeError(f"UCDB 的國名對不到 GHS-COUNTRY-STATS：{name}")
        out[name] = iso
    return out


def build() -> None:
    centres = ghsl_ucdb.urban_centres()
    stats = ghsl_ucdb.country_stats()
    gadm = _country_codes(centres, stats)
    print(f"  UCDB 2025：{len(centres)} 個城市，{len(set(gadm.values()))} 個國家；GHS-COUNTRY-STATS {len(stats.pop)} 個國家")

    # ── 中文名稱 ──
    matched = _match_wikidata(centres)
    zh = _zh_names(centres, matched)

    # ── 城市的點 ──
    rows = []
    by_stats_country: dict[str, list[ghsl_ucdb.UrbanCentre]] = defaultdict(list)
    for c in sorted(centres, key=lambda c: -c.pop[2025]):
        iso = gadm[c.country]
        by_stats_country[iso].append(c)
        point_iso = GADM_TO_MAP.get(iso, iso)
        if iso == "CHN":
            here = geoindex.country_at(c.lon, c.lat)
            if here in CHINA_PARTS:
                point_iso = here
        # 範圍內的其他地名：主要名稱裡已經有的（「Zhuhai [Macau]」的 Zhuhai）不再列
        main = _variants(c.name)
        all_others = [n for n in c.names if _norm(n) not in main]
        others = all_others[:MORE_NAMES]
        row: dict[str, object] = {
            "lon": c.lon, "lat": c.lat,
            "iso3": None if iso in GADM_SKIP else point_iso,
            "name": c.name,
            "zh": zh.get(c.id),
            # 範圍內的其他地名（分號分隔，多的寫「…」）
            "more": "; ".join(others) + ("; …" if len(all_others) > MORE_NAMES else "") if others else None,
        }
        # 每一期跟前一期的差（前一期還不是城市時是那一期本身），gzip 後小 14%；先量化再相減，還原時不會累積誤差
        for prefix, values, unit in (("p", c.pop, POP_UNIT), ("a", c.area, 1)):
            prev = None
            for y in EPOCHS:
                q = round(values[y] / unit) if y in values else None
                row[f"{prefix}{y}"] = None if q is None else (q - (prev or 0)) * unit
                prev = q
        rows.append(row)
    fields = ["lon", "lat", *(f"p{y}" for y in EPOCHS), *(f"a{y}" for y in EPOCHS), "iso3", "name", "zh", "more"]
    scale = {"lon": 0.01, "lat": 0.01, **{f"p{y}": POP_UNIT for y in EPOCHS}, **{f"a{y}": 1 for y in EPOCHS}}
    write_json(OUT / "cities.json", points_file(rows, fields, scale))

    # ── 各國的指標 ──
    years = EPOCHS
    urban: dict[str, list[float | None]] = {}
    city_share: dict[str, list[float | None]] = {}
    primacy: dict[str, list[float | None]] = {}
    million: dict[str, list[float | None]] = {}
    largest: dict[str, list[float | None]] = {}
    world = defaultdict(lambda: [0.0, 0.0, 0.0])
    for iso, by_year in sorted(stats.pop.items()):
        if iso in GADM_SKIP:
            continue
        key = GADM_TO_MAP.get(iso, iso)
        if sum(sum(v) for v in by_year.values()) <= 0:
            continue
        mine = by_stats_country.get(iso, [])
        u, s, p, m, big = [], [], [], [], []
        for y in years:
            uc, ucl, rur = by_year[y]
            total = uc + ucl + rur
            for i, v in enumerate((uc, ucl, rur)):
                world[y][i] += v
            if total <= 0:
                u.append(None); s.append(None); p.append(None); m.append(None); big.append(None)
                continue
            pops = [c.pop[y] for c in mine if y in c.pop]
            top = max(pops) if pops else None
            u.append(round((uc + ucl) / total * 100, 2))
            s.append(round(uc / total * 100, 2))
            p.append(round(top / total * 100, 2) if top else None)
            m.append(sum(1 for v in pops if v >= MILLION))
            big.append(round(top) if top else None)
            if top and top > uc * 1.001:
                print(f"  注意：{iso} {y} 年最大城市 {top:,.0f} 人比城市人口合計 {uc:,.0f} 人多（跨國的城市）")
        urban[key], city_share[key], primacy[key], million[key], largest[key] = u, s, p, m, big

    def world_share(i: int | None) -> list[float]:
        out = []
        for y in years:
            uc, ucl, rur = world[y]
            part = uc + ucl if i is None else uc
            out.append(round(part / (uc + ucl + rur) * 100, 2))
        return out

    all_pops = {y: [c.pop[y] for c in centres if y in c.pop] for y in years}
    extra = {"projectionFrom": ghsl_ucdb.PROJECTION_FROM}

    # ── 台灣：跟內政部的縣市人口對照 ──
    moi = ris.county_population(MOI_YEAR)
    twn = {c.id: c for c in by_stats_country["TWN"]}
    taiwan_rows = []
    for cid, name, counties in TAIWAN_AREAS:
        c = twn.get(cid)
        if not c or c.name != name:
            raise RuntimeError(f"UCDB 的台灣城市 {cid} 不是 {name}（{c.name if c else '沒有這個 ID'}），TAIWAN_AREAS 要更新")
        taiwan_rows.append({
            "name": c.name, "zh": zh.get(cid), "pop": round(c.pop[MOI_YEAR]), "area": c.area[MOI_YEAR],
            "counties": list(counties), "countiesEn": [COUNTY_EN[k] for k in counties],
            "moi": sum(moi[k] for k in counties),
        })
    ghsl_total = sum(stats.pop["TWN"][MOI_YEAR])
    moi_total = sum(moi.values())
    taipei = taiwan_rows[0]
    write_json(OUT / "taiwan.json", {
        "year": MOI_YEAR, "ghslTotal": round(ghsl_total), "moiTotal": moi_total,
        "cities": len(twn), "rows": taiwan_rows,
    })

    tw_uc, tw_ucl, _ = stats.pop["TWN"][MOI_YEAR]
    tw_note = (
        f"依 GHSL 的 1 km 人口網格算出，台灣 {MOI_YEAR} 年 {tw_uc / ghsl_total * 100:.1f}% 住在城市、"
        f"{tw_ucl / ghsl_total * 100:.1f}% 住在城鎮與半密集區。GHSL 的台灣總人口 {ghsl_total / 1e4:,.0f} 萬人"
        f"（配合聯合國 WPP 2022），比內政部 {MOI_YEAR} 年底的戶籍人口 {moi_total / 1e4:,.0f} 萬人多 "
        f"{(ghsl_total / moi_total - 1) * 100:.1f}%。"
    )
    tw_note_en = (
        f"From the GHSL 1 km population grid, {tw_uc / ghsl_total * 100:.1f}% of Taiwan's people lived in cities "
        f"and {tw_ucl / ghsl_total * 100:.1f}% in towns and semi-dense areas in {MOI_YEAR}. GHSL puts Taiwan's population "
        f"at {ghsl_total / 1e6:.2f} million (aligned with UN WPP 2022), {(ghsl_total / moi_total - 1) * 100:.1f}% more than "
        f"the {moi_total / 1e6:.2f} million registered at the end of {MOI_YEAR} (Ministry of the Interior)."
    )
    city_note = (
        f"台灣最大的城市是 UCDB 的「Taipei」：臺北、新北、桃園、基隆連成一片的市區（{taipei['area']:.0f} km²），"
        f"{MOI_YEAR} 年 {taipei['pop'] / 1e4:,.0f} 萬人；這四市整個轄區的戶籍人口是 {taipei['moi'] / 1e4:,.0f} 萬人"
        f"（內政部 {MOI_YEAR} 年底）。臺中與彰化、臺南與高雄在 UCDB 是分開的城市。城市是連續的市區，不是行政區。"
    )
    city_note_en = (
        f"Taiwan's largest city in the UCDB, “Taipei”, is the continuous built-up area spanning Taipei, New Taipei, "
        f"Taoyuan and Keelung ({taipei['area']:.0f} km²), with {taipei['pop'] / 1e6:.2f} million people in {MOI_YEAR}; "
        f"the four municipalities as a whole had {taipei['moi'] / 1e6:.2f} million registered residents at the end of "
        f"{MOI_YEAR} (Ministry of the Interior). Taichung and Changhua, and Tainan and Kaohsiung, are separate cities in "
        f"the UCDB. Cities are continuous urban areas, not administrative units."
    )

    def notes(text_zh: str, text_en: str) -> dict:
        return {"notes": {"TWN": text_zh}, "notesEn": {"TWN": text_en}}

    write_json(OUT / "urban.json", indicator_file(
        "urban", "%", years, urban, aggregates={"WLD": world_share(None)}, **extra, **notes(tw_note, tw_note_en)))
    write_json(OUT / "city-share.json", indicator_file(
        "city-share", "%", years, city_share, aggregates={"WLD": world_share(0)}, **extra, **notes(tw_note, tw_note_en)))
    write_json(OUT / "primacy.json", indicator_file(
        "primacy", "%", years, primacy, **extra, **notes(city_note, city_note_en)))
    write_json(OUT / "million.json", indicator_file(
        "million", "個", years, million,
        aggregates={"WLD": [sum(1 for v in all_pops[y] if v >= MILLION) for y in years]}, **extra))
    write_json(OUT / "largest.json", indicator_file(
        "largest", "人", years, largest,
        aggregates={"WLD": [round(max(all_pops[y])) for y in years]}, **extra, **notes(city_note, city_note_en)))

    build_built(stats)

    big = [c for c in centres if c.pop[2025] >= 300_000]
    named_big = sum(1 for c in big if c.id in zh)
    write_json(OUT / "manifest.json", {
        "generatedAt": now_iso(),
        "cities": len(centres),
        "epochs": EPOCHS,
        "zhNames": {"all": len(zh), "over300k": named_big, "over300kTotal": len(big)},
        "sources": [ghsl_ucdb.CITATION_UCDB, ghsl_ucdb.CITATION_STATS],
    })

    w25 = world[2025]
    print(
        f"  2025 年世界：城市 {w25[0] / sum(w25) * 100:.1f}%、城市＋城鎮 {(w25[0] + w25[1]) / sum(w25) * 100:.1f}%；"
        f"百萬人口以上的城市 {sum(1 for v in all_pops[2025] if v >= MILLION)} 個"
    )
    print(f"  中文名稱：{len(zh)} 個城市（30 萬人以上 {named_big}/{len(big)}），Wikidata 對到 {len(matched)} 個")
    print(f"  台灣：{len(twn)} 個城市，城市 {tw_uc / ghsl_total * 100:.1f}%、GHSL 總人口 {ghsl_total:,.0f}、內政部 {moi_total:,}")
    for r in taiwan_rows:
        print(f"    {r['zh'] or r['name']}：UCDB {r['pop']:,}（{r['area']:.0f} km²）／{'＋'.join(r['counties'])} {r['moi']:,}")


def build_built(stats: ghsl_ucdb.CountryStats | None = None) -> None:
    """建物面積的三個指標（2026-10-29 擴充，製作手冊第五批 38）：GHS-COUNTRY-STATS 的 BU_S_km2_L1，屋頂覆蓋的面積，
    不是建成區的範圍。不用 Wikidata，可以單獨跑（`python -c "from topics import cities; cities.build_built()"`）"""
    stats = stats or ghsl_ucdb.country_stats()
    years = EPOCHS
    extra = {"projectionFrom": ghsl_ucdb.PROJECTION_FROM}
    built: dict[str, list[float | None]] = {}
    built_cap: dict[str, list[float | None]] = {}
    built_growth: dict[str, list[float | None]] = {}
    world_built, world_pop = [0.0] * len(years), [0.0] * len(years)
    for iso, by_year in sorted(stats.built.items()):
        if iso in GADM_SKIP or iso not in stats.pop:
            continue
        key = GADM_TO_MAP.get(iso, iso)
        km2 = [by_year[y] for y in years]
        people = [sum(stats.pop[iso][y]) for y in years]
        for i in range(len(years)):
            world_built[i] += km2[i]
            world_pop[i] += people[i]
        if not any(km2):
            continue
        built[key] = [round(v, 1) for v in km2]
        built_cap[key] = [round(b * 1e6 / p, 1) if p >= 1000 else None for b, p in zip(km2, people)]
        built_growth[key] = [round(v / km2[0], 2) if km2[0] >= 1 else None for v in km2]
    write_json(OUT / "built.json", indicator_file(
        "built", "km²", years, built, aggregates={"WLD": [round(v) for v in world_built]}, **extra))
    write_json(OUT / "built-per-capita.json", indicator_file(
        "built-per-capita", "m²/人", years, built_cap,
        aggregates={"WLD": [round(b * 1e6 / p, 1) for b, p in zip(world_built, world_pop)]}, **extra))
    write_json(OUT / "built-growth.json", indicator_file(
        "built-growth", "倍", years, built_growth,
        aggregates={"WLD": [round(v / world_built[0], 2) for v in world_built]}, **extra))
    i2020 = years.index(2020)
    print(f"  建物面積：世界 1975 年 {world_built[0]:,.0f} km²、2020 年 {world_built[i2020]:,.0f} km²"
          f"（{world_built[i2020] / world_built[0]:.2f} 倍）；台灣 {built['TWN'][0]} → {built['TWN'][i2020]} km²，"
          f"人均 {built_cap['TWN'][i2020]} m²")
    for name, series in (("倍數", built_growth), ("人均", built_cap)):
        ranked = sorted((v[i2020], k) for k, v in series.items() if v[i2020] is not None)
        print(f"  2020 年{name}：最高 {ranked[-5:][::-1]}，最低 {ranked[:3]}")


