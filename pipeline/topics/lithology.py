"""地表的岩石種類主題：GLiM（Global Lithological Map）0.5° 網格版（Hartmann & Moosdorf 2012，PANGAEA，CC BY 3.0）。

**來源**：PANGAEA doi:10.1594/PANGAEA.788537 的 hartmann-moosdorf_2012.zip（38,670 bytes，epic.awi.de 直連）：
glim_wgs84_0point5deg.txt.asc（ESRI ASCII 網格，720 × 360，左下角 −180、−90，每格 0.5°，−9999 是海）與
Classnames.txt（代碼 1–16 對 GLiM 的類別縮寫）。每格是那 0.5° 裡面積最多的岩類（原始是約 120 萬個多邊形、1:375 萬）。

**地圖**（grid.png）：720 × 360 的 8 位元灰階 PNG，像素值是 GLiM 的代碼（不上色，前端的類別網格依代碼上色，
src/map/classGridLayer.ts）；水體（wb，大湖）與無資料（nd）寫 0 不畫（底圖已經有湖）。

**國家**：每個格子的中心點歸到國家（geoindex.countries_at，1:10m 國界；不在國界內的找最近的國界），面積依
cos(緯度) 加權，水體與無資料不算。指標（timeless，年份寫資料的 2012）：
- main.json：面積最大的岩類（GLiM 代碼，地圖不上色，給 tooltip 與排名表）
- group.json：面積最大的大類（1 未固結沉積物、2 沉積岩、3 火山岩、4 深成岩、5 變質岩、6 冰河）
- carbonate.json、volcanic.json、unconsolidated.json：碳酸鹽岩、火山岩（含火山碎屑岩）、未固結沉積物的面積比例（%）
- panel.json：每國各岩類的面積千分比（≥ 1‰ 的才列）
小國沒有格子中心落在國界內、附近也沒有時，值是 null。幾秒。
"""
from __future__ import annotations

import io
import zipfile

import numpy as np

import geoindex
from common import OUT_DIR, download, indicator_file, now_iso, write_json
from topics.koppen import png_gray

OUT = OUT_DIR / "topics" / "lithology"
URL = "https://epic.awi.de/id/eprint/31092/1/hartmann-moosdorf_2012.zip"
YEAR = 2012

# Classnames.txt 的代碼（src/topics/lithology.ts 的 CLASSES 要一致）
CODES = {"su": 1, "vb": 2, "ss": 3, "pb": 4, "sm": 5, "sc": 6, "va": 7, "mt": 8, "pa": 9, "vi": 10,
         "wb": 11, "py": 12, "pi": 13, "ev": 14, "nd": 15, "ig": 16}
SKIP = {CODES["wb"], CODES["nd"]}
# 大類：1 未固結沉積物、2 沉積岩、3 火山岩、4 深成岩、5 變質岩、6 冰河
GROUP_OF = {"su": 1, "ss": 2, "sm": 2, "sc": 2, "ev": 2, "py": 3, "va": 3, "vi": 3, "vb": 3,
            "pa": 4, "pi": 4, "pb": 4, "mt": 5, "ig": 6}
SHARES = {
    "carbonate": ["sc"],
    "volcanic": ["py", "va", "vi", "vb"],
    "unconsolidated": ["su"],
}


def read_grid() -> np.ndarray:
    path = download(URL, "glim", "hartmann-moosdorf_2012.zip")
    with zipfile.ZipFile(path) as z:
        names = z.read("Classnames.txt").decode("utf-8").splitlines()[1:]
        found = {}
        for line in names:
            parts = line.strip().split(";")
            if len(parts) == 4:
                found[parts[3].strip('"')] = int(parts[1])
        if found != CODES:
            raise ValueError(f"Classnames.txt 跟 CODES 不一致：{found}")
        text = z.read("glim_wgs84_0point5deg.txt.asc").decode("ascii")
    lines = text.splitlines()
    head = {k.lower(): float(v) for k, v in (l.split() for l in lines[:6])}
    if (head["ncols"], head["nrows"], head["xllcorner"], head["yllcorner"], head["cellsize"]) != (720, 360, -180, -90, 0.5):
        raise ValueError(f"網格的範圍不是 0.5° 全球：{head}")
    a = np.loadtxt(io.StringIO("\n".join(lines[6:])), dtype=np.int32)
    if a.shape != (360, 720):
        raise ValueError(f"網格大小不對：{a.shape}")
    a[a < 0] = 0
    return a


def build() -> None:
    a = read_grid()
    counts = {k: int((a == v).sum()) for k, v in CODES.items()}
    print(f"  格數：{counts}")
    drawn = a.copy()
    for v in SKIP:
        drawn[drawn == v] = 0
    OUT.mkdir(parents=True, exist_ok=True)
    data = png_gray(drawn)
    (OUT / "grid.png").write_bytes(data)
    print(f"  輸出 grid.png（{len(data) / 1024:.0f} KB）")

    rows, cols = np.nonzero(drawn)
    lons = -180 + (cols + 0.5) * 0.5
    lats = 90 - (rows + 0.5) * 0.5
    owner = geoindex.countries_at(lons, lats, nearest=True)
    weight = np.cos(np.radians(lats))
    cls = drawn[rows, cols]
    acc: dict[str, np.ndarray] = {}
    for c, k, w in zip(owner, cls.tolist(), weight.tolist()):
        if not c:
            continue
        acc.setdefault(c, np.zeros(17))[k] += w
    print(f"  {len(acc)} 個國家與地區有格子")

    name_of = {v: k for k, v in CODES.items()}
    main, group, panel = {}, {}, {}
    shares = {k: {} for k in SHARES}
    for c, s in sorted(acc.items()):
        tot = s.sum()
        p = s / tot
        main[c] = [int(np.argmax(s))]
        g = np.zeros(7)
        for code in range(1, 17):
            if code not in SKIP and s[code] > 0:
                g[GROUP_OF[name_of[code]]] += s[code]
        group[c] = [int(np.argmax(g))]
        for key, names in SHARES.items():
            shares[key][c] = [round(float(sum(p[CODES[n]] for n in names)) * 100, 1)]
        panel[c] = sorted(([code, int(round(p[code] * 1000))] for code in range(1, 17) if p[code] * 1000 >= 1),
                          key=lambda r: -r[1])

    write_json(OUT / "main.json", indicator_file("main", "", [YEAR], main))
    write_json(OUT / "group.json", indicator_file("group", "", [YEAR], group))
    for key in SHARES:
        write_json(OUT / f"{key}.json", indicator_file(key, "%", [YEAR], shares[key]))
    write_json(OUT / "panel.json", {"countries": panel})
    write_json(OUT / "manifest.json", {
        "topic": "lithology",
        "generatedAt": now_iso(),
        "source": "Hartmann, J. & Moosdorf, N. (2012): Global Lithological Map Database v1.0 (gridded to 0.5° spatial resolution), PANGAEA, doi:10.1594/PANGAEA.788537",
        "license": "CC BY 3.0",
    })
    for c in ("TWN", "JPN", "ISL", "CHN", "USA", "AUS", "SGP"):
        print(f"    {c}: {[(name_of[k], v) for k, v in panel.get(c, [])[:6]]}")


if __name__ == "__main__":
    build()
