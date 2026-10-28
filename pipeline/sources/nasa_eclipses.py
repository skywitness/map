"""NASA 日食網站（eclipse.gsfc.nasa.gov，Fred Espenak）：五千年日食目錄與每次日食的貝塞爾根數。

- **目錄**（Five Millennium Catalog of Solar Eclipses，Espenak & Meeus, NASA TP-2006-214141）：每 100 年一頁
  （`SEcat5/SE1901-2000.html`），每次日食一列：編號、日期、食甚的力學時（TD）、ΔT、朔望月編號、沙羅週期、
  類型（P 偏食、A 環食、T 全食、H 混合食；第二個字元 m 是沙羅週期的中間、n 沒有北界、s 沒有南界、+ 非中心食沒有北界、
  - 非中心食沒有南界、2 混合食先全後環、3 先環後全、b／e 沙羅週期的第一、最後一次）、gamma、食分、食甚的經緯度、
  太陽高度、路徑寬度（km）、中心線的食甚持續時間。
- **貝塞爾根數**：t0（整點的 TDT）、ΔT、x、y、d、l1、l2、μ 的多項式係數（t = TDT − t0，單位小時），tan f1、tan f2。兩組：
  - 五千年日食典（`SEsearch/SEdata.php?Ecl=YYYYMMDD`，VSOP87/ELP2000-82，ΔT 是 2006 年的外推）：每一次日食都有。
  - 路徑表那一組（`SEbeselm/`，VSOP87/ELP2000-85，ΔT 較新，例如 2024 年 70.6 秒對五千年日食典的 74.0 秒）：
    只有部分日食有（1900–2100 年 152 次），NASA 的路徑表（`SEpath/`）用的就是它；有的話優先用（topics/eclipses.py 的
    elements_for()）。驗證見 DESIGN.md 第 8 節第 88 點。
- **授權**：NASA 的資料不受著作權保護（https://eclipse.gsfc.nasa.gov/SEpubs/copyright.html：「NASA material is not
  protected by copyright unless noted … may be reproduced and distributed without further permission from NASA」）；
  每一頁另外寫「Permission is freely granted to reproduce this data when accompanied by an acknowledgment:
  "Eclipse Predictions by Fred Espenak, NASA's GSFC"」（目錄的說明頁寫「… by Fred Espenak and Jean Meeus (NASA's GSFC)」），
  頁尾與資料檔照寫。
"""
from __future__ import annotations

import html
import re
import time
import urllib.error
from dataclasses import dataclass
from pathlib import Path

from common import CACHE_DIR, download

BASE = "https://eclipse.gsfc.nasa.gov/"
CATALOG_PAGES = ["SE1801-1900", "SE1901-2000", "SE2001-2100"]
CREDIT = "Eclipse Predictions by Fred Espenak, NASA's GSFC"
CREDIT_CANON = "Eclipse Predictions by Fred Espenak and Jean Meeus (NASA's GSFC)"
MONTHS = {m: i + 1 for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}


@dataclass
class CatalogRow:
    number: int
    year: int
    month: int
    day: int
    td: str  # 食甚的 TD（hh:mm:ss）
    delta_t: float
    lunation: int
    saros: int
    type: str  # 例如 "T"、"Am"、"H3"、"A-"
    gamma: float
    magnitude: float
    lat: float
    lon: float
    sun_alt: int
    width_km: float | None
    duration_s: float | None

    @property
    def ymd(self) -> int:
        return self.year * 10000 + self.month * 100 + self.day

    @property
    def kind(self) -> str:
        """P、A、T、H"""
        return self.type[0]

    @property
    def central(self) -> bool:
        """中心食（影軸經過地球）：非中心食的第二個字元是 + 或 -"""
        return self.kind in "ATH" and not (len(self.type) > 1 and self.type[1] in "+-")


def _text(path: Path) -> str:
    raw = path.read_text(encoding="utf-8", errors="replace")
    return html.unescape(re.sub(r"<[^>]+>", "", raw))


