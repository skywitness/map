"""歐洲的工業污染排放設施（E-PRTR）（新主題，2026-11-07，製作手冊第二十五批 488，候選 1151；環境的「污染」）。

EEA「Industrial Reporting under the Industrial Emissions Directive 2010/75/EU and European Pollutant Release and Transfer
Register Regulation (EC) No 166/2006」ver. 16.0（2026-02-20，CC BY 4.0，版權 EEA；doi:10.2909/657ac3cb-affa-4295-a4a9-27b4f539adab）。
取檔用 EEA datashare 的 WebDAV 指到資料夾裡單一個「User friendly .csv files.zip」（147,626,010 bytes；不帶 ?path= 的
/download 會打包整個公開 datastore），快取在 .cache/eea-industry/。用其中兩個檔：
- F1_1_Air_Releases_National.csv：各國每年每種污染物排到空氣的總量（公斤；只算超過申報門檻的設施）。
- F1_4_Air_Releases_Facilities.csv：每座設施每年每種污染物（經緯度、E-PRTR 部門 1–9、設施名稱）。
污染物取四種：硫氧化物、氮氧化物、PM10（公噸）、汞（公斤）。戴奧辛不收：2024 年丹麥一座焚化廠申報 8,980 公克毒性當量、
是 2007 年全歐合計的 7 倍多，明顯是申報單位的問題。2007–2024 年。
英國 2020 年起不在（脫歐）；EEA 的資料是 CC BY 4.0，英國 2019 年以前照收。

輸出 public/data/topics/industrial-releases/：national/{item}.json（比例圓）、facilities-{item}.json（點：lon、lat、y、v、s 部門、
n 名稱、iso3）與 facilities/{item}.json 的空指標檔（設施點的指標，檔名有 {item} 前端才會出現污染物的選單）。
"""

from __future__ import annotations

import csv
import io
import zipfile
from collections import defaultdict

from common import OUT_DIR, indicator_file, points_file, write_json
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "industrial-releases"
URL = ("https://sdi.eea.europa.eu/datashare/public.php/webdav/eea_t_ied-eprtr_p_2007-2024_v16_r00/"
       "User%20friendly%20.csv%20files.zip")
# 污染物 → (id, 公斤換成顯示單位的倍數)
POLLUTANTS = {
    "Sulphur oxides (SOX)": ("sox", 1e-3),
    "Nitrogen oxides (NOX)": ("nox", 1e-3),
    "Particulate matter (PM10)": ("pm10", 1e-3),
    "Mercury and compounds (as Hg)": ("hg", 1.0),
}
UNITS = {"sox": "公噸", "nox": "公噸", "pm10": "公噸", "hg": "公斤"}
NAMES = {"Czechia": "CZE", "Turkiye": "TUR", "Türkiye": "TUR"}


def _iso3(name: str) -> str | None:
    name = (name or "").strip()
    return NAMES.get(name) or from_name(name)


def _rows(z: zipfile.ZipFile, name: str):
    with z.open(name) as raw:
        yield from csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig", newline=""))


def build() -> None:
    # common.download 不帶認證：WebDAV 要帶公開分享代碼，跟 noise.py 一樣自己下載（已在快取就直接用）
    import common
    target = common.CACHE_DIR / "eea-industry" / "csv.zip"
    if not target.exists():
        from topics.noise import SHARE_TOKEN
        import base64
        import urllib.request
        print(f"  下載 {URL}")
        auth = base64.b64encode(f"{SHARE_TOKEN}:".encode()).decode()
        req = urllib.request.Request(URL, headers={"User-Agent": common.USER_AGENT, "Authorization": f"Basic {auth}"})
        target.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(req, timeout=1800, context=common._ssl_context(URL)) as resp, open(target, "wb") as out:
            while chunk := resp.read(1 << 20):
                out.write(chunk)
    z = zipfile.ZipFile(target)

    national: dict[str, dict[str, dict[int, float]]] = {p[0]: defaultdict(dict) for p in POLLUTANTS.values()}
    unknown = set()
    for r in _rows(z, "F1_1_Air_Releases_National.csv"):
        p = POLLUTANTS.get(r["Pollutant"])
        if not p:
            continue
        iso3 = _iso3(r["countryName"])
        if not iso3:
            unknown.add(r["countryName"])
            continue
        national[p[0]][iso3][int(r["reportingYear"])] = float(r["Releases"]) * p[1]
    years = sorted({y for s in national.values() for v in s.values() for y in v})
    for key, series in national.items():
        values = {k: [round(s[y], 2 if key == "hg" else 0) if y in s else None for y in years] for k, s in series.items()}
        write_json(OUT / "national" / f"{key}.json", indicator_file("national", UNITS[key], years, values, license="CC BY 4.0"))

    facilities: dict[str, list[dict]] = {p[0]: [] for p in POLLUTANTS.values()}
    sectors = set()
    for r in _rows(z, "F1_4_Air_Releases_Facilities.csv"):
        p = POLLUTANTS.get(r["Pollutant"])
        if not p or not r["Longitude"] or not r["Latitude"] or not r["Releases"]:
            continue
        iso3 = _iso3(r["countryName"])
        sector = int(r["EPRTR_SectorCode"]) if r["EPRTR_SectorCode"].isdigit() else 9
        sectors.add((sector, r["EPRTR_SectorName"]))
        facilities[p[0]].append({
            "lon": float(r["Longitude"]), "lat": float(r["Latitude"]), "y": int(r["reportingYear"]),
            "v": round(float(r["Releases"]) * p[1], 3 if p[0] == "hg" else 1),
            "s": sector, "n": (r["facilityName"] or "").strip(), "iso3": iso3 or "",
        })
    for key, rows in facilities.items():
        rows.sort(key=lambda x: (x["y"], x["lon"]))
        write_json(OUT / f"facilities-{key}.json",
                   points_file(rows, ["lon", "lat", "y", "v", "s", "n", "iso3"], {"lon": 1e-4, "lat": 1e-4}, delta=("y",),
                               strings=("n", "iso3")))
        write_json(OUT / "facilities" / f"{key}.json", indicator_file("facilities", "", years, {}, license="CC BY 4.0"), quiet=True)
    print(f"  E-PRTR v16 {years[0]}–{years[-1]}；國家 {len(national['sox'])}；設施列數 "
          + "、".join(f"{k} {len(v):,}" for k, v in facilities.items()) + f"；部門 {sorted(sectors)}；對不到國家 {unknown}")
