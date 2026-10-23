"""V-Dem（Varieties of Democracy）Country-Year 資料集 v16（https://www.v-dem.net/data/the-v-dem-dataset/）。

- 授權：CC BY-SA 4.0（姓名標示—相同方式分享），可以商業使用、改作，衍生的資料要用相同授權分享。
  V-Dem 要求的引用：Coppedge, Michael, et al. 2026. "V-Dem Country-Year Dataset v16".
  Varieties of Democracy (V-Dem) Project. https://doi.org/10.23696/vdemds26
- 下載：V-Dem 網站的下載頁要先填表單（電子郵件、性別），沒有固定的直接網址；
  所以改用 V-Dem Institute 自己在 GitHub 維護的 R 套件 vdemdata（https://github.com/vdeminstitute/vdemdata），
  它的 data/vdem.RData 就是同一份完整的 Country-Year 資料集，用版本標籤 V16 固定版本。
- RData 是 R 的序列化格式（gzip 壓縮、XDR 大端序），解壓後約 1 GB、4,618 欄 × 28,092 列。
  這裡用一個最小的讀取器（_RReader）只取需要的欄位，存成 .cache/vdem/ 裡的小 CSV，之後直接讀它，
  不必多裝 pyreadr 之類的套件。
"""
from __future__ import annotations

import csv
import gzip
import math
import struct

import common
from common import CACHE_DIR, download

VERSION = "v16"
URL = "https://raw.githubusercontent.com/vdeminstitute/vdemdata/V16/data/vdem.RData"
DOI = "https://doi.org/10.23696/vdemds26"

# 要用的欄位（V-Dem 代碼簿的變數名稱）
ID_COLUMNS = ["country_name", "country_text_id", "year"]
INDEX_COLUMNS = [
    "v2x_polyarchy", "v2x_polyarchy_codelow", "v2x_polyarchy_codehigh",
    "v2x_libdem", "v2x_libdem_codelow", "v2x_libdem_codehigh",
    "v2x_freexp_altinf", "v2x_freexp_altinf_codelow", "v2x_freexp_altinf_codehigh",
    "v2x_regime",
]
COLUMNS = ID_COLUMNS + INDEX_COLUMNS


