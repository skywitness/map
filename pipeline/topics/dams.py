"""水壩與水庫（併進河流與流域主題，DESIGN.md 第 8 節第 96 點）：全世界的水壩依庫容畫成點、依完工的年代上色，
各國的水壩數與總庫容。

- 全世界：Global Dam Watch v1.0（sources/gdw.py，CC BY 4.0）。不收船閘（DAM_TYPE 是 Lock 的 1,152 座：航運設施，
  不是攔水的壩，九成沒有庫容）、已經拆除或毀損的（REM_YEAR、TIMELINE 是 Removed、Destroyed、Subsumed）與規劃中的。
- 台灣：GDW 只有 32 座、6 座有名字，改用水利署的 40 座公告水庫（sources/wra_reservoirs.py）；GDW 的點在某一座公告水庫
  3 km 以內的當成同一座、拿掉，其餘（發電用的小壩、攔河堰）照 GDW 留著。
- 國家：依點的位置（geoindex，Natural Earth 1:10m），不用 GDW 的 COUNTRY 欄（跟網站的國界不一定一樣）。
- 輸出到河流主題的資料夾（public/data/topics/rivers/）：dams.json（點）、dam-count.json、dam-capacity.json。
  河流主題的 pipeline（topics/rivers.py）要下載 544 MB 的 HydroRIVERS，這裡另外一個步驟，不必重跑河流。
"""
from __future__ import annotations

import json
import math
from collections import Counter, defaultdict

import geoindex
from common import OUT_DIR, indicator_file, now_iso, points_file, write_json
from sources import gdw
from sources import wra_reservoirs as wra

OUT = OUT_DIR / "topics" / "rivers"
YEAR = 2019  # 跟河流主題的指標檔同一個年份（主題是 timeless，只是指標檔要有一個年份）
SAME_KM = 3  # GDW 的點離公告水庫這麼近時算同一座
DROPPED_TIMELINE = {"Removed", "Destroyed", "Subsumed", "Planned"}

# 欄位：經緯度、庫容（百萬立方公尺）、完工年份、壩高（公尺）、用途（gdw.USES 的位元）、主要用途、名稱、河名。
# 不明的數值寫 0 不寫 null（4 萬個點，null 每個多 3 個字元；前端把 0 當成不明，年份 0 落在「年份不明」那一級）。
# 台灣的公告水庫：n 是「中文名｜河川」、r 是英文名（GDW 的 n 是壩名、r 是河名，都是英文）
FIELDS = ["lon", "lat", "c", "yr", "h", "u", "m", "n", "r"]
SCALE = {"lon": 0.01, "lat": 0.01, "c": 0.01, "yr": 1, "h": 1, "u": 1, "m": 1}


def _km(lon1, lat1, lon2, lat2) -> float:
    p = math.pi / 180
    a = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(a))


def _cap(v: float | None) -> float:
    """庫容（百萬立方公尺）：0 是不明（前端依 c 篩選縮小時畫哪些點，缺值的欄位會被篩掉，所以寫 0）；
    有值的至少 0.01（量化後不會變成 0）"""
    return 0 if v is None or v <= 0 else max(v, 0.01)


