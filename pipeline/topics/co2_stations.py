"""全球二氧化碳觀測站：NOAA GML 合作採樣網（Carbon Cycle Cooperative Global Air Sampling Network）每週瓶採樣的月平均 CO2。

- 資料：`co2_surface-flask_ccgg_text.zip`（README Version 2026-07-17，doi:10.15138/wkgj-f215），
  每站一個月平均檔 `co2_<站>_surface-flask_1_ccgg_month.txt`（95 個），站的名稱、國家、座標在同一站的 event 檔表頭
  （site_name、site_country、site_latitude、site_longitude、site_elevation；月平均檔沒有座標）。
- 95 個月平均檔裡 22 個是船上採樣（太平洋航線依緯度帶 poc*、南海 scs*、德瑞克海峽 drp），沒有 event 檔、也沒有固定位置，
  不畫；剩下 73 個固定的站（含已停止的）。
- 授權：README 第 3 節「NOAA waives any potential copyright and related rights in these data worldwide through the
  Creative Commons Zero 1.0 Universal Public Domain Dedication (CC0 1.0)」，另請引用 Lan et al.。

輸出（public/data/topics/climate/，2026-10-30 併進溫室氣體排放）：
- stations.json：點（PointsData），每站的名稱、國家、座標、海拔、起訖年月，與每年的年平均（欄位 y1968…，
  12 個月裡有 MIN_MONTHS 個月以上才算，月份不齊的年份會被季節循環拉偏）。
- series.json：每站的月平均（側欄的濃度曲線）。
- stations-count.json：各國那一年有在採樣的站數（國家不上色，給 tooltip 與排名表）。
"""
from __future__ import annotations

import io
import re
import zipfile
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, now_iso, points_file, write_json

URL = "https://gml.noaa.gov/aftp/data/trace_gases/co2/flask/surface/co2_surface-flask_ccgg_text.zip"
SOURCE = "noaa_gml"
OUT = OUT_DIR / "topics" / "climate"  # 2026-10-30 併進溫室氣體排放（第七批 122）
MIN_MONTHS = 9

