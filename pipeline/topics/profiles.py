"""國家小檔案主題：點國家看一張小檔案（首都、元首、政府首長、政體、貨幣、區號、網域、ISO 代碼、國歌、成立時間、人口、面積、
陸地鄰國、主權國），地圖上畫政體形式、貨幣、鄰國數、內陸國（單一快照，前端 timeless）。

資料：
- Wikidata（sources/wikidata_profiles.py，CC0）：首都、元首與政府首長（含職稱、起始日期）、政體（P122，只當參考，見下面）、
  貨幣（含 ISO 4217 代碼）、國際電話區號、網域、ISO 3166-1 代碼、國歌、成立時間（P571）、所屬國家（P17，核對屬地表）。
  名稱：中文依 zh-tw、zh-hant、zh-hk，都沒有時用 languagefallback 的 zh-tw（伺服器端的繁簡轉換，跟諾貝爾獎、城市主題一樣），
  再沒有就用英文；國名一律用網站自己的（前端的 Intl.DisplayNames），不用 Wikidata 的。
- 鄰國數與內陸國：用網站自己的國界（geo/countries-50m.json，Natural Earth 1:50m）算，不用 Wikidata 的 P47（會混進海上鄰國）。
  TopoJSON 的國界線段（arc）兩個國家共用的就是陸地國界；只屬於一個國家的是海岸線（裏海的岸線不算，見 CASPIAN）。
- 人口：人口主題的 WPP 2024（public/data/topics/population/total.json 的 2026 年，推估值）。
- 陸地面積：FAOSTAT 土地利用（sources/faostat.py 的 RL，CC BY 4.0，不含內陸水域，跟海洋與漁業主題一樣）。
- 其他主題的一句話（側欄的「其他主題」）：直接讀那些主題已經產生的資料檔（public/data/topics/<主題>/），不重算：
  旅行實用的行車方向與時差、語言的主要官方語言、民主與自由的政體分類（V-Dem）、城市的最大城市、海拔的最高點、
  國際組織的參加數、台灣的外交的邦交國。那些主題重跑後這裡也要重跑。

政體形式（地圖的預設指標）是依各國憲法（或過渡時期的憲政文件）規定的形式：元首怎麼產生、政府對誰負責，
不是民主程度（民主程度見民主與自由主題，V-Dem 的評分）。Wikidata 的 P122 很不一致（同一國列了好幾個、互相矛盾，
或只寫「共和制」），所以：先把 P122 的值對到類別（P122_CATEGORY），只有一個類別時採用；沒有或有好幾個時，
GOVERNMENT_OVERRIDES 逐國指定，每一國寫理由。建置時印出每一個跟 Wikidata 不同的國家，沒有寫理由的會報錯。

爭議地區（科索沃、巴勒斯坦、西撒哈拉、北賽普勒斯、索馬利蘭、錫亞琴冰川）與地位有爭議的首都（耶路撒冷、東耶路撒冷）
照事實中立陳述，不替任何一方下判斷：說明文字寫在 src/topics/profiles.ts（STATUS、CAPITAL_NOTES），這裡只輸出事實欄位。

輸出（public/data/topics/profiles/）：government.json、currency.json、neighbours.json、landlocked.json（指標檔，2026 年一年）、
profiles.json（側欄的小檔案）、capitals.json（首都的點）、manifest.json。
"""
from __future__ import annotations

import json
import math
import re
from collections import defaultdict

from common import OUT_DIR, indicator_file, now_iso, points_file, write_json
from sources import faostat, wikidata_profiles

OUT = OUT_DIR / "topics" / "profiles"
DATA = OUT_DIR / "topics"
YEAR = 2026
SHAPELESS = ("TUV", "TKL", "GIB")  # 地圖上沒有形狀、只畫圓點的國家（WorldMap.tsx 的 SHAPELESS）
WIKI_ISO = {"XKX": "XKS"}  # 地圖代碼 → Wikidata 的 P298（科索沃在 Wikidata 是 XKS）
NO_PROFILE = {"ATA", "_SIA"}  # 南極洲、錫亞琴冰川：沒有政府，前端用 STATUS 說明

# ── 屬地：主權國與關係（src/topics/profiles.ts 的 RELATIONS）。Wikidata 的 P17 只拿來核對 ──────────
TERRITORIES = {
    **{iso: ("NLD", "nl") for iso in ("ABW", "CUW", "SXM")},  # 荷蘭王國的構成國
    **{iso: ("GBR", "uk-ot") for iso in ("AIA", "BMU", "CYM", "FLK", "GIB", "IOT", "MSR", "PCN", "SGS", "SHN", "TCA", "VGB")},
    **{iso: ("GBR", "uk-cd") for iso in ("GGY", "IMN", "JEY")},  # 英國皇家屬地
    "ALA": ("FIN", "fi"),
    **{iso: ("USA", "us") for iso in ("ASM", "GUM", "MNP", "PRI", "VIR")},
    **{iso: ("FRA", "fr") for iso in ("ATF", "BLM", "MAF", "NCL", "PYF", "SPM", "WLF")},
    **{iso: ("NZL", "nz-assoc") for iso in ("COK", "NIU")},  # 與紐西蘭自由聯合
    "TKL": ("NZL", "nz"),
    **{iso: ("DNK", "dk") for iso in ("FRO", "GRL")},
    **{iso: ("CHN", "cn-sar") for iso in ("HKG", "MAC")},
    **{iso: ("AUS", "au") for iso in ("HMD", "NFK", "_IOT")},
}
# Wikidata 的 P17 指到「王國」這種沒有 ISO 代碼的項目：荷蘭王國的 NLD 就是 Q29999，丹麥王國（Q756617）對到丹麥
KINGDOMS = {"Q756617": "DNK"}

# ── 政體形式（src/topics/profiles.ts 的 GOVERNMENT） ───────────────────────────
PRES, SEMI, PARL_REP, PARL_MON, SEMI_MON, ABS_MON, ONE_PARTY, TERRITORY = 1, 2, 3, 4, 5, 6, 7, 8
OTHER = 9  # 軍政府、過渡政府、神權、委員會制（前端的 other）

# Wikidata P122 的值 → 類別。共和制、單一制、聯邦制、民主制、人民共和國這類不分元首與政府關係的值不對
P122_CATEGORY = {
    "Q49892": PRES, "Q4446300": PRES,  # 總統制、超級總統制
    "Q49890": SEMI, "Q16711032": SEMI,  # 半總統制、議會－總統制
    "Q4198907": PARL_REP, "Q5440547": PARL_REP,  # 議會共和制、聯邦議會共和制
    "Q166747": "parl", "Q3043547": "parl", "Q720477": "parl",  # 議會制、議會民主制、西敏制（共和或君主看另一個值）
    "Q3330103": PARL_MON, "Q138771333": PARL_MON, "Q20105434": PARL_MON,  # 議會制君主立憲、聯邦議會君主制、議會制共治公國
    "Q41614": PARL_MON,  # 君主立憲制：預設議會制，君主有實權的在 GOVERNMENT_OVERRIDES 改
    "Q184558": ABS_MON,
    "Q50686": ONE_PARTY, "Q117405807": ONE_PARTY,  # 一黨制、共產黨獨裁
    "Q25424534": OTHER, "Q59281": OTHER,  # 軍政府、臨時政府
    "Q138567551": "theo", "Q44405": "theo", "Q12774933": "theo",  # 伊斯蘭神權、神權、教宗制
    "Q2523556": "theo",  # 委員會制
}
MONARCHY_QIDS = {"Q41614", "Q3330103", "Q138771333", "Q20105434", "Q184558", "Q7269", "Q849242", "Q3208952", "Q584683"}
# 同時對到好幾個類別時，這幾個優先：軍政府、過渡政府最優先，其次一黨制、絕對君主制，再來是神權與委員會制
# （沙烏地阿拉伯同時列了絕對君主制與伊斯蘭神權，算絕對君主制；伊朗列了伊斯蘭神權與總統制，算其他）
P122_PRIORITY = [OTHER, ONE_PARTY, ABS_MON, "theo"]