def build() -> None:
    all_dams = gdw.dams()
    dams = [
        d for d in all_dams
        if d.dam_type != "Lock" and d.removed is None and d.timeline not in DROPPED_TIMELINE
    ]
    print(f"  GDW {len(all_dams):,} 座，不收船閘、拆除、規劃中的以後 {len(dams):,} 座")
    taiwan = wra.reservoirs()

    iso = geoindex.countries_at([d.lon for d in dams], [d.lat for d in dams])
    rows: list[dict] = []
    replaced = []
    for d, iso3 in zip(dams, iso):
        if iso3 == "TWN" and any(_km(d.lon, d.lat, r.lon, r.lat) < SAME_KM for r in taiwan):
            replaced.append(d.gdw_id)
            continue
        rows.append({
            "iso3": iso3, "lon": d.lon, "lat": d.lat, "c": _cap(d.capacity), "yr": d.year,
            "h": round(d.height) if d.height else None, "u": d.uses or None,
            # 主要用途：只有一種用途時就是它；Multipurpose（0）不寫
            "m": d.main_use or None, "n": d.name, "r": d.river,
        })
    tw_iso = geoindex.countries_at([r.lon for r in taiwan], [r.lat for r in taiwan])
    for r, iso3 in zip(taiwan, tw_iso):
        if iso3 != "TWN":
            raise ValueError(f"{r.name} 的座標不在台灣：{r.lon}, {r.lat}")
        rows.append({
            "iso3": "TWN", "lon": r.lon, "lat": r.lat, "c": _cap(r.capacity), "yr": r.year,
            "h": round(r.height) if r.height else None, "u": r.uses or None, "m": None,
            # 台灣的公告水庫：n 是中文名、r 是英文名（英文介面用），河川名稱只有中文，寫在中文介面
            "n": r.name, "r": r.name_en, "tw": 1, "rz": r.river,
        })
    print(f"  台灣：水利署公告水庫 {len(taiwan)} 座，GDW 的 {len(replaced)} 座在 {SAME_KM} km 內換掉（GDW_ID {replaced}），"
          f"GDW 其餘 {sum(1 for x in rows if x['iso3'] == 'TWN' and not x.get('tw'))} 座照留")

    # 大的先寫：MapLibre 照資料的順序畫，小的畫在大的上面，大水庫的圓才不會把附近的小壩蓋掉
    rows.sort(key=lambda x: -x["c"])
    out_rows = []
    for x in rows:
        row = {k: (0 if x.get(k) is None else x[k]) if k in SCALE else x.get(k) for k in FIELDS}
        if x.get("tw"):
            # 台灣的河名接在中文名後面（「翡翠水庫｜新店溪支流北勢溪」），英文名放 r
            row["n"] = f"{x['n']}｜{x['rz']}"
        out_rows.append(row)
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "dams.json", points_file(out_rows, FIELDS, SCALE, strings=["n", "r"]))

    count: Counter[str] = Counter()
    cap: defaultdict[str, float] = defaultdict(float)
    for x in rows:
        if x["iso3"]:
            count[x["iso3"]] += 1
            cap[x["iso3"]] += x["c"]
    no_cap = Counter(x["iso3"] for x in rows if x["iso3"] and not x["c"])
    notes = {"TWN": "台灣用經濟部水利署的 40 座公告水庫（水庫基本資料）加上 GDW 其他的壩與攔河堰；庫容是水利署最近一次測量的總容量。"}
    notes_en = {"TWN": "Taiwan uses the Water Resources Agency’s 40 official reservoirs plus GDW’s other dams and weirs; capacity is the agency’s latest surveyed total storage."}
    write_json(OUT / "dam-count.json", indicator_file(
        "dam-count", "座", [YEAR], {k: [v] for k, v in count.items()}, notes=notes, notesEn=notes_en,
        aggregates={"WLD": [sum(count.values())]},
    ))
    hints = {k: f"{v:,} 座不知道庫容，沒有算進來" for k, v in no_cap.items() if v}
    hints_en = {k: f"{v:,} dams with unknown capacity not included" for k, v in no_cap.items() if v}
    write_json(OUT / "dam-capacity.json", indicator_file(
        "dam-capacity", "百萬立方公尺", [YEAR], {k: [round(v, 2)] for k, v in cap.items()}, notes=notes, notesEn=notes_en,
        hints=hints, hintsEn=hints_en, aggregates={"WLD": [round(sum(cap.values()), 1)]},
    ))
    _manifest()
    _spot_checks(rows, count, cap)


def _manifest() -> None:
    """河流主題的 manifest 加上 GDW 與水利署（河流的 pipeline 重跑時會寫回原本的，那邊也寫了這兩個來源）"""
    path = OUT / "manifest.json"
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"topic": "rivers"}
    extra = (
        "; Global Dam Watch database v1.0 (Lehner et al. 2024, CC BY 4.0); Water Resources Agency, Taiwan "
        "(Open Government Data License v1.0)"
    )
    if "Global Dam Watch" not in data.get("source", ""):
        data["source"] = data.get("source", "") + extra
    data["generatedAt"] = now_iso()
    write_json(path, data)


def _spot_checks(rows, count, cap) -> None:
    years = sum(1 for x in rows if x["yr"])
    print(f"  共 {len(rows):,} 座，{years:,} 座有完工年份（{years / len(rows):.0%}），{sum(1 for x in rows if x['c']):,} 座有庫容")
    for iso3 in ("CHN", "USA", "IND", "BRA", "JPN", "TWN"):
        print(f"  {iso3}：{count[iso3]:,} 座，總庫容 {cap[iso3]:,.0f} 百萬立方公尺")
    top = sorted(rows, key=lambda x: -x["c"])[:5]
    print("  庫容最大：" + "、".join(f"{x['n']}（{x['iso3']}，{x['c']:,.0f}）" for x in top))
