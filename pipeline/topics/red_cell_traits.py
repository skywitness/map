"""紅血球的遺傳性狀（2026-11-03，製作手冊第十九批 289；醫藥分類的基因組）：蠶豆症（G6PD 缺乏）、鐮刀型血球、
血紅素 C（HbC）、Duffy 陰性。

**資料**：
- Howes 等 2012〈G6PD Deficiency Prevalence and Estimates of Affected Populations in Malaria Endemic Countries〉
  《PLoS Medicine》9(11):e1001339 的 Table S1（PDF）：99 個瘧疾流行國的 G6PD 缺乏等位基因頻率（≈ 男性的盛行率）。
- Piel 等 2013〈Global Burden of Sickle Cell Anaemia in Children under Five, 2010–2050〉《PLoS Medicine》10(7):e1001484
  的 Table S2（PDF）：約 190 國新生兒得到鐮刀型血球症（SCA，HbSS）的比例與 2010 年的人數。
- Malaria Atlas Project（MAP）的 5 km 網格（WCS，`SCALEFACTOR=0.25` 抽稀成約 0.17°）：G6PD 缺乏、HbS 的等位基因頻率
  （全球；G6PD 只涵蓋 2010 年的瘧疾流行區）、HbC 的等位基因頻率（非洲）、Duffy 陰性的比例（全球）。
**授權**：兩篇論文 CC BY（`<permissions>`：「distributed under the terms of the Creative Commons Attribution License」）；
MAP 的地圖「Creative Commons Attribution 3.0 Unported License」（malariaatlas.org/open-access-policy，要寫引用）。
Piel 2010（Nature Communications，CC BY-NC-SA）、Piel 2013 Lancet（版權所有）與 Howes 2011（Duffy 的論文，
CC BY-NC-SA）不用，只用 MAP 的網格。
**國家值**：
- 蠶豆症：Howes 的表；表上沒有的國家（不是 2010 年的瘧疾流行國，例如台灣）用 MAP 網格在國內的面積平均（附註寫明）。
- 鐮刀型血球症：Piel 的表（每 1,000 名新生兒）。
- HbC、Duffy 陰性：MAP 網格在國內的面積平均（每格的中心點歸國家，依緯度的餘弦加權；不是人口加權）。
**台灣的蠶豆症**（2026-11-03 補）：附註另寫國健署新生兒篩檢的個案數（`sources/hpa_newborn.py`，政府資料開放授權條款第 1 版）；
篩檢的是男女新生兒的酵素活性，跟等位基因頻率不是同一個量，地圖上的值仍是網格推估。
**地圖的網格**：四張網格依指標的門檻分級，存成 8 位元灰階 PNG（代碼 1–N，0 不畫），前端的類別網格圖層照原始解析度畫。
"""
from __future__ import annotations

import re
from collections import defaultdict
from pathlib import Path

import numpy as np
import rasterio

import geoindex
from common import OUT_DIR, append_note, download, indicator_file, now_iso, write_json
from sources import countries, hpa_newborn, pdfreader
from topics.koppen import png_gray

OUT = OUT_DIR / "topics" / "red-cell-traits"
HOWES = "https://journals.plos.org/plosmedicine/article/file?type=supplementary&id=10.1371/journal.pmed.1001339.s008"
PIEL = "https://journals.plos.org/plosmedicine/article/file?type=supplementary&id=10.1371/journal.pmed.1001484.s003"
WCS = ("https://data.malariaatlas.org/geoserver/ows?service=WCS&version=2.0.1&request=GetCoverage"
       "&coverageId=Blood_Disorders__201201_{name}&format=image/geotiff&SCALEFACTOR=0.25")
# 網格：檔名、分級門檻（%，跟前端指標的門檻一樣）
GRIDS = {
    "g6pd": ("Global_G6PDd_Allele_Frequency", [1, 3, 5, 10, 15, 20]),
    "hbs": ("Global_Sickle_Haemoglobin_HbS_Allele_Frequency", [1, 2, 5, 8, 12]),
    "hbc": ("Africa_HbC_Allele_Frequency", [1, 2, 5, 10]),
    "duffy": ("Global_Duffy_Negativity_Phenotype_Frequency", [1, 10, 30, 60, 90]),
}
YEAR = 2010  # 兩篇論文與網格的資料年份（模型估計的是 2010 年）
MIN_CELLS = 3  # 網格的國家平均至少要幾格

