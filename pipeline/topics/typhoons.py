"""颱風與颶風主題：NOAA IBTrACS v04r01 的最佳路徑（1950 年起）；中文名稱與台灣的對照用中央氣象署颱風資料庫。

**風速與強度**（全部用美國機構 NHC、CPHC、JTWC 的資料，見 sources/ibtracs.py）：
- 風速是 USA_WIND（1 分鐘平均最大持續風速，kt），強度分級是 USA_SSHS（薩菲爾－辛普森颶風等級）：
  熱帶性低氣壓 < 34 kt、熱帶風暴 34–63、1 級 64–82、2 級 83–95、3 級 96–112、4 級 113–136、5 級 ≥ 137。
  中央氣象署、日本氣象廳用 10 分鐘平均，數字比較小，分級也不同（輕度、中度、強烈颱風）。
- 溫帶氣旋、副熱帶氣旋、擾動（USA_SSHS −4、−3、−2）另成一類；沒有 USA_WIND 的點是「強度不明」。
- 北印度洋、南半球 1980 年以前美國機構沒有風速（US_WIND_FROM），那時的颱風整個是「強度不明」。

**年份**：時間軸的年份是路徑第一個點（UTC）的那一年，不是 IBTrACS 的 SEASON：南半球的 SEASON 從前一年 7 月
算起（2024 季是 2023-07 到 2024-06），今年 7 月以後的南半球颱風已經是明年的季。北半球兩者幾乎一樣。

**地圖**（tracks.json，common.lines_file()）：
- 一個颱風一條線，頂點是 00、06、12、18 UTC 的定時位置，加上美國機構非定時的原始紀錄（例如颶風登陸的時刻）；
  vertexTypes 是每個頂點的強度代碼（UNKNOWN…C5），records 是每條線的年份、名稱（含中央氣象署的中文名）、
  巔峰風速、最低氣壓、起訖日期與是否為即時資料。
- 收錄美國機構風速曾達熱帶風暴（34 kt 以上、熱帶性質）的颱風；北印度洋、南半球 1980 年以前整個颱風都沒有風速的
  也收（畫成強度不明）。其他沒有美國機構風速的（多半是美國機構沒有列入的弱系統）與一直是熱帶性低氣壓的不收。
- Douglas–Peucker 簡化（SIMPLIFY_DEG），強度改變的頂點一定保留；經度展開成連續的（可以超過 ±180）。

**國家統計**（100 公里規則，NearIndex）：
- 路徑（所有 3 小時一筆的點）先每 DENSIFY_KM 公里內插一點（位置、風速線性內插，性質取比較近的那一端），
  內插點在某國國界內或離它的國界 NEAR_KM 公里以內、風速 34 kt 以上且是熱帶氣旋時，這個颱風算這一國一次
  （一個颱風可以算好幾國，對同一國只算一次），算在颱風的年份（路徑第一個點那一年）。
  國界跟地震主題一樣用 population_grid.country_shapes()（1:50m，沒有形狀的小島不算，例如吐瓦魯）。
- 「最強的颱風」是那十年內在 100 公里內時風速最大的那一個的等級（內插的風速取到 5 kt、不超過那個颱風的巔峰，
  Pass.wind5）；熱帶性低氣壓的階段也算（只有熱帶性低氣壓經過的國家是「熱帶性低氣壓」），一次都沒有的國家是 null。
- 北印度洋、南半球的國家：1980 年以後算到的颱風有 PARTIAL_SHARE 以上是在這些海域經過的，1980 年以前的值是 null
  （那時沒有風速，算不到），附註會說明。
"""
from __future__ import annotations

import gzip
import json
import math
import urllib.request
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

import numpy as np

import common
from common import CACHE_DIR, OUT_DIR, USER_AGENT, indicator_file, lines_file, now_iso, write_json
from sources import ibtracs
from sources.ibtracs import Fix, Storm
from topics.earthquakes import KM_PER_DEG, OffshoreIndex

OUT = OUT_DIR / "topics" / "typhoons"
START_YEAR = 1950
NEAR_KM = 100
TS_KT = 34
DENSIFY_KM = 10
SIMPLIFY_DEG = 0.12
QUANTUM = 0.1
# 美國機構從這一年起才有風速的海域；之前的颱風強度不明，依賴這些海域的國家之前的統計是 null
US_WIND_FROM = {"NI": 1980, "SI": 1980, "SP": 1980}
PARTIAL_FROM = 1980
PARTIAL_SHARE = 0.1
PANEL_ROWS = 10

