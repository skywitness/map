"""企鵝在哪裡（新主題，地理類，2026-10-30）：南極條約區的企鵝繁殖地與歷次普查的數量。

**資料**：MAPPPD v5.0（Oceanites，2026-10-21，https://www.penguinmap.com）的全部普查 CSV（AllCounts_V_5_0.csv，不必登入）：
729 個繁殖地、5,487 次普查（1892 到 2025/26 繁殖季），阿德利、頰帶、巴布亞、皇帝、馬可羅尼、國王企鵝六種。
授權：網頁頁尾與 API 寫 CC BY 4.0，但使用條款 v3.0（2021）寫不准商業使用；使用者 2026-10-30 決定照「只准非商業」處理，
頁尾寫明（DESIGN.md 第 8 節第 12 點、第 158 點）。

**一個繁殖季同一種企鵝有好幾筆時**（不同的計數單位、不同的調查）：依巢、成鳥、幼鳥的順序取，同一種單位取準確度最好的
（accuracy 1 最好，±5%），再相同取數量大的。計數單位不同的數字不能相加，前端寫明單位。

**輸出**（public/data/topics/penguins/）：
- sites/<物種>.json（點）：每個繁殖地一筆，欄位 a、c、g、e、m、k 是六種企鵝的普查序列（字串「繁殖季:數量:單位;…」，
  單位 n 巢、a 成鳥、c 幼鳥；數量 -1 是有繁殖、沒有計數，0 是那一季沒有企鵝繁殖），前端依時間軸取那一季以前最近一次的普查（`src/topics/penguins.ts` 的 `latestCount`）。
  all.json 有全部的繁殖地，其他檔只有那一種企鵝的繁殖地與序列。
- colonies-<物種>.json：空的指標檔（國家不上色），只給時間軸的繁殖季。
"""
from __future__ import annotations

import csv
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, now_iso, points_file, write_json

OUT = OUT_DIR / "topics" / "penguins"
URL = "https://www.penguinmap.com/mapppd/DownloadAll"
# 物種：CSV 的 common_name → 欄位與檔名（順序同前端 src/topics/penguins.ts 的 SPECIES）
SPECIES = {
    "adelie penguin": ("a", "adelie"),
    "chinstrap penguin": ("c", "chinstrap"),
    "gentoo penguin": ("g", "gentoo"),
    "emperor penguin": ("e", "emperor"),
    "macaroni penguin": ("m", "macaroni"),
    "king penguin": ("k", "king"),
}
TYPE_CODE = {"nests": "n", "adults": "a", "chicks": "c"}
TYPE_RANK = {"nests": 0, "adults": 1, "chicks": 2}


def build() -> None:
    path = download(URL, "mapppd", "AllCounts_V_5_0.csv")
    with open(path, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    sites: dict[str, dict] = {}
    # (繁殖地, 物種, 繁殖季) → 最好的一筆
    best: dict[tuple[str, str, int], tuple[tuple, int, str]] = {}
    for r in rows:
        sid = r["site_id"]
        sites.setdefault(sid, {"id": sid, "name": r["site_name"].strip(), "lon": float(r["longitude_epsg_4326"]),
                               "lat": float(r["latitude_epsg_4326"]), "region": r["cammlr_region"]})
        if r["common_name"] not in SPECIES:
            raise ValueError(f"MAPPPD 有沒見過的物種：{r['common_name']}")
        # 數量空白的 23 筆是「有繁殖、沒有計數」，存 -1；同一季有計數的優先
        count = int(float(r["penguin_count"])) if r["penguin_count"] else -1
        acc = int(r["accuracy"]) if r["accuracy"] else 9
        key = (sid, r["common_name"], int(r["season_starting"]))
        rank = (count < 0, TYPE_RANK[r["count_type"]], acc, -count)
        if key not in best or rank < best[key][0]:
            best[key] = (rank, count, r["count_type"])

    series: dict[str, dict[str, list[tuple[int, int, str]]]] = defaultdict(lambda: defaultdict(list))
    for (sid, name, season), (_, count, ctype) in best.items():
        series[sid][SPECIES[name][0]].append((season, count, TYPE_CODE[ctype]))
    seasons = sorted({season for (_, _, season) in best})

    def encode(s: list[tuple[int, int, str]]) -> str:
        return ";".join(f"{y}:{c}:{t}" for y, c, t in sorted(s))

    fields = ["lon", "lat", "id", "name", "r", *[code for code, _ in SPECIES.values()]]
    files = {"all": None, **{item: code for code, item in SPECIES.values()}}
    counts = {}
    for item, code in files.items():
        out_rows = []
        for sid, site in sorted(sites.items(), key=lambda kv: kv[1]["lon"]):
            by_species = series[sid]
            if code is not None and code not in by_species:
                continue
            row = {"lon": site["lon"], "lat": site["lat"], "id": sid, "name": site["name"], "r": site["region"]}
            for c, _ in SPECIES.values():
                if c in by_species and (code is None or c == code):
                    row[c] = encode(by_species[c])
            out_rows.append(row)
        counts[item] = len(out_rows)
        write_json(OUT / "sites" / f"{item}.json",
                   points_file(out_rows, fields, {"lon": 0.001, "lat": 0.001}, delta=("lon",), strings=("r",)))
        # 時間軸：這一種企鵝有普查的繁殖季
        years = seasons if code is None else sorted({y for s in series.values() for y, _, _ in s.get(code, [])})
        write_json(OUT / f"colonies-{item}.json", indicator_file(f"colonies-{item}", "", years, {}), quiet=True)

    largest = max(best.items(), key=lambda kv: kv[1][1])
    print(f"  {len(rows):,} 筆普查、{len(sites)} 個繁殖地、{len(best):,} 個（繁殖地、物種、繁殖季）；"
          f"繁殖季 {seasons[0]}–{seasons[-1]}；最大的一筆 {largest[0]} {largest[1][1]:,} {largest[1][2]}")
    print("  每種的繁殖地：" + "、".join(f"{k} {v}" for k, v in counts.items()))
    write_json(OUT / "manifest.json", {
        "topic": "penguins", "generatedAt": now_iso(),
        "source": "MAPPPD v5.0 (Oceanites, Inc. 2026, https://www.penguinmap.com); non-commercial use per MAPPPD Terms of Use v3.0",
        "rows": len(rows), "sites": len(sites), "seasons": [seasons[0], seasons[-1]], "sitesBySpecies": counts,
    })