def rows() -> list[dict[str, str]]:
    """V-Dem 每一列（國家 × 年）只留 COLUMNS 的欄位，數值是字串，缺值是空字串。"""
    raw = download(URL, "vdem", f"vdem-{VERSION}.RData")
    subset = CACHE_DIR / "vdem" / f"vdem-{VERSION}-subset.csv"
    if common.REFRESH or not _subset_ok(subset, raw):
        print(f"  讀取 {raw.name}（解壓後約 1 GB，只取 {len(COLUMNS)} 欄）")
        columns = read_rdata_columns(raw, COLUMNS)
        n = len(columns["year"])
        with open(subset, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(COLUMNS)
            for i in range(n):
                writer.writerow([_cell(columns[c][i]) for c in COLUMNS])
    with open(subset, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _subset_ok(subset, raw) -> bool:
    """快取的小 CSV 比 RData 新，而且欄位跟 COLUMNS 一樣（改了要用的欄位就重做）"""
    if not subset.exists() or subset.stat().st_mtime < raw.stat().st_mtime:
        return False
    with open(subset, encoding="utf-8", newline="") as f:
        return next(csv.reader(f), None) == COLUMNS


def _cell(v: object) -> str:
    if v is None:
        return ""
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() else repr(v)
    return str(v)


# ── R 序列化格式的最小讀取器 ─────────────────────────────────────────
# 格式見 R 原始碼 src/main/serialize.c。save() 的檔案是 "RDX3\n" + "X\n"（XDR）+ 版本資訊，
# 接著一個 pairlist：每個物件的名稱（這裡是 vdem）與值（data.frame，也就是一個 VECSXP，每欄一個向量）。
# VECSXP 的屬性（欄名）寫在所有欄位之後，所以讀兩次：第一次只取欄名，第二次只留要的欄位。

NILVALUE, REF, SYM, LIST, CLOS, ENV, PROM, LANG, DOT = 254, 255, 1, 2, 3, 4, 5, 6, 17
CHAR, LGL, INT, REAL, CPLX, STR, VEC, EXPR, RAW, S4 = 9, 10, 13, 14, 15, 16, 19, 20, 24, 25
ALTREP, ATTRLIST, ATTRLANG = 238, 239, 240
SPECIAL_ENVS = {253, 252, 251, 250, 242, 241}  # GLOBALENV、UNBOUNDVALUE、MISSINGARG、BASENAMESPACE、EMPTYENV、BASEENV
PAIRLISTS = {LIST, LANG, CLOS, PROM, DOT, ATTRLIST, ATTRLANG}
NA_INT = -(2**31)


class _Sym(str):
    """R 的符號（symbol），跟一般字串分開"""


class _RReader:
    def __init__(self, f):
        self.f = f
        self.refs: list[object] = []

    def read(self, n: int) -> bytes:
        b = self.f.read(n)
        if len(b) != n:
            raise EOFError("RData 檔案不完整")
        return b

    def skip(self, n: int) -> None:
        while n > 0:
            n -= len(self.read(min(n, 1 << 24)))

    def int(self) -> int:
        return struct.unpack(">i", self.read(4))[0]

    def length(self) -> int:
        n = self.int()
        if n == -1:  # 長向量：兩個 32 位元整數
            hi, lo = self.int(), self.int()
            n = (hi << 32) + lo
        return n

    def item(self, keep: bool = True) -> object:
        """讀一個物件；keep 為 False 時跳過大的數值向量（只讀過去，不轉換）"""
        return self._item(self.int(), keep)

    def _item(self, flags: int, keep: bool) -> object:
        t = flags & 0xFF
        has_attr, has_tag = flags & 0x200, flags & 0x400
        if t == NILVALUE or t in SPECIAL_ENVS:
            return None
        if t == REF:
            index = flags >> 8 or self.int()
            return self.refs[index - 1]
        if t == SYM:
            sym = _Sym(self.item())
            self.refs.append(sym)
            return sym
        if t in PAIRLISTS:
            out: list[tuple[object, object]] = []
            while True:
                if has_attr:
                    self.item()
                tag = self.item() if has_tag else None
                out.append((tag, self.item(keep)))
                flags = self.int()  # CDR：通常是下一個 pairlist 節點或 NILVALUE
                t = flags & 0xFF
                if t not in PAIRLISTS:
                    tail = self._item(flags, keep)
                    if tail is not None:
                        out.append((None, tail))
                    return out
                has_attr, has_tag = flags & 0x200, flags & 0x400
        if t == ENV:
            self.int()  # locked
            env: dict[str, object] = {}
            self.refs.append(env)
            for _ in range(4):  # enclos、frame、hashtab、attrib
                self.item(False)
            return env
        if t == CHAR:
            n = self.int()
            if n == -1:
                return None  # NA_character_
            encoding = "latin-1" if (flags >> 12) & 4 else "utf-8"
            return self.read(n).decode(encoding, errors="replace")
        if t == ALTREP:
            info, state, _attr = self.item(), self.item(), self.item()
            return _altrep(info, state)

        value: object
        if t in (LGL, INT):
            n = self.length()
            if keep:
                ints = struct.unpack(f">{n}i", self.read(4 * n))
                value = [None if v == NA_INT else v for v in ints]
            else:
                self.skip(4 * n)
                value = None
        elif t == REAL:
            n = self.length()
            if keep:
                value = [None if math.isnan(v) else v for v in struct.unpack(f">{n}d", self.read(8 * n))]
            else:
                self.skip(8 * n)
                value = None
        elif t == CPLX:
            self.skip(16 * self.length())
            value = None
        elif t == RAW:
            n = self.length()
            value = self.read(n) if keep else self.skip(n)
        elif t == STR:
            n = self.length()
            if keep:
                value = [self.item() for _ in range(n)]
            else:
                for _ in range(n):  # 字串向量只能一個一個讀過去
                    flags = self.int()
                    if flags & 0xFF == CHAR:
                        size = self.int()
                        if size > 0:
                            self.skip(size)
                    else:
                        self._item(flags, False)
                value = None
        elif t in (VEC, EXPR):
            value = [self.item(keep) for _ in range(self.length())]
        elif t == S4:
            value = None
        else:
            raise ValueError(f"不支援的 R 物件類型 {t}")
        if has_attr:
            self.item()
        return value


def _altrep(info: object, state: object) -> object:
    """R 3.5 起的精簡表示法（ALTREP），只處理會出現在資料框裡的幾種"""
    name = info[0][1] if isinstance(info, list) else None
    if name in ("wrap_integer", "wrap_real", "wrap_string", "wrap_logical"):
        return state[0] if isinstance(state, list) else state
    if name == "compact_intseq":
        n, start, step = (int(v) for v in state)
        return list(range(start, start + n * step, step))
    if name == "deferred_string":
        source = state[0][1] if isinstance(state, list) and state and isinstance(state[0], tuple) else state
        return [None if v is None else str(int(v)) if isinstance(v, float) and v.is_integer() else str(v) for v in source]
    raise ValueError(f"不支援的 ALTREP 類型 {name}")


def _open_frame(path) -> tuple[_RReader, int]:
    """打開 RData，讀到資料框（VECSXP）的欄數為止"""
    f = gzip.open(path, "rb")
    r = _RReader(f)
    if r.read(5) != b"RDX3\n" or r.read(2) != b"X\n":
        raise ValueError("不是 XDR 格式的 RData（RDX3）")
    if r.int() != 3:
        raise ValueError("只支援 R 序列化格式第 3 版")
    r.int(), r.int()  # 寫入時的 R 版本、可讀取的最低版本
    r.read(r.int())  # 原生編碼（UTF-8）
    flags = r.int()
    if flags & 0xFF != LIST or not flags & 0x400:
        raise ValueError("RData 的最外層不是具名的 pairlist")
    r.item()  # 物件名稱（vdem）
    flags = r.int()
    if flags & 0xFF != VEC or not flags & 0x200:
        raise ValueError("RData 裡的物件不是資料框")
    return r, r.length()


def read_rdata_columns(path, wanted: list[str]) -> dict[str, list]:
    """從 save() 存的資料框（RData 裡第一個物件）取出 wanted 這幾欄"""
    r, n = _open_frame(path)
    for _ in range(n):
        r.item(keep=False)
    attrs = r.item()
    r.f.close()
    names = dict(attrs)[_Sym("names")] if isinstance(attrs, list) else None
    if not names or len(names) != n:
        raise ValueError("讀不到資料框的欄名")
    missing = [c for c in wanted if c not in names]
    if missing:
        raise ValueError(f"V-Dem 資料集裡沒有這些欄位：{', '.join(missing)}")
    index = {names.index(c): c for c in wanted}

    r, _ = _open_frame(path)
    out: dict[str, list] = {}
    for i in range(n):
        value = r.item(keep=i in index)
        if i in index:
            out[index[i]] = value
    r.f.close()
    return out


def column_names(path) -> list[str]:
    """資料框的所有欄名（檢查用）"""
    r, n = _open_frame(path)
    for _ in range(n):
        r.item(keep=False)
    attrs = r.item()
    r.f.close()
    return list(dict(attrs)[_Sym("names")])
