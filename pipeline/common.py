"""資料管線共用工具：路徑、下載快取、輸出 JSON。"""
from __future__ import annotations

import json
import sys
import urllib.request
from datetime import datetime, timezone
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
    """
    return {"indicator": indicator, "unit": unit, "years": years, **extra, "values": values}


def to_series(by_year: dict[int, float], years: list[int], digits: int | None = None) -> list[float | None]:
    """{year: value} → 對齊 years 的陣列，缺值為 None。"""
    out: list[float | None] = []
    for y in years:
        v = by_year.get(y)
        out.append(None if v is None else (round(v) if digits == 0 else round(v, digits) if digits else v))
    return out