# Wikidata 沒有、對不到唯一類別、或對到的不對時，逐國指定：(類別, 理由)。理由是給維護的人看的（不輸出）。
GOVERNMENT_OVERRIDES: dict[str, tuple[int, str]] = {
    # 總統制：總統由人民直選，同時是國家元首與政府首長（有總理的，總理由總統任免、對總統負責）
    "ARG": (PRES, "P122 只有聯邦共和國"), "BEN": (PRES, "P122 只有共和制"), "CHL": (PRES, "P122 只有民主共和國"), "COL": (PRES, "P122 只有共和制"),
    "CIV": (PRES, "P122 只有共和制；總理由總統任免"), "CMR": (PRES, "P122 只有共和制；總理由總統任免"),
    "COM": (PRES, "P122 只有聯邦共和國"), "CRI": (PRES, "P122 沒有值"), "DJI": (PRES, "P122 沒有值；總統是政府首長，總理由總統任命"),
    "DOM": (PRES, "P122 沒有值"), "GHA": (PRES, "P122 只有民主制"), "GMB": (PRES, "P122 只有共和制"),
    "GNQ": (PRES, "P122 沒有值；總理由總統任免"), "HND": (PRES, "P122 沒有值"), "KEN": (PRES, "P122 沒有值"),
    "MDV": (PRES, "P122 沒有值"), "MOZ": (PRES, "P122 沒有值；總理由總統任免"), "MWI": (PRES, "P122 沒有值"),
    "NAM": (PRES, "P122 沒有值；總統是政府首長"), "NGA": (PRES, "P122 只有聯邦共和國"), "NIC": (PRES, "P122 只有共和制"),
    "PHL": (PRES, "P122 只有共和制"), "PLW": (PRES, "P122 沒有值"), "PRY": (PRES, "P122 沒有值"), "SYC": (PRES, "P122 沒有值"),
    "TCD": (PRES, "P122 沒有值；2023 年新憲法"), "TZA": (PRES, "P122 沒有值；總理由總統任命"), "ZWE": (PRES, "P122 沒有值"),
    "BOL": (PRES, "P122 寫議會共和制，不對：總統直選並兼任政府首長"),
    "COG": (PRES, "P122 寫議會共和制；2015 年憲法恢復總理，但由總統任免，總統主導政府"),
    "KGZ": (PRES, "P122 寫議會共和制，是 2021 年修憲以前的；2021 年新憲法改成總統制"),
    "TUN": (PRES, "P122 同時有議會共和制、半總統制、總統制；2022 年新憲法是總統制"),
    "SSD": (PRES, "P122 只有聯邦共和國；過渡時期的總統制"),
    "GIN": (PRES, "P122 只有共和制；2021 年政變後，2025 年公投通過新憲法、12 月選出總統"),
    "_SOL": (PRES, "Wikidata 沒有（沒有 ISO 代碼）；索馬利蘭的憲法是總統制"),
    # 半總統制：總統由人民直選並有實權，總理領導的政府對國會負責
    "CAF": (SEMI, "P122 沒有值"), "COD": (SEMI, "P122 只有共和制"), "EGY": (SEMI, "P122 只有共和制"),
    "PRT": (SEMI, "P122 只有共和制"), "STP": (SEMI, "P122 沒有值"), "LKA": (SEMI, "P122 只有共和制"),
    "SEN": (SEMI, "P122 寫總統制；2021 年恢復總理，政府對國民議會負責"),
    "LTU": (SEMI, "P122 同時有議會共和制與半總統制；總統直選，主導外交與國防"),
    "POL": (SEMI, "P122 同時有半總統制與議會制；總統直選、有否決權，政府對眾議院負責"),
    "PSE": (SEMI, "P122 同時有議會共和制與半總統制；依《基本法》總統直選、總理與內閣對立法會負責（2006 年以後沒有再改選）"),
    "RUS": (SEMI, "P122 偏好值是超級總統制、另有總統制與半總統制；形式上總理的任命要國家杜馬同意、政府可被不信任，"
                  "是半總統制（超級總統制描述的是權力集中在總統）"),
    # 議會制共和國：政府對國會負責；總統由國會選出、兼任政府首長的也在這一類（側欄與 tooltip 寫明）
    "AUT": (PARL_REP, "P122 同時有半總統制與聯邦議會共和制；總統直選但不主導政府，照一般的分類算議會制"),
    "DMA": (PARL_REP, "P122 沒有值"), "ETH": (PARL_REP, "P122 只有聯邦共和國"), "FJI": (PARL_REP, "P122 沒有值"),
    "FSM": (PARL_REP, "P122 只有聯邦共和國；總統由國會選出"), "HRV": (PARL_REP, "P122 只有共和制"),
    "IRQ": (PARL_REP, "P122 只有聯邦共和國"), "KIR": (PARL_REP, "P122 沒有值；總統要有國會的信任"),
    "MHL": (PARL_REP, "P122 沒有值；總統由國會選出"), "MNE": (PARL_REP, "P122 只有共和制"),
    "NPL": (PARL_REP, "P122 有聯邦共和國與人民共和國"), "NRU": (PARL_REP, "P122 沒有值；總統由國會選出"),
    "SOM": (PARL_REP, "P122 只有聯邦共和國；總統由國會選出"), "SUR": (PARL_REP, "P122 只有共和制；總統由國會選出"),
    "SVN": (PARL_REP, "P122 只有民主共和國"), "TGO": (PARL_REP, "P122 沒有值；2024 年新憲法改成議會制"),
    "VUT": (PARL_REP, "P122 沒有值"), "WSM": (PARL_REP, "P122 沒有值"),
    # 議會制君主立憲：國王是虛位元首（大英國協王國也在這一類）
    "GRD": (PARL_MON, "P122 沒有值"), "JAM": (PARL_MON, "P122 沒有值"), "PNG": (PARL_MON, "P122 沒有值"),
    "SLB": (PARL_MON, "P122 沒有值"), "TUV": (PARL_MON, "P122 沒有值"),
    # 君主握有實權的君主立憲：有憲法與民選國會，但君主任免政府、可否決法律或解散國會
    "BHR": (SEMI_MON, "P122 只有君主立憲制；國王任命內閣與上議院"), "JOR": (SEMI_MON, "P122 沒有值；國王任免首相、可解散國會"),
    "KWT": (SEMI_MON, "P122 只有君主立憲制；埃米爾任命首相，2024 年 5 月起暫停國會"),
    "LIE": (SEMI_MON, "P122 只有君主立憲制；親王可否決法律、解散國會"), "MAR": (SEMI_MON, "P122 只有君主立憲制；國王主導外交、國防與宗教事務"),
    "MCO": (SEMI_MON, "P122 只有君主立憲制；親王握有行政權"), "TON": (SEMI_MON, "P122 沒有值；國王可否決法律、任命法官"),
    # 絕對君主制
    "QAT": (ABS_MON, "P122 寫君主立憲制；埃米爾握有行政權，協商會議 2024 年修憲後全部由埃米爾任命"),
    "VAT": (ABS_MON, "P122 有教宗制、神權、君主立憲制；依《梵蒂岡城國基本法》教宗握有完整的立法、行政、司法權，是選任的絕對君主"),
    # 一黨制：憲法明定一個政黨的領導地位，或只有一個合法政黨
    "CUB": (ONE_PARTY, "P122 只有單一制；憲法明定古巴共產黨是社會與國家的最高領導力量"),
    "ERI": (ONE_PARTY, "P122 沒有值；人民民主與正義陣線是唯一的合法政黨，1997 年的憲法沒有施行"),
    # 其他：軍政府、過渡政府、神權
    "GNB": (OTHER, "P122 沒有值；2025 年 11 月政變後由軍方過渡"), "HTI": (OTHER, "P122 沒有值；2021 年起沒有民選總統，過渡政府"),
    "LBY": (OTHER, "P122 只有共和制；東西兩個政府對立，過渡時期"), "MDG": (OTHER, "P122 只有共和制；2025 年 10 月軍方接管"),
    "MLI": (OTHER, "P122 沒有值；軍政府"), "NER": (OTHER, "P122 沒有值；軍政府"),
    "MMR": (OTHER, "P122 只有共和制；2021 年政變後由軍方掌權，2025–2026 年在軍方主導下選舉"),
    "SDN": (OTHER, "P122 只有聯邦共和國；軍方主導的過渡時期、內戰"),
    "YEM": (OTHER, "P122 有共和制與總統制；內戰，2022 年起由總統領導委員會領導"),
}
# 跟 Wikidata 一樣、不必改的國家不列。屬地一律是 TERRITORY。

