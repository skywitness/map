"""航運與港口：港口的設施（2026-11-08，製作手冊第二十七批 580 補做，候選 1301；步驟 port-facilities，輸出 topics/shipping/）。

- 資料：NGA World Port Index（Pub. 150）的 UpdatedPub150.csv（sources/wpi.py，公有領域），港口的點本來就在用，
  這裡多讀設施的欄位。msi.nga.mil 2026-11-07、11-08 整站維護（連 robots.txt 都是 503），cloud 沒有快取；本機 session
  把 2026-10-26 網站管線下載的同一個檔放在 map-plan 的 `data/nga/UpdatedPub150.csv`（SHA-256 315644f1…，README 列了
  109 欄的值與筆數），重跑前複製到 pipeline/.cache/wpi/。
- 欄位（map-plan 的 README）：
  - `Dry Dock`（乾塢）、`Railway`：Small／Medium／Large／None／Unknown。**`Railway` 是修船的滑道（marine railway，把船拉上岸
    的軌道），不是聯外鐵路**；聯外鐵路是 `Communications - Rail`（Yes／No／Unknown），只放在點的說明，不做國家指標
    （手冊：「聯外」跟已排除的 747 同一個概念，賣點放在乾塢、修船、起重機、水深）。
  - `Repairs`（修船能力）：Major／Moderate／Limited／Emergency Only／None／Unknown。
  - `Lifts - 100+ Tons`、`- 50-100 Tons`、`- 25-49 Tons`、`- 0-24 Tons`、`Cranes - Fixed／Mobile／Floating`、`Cranes Container`：Yes／No／Unknown。
  - `Channel Depth (m)`、`Cargo Pier Depth (m)`：0.0 是沒有資料。深度是舊版 WPI 的級距換算的（很多港剛好 23.2 公尺），
    不做國家指標，只寫在點的說明。
- **大部分欄位 Unknown 比 Yes 多**，各國填寫的完整度也不一樣（美國的港口填得最完整）。國家指標是「標了有這項設施的
  港口數」，hints 寫這國在 WPI 有幾個港、幾個不明，說明寫清楚這是 WPI 記錄的，不是全部的設施。
"""
from __future__ import annotations

from collections import Counter

from common import OUT_DIR, indicator_file, points_file, write_json
from sources import port_teu, wpi

OUT = OUT_DIR / "topics" / "shipping"
YEAR = 2026  # WPI 的檔沒有版次與日期，用下載與做圖的年份

SIZE4 = {"Large": 4, "Medium": 3, "Small": 2, "None": 1}
REPAIRS = {"Major": 5, "Moderate": 4, "Limited": 3, "Emergency Only": 2, "None": 1}
LIFTS = [("Lifts - 100+ Tons", 4), ("Lifts - 50-100 Tons", 3), ("Lifts - 25-49 Tons", 2), ("Lifts - 0-24 Tons", 1)]
CRANES = [("Cranes - Fixed", 1), ("Cranes - Mobile", 2), ("Cranes - Floating", 4), ("Cranes Container", 8)]

FIELDS = ["lon", "lat", "name", "zh", "en", "iso3", "size", "dd", "rp", "mr", "lf", "cr", "cd", "pd", "rl"]
SCALE = {"lon": 0.001, "lat": 0.001, "size": 1, "dd": 1, "rp": 1, "mr": 1, "lf": 1, "cr": 1, "cd": 0.1, "pd": 0.1, "rl": 1}

# 國家指標：子項目 → (中文, 英文, 這個港口算不算)
ITEMS = {
    "drydock": ("有乾塢", "with a dry dock", lambda p: p["dd"] >= 2),
    "repairs": ("能大修船", "with major repairs", lambda p: p["rp"] == 5),
    "lift100": ("吊得起 100 噸以上", "with 100+ tonne lifts", lambda p: p["lf"] == 4),
}
UNKNOWN = {"drydock": lambda r: r["Dry Dock"] in ("", "Unknown"), "repairs": lambda r: r["Repairs"] in ("", "Unknown"),
           "lift100": lambda r: r["Lifts - 100+ Tons"] in ("", "Unknown")}


def _depth(text: str) -> float | None:
    v = float(text) if text else 0.0
    return v if v > 0 else None


def build() -> None:
    ports = wpi.load()
    raw = wpi.raw_rows()
    rows, by_country, unknown = [], Counter(), {k: Counter() for k in ITEMS}
    for p in sorted(ports, key=lambda p: p.lon):
        r = raw[(p.number, round(p.lat, 3), round(p.lon, 3))]
        for col in ("Dry Dock", "Railway"):
            if r[col] not in SIZE4 and r[col] not in ("", "Unknown"):
                raise ValueError(f"沒見過的 {col}：{r[col]}")
        if r["Repairs"] not in REPAIRS and r["Repairs"] not in ("", "Unknown"):
            raise ValueError(f"沒見過的 Repairs：{r['Repairs']}")
        zh, en = port_teu.NAMES.get(p.number, (None, None))
        row = {
            "lon": p.lon, "lat": p.lat, "name": p.name, "zh": zh, "en": en, "iso3": p.iso3, "size": p.size,
            "dd": SIZE4.get(r["Dry Dock"], 0), "rp": REPAIRS.get(r["Repairs"], 0), "mr": SIZE4.get(r["Railway"], 0),
            "lf": next((v for col, v in LIFTS if r[col] == "Yes"), 0),
            "cr": sum(bit for col, bit in CRANES if r[col] == "Yes"),
            "cd": _depth(r["Channel Depth (m)"]), "pd": _depth(r["Cargo Pier Depth (m)"]),
            "rl": {"Yes": 1, "No": 2}.get(r["Communications - Rail"]),
        }
        rows.append(row)
        by_country[p.iso3] += 1
        for k, is_unknown in UNKNOWN.items():
            if is_unknown(r):
                unknown[k][p.iso3] += 1
    write_json(OUT / "port-facilities.json", points_file(rows, FIELDS, SCALE, delta=("lon",)))

    for key, (zh, en, has) in ITEMS.items():
        counts = Counter(r["iso3"] for r in rows if has(r))
        values = {c: [counts.get(c, 0)] for c in sorted(by_country)}
        hints = {c: f"World Port Index 收的 {n} 個港口裡 {counts.get(c, 0)} 個{zh}、{unknown[key][c]} 個不明" for c, n in by_country.items()}
        hints_en = {c: f"{counts.get(c, 0)} of the {n} World Port Index ports {en}; {unknown[key][c]} unknown" for c, n in by_country.items()}
        write_json(OUT / "port-facilities" / f"{key}.json", indicator_file(
            f"port-{key}", "港", [YEAR], values, hints=hints, hintsEn=hints_en, license="公有領域（NGA World Port Index）"))
        print(f"  港口設施 {key}：{sum(counts.values())} 個港，前幾國 {counts.most_common(6)}，台灣 {counts.get('TWN', 0)}／{by_country['TWN']}")
    print(f"  港口的點：{len(rows)} 個；乾塢有記錄（含沒有） {sum(r['dd'] > 0 for r in rows)}、修船 {sum(r['rp'] > 0 for r in rows)}、"
          f"航道水深 {sum(r['cd'] is not None for r in rows)}、聯外鐵路 Yes {sum(r['rl'] == 1 for r in rows)}")
