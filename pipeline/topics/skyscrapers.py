"""摩天大樓主題：Wikidata（CC0）收錄的 150 m 以上的建築，每棟一個點；各國 300 m 以上的棟數、最高建築的高度，
1930 年起每一年「已經完工、還沒拆除」的。

Wikidata 的收錄跟 CTBUH 的總數比，200 m 以上約兩成（中國約一成）、300 m 以上約六成五（manifest.json 的 coverage），
國家之間不能比 150、200 m 以上的棟數，所以國家的指標只做 300 m 以上；每百萬人的棟數也不做（主要反映收錄的程度）。

建築（sources/wikidata_buildings.py）：
- 候選：有一個高度（P2048）換算後 150 m 以上的項目（約 3 千個，含山、瀑布、橋、電視塔…）。
- 是不是建築：P31 有 BUILDING_CLASSES 裡的類別（摩天大樓、高層建築、辦公大樓、住宅大樓、旅館…，給人使用的樓）；
  電視塔、觀景塔、通訊塔、煙囪、升降機測試塔、燈塔、宗教建築（教堂的尖塔、清真寺的宣禮塔）、發電廠、水壩、橋不算
  （NOT_BUILDINGS；有這些類別、又同時標了摩天大樓的，逐一看過寫在 EXCLUDE / KEEP）。跟 CTBUH 的定義接近：
  CTBUH 只算「可以使用的樓層占高度一半以上」的建築，塔不算。
- 完工而且還在：見 _status()。
- 高度（_height()）：見 HEIGHT_RULE 的說明；pipeline 印出跟樓層數對不上的、超過 830 m 的、單位是英尺的，逐一看過。
- 重複：一個建築群（P527 有部分在清單裡）只算它的各棟；同一個位置、同一個高度的兩個項目只算一個（DUPLICATES）。
  雙塔（P31 是 twin towers，沒有各自的項目）算 2 棟（CTBUH 也分開算），點只有一個。
- 國家：依座標用網站自己的國界判斷（geoindex 的 Natural Earth 1:10m，香港、澳門、台灣各自一國），沒有座標的用 P17；
  香港與深圳之間依 P131 的鏈（見 _countries()），國界河上的個別建築寫在 COUNTRY_FIXES。
- 城市：P131（所在行政區）往上最多 4 層，取最高的一個城市（Q515 的子類別，不含市轄區；台灣的直轄市另外算），
  CITY_OVERRIDES 改成一般說的城市；鏈上沒有城市（直接寫州、省）的用城市主題的 GHSL 城市。

輸出（public/data/topics/skyscrapers/）：supertall.json、tallest.json（指標檔）、buildings.json（每一棟，點與側欄）、
undated.json（沒有完工年份、不算的，側欄列出）、manifest.json（筆數、涵蓋率的對照、資料日期）。
"""
from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict
from datetime import date

import geoindex
from common import CACHE_DIR, OUT_DIR, ROOT, indicator_file, now_iso, points_file, write_json
from sources import wikidata_buildings as wb

OUT = OUT_DIR / "topics" / "skyscrapers"
FIRST_YEAR = 1930  # 第一棟 300 m 以上的是 1930 年的克萊斯勒大樓；更早完工的 150 m 以上的建築在 1930 年一起出現
TODAY = date.today()
LAST_YEAR = TODAY.year
THRESHOLDS = (150, 200, 300)
METRE, FOOT = "Q11573", "Q3710"
UNITS = {METRE: 1.0, FOOT: 0.3048, "Q828224": 1000.0, "Q174789": 0.001}

# ── 是不是建築（P31） ────────────────────────────────────────────
# 給人使用的樓：有這些類別的才算
BUILDING_CLASSES = {
    "Q11303": "skyscraper", "Q15622489": "skyscraper in Japan", "Q12771350": "skyscraper (Korea)",
    "Q104829543": "supertall building", "Q18142": "high-rise / tower block", "Q2304397": "residential tower",
    "Q134570257": "office tower", "Q96211909": "tower building", "Q1021645": "office building",
    "Q11755880": "residential building", "Q13402009": "apartment building", "Q188507": "apartment",
    "Q161851": "condominium", "Q27686": "hotel", "Q63099748": "hotel building", "Q41176": "building",
    "Q11755959": "multi-story urban building", "Q655686": "commercial building", "Q11626975": "commercial complex",
    "Q18760388": "retail building", "Q11315": "shopping center", "Q31374404": "shopping mall",
    "Q18761864": "bank building", "Q7540126": "headquarters", "Q1530704": "corporate headquarters",
    "Q51879674": "newspaper building", "Q1339195": "station building", "Q543654": "Rathaus",
    "Q25550691": "city hall", "Q100705206": "prefectural office building", "Q7138926": "parliament building",
    "Q1137809": "courthouse", "Q19844914": "university building", "Q122228860": "vertical campus building",
    "Q133215": "casino", "Q875157": "resort", "Q56352703": "combined facility", "Q85625953": "inclined building",
    "Q118896406": "twin towers", "Q27556845": "skyscraper complex", "Q1497364": "building complex",
    "Q4298922": "mixed-use development",
}
# 一定是摩天大樓的類別：有這些的，就算同時標了塔也算建築（例如麥加皇家鐘塔飯店）
SKYSCRAPER_CLASSES = {"Q11303", "Q15622489", "Q12771350", "Q104829543", "Q18142", "Q2304397", "Q134570257"}
# 不是給人使用的樓（只有這些、或加上「建築」這種一般類別的不算）
NOT_BUILDINGS = {
    "Q12518": "tower", "Q11166728": "television tower", "Q1440300": "observation tower",
    "Q1798641": "communication tower", "Q1068623": "transmitter mast", "Q1440476": "lattice tower",
    "Q1689156": "elevator test tower", "Q170477": "chimney", "Q1056661": "flue-gas stack", "Q853854": "clock tower",
    "Q274153": "water tower", "Q39715": "lighthouse", "Q48356": "minaret", "Q72926449": "church tower",
    "Q5191724": "steeple", "Q108428491": "ventilation tower", "Q804399": "Blaw-Knox tower", "Q107096063": "landmark tower",
    "Q2463167": "Typenturm", "Q797765": "inclined tower", "Q136032232": "tower (other)",
    "Q24398318": "religious building", "Q16970": "church building", "Q32815": "mosque", "Q2977": "cathedral",
    "Q56242215": "Catholic cathedral", "Q56242250": "Anglican cathedral", "Q120560": "minor basilica",
    "Q1088552": "Catholic church building", "Q842402": "Hindu temple", "Q108325": "chapel",
    "Q133747929": "expiatory temple", "Q97588309": "former cathedral", "Q57644089": "destroyed church",
    "Q15911738": "hydroelectric power station", "Q6558431": "coal-fired power station", "Q200297": "thermal power station",
    "Q1601458": "combined heat and power station", "Q900729": "combined cycle power station",
    "Q339353": "pumped-storage power station", "Q56697283": "hydroelectric dam", "Q3397516": "bridge",
    "Q194356": "wind farm", "Q50687555": "onshore wind farm", "Q110125291": "vertical integration facility",
}
# 還沒完工、沒有蓋、蓋到一半放棄的（P31 或 P5817）
NOT_COMPLETED = {
    "Q12377751": "under construction", "Q98937704": "architecturally topped out", "Q97317113": "on hold",
    "Q811683": "proposed", "Q124835105": "proposed tower", "Q30108381": "cancelled", "Q105821051": "unbuilt",
    "Q21514702": "abandoned project", "Q1570262": "unfinished building", "Q64728694": "proposed entity",
}
DESTROYED = {"Q19860854", "Q56556915"}  # 拆除或毀損的建築（P31）、使用狀態「已拆除或毀損」（P5817）