def _angle(token: str) -> float:
    """「25N」「104W」→ 25、−104"""
    v = float(token[:-1])
    return -v if token[-1] in "SW" else v


def _duration(token: str) -> float | None:
    m = re.fullmatch(r"(\d+)m(\d+)s", token)
    return int(m.group(1)) * 60 + int(m.group(2)) if m else None


def catalog() -> list[CatalogRow]:
    """1801–2100 年的目錄（三頁），依日期排列"""
    rows: list[CatalogRow] = []
    for page in CATALOG_PAGES:
        path = download(f"{BASE}SEcat5/{page}.html", "nasa-eclipse", f"{page}.html")
        for line in _text(path).splitlines():
            t = line.split()
            if len(t) < 15 or not re.fullmatch(r"\d{5}", t[0]) or t[2] not in MONTHS:
                continue
            width = dur = None
            if len(t) >= 17:
                width = float(t[15]) if re.fullmatch(r"\d+", t[15]) else None
                dur = _duration(t[16])
            rows.append(CatalogRow(
                number=int(t[0]), year=int(t[1]), month=MONTHS[t[2]], day=int(t[3]), td=t[4],
                delta_t=float(t[5]), lunation=int(t[6]), saros=int(t[7]), type=t[8],
                gamma=float(t[10]), magnitude=float(t[11]), lat=_angle(t[12]), lon=_angle(t[13]),
                sun_alt=int(t[14]), width_km=width, duration_s=dur,
            ))
    rows.sort(key=lambda r: r.ymd)
    return rows


@dataclass
class Elements:
    """一次日食的貝塞爾根數：多項式係數（t = TDT − t0，小時）"""
    ymd: int
    t0: float  # TDT 的小時
    delta_t: float  # 秒
    x: list[float]
    y: list[float]
    d: list[float]  # 度
    l1: list[float]
    l2: list[float]
    mu: list[float]  # 度
    tan_f1: float
    tan_f2: float


_NUM = r"[-+]?\d+\.\d+"


def elements(ymd: int, *, delay: float = 0.3) -> Elements:
    """SEdata.php 的貝塞爾根數（快取在 .cache/nasa-eclipse/sedata/）"""
    target = CACHE_DIR / "nasa-eclipse" / "sedata" / f"{ymd}.html"
    if not target.exists():
        time.sleep(delay)  # 一次一頁，別打太快
    path = download(f"{BASE}SEsearch/SEdata.php?Ecl={ymd:08d}", "nasa-eclipse/sedata", f"{ymd}.html")
    text = _text(path)
    # PHP 的警告訊息（第 3 項的 d 沒有值）夾在第 3 列中間，先拿掉
    text = re.sub(r"Warning:[^\n]*\n", "", text)
    t0 = float(re.search(r"Polynomial Besselian Elements for:.*?(\d+\.\d+)\s*TDT", text).group(1))
    dt = float(re.search(r"ΔT\s*=\s*(" + _NUM + r")\s*s", text).group(1))
    rows: dict[int, list[float]] = {}
    block = text[text.index("Polynomial Besselian Elements") :]
    lines = block.splitlines()
    for i, line in enumerate(lines):
        m = re.match(r"\s*([0-3])\s+(" + _NUM + r"(?:\s+" + _NUM + r")*)", line)
        if not m or int(m.group(1)) in rows:
            continue
        nums = [float(v) for v in re.findall(_NUM, m.group(2))]
        if int(m.group(1)) == 3 and len(nums) < 6:
            # 第 3 列只有 x3、y3，警告後面那一行是 d3、l13、l23、μ3（都是 0）
            follow = next((ln for ln in lines[i + 1 : i + 4] if re.search(_NUM, ln)), "")
            nums += [float(v) for v in re.findall(_NUM, follow)]
        rows[int(m.group(1))] = (nums + [0.0] * 6)[:6]
        if len(rows) == 4:
            break
    tan = re.search(r"tan f1\s*=\s*(" + _NUM + r")\s+tan f2\s*=\s*(" + _NUM + r")", text)
    cols = list(zip(*(rows[n] for n in range(4))))
    return Elements(
        ymd=ymd, t0=t0, delta_t=dt,
        x=list(cols[0]), y=list(cols[1]), d=list(cols[2]), l1=list(cols[3]), l2=list(cols[4]), mu=list(cols[5]),
        tan_f1=float(tan.group(1)), tan_f2=float(tan.group(2)),
    )


