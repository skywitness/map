"""全世界已知的 773 個冰下湖（第十四批順序 257，P19，2026-10-31）：Livingstone 等 2022 的「Compiled global database of
subglacial lakes」，放進南極主題，跟原本 Wilson 等 2025 的 104 個活動湖並列。

**資料**：The University of Sheffield 的 ORDA（figshare），DOI 10.15131/shef.data.18094037.v1（2025-02-25 第 1 版），
CC BY 4.0（figshare API 的 license）。ORDA 用程式下載被 AWS WAF 擋，本機 session 2026-10-31 照一般方式下載，
放在 skywitness/map-plan 的 data/subglacial-lakes/（MD5 跟 figshare 的 computed_md5 相同）；重跑前把
`Livingstone_etal_2022_Nature_Reviews_data.xlsx` 複製到 pipeline/.cache/livingstone/。Springer 的補充檔是同一個檔，
但 Nature 的網站條款禁止下載來建資料庫，所以只用 ORDA 版。

**內容**：xlsx 的 Combined 工作表（773 列）：位置（Antarctica 675、Greenland 64、瑞士 18、冰島 6…）、名稱、緯度、經度、
長寬（m）、最大深度（m）、面積（km²）、體積（km³）、上面的冰厚（m）、穩定湖（Stable，594）或活動湖（Active，179）。

**跟 Wilson 2025 重複的**：Wilson 的 19 個重新分析的既有活動湖多半在這份清單裡；每個 Wilson 的湖找 15 公里內最近的
活動湖，對到的在這份的點上註明（wl），兩份都畫（Wilson 的點與範圍在上面），不刪。

**輸出**（public/data/topics/antarctica/）：lakes-all.json（點）。
"""
from __future__ import annotations

import json
import math

from common import CACHE_DIR, OUT_DIR, points_file, write_json, write_manifest_part

OUT = OUT_DIR / "topics" / "antarctica"
XLSX = CACHE_DIR / "livingstone" / "Livingstone_etal_2022_Nature_Reviews_data.xlsx"
STABLE, ACTIVE = 1, 2
MATCH_KM = 15


def _km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(a))


def _num(v) -> float | None:
    try:
        return float(v) if v not in (None, "", "-") else None
    except (TypeError, ValueError):
        return None


def _wilson() -> list[tuple[float, float, str]]:
    """原本的 Wilson 2025 湖（lakes.json）：(緯度, 經度, 名稱)"""
    d = json.loads((OUT / "lakes.json").read_text(encoding="utf-8"))
    f, cols, sc = d["fields"], d["columns"], d["scale"]
    out, accs = [], {k: 0 for k in d.get("delta", [])}
    for i in range(len(cols[0])):
        row = {}
        for j, k in enumerate(f):
            v = cols[j][i]
            if k in sc and isinstance(v, (int, float)):
                if k in accs:
                    accs[k] += v
                    v = accs[k]
                v = v * sc[k]
            row[k] = v
        out.append((row["lat"], row["lon"], row["name"]))
    return out


def build() -> None:
    import openpyxl

    if not XLSX.exists():
        raise RuntimeError(f"沒有 {XLSX}：請把 map-plan 的 data/subglacial-lakes/ 的 xlsx 複製到這裡")
    wb = openpyxl.load_workbook(XLSX, read_only=True)
    rows = list(wb["Combined"].iter_rows(values_only=True))
    head = [h for h in rows[0] if h]
    col = {h: i for i, h in enumerate(rows[0]) if h}
    lakes = []
    for r in rows[1:]:
        lat, lon = _num(r[col["Lat"]]), _num(r[col["Lon"]])
        if lat is None or lon is None:
            continue
        kind = ACTIVE if str(r[col["Lake_Type"]]).strip().lower() == "active" else STABLE
        lakes.append({"lon": round(lon, 3), "lat": round(lat, 3), "t": kind, "name": str(r[col["Name"]] or "").strip() or None,
                      "loc": str(r[col["Location"]] or "").strip() or None, "a": _num(r[col["Area_km2"]]),
                      "v": _num(r[col["Volume_km3"]]), "h": _num(r[col["Ice_Thk"]]), "l": _num(r[col["Length_m"]]),
                      "d": _num(r[col["Max_Depth_m"]]), "wl": None})
    # 跟 Wilson 2025 重複的：每個 Wilson 的湖找 15 公里內最近的活動湖
    matched = 0
    for wlat, wlon, wname in _wilson():
        best = min(((_km(wlat, wlon, x["lat"], x["lon"]), x) for x in lakes if x["t"] == ACTIVE), key=lambda t: t[0], default=None)
        if best and best[0] <= MATCH_KM:
            best[1]["wl"] = wname
            matched += 1
    lakes.sort(key=lambda x: -(x["a"] or 0))
    write_json(OUT / "lakes-all.json", points_file(
        lakes, ["lon", "lat", "t", "name", "loc", "a", "v", "h", "l", "d", "wl"],
        {"lon": 0.001, "lat": 0.001, "t": 1, "a": 0.1, "v": 0.01, "h": 1, "l": 1, "d": 1}, strings=("loc",)))
    write_manifest_part(OUT, "antarctica", "lakes-all", {
        "source": "Livingstone, S. J. et al. (2025). Compiled global database of subglacial lakes. The University of Sheffield (ORDA), "
                  "doi:10.15131/shef.data.18094037.v1, CC BY 4.0",
    })
    from collections import Counter
    print(f"  冰下湖 {len(lakes)} 個（{dict(Counter(x['loc'] for x in lakes).most_common(4))}）；"
          f"穩定 {sum(1 for x in lakes if x['t'] == STABLE)}、活動 {sum(1 for x in lakes if x['t'] == ACTIVE)}；"
          f"Wilson 2025 的 104 個裡 {matched} 個在 {MATCH_KM} 公里內對到這份的活動湖；欄位 {head}")


if __name__ == "__main__":
    build()