NAMES = {
    "Cote d'Ivoire": "CIV", "Democratic Republic of the Congo": "COD", "Congo": "COG", "Lao PDR": "LAO",
    "Lao People's Democratic Republic": "LAO", "Bolivia (Plurinational State of)": "BOL", "Iran (Islamic Republic of)": "IRN",
    "Venezuela (Bolivarian Republic of)": "VEN", "Republic of Korea": "KOR", "Democratic People's Republic of Korea": "PRK",
    "Viet Nam": "VNM", "Syrian Arab Republic": "SYR", "United Republic of Tanzania": "TZA", "Republic of Moldova": "MDA",
    "The former Yugoslav Republic of Macedonia": "MKD", "Micronesia (Federated States of)": "FSM", "Occupied Palestinian Territory": "PSE",
    "China, Hong Kong SAR": "HKG", "China, Macao SAR": "MAC", "Cape Verde": "CPV", "Swaziland": "SWZ", "Sao Tome and Principe": "STP",
    "Brunei Darussalam": "BRN", "Libyan Arab Jamahiriya": "LBY", "Saint Vincent and the Grenadines": "VCT", "Timor-Leste": "TLS",
    "United States of America": "USA", "Russian Federation": "RUS", "Kyrgyzstan": "KGZ", "Mayotte": "MYT", "Reunion": "REU",
    "French Guiana": "GUF", "Guadeloupe": "GLP", "Martinique": "MTQ", "Western Sahara": "ESH", "Channel Islands": None,
    "United States Virgin Islands": "VIR", "Netherlands Antilles": None, "Turkey": "TUR", "Czech Republic": "CZE",
    "Korea, Rep of": "KOR", "Dem People's Rep of Korea": "PRK", "Korea, DPR": "PRK", "Dem. People's Republic of Korea": "PRK", "Micronesia (Fed. States of)": "FSM",
    "TFYR Macedonia": "MKD", "Eurasia": None, "Arab-India": None,
}


def _lines(path: Path) -> list[list[str]]:
    """PDF 的每一行切成欄：同一頁、y 差 2 以內的片段算同一行（國名旁的 † 是上標，y 高一點），片段間距 > 5 是新的一欄"""
    texts, _ = pdfreader.read(path)
    by_page: dict[int, list] = defaultdict(list)
    for t in texts:
        by_page[t.page].append(t)
    out = []
    for page in sorted(by_page):
        rows: list[list] = []
        for t in sorted(by_page[page], key=lambda t: -t.y):
            if rows and abs(rows[-1][0].y - t.y) <= 2:
                rows[-1].append(t)
            else:
                rows.append([t])
        for ts in rows:
            ts.sort(key=lambda t: t.x)
            cells, cur, last = [], "", None
            for t in ts:
                if last is not None and t.x - last > 5:
                    cells.append(cur.strip())
                    cur = ""
                elif last is not None and t.x - last > 1.2:
                    cur += " "
                cur += t.text
                last = t.x1
            cells.append(cur.strip())
            out.append([c for c in cells if c])
    return out


def _iso3(name: str) -> str | None:
    name = " ".join(name.rstrip("†*‡ ").split())
    if name in NAMES:
        return NAMES[name]
    return countries.from_name(name)


def howes() -> dict[str, float]:
    """Howes 2012 Table S1：{ISO3: G6PD 缺乏的等位基因頻率（%）}"""
    out = {}
    for cells in _lines(download(HOWES, "map-blood", "howes-2012-s1.pdf")):
        pct = next((i for i, c in enumerate(cells) if re.fullmatch(r"\d+\.\d%", c)), None)
        if pct is None or pct < 2:
            continue
        name = cells[0]
        if re.match(r"[\d,]+$", name) or "MEC" in name or name.startswith(("Total", "Global", "World")):
            continue
        iso3 = _iso3(name)
        if not iso3:
            print(f"  Howes 對不到國家：{name}")
            continue
        out[iso3] = float(cells[pct].rstrip("%"))
    return out


