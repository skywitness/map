"""各國海拔與地形的擴充（第十四批順序 260，N31，2026-10-31）：Nunn & Puga（2012）的各國地形崎嶇指數。

**資料**：Harvard Dataverse doi:10.7910/DVN/VEHPPS（「Replication data for: Ruggedness: The Blessing of Bad Geography in
Africa」）的 `rugged_data_1.csv`（https://dataverse.harvard.edu/api/access/datafile/2411907 ，49 KB）。
**授權**：Dataverse 標 CC0 1.0（2026-10-30 規劃 session 讀）；作者網站只要求引用 Nunn & Puga (2012)。

**指標**：`rugged`，地形崎嶇指數（Terrain Ruggedness Index，Riley 等 1999）：GTOPO30 的 30 角秒網格裡，每一格跟周圍 8 格的
海拔差的平方和開根號，再對全國的格子平均；單位是「百公尺」（1 = 平均起伏 100 公尺）。資料不分年份，檔案的年份寫 2010，
跟這個主題其他指標一樣（主題是 timeless）。
**輸出**：public/data/topics/elevation/rugged.json。
"""
from __future__ import annotations

import csv

from common import OUT_DIR, download, indicator_file, write_json, write_manifest_part
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "elevation"
URL = "https://dataverse.harvard.edu/api/access/datafile/2411907"
YEAR = 2010
# 資料裡的舊代碼 → 現在的 ISO alpha-3
OLD_CODES = {"ROM": "ROU", "ZAR": "COD", "TMP": "TLS", "YUG": "SRB", "ANT": "CUW"}
CITATION = ("Nunn, N., Puga, D. (2012). Ruggedness: The Blessing of Bad Geography in Africa. Review of Economics and Statistics "
            "94(1), 20–36; replication data, Harvard Dataverse, doi:10.7910/DVN/VEHPPS (CC0 1.0)")


def build() -> None:
    with open(download(URL, "nunn-puga", "rugged_data_1.csv"), encoding="latin-1", newline="") as f:
        rows = list(csv.DictReader(f))
    values: dict[str, list[float]] = {}
    unmatched = []
    for r in rows:
        code = OLD_CODES.get(r["isocode"], r["isocode"])
        iso3 = to_iso3(code) or (code if len(code) == 3 and code.isalpha() else None)
        try:
            v = float(r["rugged"])
        except ValueError:
            continue
        if not iso3:
            unmatched.append(r["isocode"])
            continue
        values[iso3] = [round(v, 3)]
    write_json(OUT / "rugged.json", indicator_file("rugged", "百公尺", [YEAR], dict(sorted(values.items()))))
    write_manifest_part(OUT, "elevation", "ruggedness", {"source": CITATION})
    top = sorted(values.items(), key=lambda kv: -kv[1][0])[:6]
    print(f"  崎嶇指數 {len(values)} 國（對不到 {unmatched}）；台灣 {values.get('TWN')}；最崎嶇 {top}")


if __name__ == "__main__":
    build()
