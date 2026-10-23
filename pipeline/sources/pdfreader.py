"""只用標準函式庫讀 PDF 裡的文字與表格框線（不必另外裝 pdftotext、PyMuPDF）。

給 Word 匯出的 PDF 用（例如領事事務局的免簽證國家名單）：每段文字有自己的 BT … Tm … TJ … ET，
中文字型是 Type0（Identity-H，兩個位元組一個字），靠字型的 ToUnicode 對照表換回 Unicode；
英文字型是 WinAnsiEncoding 的 TrueType，一個位元組一個字。表格框線是很細的填色矩形（re + f）。

只處理用得到的部分：FlateDecode 壓縮、物件串流（ObjStm）、文字定位（Tm、Td、TD、T*、cm、q/Q）、
字寬（換算同一段裡第二個 TJ 的位置）。不支援加密、其他壓縮方式、Type3 字型與直排。
"""
from __future__ import annotations

import re
import zlib
from dataclasses import dataclass
from pathlib import Path

OBJ_RE = re.compile(rb"(\d+)\s+(\d+)\s+obj\b")
WHITESPACE = b" \t\r\n\x0c\x00"
DELIMITERS = b"()<>[]{}/%"


class Name(str):
    """PDF 的名稱物件（/Font），跟字串分開"""


@dataclass(frozen=True)
class Ref:
    num: int


@dataclass
class Text:
    """一段文字：x、y 是起點（PDF 座標，原點在左下角），x1 是終點"""

    page: int
    x: float
    y: float
    x1: float
    size: float
    text: str


@dataclass
class Rect:
    page: int
    x0: float
    y0: float
    x1: float
    y1: float


# ── 物件語法 ───────────────────────────────────────────────
def _tokens(data: bytes, pos: int = 0):
    """PDF 的詞彙單位：(種類, 值, 結束位置)。種類是 num、name、str、hex、op（關鍵字或運算子）與括號。"""
    n = len(data)
    while pos < n:
        c = data[pos : pos + 1]
        if c in (b" ", b"\t", b"\r", b"\n", b"\x0c", b"\x00"):
            pos += 1
        elif c == b"%":
            while pos < n and data[pos : pos + 1] not in (b"\r", b"\n"):
                pos += 1
        elif c == b"/":
            end = pos + 1
            while end < n and data[end : end + 1] not in WHITESPACE and data[end : end + 1] not in DELIMITERS:
                end += 1
            raw = data[pos + 1 : end]
            name = re.sub(rb"#([0-9A-Fa-f]{2})", lambda m: bytes([int(m.group(1), 16)]), raw)
            yield "name", Name(name.decode("latin-1")), end
            pos = end
        elif c == b"(":
            depth, end, out = 1, pos + 1, bytearray()
            while end < n and depth:
                ch = data[end]
                if ch == 0x5C:  # 反斜線跳脫
                    nxt = data[end + 1 : end + 2]
                    esc = {b"n": 10, b"r": 13, b"t": 9, b"b": 8, b"f": 12}
                    if nxt in esc:
                        out.append(esc[nxt])
                        end += 2
                    elif nxt in (b"\r", b"\n"):  # 反斜線加換行：接續下一行，不算字元
                        end += 2
                        if nxt == b"\r" and data[end : end + 1] == b"\n":
                            end += 1
                    elif nxt.isdigit():
                        m = re.match(rb"[0-7]{1,3}", data[end + 1 : end + 4])
                        out.append(int(m.group(), 8) & 0xFF)
                        end += 1 + len(m.group())
                    else:
                        out += nxt
                        end += 2
                    continue
                if ch == 0x28:
                    depth += 1
                elif ch == 0x29:
                    depth -= 1
                    if depth == 0:
                        end += 1
                        break
                out.append(ch)
                end += 1
            yield "str", bytes(out), end
            pos = end
        elif data[pos : pos + 2] in (b"<<", b">>"):
            yield data[pos : pos + 2].decode(), None, pos + 2
            pos += 2
        elif c == b"<":
            end = data.index(b">", pos)
            digits = re.sub(rb"\s", b"", data[pos + 1 : end])
            if len(digits) % 2:
                digits += b"0"
            yield "hex", bytes.fromhex(digits.decode()), end + 1
            pos = end + 1
        elif c in (b"[", b"]", b"{", b"}"):
            yield c.decode(), None, pos + 1
            pos += 1
        else:
            end = pos
            while end < n and data[end : end + 1] not in WHITESPACE and data[end : end + 1] not in DELIMITERS:
                end += 1
            if end == pos:  # 單獨的 ) 或 >：格式有誤，跳過
                pos += 1
                continue
            word = data[pos:end]
            try:
                yield "num", float(word) if (b"." in word or b"e" in word.lower()) else int(word), end
            except ValueError:
                yield "op", word.decode("latin-1"), end
            pos = end


