"""Nobel Prize API 2.1（Nobel Prize Outreach，CC0）：所有諾貝爾獎得主與獎項；中文名稱另外查 Wikidata（CC0）。

- 得主：https://api.nobelprize.org/2.1/laureates（個人與組織，一次取回全部）。每位得主有 Wikidata 的 QID，
  出生地有當時的國名（`birth.place.country`）與今日的國家（`birth.place.countryNow`）。
- 獎項：https://api.nobelprize.org/2.1/nobelPrizes（每年每類一筆，含沒有頒發的年份），只拿來核對得主清單。
- 使用條款（https://www.nobelprize.org/about/terms-of-use-for-api-nobelprize-org-and-data-nobelprize-org/）：
  CC0；另外要求不刻意竄改或誤導、不用 Nobel Prize Outreach 的名稱或商標暗示背書，並鼓勵註明資料來源。
- 每年 10 月公布新的得主，下載檔有快取，要 `npm run data -- nobel --refresh` 才會重新抓。
"""
from __future__ import annotations

import hashlib
import json
import urllib.parse

from common import download
from sources import wikidata

API = "https://api.nobelprize.org/2.1"
LIMIT = 2000  # 2026 年是 1,028 位得主、688 個獎項，一頁就拿完；超過時 _fetch 會報錯
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
SPARQL = "https://query.wikidata.org/sparql"
BATCH = 50  # wbgetentities 一次最多 50 個 QID

# 中文名稱的優先順序（跟 sources/wikidata.py 一致）：台灣用語 → 繁體 → 香港
ZH_ORDER = ("zh-tw", "zh-hant", "zh-hk")
# 簡轉繁：Wikidata 的 languagefallback 已經在伺服器端用 MediaWiki 的繁簡轉換表把 zh／zh-hans／zh-cn 的名稱轉成 zh-tw
# （含台灣譯名，例如「桑给巴尔」→「尚吉巴」）。但 zh-tw、zh-hant 欄位本身偶爾也被填了簡體（「约翰·巴丁」「莱赫·瓦文萨」），
# 所以每個中文名稱都再用 S2T 轉一次，有改到就印出來。
# S2T = sources/wikidata.py 的表（山、湖、河名裡出現的 28 個字）加上 2026-10 抓的得主名稱裡實際出現的簡體字，
# 再補一些音譯人名常見的。只列一定是簡體的字：范、干、后、叶、谷這類繁體也用的字不列，人名裡常是本字；
# 坂、梶這類日文漢字 Big5 沒有，但不是簡體，不轉。
S2T = {
    **wikidata.S2T,
    **str.maketrans(
        "兰维约乔历韦费劳卢丽玛盖迈缪华汉泽兹怀齐纽谢宾逊让冯赛顿门东卫乌车热杨张刘陈赵吴郑孙钱冈荣进树纪伟铃关广岛应义乐书学实宽庆赞贺浅涩娄彻温麦",
        "蘭維約喬歷韋費勞盧麗瑪蓋邁繆華漢澤茲懷齊紐謝賓遜讓馮賽頓門東衛烏車熱楊張劉陳趙吳鄭孫錢岡榮進樹紀偉鈴關廣島應義樂書學實寬慶贊賀淺澀婁徹溫麥",
    ),
}


def _fetch(endpoint: str, filename: str) -> list[dict]:
    path = download(f"{API}/{endpoint}?limit={LIMIT}&offset=0", "nobel", filename)
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    key = endpoint
    if data["meta"]["count"] > LIMIT:
        raise RuntimeError(f"Nobel API 的 {endpoint} 有 {data['meta']['count']} 筆，超過一頁 {LIMIT} 筆，要加大 LIMIT")
    if len(data[key]) != data["meta"]["count"]:
        raise RuntimeError(f"Nobel API 的 {endpoint} 應該有 {data['meta']['count']} 筆，只拿到 {len(data[key])} 筆")
    return data[key]


def laureates() -> list[dict]:
    """所有得主（個人有 knownName、birth，組織有 orgName、founded），每位的 nobelPrizes 是他得過的獎。"""
    return _fetch("laureates", "laureates.json")


def prizes() -> list[dict]:
    """每年每一類的獎（沒有頒發的年份 laureates 是空的或沒有這個欄位）。"""
    return _fetch("nobelPrizes", "nobelPrizes.json")