# tooltip 第三行的短註（政體的補充）
GOVERNMENT_HINTS = {
    "BWA": ("總統由國會選出，兼任政府首長", "President elected by parliament; also heads the government"),
    "ZAF": ("總統由國會選出，兼任政府首長", "President elected by parliament; also heads the government"),
    "NRU": ("總統由國會選出，兼任政府首長", "President elected by parliament; also heads the government"),
    "MHL": ("總統由國會選出，兼任政府首長", "President elected by parliament; also heads the government"),
    "FSM": ("總統由國會選出，兼任政府首長", "President elected by parliament; also heads the government"),
    "SUR": ("總統由國會選出，兼任政府首長", "President elected by parliament; also heads the government"),
    "SOM": ("總統由國會選出", "President elected by parliament"),
    "KIR": ("總統直選，但要有國會的信任", "President directly elected but must keep parliament's confidence"),
    "GUY": ("總統兼任政府首長，政府對國會負責", "The president heads the government, which answers to parliament"),
    "BIH": ("三人的主席團擔任國家元首", "A three-member presidency is the head of state"),
    "SMR": ("兩位執政官每半年改選，共同擔任國家元首", "Two captains regent, elected every six months, are joint heads of state"),
    "CHE": ("委員會制：七人的聯邦委員會集體擔任國家元首與政府", "Directorial system: the seven-member Federal Council is collectively head of state and government"),
    "AND": ("兩位大公：法國總統與烏赫爾主教", "Two co-princes: the President of France and the Bishop of Urgell"),
    "MYS": ("最高元首由九州的世襲統治者輪流選出", "The king is elected in rotation by the nine hereditary state rulers"),
    "ARE": ("七個酋長國的世襲統治者組成聯邦最高委員會", "The hereditary rulers of the seven emirates form the Federal Supreme Council"),
    "VAT": ("教宗是國家元首，由樞機主教選出", "The pope, elected by the cardinals, is head of state"),
    "KWT": ("國會 2024 年 5 月起暫停", "Parliament suspended since May 2024"),
    "IRN": ("伊斯蘭共和國：宗教領袖擔任最高領袖（國家元首）", "Islamic republic: a cleric is Supreme Leader (head of state)"),
    "AFG": ("伊斯蘭酋長國：塔利班 2021 年起掌權，沒有憲法", "Islamic Emirate: Taliban rule since 2021, without a constitution"),
    "CHN": ("憲法明定中國共產黨的領導", "The constitution enshrines the leadership of the Communist Party"),
    "VNM": ("憲法明定越南共產黨的領導", "The constitution enshrines the leadership of the Communist Party"),
    "LAO": ("憲法明定寮國人民革命黨的領導", "The constitution enshrines the leadership of the Lao People's Revolutionary Party"),
    "CUB": ("憲法明定古巴共產黨的領導", "The constitution enshrines the leadership of the Communist Party"),
    "PRK": ("憲法明定朝鮮勞動黨的領導", "The constitution enshrines the leadership of the Workers' Party of Korea"),
    "ERI": ("唯一的合法政黨是人民民主與正義陣線", "The People's Front for Democracy and Justice is the only legal party"),
    "BFA": ("2022 年政變後的軍政府", "Military government since the 2022 coups"),
    "MLI": ("2020、2021 年政變後的軍政府", "Military government since the 2020 and 2021 coups"),
    "NER": ("2023 年政變後的軍政府", "Military government since the 2023 coup"),
    "GNB": ("2025 年 11 月政變後的過渡政府", "Transitional government since the November 2025 coup"),
    "MDG": ("2025 年 10 月軍方接管後的過渡政府", "Transitional government since the military takeover of October 2025"),
    "MMR": ("2021 年政變後由軍方掌權", "Military-led since the 2021 coup"),
    "SDN": ("軍方主導的過渡時期，2023 年起內戰", "Military-led transition; civil war since 2023"),
    "SYR": ("2024 年 12 月起的過渡政府", "Transitional government since December 2024"),
    "LBY": ("東西兩個政府對立", "Rival governments in the east and west"),
    "HTI": ("2021 年起沒有民選總統，過渡政府", "No elected president since 2021; transitional government"),
    "YEM": ("內戰；總統領導委員會（2022 年起）", "Civil war; Presidential Leadership Council since 2022"),
    "RUS": ("總統權力很大（常被稱為超級總統制）", "Power is concentrated in the presidency (often called super-presidential)"),
}

# ── 首都 ─────────────────────────────────────
# Wikidata 首都陳述的限定詞（P518 適用的部分、P3831 角色、P5102 陳述的性質）→ 角色代碼（src/topics/profiles.ts 的 CAPITAL_ROLES）
CAPITAL_ROLES = {
    "Q35798": "exec", "Q11204": "leg", "Q105985": "jud", "Q1901835": "seat",
    "Q132555": "dejure", "Q712144": "defacto", "Q29509080": "unofficial",
}
# Wikidata 沒有列、但政府所在地跟首都不同的（政府所在地的 QID、角色、經緯度）。地點是 Wikidata 的項目，名稱另外查
CAPITAL_EXTRA = {
    "NLD": [("Q36600", "seat", 4.31, 52.08)],  # 海牙：國會、政府與王室辦公處（憲法規定的首都是阿姆斯特丹）
    "CIV": [("Q1515", "seat", -4.03, 5.32)],  # 阿必尚：多數政府機關（法定首都雅穆索戈）
    "CHL": [("Q33986", "leg", -71.62, -33.05)],  # 瓦爾帕萊索：國會
}
# Wikidata 有列、但沒有寫角色的
CAPITAL_ROLE_OVERRIDES = {
    ("MYS", "Q182378"): "admin",  # 布城：聯邦行政中心
    ("MSR", "Q30990"): "dejure", ("MSR", "Q31006"): "defacto",  # 蒙哲臘：普利茅斯 1997 年火山爆發後廢棄，政府在布萊茲
    ("PSE", "Q212938"): "claimed",  # 東耶路撒冷：Wikidata 寫「de jure」，這裡寫「宣告的首都」（由以色列控制，見 profiles.ts 的 CAPITAL_NOTES）
}