# 強度代碼（tracks.json 的 vertexTypes、strongest-decade.json 的值；src/topics/typhoons.ts 的 CLASS 要一致）。
# 代碼大的畫在上面（sortByType），所以兩種灰色排最前面
UNKNOWN, OTHER, TD, TS, C1, C2, C3, C4, C5 = range(9)
SSHS_KT = [34, 64, 83, 96, 113, 137]  # 熱帶風暴、1–5 級的下限（kt）
BASINS = ["NA", "EP", "WP", "NI", "SI", "SP", "SA"]


def wind_class(kt: float) -> int:
    return TD + sum(kt >= t for t in SSHS_KT)


def tropical(f: Fix) -> bool:
    """USA_SSHS −1–5：熱帶性低氣壓到 5 級（不含溫帶、副熱帶、擾動與狀態不明）"""
    return f.sshs is not None and f.sshs >= -1


def fix_class(f: Fix) -> int:
    if tropical(f):
        return TD + 1 + f.sshs  # −1 → 熱帶性低氣壓，0 → 熱帶風暴，1–5 → 1–5 級
    if f.sshs in (-4, -3, -2):
        return OTHER
    if f.wind is not None:  # 狀態不明（XX）但有風速：依風速分級
        return wind_class(f.wind)
    return UNKNOWN


EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


def utc(t: float) -> datetime:
    # Windows 的 datetime.fromtimestamp() 不接受 1970 年以前（負數）的時間
    return EPOCH + timedelta(seconds=t)


def ymd(t: float) -> int:
    d = utc(t)
    return d.year * 10000 + d.month * 100 + d.day


def clean_name(name: str) -> str | None:
    """IBTrACS 的名稱是大寫英文，沒有名字的寫 UNNAMED、NOT_NAMED；兩個名字（改名或合併）用冒號隔開"""
    if not name or name in ("UNNAMED", "NOT_NAMED", "NAMELESS"):
        return None
    return " / ".join(part.strip().title() for part in name.split(":") if part.strip())


def name_key(name: str) -> str:
    return "".join(ch for ch in name.upper() if ch.isalpha())


def unwrap(lons: list[float]) -> list[float]:
    out = [lons[0]]
    for x in lons[1:]:
        out.append(out[-1] + ((x - out[-1] + 180) % 360 - 180))
    return out


# ── 中央氣象署颱風資料庫（中文名稱、侵台對照）─────────────────────────
CWA_BASE = "https://rdc28.cwa.gov.tw/TDB/public/"


def cwa_list(page: str, action: str) -> list[dict]:
    """颱風資料庫網頁本身用的查詢（POST year=all，回傳 JSON），快取在 .cache/cwa-tdb/。
    網站用 AJAX 讀取，沒有 X-Requested-With 標頭時回「No direct script access allowed」。
    common.download() 只能 GET，所以這裡自己下載，快取方式相同（--refresh 重新下載）。"""
    target = CACHE_DIR / "cwa-tdb" / f"{page}.json"
    if not target.exists() or common.REFRESH:
        target.parent.mkdir(parents=True, exist_ok=True)
        url = f"{CWA_BASE}{page}/{action}"
        print(f"  下載 {url}")
        req = urllib.request.Request(url, data=b"year=all", headers={
            "User-Agent": USER_AGENT, "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded", "Referer": f"{CWA_BASE}{page}/",
        })
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = resp.read()
        json.loads(data.decode("utf-8-sig"))  # 確認是 JSON 才存
        tmp = target.with_suffix(".part")
        tmp.write_bytes(data)
        tmp.replace(target)
    return json.loads(target.read_text(encoding="utf-8-sig"))


# ── 路徑 ──────────────────────────────────────────────────────────
@dataclass
class Track:
    storm: Storm
    year: int
    peak: float | None  # 熱帶階段的最大風速（kt）
    peak_class: int
    pres: float | None  # 最低氣壓（hPa）：USA_PRES，沒有才用 WMO_PRES
    name: str | None
    zh: str | None = None

    @property
    def counted_possible(self) -> bool:
        return self.peak is not None and self.peak >= TS_KT


