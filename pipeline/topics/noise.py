"""多少人住在吵的地方：歐盟環境噪音指令（新主題，2026-11-07，製作手冊第二十五批 485，候選 1148；環境的「污染」）。

EEA「Noise data reported under Environmental Noise Directive (END)」2022 年那一輪（資料年 2021）的彙整表
Summary_END_2022_cutoff241118_v4.xlsx（ETC/HE 編，CC BY 4.0，版權 EEA；資料截止 2024-11-18）。
取檔用 EEA datashare（Nextcloud）的 WebDAV：使用者名稱是公開分享代碼、密碼空白（公開分享的標準讀法，不是登入）；
**一定要指到單一檔案**，不帶 ?path= 的 /download 會打包整個 EEA 公開 datastore（手冊的陷阱）。

工作表：Aggl_{Road,Rail,Air,Ind}_Data（438 個 10 萬人以上的都會區，各音源 Lden 5 dB 一級、Lnight 5 dB 一級的暴露人數），
MRoad_Data、MRail_Data、MAir_Data（都會區以外的主要道路、鐵路、機場）、*_Coverage（應報與實報）。
- 都會區的比例＝有報的都會區裡 Lden ≥ 55 dB（Lnight ≥ 50 dB）的人數 ÷ 那些都會區的人口（EEA 的標準算法）；
  沒有報、或 55 dB 以上任何一級是「No data」的都會區不算。
- 暴露人數＝都會區＋都會區以外的主要道路／鐵路／機場（兩者不重疊）；工業只在都會區。45–49 dB 大多沒報，不用。
- 英國 2020 年脫歐後不在這一輪；希臘、冰島、列支敦斯登、土耳其沒有提供。

輸出 public/data/topics/noise/：aggl-share/{item}.json、night-share/{item}.json（%）、exposed/{item}.json（人），
aggl.json（側欄：各國各都會區的道路 Lden ≥ 55 dB 比例與應報、實報的都會區數）。
"""

from __future__ import annotations

from collections import defaultdict

import openpyxl

from common import OUT_DIR, download, indicator_file, write_json
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "noise"
URL = ("https://sdi.eea.europa.eu/datashare/public.php/webdav/eea_t_noise-exposure-2022_p_2021_v02_r00/"
       "Summary_END_2022_cutoff241118_v4.xlsx")
SHARE_TOKEN = "sptXqwkQr5g7Bp5"
YEAR = 2021
SOURCES = {"road": "Road", "rail": "Rail", "air": "Air", "industry": "Ind"}
MAJOR = {"road": "MRoad_Data", "rail": "MRail_Data", "air": "MAir_Data"}
NAMES = {"Czech Republic": "CZE", "Turkey": "TUR"}


def _num(v) -> float | None:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def _iso3(name: str) -> str | None:
    name = (name or "").strip()
    return NAMES.get(name) or from_name(name)


def _bands(header: tuple, start: int) -> tuple[list[int], list[int]]:
    """表頭那一列：Lden 7 級從 start 開始；Lnight 7 級緊接在 Lden（或 LdenM）之後，第一級是 40-44。
    回傳 Lden ≥ 55 與 Lnight ≥ 50 的欄位"""
    den = list(range(start + 2, start + 7))  # 55-59 … >75
    night_start = next(i for i in range(start + 7, len(header)) if str(header[i]).strip() == "40-44")
    return den, list(range(night_start + 2, night_start + 7))  # 50-54 … >70


def _sum(row: tuple, cols: list[int]) -> float | None:
    vals = [_num(row[i]) for i in cols]
    return None if any(v is None for v in vals) else sum(vals)


def _download():
    """WebDAV 要帶公開分享代碼當使用者名稱（common.download 不帶認證，這裡自己下載到同一個快取資料夾）"""
    import base64
    import urllib.request

    import common
    target = common.CACHE_DIR / "eea-noise" / "Summary_END_2022_cutoff241118_v4.xlsx"
    if not target.exists() or common.REFRESH:
        print(f"  下載 {URL}")
        auth = base64.b64encode(f"{SHARE_TOKEN}:".encode()).decode()
        request = urllib.request.Request(URL, headers={"User-Agent": common.USER_AGENT, "Authorization": f"Basic {auth}"})
        with urllib.request.urlopen(request, timeout=300, context=common._ssl_context(URL)) as resp:
            data = resp.read()
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    return target


def build() -> None:
    wb = openpyxl.load_workbook(_download(), read_only=True, data_only=True)
    share: dict[str, dict[str, float]] = {}
    night: dict[str, dict[str, float]] = {}
    exposed: dict[str, dict[str, float]] = defaultdict(dict)
    cities: dict[str, list] = defaultdict(list)
    for key, sheet in SOURCES.items():
        rows = list(wb[f"Aggl_{sheet}_Data"].iter_rows(values_only=True))
        den_cols, night_cols = _bands(rows[5], 5)
        num, den, nnum, nden = defaultdict(float), defaultdict(float), defaultdict(float), defaultdict(float)
        for r in rows[6:]:
            iso3 = _iso3(r[0])
            inhabitants = _num(r[3])
            if not iso3 or not inhabitants:
                continue
            d, n = _sum(r, den_cols), _sum(r, night_cols)
            if d is not None:
                num[iso3] += d
                den[iso3] += inhabitants
                if key == "road":
                    cities[iso3].append([str(r[2]).strip(), round(inhabitants), round(d / inhabitants * 100, 1)])
            if n is not None:
                nnum[iso3] += n
                nden[iso3] += inhabitants
        share[key] = {k: round(num[k] / den[k] * 100, 1) for k in den if den[k]}
        night[key] = {k: round(nnum[k] / nden[k] * 100, 1) for k in nden if nden[k]}
        for k, v in num.items():
            exposed[key][k] = v
    for key, sheet in MAJOR.items():
        rows = list(wb[sheet].iter_rows(values_only=True))
        header = rows[4]
        start = next(i for i, h in enumerate(header) if str(h).strip() == "45-49")
        den_cols, _ = _bands(header, start)
        for r in rows[5:]:
            iso3 = _iso3(r[0])
            d = _sum(r, den_cols) if iso3 else None
            if d is not None:
                exposed[key][iso3] = exposed[key].get(iso3, 0) + d

    # 應報與實報的都會區數（道路）
    coverage = {}
    for r in wb["Aggl_Road_Coverage"].iter_rows(values_only=True):
        iso3 = _iso3(r[1]) if len(r) > 1 and isinstance(r[1], str) else None
        if iso3 and _num(r[3]) is not None:
            coverage[iso3] = [int(r[3]), int(_num(r[4]) or 0)]

    lic = "CC BY 4.0"
    years = [YEAR]
    for key in SOURCES:
        write_json(OUT / "aggl-share" / f"{key}.json", indicator_file("aggl-share", "%", years, {k: [v] for k, v in share[key].items()}, license=lic))
        write_json(OUT / "night-share" / f"{key}.json", indicator_file("night-share", "%", years, {k: [v] for k, v in night[key].items()}, license=lic))
        write_json(OUT / "exposed" / f"{key}.json", indicator_file("exposed", "人", years, {k: [round(v)] for k, v in exposed[key].items()}, license=lic))
    for iso3 in cities:
        cities[iso3].sort(key=lambda c: -c[2])
    write_json(OUT / "aggl.json", {"year": YEAR, "coverage": coverage, "cities": cities})
    print(f"  END 2022（資料年 {YEAR}）：道路都會區比例 {len(share['road'])} 國，暴露人數 {len(exposed['road'])} 國，都會區 {sum(len(v) for v in cities.values())} 個")