# ── 元首與政府首長 ──────────────────────────────
# 職稱的中文名稱：Wikidata 沒有中文、名稱是「…列表」、國名用的不是台灣的譯名、或名稱錯的（2026-10 實際出現的）
OFFICE_NAMES = {
    "Q26869636": ("安地卡及巴布達君主", None), "Q26869642": ("巴哈馬君主", None), "Q34517433": ("貝里斯君主", None),
    "Q14931511": ("加拿大君主", None), "Q14931517": ("紐西蘭君主", None), "Q26869646": ("格瑞那達君主", None),
    "Q26869648": ("牙買加君主", None), "Q14625123": ("約旦國王", None), "Q26869650": ("聖克里斯多福及尼維斯君主", None),
    "Q102181806": ("總統委員會主席", None), "Q34517722": ("聖露西亞君主", None), "Q113956811": ("盧森堡大公", None),
    "Q14566719": ("摩洛哥國王", None), "Q2045066": ("荷蘭國王", None), "Q28478447": ("阿曼蘇丹", None),
    "Q34518124": ("巴布亞紐幾內亞君主", None), "Q12374379": ("盧安達總統", None), "Q34518009": ("索羅門群島君主", None),
    "Q19058289": ("聖多美普林西比總統", None), "Q26869653": ("聖文森及格瑞那丁君主", None),
    "Q30133416": ("密克羅尼西亞聯邦總統", None), "Q19808790": ("烏赫爾主教（安道爾大公）", None),
    "Q19808845": ("法國總統（安道爾大公）", "French Co-Prince of Andorra"), "Q34517851": ("吐瓦魯君主", None),
    "Q30101519": ("阿拉伯聯合大公國總理", None), "Q56611785": ("百慕達總理", None), "Q30101451": ("剛果共和國總理", None),
    "Q30100591": ("吉布地總理", None), "Q30100613": ("格瑞那達總理", None), "Q14917303": ("幾內亞總理", None),
    "Q30101336": ("聖克里斯多福及尼維斯總理", None), "Q30101433": ("聖露西亞總理", None), "Q62396915": ("列支敦斯登總理", None),
    "Q30100629": ("莫三比克總理", None), "Q24188609": ("皮特肯群島市長", None), "Q20530301": ("千里達及托巴哥總理", None),
    "Q119804": ("英屬維京群島總理", None), "Q62612342": ("直布羅陀副首席部長", None),
    # 名稱是列表、或國名不是台灣的譯名
    "Q955006": ("阿拉伯聯合大公國總統", None), "Q7241291": ("坦尚尼亞總統", None), "Q946064": ("亞塞拜然總理", None),
    "Q213107": ("比利時首相", None), "Q663871": ("不丹總理", None), "Q738695": ("芬蘭總理", None), "Q45758": ("斯洛維尼亞總理", None),
    "Q1000921": ("法羅群島總理", None), "Q1999325": ("柬埔寨首相", None), "Q4970706": ("德國聯邦總理", None),
    "Q18985034": ("尚比亞總統", None), "Q14911897": ("突尼西亞總統", None), "Q47006779": ("馬利總統", None),
    "Q30100640": ("馬利總理", None), "Q42298576": ("東加君主", None), "Q915636": ("東加首相", None),
    "Q2672728": ("迦納總統", None), "Q2407810": ("貝南總統", None), "Q152814": ("馬爾他總理", None),
    "Q596123": ("孟加拉總統", None), "Q14565638": ("孟加拉總理", None), "Q11755916": ("印尼總統", None),
    "Q772727": ("蒙哲臘總督", None), "Q3245464": ("蒙哲臘總理", None), "Q3401756": ("土克斯及開科斯群島總理", None),
    "Q15921529": ("馬拉威總統", None), "Q1155759": ("土庫曼總統", None), "Q56876342": ("北韓最高領導人", None),
    "Q2457774": ("摩納哥親王", None), "Q258045": ("聖馬利諾執政官", None),
    # 名稱錯的：克羅埃西亞總統與總理的中文名稱是南斯拉夫時期的職稱
    "Q268984": ("克羅埃西亞總統", None), "Q1195270": ("克羅埃西亞總理", None),
    # 英文名稱被改壞的（2026-10）
    "Q841760": (None, "President of Cyprus"), "Q878256": (None, "President of Yemen"),
}
# 人名、地名被改壞的（2026-10 實際出現的）
LABEL_FIXES = {
    "Q5441662": (None, "Feleti Teo"),  # 吐瓦魯總理費萊蒂·泰奧：英文名稱被改成「Ben Do」
    "Q155004": ("菲利普", None),  # 比利時國王菲利普：中文名稱還是即位以前的「菲利普王儲」
    "Q336291": (None, "National Anthem of the Republic of San Marino"),  # 聖馬利諾國歌：沒有英文名稱
}
# 職稱本身過時或錯誤，改寫（國家, 元首或政府首長）→ (中文, 英文)；None 是不寫職稱
OFFICE_OVERRIDES = {
    ("BFA", "hos"): ("過渡總統", "Transitional President"),  # Wikidata 是「軍事領袖」（通用的類別）
    ("SDN", "hos"): ("過渡主權委員會主席", "Chairman of the Transitional Sovereignty Council"),  # Wikidata 是 2019 年的過渡軍事委員會
    ("MMR", "hog"): None,  # 國家管理委員會、國家顧問都已經不存在
    ("CHE", "hos"): None,  # Wikidata 的職稱是「聯邦委員會委員」，元首是整個聯邦委員會
}
# 元首的職稱有好幾個、偏好值不對的：伊朗的 P1906 有最高領袖與總統（偏好值），但憲法上的國家元首是最高領袖（P35 也是）
FORCE_OFFICE = {"IRN": "Q332486"}
# 不比職務現任者的：瑞士的聯邦委員會集體擔任元首與政府（職務那一邊是委員個人）；利比亞有兩個對立的政府，
# 職務那一邊最新的是 2022 年國會任命、沒有得到國際承認的巴沙加，國家那一邊是民族團結政府的德貝巴
COLLECTIVE = {"CHE", "LBY"}
# 職務的現任者從人那一邊（P39）查得到、而且比國家那一邊的新時採用；但起始日期太舊（這幾年沒有人更新）的不採用
HOLDER_MAX_AGE_YEARS = 5

# ── 貨幣 ─────────────────────────────────────
EURO, USD, CFA, SHARED, OWN = 1, 2, 3, 4, 5  # src/topics/profiles.ts 的 CURRENCY
# Wikidata 的貨幣不對、或列了不在這個地圖區域流通的（ISO 4217 代碼，理由）
CURRENCY_OVERRIDES = {
    "NLD": (["EUR", "USD"], "Wikidata 是荷蘭王國，列了阿魯巴、庫拉索的貨幣；地圖的荷蘭含加勒比荷蘭（用美元）"),
    "FRA": (["EUR"], "太平洋法郎用在新喀里多尼亞等地，地圖上是另外的區域"),
    "ZWE": (["ZWG", "USD"], "Wikidata 列了多貨幣制度時期的十種貨幣；2024 年起是辛巴威金，美元也是法定貨幣"),
    "MAC": (["MOP"], "Wikidata 也列港元；港元在澳門通用，但法定貨幣是澳門元"),
    "FRO": (["DKK"], "法羅群島克朗是丹麥克朗的另一種鈔票，沒有自己的 ISO 4217 代碼"),
    "PSE": (["ILS", "JOD"], "Wikidata 也列埃及鎊；通行的是以色列新謝克爾與約旦第納爾"),
    "BTN": (["BTN", "INR"], "Wikidata 只列努爾特魯姆；印度盧比在不丹也是法定貨幣"),
    "_CYN": (["TRY"], "Wikidata 沒有（沒有 ISO 代碼）；北賽普勒斯用土耳其里拉"),
    "_IOT": (["AUD"], "Wikidata 沒有（地圖自訂代碼）；聖誕島、科科斯（基林）群島用澳洲元"),
    "CUW": (["XCG"], None), "SXM": (["XCG"], None),
}
HISTORIC_CODES = {"PLZ", "ZWD", "ZWN", "ZWR", "ZWL", "LTT"}

# ── 其他欄位的修正 ────────────────────────────
CALLING_OVERRIDES = {
    "SHN": ["+290", "+247"],  # Wikidata 另外列了 +27（南非），不對
    "SMR": ["+378"],  # +39 0549 是經由義大利的舊撥法
    "_CYN": ["+90 392"], "_IOT": ["+61"],
}
TLD_OVERRIDES = {"_IOT": [".cx", ".cc"]}

# ── 台灣：執行時跟 Wikidata 核對，對不上就印出來（不蓋掉 Wikidata 的值） ────────
TAIWAN_EXPECT = {
    "capital": "Q1867",  # 臺北
    "hos": ("賴清德", "2024-05-20"), "hos_office": "Q887003",  # 中華民國總統
    "hog": ("卓榮泰", "2024-05-20"), "hog_office": "Q702650",  # 行政院院長
    "currency": ["TWD"], "tel": ["+886"], "tld": [".tw"],
}

# ── 鄰國與內陸國 ──────────────────────────────
# 1:50m 的國界太粗、沒有畫出來的陸地國界（休達與美利雅、直布羅陀、漢斯島、賽普勒斯的英國主權基地區）
MANUAL_BORDERS = [
    ("ESP", "MAR"),  # 休達、美利雅、戈梅拉礁（西班牙在北非的領土）
    ("ESP", "GIB"),  # 直布羅陀（地圖上沒有形狀，只畫圓點）
    ("CAN", "GRL"),  # 漢斯島：2022 年加拿大與丹麥協議平分
    ("CYP", "GBR"),  # 亞克羅提利與德凱利亞（英國的主權基地區）
]
# 裏海的岸線不算海岸（亞塞拜然、哈薩克、土庫曼是內陸國）。範圍內的國界線段只算裏海的岸線：(西, 南, 東, 北)
CASPIAN = (46.0, 36.5, 55.5, 47.5)
# 依地圖的劃分算進鄰國、但地位有爭議的區域（tooltip 寫明）
DISPUTED_UNITS = {"XKX", "_SOL", "_CYN", "ESH", "PSE"}
NOT_COUNTED = {"ATA", "_SIA"}  # 錫亞琴冰川（印度與巴基斯坦有爭議）不算一個鄰國
LANDLOCKED_KNOWN = set(
    "AFG AND ARM AUT AZE BLR BTN BOL BWA BFA BDI CAF TCD CZE SWZ ETH HUN KAZ XKX KGZ LAO LSO LIE LUX MWI MLI MDA MNG NPL "
    "NER MKD PRY RWA SMR SRB SVK SSD CHE TJK TKM UGA UZB VAT ZMB ZWE".split()
)
COASTAL, LANDLOCKED, DOUBLY = 3, 2, 1  # src/topics/profiles.ts 的 LANDLOCKED（雙重內陸國排第一，最深）


def _read_indicator(path) -> dict:
    """讀回 common.indicator_file() 的差分編碼（src/lib/data.ts 的還原）"""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if data.get("encoding") != "delta":
        return data

    def expand(series: list) -> list:
        e, out, acc = series[0], [], 0
        for d in series[1:]:
            if d is None:
                out.append(None)
                continue
            acc += d
            out.append(acc * 10**e if e >= 0 else round(acc * 10**e, -e))
        return out

    data["values"] = {k: expand(v) for k, v in data["values"].items()}
    return data