# ── 逐一看過的項目（2026-10-27，Wikidata 的資料日期見 manifest.json）。300 m 以上的每一棟、各國最高的、
#    pipeline 印出「每層高度」不對勁的都看過；只改有把握的，理由寫在後面 ──────────────────
# 不算：不是給人使用的樓、高度明顯錯誤、還沒完工（Wikidata 沒有標狀態）
EXCLUDE: dict[str, str] = {
    "Q223207": "東方明珠廣播電視塔：電視塔（P31 寫成建築）",
    "Q745016": "吉隆坡塔：電信塔（P31 寫成建築）",
    "Q122832816": "臨沂廣播電視塔：電視塔",
    "Q2371922": "AFLAC Tower：電視塔（P31 寫成建築）",
    "Q901058": "甘迺迪太空中心的垂直組裝大樓：單一空間的組裝廠房，不是有樓層可以使用的大樓（CTBUH 也不算）",
    "Q940833": "烈士谷（Cuelgamuros）：紀念碑的十字架",
    "Q671484": "可汗之帳：帳篷形狀的購物娛樂中心，高度大多是帳篷的結構",
    "Q24942115": "Torres Carlos Antúnez：448 m 明顯錯誤（這組住宅大樓沒有那麼高），沒有其他高度可用",
    "Q497536": "孟加拉國會大廈：155 是英尺（約 47 m），被當成公尺",
    "Q620809": "Palais Royale（孟買）：2018 年結構封頂，2025 年的報導仍是興建中",
    "Q1208733": "Diamond of Istanbul：沒有完工，2025 年改設計為 Rams Beyond，興建中",
    "Q251006": "莫斯科市政廳與市議會大樓：計畫取消，沒有蓋",
    "Q229605": "3 Hudson Boulevard：興建中（P571 2017、2019 年是動工年）",
    "Q20004122": "1 Park Lane：沒有蓋（沒有樓層數，P571 2020 是計畫的年份）",
    "Q496218": "釜山樂天塔：興建中（P571 2023、30 層是施工中的數字）",
    "Q15549825": "VietinBank Business Center：停工，沒有完工",
    "Q5270933": "吉達鑽石塔：停工，沒有完工（P571 2025 不是完工年）",
    "Q1207442": "Dubai Towers Doha：P1619 的 2026 年是預定的啟用年份，沒有完工",
    "Q18414186": "Forum 66 Tower 2：P571 2026 是預定的年份，沒有完工",
}
KEEP: dict[str, str] = {
    "Q85810295": "Tour To-Lyon（里昂，171 m、43 層）：P31 只寫塔，其實是辦公大樓",
    "Q109115871": "Menara Dato' Onn（吉隆坡，175 m、40 層）：P31 只寫塔，其實是辦公大樓",
}
# 同一棟建築有兩個項目：{留下的: 不算的}
DUPLICATES: dict[str, str] = {
    "Q18712428": "Q189476",  # 麥加皇家鐘塔（601 m）與整個 Abraj Al Bait 建築群（607 m，其他 6 棟沒有各自的項目）
}
# 逐一看過的修正：{QID: (值, 理由)}
HEIGHT_FIXES: dict[str, tuple[float, str]] = {
    "Q9188": (381.0, "帝國大廈：Wikidata 標「建築高度」的 453 m 不對，屋頂 381 m、到天線頂端 443 m"),
    "Q11274": (318.9, "克萊斯勒大樓：建築高度含不鏽鋼尖塔是 318.9 m，Wikidata 標「建築高度」的 282 m 是屋頂"),
    "Q337631": (347.5, "高雄 85 大樓：Wikidata 的 323 m 沒有限定詞，不是建築高度；CTBUH 的 Skyscraper Center 高雄頁寫 347.5 m"),
    "Q7338767": (376.0, "武漢天地 A1（Riverview Plaza）：436 m 是原本設計的高度，完工的建築高度 376 m"),
    "Q16890775": (271.3, "Crown Sydney：建築高度 271.3 m，300 m 是規劃階段的數字"),
    "Q274916": (265.0, "8 Spruce Street（紐約）：265 m（870 ft），300 m 不對"),
}
YEAR_FIXES: dict[str, tuple[int, str]] = {
    "Q83101": (2004, "台北 101：2004-12-31 開幕；Wikidata 的建造結束 2003 年是結構封頂，P1619 寫 2005-11-14"),
    "Q12495": (2010, "哈里發塔：2010-01-04 啟用；建造結束的 2009 年是外觀完成"),
    "Q11245": (2014, "世界貿易中心一號大樓：2014-11 啟用；建造結束的 2013 年是尖塔完成"),
    "Q494895": (2017, "樂天世界塔：2017-04 開幕；建造結束的 2016 年是外觀完成"),
    "Q11235": (1973, "舊世界貿易中心的雙塔：1973-04-04 啟用（北塔 1972 年、南塔 1973 年完工），建造結束的 1987 年是整個建築群"),
    "Q1642373": (2010, "中國國際貿易中心：330 m 的是 2010 年完工的第三期主塔，1990 年是第一期啟用"),
    "Q737602": (2007, "阿斯拜爾塔（杜哈）：為 2006 年亞運興建，2007 年完工；P571 的 2000 年不是完工年"),
    "Q102281065": (2024, "埃及新首都的標誌塔（Iconic Tower）：Wikidata 還標興建中，CTBUH 2024 年回顧寫它是 2024 年完工最高的建築"),
    "Q24840610": (2018, "臺北南山廣場：2018 年完工啟用，Wikidata 沒有年份"),
    "Q47539331": (2020, "遠雄 THE ONE（高雄）：2020 年取得使用執照、落成；P571 的 2019 年不是完工年"),
}
# Wikidata 的年份不是完工年、也查不到可靠的完工年：當成沒有完工年份（不算，側欄列在「沒有完工年份」）
NO_YEAR: dict[str, str] = {
    "Q47528623": "臺北天空塔：2019 年動工、結構已封頂，P571 的 2020 年不是完工年，完工時間查不到可靠的來源",
}
# 舊世界貿易中心的雙塔沒有各自完整的項目，整個建築群算 2 棟
TWIN_FIXES = {"Q11235"}
FLOOR_FIXES: dict[str, tuple[int | None, str]] = {
    "Q659652": (None, "One Astor Plaza：樓層數寫 200 不對（約 54 層），不寫"),
}
# 每層高度看起來不對、看過以後確定沒問題的（頂上有很高的尖塔或拱、樓層特別高）
CHECKED: dict[str, str] = {
    "Q1768749": "The Centaurus（伊斯蘭瑪巴德）：查不到可靠的高度與樓層，照 Wikidata",
    "Q6960571": "Nakheel Tower（利雅德）：查不到可靠的高度與樓層，照 Wikidata",
    "Q127043383": "Revenue Tower（雅加達）：查不到可靠的高度與樓層，照 Wikidata",
    "Q656743": "王國中心：頂上是 100 m 高的拱",
    "Q737602": "阿斯拜爾塔：頂上是火炬造型的結構",
    "Q2090752": "NTT Docomo 代代木大樓：上半部是機房與鐘塔",
    "Q2303314": "費薩里亞中心：頂上是尖塔與球",
    "Q109648853": "270 Park Avenue：樓層挑高（CTBUH 也是 423 m、60 層）",
}
# 行政區 → 要寫的城市（P131 的鏈對不到城市、或對到的不是一般說的城市時）
CITY_OVERRIDES: dict[str, str] = {
    "Q613": "Q612", "Q620734": "Q612",  # 杜拜酋長國、杜拜市中心 → 杜拜
    "Q3224": "Q3130", "Q1094194": "Q3130",  # 新南威爾斯州、雪梨市（地方政府區）→ 雪梨
    "Q36687": "Q3141", "Q1919098": "Q3141",  # 維多利亞州、墨爾本市（地方政府區）→ 墨爾本
    "Q984542": "Q23768",  # 天堂市（拉斯維加斯大道所在）→ 拉斯維加斯
    "Q2739353": "Q1345",  # 費城中心城區 → 費城
    "Q12172": "Q78",  # 巴塞爾城市州 → 巴塞爾
    "Q189715": "Q987729", "Q234743": "Q987729", "Q170507": "Q987729",  # 庫爾伯瓦、皮托、楠泰爾 → 拉德芳斯
    "Q16665897": "Q456",  # 里昂大都會 → 里昂
    "Q1167101": "Q1492", "Q5824684": "Q2807",  # 巴塞隆納的奧運村、馬德里的 Cuatro Caminos
    "Q23311": "Q84", "Q208152": "Q84", "Q23306": "Q84",  # 倫敦市、哈姆雷特塔區、大倫敦 → 倫敦
    "Q2680952": "Q34370", "Q9899": "Q727",  # 鹿特丹、阿姆斯特丹的市鎮 → 城市
    "Q726917": "Q37100",  # 奧克蘭大區 → 奧克蘭
    "Q1270190": "Q11194",  # 岑塔爾 → 塞拉耶佛
    "Q237674": "Q239",  # 聖吉爾 → 布魯塞爾
    "Q606287": "Q35381",  # 可倫坡區 → 可倫坡
    "Q2074197": "Q3711",  # 貝爾格勒市 → 貝爾格勒
    "Q503361": "Q2211",  # 馬爾默市鎮 → 馬爾默
    "Q2346838": "Q34647", "Q1094207": "Q3926",  # 約翰尼斯堡、茨瓦內的都會市鎮 → 約翰尼斯堡、普利托利亞
    "Q2279529": "Q35997", "Q812591": "Q35997",  # 伊茲密爾的科納克、巴伊拉克利區
    "Q390637": "Q406", "Q753882": "Q406",  # 伊斯坦堡的希什利、阿塔謝希爾區
    "Q4736136": "Q1156",  # 孟買的 Altamount Road
}
# 台灣的直轄市（Q2225003）在 Wikidata 不是「城市」的子類別（臺北市另外標了城市，高雄市沒有），所以另外算城市
EXTRA_CITY_CLASSES = {"Q2225003"}
# 個別建築的城市：{建築: (城市 QID, 理由)}（P131 直接寫省的）
BUILDING_CITY: dict[str, tuple[str, str]] = {}
# 個別建築的國家：{建築: (ISO3, 理由)}
COUNTRY_FIXES: dict[str, tuple[str, str]] = {
    "Q9306302": ("USA", "底特律的文藝復興中心 Tower 300，座標在底特律河的美國岸邊；1:10m 的美加國界在這裡偏北，判成加拿大"),
}
# 每一棟的判斷結果（狀態、高度與年份的依據、城市的鏈），逐一檢查用，不輸出
CACHE_DEBUG = CACHE_DIR / "wikidata" / "skyscrapers-debug.json"