# ── 驗證用：NASA 公布的路徑表（SEpath，每 2 分鐘的北界、南界、中心線） ─────────────
MON_NAMES = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


def _page_name(ymd: int, kind: str, suffix: str) -> tuple[str, str]:
    y, m, d = ymd // 10000, ymd // 100 % 100, ymd % 100
    century = (y - 1) // 100 * 100 + 1
    return f"{century}", f"SE{y}{MON_NAMES[m - 1]}{d:02d}{kind}{suffix}.html"


def beselm_elements(ymd: int, kind: str) -> Elements | None:
    """路徑表用的那一組根數（SEbeselm，VSOP87/ELP2000-85）；只有部分日食有這一頁，沒有時回傳 None。只用來驗證"""
    century, name = _page_name(ymd, kind, "beselm")
    missing = CACHE_DIR / "nasa-eclipse" / "sebeselm" / (name + ".missing")
    if missing.exists():
        return None
    target = CACHE_DIR / "nasa-eclipse" / "sebeselm" / name
    if not target.exists():
        time.sleep(0.3)
    try:
        path = download(f"{BASE}SEbeselm/SEbeselm{century}/{name}", "nasa-eclipse/sebeselm", name)
    except urllib.error.HTTPError as err:
        if err.code != 404:
            raise
        # 這次日食沒有這一頁：記下來，下次不必再問
        missing.parent.mkdir(parents=True, exist_ok=True)
        missing.write_text("404\n", encoding="utf-8")
        return None
    text = _text(path)
    t0 = float(re.search(r"Polynomial Besselian Elements for:.*?(\d+:\d+:\d+\.\d)\s*TDT", text).group(1).split(":")[0])
    dt = float(re.search(r"ΔT\s*=\s*(" + _NUM + r")\s*s", text).group(1))
    block = text[text.index("Polynomial Besselian Elements") :]
    rows: dict[int, list[float]] = {}
    for line in block.splitlines():
        m = re.match(r"\s*([0-3])\s+(" + _NUM + r"(?:\s+" + _NUM + r")*)\s*$", line)
        if m and int(m.group(1)) not in rows:
            rows[int(m.group(1))] = ([float(v) for v in re.findall(_NUM, m.group(2))] + [0.0] * 6)[:6]
        if len(rows) == 4:
            break
    for n in range(4):
        rows.setdefault(n, [0.0] * 6)
    # 第 3 列只有 x3、y3
    tan = re.search(r"Tan ƒ1\s*=\s*(" + _NUM + r")\s+Tan ƒ2\s*=\s*(" + _NUM + r")", text)
    cols = list(zip(*(rows[n] for n in range(4))))
    return Elements(
        ymd=ymd, t0=t0, delta_t=dt,
        x=list(cols[0]), y=list(cols[1]), d=list(cols[2]), l1=list(cols[3]), l2=list(cols[4]), mu=list(cols[5]),
        tan_f1=float(tan.group(1)), tan_f2=float(tan.group(2)),
    )


def _dms(deg: str, minutes: str, hemi: str) -> float:
    v = int(deg) + float(minutes) / 60
    return -v if hemi in "SW" else v