# ── 鄰國 ──────────────────────────────────────

def _borders() -> tuple[dict[str, dict[str, float]], set[str]]:
    """({國家: {鄰國: 共用國界的公里數}}, 有海岸的國家)：TopoJSON 的線段兩國共用就是陸地國界。"""
    with open(OUT_DIR / "geo" / "countries-50m.json", encoding="utf-8") as f:
        topo = json.load(f)
    (sx, sy), (tx, ty) = topo["transform"]["scale"], topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)
    users: dict[int, set[str]] = defaultdict(set)
    for g in topo["objects"]["countries"]["geometries"]:
        polygons = [g["arcs"]] if g["type"] == "Polygon" else g["arcs"]
        for polygon in polygons:
            for ring in polygon:
                for i in ring:
                    users[i if i >= 0 else ~i].add(g["id"])

    def km(pts: list[tuple[float, float]]) -> float:
        total = 0.0
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            dx = math.radians((x2 - x1 + 540) % 360 - 180)
            p1, p2 = math.radians(y1), math.radians(y2)
            a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dx / 2) ** 2
            total += 2 * 6371.0088 * math.asin(math.sqrt(min(1.0, a)))
        return total

    def in_caspian(pts: list[tuple[float, float]]) -> bool:
        x0, y0, x1, y1 = CASPIAN
        return all(x0 <= x <= x1 and y0 <= y <= y1 for x, y in pts)

    shared: dict[str, dict[str, float]] = defaultdict(dict)
    coastal: set[str] = set()
    for i, u in users.items():
        if len(u) == 2:
            a, b = sorted(u)
            length = km(arcs[i])
            shared[a][b] = shared[a].get(b, 0.0) + length
            shared[b][a] = shared[b].get(a, 0.0) + length
        elif len(u) == 1 and not in_caspian(arcs[i]):
            coastal.add(next(iter(u)))
        elif len(u) > 2:
            raise RuntimeError(f"國界線段 {i} 有三個國家共用：{sorted(u)}")
    for a, b in MANUAL_BORDERS:
        shared[a].setdefault(b, 0.0)
        shared[b].setdefault(a, 0.0)
    return shared, coastal


def neighbours(units: list[str]) -> tuple[dict[str, list[str]], dict[str, int], dict[str, list[str]]]:
    """({國家: [鄰國（依共用國界長度排）]}, {國家: 內陸國代碼}, {國家: [算進鄰國的爭議區域]})。

    屬地的陸地國界算進主權國（荷蘭經由荷屬聖馬丁跟法國相接、丹麥經由格陵蘭跟加拿大相接），中國不算港澳；
    屬地自己的鄰國照算（香港的鄰國是中國）。錫亞琴冰川、南極洲不算。
    """
    group_of = {u: TERRITORIES.get(u, (u, None))[0] for u in units}
    shared, coastal = _borders()
    coastal |= set(SHAPELESS)  # 吐瓦魯、托克勞、直布羅陀在 1:50m 沒有形狀，都靠海
    members: dict[str, list[str]] = defaultdict(list)
    for u in units:
        members[group_of[u]].append(u)
    out: dict[str, list[str]] = {}
    disputed: dict[str, list[str]] = {}
    for u in units:
        if u in NOT_COUNTED:
            continue
        # 主權國：自己加上屬地的國界；屬地：只有自己的國界。鄰國一律換成主權國（香港的鄰國是中國，中國不算港澳）
        sources = [u] if u in TERRITORIES else members[u]
        lengths: dict[str, float] = defaultdict(float)
        for s in sources:
            for n, length in shared.get(s, {}).items():
                g = group_of.get(n, n)
                if n in NOT_COUNTED or g == u:
                    continue
                lengths[g] += length
        out[u] = [n for n, _ in sorted(lengths.items(), key=lambda kv: (-kv[1], kv[0]))]
        disputed[u] = [n for n in out[u] if n in DISPUTED_UNITS]
    landlocked: dict[str, int] = {}
    for u in units:
        if u in NOT_COUNTED:
            continue
        landlocked[u] = COASTAL if u in coastal else LANDLOCKED
    for u, code in list(landlocked.items()):
        direct = [n for n in shared.get(u, {}) if n not in NOT_COUNTED]
        if code == LANDLOCKED and direct and all(landlocked.get(n) == LANDLOCKED for n in direct):
            landlocked[u] = DOUBLY
    found = {u for u, c in landlocked.items() if c != COASTAL}
    if found != LANDLOCKED_KNOWN:
        raise RuntimeError(f"內陸國跟已知的清單不同：多了 {sorted(found - LANDLOCKED_KNOWN)}，少了 {sorted(LANDLOCKED_KNOWN - found)}")
    doubly = sorted(u for u, c in landlocked.items() if c == DOUBLY)
    if doubly != ["LIE", "UZB"]:
        raise RuntimeError(f"雙重內陸國應該是列支敦斯登與烏茲別克：{doubly}")
    expect = {"CHN": 14, "RUS": 14, "TWN": 0, "BRA": 10, "FRA": 11, "DEU": 9, "HKG": 1, "NLD": 3}
    wrong = {k: (len(out[k]), v) for k, v in expect.items() if len(out[k]) != v}
    if wrong:
        raise RuntimeError(f"鄰國數跟預期不同（算出來的, 預期的）：{wrong}")
    return out, landlocked, disputed


# ── 政體 ──────────────────────────────────────

def government_from_wikidata(stmts: dict) -> tuple[set, list[str]]:
    """Wikidata P122 對到的類別（偏好值有對到的話只看偏好值）與原始值"""
    values = list(stmts.get("P122", {}).values())
    qids = [s.value for s in values]

    def cats(sts):
        found = set()
        monarchy = any(s.value in MONARCHY_QIDS for s in values)
        for s in sts:
            c = P122_CATEGORY.get(s.value)
            if c == "parl":
                c = PARL_MON if monarchy else PARL_REP
            if c is not None:
                found.add(c)
        return found

    preferred = [s for s in values if s.rank == "PreferredRank"]
    found = cats(preferred) or cats(values)
    for p in P122_PRIORITY:
        if p in found:
            return {OTHER if p == "theo" else p}, qids
    return found, qids


def governments(units: list[str], st: dict) -> dict[str, int]:
    out: dict[str, int] = {}
    report = []
    missing = []
    for u in units:
        if u in NO_PROFILE or u == "ESH":
            continue
        if u in TERRITORIES:
            out[u] = TERRITORY
            continue
        derived, _qids = government_from_wikidata(st.get(WIKI_ISO.get(u, u), {}))
        wikidata = next(iter(derived)) if len(derived) == 1 else None
        if u in GOVERNMENT_OVERRIDES:
            final, reason = GOVERNMENT_OVERRIDES[u]
            if wikidata == final:
                missing.append(f"{u}（跟 Wikidata 一樣，可以拿掉）")
            report.append(f"{u}：Wikidata {sorted(derived) or '—'} → {final}（{reason}）")
        elif wikidata is None:
            missing.append(f"{u}（{sorted(derived)}）")
            continue
        else:
            final = wikidata
        out[u] = final
    if missing:
        raise RuntimeError(f"這些國家的政體 Wikidata 對不到唯一的類別，要加進 GOVERNMENT_OVERRIDES 並寫理由：{'、'.join(missing)}")
    print(f"  政體：{len(out)} 個國家或地區，{len(report)} 個跟 Wikidata 的 P122 不同（都寫了理由）")
    return out


# ── 元首與政府首長 ──────────────────────────────

def _pick(stmts: dict) -> list:
    """國家那一邊的陳述：有偏好值就只用偏好值（全部，例如安道爾的兩位大公）；沒有時取起始日期最新的（可能好幾個）"""
    sts = list(stmts.values())
    preferred = [s for s in sts if s.rank == "PreferredRank"]
    if preferred:
        return preferred
    dated = [s for s in sts if s.start]
    if dated:
        latest = max(s.start for s in dated)
        return [s for s in dated if s.start == latest]
    return sts


def _office(stmts: dict) -> list[str]:
    sts = list(stmts.values())
    preferred = [s.value for s in sts if s.rank == "PreferredRank"]
    seen: list[str] = []
    for v in preferred + [s.value for s in sts]:
        if v not in seen:
            seen.append(v)
    return seen