# ── 高度 ─────────────────────────────────────────────────────
HEIGHT_RULE = """
高度依 CTBUH 的「建築高度」（architectural height：從最低的主要出入口量到建築的頂端，含尖塔，不含天線、旗杆）：
1. 不用已棄用的、結束時間（P582）已過的、標「預期」（P1013 = expected）的、「到最高使用樓層」的陳述。
2. 有標「建築高度」（P1013 或 P518 = architectural height）的，用它（有偏好值用偏好值，好幾個取最大）。
3. 沒有的話，用沒有限定詞的（也就是一般寫的高度，維基百科的資訊框通常寫建築高度；偏好值優先，好幾個取最大，
   一個建築群列了各棟的高度時就是最高的那棟）。P518 寫的是「公制」「英制」或建築的某一部分（辦公、旅館）的也當成這一類，
   P1011（不含）也是。
4. 再沒有的話用尖塔（P518 = spire），再來是屋頂（P518 = roof），最後才是到頂端（height to pinnacle、天線、P1012 含天線）。
"""
ARCHITECTURAL, PINNACLE, OCCUPIED, EXPECTED = "Q24192182", "Q26970842", "Q31271474", "Q50376823"
ROOF, SPIRE, ANTENNA = "Q83180", "Q852590", "Q131214"


