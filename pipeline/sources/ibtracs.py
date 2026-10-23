"""NOAA NCEI IBTrACS v04r01（International Best Track Archive for Climate Stewardship）：全球熱帶氣旋的最佳路徑。

https://www.ncei.noaa.gov/products/international-best-track-archive ，資料集 doi:10.25921/82ty-9e16，
論文 Knapp et al. (2010), BAMS 91, 363–376, doi:10.1175/2009BAMS2755.1。
- 授權：NOAA 的產品頁寫「full and open access」（World Data Center for Meteorology 的政策，商業使用參照 WMO
  第 40 號決議）；data.gov 的資料集目錄標 CC0 1.0（公有領域）。這裡只用美國機構（NHC、CPHC、JTWC）的
  USA_* 欄位與 IBTrACS 合併後的位置，都是美國政府資料；WMO_PRES 只在美國機構沒有氣壓時補上。
- 用整份的 ibtracs.ALL.list.v04r01.csv（約 333 MB，1842 年起）。第一列是欄名、第二列是單位，缺值是一個空白。
  NCEI 每週更新 2–3 次（覆寫同一個檔），要更新用 `--refresh`。2026-10-23 從 NCEI 下載時單一連線只有約
  20 KB/s（333 MB 要 4 小時以上），那次是用 HTTP Range 分 24 段平行下載同一個檔（ETag 相同）放進快取。
- 只讀前 26 欄（到 USA_SSHS），每列 split(",", 26)，比 csv 模組快很多；這幾欄沒有引號或逗號（讀取時檢查）。

欄位的選擇（DESIGN.md 第 8 節）：
- 風速一律用 USA_WIND（美國機構的 1 分鐘平均最大持續風速，kt），強度分級用 USA_SSHS（薩菲爾－辛普森）。
  WMO_WIND 是各區域專業氣象中心的風速，平均時間各不相同（日本氣象廳、澳洲是 10 分鐘，印度 3 分鐘），
  不能直接比，所以不用。
- 氣壓用 USA_PRES，沒有才用 WMO_PRES（Storm.pres_source 記下用了哪一個）。
- TRACK_TYPE：main、PROVISIONAL、US-PROVISIONAL（最近一兩年還沒重新分析的即時資料）；*spur 是同一個
  系統的替代路徑（生成初期不同機構的位置），不收。
- SEASON：北半球是生成的那一年；南半球的季從前一年 7 月 1 日到當年 6 月 30 日，例如 2024 季是 2023-07 到 2024-06。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from common import download

URL = (
    "https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/"
    "v04r01/access/csv/ibtracs.ALL.list.v04r01.csv"
)
FILENAME = "ibtracs.ALL.list.v04r01.csv"
TRACK_TYPES = {"main", "PROVISIONAL", "US-PROVISIONAL"}
PROVISIONAL = {"PROVISIONAL", "US-PROVISIONAL"}
COLUMNS = [
    "SID", "SEASON", "NUMBER", "BASIN", "SUBBASIN", "NAME", "ISO_TIME", "NATURE", "LAT", "LON",
    "WMO_WIND", "WMO_PRES", "WMO_AGENCY", "TRACK_TYPE", "DIST2LAND", "LANDFALL", "IFLAG", "USA_AGENCY",
    "USA_ATCF_ID", "USA_LAT", "USA_LON", "USA_RECORD", "USA_STATUS", "USA_WIND", "USA_PRES", "USA_SSHS",
]
_I = {name: i for i, name in enumerate(COLUMNS)}


@dataclass
class Fix:
    """路徑上的一個時間點（UTC）"""

    time: float  # Unix 秒
    lat: float
    lon: float  # 原始經度（−180–180）；畫線前再展開成連續的
    wind: float | None  # USA_WIND，kt
    pres: float | None  # USA_PRES，hPa
    wmo_pres: float | None
    sshs: int | None  # USA_SSHS：−5 不明、−4 溫帶/後熱帶、−3 擾動、−2 副熱帶、−1 熱帶性低氣壓、0 熱帶風暴、1–5 級
    nature: str  # IBTrACS 合併的性質：TS 熱帶、ET 溫帶、SS 副熱帶、DS 擾動、MX 不一致、NR 沒有報告
    dist2land: float | None  # 公里
    synoptic: bool  # 00、06、12、18 UTC
    original: bool  # 美國機構的原始紀錄（IFLAG 第 1 個字元是 O），不是 IBTrACS 內插的
    basin: str


@dataclass
class Storm:
    sid: str
    season: int
    name: str  # IBTrACS 的名稱（大寫英文，沒有名字的是 UNNAMED、NOT_NAMED）
    basin: str  # 生成時的海域：NA、EP、WP、NI、SI、SP、SA
    track_type: str
    atcf_id: str
    agency: str  # USA_AGENCY（hurdat_atl、jtwc_wp…），第一個有值的
    fixes: list[Fix] = field(default_factory=list)

    @property
    def provisional(self) -> bool:
        return self.track_type in PROVISIONAL


def _num(s: str) -> float | None:
    s = s.strip()
    return float(s) if s else None


def _time(s: str) -> tuple[float, bool]:
    t = datetime.strptime(s, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    return t.timestamp(), t.minute == 0 and t.second == 0 and t.hour % 6 == 0


def csv_path():
    return download(URL, "ibtracs", FILENAME)


def storms(start_season: int) -> list[Storm]:
    """SEASON ≥ start_season 的熱帶氣旋（不含 spur），依 SID 排序，每個 Storm 的 fixes 依時間排序。"""
    path = csv_path()
    out: dict[str, Storm] = {}
    with open(path, encoding="utf-8", newline="") as f:
        header = f.readline().rstrip("\r\n").split(",")
        if header[: len(COLUMNS)] != COLUMNS:
            raise RuntimeError(f"IBTrACS 的欄位跟預期的不同：{header[:len(COLUMNS)]}")
        f.readline()  # 單位
        n_columns = len(header)
        for line in f:
            row = line.rstrip("\r\n").split(",", len(COLUMNS))
            season = int(row[_I["SEASON"]])
            if season < start_season:
                continue
            if row[-1].count(",") != n_columns - len(COLUMNS) - 1:
                raise RuntimeError(f"IBTrACS 這一列的欄位數不對（可能有引號或逗號）：{line[:120]}")
            track_type = row[_I["TRACK_TYPE"]].strip()
            if track_type not in TRACK_TYPES:
                continue
            sid = row[_I["SID"]]
            storm = out.get(sid)
            if storm is None:
                storm = out[sid] = Storm(
                    sid=sid, season=season, name=row[_I["NAME"]].strip(), basin=row[_I["BASIN"]].strip(),
                    track_type=track_type, atcf_id=row[_I["USA_ATCF_ID"]].strip(), agency="",
                )
            if not storm.agency and row[_I["USA_AGENCY"]].strip():
                storm.agency = row[_I["USA_AGENCY"]].strip()
            t, synoptic = _time(row[_I["ISO_TIME"]])
            sshs = _num(row[_I["USA_SSHS"]])
            storm.fixes.append(Fix(
                time=t, lat=float(row[_I["LAT"]]), lon=float(row[_I["LON"]]),
                wind=_num(row[_I["USA_WIND"]]), pres=_num(row[_I["USA_PRES"]]), wmo_pres=_num(row[_I["WMO_PRES"]]),
                sshs=None if sshs is None else int(sshs), nature=row[_I["NATURE"]].strip(),
                dist2land=_num(row[_I["DIST2LAND"]]), synoptic=synoptic, original=row[_I["IFLAG"]][:1] == "O",
                basin=row[_I["BASIN"]].strip(),
            ))
    for s in out.values():
        s.fixes.sort(key=lambda x: x.time)
    return [out[k] for k in sorted(out)]