def _digest(qids: list[str]) -> str:
    return hashlib.sha1(",".join(qids).encode()).hexdigest()[:12]


def zh_labels(qids: list[str], prefix: str = "nobel") -> dict[str, tuple[str | None, str | None]]:
    """{QID: (中文名稱或 None, 來源語言)}。

    依序用 Wikidata 本身的 zh-tw、zh-hant、zh-hk 名稱；都沒有時用 languagefallback 的 zh-tw，
    那是伺服器從 zh／zh-hans／zh-cn 等轉換過來的繁體（來源語言記成 zh→tw 之類）。再沒有就是 None（介面上用英文名）。
    依 QID 排序後每 50 個一批，快取檔名是這批 QID 的雜湊，新增得主時只會重抓有變的那幾批。
    prefix 是快取檔名的開頭（城市主題用 cities）。
    """
    ids = sorted(set(qids), key=lambda q: int(q[1:]))
    out: dict[str, tuple[str | None, str | None]] = {}
    for start in range(0, len(ids), BATCH):
        batch = ids[start:start + BATCH]
        params = {
            "action": "wbgetentities",
            "ids": "|".join(batch),
            "props": "labels",
            "languages": "|".join(ZH_ORDER),
            "languagefallback": "1",
            "format": "json",
        }
        path = download(f"{WIKIDATA_API}?{urllib.parse.urlencode(params)}", "wikidata", f"{prefix}-labels-{_digest(batch)}.json")
        with open(path, encoding="utf-8") as f:
            entities = json.load(f)["entities"]
        for qid in batch:
            labels = entities.get(qid, {}).get("labels", {})
            out[qid] = _pick_zh(labels)
    return out


def _pick_zh(labels: dict[str, dict]) -> tuple[str | None, str | None]:
    # 本身就有這個語言的名稱：沒有 for-language（借用別的語言）也沒有 source-language（轉換過）
    for lang in ZH_ORDER:
        label = labels.get(lang)
        if label and label.get("language") == lang and "for-language" not in label and "source-language" not in label:
            return _traditional(label["value"]), lang
    fallback = labels.get("zh-tw")
    if not fallback:
        return None, None
    source = fallback.get("source-language") or fallback.get("language", "")
    if not source.startswith("zh"):  # 退回英文或 mul
        return None, None
    return _traditional(fallback["value"]), f"{source}→tw"


def _traditional(name: str) -> str:
    converted = name.translate(S2T)
    if converted != name:
        print(f"  Wikidata 的中文名稱有簡體字：{name} → {converted}")
    left = sorted({ch for ch in converted if not _big5(ch)})
    if left:
        print(f"  {converted} 有 Big5 沒有的字 {''.join(left)}（日文漢字就沒關係，簡體字要加進 S2T）")
    return converted


def _big5(ch: str) -> bool:
    try:
        ch.encode("cp950")
        return True
    except UnicodeEncodeError:
        return False


BIRTH_QUERY = """
SELECT ?person ?place ?placeLabel ?iso WHERE {
  VALUES ?person { %s }
  ?person wdt:P19 ?place .
  ?place wdt:P17 ?country .
  ?country wdt:P298 ?iso .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
"""


def birth_countries(qids: list[str]) -> dict[str, list[tuple[str, str]]]:
    """Nobel API 沒有出生地的得主：用 Wikidata 的出生地（P19）所在的國家（P17）的 ISO alpha-3（P298）。

    回傳 {QID: [(ISO3, 出生地英文名), …]}；wdt: 只取最佳等級的陳述，已經不存在的國家（例如桑給巴爾蘇丹國）沒有 P298，自然排除。
    """
    if not qids:
        return {}
    ids = sorted(set(qids))
    query = BIRTH_QUERY % " ".join(f"wd:{q}" for q in ids)
    url = f"{SPARQL}?{urllib.parse.urlencode({'query': query, 'format': 'json'})}"
    path = download(url, "wikidata", f"nobel-birthplaces-{_digest(ids)}.json")
    with open(path, encoding="utf-8") as f:
        rows = json.load(f)["results"]["bindings"]
    out: dict[str, list[tuple[str, str]]] = {}
    for r in rows:
        qid = r["person"]["value"].rsplit("/", 1)[-1]
        found = (r["iso"]["value"], r["placeLabel"]["value"])
        if found not in out.setdefault(qid, []):
            out[qid].append(found)
    return out