def _claims(entity: dict, prop: str) -> list[dict]:
    return [c for c in entity.get("claims", {}).get(prop, []) if c["rank"] != "deprecated" and c["mainsnak"]["snaktype"] == "value"]


def _qual_ids(claim: dict, prop: str) -> list[str]:
    out = []
    for s in claim.get("qualifiers", {}).get(prop, []):
        if s["snaktype"] == "value" and isinstance(s["datavalue"]["value"], dict):
            v = s["datavalue"]["value"]
            out.append(v.get("id") or v.get("time") or "")
    return out


def _year(time: str) -> int | None:
    """Wikidata 的時間（+2004-12-31T00:00:00Z）→ 年；西元前或格式不對是 None"""
    if not time or time[0] != "+":
        return None
    try:
        return int(time[1:5])
    except ValueError:
        return None


def _ended(claim: dict) -> bool:
    for t in _qual_ids(claim, "P582"):
        y = _year(t)
        if y is not None and y <= TODAY.year:
            return True
    return False


def _height(entity: dict, log: list[str]) -> tuple[float | None, str]:
    """(高度 m, 用了哪一種：arch / plain / spire / roof / tip)"""
    groups: dict[str, list[tuple[bool, float]]] = defaultdict(list)
    for c in _claims(entity, "P2048"):
        if _ended(c):
            continue
        v = c["mainsnak"]["datavalue"]["value"]
        unit = v["unit"].rsplit("/", 1)[-1]
        if unit not in UNITS:
            log.append(f"{entity['id']} 高度的單位不是長度（{unit}），不用")
            continue
        metres = float(v["amount"]) * UNITS[unit]
        crit = set(_qual_ids(c, "P1013"))
        part = set(_qual_ids(c, "P518"))
        if EXPECTED in crit or OCCUPIED in crit or OCCUPIED in part:
            continue
        preferred = c["rank"] == "preferred"
        if ARCHITECTURAL in crit or ARCHITECTURAL in part:
            kind = "arch"
        elif SPIRE in part:
            kind = "spire"
        elif ROOF in part:
            kind = "roof"
        elif PINNACLE in crit or ANTENNA in part or "P1012" in c.get("qualifiers", {}):
            kind = "tip"
        else:
            kind = "plain"
        groups[kind].append((preferred, metres))
    for kind in ("arch", "plain", "spire", "roof", "tip"):
        values = groups.get(kind)
        if not values:
            continue
        pref = [m for p, m in values if p]
        chosen = max(pref or [m for _, m in values])
        spread = max(m for _, m in values) - min(m for _, m in values)
        if kind == "plain" and spread > 5:
            log.append(f"{entity['id']} 沒有限定詞的高度不一致：{sorted({round(m, 1) for _, m in values})}，取 {chosen:.1f}")
        return round(chosen, 1), kind
    return None, ""


def _floors(entity: dict) -> int | None:
    values = []
    for c in _claims(entity, "P1101"):
        if _ended(c):
            continue
        try:
            values.append((c["rank"] == "preferred", float(c["mainsnak"]["datavalue"]["value"]["amount"])))
        except (KeyError, ValueError, TypeError):
            continue
    if not values:
        return None
    pref = [v for p, v in values if p]
    n = max(pref or [v for _, v in values])
    return int(n) if n >= 1 else None


def _times(entity: dict, prop: str) -> list[int]:
    out = []
    for c in _claims(entity, prop):
        v = c["mainsnak"]["datavalue"]["value"]
        if isinstance(v, dict) and "time" in v:
            y = _year(v["time"])
            if y:
                out.append(y)
    return out


CONSTRUCTION_EVENTS = {"Q385378", "Q3875186"}  # 建造（起訖用 P580、P582）
END_OF_CONSTRUCTION = "Q59913255"
START_OF_CONSTRUCTION = {"Q27136782", "Q1068633"}  # 開始建造、動土典禮
OPENING = "Q15051339"