def head(iso: str, stmts: dict, person_prop: str, office_prop: str, holders: dict, today: str, log: list,
         force_office: str | None = None) -> dict | None:
    """{'o': 職稱 QID 或 None, 'p': [(人 QID, 起始日期)…]}

    國家那一邊（P35、P6）跟人那一邊（擔任職務 P39 的現任者）比，用起始日期比較新的那一邊：
    - 國家那一邊沒有值：用職務現任者裡最新的。
    - 國家那一邊有起始日期：職務現任者的更新就換；日期一樣、但國家那一邊的人已經不在職務的現任者裡（例如烏茲別克的
      總理還寫米爾濟約耶夫，他 2016 年就改當總統）也換。
    - 國家那一邊沒有起始日期：職務現任者的起始日期在 HOLDER_MAX_AGE_YEARS 年內才換（聖文森的現任總理沒有 P39，
      職務那一邊最新的是 2001 年的前任，不能換）。
    只有一個職稱時才比（福克蘭群島的元首列了英國君主與總督兩個職稱，不比）。
    """
    chosen = [(s.value, s.start) for s in _pick(stmts.get(person_prop, {}))]
    offices = [force_office] if force_office else _office(stmts.get(office_prop, {}))
    if len(offices) == 1 and iso not in COLLECTIVE:
        current = holders.get(offices[0], {})
        dated = sorted(((start, person) for person, (start, _rank) in current.items() if start), reverse=True)
        if dated:
            latest = dated[0][0]
            newer = [(p, s) for s, p in dated if s == latest]
            mine = max((start for _p, start in chosen if start), default="")
            if not chosen:
                use = True
            elif mine:
                use = latest > mine or (latest == mine and not any(p in current for p, _s in chosen))
            else:
                use = int(latest[:4]) >= int(today[:4]) - HOLDER_MAX_AGE_YEARS and not any(p in current for p, _s in chosen)
            if use and {p for p, _ in newer} != {p for p, _ in chosen}:
                if chosen:
                    log.append(f"{iso} {person_prop}：國家那一邊是 {chosen}，改用職務現任者（P39）{newer}")
                chosen = newer
    if not chosen:
        return None
    office = force_office
    for o in offices:
        if office is None and any(p in holders.get(o, {}) for p, _s in chosen):
            office = o
    if office is None and offices:
        office = offices[0]
    return {"o": office, "p": chosen}


# ── 主程式 ─────────────────────────────────────

