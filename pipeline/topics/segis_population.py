"""人口主題的擴充：台灣的最小統計區人口（內政部 SEGIS，製作手冊第十七批 285，2026-11-03）。

**資料**：
- 內政部統計處「統計區人口統計」（data.gov.tw 18681）最小統計區的 22 個縣市 XML（2024 年 12 月的戶籍人口）。
  segisws.moi.gov.tw 對 cloud 回 403，由本機 session 代為下載，放在 skywitness/map-plan 的 data/segis/
  （commit 4ca93dd，README 有網址、下載日期與 SHA-256）；重跑前把 22 個 XML 與 SHA256SUMS 複製到 pipeline/.cache/segis/。
- 「最小統計區圖」（data.gov.tw 25128，opdadm.moi.gov.tw，cloud 抓得到）每縣市一個 SHP 的 zip，dbf 有最小統計區代碼與
  中心點座標 X、Y（TWD97 二度分帶；本島 121°、澎湖金門馬祖 119°，看 .prj 的 central_meridian）。只用中心點，界線不上網站。
**授權**：SEGIS 資料使用規範（map-plan data/segis/DataUseInfo.html）：「公開免申請資料之授權利用，依據行政院訂定之
「政府資訊開放授權條款」辦理」，並要「標示開放資料已被變更」（這裡只留中心點與人口，前端的來源寫明）；data.gov.tw 的
license 都是政府資料開放授權條款第 1 版。
**輸出**（public/data/topics/population/）：taiwan-segis.json：人口不是 0 的最小統計區的中心點（0.001°）與戶籍人口，
在台灣框選時才下載，框內的中心點加總寫在框選結果（跟 GHS-POP 的網格估計並列，不相加）。
**日夜人口**：電信信令人口（data.gov.tw 160180 日間、160179 夜間，縣市層級、2020 年 11 月，免費的只有這一期）只印出來，
寫在城市主題的說明裡。
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import re
import zipfile

import shapefile

from common import CACHE_DIR, OUT_DIR, download, points_file, write_json

OUT = OUT_DIR / "topics" / "population"
SEGIS = CACHE_DIR / "segis"
DATASET_SHP = "https://data.gov.tw/api/v2/rest/dataset/25128"
DAY = "https://data.gov.tw/api/v2/rest/dataset/160180"
NIGHT = "https://data.gov.tw/api/v2/rest/dataset/160179"
COUNTIES = ["新北市", "臺北市", "桃園市", "臺中市", "臺南市", "高雄市", "宜蘭縣", "新竹縣", "苗栗縣", "彰化縣", "南投縣", "雲林縣",
            "嘉義縣", "屏東縣", "臺東縣", "花蓮縣", "澎湖縣", "基隆市", "新竹市", "嘉義市", "金門縣", "連江縣"]

# GRS80（TWD97）
A = 6378137.0
F = 1 / 298.257222101
E2 = 2 * F - F * F
EP2 = E2 / (1 - E2)
K0 = 0.9999
FE = 250000.0


def tm2_to_lonlat(x: float, y: float, lon0: float) -> tuple[float, float]:
    """TWD97 二度分帶（橫麥卡托，k0 0.9999、東偏 250 km）→ 經緯度（Snyder 的反算公式，誤差在公分以下）"""
    m = y / K0
    mu = m / (A * (1 - E2 / 4 - 3 * E2**2 / 64 - 5 * E2**3 / 256))
    e1 = (1 - math.sqrt(1 - E2)) / (1 + math.sqrt(1 - E2))
    phi1 = (mu + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu) + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu)
            + (151 * e1**3 / 96) * math.sin(6 * mu) + (1097 * e1**4 / 512) * math.sin(8 * mu))
    s, c, t = math.sin(phi1), math.cos(phi1), math.tan(phi1)
    n1 = A / math.sqrt(1 - E2 * s * s)
    r1 = A * (1 - E2) / (1 - E2 * s * s) ** 1.5
    c1, t1 = EP2 * c * c, t * t
    d = (x - FE) / (n1 * K0)
    lat = phi1 - (n1 * t / r1) * (d**2 / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1**2 - 9 * EP2) * d**4 / 24
                                  + (61 + 90 * t1 + 298 * c1 + 45 * t1**2 - 252 * EP2 - 3 * c1**2) * d**6 / 720)
    lon = lon0 + math.degrees((d - (1 + 2 * t1 + c1) * d**3 / 6
                               + (5 - 2 * c1 + 28 * t1 - 3 * c1**2 + 8 * EP2 + 24 * t1**2) * d**5 / 120) / c)
    return lon, math.degrees(lat)


def _check_xml() -> dict[str, str]:
    sums = SEGIS / "SHA256SUMS"
    if not sums.exists():
        raise RuntimeError(f"沒有 {SEGIS}：請把 map-plan 的 data/segis/ 的 22 個 XML 與 SHA256SUMS 複製到這裡")
    want = {}
    for line in sums.read_text(encoding="utf-8").splitlines():
        if line.strip():
            h, name = line.split(maxsplit=1)
            want[name.strip().lstrip("*")] = h
    out = {}
    for county in COUNTIES:
        path = SEGIS / f"{county}.xml"
        h = hashlib.sha256(path.read_bytes()).hexdigest()
        if want.get(path.name) != h:
            raise RuntimeError(f"{path.name} 的 SHA-256 跟 map-plan 的 SHA256SUMS 不同")
        out[county] = path.read_text(encoding="utf-8")
    return out


def population() -> tuple[dict[str, int], str]:
    """{最小統計區代碼: 人口}、資料時間（113Y12M）"""
    pop, times = {}, set()
    for county, text in _check_xml().items():
        for row in re.findall(r"<RowData>(.*?)</RowData>", text, re.S):
            code = re.search(r"<CODEBASE>([^<]+)</CODEBASE>", row).group(1)
            pop[code] = int(re.search(r"<P_CNT>([^<]*)</P_CNT>", row).group(1) or 0)
            times.add(re.search(r"<INFO_TIME>([^<]+)</INFO_TIME>", row).group(1))
    if len(times) != 1:
        raise RuntimeError(f"資料時間不只一個：{times}")
    return pop, times.pop()


def centers() -> dict[str, tuple[float, float]]:
    """{最小統計區代碼: (經度, 緯度)}：各縣市 SHP 的 X、Y"""
    meta = json.loads(download(DATASET_SHP, "segis", "dataset-25128.json").read_text(encoding="utf-8"))["result"]
    out = {}
    for res in meta["distribution"]:
        name = res["resourceDescription"]
        if res["resourceFormat"].upper() != "SHP" or "最小統計區圖" not in name:
            continue
        county = name.replace("最小統計區圖", "")
        z = zipfile.ZipFile(download(res["resourceDownloadUrl"], "segis", f"shp-{county}.zip"))
        stem = next(n[:-4] for n in z.namelist() if n.lower().endswith(".shp"))
        prj = z.read(stem + ".prj").decode("ascii", "replace") if stem + ".prj" in z.namelist() else ""
        # 新竹市的 .prj 寫經緯度（GEOGCS），但 dbf 的 X、Y 還是二度分帶的公尺（本島 121°）；澎湖的 zip 沒有 .prj，
        # X 約 30 萬（119° 分帶；121° 分帶的話約 11 萬），用 119°
        cm = re.search(r'central_meridian",\s*([\d.]+)', prj)
        lon0 = float(cm.group(1)) if cm else 119.0 if county == "澎湖縣" else 121.0
        reader = shapefile.Reader(shp=io.BytesIO(z.read(stem + ".shp")), shx=io.BytesIO(z.read(stem + ".shx")),
                                  dbf=io.BytesIO(z.read(stem + ".dbf")), encoding="cp950")
        for rec in reader.iterRecords(fields=["CODEBASE", "X", "Y"]):
            lonlat = (rec["X"], rec["Y"]) if rec["X"] < 1000 else tm2_to_lonlat(rec["X"], rec["Y"], lon0)
            if not (117.5 < lonlat[0] < 123 and 21.5 < lonlat[1] < 26.5):
                raise RuntimeError(f"{county} {rec['CODEBASE']} 換算後不在台灣：{lonlat}")
            out[rec["CODEBASE"]] = lonlat
    return out


def telecom(url: str, name: str) -> dict[str, tuple[int, str]]:
    """電信信令人口：{縣市: (平日人數, 資料時間)}"""
    meta = json.loads(download(url, "segis", f"{name}.json").read_text(encoding="utf-8"))["result"]
    res = meta["distribution"][0]["resourceDownloadUrl"]
    text = download(res, "segis", f"{name}.csv").read_bytes().decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(text)))
    head = rows[0]
    col = next(i for i, h in enumerate(head) if h in ("DAY_WORK", "NIGHT_WORK"))
    return {r[1]: (int(r[col]), r[-1]) for r in rows[2:] if len(r) > col and r[col].isdigit()}


def build() -> None:
    pop, when = population()
    xy = centers()
    missing = [c for c in pop if c not in xy]
    rows = [{"lon": xy[c][0], "lat": xy[c][1], "p": p} for c, p in pop.items() if p > 0 and c in xy]
    rows.sort(key=lambda r: (round(r["lon"], 3), r["lat"]))
    y, m = re.match(r"(\d+)Y(\d+)M", when).groups()
    as_of = f"{int(y) + 1911}-{int(m):02d}"
    data = points_file(rows, ["lon", "lat", "p"], {"lon": 0.001, "lat": 0.001, "p": 1}, delta=("lon",))
    write_json(OUT / "taiwan-segis.json", {"asOf": as_of, "total": sum(r["p"] for r in rows), **data})
    total = sum(pop.values())
    print(f"  最小統計區 {len(pop):,} 個（{as_of}），人口 {total:,}；人口不是 0 的 {len(rows):,} 個；SHP 沒有中心點的 {len(missing)}：{missing[:5]}")
    lons = [r["lon"] for r in rows]
    lats = [r["lat"] for r in rows]
    print(f"  範圍：經度 {min(lons):.3f}–{max(lons):.3f}，緯度 {min(lats):.3f}–{max(lats):.3f}")
    taipei = sum(r["p"] for r in rows if 121.45 <= r["lon"] <= 121.67 and 24.96 <= r["lat"] <= 25.21)
    print(f"  臺北市一帶的框（121.45–121.67E、24.96–25.21N）：{taipei:,} 人")
    day, night = telecom(DAY, "telecom-day"), telecom(NIGHT, "telecom-night")
    for county in ("臺北市", "新北市", "新竹市", "臺中市", "高雄市"):
        d, n = day[county][0], night[county][0]
        print(f"  電信信令 {day[county][1]} 平日：{county} 日間 {d:,}、夜間 {n:,}（{d - n:+,}）")


if __name__ == "__main__":
    build()
