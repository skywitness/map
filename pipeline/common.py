"""資料管線共用工具：路徑、下載快取、輸出 JSON。"""
from __future__ import annotations

import json
import math
import sys
import urllib.parse
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


# 憑證缺 Subject Key Identifier 的主機（內政部統計查詢網、文化部、國科會、衛福部、勞動部、中央銀行與民航局的開放資料，2026-10-29）：Python 3.13 預設的
# VERIFY_X509_STRICT 會拒絕，這幾個主機只拿掉這一項嚴格檢查，憑證鏈與主機名稱照樣驗證（curl、瀏覽器都接受這張憑證）
RELAXED_X509_HOSTS = {"statis.moi.gov.tw", "cloud.culture.tw", "mas.nstc.gov.tw", "www.mohw.gov.tw", "apiservice.mol.gov.tw",
                      "www.cbc.gov.tw", "www.caa.gov.tw"}
# 只接受 Python 預設排除的加密套件（RSA 金鑰交換）的主機（國科會的開放資料，2026-10-29）：改用 OpenSSL 的 DEFAULT 套件清單，
# 一樣是 TLS 1.2 加密、驗證憑證，只是沒有前向保密；下載的是公開資料
LEGACY_CIPHER_HOSTS = {"mas.nstc.gov.tw"}


def _ssl_context(url: str):
    import ssl

    host = urllib.parse.urlsplit(url).hostname
    if host not in RELAXED_X509_HOSTS and host not in LEGACY_CIPHER_HOSTS:
        return None
    ctx = ssl.create_default_context()
    if host in RELAXED_X509_HOSTS:
        ctx.verify_flags &= ~ssl.VERIFY_X509_STRICT
    if host in LEGACY_CIPHER_HOSTS:
        ctx.set_ciphers("DEFAULT")
    return ctx


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
    with urllib.request.urlopen(request, context=_ssl_context(url)) as resp, open(tmp, "wb") as f:
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


# ── 疊加圖層的點與線（前端 src/map/Overlays.tsx 的 decodePoints、decodeLines 還原） ──────────
def points_file(
    rows: list[dict[str, object]],
    fields: list[str],
    scale: dict[str, float],
    delta: tuple[str, ...] | list[str] = (),
    strings: tuple[str, ...] | list[str] = (),
) -> dict:
    """一般點圖層的資料檔（src/topics/types.ts 的 PointsData），欄位分開存。

    - scale 裡的欄位是數值：存 round(值 / scale) 的整數，例如經緯度 0.01（約 1 公里）、規模 0.1；
      其他欄位原樣存（字串，或 None）。
    - delta 裡的欄位存跟前一個非 None 值的差：rows 先依這個欄位排序（年份、經度），差分後的數字很小，gzip 壓得很好。
    - strings 裡的欄位是重複很多次的字串（例如河流名稱）：存成字串表（輸出的 strings.table）的索引，0 是沒有值。
    """
    table: list[str] = [""]
    index: dict[str, int] = {}
    columns: list[list[object]] = []
    for field in fields:
        q = scale.get(field)
        col: list[object] = []
        prev = 0
        for row in rows:
            v = row.get(field)
            if field in strings:
                if v is None or v == "":
                    col.append(0)
                else:
                    if v not in index:
                        index[v] = len(table)
                        table.append(str(v))
                    col.append(index[v])
                continue
            if v is None or q is None:
                col.append(v)
                continue
            n = round(float(v) / q)
            if field in delta:
                col.append(n - prev)
                prev = n
            else:
                col.append(n)
        columns.append(col)
    out: dict[str, object] = {
        "fields": fields, "scale": {f: scale[f] for f in fields if f in scale}, "delta": list(delta), "columns": columns,
    }
    if strings:
        out["strings"] = {"fields": [f for f in fields if f in strings], "table": table}
    return out


VERTEX_CODES = "0123456789abcdefghijklmnopqrstuvwxyz"


def lines_file(
    lines: list[list[tuple[float, float]]],
    quantum: float = 0.01,
    types: list[int] | None = None,
    *,
    vertex_types: list[list[int]] | None = None,
    records: list[dict[str, object]] | None = None,
    record_fields: list[str] | None = None,
    record_scale: dict[str, float] | None = None,
    record_delta: tuple[str, ...] | list[str] = (),
    record_strings: tuple[str, ...] | list[str] = (),
    groups: tuple[str, dict] | None = None,
) -> dict:
    """一般線圖層的資料檔（LinesData）：跟鐵路同一種差分編碼，每條線第一個點是量化後的絕對座標，之後是差分。

    跨 180° 經線的線要先把經度展開成連續的（可以超過 ±180），否則 MapLibre 會畫出橫越整個地圖的線。
    types 是每條線的分類代碼（例如板塊邊界的種類），跟 lines 一一對應。

    records（選填）：每條線一筆紀錄（例如海底電纜的名稱、啟用年份），用 points_file() 的格式存
    （record_fields、record_scale、record_delta 同它的參數）；量化後不到兩個點而被丟掉的線，紀錄也一起拿掉，
    第 i 條線一定對應第 i 筆。前端的 tooltip 與時間篩選（timeField）用它。

    vertex_types（選填）：每條線每個頂點的分類代碼（0–35，例如颱風每個時間點的強度），存成一個字元一個頂點的字串；
    前端依代碼把線切成好幾段上色。量化後重疊的頂點只留第一個，代碼也跟著拿掉。

    record_strings：紀錄裡重複很多次的字串欄位，存成字串表（points_file() 的 strings）。
    groups（選填）：(欄位, points_file() 的輸出)，很多條線共用的資料（例如同一個河流系統的名稱、流入的海、長度）只存一次：
    groups 的每一筆也有這個欄位，前端還原時把欄位值相同的那一筆併進每條線的紀錄。
    """
    encoded: list[list[int]] = []
    kept: list[int] = []
    kept_vertex: list[str] = []
    kept_records: list[dict[str, object]] = []
    for i, line in enumerate(lines):
        q = [(round(x / quantum), round(y / quantum)) for x, y in line]
        keep = [j for j in range(len(q)) if j == 0 or q[j] != q[j - 1]]
        if len(keep) < 2:
            continue
        q = [q[j] for j in keep]
        flat = [q[0][0], q[0][1]]
        for (x0, y0), (x1, y1) in zip(q, q[1:]):
            flat += [x1 - x0, y1 - y0]
        encoded.append(flat)
        if types is not None:
            kept.append(types[i])
        if vertex_types is not None:
            codes = vertex_types[i]
            if len(codes) != len(line):
                raise ValueError(f"第 {i} 條線有 {len(line)} 個頂點，vertex_types 卻有 {len(codes)} 個")
            kept_vertex.append("".join(VERTEX_CODES[codes[j]] for j in keep))
        if records is not None:
            kept_records.append(records[i])
    out: dict[str, object] = {"quantum": quantum, "lines": encoded}
    if types is not None:
        out["types"] = kept
    if vertex_types is not None:
        out["vertexTypes"] = kept_vertex
    if records is not None:
        if not record_fields:
            raise ValueError("有 records 時要給 record_fields")
        out["records"] = points_file(kept_records, record_fields, record_scale or {}, record_delta, record_strings)
    if groups is not None:
        out["groups"] = {"field": groups[0], "records": groups[1]}
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