def build() -> None:
    with open(OUT_DIR / "geo" / "countries-50m.json", encoding="utf-8") as f:
        map_ids = sorted(g["id"] for g in json.load(f)["objects"]["countries"]["geometries"])
    units = sorted(set(map_ids) | set(SHAPELESS))
    st, qids = wikidata_profiles.statements()
    today = wikidata_profiles.fetched_date()
    inception = wikidata_profiles.inception(qids)
    coords, currency_codes = wikidata_profiles.value_facts()
    offices = [s.value for p in st.values() for k in ("P1906", "P1313") for s in p.get(k, {}).values()]
    holders = wikidata_profiles.holders(offices)
    iso_of_qid = {q: iso for iso, q in qids.items()}
    iso_of_qid.update(KINGDOMS)
    iso_of_qid[qids["XKS"]] = "XKX"

    def stmts_of(u: str) -> dict:
        return st.get(WIKI_ISO.get(u, u), {})

    # 屬地表跟 Wikidata 的 P17 核對
    for u, (sov, _rel) in TERRITORIES.items():
        p17 = {iso_of_qid.get(s.value) for s in stmts_of(u).get("P17", {}).values()}
        if p17 and sov not in p17 and u not in p17:
            print(f"  屬地 {u} 的主權國是 {sov}，Wikidata 的 P17 是 {sorted(x or '?' for x in p17)}")

    gov = governments(units, st)
    nb, landlocked, disputed_nb = neighbours(units)

    # ── 元首與政府首長 ──
    head_log: list[str] = []
    heads: dict[str, dict] = {}
    for u in units:
        if u in NO_PROFILE:
            continue
        s = stmts_of(u)
        hos = head(u, s, "P35", "P1906", holders, today, head_log, FORCE_OFFICE.get(u))
        hog = head(u, s, "P6", "P1313", holders, today, head_log)
        hog_offices = set(_office(s.get("P1313", {})))
        # 政府首長的職稱就是元首的職稱（總統制），或是同一批人（瑞士的聯邦委員會）：政府首長由元首兼任
        if hos and hog_offices and hog_offices == {hos["o"]}:
            hog = {"same": True}
        elif hos and hog and {p for p, _ in hos["p"]} == {p for p, _ in hog["p"]}:
            hog = {"same": True}
        heads[u] = {"hos": hos, "hog": hog}
    for line in head_log:
        print(f"  {line}")

    # ── 名稱 ──
    need: set[str] = set(qids.values())
    tld_items: set[str] = set()
    for u in units:
        s = stmts_of(u)
        for prop in ("P36", "P38", "P85"):
            need.update(x.value for x in s.get(prop, {}).values() if x.value.startswith("Q"))
        tld_items.update(x.value for x in s.get("P78", {}).values() if x.value.startswith("Q"))
        h = heads.get(u, {})
        for key in ("hos", "hog"):
            if h.get(key) and not h[key].get("same"):
                need.update(p for p, _ in h[key]["p"])
                if h[key]["o"]:
                    need.add(h[key]["o"])
    for extras in CAPITAL_EXTRA.values():
        need.update(q for q, *_ in extras)
    labels = wikidata_profiles.labels(sorted(need))
    labels.update(wikidata_profiles.labels(sorted(tld_items - need), zh=False))

    def name(qid: str | None) -> list | None:
        if not qid:
            return None
        zh, en = labels.get(qid, (None, None))
        fix_zh, fix_en = LABEL_FIXES.get(qid, (None, None))
        zh, en = fix_zh or zh, fix_en or en
        # 名稱裡的消歧義括號：「穆罕默德·穆斯塔法 (經濟學家)」
        zh = re.sub(r"\s*[（(][^）)]*[）)]$", "", zh) if zh else zh
        en = re.sub(r"\s*\([^)]*\)$", "", en) if en else en
        if zh is None and en is None:
            return None
        return [zh, en]

    def office_name(qid: str | None) -> list | None:
        if not qid:
            return None
        zh, en = labels.get(qid, (None, None))
        fix_zh, fix_en = OFFICE_NAMES.get(qid, (None, None))
        zh = fix_zh or zh
        en = fix_en or en
        if zh and zh.endswith("列表"):
            raise RuntimeError(f"職稱 {qid} 的中文名稱是列表（{zh}），要加進 OFFICE_NAMES")
        if zh is None and en is None:
            return None
        if en:
            en = en[0].upper() + en[1:]  # 「president of Bolivia」「monarch of Canada」
        return [zh, en]

    # ── 人口與面積 ──
    population = _read_indicator(DATA / "population" / "total.json")
    pop_index = population["years"].index(YEAR)
    land: dict[str, tuple[int, float]] = {}
    for r in faostat.rows("RL", {5110}, {6601}):
        if r.area != "WLD" and r.value > 0 and (r.area not in land or r.year > land[r.area][0]):
            land[r.area] = (r.year, r.value * 10)  # 千公頃 → km²

    # ── 其他主題的一句話 ──
    cross, regime_year = cross_topics(units)

    # ── 每個國家的小檔案 ──
    profiles: dict[str, dict] = {}
    currency_values: dict[str, list] = {}
    currency_hints: dict[str, str] = {}
    currency_hints_en: dict[str, str] = {}
    capital_points: list[dict] = []
    currency_users: dict[str, set[str]] = defaultdict(set)
    currencies: dict[str, list[str]] = {}
    uncoded: dict[str, list[str]] = {}  # 沒有 ISO 4217 代碼的貨幣項目
    for u in units:
        if u in NO_PROFILE:
            continue
        s = stmts_of(u)
        if u in CURRENCY_OVERRIDES:
            codes = CURRENCY_OVERRIDES[u][0]
        else:
            sts = list(s.get("P38", {}).values())
            codes = []
            # 有偏好值就只用偏好值；沒有 ISO 4217 代碼的（法羅群島克朗、比特幣）與舊代碼不算。
            # 偏好值都沒有代碼時（曼島的偏好值是曼島鎊）再看全部的陳述
            preferred = [x for x in sts if x.rank == "PreferredRank"]
            for group in (preferred, sts):
                for x in group:
                    for c in currency_codes.get(x.value, []):
                        if re.fullmatch(r"[A-Z]{3}", c) and c not in HISTORIC_CODES and c not in codes:
                            codes.append(c)
                if codes:
                    break
            if not codes and sts:
                # 完全沒有 ISO 4217 代碼的貨幣（索馬利蘭先令）：只寫名稱，算自己的貨幣
                uncoded[u] = [x.value for x in preferred or sts]
        currencies[u] = codes
        for c in codes:
            currency_users[c].add(u)
    # 貨幣的名稱：用 Wikidata 貨幣項目的名稱（同一個代碼可能對到好幾個項目，取第一個）
    currency_item: dict[str, str] = {}
    for item, codes in currency_codes.items():
        for c in codes:
            currency_item.setdefault(c, item)
    extra_currency_items = [q for c, q in currency_item.items() if q not in labels]
    labels.update(wikidata_profiles.labels(extra_currency_items) if extra_currency_items else {})

    def currency_category(codes: list[str]) -> int | None:
        if not codes:
            return None
        if "EUR" in codes:
            return EURO
        if "XOF" in codes or "XAF" in codes:
            return CFA
        if "USD" in codes:
            return USD
        if any(len(currency_users[c]) > 1 for c in codes):
            return SHARED
        return OWN

    for u in units:
        if u in NO_PROFILE:
            continue
        s = stmts_of(u)
        p: dict = {}
        qid = qids.get(WIKI_ISO.get(u, u))
        if qid:
            p["q"] = qid
        # 首都
        caps = []
        seen_caps: dict[str, dict] = {}
        sts = list(s.get("P36", {}).values())
        preferred = [x for x in sts if x.rank == "PreferredRank"]
        for x in sts:
            role_q = (x.qualifiers.get("P518", []) + x.qualifiers.get("P3831", []) + x.qualifiers.get("P5102", []))
            role = next((CAPITAL_ROLES[r] for r in role_q if r in CAPITAL_ROLES), None)
            role = CAPITAL_ROLE_OVERRIDES.get((u, x.value), role)
            if preferred and x.rank != "PreferredRank" and role is None and (u, x.value) not in CAPITAL_ROLE_OVERRIDES:
                continue  # 有偏好值時，沒有寫角色的其他首都是舊的（例如南喬治亞的古利德維肯）
            if x.value in seen_caps:
                if role and not seen_caps[x.value].get("r"):
                    seen_caps[x.value]["r"] = role
                continue
            entry = {"n": name(x.value)}
            if role:
                entry["r"] = role
            if "P1310" in x.qualifiers:
                entry["d"] = 1
            seen_caps[x.value] = entry
            caps.append((x.value, entry))
        for q, role, lon, lat in CAPITAL_EXTRA.get(u, []):
            coords.setdefault(q, (lon, lat))
            entry = {"n": name(q), "r": role}
            caps.append((q, entry))
        order = {None: 0, "dejure": 1, "claimed": 1, "exec": 2, "leg": 3, "jud": 4, "seat": 5, "admin": 6, "defacto": 7, "unofficial": 8}
        caps.sort(key=lambda c: order.get(c[1].get("r"), 9))
        if len(caps) == 1 and caps[0][1].get("r") in ("dejure", "defacto", "seat"):
            del caps[0][1]["r"]  # 只有一個首都時不寫「法定」「政府所在地」（德國的柏林、法國的巴黎、日本的東京）
        if caps:
            p["cap"] = [c for _q, c in caps]
            for q, c in caps:
                if q in coords and c["n"]:
                    lon, lat = coords[q]
                    capital_points.append({"lon": lon, "lat": lat, "iso3": u, "zh": c["n"][0] or c["n"][1], "en": c["n"][1] or c["n"][0],
                                           "role": c.get("r", ""), "d": c.get("d")})
        # 元首與政府首長
        h = heads[u]
        for key in ("hos", "hog"):
            v = h[key]
            if not v:
                continue
            if v.get("same"):
                p[key] = {"same": 1}
                continue
            title = office_name(v["o"])
            if (u, key) in OFFICE_OVERRIDES:
                fixed = OFFICE_OVERRIDES[(u, key)]
                title = list(fixed) if fixed else None
            people = []
            for person, start in v["p"]:
                n = name(person)
                if n:
                    people.append([n[0], n[1], start or None])
            if people:
                p[key] = {"t": title, "p": people}
        # 政體、貨幣
        if u in gov:
            p["gov"] = gov[u]
        codes = currencies[u]
        if codes:
            p["cur"] = [[c, *(name(currency_item.get(c)) or [None, None])] for c in codes]
            currency_values[u] = [currency_category(codes)]
            names_zh = "、".join(f"{(name(currency_item.get(c)) or [c, c])[0] or c}（{c}）" for c in codes)
            names_en = ", ".join(f"{(name(currency_item.get(c)) or [c, c])[1] or c} ({c})" for c in codes)
            currency_hints[u] = names_zh
            currency_hints_en[u] = names_en
        elif u in uncoded:
            named = [n for n in (name(q) for q in uncoded[u]) if n]
            if named:
                p["cur"] = [[None, *n] for n in named]
                currency_values[u] = [OWN]
                currency_hints[u] = "、".join(n[0] or n[1] for n in named)
                currency_hints_en[u] = ", ".join(n[1] or n[0] for n in named)
        # 區號、網域、ISO 代碼、國歌、成立時間
        tel = CALLING_OVERRIDES.get(u) or sorted({x.value for x in s.get("P474", {}).values()})
        if tel:
            p["tel"] = [_calling(t) for t in tel]
        tld = TLD_OVERRIDES.get(u) or sorted({(labels.get(x.value, (None, None))[1] or "") for x in s.get("P78", {}).values()} - {""})
        tld = [t for t in tld if re.fullmatch(r"\.[a-z]{2}", t)]
        if tld:
            p["tld"] = tld
        a2 = sorted(x.value for x in s.get("P297", {}).values())
        num = sorted({x.value for x in s.get("P299", {}).values()})
        if u.startswith("_"):
            a2, num = [], []
        p["iso"] = [a2[0] if a2 else None, None if u.startswith("_") else u, num[0] if num else None]
        if u == "XKX":
            p["iso"] = ["XK", "XKX", None]  # 科索沃沒有正式的 ISO 3166-1 代碼，XK、XKX 是歐盟、世界銀行等使用的自訂代碼
        anthems = []
        for x in sorted(s.get("P85", {}).values(), key=lambda x: x.rank != "PreferredRank"):
            n = name(x.value)
            if n and n not in anthems:
                anthems.append(n)
        if anthems:
            p["anthem"] = anthems
        # 成立時間：Wikidata 只有一個值時才列（美國有 1776、1784 年，英國有 1921、1927 年，各國的定義也不一樣）
        inc = inception.get(WIKI_ISO.get(u, u), [])
        if len(inc) == 1:
            t, prec, _rank = inc[0]
            if t.startswith("+"):
                t = t[1:]
            if not t.startswith("-") and prec >= 9:
                p["inc"] = t[: {9: 4, 10: 7}.get(prec, 10)]
        # 主權國
        if u in TERRITORIES:
            p["sov"], p["rel"] = TERRITORIES[u]
        # 鄰國、內陸國
        if u in nb:
            p["nb"] = nb[u]
            p["ll"] = landlocked[u]
        # 人口、面積
        pop_series = population["values"].get(u)
        if pop_series and pop_series[pop_index]:
            p["pop"] = round(pop_series[pop_index])
        if u in land:
            km2 = land[u][1]
            p["area"] = [round(km2, 2) if km2 < 10 else round(km2), land[u][0]]
        if u in cross:
            p["x"] = cross[u]
        profiles[u] = p

    check_taiwan(profiles, heads, stmts_of("TWN"))

    # ── 指標檔 ──
    meta = {"generatedAt": now_iso(), "wikidata": today}
    gov_hints = {u: h[0] for u, h in GOVERNMENT_HINTS.items() if u in gov}
    gov_hints_en = {u: h[1] for u, h in GOVERNMENT_HINTS.items() if u in gov}
    for u, (sov, rel) in TERRITORIES.items():
        if u in gov:
            gov_hints[u], gov_hints_en[u] = RELATION_TEXT[rel]
    write_json(OUT / "government.json", indicator_file("government", "類別", [YEAR], {u: [v] for u, v in gov.items()},
                                                       hints=gov_hints, hintsEn=gov_hints_en))
    write_json(OUT / "currency.json", indicator_file("currency", "類別", [YEAR], currency_values,
                                                     hints=currency_hints, hintsEn=currency_hints_en))
    nb_hints, nb_hints_en = {}, {}
    zh_of = {u: (labels.get(qids.get(WIKI_ISO.get(u, u), ""), (None, None))) for u in units}
    for u, found in disputed_nb.items():
        if found:
            nb_hints[u] = "依地圖的劃分，含地位有爭議的" + "、".join(zh_of[d][0] or d for d in found)
            nb_hints_en[u] = "Following the map's boundaries; includes " + ", ".join(zh_of[d][1] or d for d in found) + ", whose status is disputed"
    for u in nb:
        via = [t for t, (sov, _r) in TERRITORIES.items() if sov == u and any(n not in (u,) for n in nb.get(t, []))]
        if via and u not in TERRITORIES:
            zh = "、".join(zh_of[t][0] or t for t in via)
            en = ", ".join(zh_of[t][1] or t for t in via)
            nb_hints[u] = (nb_hints.get(u, "") + "；" if u in nb_hints else "") + f"含屬地{zh}的陸地國界"
            nb_hints_en[u] = (nb_hints_en.get(u, "") + "; " if u in nb_hints_en else "") + f"Includes the land borders of {en}"
    write_json(OUT / "neighbours.json", indicator_file("neighbours", "個", [YEAR], {u: [len(v)] for u, v in nb.items()},
                                                       hints=nb_hints, hintsEn=nb_hints_en))
    write_json(OUT / "landlocked.json", indicator_file("landlocked", "類別", [YEAR], {u: [v] for u, v in landlocked.items()}))
    write_json(OUT / "profiles.json", {"date": today, "popYear": YEAR, "regimeYear": regime_year, "countries": profiles})
    capital_points.sort(key=lambda r: (r["lon"], r["lat"]))
    for r in capital_points:
        r["role"] = r["role"] or None
    write_json(OUT / "capitals.json", points_file(capital_points, ["lon", "lat", "iso3", "zh", "en", "role", "d"], {"lon": 0.01, "lat": 0.01, "d": 1}, delta=["lon"]))
    write_json(OUT / "manifest.json", meta)

    counts = defaultdict(int)
    for v in gov.values():
        counts[v] += 1
    print(f"  政體各類：{dict(sorted(counts.items()))}")
    cur_counts = defaultdict(int)
    for v in currency_values.values():
        cur_counts[v[0]] += 1
    print(f"  貨幣各類：{dict(sorted(cur_counts.items()))}；共用的貨幣：{sorted(c for c, us in currency_users.items() if len(us) > 1)}")
    missing = [u for u in units if u not in NO_PROFILE and not profiles[u].get("hos")]
    print(f"  沒有元首資料的：{missing}")


