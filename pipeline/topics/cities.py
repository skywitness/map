"""城市主題：全球約 2.2 萬個城市（JRC GHS-WUP R2025A，聯合國《World Urbanization Prospects 2025》用的那一份）與各國的都市化。

- 城市的點：GHS-WUP-MTUC R2025A V1.1 的 21,777 個城市（urban centre：每 km² 1,500 人以上的 1 km 格子連成一片、
  合計 5 萬人以上），1950–2100 每 5 年一期的人口（1975 年起才有面積），每一期用那一期的範圍，還不是城市（或已經
  併進別的城市）的期沒有值；2025 年 12,140 個、2100 年 18,150 個。位置是最接近 2025 年那一期的人口加權中心點。
  點依 2025 年（沒有 2025 年的用最大的一期）人口由大到小排，地圖照順序畫，小城市疊在大城市上面。
- 1950–1970 年是用 WUP 的資料回推的（沒有網格），2025 年起是 CRISP 模型的推估，不是觀測值。
- 各國：GHS-WUP-COUNTRY-STATS R2025A（同一套網格與推估）的城市、城鎮與半密集區、鄉村人口算都市化率與住在城市的
  比例；最大城市占全國人口、百萬人口以上的城市數、最大城市的人口用 MTUC 那一期的城市算（同一國、那一期是城市的）。
- 國家：聯合國的 LocID（M49），香港、澳門、台灣分開；對不到 ISO 的（UNLocID 1910，耶路撒冷附近的 2 個城市）依位置
  標國家，不算進國家的指標。
- 中文名稱：Wikidata（CC0）裡人口 3 萬以上、在城市範圍附近、英文（或 mul）名稱或別名跟 WUP 的主要名稱相同的項目
  （sources/wikidata_places.py），名稱用 zh-tw、zh-hant、zh-hk，沒有時用伺服器轉成台灣用字的（sources/nobel.py）。
  對不到的用 WUP 的英文名稱，不自己翻譯。
- 台灣：側欄的對照（`taiwan.json`）把主要的城市跟內政部戶政司的縣市戶籍人口放在一起（sources/ris.py）。
"""
from __future__ import annotations

import math
import re
import unicodedata
from collections import defaultdict

import geoindex
from common import OUT_DIR, indicator_file, now_iso, points_file, write_json
from sources import ghsl_wup, ris, wikidata_places
from sources.nobel import zh_labels

OUT = OUT_DIR / "topics" / "cities"
EPOCHS = ghsl_wup.EPOCHS
REF = 2025  # 名稱、中心點、排序用的那一期
MILLION = 1_000_000
POP_UNIT = 1000  # 城市人口存到千人（最小的城市 5 萬人，誤差 1% 以內；存到百人時檔案大 0.3 MB）

# 台灣主要的城市跟哪些縣市對照（WUP 的 ID、主要名稱，對不上時報錯）。
# 臺北的城市範圍是臺北、新北、桃園、基隆連成一片的市區；臺中與彰化、臺南與高雄是分開的城市。
TAIWAN_AREAS = [
    (12128, "Taipei", ("臺北市", "新北市", "桃園市", "基隆市")),
    (12126, "Taichung", ("臺中市",)),
    (12135, "Kaohsiung", ("高雄市",)),
    (12132, "Tainan", ("臺南市",)),
    (12123, "Hsinchu", ("新竹市", "新竹縣")),
    (12121, "Zhanghua City", ("彰化縣",)),
]
COUNTY_EN = {
    "臺北市": "Taipei City", "新北市": "New Taipei City", "桃園市": "Taoyuan City", "基隆市": "Keelung City",
    "臺中市": "Taichung City", "高雄市": "Kaohsiung City", "臺南市": "Tainan City",
    "新竹市": "Hsinchu City", "新竹縣": "Hsinchu County", "彰化縣": "Changhua County",
}
MOI_YEAR = 2025
# 跨越國界、算在小國的城市：人口比那一國還多，最大城市占全國人口不算（各指標檔的附註）
_CROSS = "GHSL 把 {zh}連成一片的市區算一個城市、放在{place}，人口比{place}全國還多，所以沒有「最大城市占全國人口」。"
_CROSS_EN = "GHSL treats the continuous built-up area of {en} as one city placed in {place_en}; it has more people than {place_en} itself, so there is no largest-city share."
CROSS_BORDER = {
    k: (_CROSS.format(zh=zh, place=place), _CROSS_EN.format(en=en, place_en=place_en))
    for k, zh, place, en, place_en in (
        ("MAC", "澳門與珠海", "澳門", "Macao and Zhuhai", "Macao"),
        ("GIB", "直布羅陀與西班牙的拉利內阿", "直布羅陀", "Gibraltar and La Línea in Spain", "Gibraltar"),
        ("MCO", "摩納哥與周圍的法國市鎮", "摩納哥", "Monaco and the surrounding French towns", "Monaco"),
    )
}

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
# 行政區的中文名稱結尾；東亞的城市常常就叫「某某區、某某縣」，不算（地圖上的國家代碼）
ADMIN_ZH = re.compile(r"(省|州|縣|郡|區|府|地區|專區)$")
EAST_ASIA = {"CHN", "HKG", "MAC", "TWN", "JPN", "KOR", "PRK"}
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
    """WUP 的名稱有「Salinas [Santa Elena]」「Ô-á-liâu / Kezihliao」這種寫法，每一段都試"""
    parts = {name, *(p for p in re.split(r" / |\[|\]|\(|\)", name))}
    return {n for n in (_norm(p) for p in parts if p.strip()) if n}