def piel() -> tuple[dict[str, float], dict[str, float]]:
    """Piel 2013 Table S2：{ISO3: 新生兒的 SCA 比例（每 1,000 名）}、{ISO3: 2010 年 SCA 新生兒數}"""
    rate, births = {}, {}
    for cells in _lines(download(PIEL, "map-blood", "piel-2013-s2.pdf")):
        if len(cells) < 8 or not re.match(r"\d\.\d{3} \[", cells[1]):
            continue
        iso3 = _iso3(cells[0])
        if not iso3:
            if not re.search(r"region|World|WHO|AFR|AMR|EMR|EUR|SEAR|WPR|HbS|Europe|Africa|America|Asia", cells[0]):
                print(f"  Piel 對不到國家：{cells[0]}")
            continue
        rate[iso3] = float(cells[1].split()[0]) * 1000
        births[iso3] = float(cells[5].split()[0].replace(",", ""))
    return rate, births


def grid(key: str) -> tuple[np.ndarray, tuple[float, float, float, float]]:
    """MAP 的網格（比例 0–1，沒有資料是 nan）與範圍 [西, 南, 東, 北]"""
    name = GRIDS[key][0]
    path = download(WCS.format(name=name), "map-blood", f"{name}.tif")
    with rasterio.open(path) as r:
        a = r.read(1).astype(np.float64)
        nodata = r.nodata
        b = r.bounds
    a[(a == nodata) | ~np.isfinite(a) | (a < 0) | (a > 1)] = np.nan
    return a, (b.left, b.bottom, b.right, b.top)


def _owners(a: np.ndarray, bounds: tuple[float, float, float, float]):
    """有值的格子的列、行、國家（1:10m 國界，不在國界內的找最近的）與緯度"""
    h, w = a.shape
    west, south, east, north = bounds
    rows, cols = np.nonzero(np.isfinite(a))
    lons = west + (cols + 0.5) * (east - west) / w
    lats = north - (rows + 0.5) * (north - south) / h
    return rows, cols, geoindex.countries_at(lons, lats, nearest=True), lats


def land_cells(a: np.ndarray, bounds: tuple[float, float, float, float]) -> dict[str, int]:
    """每國的陸地格子數（用全球都有值的網格，例如 Duffy）"""
    out: dict[str, int] = defaultdict(int)
    for c in _owners(a, bounds)[2]:
        if c:
            out[c] += 1
    return out


def country_means(a: np.ndarray, bounds: tuple[float, float, float, float]) -> dict[str, float]:
    """有值的格子的中心點歸國家（1:10m 國界，不在國界內的找最近的），依緯度的餘弦加權平均（%）"""
    h, w = a.shape
    west, south, east, north = bounds
    rows, cols = np.nonzero(np.isfinite(a))
    lons = west + (cols + 0.5) * (east - west) / w
    lats = north - (rows + 0.5) * (north - south) / h
    owner = geoindex.countries_at(lons, lats, nearest=True)
    weight = np.cos(np.radians(lats))
    num: dict[str, float] = defaultdict(float)
    den: dict[str, float] = defaultdict(float)
    cnt: dict[str, int] = defaultdict(int)
    for c, v, wt in zip(owner, a[rows, cols], weight):
        if c and not c.startswith("_"):  # geoindex 的爭議地區代碼（_SIA、_SOL…）不算
            num[c] += v * wt
            den[c] += wt
            cnt[c] += 1
    return {c: float(num[c] / den[c] * 100) for c in num if cnt[c] >= MIN_CELLS}


def classes(a: np.ndarray, thresholds: list[float]) -> np.ndarray:
    """比例 → 分級代碼（1 起；沒有資料是 0）"""
    out = np.zeros(a.shape, dtype=np.uint8)
    m = np.isfinite(a)
    out[m] = np.digitize(a[m] * 100, thresholds) + 1
    return out


def _write(name: str, unit: str, values: dict[str, float], digits: int, **extra) -> None:
    write_json(OUT / f"{name}.json", indicator_file(
        name, unit, [YEAR], {c: [round(float(v), digits)] for c, v in sorted(values.items())}, **extra))


