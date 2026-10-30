"""氣溫與降雨主題的「一年下雨幾天」：CRU TS 的雨日（wet，日雨量 ≥ 0.1 mm 的日數）各國面積加權平均。

- 跟年平均氣溫、年降雨量同一套 CRU TS 4.10 與同一組國界權重（topics/temperature.country_weights），
  一年的值是 12 個月的雨日加總。
- wet 是 CRU TS 的次要變數（Harris et al. 2020 的表 1：相關衰減距離 450 km、前驅變數 PRE）：
  雨日的測站觀測少的地方，用測站的雨量加上 CRU CL 1961–1990 年的雨量與雨日氣候值推算出「合成的雨日」，
  再跟真的雨日觀測一起內插；450 km 內都沒有的格子填 1961–1990 年的氣候值。
- 台灣：CRU 的格子明顯偏高（臺北的格子 2011–2020 年平均約 226 天，臺北測站約 150 天），
  附註另外列中央氣象署測站 2016–2024 年的降雨日數（sources/cwa_monthly.py，GE01Days 同樣是 ≥ 0.1 mm）。
"""
from __future__ import annotations

import numpy as np

from common import OUT_DIR, indicator_file, write_json
from sources import cru, cwa_monthly
from topics.temperature import country_weights, fmt

OUT = OUT_DIR / "topics" / "temperature"
# 附註列出的氣象署測站（北到南、東部、離島各取幾站）
CWA_STATIONS = ["基隆", "臺北", "新竹", "臺中", "嘉義", "臺南", "高雄", "恆春", "臺東", "花蓮", "宜蘭", "澎湖"]
CWA_EN = {
    "基隆": "Keelung", "臺北": "Taipei", "新竹": "Hsinchu", "臺中": "Taichung", "嘉義": "Chiayi", "臺南": "Tainan",
    "高雄": "Kaohsiung", "恆春": "Hengchun", "臺東": "Taitung", "花蓮": "Hualien", "宜蘭": "Yilan", "澎湖": "Penghu",
}
RECENT = (2016, 2024)  # 跟氣象署測站資料同一段，CRU 也取這幾年的平均


def build() -> None:
    wet = cru.load("wet")
    weights, how = country_weights(wet.mask)
    codes = sorted(weights)
    w = np.stack([weights[c] for c in codes])
    w /= w.sum(axis=1, keepdims=True)
    area = np.cos(np.radians(wet.lat)).astype(np.float32)
    years = wet.years
    annual = (wet.values @ w.T).reshape(len(years), 12, -1).sum(axis=1).astype(np.float64)  # (年, 國家)
    world = (wet.values @ (area / area.sum())).reshape(len(years), 12).sum(axis=1).astype(np.float64)
    annual, world = np.round(annual, 1), np.round(world, 1)

    notes, notes_en = cell_notes(codes, how)
    taiwan_note(codes, years, annual, notes, notes_en)
    series = {iso3: [round(float(v), 1) for v in annual[:, k]] for k, iso3 in enumerate(codes)}
    write_json(
        OUT / "wet-days.json",
        indicator_file("wet-days", "days", years, series, aggregates={"WLD": [round(float(v), 1) for v in world]}, notes=notes, notesEn=notes_en),
    )
    report(codes, years, annual, world, wet)


def cell_notes(codes, how) -> tuple[dict[str, str], dict[str, str]]:
    """小國用了哪些格子（跟 temperature.py 的附註同一句）"""
    notes, notes_en = {}, {}
    for iso3 in codes:
        kind, amount = how[iso3]
        if kind == "nearest":
            notes[iso3] = f"CRU TS 的 0.5° 網格在國土上沒有陸地格子，改用約 {amount:.0f} km 外最近的陸地格子"
            notes_en[iso3] = f"The CRU TS 0.5° grid has no land cell on this territory; the nearest land cell, about {amount:.0f} km away, is used"
        elif amount < 0.5:
            notes[iso3] = "國土不到半個 0.5° 格子（約 55 km 見方），數值是涵蓋它的格子的平均，含鄰近地區"
            notes_en[iso3] = "The territory covers less than half a 0.5° cell (about 55 km across); the value is the average of the cells covering it, including neighbouring areas"
    return notes, notes_en