def _parse_object(data: bytes) -> object:
    """一個物件的內容（dict、數字…），值裡的「n g R」會換成 Ref"""
    toks = list(_tokens(data))
    # 先把「n g R」合併成一個 ref 詞彙，字典與陣列裡就不必特別處理
    merged = []
    i = 0
    while i < len(toks):
        if i + 2 < len(toks) and toks[i][0] == "num" and toks[i + 1][0] == "num" and toks[i + 2][:2] == ("op", "R"):
            merged.append(("ref", Ref(int(toks[i][1])), toks[i + 2][2]))
            i += 3
        else:
            merged.append(toks[i])
            i += 1
    it = iter(merged)

    def value(first):
        kind, v, _ = first
        if kind == "ref":
            return v
        if kind == "<<":
            out = {}
            for tok in it:
                if tok[0] == ">>":
                    return out
                out[tok[1]] = value(next(it))
            return out
        if kind == "[":
            items = []
            for tok in it:
                if tok[0] == "]":
                    return items
                items.append(value(tok))
            return items
        if kind == "op":
            return {"true": True, "false": False, "null": None}.get(v, v)
        return v

    try:
        return value(next(it))
    except StopIteration:
        return None


# ── 檔案結構 ───────────────────────────────────────────────
class Document:
    def __init__(self, path: Path):
        self.data = path.read_bytes()
        if b"/Encrypt" in self.data[-4096:]:
            raise RuntimeError(f"{path.name} 有加密，讀不了")
        self.objects: dict[int, object] = {}
        self.streams: dict[int, bytes] = {}
        self._read_objects()

    def _read_objects(self) -> None:
        data = self.data
        pos = 0
        while m := OBJ_RE.search(data, pos):
            num = int(m.group(1))
            start = m.end()
            end_obj = data.find(b"endobj", start)
            stream_at = data.find(b"stream", start)
            if stream_at != -1 and (end_obj == -1 or stream_at < end_obj) and data[stream_at - 3 : stream_at] != b"end":
                header = _parse_object(data[start:stream_at])
                body = stream_at + len(b"stream")
                body += 2 if data[body : body + 2] == b"\r\n" else 1
                length = header.get("Length") if isinstance(header, dict) else None
                if isinstance(length, int) and data[body + length : body + length + 30].lstrip(WHITESPACE).startswith(b"endstream"):
                    raw = data[body : body + length]
                else:  # 長度是間接物件：直接找 endstream
                    raw = data[body : data.find(b"endstream", body)].rstrip(b"\r\n")
                self.objects[num] = header
                self.streams[num] = raw
                end_obj = data.find(b"endobj", body + len(raw))
            else:
                self.objects[num] = _parse_object(data[start:end_obj])
            pos = end_obj + 6 if end_obj != -1 else len(data)
        # 物件串流裡的物件（Word 會把結構樹之類的放在這裡）
        for num, header in list(self.objects.items()):
            if isinstance(header, dict) and header.get("Type") == "ObjStm":
                content = self.stream(num)
                first = header["First"]
                nums = [int(x) for x in content[:first].split()]
                offsets = list(zip(nums[0::2], nums[1::2]))
                for i, (obj, off) in enumerate(offsets):
                    end = offsets[i + 1][1] if i + 1 < len(offsets) else len(content) - first
                    self.objects.setdefault(obj, _parse_object(content[first + off : first + end]))

    def get(self, value: object) -> object:
        while isinstance(value, Ref):
            value = self.objects.get(value.num)
        return value

    def stream(self, num: int) -> bytes:
        header = self.objects[num]
        raw = self.streams[num]
        filters = self.get(header.get("Filter")) if isinstance(header, dict) else None
        filters = filters if isinstance(filters, list) else [filters] if filters else []
        for f in filters:
            if f != "FlateDecode":
                raise RuntimeError(f"不支援的壓縮方式 {f}")
            raw = zlib.decompress(raw)
        return raw

    def pages(self) -> list[dict]:
        root = self.get(self._trailer_root())
        out: list[dict] = []

        def walk(node_ref, inherited):
            node = self.get(node_ref)
            res = node.get("Resources", inherited)
            if node.get("Type") == "Pages":
                for kid in node["Kids"]:
                    walk(kid, res)
            else:
                out.append({**node, "Resources": res})

        walk(root["Pages"], None)
        return out

    def _trailer_root(self) -> Ref:
        m = list(re.finditer(rb"/Root\s+(\d+)\s+\d+\s+R", self.data))
        if not m:
            raise RuntimeError("找不到 PDF 的 /Root")
        return Ref(int(m[-1].group(1)))