def build() -> None:
    (OUT / "grid").mkdir(parents=True, exist_ok=True)
    grids, bounds = {}, {}
    for key, (_name, thresholds) in GRIDS.items():
        a, b = grid(key)
        grids[key], bounds[key] = a, b
        png = png_gray(classes(a, thresholds))
        (OUT / "grid" / f"{key}.png").write_bytes(png)
        print(f"  網格 {key}：{a.shape[1]}×{a.shape[0]}，{int(np.isfinite(a).sum()):,} 格有值，範圍 {[round(x, 3) for x in b]}，PNG {len(png) / 1024:.0f} KB")
    write_json(OUT / "grid" / "bounds.json", {k: [round(x, 5) for x in v] for k, v in bounds.items()})

    # 蠶豆症：Howes 的表；表上沒有的用網格的面積平均
    g6pd = howes()
    grid_g6pd = country_means(grids["g6pd"], bounds["g6pd"])
    # 網格只涵蓋 2010 年的瘧疾流行區（加上台灣這類附近的地方）：涵蓋國內陸地一半以上的才補，美國、法國、澳洲這類
    # 只有邊上幾格的不補
    land = land_cells(grids["duffy"], bounds["duffy"])
    covered = land_cells(grids["g6pd"], bounds["g6pd"])
    extra = {c: v for c, v in grid_g6pd.items() if c not in g6pd and covered.get(c, 0) >= land.get(c, 1) / 2}
    skipped = sorted(c for c in grid_g6pd if c not in g6pd and c not in extra)
    note = "Howes 等 2012 的國家表只收 2010 年的瘧疾流行國，{name}不在表上；這個值是 Malaria Atlas Project 網格在國內的面積平均（模型外插，不是調查）。"
    note_en = "Howes et al. 2012’s national table covers only malaria-endemic countries as of 2010; this value is the area average of the Malaria Atlas Project grid within the country (a model extrapolation, not a survey)."
    notes = {c: note.format(name="這一國") for c in extra}
    notes_en = {c: note_en for c in extra}
    nbs = hpa_newborn.results()
    y, n, cases = nbs["years"][-1], nbs["screened"][-1], nbs["cases"][0][-1]
    since = [c / s * 1000 for yy, c, s in zip(nbs["years"], nbs["cases"][0], nbs["screened"]) if yy >= 1995]
    append_note(notes, notes_en, "TWN", (
        f"國健署的新生兒篩檢 {y} 年篩出蠶豆症 {cases:,.0f} 例，每千名篩檢 {cases / n * 1000:.1f} 例"
        f"（男女合計；1995 年以後每千名 {min(since):.1f}–{max(since):.1f} 例），量的是新生兒的酵素活性，不是等位基因頻率",
        f"Taiwan’s newborn screening found {cases:,.0f} cases of G6PD deficiency in {y}, {cases / n * 1000:.1f} per 1,000 screened "
        f"(both sexes; {min(since):.1f}–{max(since):.1f} per 1,000 since 1995); it measures enzyme activity in newborns, "
        "not allele frequency",
    ))
    _write("g6pd", "%", {**g6pd, **extra}, 1, notes=notes, notesEn=notes_en)
    rate, births = piel()
    _write("sca", "‰", rate, 1)
    _write("sca-births", "人", births, 0)
    _write("hbc", "%", country_means(grids["hbc"], bounds["hbc"]), 1)
    _write("duffy", "%", country_means(grids["duffy"], bounds["duffy"]), 1)
    print(f"  蠶豆症：Howes {len(g6pd)} 國，網格補 {len(extra)} 國（{', '.join(sorted(extra))}）；涵蓋不到一半、不補的 {', '.join(skipped)}")
    print(f"  台灣：蠶豆症 {({**g6pd, **extra}).get('TWN')}%；SCA {rate.get('TWN')}；Duffy {country_means(grids['duffy'], bounds['duffy']).get('TWN')}")
    for c in ("NGA", "COD", "THA", "SAU", "KHM", "IND", "CHN", "BRA"):
        print(f"  {c}：蠶豆症 {g6pd.get(c)}%、SCA {rate.get(c)}‰（{births.get(c)} 人）")
    print(f"  鐮刀型血球症：{len(rate)} 國，2010 年新生兒 {sum(births.values()):,.0f} 人")

    write_json(OUT / "manifest.json", {
        "topic": "red-cell-traits", "generatedAt": now_iso(),
        "source": "Howes et al. 2012 (PLoS Med 9:e1001339, Table S1); Piel et al. 2013 (PLoS Med 10:e1001484, Table S2); Malaria Atlas Project blood disorder grids; Health Promotion Administration, Taiwan (newborn screening, note only)", "license": "CC BY 4.0; CC BY 3.0 (MAP grids); Open Government Data License, Taiwan 1.0",
    })

if __name__ == "__main__":
    build()