def _completion(entity: dict) -> tuple[int | None, str]:
    """(完工年, 依據)。依序：P793 的「完工」或「建造」的結束時間、P1619 啟用日期、P793 的「開幕」、P571 成立時間
    （P571 跟動工的年份一樣時，那是動工年，不用）"""
    ends, starts, opens = [], [], []
    for c in _claims(entity, "P793"):
        ev = c["mainsnak"]["datavalue"]["value"].get("id")
        times = {p: [y for y in (_year(t) for t in _qual_ids(c, p)) if y] for p in ("P585", "P580", "P582")}
        if ev == END_OF_CONSTRUCTION:
            ends += times["P585"] + times["P582"] + times["P580"]
        elif ev in CONSTRUCTION_EVENTS:
            ends += times["P582"]
            starts += times["P580"]
        elif ev in START_OF_CONSTRUCTION:
            starts += times["P585"] + times["P580"]
        elif ev == OPENING:
            opens += times["P585"] + times["P580"]
    if ends:
        return max(ends), "end"
    opening = _times(entity, "P1619")
    if opening:
        return min(opening), "opening"
    if opens:
        return min(opens), "opening"
    inception = _times(entity, "P571")
    if inception:
        y = max(inception)
        if starts and y <= max(starts):
            return None, "inception=start"
        return y, "inception"
    return None, ""


def _coord(entity: dict) -> tuple[float, float] | None:
    for c in _claims(entity, "P625"):
        v = c["mainsnak"]["datavalue"]["value"]
        if isinstance(v, dict) and "latitude" in v and (v.get("globe") or "").endswith("Q2"):
            return v["longitude"], v["latitude"]
    return None


def _ids(entity: dict, prop: str) -> list[str]:
    out = []
    for c in _claims(entity, prop):
        v = c["mainsnak"]["datavalue"]["value"]
        if isinstance(v, dict) and v.get("id"):
            out.append(v["id"])
    return out


def _status(e: dict, classes: set[str]) -> tuple[str, int | None, int | None, str]:
    """(狀態, 完工年, 拆除年, 完工年的依據)。狀態：standing（完工、還在）、demolished（完工、後來拆除或毀損）、
    not-completed（興建中、計畫中、停工、取消、沒蓋完）、no-year（沒有任何完工、啟用、成立的年份，無法判斷）、
    future（完工年份在今年以後）、destroyed-no-year（標了拆除或毀損，但沒有年份）"""
    state = set(_ids(e, "P5817"))
    year, how = _completion(e)
    qid = e["id"]
    if qid in YEAR_FIXES:
        year, how = YEAR_FIXES[qid][0], "fix"
    if (classes | state) & set(NOT_COMPLETED) and qid not in YEAR_FIXES:
        return "not-completed", year, None, how
    if year is None or qid in NO_YEAR:
        return "no-year", None, None, how
    if year > LAST_YEAR:
        return "future", year, None, how
    gone = _times(e, "P576")
    if gone:
        return "demolished", year, min(gone), how
    if (classes | state) & DESTROYED:
        return "destroyed-no-year", year, None, how
    return "standing", year, None, how


def _distance_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    dx = (a[0] - b[0]) * 111_320 * math.cos(math.radians((a[1] + b[1]) / 2))
    dy = (a[1] - b[1]) * 110_540
    return math.hypot(dx, dy)


def _norm(name: str | None) -> str:
    return "".join(ch for ch in (name or "").lower() if ch.isalnum())


def _dedupe(rows: list[dict], log: list[str]) -> list[dict]:
    """建築群與它的各棟只留各棟；同一個位置、同一個高度、名稱一個包含另一個的兩個項目只留名稱長的（短的通常是整個開發案）"""
    by_qid = {r["qid"]: r for r in rows}
    drop: dict[str, str] = {}
    for r in rows:
        parts = [p for p in _ids(r["e"], "P527") if p in by_qid]
        if parts:
            drop[r["qid"]] = f"建築群，各棟另外有項目（{', '.join(parts)}）"
        for parent in _ids(r["e"], "P361"):
            if parent in by_qid:
                drop[parent] = f"建築群，{r['qid']} 是它的一部分"
    for a, b in DUPLICATES.items():
        if a in by_qid and b in by_qid:
            drop[b] = f"跟 {a} 是同一棟（DUPLICATES）"
    kept = [r for r in rows if r["qid"] not in drop]
    for i, r in enumerate(kept):
        if r["qid"] in drop or not r["coord"]:
            continue
        for s in kept[i + 1:]:
            if s["qid"] in drop or not s["coord"] or abs(r["h"] - s["h"]) > 2:
                continue
            if _distance_m(r["coord"], s["coord"]) > 150:
                continue
            a, b = _norm(r["en"] or r["zh"]), _norm(s["en"] or s["zh"])
            if a and b and (a in b or b in a):
                short, long = (r, s) if len(a) <= len(b) else (s, r)
                drop[short["qid"]] = f"跟 {long['qid']}（{long['en']}）同一個位置、同一個高度，名稱包含在它裡面"
    for qid, why in sorted(drop.items()):
        if qid in by_qid:
            log.append(f"重複：{qid}（{by_qid[qid]['en'] or by_qid[qid]['zh']}，{by_qid[qid]['h']} m）不算，{why}")
    return [r for r in rows if r["qid"] not in drop]


HONG_KONG, MACAU = "Q8646", "Q14773"
WIKI_ISO = {"XKS": "XKX"}  # Wikidata 的 P298 → 地圖的代碼


def _countries(rows: list[dict], log: list[str]) -> None:
    """r['iso3']：依座標（geoindex 的 1:10m 國界）；沒有座標的用 P17（Wikidata 的 P298）。
    香港、澳門與中國之間依 P131 的鏈（有沒有經過香港、澳門）決定：地圖的 1:50m 香港邊界比實際偏北，深圳福田、羅湖的
    大樓（平安金融中心、京基 100、信興廣場）原本落在香港裡；geoindex 改用 1:10m（2026-10-27）以後這 8 棟的座標
    已經在中國，這條規則目前沒有改到任何一棟，留著當保險（1:10m 的香港邊界在沙頭角一帶仍偏北幾百公尺）。
    其他跟 P17 不同的印出來，逐一看過的寫在 COUNTRY_FIXES。"""
    lons = [r["coord"][0] for r in rows if r["coord"]]
    lats = [r["coord"][1] for r in rows if r["coord"]]
    found = iter(geoindex.countries_at(lons, lats))
    isos = wb.iso3_of([c for r in rows for c in _ids(r["e"], "P17")])
    for r in rows:
        geo = next(found) if r["coord"] else None
        p17 = [WIKI_ISO.get(isos[c], isos[c]) for c in _ids(r["e"], "P17") if c in isos]
        iso = geo or (p17[0] if p17 else None)
        if iso in ("CHN", "HKG", "MAC") and r["chain"]:
            iso = "HKG" if HONG_KONG in r["chain"] else "MAC" if MACAU in r["chain"] else "CHN"
        if r["qid"] in COUNTRY_FIXES:
            iso = COUNTRY_FIXES[r["qid"]][0]
        if geo and iso != geo:
            why = "COUNTRY_FIXES" if r["qid"] in COUNTRY_FIXES else "P131"
            log.append(f"國家：{r['qid']} {r['en']} 的座標在 {geo}，依 {why} 改成 {iso}")
        elif p17 and iso not in p17 and not (iso in ("HKG", "MAC", "TWN") and "CHN" in p17):
            log.append(f"國家：{r['qid']} {r['en']} 的座標在 {iso}，P17 是 {p17}")
        r["iso3"] = iso


