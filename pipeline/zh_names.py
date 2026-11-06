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
  地名（place=True）的簡中不直接用 s2twp，改用 place_s2twp()：同樣三步（s2t → TWPhrases → TWVariants），中間那一步
  去掉會打到音譯的詞條（PLACE_SKIP：「布爾→布林」「比特→位元」「納米→奈米」…）、加上保護用的長詞（PLACE_PHRASES：
  「法屬圭亞那」「意大利迦」整個詞照寫的換，裡面的國名就不會被換），國名的「意大利→義大利」「圭亞那→蓋亞那」照換。
  地形、山系、熊貓、OpenHistoricalMap、城堡的簡中名稱也用這個（hans()）。
  Wikidata 不少繁中標籤本身就是機器用 s2twp 轉的（「卡布林影展」「布林日之春」「訊號山」），地名的繁中標籤再跟簡中標籤
  對照，把 s2twp 多換的詞改回來（undo_terms()）。（2026-11-06，DESIGN.md 第 8 節第 412 點）
- 地名（景點、地形、場館、車站…，place=True）再修正音譯常見的錯字（TRANSLIT_FIX：剋→克、託→托、裡／裏→里、誇→夸）：
  簡中轉繁會轉錯，Wikidata 自己的繁中標籤也有這種錯字（多半是機器轉的，「瓦剋夫」「里奧誇爾托」）；
  地名裡幾乎不會用到前面那些字（「託管地」「信託」這些一般詞不換，TRANSLIT_KEEP）。品牌、公司、食物等一般文字不要用。