def select(storms: list[Storm]) -> list[Track]:
    out: list[Track] = []
    skipped = Counter()
    for s in storms:
        year = utc(s.fixes[0].time).year
        if year < START_YEAR:  # 南半球 1950 季從 1949 年 7 月開始
            continue
        winds = [f.wind for f in s.fixes if f.wind is not None and tropical(f)]
        peak = max(winds) if winds else None
        if peak is not None and peak >= TS_KT:
            peak_class = wind_class(peak)
        elif all(f.wind is None for f in s.fixes) and year < US_WIND_FROM.get(s.basin, START_YEAR):
            peak_class = UNKNOWN
        else:
            skipped["熱帶性低氣壓或非熱帶" if any(f.wind is not None for f in s.fixes) else f"沒有風速（{s.basin}）"] += 1
            continue
        usa = [f.pres for f in s.fixes if f.pres is not None]
        wmo = [f.wmo_pres for f in s.fixes if f.wmo_pres is not None]
        pres = min(usa) if usa else min(wmo) if wmo else None
        out.append(Track(s, year, peak, peak_class, pres, clean_name(s.name)))
    print(f"  收錄 {len(out)} 個颱風；不收：{dict(skipped)}")
    out.sort(key=lambda t: (t.year, t.storm.fixes[0].time, t.storm.sid))
    return out


def simplify(xs: list[float], ys: list[float], keep: set[int], tol: float) -> list[int]:
    """Douglas–Peucker：keep 裡的頂點（頭尾、強度改變的點）一定保留，中間各段分別簡化"""
    anchors = sorted(keep | {0, len(xs) - 1})
    kept = set(anchors)
    for a, b in zip(anchors, anchors[1:]):
        stack = [(a, b)]
        while stack:
            i, j = stack.pop()
            if j - i < 2:
                continue
            x0, y0, x1, y1 = xs[i], ys[i], xs[j], ys[j]
            dx, dy = x1 - x0, y1 - y0
            norm = math.hypot(dx, dy)
            best, best_d = -1, tol
            for k in range(i + 1, j):
                if norm == 0:
                    d = math.hypot(xs[k] - x0, ys[k] - y0)
                else:
                    d = abs(dy * (xs[k] - x0) - dx * (ys[k] - y0)) / norm
                if d > best_d:
                    best, best_d = k, d
            if best >= 0:
                kept.add(best)
                stack += [(i, best), (best, j)]
    return sorted(kept)


def drawn_fixes(s: Storm) -> list[Fix]:
    fixes = [f for f in s.fixes if f.synoptic or f.original]
    return fixes if len(fixes) >= 2 else s.fixes


def track_lines(tracks: list[Track]) -> tuple[list, list, list]:
    lines, vtypes, records = [], [], []
    for tr in tracks:
        fixes = drawn_fixes(tr.storm)
        codes = [fix_class(f) for f in fixes]
        xs = unwrap([f.lon for f in fixes])
        ys = [f.lat for f in fixes]
        change = {i for i in range(1, len(codes)) if codes[i] != codes[i - 1]}
        idx = simplify(xs, ys, change, SIMPLIFY_DEG)
        lines.append([(xs[i], ys[i]) for i in idx])
        vtypes.append([codes[i] for i in idx])
        t0, t1 = tr.storm.fixes[0].time, tr.storm.fixes[-1].time
        records.append({
            "year": tr.year, "md0": ymd(t0) % 10000, "md1": ymd(t1) % 10000,
            "name": tr.name, "zh": tr.zh, "basin": tr.storm.basin,
            "wind": tr.peak, "pres": tr.pres, "cat": tr.peak_class, "prov": 1 if tr.storm.provisional else None,
        })
    return lines, vtypes, records