RELATION_TEXT = {
    "nl": ("荷蘭王國的構成國", "Constituent country of the Kingdom of the Netherlands"),
    "uk-ot": ("英國海外領土", "British Overseas Territory"),
    "uk-cd": ("英國皇家屬地", "British Crown Dependency"),
    "fi": ("芬蘭的自治區", "Autonomous region of Finland"),
    "us": ("美國的屬地", "United States territory"),
    "fr": ("法國的海外屬地", "French overseas territory"),
    "nz-assoc": ("與紐西蘭自由聯合的自治國", "Self-governing state in free association with New Zealand"),
    "nz": ("紐西蘭的屬地", "Territory of New Zealand"),
    "dk": ("丹麥王國的自治領土", "Autonomous territory of the Kingdom of Denmark"),
    "cn-sar": ("中國的特別行政區", "Special administrative region of China"),
    "au": ("澳洲的海外領地", "External territory of Australia"),
}


def _calling(code: str) -> str:
    """北美編號計畫的區號寫成「+1 264」"""
    digits = code.lstrip("+").replace(" ", "")
    if digits.startswith("1") and len(digits) == 4:
        return f"+1 {digits[1:]}"
    return code


def check_taiwan(profiles: dict, heads: dict, stmts: dict) -> None:
    """台灣的小檔案跟預期的核對；對不上就印出來（不蓋掉 Wikidata 的值）"""
    p = profiles["TWN"]
    h = heads["TWN"]
    problems = []
    capitals = [s.value for s in stmts.get("P36", {}).values()]
    if capitals != [TAIWAN_EXPECT["capital"]]:
        problems.append(f"首都：{capitals}（預期臺北 {TAIWAN_EXPECT['capital']}）")
    for key in ("hos", "hog"):
        want_name, want_start = TAIWAN_EXPECT[key]
        got = p.get(key, {}).get("p", [])
        if not got or got[0][0] != want_name or got[0][2] != want_start:
            problems.append(f"{key}：{got}（預期 {want_name}，{want_start} 起）")
        if not h[key] or h[key].get("o") != TAIWAN_EXPECT[f"{key}_office"]:
            problems.append(f"{key} 職稱：{h[key] and h[key].get('o')}（預期 {TAIWAN_EXPECT[f'{key}_office']}）")
    for key, got in (("currency", [c[0] for c in p.get("cur", [])]), ("tel", p.get("tel")), ("tld", p.get("tld"))):
        if got != TAIWAN_EXPECT[key]:
            problems.append(f"{key}：{got}（預期 {TAIWAN_EXPECT[key]}）")
    if problems:
        print("  ⚠ 台灣的小檔案跟預期不同（照 Wikidata 的值輸出）：")
        for line in problems:
            print(f"    {line}")
    else:
        print("  台灣的小檔案跟預期一致：首都臺北、總統賴清德（2024-05-20 起）、行政院院長卓榮泰（2024-05-20 起）、新臺幣、+886、.tw")


# ── 其他主題的一句話 ────────────────────────────

def cross_topics(units: list[str]) -> tuple[dict[str, dict], int]:
    """讀其他主題已經產生的資料檔，取每個國家最新的值（側欄的「其他主題」）；另外回傳 V-Dem 政體分類的年份"""
    out: dict[str, dict] = defaultdict(dict)

    def each(path, key, transform=lambda v: v, year=None):
        if not path.exists():
            print(f"  找不到 {path.relative_to(OUT_DIR)}，側欄不列「{key}」")
            return
        data = _read_indicator(path)
        idx = data["years"].index(year) if year is not None and year in data["years"] else None
        for u, series in data["values"].items():
            v = series[idx] if idx is not None else next((x for x in reversed(series) if x is not None), None)
            if v is not None and u in units:
                out[u][key] = transform(v)

    each(DATA / "travel" / "driving.json", "drive", int)
    each(DATA / "travel" / "time-difference.json", "tz", lambda v: round(v, 2))
    each(DATA / "language" / "main.json", "lang", lambda v: _base36(int(v)))
    each(DATA / "democracy" / "regime.json", "regime", int)
    each(DATA / "organizations" / "count.json", "orgs", int)
    each(DATA / "taiwan-diplomacy" / "allies.json", "ally", int)
    regime = _read_indicator(DATA / "democracy" / "regime.json")
    regime_year = regime["years"][-1]
    orgs = _read_indicator(DATA / "organizations" / "count.json")
    for u in out:
        if "regime" in out[u]:
            series = regime["values"][u]
            if series[-1] is None:
                del out[u]["regime"]  # 只放最新一年有評分的
    # 海拔的最高點
    with open(DATA / "elevation" / "profiles.json", encoding="utf-8") as f:
        elevation = json.load(f)["countries"]
    for u, e in elevation.items():
        high = e.get("high")
        if u in units and high and high.get("e") is not None:
            out[u]["high"] = [high.get("zh"), high.get("en"), round(high["e"])]
    # 城市的最大城市（2025 年人口）
    with open(DATA / "cities" / "cities.json", encoding="utf-8") as f:
        cities = json.load(f)
    fields = cities["fields"]
    col = {name: cities["columns"][i] for i, name in enumerate(fields)}
    # 人口每一期存跟前一期的差（src/topics/cities.ts 的 cityValue()），2025 年是 1975–2025 年加起來；還不是城市的期是 null
    epochs = [f"p{y}" for y in range(1975, 2030, 5)]
    scale = cities["scale"].get("p2025", 1)
    best: dict[str, tuple[float, str | None, str]] = {}
    for i, iso in enumerate(col["iso3"]):
        if iso is None or col["p2025"][i] is None:
            continue
        pop = sum(col[e][i] or 0 for e in epochs) * scale
        if iso not in best or pop > best[iso][0]:
            best[iso] = (pop, col["zh"][i], col["name"][i])
    for u, (pop, zh, en) in best.items():
        if u in units:
            out[u]["city"] = [zh, en, round(pop, -3)]
    print(f"  其他主題：V-Dem 政體 {regime_year} 年、國際組織 {orgs['years'][-1]} 年")
    return out, regime_year


def _base36(n: int) -> str:
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    s = ""
    while n:
        n, r = divmod(n, 36)
        s = digits[r] + s
    return s or "0"