"""
from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

TRANSLIT_FIX = str.maketrans({"剋": "克", "託": "托", "裡": "里", "裏": "里", "誇": "夸"})
# TRANSLIT_FIX 不換的一般詞（不是音譯）：OpenHistoricalMap 的「巴勒斯坦託管地」「美索不達米亞託管地」（2026-11-06，
# DESIGN.md 第 8 節第 412 點）。「裏海」不能放：會擋到「峇裡海峽」（峇里＋海峽）的修正
TRANSLIT_KEEP = re.compile("(託管|信託|委託|寄託|託兒)")


def translit_fix(text: str) -> str:
    """修正音譯地名常見的錯字（TRANSLIT_FIX），TRANSLIT_KEEP 的一般詞不換"""
    parts = TRANSLIT_KEEP.split(text)
    return "".join(part if i % 2 else part.translate(TRANSLIT_FIX) for i, part in enumerate(parts))


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


# s2twp 的 TWPhrases（OpenCC 的台灣用語：電腦用語、國名、一般用語）在地名裡不用的詞條（2026-11-06，DESIGN.md 第 8 節
# 第 412 點；拿景點、城堡、節慶、國家公園、特殊地形等主題的簡中標籤，逐一看過每個詞條換了哪些名稱）。
# 這些詞的台灣用語意思（布林值、位元、奈米、雜湊…）在地名裡用不到，打到的都是音譯或專有名詞
PLACE_SKIP = frozenset({
    "布爾",  # 布林（Boolean）：伊斯坦布爾、布爾薩、格勒諾布爾、布爾日、凱布爾、盧布爾雅那、布爾加科夫
    "比特",  # 位元：吉姆·科比特、馬薩比特、北韋萊比特、塔比特韋亞環礁、比特恰尼城堡
    "納米",  # 奈米：納米比亞（台灣也寫納米比亞）、納米布、納米克·凱末爾
    "哈希",  # 雜湊：埃斯特哈希宮（Esterházy）、哈希姆
    "歐拉",  # 尤拉（數學家 Euler）：雷奇歐拉國家公園、聖歐拉夫
    "圖庫",  # 相簿：圖庫努卡撞擊坑（Tookoonooka）
    "社區",  # 社羣：猶太社區活動中心、社區博物館（台灣也說社區）
    "保存",  # 儲存：北海道大學遺跡保存庭園、橫濱市電保存館
    "信號",  # 訊號：信號山（Signal Hill）
    "高級",  # 高階：埃維塔高級美術博物館、高級中學
    "圖標",  # 圖示：圖標公園
})
# 保護用的長詞（比對時長的詞先換，整個詞照這裡寫的換，裡面較短的國名就不會被換）；寫成 OpenCC s2t 轉出來的字
PLACE_PHRASES = {
    "意大利迦": "意大利迦",  # 古羅馬城市 Italica，不是義大利
    "法屬圭亞那": "法屬圭亞那",  # 圭亞那是地區（Guiana），蓋亞那是國家（Guyana）
    "英屬圭亞那": "英屬圭亞那",
    "荷屬圭亞那": "荷屬圭亞那",
    "圭亞那亞馬孫": "圭亞那亞馬孫",  # 圭亞那亞馬孫森林公園（法屬圭亞那）
    "卡塔爾迪": "卡塔爾迪",  # 卡雷加-卡塔爾迪宮（Cataldi），不是卡達
    "卡塔爾多": "卡塔爾多",  # 聖卡塔爾多（San Cataldo）
    "貝寧城": "貝寧城",  # 奈及利亞的貝寧城（Benin City），不是貝南
    "索馬里蘭": "索馬利蘭",  # 不是「索馬利亞蘭」
    "良加納特斯": "良加納特斯",  # 良加納特斯國家公園（Llanganates），不是迦納（「加納→迦納」不能整個不用：迦納的繁中標籤會被改回）
}


@lru_cache(maxsize=None)
def _place_s2twp():
    """(s2t, OpenCC 的 TWPhrases, 地名用的 TWPhrases, t2tw)。s2twp 的設定檔是 STPhrases＋STCharacters → TWPhrases →
    TWVariants，s2t 是第一步、t2tw 是最後一步，中間這一步自己做；PLACE_SKIP、PLACE_PHRASES 寫錯時停下來"""
    import opencc
    from opencc import OpenCC

    folder = Path(opencc.__file__).parent / "dictionary"
    full: dict[str, str] = {}
    for line in (folder / "TWPhrases.txt").read_text(encoding="utf-8").splitlines():
        key, _, values = line.partition("\t")
        full[key] = values.split(" ")[0]  # 有好幾個候選時跟 OpenCC 一樣用第一個
    s2t = OpenCC("s2t")
    if missing := PLACE_SKIP - full.keys():
        raise RuntimeError(f"OpenCC 的 TWPhrases.txt 沒有這些詞條（字典改版了，PLACE_SKIP 要重新檢查）：{sorted(missing)}")
    for key in PLACE_PHRASES:
        # 這一步的輸入是 s2t 轉出來的字（「羣」「裏」…），保護的詞要寫成一樣的字才比對得到
        if not re.fullmatch(r"[\u4e00-\u9fff]+", key) or s2t.convert(key) != key:
            raise ValueError(f"PLACE_PHRASES 的「{key}」要寫成 OpenCC s2t 轉出來的繁體字（{s2t.convert(key)}）")
    place = {k: v for k, v in full.items() if k not in PLACE_SKIP} | PLACE_PHRASES
    return s2t, full, place, OpenCC("t2tw")


def _phrases(text: str, table: dict[str, str], longest: int = 99, used: list[str] | None = None) -> str:
    """TWPhrases 那一步：整段裡最長的詞先換（同樣長取最左邊），左右兩邊再各自換（跟 opencc-python-reimplemented 一樣）；
    used 記下換了字的詞條"""
    for n in range(min(longest, len(text)), 0, -1):
        for i in range(len(text) - n + 1):
            key = text[i:i + n]
            value = table.get(key)
            if value is not None:
                if used is not None and value != key:
                    used.append(key)
                return _phrases(text[:i], table, n, used) + value + _phrases(text[i + n:], table, n, used)
    return text


def place_s2twp(text: str) -> str:
    """地名的簡中 → 台灣用字與用語：s2twp 去掉 PLACE_SKIP、加上 PLACE_PHRASES（見最上面的說明）"""
    s2t, _, place, t2tw = _place_s2twp()
    return t2tw.convert(_phrases(s2t.convert(text), place))


def undo_terms(hant_label: str, hans_label: str) -> str:
    """地名的繁中標籤裡，s2twp 多換的詞改回來：Wikidata 不少繁中標籤是機器用 s2twp 轉的（「卡布林影展」「布林日之春」
    「格勒諾布林-巴士底纜車」「訊號山」「橫濱市電儲存館」）。簡中標籤用 s2twp 會換、地名的版本不換的詞（「布爾→布林」），
    繁中標籤裡有換過的樣子（「布林」）、簡中標籤只換字（s2tw）的版本裡有原本的詞（「布爾」）又沒有換過的樣子時，改回原本的詞；
    「布林迪西」這種本來就是「布林」的，簡中只換字的版本裡也有「布林」，不動"""
    s2t, full, place, t2tw = _place_s2twp()
    text = s2t.convert(hans_label)
    by_opencc: list[str] = []
    by_place: list[str] = []
    _phrases(text, full, used=by_opencc)
    _phrases(text, place, used=by_place)
    plain = _opencc()[0].convert(hans_label)
    for key in set(by_opencc) - set(by_place):
        wrong, right = t2tw.convert(full[key]), t2tw.convert(key)
        if wrong in hant_label and wrong not in plain and right in plain:
            hant_label = hant_label.replace(wrong, right)
    return hant_label


def hans(text: str, *, place: bool = False, terms: bool = True) -> str:
    """簡中 → 台灣用字：terms=True 換用語（s2twp，地名用 place_s2twp()），terms=False 只換字（s2tw）；
    place=True 再修正音譯的錯字（translit_fix()）"""
    if not terms:
        name = _opencc()[0].convert(text)
    elif place:
        name = place_s2twp(text)
    else:
        name = _opencc()[1].convert(text)
    return translit_fix(name) if place else name


def wikidata_zh(hant_label: str | None, hans_label: str | None = None, *, place: bool = False,
                terms: bool = True) -> str | None:
    """繁中的標籤（zh-tw、zh-hant…，已依序挑好的第一個）原樣用（hant()），沒有時把簡中（zh）轉成台灣用字（hans()：
    s2twp，地名去掉會打到音譯的詞條；terms=False 用 s2tw，只換字、不換用語）；place=True 是地名，繁中標籤再跟簡中標籤對照、
    改回 s2twp 多換的詞（undo_terms()），最後修正音譯的錯字（translit_fix()）"""
    if hant_label:
        name = hant(hant_label)
        if place and hans_label:
            name = undo_terms(name, hans_label)
        return translit_fix(name) if place else name
    if hans_label:
        return hans(hans_label, place=place, terms=terms)
    return None