# ── 字型 ─────────────────────────────────────────────────
class Font:
    def __init__(self, doc: Document, font: dict):
        self.two_byte = font.get("Subtype") == "Type0"
        self.to_unicode: dict[int, str] = {}
        self.widths: dict[int, float] = {}
        self.default_width = 1000.0 if self.two_byte else 500.0
        ref = font.get("ToUnicode")
        if isinstance(ref, Ref):
            self._read_cmap(doc.stream(ref.num))
        if self.two_byte:
            desc = doc.get(doc.get(font["DescendantFonts"])[0])
            self.default_width = float(desc.get("DW", 1000))
            w = doc.get(desc.get("W")) or []
            i = 0
            while i < len(w):
                first = w[i]
                nxt = doc.get(w[i + 1])
                if isinstance(nxt, list):
                    for k, width in enumerate(nxt):
                        self.widths[first + k] = float(width)
                    i += 2
                else:
                    for code in range(first, int(nxt) + 1):
                        self.widths[code] = float(w[i + 2])
                    i += 3
        else:
            first = font.get("FirstChar", 0)
            for k, width in enumerate(doc.get(font.get("Widths")) or []):
                self.widths[first + k] = float(width)

    def _read_cmap(self, cmap: bytes) -> None:
        def hexstr(s: bytes) -> str:
            raw = bytes.fromhex(s.decode())
            return raw.decode("utf-16-be", errors="replace")

        for block in re.findall(rb"beginbfchar(.*?)endbfchar", cmap, re.S):
            for src, dst in re.findall(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>", block):
                self.to_unicode[int(src, 16)] = hexstr(dst)
        for block in re.findall(rb"beginbfrange(.*?)endbfrange", cmap, re.S):
            for lo, hi, rest in re.findall(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(\[[^\]]*\]|<[0-9A-Fa-f]+>)", block):
                lo_i, hi_i = int(lo, 16), int(hi, 16)
                if rest.startswith(b"["):
                    for k, dst in enumerate(re.findall(rb"<([0-9A-Fa-f]+)>", rest)):
                        self.to_unicode[lo_i + k] = hexstr(dst)
                else:
                    base = int(rest[1:-1], 16)
                    width = len(rest[1:-1]) // 2
                    for k in range(hi_i - lo_i + 1):
                        self.to_unicode[lo_i + k] = (base + k).to_bytes(width, "big").decode("utf-16-be", errors="replace")

    def decode(self, raw: bytes) -> tuple[str, float]:
        """（文字, 字寬總和 / 1000）"""
        codes = [int.from_bytes(raw[i : i + 2], "big") for i in range(0, len(raw) - 1, 2)] if self.two_byte else list(raw)
        text = []
        width = 0.0
        for code in codes:
            if code in self.to_unicode:
                text.append(self.to_unicode[code])
            elif not self.two_byte:
                text.append(bytes([code]).decode("cp1252", errors="replace"))
            width += self.widths.get(code, self.default_width)
        return "".join(text), width / 1000


# ── 內容串流 ───────────────────────────────────────────────
def _mul(a: list[float], b: list[float]) -> list[float]:
    """3×3 仿射矩陣 [a b c d e f] 相乘（a 先套用）"""
    return [
        a[0] * b[0] + a[1] * b[2],
        a[0] * b[1] + a[1] * b[3],
        a[2] * b[0] + a[3] * b[2],
        a[2] * b[1] + a[3] * b[3],
        a[4] * b[0] + a[5] * b[2] + b[4],
        a[4] * b[1] + a[5] * b[3] + b[5],
    ]


IDENTITY = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0]


def read(path: Path) -> tuple[list[Text], list[Rect]]:
    """所有頁面的文字片段與填色矩形（頁碼從 1 開始）"""
    doc = Document(path)
    texts: list[Text] = []
    rects: list[Rect] = []
    for page_no, page in enumerate(doc.pages(), start=1):
        resources = doc.get(page.get("Resources")) or {}
        font_refs = doc.get(resources.get("Font")) or {}
        fonts = {name: Font(doc, doc.get(ref)) for name, ref in font_refs.items()}
        contents = doc.get(page.get("Contents"))
        refs = contents if isinstance(contents, list) else [page["Contents"]]
        data = b"\n".join(doc.stream(r.num) for r in refs)
        _run(data, fonts, page_no, texts, rects)
    return texts, rects


