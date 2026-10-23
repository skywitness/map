"""資料管線共用工具：路徑、下載快取、輸出 JSON。"""
from __future__ import annotations

import json
import math
import sys
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / "pipeline" / ".cache"
OUT_DIR = ROOT / "public" / "data"
REFRESH = False  # run.py --refresh 會設成 True，忽略下載快取
USER_AGENT = "world-map-viz-pipeline/0.1 (+https://github.com/skywitness/map)"

# Windows 中文環境的主控台預設是 cp950，統一改成 UTF-8 避免輸出國名時當掉
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def download(url: str, source: str, filename: str) -> Path:
    """下載檔案到 .cache/<source>/<filename>；已存在就直接用快取。"""
    target = CACHE_DIR / source / filename
    if target.exists() and not REFRESH:
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    print(f"  下載 {url}")
    tmp = target.with_suffix(target.suffix + ".part")
    # 有些網站（Harvard Dataverse）會擋 Python 預設的 User-Agent
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request) as resp, open(tmp, "wb") as f:
        while chunk := resp.read(1 << 20):
            f.write(chunk)
    tmp.replace(target)
    return target


def write_json(path: Path, data: object, quiet: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    if not quiet:
        print(f"  輸出 {path.relative_to(ROOT)} ({path.stat().st_size / 1024:.0f} KB)")


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def indicator_file(
    indicator: str,
    unit: str,
    years: list[int],
    values: dict[str, list[float | None]],
    **extra: object,
) -> dict:
    """所有主題共用的指標檔格式：每個國家一個陣列，與 years 一一對應，缺值為 null。

    extra 常用的欄位：projectionFrom、aggregates、notes（中文附註）與 notesEn（英文附註，英文介面用）。
    輸出前用 compact_indicator() 壓縮數值（前端 src/lib/data.ts 讀取時還原）。
    """
    return compact_indicator({"indicator": indicator, "unit": unit, "years": years, **extra, "values": values})


# ── 指標檔的數值壓縮（DESIGN.md 第 3 節） ──────────────────────────
# 每個序列存成 [十進位指數 e, 逐年差分的整數…]，值 = 累加 × 10^e。逐年變化通常很小，gzip 後檔案小很多。
# 精度：序列的最大值保留 5 位有效數字，每個非 0 的值至少保留 4 位（畫面上最多顯示 4 位，例如「2,332 萬」），
# 也不會比原本的小數位數更細。只有 6 位數以上的整數（例如人均 GDP 超過 10 萬）最後一位會變成 0。
SERIES_DIGITS = 5
MIN_DIGITS = 4


def _decimals(v: float) -> int:
    """這個數原本有幾位小數（最多 6 位）"""
    if isinstance(v, int) or float(v).is_integer():
        return 0
    return min(-int(Decimal(repr(v)).as_tuple().exponent), 6)


def series_exponent(series: list[float | None]) -> int:
    nonzero = [abs(v) for v in series if v]
    if not nonzero:
        return 0
    by_max = math.floor(math.log10(max(nonzero))) - (SERIES_DIGITS - 1)
    by_min = math.floor(math.log10(min(nonzero))) - (MIN_DIGITS - 1)
    finest = -max(_decimals(v) for v in series if v is not None)
    return max(min(by_max, by_min), finest)


def compact_series(series: list[float | None]) -> list[int | None]:
    """[e, d1, d2, …]：d 是跟前一個非 null 值的差，null 原樣保留、不影響累加。"""
    e = series_exponent(series)
    out: list[int | None] = [e]
    prev = 0
    for v in series:
        if v is None:
            out.append(None)
            continue
        q = round(v * 10**-e) if e < 0 else round(v / 10**e)
        out.append(q - prev)
        prev = q
    return out


def compact_indicator(data: dict) -> dict:
    """把指標檔的 values、aggregates 換成差分編碼；已經壓縮過的原樣回傳。"""
    if data.get("encoding") == "delta":
        return data
    out = {k: v for k, v in data.items() if k not in ("values", "aggregates")}
    out["encoding"] = "delta"
    if "aggregates" in data:
        out["aggregates"] = {k: compact_series(s) for k, s in data["aggregates"].items()}
    out["values"] = {k: compact_series(s) for k, s in data["values"].items()}
    return out


def year_span(series: dict[str, dict[int, float]], min_share: float = 0.3) -> list[int]:
    """各國資料涵蓋的連續年份。頭尾國家數不到最多那一年 min_share 倍的年份不收，
    否則最新一年常常只有少數國家先公布，地圖幾乎全灰。"""
    counts: dict[int, int] = {}
    for s in series.values():
        for y in s:
            counts[y] = counts.get(y, 0) + 1
    enough = [y for y, n in counts.items() if n >= max(counts.values()) * min_share]
    return list(range(min(enough), max(enough) + 1))


def latest_year_span(series: dict[str, dict[int, float]], within: int, min_share: float = 0.3) -> list[int]:
    """稀疏的指標（普查、隔幾年才調查一次）用：前端會用每個國家 within 年內最近一年的值（指標檔的 latestWithin），
    所以依「within 年內有資料的國家數」決定涵蓋的年份，頭尾國家數不到最多那年 min_share 倍的年份不收。"""
    observed = {y for s in series.values() for y in s}
    counts = {
        y: sum(1 for s in series.values() if any(y - within <= k <= y for k in s))
        for y in range(min(observed), max(observed) + 1)
    }
    enough = [y for y, n in counts.items() if n >= max(counts.values()) * min_share]
    return list(range(min(enough), max(enough) + 1))


def to_series(by_year: dict[int, float], years: list[int], digits: int | None = None) -> list[float | None]:
    """{year: value} → 對齊 years 的陣列，缺值為 None。"""
    out: list[float | None] = []
    for y in years:
        v = by_year.get(y)
        out.append(None if v is None else (round(v) if digits == 0 else round(v, digits) if digits else v))
    return out