def path_table(ymd: int, kind: str) -> list[tuple[str, tuple[float, float] | None, tuple[float, float] | None, tuple[float, float] | None]]:
    """[(UT 時刻, 北界, 南界, 中心線)]，(緯度, 經度)，沒有的寫 None；第一列「Limits」是路徑在日出、日落處的端點"""
    century, name = _page_name(ymd, kind, "path")
    path = download(f"{BASE}SEpath/SEpath{century}/{name}", "nasa-eclipse/sepath", name)
    out = []
    pos = r"(\d{2})\s+(\d{2}\.\d)([NS])\s+(\d{3})\s+(\d{2}\.\d)([EW])"
    for line in _text(path).splitlines():
        m0 = re.match(r"\s*(Limits|\d{2}:\d{2})\s+(.*)", line)
        if not m0:
            continue
        rest = m0.group(2)
        # 三組座標，沒有的寫「-   -」
        cells = re.findall(pos + r"|(-)\s+(-)", rest)
        if len(cells) < 3:
            continue
        coords = []
        for c in cells[:3]:
            if c[0]:
                coords.append((_dms(c[0], c[1], c[2]), _dms(c[3], c[4], c[5])))
            else:
                coords.append(None)
        out.append((m0.group(1), coords[0], coords[1], coords[2]))
    return out


# ── 月食 ───────────────────────────────────────────────────

# 五千年月食目錄（Espenak & Meeus, NASA TP-2009-214172、214173）：每 100 年一頁（LEcat5/LE1901-2000.html），
# 每次月食一列：編號、日期、食甚的 TD、ΔT、朔望月、沙羅週期、類型（T 全食、P 偏食、N 半影食；後面的字元見目錄的說明頁）、
# QSE、gamma、半影食分、本影食分、半影／偏食／全食的持續時間（分鐘，沒有的寫 -）、食甚時月亮在天頂的緯度與經度（整數度）。
# 跟日食同一個網站、同樣的授權（每一頁寫「Permission is freely granted … "Eclipse Predictions by Fred Espenak and
# Jean Meeus (NASA's GSFC)"」）
LUNAR_PAGES = ["LE1801-1900", "LE1901-2000", "LE2001-2100"]


@dataclass
class LunarRow:
    number: int
    year: int
    month: int
    day: int
    td: str
    delta_t: float
    saros: int
    type: str  # 例如 "T"、"T+"、"P"、"Nb"
    gamma: float
    pen_mag: float
    um_mag: float
    pen_min: float
    par_min: float | None  # 偏食（本影）階段，U1–U4
    tot_min: float | None  # 全食，U2–U3
    lat: float  # 食甚時月亮在天頂的位置
    lon: float

    @property
    def ymd(self) -> int:
        return self.year * 10000 + self.month * 100 + self.day

    @property
    def kind(self) -> str:
        """T、P、N"""
        return self.type[0]


def _minutes(token: str) -> float | None:
    return None if token == "-" else float(token)


def lunar_catalog() -> list[LunarRow]:
    """1801–2100 年的月食目錄（三頁），依日期排列；含半影月食（用的人自己篩）"""
    rows: list[LunarRow] = []
    for page in LUNAR_PAGES:
        path = download(f"{BASE}LEcat5/{page}.html", "nasa-eclipse", f"{page}.html")
        for line in _text(path).splitlines():
            t = line.split()
            if len(t) != 18 or not re.fullmatch(r"\d{5}", t[0]) or t[2] not in MONTHS:
                continue
            rows.append(LunarRow(
                number=int(t[0]), year=int(t[1]), month=MONTHS[t[2]], day=int(t[3]), td=t[4],
                delta_t=float(t[5]), saros=int(t[7]), type=t[8], gamma=float(t[10]),
                pen_mag=float(t[11]), um_mag=float(t[12]), pen_min=float(t[13]),
                par_min=_minutes(t[14]), tot_min=_minutes(t[15]), lat=_angle(t[16]), lon=_angle(t[17]),
            ))
    rows.sort(key=lambda r: r.ymd)
    return rows