def _run(data: bytes, fonts: dict[str, Font], page: int, texts: list[Text], rects: list[Rect]) -> None:
    ctm = IDENTITY
    # q／Q 存回的狀態：轉換矩陣與文字狀態（字型、字距、行距都屬於繪圖狀態）
    stack: list[tuple] = []
    tm = tlm = IDENTITY
    font: Font | None = None
    size = 0.0
    leading = 0.0
    char_space = word_space = 0.0
    scale = 1.0
    pending: list[tuple[float, float, float, float]] = []
    operands: list = []
    tokens = _tokens(data)

    def show(raw: bytes) -> float:
        """畫出一段字串，回傳在文字空間的前進量"""
        nonlocal tm
        if font is None:
            return 0.0
        text, w = font.decode(raw)
        spaces = text.count(" ")
        advance = (w * size + char_space * len(text) + word_space * spaces) * scale
        start = _mul(tm, ctm)
        end = _mul([1, 0, 0, 1, advance, 0], _mul(tm, ctm))
        if text:
            texts.append(Text(page, start[4], start[5], end[4], size * abs(start[3] or start[0]), text))
        tm = _mul([1, 0, 0, 1, advance, 0], tm)
        return advance

    for kind, value, _end in tokens:
        if kind == "[":
            arr: list = []
            for k2, v2, _e2 in tokens:
                if k2 == "]":
                    break
                arr.append(v2)
            operands.append(arr)
            continue
        if kind == "<<":  # 標記內容的屬性字典（BDC），內容用不到
            depth = 1
            for k2, _v2, _e2 in tokens:
                depth += k2 == "<<"
                depth -= k2 == ">>"
                if not depth:
                    break
            operands.append({})
            continue
        if kind != "op":
            operands.append(value)
            continue
        op = value
        try:
            if op == "q":
                stack.append((ctm, font, size, leading, char_space, word_space, scale))
            elif op == "Q":
                if stack:
                    ctm, font, size, leading, char_space, word_space, scale = stack.pop()
            elif op == "cm":
                ctm = _mul([float(x) for x in operands[-6:]], ctm)
            elif op == "BT":
                tm = tlm = IDENTITY
            elif op == "Tf":
                font = fonts.get(operands[-2])
                size = float(operands[-1])
            elif op == "Tc":
                char_space = float(operands[-1])
            elif op == "Tw":
                word_space = float(operands[-1])
            elif op == "Tz":
                scale = float(operands[-1]) / 100
            elif op == "TL":
                leading = float(operands[-1])
            elif op == "Tm":
                tm = tlm = [float(x) for x in operands[-6:]]
            elif op in ("Td", "TD"):
                tx, ty = float(operands[-2]), float(operands[-1])
                if op == "TD":
                    leading = -ty
                tm = tlm = _mul([1, 0, 0, 1, tx, ty], tlm)
            elif op == "T*":
                tm = tlm = _mul([1, 0, 0, 1, 0, -leading], tlm)
            elif op == "Tj":
                show(operands[-1])
            elif op in ("'", '"'):
                tm = tlm = _mul([1, 0, 0, 1, 0, -leading], tlm)
                show(operands[-1])
            elif op == "TJ":
                for item in operands[-1]:
                    if isinstance(item, (bytes, bytearray)):
                        show(item)
                    elif isinstance(item, (int, float)):
                        tm = _mul([1, 0, 0, 1, -item / 1000 * size * scale, 0], tm)
            elif op == "re":
                pending.append(tuple(float(x) for x in operands[-4:]))
            elif op in ("f", "F", "f*", "B", "B*", "b", "b*"):
                for x, y, w, h in pending:
                    p0 = _mul([1, 0, 0, 1, x, y], ctm)
                    p1 = _mul([1, 0, 0, 1, x + w, y + h], ctm)
                    rects.append(Rect(page, min(p0[4], p1[4]), min(p0[5], p1[5]), max(p0[4], p1[4]), max(p0[5], p1[5])))
                pending = []
            elif op in ("n", "S", "s"):  # 裁切範圍（re W n）與框線以外的路徑不算
                pending = []
            elif op == "BI":  # 內嵌圖片：跳到 EI
                for k2, v2, _e2 in tokens:
                    if k2 == "op" and v2 == "EI":
                        break
        except (IndexError, ValueError, TypeError):
            pass  # 運算元不對的指令略過
        operands = []
