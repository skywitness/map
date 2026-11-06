"""Wikidata 的中文標籤 → 台灣用字的名稱（2026-11-06，DESIGN.md 第 8 節第 411 點）。

- 繁中的標籤（zh-tw、zh-hant、zh-hk）原樣用。不能整串再轉一次 OpenCC 的 s2tw：s2tw 假設輸入是簡體，
  會把繁體也用的字換掉：「里亞尚」→「裡亞尚」、「瓦克夫」→「瓦剋夫」、「里奧夸爾托」→「裡奧誇爾託」、
  「台北」→「臺北」、「范」→「範」、「余」→「餘」、「游」→「遊」。
  只換掉夾在裡面的**純簡體字**（OpenCC 的 STCharacters 裡、候選沒有它自己的字，例如「千户站」的「户」、「国」）與
  台灣的異體字（TWVariants：「裏」→「裡」、「着」→「著」、「爲」→「為」），換成 s2tw 在同一個位置轉出來的字；
  繁體也用的字（里、克、托、夸、范、台、后…）不動。
- 沒有繁中標籤時用簡中（zh）的標籤，OpenCC 的 s2twp 轉成台灣用字與用語。s2twp 也換電腦用語，音譯的地名會被換掉
  （「凱布爾」→「凱布林」、「巴布爾花園」→「巴布林花園」、古羅馬城市「意大利迦」→「義大利迦」），原本就用 s2tw 轉簡中的
  （世界遺產的預備名單與地質公園、景點的補充、高塔）照舊用 s2tw（terms=False，只換字、不換用語）。
- 地名（景點、地形、場館、車站…，place=True）再修正音譯常見的錯字（TRANSLIT_FIX：剋→克、託→托、裡／裏→里、誇→夸）：
  簡中轉繁會轉錯，Wikidata 自己的繁中標籤也有這種錯字（多半是機器轉的，「瓦剋夫」「里奧誇爾托」）；
  地名裡幾乎不會用到前面那些字。品牌、公司、食物等一般文字不要用。
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

TRANSLIT_FIX = str.maketrans({"剋": "克", "託": "托", "裡": "里", "裏": "里", "誇": "夸"})


@lru_cache(maxsize=None)
def _opencc():
    """(s2tw, s2twp, 要換的字)：要換的字 = 純簡體字（候選沒有它自己）＋台灣的異體字"""
    import opencc
    from opencc import OpenCC

    folder = Path(opencc.__file__).parent / "dictionary"
    if not (folder / "STCharacters.txt").exists():
        raise RuntimeError("找不到 OpenCC 的字典檔（STCharacters.txt）：請照 requirements.txt 裝 opencc-python-reimplemented")
    convert: set[str] = set()
    for name in ("STCharacters.txt", "TWVariants.txt"):
        for line in (folder / name).read_text(encoding="utf-8").splitlines():
            key, _, values = line.partition("\t")
            if len(key) == 1 and values and key not in values.split():
                convert.add(key)
    return OpenCC("s2tw"), OpenCC("s2twp"), frozenset(convert)


def hant(text: str) -> str:
    """繁中的標籤：只換純簡體字與台灣的異體字，其他字原樣（見最上面的說明）"""
    s2tw, _, convert = _opencc()
    if not any(c in convert for c in text):
        return text
    converted = s2tw.convert(text)
    if len(converted) != len(text):  # s2tw 一字對一字，長度不同時退回逐字轉
        return "".join(s2tw.convert(c) if c in convert else c for c in text)
    return "".join(t if c in convert else c for c, t in zip(text, converted))


def wikidata_zh(hant_label: str | None, hans_label: str | None = None, *, place: bool = False,
                terms: bool = True) -> str | None:
    """繁中的標籤（zh-tw、zh-hant…，已依序挑好的第一個）原樣用（hant()），沒有時把簡中（zh）用 s2twp 轉
    （terms=False 用 s2tw，只換字、不換用語）；place=True 是地名，再修正音譯的錯字（TRANSLIT_FIX）"""
    if hant_label:
        name = hant(hant_label)
    elif hans_label:
        name = _opencc()[1 if terms else 0].convert(hans_label)
    else:
        return None
    return name.translate(TRANSLIT_FIX) if place else name