def taiwan_note(codes, years, annual, notes, notes_en) -> None:
    if "TWN" not in codes:
        return
    k = codes.index("TWN")
    i0, i1 = years.index(RECENT[0]), years.index(RECENT[1]) + 1
    cru_recent = float(annual[i0:i1, k].mean())
    stations = cwa_monthly.annual(cwa_monthly.monthly(), "wet")
    parts_zh, parts_en, means = [], [], []
    for name in CWA_STATIONS:
        by_year = stations.get(name, {})
        vals = [by_year[y] for y in range(RECENT[0], RECENT[1] + 1) if y in by_year]
        if len(vals) < 5:
            raise ValueError(f"氣象署 {name} 站 {RECENT[0]}–{RECENT[1]} 年的完整年份只有 {len(vals)} 年")
        lo, hi, mean = min(vals), max(vals), sum(vals) / len(vals)
        means.append(mean)
        parts_zh.append(f"{name} {fmt(lo, 0)}–{fmt(hi, 0)}")
        parts_en.append(f"{CWA_EN[name]} {fmt(lo, 0)}–{fmt(hi, 0)}")
    print(f"  台灣：CRU {RECENT[0]}–{RECENT[1]} 年平均 {cru_recent:.1f} 天；氣象署 {len(means)} 站平均 {sum(means) / len(means):.1f} 天")
    notes["TWN"] = (
        f"CRU TS 在台灣明顯偏高：全島的格子 {RECENT[0]}–{RECENT[1]} 年平均 {fmt(cru_recent, 0)} 天，"
        f"中央氣象署測站同一段時間每年的降雨日數（日雨量 ≥ 0.1 mm）是 {'、'.join(parts_zh)} 天。"
        f"CRU 的雨日在雨日觀測少的地方是由雨量與 1961–1990 年的氣候值推算的，台灣的格子含山區，"
        f"地圖的顏色只適合跟其他國家比較，台灣各地的天數以氣象署為準"
    )
    notes_en["TWN"] = (
        f"CRU TS runs clearly high over Taiwan: its cells average {fmt(cru_recent, 0)} days a year over {RECENT[0]}–{RECENT[1]}, "
        f"while the Central Weather Administration's stations recorded these ranges of yearly wet days (≥ 0.1 mm) over the same "
        f"years: {', '.join(parts_en)}. Where few wet-day reports exist, CRU derives wet days from rainfall and 1961–1990 "
        f"normals, and Taiwan's cells include the mountains; use the map to compare countries, and the administration's "
        f"stations for places within Taiwan"
    )


def report(codes, years, annual, world, wet) -> None:
    last = years[-1]
    i0, i1 = years.index(2011), years.index(2020) + 1
    print(f"  世界（陸地）：{last} 年 {world[-1]:.1f} 天；2011–2020 年 {world[i0:i1].mean():.1f} 天")
    for iso3 in ("TWN", "GBR", "NOR", "EGY", "PER", "CHL", "IRL", "JPN", "IND", "BRA", "USA", "SAU"):
        if iso3 in codes:
            k = codes.index(iso3)
            print(f"  {iso3} 2011–2020：{annual[i0:i1, k].mean():6.1f}｜{last}：{annual[-1, k]:6.1f}")
    # 查證時的格子（2011–2020 年平均）
    rows, cols = np.nonzero(wet.mask)
    lat = 90 - (rows + 0.5) * cru.CELL
    lon = -180 + (cols + 0.5) * cru.CELL
    cells = wet.values.reshape(len(years), 12, -1).sum(axis=1)[i0:i1].mean(axis=0)
    for name, (la, lo) in {"凱爾蓋朗": (-49.25, 69.25), "麥覺理島": (-54.75, 159.25), "卑爾根": (60.25, 5.25), "倫敦": (51.25, -0.25),
                           "開羅": (30.25, 31.25), "秘魯沿海": (-7.75, -79.75), "臺北": (25.25, 121.75), "高雄": (22.75, 120.25)}.items():
        j = np.nonzero((np.abs(lat - la) < 0.01) & (np.abs(lon - lo) < 0.01))[0]
        print(f"  格子 {name}（{la}, {lo}）：{cells[j[0]]:.1f}" if j.size else f"  格子 {name}：不是陸地")
    q = np.percentile(annual[-1], [0, 5, 25, 50, 75, 95, 100])
    print("  分位數（0/5/25/50/75/95/100）：" + " / ".join(f"{v:.0f}" for v in q))