# ── 國家：100 公里內 ──────────────────────────────────────────────
class NearIndex:
    """經緯度 → 距離 km 以內的所有國家（國界內的距離是 0）。用 OffshoreIndex 的國界線段與 1° 網格分區。"""

    def __init__(self, km: float = NEAR_KM):
        self.km = km
        self.base = OffshoreIndex(max_km=km)
        self.codes = self.base.codes

    def query(self, lon: np.ndarray, lat: np.ndarray, land: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """回傳 (點, 國家, 距離 km) 三個陣列。land 是可能在陸地上的點（IBTrACS 的 DIST2LAND 是 0）：
        離所有國界都超過 km 的點，只檢查這些是不是在某國的國界內（大陸深處）。"""
        px = (lon + 180) % 360 - 180
        py = lat
        cx, cy = np.floor(px).astype(int), np.floor(py).astype(int)
        keys = (cx + 180) * 1000 + (cy + 90)
        order = np.argsort(keys, kind="stable")
        uniq, start = np.unique(keys[order], return_index=True)
        bounds = list(start) + [len(order)]
        s = self.base.segments
        lim2 = (self.km / KM_PER_DEG) ** 2
        hit_p, hit_c, hit_d = [], [], []
        for g, key in enumerate(uniq):
            cand = self.base._cells.get((int(key // 1000) - 180, int(key % 1000) - 90))
            if cand is None:
                continue
            seg = s[cand]
            sc = seg[:, 4].astype(int)
            countries = np.unique(sc)
            pts = order[bounds[g] : bounds[g + 1]]
            step = max(1, 3_000_000 // len(cand))
            for k in range(0, len(pts), step):
                idx = pts[k : k + step]
                x, y = px[idx, None], py[idx, None]
                kx = np.cos(np.radians(y))
                ax, ay = (seg[:, 0] - x) * kx, seg[:, 1] - y
                bx, by = (seg[:, 2] - x) * kx, seg[:, 3] - y
                dx, dy = bx - ax, by - ay
                length2 = dx * dx + dy * dy
                with np.errstate(divide="ignore", invalid="ignore"):
                    t = np.clip(np.where(length2 > 0, -(ax * dx + ay * dy) / length2, 0), 0, 1)
                d2 = (ax + t * dx) ** 2 + (ay + t * dy) ** 2
                for c in countries:
                    dmin = d2[:, sc == c].min(axis=1)
                    near = dmin <= lim2
                    if near.any():
                        hit_p.append(idx[near])
                        hit_c.append(np.full(int(near.sum()), c))
                        hit_d.append(np.sqrt(dmin[near]) * KM_PER_DEG)
        hp = np.concatenate(hit_p) if hit_p else np.zeros(0, int)
        hc = np.concatenate(hit_c) if hit_c else np.zeros(0, int)
        hd = np.concatenate(hit_d) if hit_d else np.zeros(0)
        # 國界內：有命中的點，加上離國界很遠、但可能在陸地上的點
        test = np.zeros(len(px), dtype=bool)
        test[hp] = True
        test |= land
        ti = np.flatnonzero(test)
        in_p, in_c = [], []
        for index, (x0, y0, x1, y1), rings in self.base.polygons:
            m = ti[(px[ti] >= x0) & (px[ti] <= x1) & (py[ti] >= y0) & (py[ti] <= y1)]
            if not len(m):
                continue
            inside = OffshoreIndex._inside(rings[0], px[m], py[m])
            for hole in rings[1:]:
                inside &= ~OffshoreIndex._inside(hole, px[m], py[m])
            if inside.any():
                in_p.append(m[inside])
                in_c.append(np.full(int(inside.sum()), index))
        if in_p:
            hp = np.concatenate([hp, *in_p])
            hc = np.concatenate([hc, *in_c])
            hd = np.concatenate([hd, np.zeros(sum(len(a) for a in in_p))])
        # 同一點、同一國只留最近的距離（國界內是 0）
        o = np.lexsort((hd, hc, hp))
        hp, hc, hd = hp[o], hc[o], hd[o]
        first = np.ones(len(hp), dtype=bool)
        first[1:] = (hp[1:] != hp[:-1]) | (hc[1:] != hc[:-1])
        return hp[first], hc[first], hd[first]


def densify(tracks: list[Track]) -> dict[str, np.ndarray]:
    """所有颱風熱帶階段、有風速的路徑，每 DENSIFY_KM 公里一點（含每段的兩端）"""
    parts: dict[str, list[np.ndarray]] = defaultdict(list)
    basin_code = {b: i for i, b in enumerate(BASINS)}
    for ti, tr in enumerate(tracks):
        if not tr.counted_possible:
            continue
        fx = tr.storm.fixes
        if len(fx) < 2:
            continue
        lon = np.asarray(unwrap([f.lon for f in fx]))
        lat = np.asarray([f.lat for f in fx])
        wind = np.asarray([np.nan if f.wind is None else f.wind for f in fx])
        trop = np.asarray([tropical(f) for f in fx])
        time = np.asarray([f.time for f in fx])
        d2l = np.asarray([np.inf if f.dist2land is None else f.dist2land for f in fx])
        basin = np.asarray([basin_code.get(f.basin, -1) for f in fx])
        a, b = np.arange(len(fx) - 1), np.arange(1, len(fx))
        ok = ~np.isnan(wind[a]) & ~np.isnan(wind[b]) & (trop[a] | trop[b])
        km = np.hypot((lon[b] - lon[a]) * np.cos(np.radians((lat[a] + lat[b]) / 2)), lat[b] - lat[a]) * KM_PER_DEG
        n = np.maximum(1, np.ceil(km / DENSIFY_KM)).astype(int) + 1  # 含兩端
        n[~ok] = 0
        if not n.sum():
            continue
        seg = np.repeat(a, n)
        k = np.arange(n.sum()) - np.repeat(np.cumsum(n) - n, n)
        frac = k / np.repeat(np.maximum(n - 1, 1), n)
        nxt = seg + 1
        near_a = frac < 0.5
        keep = np.where(near_a, trop[seg], trop[nxt])
        lerp = lambda v: v[seg] + frac * (v[nxt] - v[seg])  # noqa: E731
        parts["track"].append(np.full(int(keep.sum()), ti))
        parts["lon"].append(lerp(lon)[keep])
        parts["lat"].append(lerp(lat)[keep])
        parts["wind"].append(lerp(wind)[keep])
        parts["time"].append(lerp(time)[keep])
        parts["land"].append((np.minimum(d2l[seg], d2l[nxt]) <= 0)[keep])
        parts["basin"].append(np.where(near_a, basin[seg], basin[nxt])[keep])
    return {k: np.concatenate(v) for k, v in parts.items()}


@dataclass
class Pass:
    """一個颱風經過一個國家（100 公里內）"""

    track: int
    country: str
    wind: float  # 100 公里內的最大風速（kt）
    km: float  # 最近的距離（0 是進入國界內）
    t0: float  # 第一次、最後一次在 100 公里內（熱帶風暴以上；只有熱帶性低氣壓的就是那段）
    t1: float
    basins: set[str]
    peak: float  # 這個颱風的巔峰風速

    @property
    def counted(self) -> bool:
        return self.wind >= TS_KT

    @property
    def wind5(self) -> int:
        """沿路徑內插的風速取到 5 kt（美國機構的最佳路徑都是 5 kt 一級），不超過巔峰風速（即時資料不一定是 5 的倍數）；
        側欄與「最強的颱風」的等級用它"""
        w = min(5 * round(self.wind / 5), round(self.peak))
        return max(w, TS_KT) if self.counted else min(w, TS_KT - 1)

    @property
    def cls(self) -> int:
        return wind_class(self.wind5) if self.counted else TD


def passes(tracks: list[Track], index: NearIndex) -> list[Pass]:
    pts = densify(tracks)
    print(f"  內插 {len(pts['lon']):,} 點（每 {DENSIFY_KM} 公里）")
    hp, hc, hd = index.query(pts["lon"], pts["lat"], pts["land"])
    print(f"  {len(hp):,} 個「點 × 國家」在 {NEAR_KM} 公里內")
    by: dict[tuple[int, int], list[int]] = defaultdict(list)
    for p, c in zip(hp.tolist(), hc.tolist()):
        by[(int(pts["track"][p]), c)].append(p)
    out: list[Pass] = []
    dist = {(int(p), int(c)): float(d) for p, c, d in zip(hp, hc, hd)}
    for (ti, c), ps in by.items():
        ps = np.asarray(ps)
        w = pts["wind"][ps]
        strong = ps[w >= TS_KT - 1e-9]
        span = strong if len(strong) else ps
        out.append(Pass(
            track=ti, country=index.codes[c], wind=float(w.max()), km=min(dist[(int(p), c)] for p in ps),
            t0=float(pts["time"][span].min()), t1=float(pts["time"][span].max()),
            basins={BASINS[b] for b in pts["basin"][span] if b >= 0}, peak=tracks[ti].peak,
        ))
    return out


# ── 輸出 ──────────────────────────────────────────────────────────
def _size(data: object) -> str:
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return f"{len(raw) / 1024:.0f} KB，gzip 後 {len(gzip.compress(raw, 9)) / 1024:.0f} KB"


def match_cwa(tracks: list[Track], cwa: list[dict]) -> dict[str, dict]:
    """中央氣象署的颱風（1958 年起的西北太平洋颱風）→ IBTrACS 的 SID：同一年、英文名稱相同；
    名稱對不上的，生成時間落在剛好一個沒有名字的 IBTrACS 西北太平洋颱風期間（前 2 天起）時補上。
    對不上的多半是日本氣象廳 10 分鐘風速達熱帶風暴、美國機構 1 分鐘風速卻只有熱帶性低氣壓的（這裡不收）。"""
    wp = [t for t in tracks if any(f.basin == "WP" for f in t.storm.fixes)]
    by_name: dict[tuple[int, str], list[Track]] = defaultdict(list)
    for t in wp:
        if t.name:
            for part in t.storm.name.split(":"):
                by_name[(t.year, name_key(part))].append(t)
    out: dict[str, dict] = {}
    missing = []
    for c in cwa:
        year = int(c["id"][:4])
        # 同一年同名的都算（IBTrACS 的即時資料偶爾把一個颱風拆成兩段，例如 2026 年的 SAUDEL）
        cands = by_name.get((year, name_key(c["eng_name"]))) or by_name.get((year - 1, name_key(c["eng_name"]))) or []
        if not cands:
            g = c.get("genesis_datetime") or ""
            try:
                gt = datetime.strptime(g, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc).timestamp()
            except ValueError:
                gt = None
            near = [t for t in wp if gt is not None and t.storm.fixes[0].time - 2 * 86400 <= gt <= t.storm.fixes[-1].time]
            cands = near if len(near) == 1 and not near[0].name else []  # 只補 IBTrACS 沒有名字的
        for t in cands:
            out.setdefault(t.storm.sid, c)
        if not cands:
            missing.append(f"{c['id']} {c['eng_name'].strip()}")
    print(f"  中央氣象署 {len(cwa)} 個颱風，對到 IBTrACS {len(out)} 個；對不上 {len(missing)} 個：{missing[:12]}")
    return out


def build() -> None:
    this_year = date.today().year
    years = list(range(START_YEAR, this_year + 1))
    decades = list(range(START_YEAR, this_year + 1, 10))

    storms = ibtracs.storms(START_YEAR)
    print(f"  IBTrACS：{len(storms)} 個系統（SEASON {START_YEAR} 起，不含 spur）")
    tracks = select(storms)
    prov = [t for t in tracks if t.storm.provisional]
    print(f"  即時資料（PROVISIONAL）{len(prov)} 個：{sorted(Counter(t.year for t in prov).items())}")

    # 中文名稱：中央氣象署颱風資料庫的西北太平洋颱風列表
    cwa_all = cwa_list("typhoon_list", "get_typhoon")
    cwa_by_sid = match_cwa(tracks, cwa_all)
    for t in tracks:
        c = cwa_by_sid.get(t.storm.sid)
        if c and c.get("cht_name", "").strip():
            t.zh = c["cht_name"].strip()

    # ── 地圖：路徑 ──
    lines, vtypes, records = track_lines(tracks)
    data = lines_file(
        lines, QUANTUM, vertex_types=vtypes, records=records,
        record_fields=["year", "md0", "md1", "name", "zh", "basin", "wind", "pres", "cat", "prov"],
        record_scale={"year": 1, "md0": 1, "md1": 1, "wind": 1, "pres": 1, "cat": 1, "prov": 1},
        record_delta=("year",))
    # 量化後不到兩個點的路徑（幾乎原地不動、只有一兩筆紀錄的颱風）lines_file 會連同紀錄一起拿掉，國家統計照樣算
    short = [f"{t.year} {t.name or t.storm.sid}" for t, line in zip(tracks, lines)
             if len({(round(x / QUANTUM), round(y / QUANTUM)) for x, y in line}) < 2]
    if short:
        print(f"    {len(short)} 條路徑太短、地圖上不畫：{short}")
    write_json(OUT / "tracks.json", data)
    print(f"    路徑 {len(data['lines'])} 條、{sum(len(v) for v in data['vertexTypes']):,} 個頂點（{_size(data)}）")

    # ── 國家統計 ──
    index = NearIndex()
    all_passes = passes(tracks, index)
    counted = [p for p in all_passes if p.counted]
    print(f"  {len(all_passes):,} 次經過（{len(counted):,} 次達熱帶風暴以上）")
    codes = sorted(index.codes)

    # 依賴北印度洋、南半球的國家：1980 年以前沒有風速，值改成 null
    recent: dict[str, list[Pass]] = defaultdict(list)
    for p in counted:
        if tracks[p.track].year >= PARTIAL_FROM:
            recent[p.country].append(p)
    partial = {
        c for c, ps in recent.items()
        if sum(1 for p in ps if p.basins & set(US_WIND_FROM)) / len(ps) >= PARTIAL_SHARE
    }
    print(f"  {PARTIAL_FROM} 年以前不統計的國家（{len(partial)} 個）：{' '.join(sorted(partial))}")

    per_year: dict[str, Counter] = defaultdict(Counter)
    strongest: dict[str, dict[int, int]] = defaultdict(dict)
    for p in all_passes:
        y = tracks[p.track].year
        if p.counted:
            per_year[p.country][y] += 1
        d = y // 10 * 10
        strongest[p.country][d] = max(strongest[p.country].get(d, TD), p.cls)
    world = Counter(t.year for t in tracks if t.counted_possible)

    def blank(c: str, y: int) -> bool:
        return c in partial and y < PARTIAL_FROM

    def series(c: str, ys: list[int], span: int = 1) -> list[float | None]:
        return [None if blank(c, y) else sum(per_year[c].get(y + k, 0) for k in range(span)) for y in ys]

    world_year = [world[y] if y >= PARTIAL_FROM else None for y in years]
    world_decade = [sum(world[y + k] for k in range(10)) if y >= PARTIAL_FROM else None for y in decades]
    tw_note = taiwan_note(tracks, all_passes)
    notes = {c: PARTIAL_NOTE["zh"] for c in partial}
    notes_en = {c: PARTIAL_NOTE["en"] for c in partial}
    notes["TWN"], notes_en["TWN"] = tw_note["zh"], tw_note["en"]
    write_json(OUT / "storms-year.json", indicator_file(
        "storms-year", "個", years, {c: series(c, years) for c in codes},
        aggregates={"WLD": world_year}, notes=notes, notesEn=notes_en))
    write_json(OUT / "storms-decade.json", indicator_file(
        "storms-decade", "個", decades, {c: series(c, decades, 10) for c in codes},
        aggregates={"WLD": world_decade}, notes=notes, notesEn=notes_en))
    write_json(OUT / "strongest-decade.json", indicator_file(
        "strongest-decade", "級", decades,
        {c: [None if blank(c, d) else strongest[c].get(d) for d in decades] for c in codes if strongest.get(c)},
        notes=notes, notesEn=notes_en))

    # ── 側欄：每個國家最強、最近的颱風 ──
    by_country: dict[str, list[Pass]] = defaultdict(list)
    for p in counted:
        if not blank(p.country, tracks[p.track].year):
            by_country[p.country].append(p)

    def row(p: Pass) -> list:
        tr = tracks[p.track]
        return [tr.year, tr.name, tr.zh, p.wind5, round(p.km), ymd(p.t0), ymd(p.t1),
                None if tr.peak is None else round(tr.peak), tr.storm.basin]

    panel = {}
    for c, ps in sorted(by_country.items()):
        strong = sorted(ps, key=lambda p: (-p.wind5, -p.t0))[:PANEL_ROWS]
        latest = sorted(ps, key=lambda p: -p.t0)[:PANEL_ROWS]
        panel[c] = {
            "n": len(ps), "from": PARTIAL_FROM if c in partial else START_YEAR,
            "strongest": [row(p) for p in strong], "recent": [row(p) for p in latest],
        }
    pdata = {"fields": ["year", "name", "zh", "wind", "km", "date0", "date1", "peak", "basin"], "countries": panel}
    write_json(OUT / "country-storms.json", pdata)
    print(f"    側欄 {len(panel)} 國（{_size(pdata)}）")

    taiwan_check(tracks, all_passes)
    top = sorted(((sum(per_year[c].values()), c) for c in codes), reverse=True)[:12]
    print("  1950 年起最多的國家：" + "、".join(f"{c} {n}" for n, c in top))
    dmax = max((v for c in codes for v in series(c, decades, 10) if v), default=0)
    print(f"  每十年最多 {dmax} 個")

    write_json(OUT / "manifest.json", {
        "topic": "typhoons",
        "generatedAt": now_iso(),
        "source": "NOAA NCEI IBTrACS v04r01 (USA_WIND, USA_SSHS, USA_PRES/WMO_PRES), doi:10.25921/82ty-9e16; "
                  "Central Weather Administration (Taiwan) Typhoon Database (Chinese names, Taiwan comparison)",
        "latestFix": utc(max(t.storm.fixes[-1].time for t in tracks)).strftime("%Y-%m-%dT%H:%MZ"),
    })


PARTIAL_NOTE = {
    "zh": f"這個國家的颱風有不少來自北印度洋或南半球，美國機構在這些海域 {PARTIAL_FROM} 年以前沒有風速資料，"
          f"所以 {PARTIAL_FROM} 年以前不統計。",
    "en": f"Many storms here come from the North Indian Ocean or the Southern Hemisphere, where US agencies have "
          f"no wind data before {PARTIAL_FROM}, so earlier years are left blank.",
}


# ── 台灣：跟中央氣象署對照 ──────────────────────────────────────────
TAIWAN_CHECKS = [("MORAKOT", 2009), ("SOUDELOR", 2015), ("GAEMI", 2024), ("KRATHON", 2024)]


def _cwa_taiwan() -> tuple[dict[int, set[str]], dict[int, set[str]]]:
    """中央氣象署有發警報的颱風（1958 年起）：每年發警報的、侵台的（侵臺路徑分類有值）颱風編號"""
    warned: dict[int, set[str]] = defaultdict(set)
    hit: dict[int, set[str]] = defaultdict(set)
    for c in cwa_list("warning_typhoon_list", "get_warning_typhoon"):
        y = int(c["id"][:4])
        warned[y].add(c["id"])
        if (c.get("official_path_category") or "").strip() not in ("", "0"):
            hit[y].add(c["id"])
    return warned, hit


def taiwan_counts(tracks: list[Track], all_passes: list[Pass]) -> dict[int, int]:
    out: Counter = Counter()
    for p in all_passes:
        if p.country == "TWN" and p.counted:
            out[tracks[p.track].year] += 1
    return out


def taiwan_note(tracks: list[Track], all_passes: list[Pass]) -> dict[str, str]:
    ours = taiwan_counts(tracks, all_passes)
    warned, hit = _cwa_taiwan()
    last = date.today().year - 1  # 今年還沒過完
    span = range(1958, last + 1)
    n = len(span)
    a = sum(ours[y] for y in span) / n
    w = sum(len(warned[y]) for y in span) / n
    h = sum(len(hit[y]) for y in span) / n
    return {
        "zh": f"這裡的次數是颱風中心（風速達熱帶風暴以上時）進入台灣陸地或離陸地 {NEAR_KM} 公里以內，"
              f"1958–{last} 年平均每年 {a:.1f} 個。中央氣象署的「侵台颱風」是颱風中心登陸台灣，或沒有登陸但陸上有災情的，"
              f"同期平均每年 {h:.1f} 個；有發布颱風警報的（含只有海上警報）平均每年 {w:.1f} 個。"
              "風速是美國機構的 1 分鐘平均，比氣象署的 10 分鐘平均大，強度分級也不同。",
        "en": f"Counts here are storms whose centre came within {NEAR_KM} km of Taiwan's land (or crossed it) at "
              f"tropical-storm strength or above: {a:.1f} a year on average in 1958–{last}. Taiwan's Central Weather "
              f"Administration counts a typhoon as hitting Taiwan when its centre makes landfall or it causes damage on land "
              f"without landfall: {h:.1f} a year over the same period, while it issued typhoon warnings (including sea-only "
              f"warnings) for {w:.1f} a year. Winds here are US 1-minute averages, higher than the CWA's 10-minute winds, "
              "and the intensity scale differs.",
    }


def taiwan_check(tracks: list[Track], all_passes: list[Pass]) -> None:
    tw = {p.track: p for p in all_passes if p.country == "TWN"}
    for name, year in TAIWAN_CHECKS:
        found = [(i, t) for i, t in enumerate(tracks) if t.year == year and name_key(t.storm.name) == name_key(name)]
        for i, t in found:
            p = tw.get(i)
            near = f"100 公里內最大 {p.wind:.0f} kt、最近 {p.km:.0f} km、{utc(p.t0):%m-%d %H}Z–{utc(p.t1):%m-%d %H}Z" if p else "沒有經過台灣"
            print(f"  台灣檢查：{year} {name}（{t.zh}）巔峰 {t.peak} kt、{t.pres} hPa；{near}")
        if not found:
            print(f"  台灣檢查：找不到 {year} {name}")
    ours = taiwan_counts(tracks, all_passes)
    warned, hit = _cwa_taiwan()
    print("  台灣每年（我們 / 氣象署侵台 / 有發警報）：" + "  ".join(
        f"{y}:{ours[y]}/{len(hit[y])}/{len(warned[y])}" for y in range(2000, date.today().year + 1)))
