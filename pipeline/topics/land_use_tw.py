"""台灣的土地利用現況調查：368 鄉鎮市區（2026-11-07，製作手冊第二十五批 493，候選 1158；擴充「土地利用」的台灣層）。

內政部國土測繪中心「國土利用現況調查」的鄉鎮市區統計（政府資料開放授權條款第 1 版），兩期：
- 109–110 年：data.gov.tw 158973（opdadm.moi.gov.tw 的 no-auth 下載，欄位 county、town、unit、010101Area…）
- 113–114 年：data.gov.tw 178038（欄位名是「水田010101用地面積」這種中文加代碼）
都是 108 年版土地利用分級分類系統的第 3 級（93 類，公頃）。依代碼前兩碼加總成 9 大類：01 農業、02 森林、03 交通、04 水利、
05 建築、06 公共、07 遊憩、08 礦鹽、09 其他使用。兩期的判讀準則有微調，小的變化不可靠。

網站沒有鄉鎮市區的面量圖，用內政部鄉鎮市區界（divisions.py 已在用的 TOWN_MOI_1140318）算每個鄉鎮市區的代表點
（shapely representative_point，一定落在面裡），畫成點。
輸出 public/data/topics/land-use/tw-towns.json（點：lon、lat、t 總面積公頃、s01…s09 最新一期占比 %、c01…c09 兩期相差的
百分點、n 名稱）與 tw-share/{item}.json、tw-change/{item}.json 的空指標檔。
"""

from __future__ import annotations

import csv
import re

from common import OUT_DIR, download, indicator_file, points_file, write_json

OUT = OUT_DIR / "topics" / "land-use"
URLS = {
    "109": "https://opdadm.moi.gov.tw/api/v1/no-auth/resource/api/dataset/E77E1082-B08E-4A2D-8D16-D47FCD1EC9CF/resource/9AF353E6-4B7F-42C6-A125-B9A59A43AE07/download",
    "113": "https://opdadm.moi.gov.tw/api/v1/no-auth/resource/api/dataset/334BB88C-6861-48CE-A028-8B6392CBBC79/resource/E334C46A-B7B1-4CC4-AF29-942A185A14DB/download",
}
CLASSES = ["01", "02", "03", "04", "05", "06", "07", "08", "09"]


def _survey(period: str) -> dict[tuple[str, str], dict[str, float]]:
    path = download(URLS[period], "moi-landuse", f"lu-{period}.csv")
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    header = rows[0]
    codes = [(i, m.group(1)) for i, c in enumerate(header) if (m := re.search(r"(\d{6})", c))]
    if len(codes) != 93:
        raise RuntimeError(f"國土利用現況調查 {period} 的欄位數變了：{len(codes)}")
    out = {}
    for r in rows[1:]:
        sums = {c: 0.0 for c in CLASSES}
        for i, code in codes:
            if r[i]:
                sums[code[:2]] += float(r[i])
        out[(r[0].strip(), r[1].strip())] = sums
    return out


def build() -> None:
    import divisions
    moi = divisions._moi()
    if moi is None:
        raise RuntimeError(f"缺內政部的鄉鎮市區界（{divisions.MOI_TOWN}），見 divisions.py")
    counties, towns = moi
    county_name = {c["key"]: c["zh"] for c in counties}
    points = {(county_name[t["parent_key"]], t["zh"]): t["geom"].representative_point() for t in towns}
    old, new = _survey("109"), _survey("113")
    rows = []
    missing = []
    for key, sums in new.items():
        pt = points.get(key)
        if pt is None:
            missing.append(key)
            continue
        total = sum(sums.values())
        prev = old.get(key)
        prev_total = sum(prev.values()) if prev else 0
        row = {"lon": round(pt.x, 5), "lat": round(pt.y, 5), "t": round(total), "n": f"{key[0]}{key[1]}"}
        for c in CLASSES:
            row[f"s{c}"] = round(sums[c] / total * 100, 2) if total else None
            row[f"c{c}"] = round((sums[c] / total - prev[c] / prev_total) * 100, 2) if total and prev and prev_total else None
        rows.append(row)
    if missing:
        raise RuntimeError(f"國土利用現況調查的鄉鎮市區對不到界線：{missing}")
    fields = ["lon", "lat", "t", *[f"s{c}" for c in CLASSES], *[f"c{c}" for c in CLASSES], "n"]
    write_json(OUT / "tw-towns.json", points_file(rows, fields, {"lon": 1e-4, "lat": 1e-4, **{f: 0.01 for f in fields[3:-1]}}, delta=("lon",)))
    for c in CLASSES:
        for folder in ("tw-share", "tw-change"):
            write_json(OUT / folder / f"{c}.json", indicator_file(folder, "", [2025], {}, license="政府資料開放授權條款第 1 版"), quiet=True)
    nat_old = {c: sum(v[c] for v in old.values()) for c in CLASSES}
    nat_new = {c: sum(v[c] for v in new.values()) for c in CLASSES}
    print(f"  國土利用現況調查 {len(rows)} 個鄉鎮市區；全國（公頃）109–110 年 {({c: round(v) for c, v in nat_old.items()})}"
          f"；113–114 年 {({c: round(v) for c, v in nat_new.items()})}")