def _km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    x = math.radians(lon2 - lon1) * math.cos(math.radians((lat1 + lat2) / 2))
    return 6371 * math.hypot(x, math.radians(lat2 - lat1))


def _match_wikidata(centres: list[ghsl_wup.UrbanCentre]) -> dict[int, list[str]]:
    """UCDB 的城市 ID → 候選的 Wikidata QID（好的在前，最多 CANDIDATES 個）。

    候選：中心點在城市範圍附近（15 km 加上跟城市面積同大的圓的半徑的 1.5 倍）、正式名稱或別名正規化後跟 WUP 的
    主要名稱相同的項目（面積用 2025 年的，那一期不是城市的用最接近的一期）。依序優先：正式名稱對到的、不是行政區的、比較近的、人口比較少的（州、省的座標常常就是首府，
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
        radius = 15 + 1.5 * math.sqrt(_ref(c.area) / math.pi)
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


def _zh_names(centres: list[ghsl_wup.UrbanCentre], matched: dict[int, list[str]], iso: dict[int, str | None]) -> dict[int, str]:
    """依序取第一個合用的中文名稱：要有漢字（zh 名稱偶爾填的是原文「Quixadá」）；東亞以外的城市，
    名稱是「省、州、縣、郡、區」結尾的是行政區（「Chihuahua」對到赤瓦瓦州、「Antwerp」對到安特衛普省），
    除非 WUP 的英文名稱本身就是行政區（「Huaiyin District」）。都不合用就用英文名稱。"""
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
            if iso[cid] not in EAST_ASIA and ADMIN_ZH.search(name) and not ADMIN.search(c.name):
                continue
            out[cid] = name
            break
    return out


# ── 國家 ─────────────────────────────────────────────────
def _ref(series: dict[int, float]) -> float:
    """2025 年的值；那一期不是城市的（之前併進別的城市、之後才出現）用最接近 2025 年的一期"""
    if REF in series:
        return series[REF]
    return series[min(series, key=lambda y: (abs(y - REF), y))] if series else 0.0


AREA_EPOCHS = [y for y in EPOCHS if y >= ghsl_wup.GRID_FROM]


def _encode(c: ghsl_wup.UrbanCentre) -> dict[str, object]:
    """cities.json 的一列（src/topics/cities.ts 的 cityValue() 還原）：

    - `f`、`l`：第一期與最後一期是城市的年份（之前還不是城市、之後併進別的城市或已經不是城市）。
    - `p1950`…`p2100`（人口）、`a1975`…`a2100`（面積 km²）：跟前一個有值的期的差，先量化再相減，還原時不會累積誤差。
      f 到 l 之外存 0（存 null 時檔案大 1.9 MB）；f 到 l 之間偶爾不是城市的期（6 個城市）存 null。
    """
    years = sorted(c.pop)
    first, last = years[0], years[-1]
    row: dict[str, object] = {"f": first, "l": last}
    for prefix, values, unit, epochs in (("p", c.pop, POP_UNIT, EPOCHS), ("a", c.area, 1, AREA_EPOCHS)):
        prev = 0
        for y in epochs:
            if y < first or y > last:
                row[f"{prefix}{y}"] = 0
                continue
            if y not in values:
                row[f"{prefix}{y}"] = None
                continue
            q = max(1, round(values[y] / unit))  # 不到 0.5 km² 的（極少數）當成 1 km²
            row[f"{prefix}{y}"] = (q - prev) * unit
            prev = q
    return row


def load_points(path=None) -> list[dict]:
    """讀回 cities.json（給其他主題用）：每個城市 {lon, lat, iso3, name, zh, pop: {期: 人口}, area: {期: km²}}"""
    import json

    with open(path or OUT / "cities.json", encoding="utf-8") as f:
        data = json.load(f)
    col = dict(zip(data["fields"], data["columns"]))
    sc = data["scale"]
    years = sorted(int(k[1:]) for k in col if k[0] == "p" and k[1:].isdigit())
    out = []
    for i in range(len(col["lon"])):
        first, last = col["f"][i] * sc["f"], col["l"][i] * sc["l"]
        rec = {"lon": col["lon"][i] * sc["lon"], "lat": col["lat"][i] * sc["lat"], "iso3": col["iso3"][i],
               "name": col["name"][i], "zh": col["zh"][i], "pop": {}, "area": {}}
        for prefix, key in (("p", "pop"), ("a", "area")):
            acc = 0
            for y in years:
                column = col.get(f"{prefix}{y}")
                v = column[i] if column else None
                if v is not None:
                    acc += v * sc[f"{prefix}{y}"]
                    if first <= y <= last:
                        rec[key][y] = acc
        out.append(rec)
    return out


def _previous_zh(centres: list[ghsl_wup.UrbanCentre]) -> dict[int, str]:
    """上一次輸出的 cities.json 裡的中文名稱：名稱正規化後相同、中心點在城市範圍附近（跟 _match_wikidata 同一個距離）"""
    import json

    path = OUT / "cities.json"
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    col = dict(zip(data["fields"], data["columns"]))
    index: dict[str, list[tuple[float, float, str]]] = defaultdict(list)
    for i, zh in enumerate(col["zh"]):
        if zh:
            for key in _variants(col["name"][i]):
                index[key].append((col["lon"][i] * data["scale"]["lon"], col["lat"][i] * data["scale"]["lat"], zh))
    out = {}
    for c in centres:
        radius = 15 + 1.5 * math.sqrt(_ref(c.area) / math.pi)
        for key in _variants(c.name):
            near = [(d, zh) for lon, lat, zh in index.get(key, ()) if (d := _km(c.lat, c.lon, lat, lon)) <= radius]
            if near:
                out[c.id] = min(near)[1]
                break
    return out


def _city_iso(centres: list[ghsl_wup.UrbanCentre]) -> dict[int, str | None]:
    """城市 → 地圖上的國家：WUP 的 UNLocID 換成 ISO；對不到的（1910）依位置"""
    out = {}
    for c in centres:
        out[c.id] = ghsl_wup.to_iso3(c.loc_id) or geoindex.country_at(c.lon, c.lat)
    return out


def build() -> None:
    centres = ghsl_wup.urban_centres()
    stats = ghsl_wup.country_stats()
    iso_of = _city_iso(centres)
    print(
        f"  GHS-WUP-MTUC：{len(centres)} 個城市（{REF} 年 {sum(1 for c in centres if REF in c.pop)} 個），"
        f"{len({c.loc_id for c in centres})} 個國家；GHS-WUP-COUNTRY-STATS {len(stats.pop)} 個國家"
    )

    # ── 中文名稱 ──
    try:
        matched = _match_wikidata(centres)
        zh = _zh_names(centres, matched, iso_of)
    except (OSError, TimeoutError) as e:
        # Wikidata 查詢服務故障或限流時（2026-10-29、10-30 都發生過），沿用上一次 cities.json 的中文名稱
        print(f"  Wikidata 查不到（{e}），沿用上一次 cities.json 的中文名稱")
        matched, zh = {}, _previous_zh(centres)

    # ── 城市的點 ──
    rows = []
    by_loc: dict[int, list[ghsl_wup.UrbanCentre]] = defaultdict(list)
    for c in sorted(centres, key=lambda c: -_ref(c.pop)):
        by_loc[c.loc_id].append(c)
        row = _encode(c)
        row |= {"lon": c.lon, "lat": c.lat, "iso3": iso_of[c.id], "name": c.name, "zh": zh.get(c.id)}
        rows.append(row)
    fields = ["lon", "lat", "f", "l", *(f"p{y}" for y in EPOCHS), *(f"a{y}" for y in AREA_EPOCHS), "iso3", "name", "zh"]
    scale = {
        "lon": 0.01, "lat": 0.01, "f": 5, "l": 5,
        **{f"p{y}": POP_UNIT for y in EPOCHS}, **{f"a{y}": 1 for y in AREA_EPOCHS},
    }
    write_json(OUT / "cities.json", points_file(rows, fields, scale))

    # ── 各國的指標 ──
    years = EPOCHS
    urban: dict[str, list[float | None]] = {}
    city_share: dict[str, list[float | None]] = {}
    primacy: dict[str, list[float | None]] = {}
    million: dict[str, list[float | None]] = {}
    largest: dict[str, list[float | None]] = {}
    world = defaultdict(lambda: [0.0, 0.0, 0.0])
    for loc, by_year in sorted(stats.pop.items()):
        key = ghsl_wup.to_iso3(loc)
        if not key or sum(sum(v) for v in by_year.values()) <= 0:
            continue
        mine = by_loc.get(loc, [])
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
            # 跨越國界的城市（澳門與珠海、直布羅陀與拉利內阿、摩納哥與周圍的法國市鎮）比全國人口還多，不算比例
            p.append(round(top / total * 100, 2) if top and top <= total else None)
            m.append(sum(1 for v in pops if v >= MILLION))
            big.append(round(top) if top else None)
            if top and top > uc * 1.001 and key not in CROSS_BORDER:
                raise RuntimeError(f"{key} {y} 年最大城市 {top:,.0f} 人比城市人口合計 {uc:,.0f} 人多（跨國的城市？寫進 CROSS_BORDER）")
        urban[key], city_share[key], primacy[key], million[key], largest[key] = u, s, p, m, big

    def world_share(i: int | None) -> list[float]:
        out = []
        for y in years:
            uc, ucl, rur = world[y]
            part = uc + ucl if i is None else uc
            out.append(round(part / (uc + ucl + rur) * 100, 2))
        return out

    all_pops = {y: [c.pop[y] for c in centres if y in c.pop] for y in years}
    extra = {"projectionFrom": ghsl_wup.PROJECTION_FROM}

    # ── 台灣：跟內政部的縣市人口對照 ──
    moi = ris.county_population(MOI_YEAR)
    twn = {c.id: c for c in by_loc[158]}
    taiwan_rows = []
    for cid, name, counties in TAIWAN_AREAS:
        c = twn.get(cid)
        if not c or c.name != name:
            raise RuntimeError(f"WUP 的台灣城市 {cid} 不是 {name}（{c.name if c else '沒有這個 ID'}），TAIWAN_AREAS 要更新")
        taiwan_rows.append({
            "name": c.name, "zh": zh.get(cid), "pop": round(c.pop[MOI_YEAR]), "area": round(c.area[MOI_YEAR], 1),
            "counties": list(counties), "countiesEn": [COUNTY_EN[k] for k in counties],
            "moi": sum(moi[k] for k in counties),
        })
    ghsl_total = sum(stats.pop[158][MOI_YEAR])
    moi_total = sum(moi.values())
    taipei = taiwan_rows[0]
    tw_cities = sum(1 for c in twn.values() if MOI_YEAR in c.pop)
    write_json(OUT / "taiwan.json", {
        "year": MOI_YEAR, "ghslTotal": round(ghsl_total), "moiTotal": moi_total,
        "cities": tw_cities, "rows": taiwan_rows,
    })

    tw_uc, tw_ucl, _ = stats.pop[158][MOI_YEAR]
    diff = (ghsl_total / moi_total - 1) * 100
    tw_note = (
        f"依 GHSL 的 1 km 人口網格算出，台灣 {MOI_YEAR} 年 {tw_uc / ghsl_total * 100:.1f}% 住在城市、"
        f"{tw_ucl / ghsl_total * 100:.1f}% 住在城鎮與半密集區（{MOI_YEAR} 年起是推估）。GHSL 的台灣總人口 "
        f"{ghsl_total / 1e4:,.0f} 萬人（配合聯合國 WPP 2024），比內政部 {MOI_YEAR} 年底的戶籍人口 "
        f"{moi_total / 1e4:,.0f} 萬人{'多' if diff >= 0 else '少'} {abs(diff):.1f}%。"
    )
    tw_note_en = (
        f"From the GHSL 1 km population grid, {tw_uc / ghsl_total * 100:.1f}% of Taiwan's people lived in cities "
        f"and {tw_ucl / ghsl_total * 100:.1f}% in towns and semi-dense areas in {MOI_YEAR} (projected from {MOI_YEAR} on). "
        f"GHSL puts Taiwan's population at {ghsl_total / 1e6:.2f} million (aligned with UN WPP 2024), "
        f"{abs(diff):.1f}% {'more' if diff >= 0 else 'fewer'} than the {moi_total / 1e6:.2f} million registered at the "
        f"end of {MOI_YEAR} (Ministry of the Interior)."
    )
    city_note = (
        f"台灣最大的城市是 GHSL 的「Taipei」：臺北、新北、桃園、基隆連成一片的市區（{taipei['area']:.0f} km²），"
        f"{MOI_YEAR} 年 {taipei['pop'] / 1e4:,.0f} 萬人；這四市整個轄區的戶籍人口是 {taipei['moi'] / 1e4:,.0f} 萬人"
        f"（內政部 {MOI_YEAR} 年底）。臺中與彰化、臺南與高雄是分開的城市。城市是連續的市區，不是行政區。"
    )
    city_note_en = (
        f"Taiwan's largest city in GHSL, “Taipei”, is the continuous built-up area spanning Taipei, New Taipei, "
        f"Taoyuan and Keelung ({taipei['area']:.0f} km²), with {taipei['pop'] / 1e6:.2f} million people in {MOI_YEAR}; "
        f"the four municipalities as a whole had {taipei['moi'] / 1e6:.2f} million registered residents at the end of "
        f"{MOI_YEAR} (Ministry of the Interior). Taichung and Changhua, and Tainan and Kaohsiung, are separate cities. "
        f"Cities are continuous urban areas, not administrative units."
    )

    def notes(text_zh: str, text_en: str, cross: bool = False) -> dict:
        more = CROSS_BORDER if cross else {}
        return {"notes": {"TWN": text_zh} | {k: v[0] for k, v in more.items()},
                "notesEn": {"TWN": text_en} | {k: v[1] for k, v in more.items()}}

    write_json(OUT / "urban.json", indicator_file(
        "urban", "%", years, urban, aggregates={"WLD": world_share(None)}, **extra, **notes(tw_note, tw_note_en)))
    write_json(OUT / "city-share.json", indicator_file(
        "city-share", "%", years, city_share, aggregates={"WLD": world_share(0)}, **extra, **notes(tw_note, tw_note_en)))
    write_json(OUT / "primacy.json", indicator_file(
        "primacy", "%", years, primacy, **extra, **notes(city_note, city_note_en, cross=True)))
    write_json(OUT / "million.json", indicator_file(
        "million", "個", years, million,
        aggregates={"WLD": [sum(1 for v in all_pops[y] if v >= MILLION) for y in years]}, **extra))
    write_json(OUT / "largest.json", indicator_file(
        "largest", "人", years, largest,
        aggregates={"WLD": [round(max(all_pops[y])) for y in years]}, **extra, **notes(city_note, city_note_en, cross=True)))

    build_built(stats)

    big = [c for c in centres if c.pop.get(REF, 0) >= 300_000]
    named_big = sum(1 for c in big if c.id in zh)
    write_json(OUT / "manifest.json", {
        "generatedAt": now_iso(),
        "cities": len(centres),
        "epochs": EPOCHS,
        "zhNames": {"all": len(zh), "over300k": named_big, "over300kTotal": len(big)},
        "sources": [ghsl_wup.CITATION_MTUC, ghsl_wup.CITATION_STATS, ghsl_wup.CITATION_PACKAGE],
    })

    for y in (1950, 1975, 2025, 2050, 2100):
        w = world[y]
        print(
            f"  {y} 年世界：城市 {w[0] / sum(w) * 100:.1f}%、城市＋城鎮 {(w[0] + w[1]) / sum(w) * 100:.1f}%；"
            f"城市 {len(all_pops[y])} 個，百萬人口以上 {sum(1 for v in all_pops[y] if v >= MILLION)} 個"
        )
    print(f"  中文名稱：{len(zh)} 個城市（{REF} 年 30 萬人以上 {named_big}/{len(big)}），Wikidata 對到 {len(matched)} 個")
    print(f"  台灣：{tw_cities} 個城市，城市 {tw_uc / ghsl_total * 100:.1f}%、GHSL 總人口 {ghsl_total:,.0f}、內政部 {moi_total:,}")
    for r in taiwan_rows:
        print(f"    {r['zh'] or r['name']}：GHSL {r['pop']:,}（{r['area']:.0f} km²）／{'＋'.join(r['counties'])} {r['moi']:,}")
    missing = [c.name for c in sorted(twn.values(), key=lambda c: -_ref(c.pop)) if c.id not in zh]
    print(f"  台灣沒有中文名稱的：{missing}")


def build_built(stats: ghsl_wup.CountryStats | None = None) -> None:
    """建物面積的三個指標（2026-10-29 擴充，製作手冊第五批 38）：GHS-WUP-COUNTRY-STATS 的 BU_km2，屋頂覆蓋的面積，
    不是建成區的範圍；1975 年起才有（之前沒有網格）。不用 Wikidata，可以單獨跑
    （`python -c "from topics import cities; cities.build_built()"`）"""
    stats = stats or ghsl_wup.country_stats()
    years = EPOCHS
    first = years.index(ghsl_wup.GRID_FROM)
    extra = {"projectionFrom": ghsl_wup.PROJECTION_FROM}
    built: dict[str, list[float | None]] = {}
    built_cap: dict[str, list[float | None]] = {}
    built_growth: dict[str, list[float | None]] = {}
    world_built, world_pop = [0.0] * len(years), [0.0] * len(years)
    for loc, by_year in sorted(stats.built.items()):
        key = ghsl_wup.to_iso3(loc)
        if not key or loc not in stats.pop:
            continue
        km2 = [by_year.get(y) for y in years]
        people = [sum(stats.pop[loc][y]) for y in years]
        for i in range(len(years)):
            if km2[i] is not None:
                world_built[i] += km2[i]
                world_pop[i] += people[i]
        if not any(km2[first:]):
            continue
        base = km2[first]
        built[key] = [None if v is None else round(v, 1) for v in km2]
        built_cap[key] = [None if b is None or p < 1000 else round(b * 1e6 / p, 1) for b, p in zip(km2, people)]
        built_growth[key] = [None if v is None or not base or base < 1 else round(v / base, 2) for v in km2]

    def world(values: list[float]) -> list[float | None]:
        return [None if i < first else v for i, v in enumerate(values)]

    write_json(OUT / "built.json", indicator_file(
        "built", "km²", years, built, aggregates={"WLD": world([round(v) for v in world_built])}, **extra))
    write_json(OUT / "built-per-capita.json", indicator_file(
        "built-per-capita", "m²/人", years, built_cap,
        aggregates={"WLD": world([round(b * 1e6 / p, 1) if p else 0 for b, p in zip(world_built, world_pop)])}, **extra))
    write_json(OUT / "built-growth.json", indicator_file(
        "built-growth", "倍", years, built_growth,
        aggregates={"WLD": world([round(v / world_built[first], 2) for v in world_built])}, **extra))
    i2020, i2025 = years.index(2020), years.index(2025)
    print(f"  建物面積：世界 1975 年 {world_built[first]:,.0f} km²、2020 年 {world_built[i2020]:,.0f} km²"
          f"（{world_built[i2020] / world_built[first]:.2f} 倍）、2100 年 {world_built[-1]:,.0f} km²；"
          f"台灣 {built['TWN'][first]} → {built['TWN'][i2020]} km²，人均 {built_cap['TWN'][i2020]} m²")
    for name, series in (("倍數", built_growth), ("人均", built_cap)):
        ranked = sorted((v[i2020], k) for k, v in series.items() if v[i2020] is not None)
        print(f"  2020 年{name}：最高 {ranked[-5:][::-1]}，最低 {ranked[:3]}")
    for k in ("AUS", "USA", "JPN", "CHN", "TWN", "BGD", "ETH", "KEN"):
        if k in built_growth:
            print(f"    {k}：2020 年 {built_growth[k][i2020]} 倍、人均 {built_cap[k][i2020]} m²、2025 年 {built[k][i2025]} km²")