def _cities(rows: list[dict], log: list[str]) -> None:
    """r['city']：(中文, 英文)。P131 往上最多 4 層，取第一個是城市（Q515 的子類別、不是市轄區）的；都不是時用第一層。"""
    chains: dict[str, list[str]] = {r["qid"]: [] for r in rows}
    frontier = {r["qid"]: (_ids(r["e"], "P131")[:1]) for r in rows}
    info: dict[str, tuple[set[str], list[str]]] = {}
    for _ in range(4):
        need = sorted({a for f in frontier.values() for a in f if a not in info})
        info.update(wb.admin(need))
        nxt = {}
        for qid, f in frontier.items():
            if not f:
                continue
            a = f[0]
            chains[qid].append(a)
            parents = info.get(a, (set(), []))[1]
            nxt[qid] = parents[:1]
        frontier = nxt
    classes = wb.city_classes(sorted({c for cls, _ in info.values() for c in cls}))
    labels = wb.entities(sorted(info), "skyscrapers-admin-labels", props="labels")
    def is_city(a: str) -> bool:
        cls = info.get(a, (set(), []))[0]
        flags = [classes.get(c, (False, False)) for c in cls]
        return bool(cls & EXTRA_CITY_CLASSES) or (any(city for city, _ in flags) and not any(district for _, district in flags))

    picked = Counter()
    for r in rows:
        chain = chains[r["qid"]]
        r["chain"] = chain
        # 鏈上最高的一個城市（區 → 市 → 省：取市；村里 → 區 → 直轄市：取直轄市），遇到 CITY_OVERRIDES 就用它
        choice = None
        for a in chain:
            if a in CITY_OVERRIDES:
                choice = CITY_OVERRIDES[a]
                break
            if is_city(a):
                choice = a
        r["city"], r["cityQid"] = None, None
        if r["qid"] in BUILDING_CITY:
            choice = BUILDING_CITY[r["qid"]][0]
            picked["個別指定"] += 1
        elif choice is None:
            # P131 的鏈上沒有城市（直接寫州、省或國家）：用城市主題的 GHSL 城市（座標在它的範圍附近）
            ucdb = ucdb_city(r["coord"]) if r["coord"] else None
            if ucdb:
                r["city"] = ucdb
                picked["城市主題的 GHSL 城市"] += 1
                continue
            choice = chain[0] if chain else None
            picked["P131 的第一層"] += 1
        else:
            picked["P131 的城市"] += 1
        if choice and choice not in labels:
            labels.update(wb.entities([choice], "skyscrapers-admin-labels", props="labels"))
        r["city"] = wb.names(labels[choice]) if choice in labels else (None, None)
        r["cityQid"] = choice
    print(f"  城市：{dict(picked)}")


def _ucdb_cities():
    """城市主題的 GHSL 城市（public/data/topics/cities/cities.json）：[(經度, 緯度, 半徑 km, 中文, 英文)]，
    半徑是 2025 年面積的等面積圓半徑。城市主題重跑後這裡也要重跑。"""
    path = OUT_DIR / "topics" / "cities" / "cities.json"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    col = {name: data["columns"][i] for i, name in enumerate(data["fields"])}
    areas = [f"a{y}" for y in range(1975, 2030, 5)]  # 面積也是每一期存跟前一期的差
    out = []
    for i in range(len(col["lon"])):
        if col["a2025"][i] is None or col["lon"][i] is None:
            continue
        area = sum(col[a][i] or 0 for a in areas) * data["scale"]["a2025"]
        out.append((col["lon"][i] * 0.01, col["lat"][i] * 0.01, math.sqrt(max(area, 1) / math.pi), col["zh"][i], col["name"][i]))
    return out


_UCDB = None


def ucdb_city(coord: tuple[float, float]) -> tuple[str | None, str | None] | None:
    """座標所在（中心點 5 km 加上等面積圓半徑的 1.5 倍以內，最近的）GHSL 城市的 (中文, 英文)"""
    global _UCDB
    if _UCDB is None:
        _UCDB = _ucdb_cities()
    best, best_d = None, None
    for lon, lat, radius, zh, en in _UCDB:
        if abs(lon - coord[0]) > 1 or abs(lat - coord[1]) > 1:
            continue
        d = _distance_m(coord, (lon, lat)) / 1000
        if d <= 5 + 1.5 * radius and (best_d is None or d < best_d):
            best, best_d = (zh, en), d
    return best


def _sanity(rows: list[dict], log: list[str]) -> None:
    """高度超過 830 m（比哈里發塔高）的不算；樓層數跟高度對不上的印出來（逐一看過的寫在 HEIGHT_FIXES、EXCLUDE）"""
    for r in rows:
        f = r["floors"]
        if r["h"] > 830:
            log.append(f"高度 {r['h']} m 超過哈里發塔，不算：{r['qid']} {r['en']}（{f} 層）")
            r["bad"] = True
        elif f and f >= 10 and r["qid"] not in HEIGHT_FIXES and r["qid"] not in CHECKED:
            per = r["h"] / f
            if per > 7 or per < 2.6:
                log.append(f"每層 {per:.1f} m，要看一下：{r['qid']} {r['en']} {r['h']} m {f} 層 {r['year']}（{r['iso3']}）")