# 站 → (地圖上的國家／地區, 中文名稱)。國家依站的實際位置（不是 NOAA 寫的經營國）：
# 百慕達、亞森欣島、關島、美屬薩摩亞、格陵蘭、法屬南方領地是地圖上自己的形狀，南極的站算南極洲，海上的定點觀測船沒有國家；
# 中途島在地圖上沒有自己的形狀（美國本土外小島嶼），算美國
SITES: dict[str, tuple[str | None, str]] = {
    "abp": ("BRA", "阿倫貝皮（巴伊亞）"),
    "alt": ("CAN", "阿勒特（努納武特）"),
    "ams": ("ATF", "阿姆斯特丹島"),
    "amy": ("KOR", "安眠島"),
    "asc": ("SHN", "亞森欣島"),
    "ask": ("DZA", "阿塞克雷姆"),
    "avi": ("VIR", "聖克洛伊島（美屬維京群島）"),
    "azr": ("PRT", "特塞拉島（亞速群島）"),
    "bal": ("POL", "波羅的海"),
    "bhd": ("NZL", "巴林角"),
    "bkt": ("IDN", "布吉哥多塔邦"),
    "bme": ("BMU", "聖大衛角（百慕達）"),
    "bmw": ("BMU", "都鐸山（百慕達）"),
    "brw": ("USA", "巴羅（阿拉斯加）"),
    "bsc": ("ROU", "黑海（康斯坦察）"),
    "cba": ("USA", "冷灣（阿拉斯加）"),
    "cgo": ("AUS", "格林角（塔斯馬尼亞）"),
    "chr": ("KIR", "聖誕島（吉里巴斯）"),
    "cib": ("ESP", "CIBA 低層大氣研究中心"),
    "cmo": ("USA", "米爾斯角（奧勒岡）"),
    "cpt": ("ZAF", "好望角角點"),
    "crz": ("ATF", "克羅澤群島"),
    "dsi": ("TWN", "東沙島"),
    "eic": ("CHL", "復活節島"),
    "gmi": ("GUM", "關島"),
    "goz": ("MLT", "德維拉角（戈佐島）"),
    "hba": ("ATA", "哈雷站（南極）"),
    "hpb": ("DEU", "霍恩派森貝格"),
    "hun": ("HUN", "海吉哈特沙爾"),
    "ice": ("ISL", "斯托爾赫夫濟（韋斯特曼納群島）"),
    "izo": ("ESP", "伊薩尼亞（特內里費島）"),
    "key": ("USA", "比斯坎礁（佛羅里達）"),
    "kum": ("USA", "庫木卡希角（夏威夷）"),
    "kzd": ("KAZ", "薩里套庫姆"),
    "kzm": ("KAZ", "阿西高原"),
    "llb": ("CAN", "拉比士湖（亞伯達）"),
    "lln": ("TWN", "鹿林山"),
    "lmp": ("ITA", "蘭佩杜薩島"),
    "mbc": ("CAN", "莫爾德灣（西北地區）"),
    "mex": ("MEX", "高山全球氣候觀測中心（墨西哥）"),
    "mhd": ("IRL", "梅斯角（戈爾韋郡）"),
    "mid": ("USA", "沙島（中途島）"),
    "mkn": ("KEN", "肯亞山"),
    "mlo": ("USA", "茂納羅亞（夏威夷）"),
    "nat": ("BRA", "母親路易莎燈塔（納塔爾）"),
    "nmb": ("NAM", "戈巴貝布"),
    "nwr": ("USA", "尼沃特嶺（科羅拉多）"),
    "opw": ("USA", "奧林匹克半島（華盛頓州）"),
    "oxk": ("DEU", "奧克森科普夫"),
    "pal": ("FIN", "帕拉斯"),
    "psa": ("ATA", "帕默站（南極）"),
    "pta": ("USA", "阿里納角（加州）"),
    "rpb": ("BRB", "拉吉德角"),
    "sdz": ("CHN", "上甸子"),
    "sey": ("SYC", "馬埃島"),
    "sgp": ("USA", "南大平原（奧克拉荷馬）"),
    "shm": ("USA", "謝米亞島（阿拉斯加）"),
    "smo": ("ASM", "圖圖伊拉島（美屬薩摩亞）"),
    "spo": ("ATA", "南極點"),
    "stc": (None, "C 號海洋觀測船（北大西洋）"),
    "stm": (None, "M 號海洋觀測船（挪威海）"),
    "sum": ("GRL", "峰頂站（格陵蘭）"),
    "syo": ("ATA", "昭和站（南極）"),
    "tap": ("KOR", "泰安半島"),
    "thd": ("USA", "特立尼達角（加州）"),
    "tik": ("RUS", "季克西"),
    "tpi": ("TWN", "太平島"),
    "ush": ("ARG", "烏斯懷亞"),
    "uta": ("USA", "溫多佛（猶他）"),
    "uum": ("MNG", "烏蘭烏爾"),
    "wis": ("ISR", "克圖拉（阿拉瓦研究所）"),
    "wlg": ("CHN", "瓦里關山"),
    "zep": ("NOR", "新奧勒松（斯瓦巴）"),
}


def read_zip() -> tuple[dict[str, dict], dict[str, list[tuple[int, int, float]]]]:
    path = download(URL, SOURCE, "co2_surface-flask_ccgg_text.zip")
    meta: dict[str, dict] = {}
    months: dict[str, list[tuple[int, int, float]]] = {}
    ships: list[str] = []
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        for name in names:
            m = re.search(r"co2_([a-z0-9]+)_surface-flask_1_ccgg_month\.txt$", name)
            if not m:
                continue
            code = m.group(1)
            event = name.replace("_month.txt", "_event.txt")
            if event not in names:
                ships.append(code)
                continue
            head: dict[str, str] = {}
            with z.open(event) as f:
                for line in io.TextIOWrapper(f, encoding="utf-8"):
                    if not line.startswith("#"):
                        break
                    mm = re.match(r"# (site_\w+) : (.*)", line)
                    if mm:
                        head[mm.group(1)] = mm.group(2).strip()
            meta[code] = head
            rows = []
            for line in z.read(name).decode("utf-8").splitlines():
                if line.startswith("#") or not line.strip():
                    continue
                site, year, month, value = line.split()
                if site.lower() != code:
                    raise ValueError(f"{name} 裡有 {site} 的資料")
                rows.append((int(year), int(month), float(value)))
            months[code] = rows
    print(f"  {len(meta)} 個固定的站、{len(ships)} 個船上採樣（不畫：{', '.join(sorted(ships))}）")
    unknown = set(meta) - set(SITES)
    if unknown:
        raise ValueError(f"SITES 沒有這些站：{sorted(unknown)}")
    return meta, months