def build() -> None:
    log: list[str] = []
    cand = wb.candidates()
    chosen = {q for q, cs in cand.items() if cs & set(BUILDING_CLASSES)} | set(KEEP)
    ents = wb.entities(sorted(chosen), "skyscrapers-entities")
    print(f"  候選 {len(cand)} 個項目，P31 有建築類別的（加上 KEEP）{len(chosen)} 個（取得 {len(ents)} 個）")

    rows = []
    reasons = Counter()
    for qid, e in ents.items():
        classes = set(_ids(e, "P31"))
        if qid in EXCLUDE:
            reasons["EXCLUDE"] += 1
            continue
        if qid not in KEEP and classes & set(NOT_BUILDINGS) and not classes & SKYSCRAPER_CLASSES:
            reasons["不是建築"] += 1
            continue
        h, kind = _height(e, log)
        if qid in HEIGHT_FIXES:
            h, kind = HEIGHT_FIXES[qid][0], "fix"
        if h is None or h < THRESHOLDS[0]:
            reasons["不到 150 m"] += 1
            continue
        status, year, gone, how = _status(e, classes)
        zh, en = wb.names(e)
        rows.append({
            "qid": qid, "e": e, "classes": classes, "h": h, "kind": kind, "status": status, "year": year, "gone": gone,
            "how": how, "zh": zh, "en": en, "floors": FLOOR_FIXES.get(qid, (_floors(e),))[0], "coord": _coord(e),
            "twin": "Q118896406" in classes and not [p for p in _ids(e, "P527")],
        })
    print(f"  150 m 以上的建築 {len(rows)} 個；排除：{dict(reasons)}")
    print("  狀態：", dict(Counter(r["status"] for r in rows)))
    print("  高度的依據：", dict(Counter(r["kind"] for r in rows)))
    print("  完工年的依據：", dict(Counter(r["how"] for r in rows if r["status"] in ("standing", "demolished"))))

    built = [r for r in rows if r["status"] in ("standing", "demolished")]
    built = _dedupe(built, log)
    # 雙塔：P31 是 twin towers、各棟沒有另外的項目（或有但不在清單裡）的算 2 棟
    in_list = {r["qid"] for r in built}
    for r in built:
        parts = [p for p in _ids(r["e"], "P527") if p in in_list]
        r["twin"] = r["qid"] in TWIN_FIXES or ("Q118896406" in r["classes"] and not parts)
    _cities(built, log)
    _countries(built, log)
    _sanity(built, log)
    built = [r for r in built if not r.get("bad")]
    for line in log:
        print("  " + line)
    no_coord = [r for r in built if not r["coord"]]
    print(f"  完工的 {len(built)} 棟（現在還在的 {sum(r['status'] == 'standing' for r in built)} 棟）；沒有座標的 {len(no_coord)} 棟"
          f"（只算進國家，不畫點）；沒有國家的：{[r['qid'] for r in built if not r['iso3']]}")

    with open(CACHE_DEBUG, "w", encoding="utf-8") as f:
        json.dump({
            "all": [{k: v for k, v in r.items() if k not in ("e", "classes")} | {"classes": sorted(r["classes"])} for r in rows],
            "built": [{k: v for k, v in r.items() if k not in ("e", "classes")} for r in built],
        }, f, ensure_ascii=False)
    _write(built, rows)


def _standing(r: dict, year: int) -> bool:
    """這一年還在：完工年不晚於這一年，而且沒有拆除、或拆除的年份在這一年以後"""
    return r["year"] <= year and (r["gone"] is None or r["gone"] > year)


def _weight(r: dict) -> int:
    return 2 if r["twin"] else 1


def _write(built: list[dict], rows: list[dict]) -> None:
    years = list(range(FIRST_YEAR, LAST_YEAR + 1))
    with open(OUT_DIR / "countries.json", encoding="utf-8") as f:
        units = sorted(json.load(f))
    unknown = sorted({r["iso3"] for r in built if r["iso3"] not in units})
    if unknown:
        raise RuntimeError(f"建築的國家不在 countries.json 裡：{unknown}")
    by_country: dict[str, list[dict]] = defaultdict(list)
    for r in built:
        by_country[r["iso3"]].append(r)

    def count(rs: list[dict], t: int, year: int) -> int:
        return sum(_weight(r) for r in rs if r["h"] >= t and _standing(r, year))

    undated = [r for r in rows if r["status"] == "no-year" and r["qid"] not in EXCLUDE]
    coords = [r for r in undated if r["coord"]]
    for r, iso in zip(coords, geoindex.countries_at([r["coord"][0] for r in coords], [r["coord"][1] for r in coords])):
        r["iso3"] = iso
    undated_tw = sum(1 for r in undated if r.get("iso3") == "TWN")
    notes = {"TWN": TAIWAN_NOTE.format(n=undated_tw)}
    notes_en = {"TWN": TAIWAN_NOTE_EN.format(n=undated_tw)}

    # ── 300 m 以上的棟數（每一年還在的）：沒有的國家是 0 ──
    values = {iso: [count(by_country.get(iso, []), COUNT_THRESHOLD, y) for y in years] for iso in units}
    world = [count(built, COUNT_THRESHOLD, y) for y in years]
    write_json(OUT / "supertall.json", indicator_file(
        "supertall", "棟", years, values, aggregates={"WLD": world}, notes=notes, notesEn=notes_en,
    ))

    # ── 最高建築的高度：沒有 150 m 以上的國家沒有值 ──
    tallest = {}
    for iso, rs in by_country.items():
        series = [max((r["h"] for r in rs if _standing(r, y)), default=None) for y in years]
        if any(v is not None for v in series):
            tallest[iso] = series
    world_tallest = [max((r["h"] for r in built if _standing(r, y)), default=None) for y in years]
    write_json(OUT / "tallest.json", indicator_file(
        "tallest", "m", years, tallest, aggregates={"WLD": world_tallest}, notes=notes, notesEn=notes_en,
    ))

    # ── 每一棟（點與側欄）：依完工年排，沒有座標的經緯度是 null（只在側欄） ──
    ordered = sorted(built, key=lambda r: (r["year"], -r["h"], r["qid"]))

    def city(r: dict, i: int) -> str | None:
        return (r["city"] or (None, None))[i]

    out_rows = [{
        "lon": r["coord"][0] if r["coord"] else None, "lat": r["coord"][1] if r["coord"] else None,
        "h": r["h"], "fl": r["floors"], "y": r["year"], "d": r["gone"], "n": 2 if r["twin"] else None, "iso3": r["iso3"],
        "name": r["en"] or r["zh"], "zh": r["zh"] if r["zh"] and r["zh"] != r["en"] else None,
        "city": city(r, 1) or city(r, 0), "cityZh": city(r, 0) if city(r, 0) != city(r, 1) else None,
        "q": int(r["qid"][1:]),
    } for r in ordered]
    write_json(OUT / "buildings.json", points_file(
        out_rows, ["lon", "lat", "h", "fl", "y", "d", "n", "iso3", "name", "zh", "city", "cityZh", "q"],
        {"lon": 0.001, "lat": 0.001, "h": 0.1, "fl": 1, "y": 1, "d": 1, "n": 1, "q": 1}, delta=("y",),
    ))

    # ── 沒有完工年份的（側欄列出，不算進棟數）：[QID 數字, 名稱, 中文名稱, 高度, 國家] ──
    undated_rows = sorted(
        ([int(r["qid"][1:]), r["en"] or r["zh"], r["zh"] if r["zh"] != r["en"] else None, r["h"], r.get("iso3")]
         for r in undated if r.get("iso3")),
        key=lambda x: (x[4], -x[3]),
    )
    write_json(OUT / "undated.json", undated_rows)

    # ── 摘要與涵蓋率（CTBUH 的總數只拿來對照） ──
    def standing_count(t: int, year: int, isos: set[str] | None = None) -> int:
        return sum(_weight(r) for r in built if r["h"] >= t and _standing(r, year) and (isos is None or r["iso3"] in isos))

    checks = [
        {"what": "world-200", "year": 2025, "ctbuh": CTBUH["world-200"], "wikidata": standing_count(200, 2025)},
        {"what": "world-300", "year": 2025, "ctbuh": CTBUH["world-300"], "wikidata": standing_count(300, 2025)},
        {"what": "china-200", "year": 2025, "ctbuh": CTBUH["china-200"], "wikidata": standing_count(200, 2025, {"CHN"}),
         "withHkMo": standing_count(200, 2025, {"CHN", "HKG", "MAC"})},
    ]
    for c in checks:
        c["coverage"] = round(c["wikidata"] / c["ctbuh"], 3)
        print(f"  涵蓋率 {c['what']}：Wikidata {c['wikidata']} ／ CTBUH {c['ctbuh']} = {c['coverage']:.0%}")
    print(f"  中國含港澳 200 m 以上：{checks[2]['withHkMo']}")
    check_topic(checks)
    write_json(OUT / "manifest.json", {
        "generatedAt": now_iso(),
        "dataDate": wb.fetched_date(),
        "buildings": len(built),
        "standing": {t: standing_count(t, LAST_YEAR) for t in (150, 200, 300, 600)},
        "status": dict(Counter(r["status"] for r in rows)),
        "undated": len(undated_rows),
        "coverage": checks,
        "ctbuhSource": CTBUH_URL,
        "fixes": {"exclude": len(EXCLUDE), "height": len(HEIGHT_FIXES), "year": len(YEAR_FIXES), "duplicates": len(DUPLICATES)},
    })
    tw = sorted(by_country.get("TWN", []), key=lambda r: -r["h"])
    print("  台灣：" + "、".join(f"{r['zh'] or r['en']} {r['h']:g} m（{r['year']}）" for r in tw[:6])
          + f"；150 m 以上 {count(tw, 150, LAST_YEAR)} 棟、沒有完工年份的 {undated_tw} 棟")


COUNT_THRESHOLD = 300
# CTBUH（Skyscraper Center 的頁面標題現在寫 CVU）的「2026 Trends & Forecasts」（2026-02-09）寫的 2025 年底的總數：
# 200 m 以上 2,596 棟、300 m 以上 258 棟、其中中國 1,361 棟（200 m 以上）。只拿來對照涵蓋率，沒有轉載資料庫。
CTBUH = {"world-200": 2596, "world-300": 258, "china-200": 1361}
CTBUH_URL = "https://www.skyscrapercenter.com/trends-and-forecasts/2026"

TAIWAN_NOTE = (
    "台北 101（508 m）2004 年底完工，到 2010 年杜拜的哈里發塔完工以前是世界最高的建築；高雄 85 大樓（347.5 m）1997 年完工，"
    "是台灣第二高。Wikidata 另外有 {n} 棟台灣 150 m 以上的大樓沒有完工年份（例如臺中商銀總行大樓），不算。"
)
TAIWAN_NOTE_EN = (
    "Taipei 101 (508 m), completed at the end of 2004, was the world's tallest building until the Burj Khalifa in Dubai was "
    "completed in 2010; the 85 Sky Tower in Kaohsiung (347.5 m, 1997) is Taiwan's second tallest. Wikidata lists another {n} "
    "Taiwanese buildings of 150 m or more without a completion year (such as the Taichung Commercial Bank headquarters); "
    "they are not counted."
)


def check_topic(checks: list[dict]) -> None:
    """src/topics/skyscrapers.ts 寫的涵蓋率要跟這裡算的一樣（四捨五入到整數百分比）"""
    text = (ROOT / "src" / "topics" / "skyscrapers.ts").read_text(encoding="utf-8")
    for c in checks:
        name = "COVERAGE_" + c["what"].upper().replace("-", "_")
        found = re.search(rf"export const {name} = (\d+);", text)
        want = round(c["coverage"] * 100)
        if not found or int(found.group(1)) != want:
            raise ValueError(f"src/topics/skyscrapers.ts 的 {name} 要改成 {want}（現在是 {found.group(1) if found else '沒有'}）")