def build() -> None:
    meta, months = read_zip()
    all_years = sorted({y for rows in months.values() for y, _m, _v in rows})
    years = list(range(all_years[0], all_years[-1] + 1))

    points, series = [], {}
    count: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    world_count: dict[int, int] = defaultdict(int)
    for code in sorted(meta):
        head, rows = meta[code], months[code]
        iso3, zh = SITES[code]
        by_year: dict[int, list[float]] = defaultdict(list)
        for y, _m, v in rows:
            by_year[y].append(v)
        annual = {y: sum(v) / len(v) for y, v in by_year.items() if len(v) >= MIN_MONTHS}
        first, last = rows[0], rows[-1]
        for y in range(first[0], last[0] + 1):
            if by_year.get(y):
                world_count[y] += 1
                if iso3:
                    count[iso3][y] += 1
        row = {
            "code": code.upper(), "en": head["site_name"], "zh": zh, "iso3": iso3,
            "lon": float(head["site_longitude"]), "lat": float(head["site_latitude"]),
            "h": round(float(head["site_elevation"])),
            "f": first[0] * 100 + first[1], "l": last[0] * 100 + last[1],
            "last": round(annual[max(annual)], 2) if annual else None,
            "ly": max(annual) if annual else None,
        }
        for y in years:
            row[f"y{y}"] = round(annual[y], 2) if y in annual else None
        points.append(row)
        series[code.upper()] = {"first": [first[0], first[1]], "v": monthly_list(rows)}

    fields = ["code", "en", "zh", "iso3", "lon", "lat", "h", "f", "l", "last", "ly", *[f"y{y}" for y in years]]
    scale = {"lon": 0.0001, "lat": 0.0001, "last": 0.01, **{f"y{y}": 0.01 for y in years}}
    write_json(OUT / "stations.json", points_file(points, fields, scale))
    write_json(OUT / "series.json", series)
    write_json(
        OUT / "stations-count.json",
        indicator_file(
            "stations-count", "stations", years,
            {iso3: [by_year.get(y) for y in years] for iso3, by_year in sorted(count.items())},
            aggregates={"WLD": [world_count.get(y) for y in years]},
        ),
    )
    write_json(OUT / "co2-stations-manifest.json", {
        "topic": "co2-stations",
        "generatedAt": now_iso(),
        "source": "NOAA GML Carbon Cycle Cooperative Global Air Sampling Network, CO2 flask monthly means (doi:10.15138/wkgj-f215, CC0 1.0)",
    })
    report(points, years)


def monthly_list(rows: list[tuple[int, int, float]]) -> list[float | None]:
    """從第一個月起連續的月份，缺的月份是 null"""
    y0, m0 = rows[0][0], rows[0][1]
    by = {(y - y0) * 12 + (m - m0): v for y, m, v in rows}
    return [round(by[i], 2) if i in by else None for i in range(max(by) + 1)]


def report(points, years) -> None:
    active = [p for p in points if p["l"] >= 202501]
    print(f"  {len(points)} 站（2025 年還在採樣 {len(active)} 站），{years[0]}–{years[-1]}")
    for code in ("LLN", "DSI", "TPI", "MLO", "BRW", "SPO", "SMO"):
        p = next(p for p in points if p["code"] == code)
        print(f"  {code} {p['zh']}：{p['f']}–{p['l']}，2024 {p.get('y2024')}，2025 {p.get('y2025')}")
