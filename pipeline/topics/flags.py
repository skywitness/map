"""國旗主題：每個國家與地區的國旗畫在地圖上，加上國旗的顏色、圖案、採用年份、長寬比（單一快照，前端 timeless）。

資料：
- 畫哪一面旗：Wikidata（CC0，sources/wikidata_flags.py）的國旗圖檔（P41）現行值（沒有結束時間、沒有棄用；有偏好值時只看偏好值），
  國家的範圍跟國家小檔案一樣（地圖的 1:50m 國界加上沒有形狀的吐瓦魯、托克勞、直布羅陀；南極洲、錫亞琴冰川沒有國旗）。
  對不上、或屬地與爭議地區要指定的，寫在 FLAG_FILES（每一條寫理由）。
- 圖檔：Wikimedia Commons（sources/commons.py）的 SVG，逐檔檢查授權（Commons 從檔案頁的授權模板整理的 extmetadata）：
  只收公有領域、CC0，與要求標示姓名的阿曼政府開放授權（OGL-om 1.0）；不在 LICENCES 裡的會報錯。
  Commons 標了 insignia（國徽、國旗這類標誌）的，前端與 CREDITS.txt 註明「國家象徵的使用可能受各國法律限制，跟著作權無關」。
- 最佳化：svgo（devDependency，pipeline/svgo.mjs）依序試小數 1、2、3 位，跟原檔各畫成 400 px 寬的點陣圖比對
  （差超過 48/255 的像素不到 0.1%）才採用；都不行的用 scour、再不行用原檔。輸出 svg/<地區>-<雜湊>.svg（內容一樣的共用一個檔）。
- 顏色：最佳化後的 SVG 用 resvg 畫成 600 px 寬、不反鋸齒（每個像素都是 SVG 裡的某個顏色），逐色依 OKLCH 歸到
  紅、白、藍、綠、黃（含金色）、黑、橘、其他（灰、棕、紫…）（classify()，門檻逐一看過各國旗的主要顏色後定的），
  算各類占國旗面積的比例（透明的部分不算：尼泊爾的旗不是長方形）。官方說法跟外觀不同的寫在 COLOUR_FIXES。
- 圖案：FEATURES 是逐一看過每一面旗的清單；Wikidata 國旗項目的描繪內容（P180）對到同一組圖案，兩邊不一樣的
  都要在 FEATURE_REASONS 寫理由，否則報錯。旗幟家族（FAMILIES）依設計的來源分類，每一類寫判斷的依據。
- 採用年份：目前這一版國旗開始使用的年份。改了圖案或徽章（包括依新法重新繪製）算新的一版；只改顏色深淺或長寬比例的不算；
  停用後再採用的算再採用的年份。預設用 Wikidata 現行國旗圖檔陳述的起始時間（P580），沒有時用國旗項目的成立時間（P571）；
  兩者對不上、或都沒有的，在 YEAR_FIXES 逐一指定並寫理由（側欄的附註），沒寫會報錯。台灣（1928 年）執行時跟 Wikidata 核對。
- 長寬比：SVG 的寬高（高:寬，化成最簡的整數比），跟 Wikidata 國旗項目的長寬比（P2061）核對，對不上的印出來
  （2026-10：貝里斯、柬埔寨、維德角、敘利亞、萬那杜、法羅群島，都照 Commons 的圖檔，見 DESIGN.md）。
- 名稱：Wikidata 國旗項目的中文名稱常用對岸的譯名（格魯吉亞国旗、澳大利亞國旗），不用；正式名稱不是「<國名>國旗」的寫在
  NAME_FIXES（中華民國國旗、香港特別行政區區旗），通稱寫在 NICKNAMES（青天白日滿地紅旗），其他的由前端用網站自己的國名組成。

屬地：有自己正式的旗就畫自己的，沒有就畫主權國的國旗（主權國與關係用國家小檔案的 TERRITORIES），側欄寫明是哪一種。
爭議地區畫當地政府使用的旗（科索沃、巴勒斯坦、西撒哈拉畫撒拉威阿拉伯民主共和國的旗、索馬利蘭、北賽普勒斯、台灣），
說明文字用國家小檔案的 STATUS（src/topics/profiles.ts），不另加評論。

輸出（public/data/topics/flags/）：
- flags.json：每個地區的國旗（圖檔、名稱、長寬比、顏色組成、圖案、家族、採用年份與日期、屬地或爭議的說明、來源與授權）
- adopted.json（採用年份；也是「國旗地圖」的指標檔，tooltip 的短註是國旗的名稱）、main-colour.json（主要顏色）、
  colours/<顏色>.json（占國旗面積的 %）、features/<圖案>.json（有 1、沒有 0）、family.json、ratio.json
- svg/<地區>-<雜湊>.svg 與 svg/CREDITS.txt（每個檔的 Commons 頁面、授權、作者、insignia 註記）、manifest.json
"""
from __future__ import annotations

import hashlib
import io
import json
import re
import shutil
import subprocess
from collections import Counter, defaultdict
from fractions import Fraction

import numpy as np
import resvg_py
from PIL import Image
from scour import scour

from common import CACHE_DIR, OUT_DIR, ROOT, indicator_file, now_iso, write_json
from sources import commons, wikidata_flags
from topics.profiles import TERRITORIES

OUT = OUT_DIR / "topics" / "flags"
SVG_DIR = OUT / "svg"
YEAR = 2026  # 單一快照（前端 timeless）
SHAPELESS = ("TUV", "TKL", "GIB")  # 地圖上沒有形狀、只畫圓點的地區（WorldMap.tsx 的 SHAPELESS）
WIKI_ISO = {"XKX": "XKS"}  # 地圖代碼 → Wikidata 的 P298
NO_FLAG = {"ATA", "_SIA"}  # 南極洲（南極條約的旗不是國旗）、錫亞琴冰川

# ── 1. 畫哪一面旗 ──────────────────────────────────────────────────────
# Wikidata 的 P41 現行值以外指定的檔案：(Commons 檔名, 理由)
FLAG_FILES = {
    "ESH": ("Flag of the Sahrawi Arab Democratic Republic.svg",
            "爭議地區畫當地政府使用的旗：撒拉威阿拉伯民主共和國（波利薩里奧陣線宣布成立的國家）的國旗；Wikidata 把這個陳述標成棄用"),
    "BLM": ("Flag of France.svg", "聖巴瑟米沒有正式的地區旗，官方用法國國旗；Wikidata 的地方旗（白底徽章）沒有官方地位，而且圖檔是 CC BY 2.5"),
    "SPM": ("Flag of France.svg", "聖皮耶與密克隆的地方旗（帆船與巴斯克、布列塔尼、諾曼第的旗）沒有官方地位，官方用法國國旗"),
    "WLF": ("Flag of France.svg", "瓦利斯和富圖納的地方旗沒有官方地位，官方用法國國旗"),
    "NCL": ("Flag of France.svg",
            "新喀里多尼亞 2010 年起官方同時懸掛法國國旗與卡納克旗（Wikidata 的 P41 是卡納克旗）；地圖只能畫一面，畫兩面都有的法國國旗，側欄寫明"),
    "SHN": ("Flag of Saint Helena.svg",
            "地圖上的 SHN 是聖赫勒拿、阿森松和特里斯坦達庫尼亞；Wikidata 的 P41 是英國國旗，這裡畫首府所在的聖赫勒拿的旗（1984 年起），側欄寫明另外兩地各有自己的旗"),
    "IOT": ("Flag of the British Indian Ocean Territory.svg", "Wikidata 的 P41 是專員的旗；領地本身的旗是 1990 年的這一面"),
    "_IOT": ("Flag of Australia (converted).svg",
             "地圖上的印度洋領地是聖誕島與科科斯（基林）群島合成的一塊，兩地各有地方旗，這裡畫兩地共同的澳洲國旗"),
    "TGO": ("Flag of Togo.svg", "Wikidata 的偏好值是 3:2 的版本；多哥國旗的法定比例是黃金比例（約 1:1.618），用這個版本"),
}
# 側欄的說明（中文, 英文）：屬地與爭議地區用哪一面旗、比例特別的國旗
NOTES = {
    "AFG": ("2021 年塔利班重新掌權後，政府使用白底黑字清真言的旗（1997–2001 年也用過）。多數國家沒有正式承認塔利班政府，"
            "2024 年巴黎奧運的阿富汗選手仍用 2013–2021 年的三色旗。",
            "Since retaking power in 2021, the Taliban government has used a white flag bearing the Shahada in black (also used in 1997–2001). "
            "Most countries have not formally recognised the Taliban government, and Afghan athletes at the 2024 Paris Olympics competed under the 2013–2021 tricolour."),
    "ESH": ("這裡畫撒拉威阿拉伯民主共和國（波利薩里奧陣線 1976 年宣布成立的國家）的國旗。",
            "Shown here is the flag of the Sahrawi Arab Democratic Republic, the state proclaimed by the Polisario Front in 1976."),
    "NCL": ("2010 年起新喀里多尼亞官方同時懸掛法國國旗與卡納克旗；地圖畫兩面都有的法國國旗。",
            "Since 2010 New Caledonia has officially flown the French flag together with the Kanak flag; the map shows the French flag, which is flown in both cases."),
    "BLM": ("聖巴瑟米沒有正式的地區旗，官方使用法國國旗；當地另有沒有官方地位的地方旗。",
            "Saint Barthélemy has no official flag of its own and uses the French flag; a local flag exists without official status."),
    "MAF": ("法屬聖馬丁沒有正式的地區旗，官方使用法國國旗。", "Saint Martin has no official flag of its own and uses the French flag."),
    "SPM": ("聖皮耶與密克隆官方使用法國國旗；當地常見的帆船旗沒有官方地位。",
            "Saint Pierre and Miquelon officially uses the French flag; the widely seen local flag with a ship has no official status."),
    "WLF": ("瓦利斯和富圖納官方使用法國國旗；當地另有沒有官方地位的地方旗。",
            "Wallis and Futuna officially uses the French flag; a local flag exists without official status."),
    "HMD": ("赫德島和麥克唐納群島無人居住，屬於澳洲，使用澳洲國旗。",
            "Heard Island and McDonald Islands are uninhabited Australian territory and use the Australian flag."),
    "_IOT": ("地圖上的印度洋領地是聖誕島與科科斯（基林）群島，屬於澳洲；兩地各有地方旗，這裡畫共同的澳洲國旗。",
             "The Indian Ocean Territories on this map are Christmas Island and the Cocos (Keeling) Islands, both Australian; each has a local flag, and the shared Australian flag is shown."),
    "SHN": ("這裡畫聖赫勒拿的旗；同一個屬地的阿森松島、特里斯坦達庫尼亞各有自己的旗。",
            "Shown is the flag of Saint Helena; Ascension Island and Tristan da Cunha, in the same territory, each have their own flag."),
    "HKG": ("香港特別行政區區旗，1997 年 7 月 1 日起使用。", "The regional flag of the Hong Kong Special Administrative Region, in use since 1 July 1997."),
    "MAC": ("澳門特別行政區區旗，1999 年 12 月 20 日起使用。", "The regional flag of the Macao Special Administrative Region, in use since 20 December 1999."),
    "GBR": ("聯合旗沒有法定的長寬比，常見 1:2 與 3:5；這裡依 Wikidata 的偏好值畫 3:5。",
            "The Union Flag has no statutory proportions; both 1:2 and 3:5 are common. The 3:5 version preferred by Wikidata is shown."),
    "TGO": ("多哥國旗的法定比例是黃金比例（約 1:1.618）。", "Togo's flag is defined in the golden ratio (about 1:1.618)."),
    "NPL": ("世界上唯一不是長方形的國旗：兩個疊在一起的三角形。", "The only national flag that is not rectangular: two stacked pennants."),
    "CHE": ("正方形的國旗（另一面是梵蒂岡）；瑞士的商船旗是 2:3。", "A square flag (the other is the Vatican's); the Swiss merchant flag is 2:3."),
    "VAT": ("正方形的國旗（另一面是瑞士）。", "A square flag (the other is Switzerland's)."),
    "BOL": ("這裡畫一般的國旗；國家機關用的旗中間加國徽。", "Shown is the civil flag; the state flag adds the coat of arms."),
    "CRI": ("這裡畫一般的國旗；國家機關用的旗加國徽。", "Shown is the civil flag; the state flag adds the coat of arms."),
    "PER": ("這裡畫一般的國旗；國家機關用的旗中間加國徽。", "Shown is the civil flag; the state flag adds the coat of arms."),
    "VEN": ("這裡畫一般的國旗；國家機關用的旗左上角加國徽。", "Shown is the civil flag; the state flag adds the coat of arms in the canton."),
    "PRY": ("兩面不一樣：正面是國徽（這裡畫的），背面是國庫的印章（獅子與自由帽）。",
            "The two sides differ: the national seal on the front (shown here) and the treasury seal, with a lion and liberty cap, on the back."),
}

# 授權：Commons 的 LicenseShortName → 頁尾與 CREDITS.txt 寫的名稱
LICENCES = {"Public domain": "Public domain", "CC0": "CC0 1.0", "OGL-om 1.0": "Open Government Licence – Oman 1.0"}

# ── 2. 顏色 ─────────────────────────────────────────────────────────
COLOURS = ("red", "white", "blue", "green", "yellow", "black", "orange", "other")
COLOUR_CODE = {c: i + 1 for i, c in enumerate(COLOURS[:-1])} | {"other": 9}
TIED = 8  # 主要顏色：前兩種的面積差不到 2 個百分點
COLOUR_ZH = {"red": "紅", "white": "白", "blue": "藍", "green": "綠", "yellow": "黃", "black": "黑", "orange": "橘", "other": "其他"}
COLOUR_EN = {"red": "red", "white": "white", "blue": "blue", "green": "green", "yellow": "yellow", "black": "black", "orange": "orange", "other": "other"}
# 官方說法跟外觀的分類不同的顏色：{(地區, 色碼): (類別, 理由)}
COLOUR_FIXES = {
    ("ARM", "#f2a800"): ("orange", "亞美尼亞國旗法寫的是杏色（橘色），外觀偏黃，依官方說法歸橘色"),
}

# ── 3. 圖案（逐一看過每一面旗） ─────────────────────────────────────────
# 星星、新月、太陽、十字、動物包括國徽或徽章的主要圖案（斯洛維尼亞國徽的三顆星、厄瓜多國徽頂上的神鷹），
# 不含王冠、三重冕頂上的小十字這種細節（克羅埃西亞國徽王冠裡的五個小盾也不算）。
# 英國國旗是三個十字疊成的，算十字；左上角有米字旗的旗歸在「英國國旗」，不重複算十字
FEATURES = {
    "stars": "ABW AGO ATF AUS AZE BDI BFA BIH BRA CAF CHL CHN CMR COD COK COM CPV CUB CUW DJI DMA DZA ESH ETH FSM GHA GNB "
             "GNQ GRD HKG HMD HND ISR JOR KNA LBR LBY MAC MAR MHL MMR MNP MOZ MRT MYS NIU NRU NZL PAK PAN PHL PNG PRI PRK PRY "
             "SEN SGP SLB SOM SSD STP SUR SVN SYR TGO TJK TKL TKM TLS TUN TUR TUV USA UZB VEN VNM WSM XKX ZWE _CYN _IOT _SOL",
    "crescent": "AZE BRN COM DZA ESH LBY MDV MNG MRT MYS NPL PAK SGP TKM TUN TUR UZB _CYN",
    "sun": "ARG ATG BGD ECU GRL JPN KAZ KGZ KIR MKD MNG MWI NAM NER NPL PHL PYF RWA SXM TWN URY",
    "cross": "ALA BDI CHE DMA DNK DOM FIN FJI FRO GBR GEO GGY GRC ISL JAM JEY MLT NOR SRB SVK SWE TON",
    "unionjack": "AIA AUS BMU COK CYM FJI FLK GBR HMD IOT MSR NIU NZL PCN SGS SHN TCA TUV VGB _IOT",
    "emblem": "AIA AND BLZ BMU BRN CYM DOM ECU EGY ESP ETH FJI FLK GNQ GTM GUM HRV HTI IRN JEY MDA MEX MNE MSR NIC OMN "
              "PCN PRT PRY PYF SGS SHN SLV SMR SRB SVK SVN SXM TCA VAT VGB VIR",
    "animal": "AIA ALB AND ASM BMU BTN CYM DMA ECU EGY ESP FJI FLK GTM JEY KAZ KIR LKA MDA MEX MNE PNG SGS SHN SRB SXM "
              "TCA UGA VIR ZMB ZWE",
    "vertical": "AND BEL BLM CIV CMR FRA GIN IRL ITA MAF MDA MEX MLI NCL ROU SEN SPM TCD VCT WLF",
    "horizontal": "ABW AGO ARE ARG ARM AUT AZE BEN BFA BGR BHS BLR BLZ BOL BWA CAF CHL COL COM CPV CRI CUB CUW CZE DEU DJI "
                  "ECU EGY ESH ESP EST ETH GAB GHA GIB GMB GNB GNQ GRC GRL HND HRV HTI HUN IDN IND IOT IRN IRQ ISR JOR KEN "
                  "KHM KIR KWT LAO LBN LBR LBY LIE LSO LTU LUX LVA MCO MDG MMR MOZ MRT MUS MWI MYS NER NIC NLD NRU OMN PHL "
                  "POL PRI PRK PRY PSE PYF RUS RWA SDN SGP SLE SLV SMR SRB SSD STP SUR SVK SVN SWZ SXM SYR TGO THA TJK UGA "
                  "UKR URY USA UZB VEN VUT YEM ZWE _CYN _SOL",
}
# Wikidata 國旗項目的 P180（描繪的內容）對到的圖案
WIKIDATA_FEATURES = {
    "stars": {"Q379860", "Q3592528", "Q27921428", "Q161396", "Q2915591", "Q20750867", "Q28050132", "Q28050042", "Q28045076",
              "Q182186", "Q208578", "Q10542", "Q3592503", "Q3033697"},
    "crescent": {"Q5488888", "Q3592503"},
    "sun": {"Q525", "Q1047667", "Q193294"},
    "cross": {"Q13100174", "Q612908", "Q201960", "Q614328", "Q40843", "Q1585890", "Q891515", "Q1143510"},
    "unionjack": {"Q3173323", "Q885701"},
    "emblem": {"Q200195", "Q184252", "Q201044", "Q206398", "Q211759", "Q207533", "Q242981", "Q170553", "Q188028", "Q173189",
               "Q207785", "Q199860", "Q203016", "Q255719", "Q435400", "Q752770", "Q435561", "Q5138413", "Q2301719", "Q28033669",
               "Q437414", "Q462724", "Q331881", "Q460585", "Q223483", "Q189590", "Q193781", "Q191728", "Q244988", "Q207285",
               "Q203378", "Q193715", "Q109120", "Q213034", "Q457635", "Q207526", "Q271201", "Q207701", "Q170600", "Q170867",
               "Q358209"},
    "animal": {"Q2344734", "Q140", "Q203472", "Q217497", "Q335992", "Q722475", "Q1165844", "Q749577", "Q127216", "Q528117",
               "Q358148", "Q179359", "Q358209", "Q622964"},
}
# 清單跟 Wikidata 不同的地方（地區, 圖案）→ 理由；沒有寫的會報錯。多半是 Wikidata 的 P180 只寫了「某國國徽」，沒有列出國徽裡的圖案
FEATURE_REASONS: dict[tuple[str, str], str] = {
    ("AIA", "animal"): "徽章是三隻海豚",
    ("AND", "animal"): "國徽右下角是貝亞恩的兩頭牛",
    ("BMU", "emblem"): "右邊是百慕達的徽章（紅獅抱著沉船的盾）",
    ("BMU", "animal"): "徽章的紅獅子",
    ("BOL", "emblem"): "這裡畫一般的國旗，沒有國徽；Wikidata 的國旗項目也涵蓋國家機關用的旗",
    ("CRI", "emblem"): "這裡畫一般的國旗，沒有國徽；Wikidata 的國旗項目也涵蓋國家機關用的旗",
    ("BRN", "crescent"): "國徽下方的新月",
    ("CYM", "animal"): "徽章的獅子與海龜",
    ("ECU", "sun"): "國徽橢圓頂端的太陽",
    ("ECU", "animal"): "國徽頂上的安地斯神鷹",
    ("ERI", "emblem"): "國旗上的是橄欖枝與橄欖環，不是厄利垂亞的國徽（國徽是駱駝）",
    ("ESP", "animal"): "國徽裡萊昂王國的紫色獅子",
    ("ETH", "stars"): "藍色圓盤上的五角星",
    ("FJI", "cross"): "盾徽上的聖喬治十字",
    ("FJI", "animal"): "盾徽上方的獅子與下方的鴿子",
    ("FLK", "animal"): "徽章上的綿羊",
    ("GBR", "unionjack"): "英國國旗本身",
    ("GNQ", "stars"): "國徽上方的六顆星",
    ("GTM", "animal"): "國徽的格查爾鳥",
    ("HKG", "stars"): "洋紫荊每片花瓣上有一顆紅星",
    ("MDA", "animal"): "國徽的老鷹與原牛頭",
    ("MEX", "animal"): "國徽的老鷹與蛇",
    ("MHL", "sun"): "馬紹爾群島國旗上是 24 道光芒的星，不是太陽",
    ("MNE", "animal"): "國徽的雙頭鷹與獅子",
    ("MNG", "crescent"): "索永布符號頂端的火焰下是太陽與新月",
    ("MNG", "sun"): "索永布符號頂端的火焰下是太陽與新月",
    ("NPL", "stars"): "尼泊爾國旗的十二角形是太陽，不是星（Wikidata 寫十二角星）",
    ("PRY", "stars"): "國徽中央的星",
    ("SGS", "animal"): "徽章的獅子、海狗、企鵝與馴鹿",
    ("SRB", "cross"): "國徽胸前盾上的十字（四角各一個火鐮）",
    ("SRB", "animal"): "國徽的雙頭鷹",
    ("SVK", "cross"): "國徽的雙十字",
    ("SVN", "stars"): "國徽上方的三顆六角星",
    ("SXM", "animal"): "徽章頂上的鵜鶘",
    ("SXM", "sun"): "徽章頂上鵜鶘後面的太陽",
    ("TCA", "animal"): "徽章上的海螺與龍蝦",
    ("VAT", "emblem"): "交叉的鑰匙與三重冕是教廷的徽章",
    ("VIR", "emblem"): "美國國徽（老鷹與盾）的簡化版",
}

# 旗幟家族（依設計的來源，互不重疊）：代碼 → (地區, 依據)
FAMILIES = {
    1: ("ALA DNK FIN FRO ISL NOR SWE", "北歐十字：十字的交點偏向旗桿那一側（源自丹麥國旗）"),
    2: ("AIA AUS BMU COK CYM FJI FLK GBR HMD IOT MSR NIU NZL PCN SGS SHN TCA TUV VGB _IOT",
        "英國國旗，或左上角有英國國旗（英國與它的海外領土、大英國協的部分國家）"),
    3: ("BEN BFA CAF CMR COG ETH GHA GIN GNB KEN MLI MWI SEN SSD STP TGO ZWE",
        "泛非顏色：衣索比亞的綠黃紅（迦納 1957 年起許多非洲國家採用），或 1920 年起非裔運動的紅黑綠（肯亞、馬拉威、南蘇丹）；"
        "中非共和國的旗刻意結合法國三色與泛非顏色"),
    4: ("ARE EGY ESH IRQ JOR KWT LBY PSE SDN SYR YEM", "泛阿拉伯顏色：1916 年阿拉伯起義旗的紅、白、綠、黑"),
    5: ("CZE HRV RUS SRB SVK SVN", "泛斯拉夫顏色：1848 年布拉格斯拉夫大會採用的白、藍、紅（源自俄羅斯國旗）"),
    6: ("COL ECU VEN", "大哥倫比亞：1819–1831 年大哥倫比亞共和國的黃、藍、紅"),
    7: ("CRI GTM HND NIC SLV", "中美洲聯邦：1823–1841 年中美洲聯邦共和國的藍白藍（哥斯大黎加加了紅色）"),
}

# 地圖上國旗的重點（0–1，旗面的相對位置）：國土比國旗瘦長、要裁掉一部分時，盡量留住這一點。沒寫的是正中央
FOCAL = {
    **{iso: (0.25, 0.25) for iso in "CHL GRC LBR MLT MYS PAN TGO TON TWN URY USA WSM".split()},  # 左上角的方塊
    **{iso: (0.22, 0.5) for iso in "BHS COM CUB CZE DJI ESH GNQ JOR MOZ PHL PRI PSE SDN SSD STP SXM TLS ZWE".split()},  # 旗桿側的三角形
}

# ── 4. 採用年份 ─────────────────────────────────────────────────────
# 地區 → (年份, 理由中文, 理由英文)；理由是側欄的附註
YEAR_FIXES = {
    "ARG": (1818, "貝爾格拉諾 1812 年設計藍白藍三條；中間有五月太陽的版本 1818 年起是官方的旗，1985 年起成為唯一的國旗。",
            "Belgrano's blue-white-blue design dates from 1812; the version with the Sun of May has been an official flag since 1818 and the sole national flag since 1985."),
    "AUS": (1908, "1901 年的設計競賽選出；1908 年聯邦之星改成七個角，現在的版本從此開始。",
            "Chosen in a 1901 design competition; the current version dates from 1908, when the Commonwealth Star gained its seventh point."),
    "AUT": (1945, "紅白紅 1918 年起，1938–1945 年被德國併吞期間停用，1945 年恢復。",
            "Red-white-red since 1918; not used during the German annexation of 1938–1945 and restored in 1945."),
    "AZE": (1991, "1918 年首次採用，蘇聯時期停用，1991 年恢復；2013 年只調整顏色。",
            "First adopted in 1918, dropped in the Soviet era and restored in 1991; only the shades were adjusted in 2013."),
    "BEN": (1990, "1959 年首次採用，1975–1990 年改用人民共和國的綠底紅星旗，1990 年恢復。",
            "First adopted in 1959; replaced by the People's Republic's green flag with a red star in 1975 and restored in 1990."),
    "BGR": (1990, "白綠紅三色 1879 年起，共產時期加上國徽，1990 年拿掉。",
            "White-green-red since 1879; the communist-era emblem was removed in 1990."),
    "BLR": (1995, "1995 年公投後採用；2012 年只調整左側紋樣的比例。",
            "Adopted after the 1995 referendum; only the proportions of the ornament were adjusted in 2012."),
    "BMU": (1910, "1910 年起；1999 年只把徽章放大。", "In use since 1910; the badge was only enlarged in 1999."),
    "BOL": (1851, "目前的紅黃綠三色 1851 年起（Wikidata 國旗項目的 1825 年是更早的另一面旗）。",
            "The current red-yellow-green tricolour dates from 1851 (the 1825 date on Wikidata's flag item is an earlier, different flag)."),
    "BRA": (1992, "1889 年採用，星星的數目隨州的數目增加，27 顆星的版本 1992 年起。",
            "Adopted in 1889; stars have been added as states were created, and the 27-star version dates from 1992."),
    "COG": (1991, "1959 年首次採用，1970–1991 年改用人民共和國的紅旗，1991 年恢復。",
            "First adopted in 1959; replaced by the People's Republic's red flag in 1970 and restored in 1991."),
    "COM": (2002, "2001 年 12 月的憲法公投通過，2002 年 1 月正式升旗。",
            "Approved in the December 2001 constitutional referendum and first officially raised in January 2002."),
    "CRI": (1848, "藍白紅白藍五條 1848 年起；1906 年的修改只改國家機關用的旗上的國徽。",
            "The five blue-white-red stripes date from 1848; the 1906 change concerned only the arms on the state flag."),
    "CUB": (1902, "1849 年設計，1869 年獨立戰爭的瓜伊馬羅制憲會議採用，1902 年古巴共和國成立後正式使用。",
            "Designed in 1849 and adopted by the independence fighters' Guáimaro Assembly in 1869; official since the Republic of Cuba was founded in 1902."),
    "CYM": (1999, "1958 年起的藍船旗，1999 年拿掉徽章外面的白色圓盤，現在的版本從此開始。",
            "A Blue Ensign since 1958; the current version dates from 1999, when the white disc behind the arms was removed."),
    "CYP": (1960, "1960 年起；2006 年只改島的顏色。", "In use since 1960; only the colour of the island was changed in 2006."),
    "CZE": (1920, "1920 年起是捷克斯洛伐克的國旗，1993 年捷克沿用。",
            "The flag of Czechoslovakia from 1920, retained by the Czech Republic in 1993."),
    "DEU": (1949, "黑紅金三色 1919–1933 年用過，1949 年西德再採用，1990 年統一後沿用。",
            "Black-red-gold was used in 1919–1933 and readopted by West Germany in 1949, then kept after reunification in 1990."),
    "DMA": (1990, "1978 年獨立時採用，1981、1988、1990 年各修改過一次圖案細節，現在的版本是 1990 年起。",
            "Adopted at independence in 1978 and modified in 1981, 1988 and 1990; the current version dates from 1990."),
    "DNK": (1748, "丹麥國旗的圖案至少從 14 世紀就在使用（傳說是 1219 年），1748 年的法令規定了商船旗的樣式（Wikidata）。",
            "The Danish design has been in use since at least the 14th century (legend says 1219); a 1748 ordinance set the merchant flag's form (Wikidata)."),
    "ECU": (2009, "黃藍紅三色加國徽 1900 年起；2009 年依新規定重新繪製國徽，現在的版本從此開始。",
            "Yellow-blue-red with the arms since 1900; the current version dates from 2009, when the arms were redrawn to a new specification."),
    "EGY": (1984, "1984 年 10 月起（Wikidata 國旗圖檔陳述的 1983 年對不上法令）。",
            "In use since October 1984 (the 1983 date on Wikidata's image statement does not match the law)."),
    "ESP": (1981, "紅黃紅三條 1785 年起是海軍旗、1843 年起是國旗；中間的國徽 1981 年改成現在的樣式。",
            "Red-yellow-red has been the naval ensign since 1785 and the national flag since 1843; the arms took their current form in 1981."),
    "EST": (1990, "1918 年首次採用，蘇聯時期禁用，1990 年恢復。", "First adopted in 1918, banned in the Soviet era and restored in 1990."),
    "ETH": (1996, "綠黃紅三色更早就在使用；中間加藍色圓盤與五角星的版本 1996 年起。",
            "Green-yellow-red is much older; the version with the blue disc and pentagram dates from 1996."),
    "FRA": (1830, "三色旗 1794 年採用，1815–1830 年改用波旁王朝的白旗，1830 年起沿用至今；2020 年只把藍色改深。",
            "Adopted in 1794, replaced by the Bourbon white flag in 1815–1830 and in use ever since 1830; only the blue was darkened in 2020."),
    "GHA": (1966, "1957 年獨立時採用，1964–1966 年中間一條改成白色，1966 年恢復。",
            "Adopted at independence in 1957; the middle stripe was white in 1964–1966, and the original was restored in 1966."),
    "GRC": (1822, "藍白條紋加十字的版本 1822 年起是海上用的旗，1978 年起成為唯一的國旗（只改了藍色）。",
            "The striped version with a cross has been the sea flag since 1822 and the sole national flag since 1978 (with a new shade of blue)."),
    "HKG": (1997, "1990 年全國人大通過，1997 年 7 月 1 日起使用。",
            "Approved by China's National People's Congress in 1990 and in use since 1 July 1997."),
    "HND": (1866, "五顆星的設計 1866 年起；1949、2022、2026 年只改藍色的深淺（2022 年改成青綠色，2026 年改回深藍）。",
            "The five-star design dates from 1866; only the shade of blue changed in 1949, 2022 and 2026 (turquoise in 2022, back to navy in 2026)."),
    "IND": (1947, "1947 年 7 月 22 日制憲會議通過（Wikidata 圖檔陳述的 1946 年有誤）。",
            "Adopted by the Constituent Assembly on 22 July 1947 (the 1946 date on Wikidata's image statement is wrong)."),
    "IRL": (1922, "1922 年愛爾蘭自由邦政府開始使用，1937 年憲法明定為國旗。",
            "Used by the government of the Irish Free State from 1922 and enshrined in the 1937 constitution."),
    "ITA": (1946, "1946 年共和國成立時拿掉王室的徽章；2006 年只規定顏色。",
            "The royal arms were removed when the republic was founded in 1946; only the shades were specified in 2006."),
    "JPN": (1870, "1870 年起是商船旗，1999 年的《國旗國歌法》定為國旗（只微調圓的位置與顏色）。",
            "The merchant flag from 1870, made the national flag by the 1999 Act on National Flag and Anthem (with minor changes to the disc's position and colour)."),
    "KGZ": (2023, "1992 年採用；2023 年把太陽的 40 道光芒從彎的改成直的，現在的版本從此開始。",
            "Adopted in 1992; the current version dates from 2023, when the sun's 40 rays were changed from curved to straight."),
    "KHM": (1993, "1948–1970 年用過，1993 年恢復。", "Used in 1948–1970 and restored in 1993."),
    "KOR": (1949, "太極旗 1883 年首次成為朝鮮的國旗，大韓民國 1949 年訂定現在的樣式（之後只調整顏色與比例）。",
            "The Taegukgi was first adopted by Joseon in 1883; the Republic of Korea fixed its current form in 1949 (with later changes to colours and proportions only)."),
    "LAO": (1975, "1945–1946 年寮國自由運動用過，1975 年寮人民民主共和國成立時採用。",
            "Used by the Lao Issara movement in 1945–1946 and adopted by the Lao People's Democratic Republic in 1975."),
    "LBY": (2011, "1951–1969 年王國時期的國旗，2011 年恢復。", "The flag of the kingdom in 1951–1969, restored in 2011."),
    "LCA": (1967, "1967 年起；2002 年只改了藍色與三角形的大小。",
            "In use since 1967; only the shade of blue and the size of the triangles changed in 2002."),
    "LIE": (1982, "藍紅兩色更早就在使用，1937 年加上王冠（跟海地的國旗區分），1982 年重新繪製王冠，現在的版本從此開始。",
            "Blue and red are older; the crown was added in 1937 to tell it apart from Haiti's flag, and the current version with a redrawn crown dates from 1982."),
    "LTU": (1988, "1918 年首次採用，蘇聯時期禁用，1988 年恢復；2004 年只改比例。",
            "First adopted in 1918, banned in the Soviet era and restored in 1988; only the proportions changed in 2004."),
    "LVA": (1990, "1923 年正式採用，蘇聯時期禁用，1990 年恢復。", "Officially adopted in 1923, banned in the Soviet era and restored in 1990."),
    "MAC": (1999, "1993 年全國人大通過，1999 年 12 月 20 日起使用。",
            "Approved by China's National People's Congress in 1993 and in use since 20 December 1999."),
    "MEX": (1968, "綠白紅三色 1821 年起；中間的國徽 1968 年改成現在的樣式。",
            "Green-white-red since 1821; the coat of arms took its current form in 1968."),
    "MNG": (1992, "1992 年起（拿掉共產時期的星）；2011 年只統一顏色與比例。",
            "In use since 1992, when the communist star was removed; only the colours and proportions were standardised in 2011."),
    "MWI": (2012, "1964 年獨立時採用，2010–2012 年改用白色太陽的版本，2012 年恢復。",
            "Adopted at independence in 1964; replaced by a version with a white sun in 2010–2012 and restored in 2012."),
    "NIC": (1971, "藍白藍加國徽 1908 年起；國徽 1971 年改成現在的樣式。",
            "Blue-white-blue with the arms since 1908; the arms took their current form in 1971."),
    "NLD": (1937, "紅白藍三色從 17 世紀就在使用，1937 年的皇家法令正式規定。",
            "Red-white-blue has been used since the 17th century and was formally established by royal decree in 1937."),
    "NZL": (1902, "1902 年 3 月 24 日起（1901 年的紐西蘭國旗法；Wikidata 國旗項目寫 1903 年）。",
            "In use since 24 March 1902 under the New Zealand Ensign Act 1901 (Wikidata's flag item says 1903)."),
    "PHL": (1919, "1898 年首次採用，1907–1919 年被美國殖民政府禁止，1919 年恢復；之後只改過藍色的深淺。",
            "First adopted in 1898, banned by the American colonial government in 1907–1919 and restored in 1919; only the shade of blue has changed since."),
    "POL": (1919, "1919 年起；1980 年的法律只重新規定顏色與比例。",
            "In use since 1919; a 1980 law only restated the colours and proportions."),
    "PRI": (1952, "1895 年設計，1952 年波多黎各自由邦成立時正式採用。",
            "Designed in 1895 and officially adopted when the Commonwealth of Puerto Rico was established in 1952."),
    "PRT": (1911, "共和國 1911 年 6 月起。", "The flag of the republic since June 1911."),
    "PYF": (1984, "1984 年自治法通過後採用。", "Adopted after the 1984 statute of autonomy."),
    "ROU": (1989, "藍黃紅三色 1867 年起，共產時期加上國徽，1989 年革命後拿掉。",
            "Blue-yellow-red since 1867; the communist arms were removed after the 1989 revolution."),
    "RUS": (1991, "白藍紅三色在帝俄時期就在使用，蘇聯時期停用，1991 年恢復；1993 年只改比例與顏色。",
            "White-blue-red was used in imperial Russia, dropped in the Soviet era and restored in 1991; only the proportions and shades changed in 1993."),
    "SHN": (1984, "聖赫勒拿的旗 1984 年起。", "The flag of Saint Helena has been in use since 1984."),
    "SLV": (1922, "1912 年採用，1921–1922 年改用中美洲聯邦的旗，1922 年恢復。",
            "Adopted in 1912; the flag of the Federation of Central America replaced it in 1921–1922, and it was restored in 1922."),
    "SMR": (2011, "白藍兩色加國徽 1862 年起；2011 年的法律重新規定國徽的畫法，現在的版本從此開始。",
            "White and blue with the arms since 1862; the current version dates from a 2011 law that redefined the arms."),
    "SOM": (1954, "1954 年託管時期採用，1960 年獨立後沿用。", "Adopted under trusteeship in 1954 and kept at independence in 1960."),
    "SRB": (2010, "紅藍白三色加國徽 2004 年起；2010 年重新繪製國徽，現在的版本從此開始。",
            "Red-blue-white with the arms since 2004; the current version, with redrawn arms, dates from 2010."),
    "PRY": (2013, "紅白藍三色加國徽 1842 年起；2013 年依新法重新繪製兩面的徽章，現在的版本從此開始。",
            "Red-white-blue with the seals since 1842; the current version dates from 2013, when a new law redrew the seals on both sides."),
    "SYR": (2024, "1932–1958、1961–1963 年用過的獨立時期國旗，2024 年 12 月起過渡政府使用，2025 年 3 月的憲法宣言明定。",
            "The independence-era flag of 1932–1958 and 1961–1963, used by the transitional authorities since December 2024 and confirmed by the constitutional declaration of March 2025."),
    "TKL": (2009, "2009 年起（Wikidata 國旗項目寫 2021 年）。", "In use since 2009 (Wikidata's flag item says 2021)."),
    "TKM": (1997, "1992 年採用，1997 年加上橄欖枝，現在的版本從此開始；2001 年只改比例。",
            "Adopted in 1992; the current version, with olive branches, dates from 1997; only the proportions changed in 2001."),
    "TLS": (2002, "1975 年東帝汶獨立革命陣線宣布獨立時用過，2002 年獨立後採用。",
            "Used by Fretilin when it declared independence in 1975, and adopted at independence in 2002."),
    "TUN": (1831, "1831 年起（Wikidata）；1999 年只規定比例。", "In use since 1831 (Wikidata); a 1999 law only fixed the proportions."),
    "TWN": (1928, "1928 年 12 月 17 日國民政府明定為中華民國國旗。",
            "Designated the national flag of the Republic of China by the Nationalist Government on 17 December 1928."),
    "USA": (1960, "星條旗 1777 年採用，星星的數目隨州的數目增加，50 顆星的版本 1960 年 7 月 4 日起。",
            "Adopted in 1777; stars have been added with each new state, and the 50-star version dates from 4 July 1960."),
    "VEN": (2006, "8 顆星的版本 2006 年 3 月起。", "The eight-star version dates from March 2006."),
    "ZMB": (1996, "1964 年獨立時採用；1996 年改了綠色與老鷹的畫法，現在的版本從此開始。",
            "Adopted at independence in 1964; the current version, with a new green and a redrawn eagle, dates from 1996."),
    "ZWE": (1980, "1980 年 4 月 18 日獨立時採用。", "Adopted at independence on 18 April 1980."),
    "ESH": (1976, "撒拉威阿拉伯民主共和國 1976 年宣布成立時採用。",
            "Adopted when the Sahrawi Arab Democratic Republic was proclaimed in 1976."),
}
TAIWAN_FLAG = ("Flag of the Republic of China.svg", "1928-12-17")  # 執行時跟 Wikidata 核對

# 國旗的通稱（側欄的大標題下面）：(中文, 英文)
NICKNAMES = {
    "TWN": ("青天白日滿地紅旗", "Blue Sky, White Sun and a Wholly Red Earth"),
    "CHN": ("五星紅旗", "Five-starred Red Flag"),
    "JPN": ("日章旗（日之丸）", "Hinomaru"),
    "USA": ("星條旗", "The Stars and Stripes"),
    "GBR": ("米字旗（聯合旗）", "Union Jack (Union Flag)"),
    "KOR": ("太極旗", "Taegukgi"),
    "CAN": ("楓葉旗", "The Maple Leaf"),
    "DNK": ("丹尼布洛旗", "Dannebrog"),
    "FRA": ("三色旗", "Le Tricolore"),
    "ITA": ("三色旗", "Il Tricolore"),
    "ESP": ("紅黃旗（Rojigualda）", "La Rojigualda"),
    "IND": ("三色旗（Tiranga）", "Tiranga"),
    "IDN": ("紅白旗（Sang Merah Putih）", "Sang Merah Putih"),
    "MYS": ("輝煌條紋旗（Jalur Gemilang）", "Jalur Gemilang"),
    "BRA": ("金綠旗（Auriverde）", "Auriverde"),
    "GRC": ("藍白旗（Galanolefki）", "Galanolefki"),
    "TUR": ("月星旗（Ay Yıldız）", "Ay Yıldız"),
    "VNM": ("金星紅旗", "Red Flag with a Golden Star"),
    "HKG": ("洋紫荊旗", "Bauhinia Flag"),
    "MAC": ("蓮花旗", "Lotus Flag"),
    "THA": ("三色旗（Thong Trairong）", "Thong Trairong"),
    "LKA": ("獅子旗", "Lion Flag"),
}
# 正式名稱不是「<國名>國旗」的（中文, 英文）。其他的旗前端用網站自己的國名組成「日本國旗」「百慕達旗」：
# Wikidata 國旗項目的中文名稱常用對岸的譯名（格魯吉亞国旗、澳大利亞國旗、史瓦濟蘭國旗），不用
NAME_FIXES = {
    "TWN": ("中華民國國旗", "Flag of the Republic of China"),
    "CHN": ("中華人民共和國國旗", "Flag of the People's Republic of China"),
    "HKG": ("香港特別行政區區旗", "Regional flag of Hong Kong"),
    "MAC": ("澳門特別行政區區旗", "Regional flag of Macao"),
    "ESH": ("撒拉威阿拉伯民主共和國國旗", "Flag of the Sahrawi Arab Democratic Republic"),
    "SHN": ("聖赫勒拿旗", "Flag of Saint Helena"),
    "AFG": ("阿富汗伊斯蘭酋長國的旗", "Flag of the Islamic Emirate of Afghanistan"),
}

# ── 5. 長寬比（高:寬） ─────────────────────────────────────────────────
RATIO_CODES = {"2:3": 1, "1:2": 2, "3:5": 3, "1:1": 4}
NON_RECT = 5
RATIO_OTHER = 9
RATIO_TEXT = {"TGO": "1:1.618"}  # 黃金比例


# ═════════════════════════════════════════════════════════════════════
def units() -> list[str]:
    with open(OUT_DIR / "geo" / "countries-50m.json", encoding="utf-8") as f:
        ids = {g["id"] for g in json.load(f)["objects"]["countries"]["geometries"]}
    return sorted((ids | set(SHAPELESS)) - NO_FLAG)


def current_files(stmts: list[wikidata_flags.FlagStatement], today: str) -> list[str]:
    """P41 的現行值：不含已棄用、結束時間已過的；有偏好值時只看偏好值"""
    live = [s for s in current(stmts, "P41", today)]
    preferred = [s for s in live if s.rank == "PreferredRank"]
    return sorted({s.value for s in (preferred or live)})


def current(stmts: list[wikidata_flags.FlagStatement], prop: str, today: str) -> list[wikidata_flags.FlagStatement]:
    return [s for s in stmts if s.prop == prop and s.rank != "DeprecatedRank" and not (s.end and s.end <= today)]


# ── SVG ───────────────────────────────────────────────────────────────

UNSAFE = re.compile(rb"<script|<foreignObject|\son[a-z]+\s*=|(?:xlink:)?href\s*=\s*[\"'](?:https?:|//)", re.I)


def render(svg: bytes, width: int, crisp: bool = False) -> np.ndarray:
    png = resvg_py.svg_to_bytes(
        svg_string=svg.decode("utf-8"),
        width=width,
        shape_rendering="crisp_edges" if crisp else "geometric_precision",
    )
    return np.asarray(Image.open(io.BytesIO(bytes(png))).convert("RGBA"))


def same_picture(a: np.ndarray, b: np.ndarray) -> bool:
    """最佳化後畫出來跟原檔一樣：差超過 48/255 的像素不到 0.1%"""
    if a.shape != b.shape:
        return False
    diff = np.abs(a.astype(int) - b.astype(int)).max(axis=2)
    return float((diff > 48).mean()) <= 0.001


def scour_svg(svg: bytes) -> bytes:
    options = scour.generateDefaultOptions()
    options.digits = 5
    options.cdigits = 4
    for flag in ("strip_comments", "remove_metadata", "remove_descriptive_elements", "strip_xml_prolog",
                 "strip_xml_space_attribute", "shorten_ids", "quiet"):
        setattr(options, flag, True)
    options.indent_type = "none"
    options.newlines = False
    text = svg.decode("utf-8")
    # scour 拆 viewBox 時不接受頭尾的空白（茅利塔尼亞的檔是 viewBox=" 0 0 …"）
    text = re.sub(r'viewBox="([^"]*)"', lambda m: 'viewBox="%s"' % " ".join(re.split(r"[\s,]+", m.group(1).strip())), text)
    return scour.scourString(text, options).encode("utf-8")


def svgo_batch(raw: dict[str, bytes]) -> dict[int, dict[str, bytes]]:
    """{小數位數: {名稱: 最佳化後的 SVG}}（node pipeline/svgo.mjs，一個位數跑一次）"""
    work = CACHE_DIR / "flags-svgo"
    if work.exists():
        shutil.rmtree(work)
    (work / "in").mkdir(parents=True)
    for name, data in raw.items():
        (work / "in" / f"{name}.svg").write_bytes(data)
    out: dict[int, dict[str, bytes]] = {}
    for digits in (1, 2, 3):
        subprocess.run(["node", str(ROOT / "pipeline" / "svgo.mjs"), str(work / "in"), str(work / f"p{digits}"), str(digits)],
                       check=True, cwd=ROOT)
        out[digits] = {name: (work / f"p{digits}" / f"{name}.svg").read_bytes() for name in raw}
    return out


def _root(svg: bytes) -> str:
    return re.search(r"<svg\b[^>]*>", svg[:4000].decode("utf-8", "replace"), re.S).group(0)


def _length(root: str, attr: str) -> float | None:
    """width、height 的數值（px 或沒有單位）；百分比、em 這類不算"""
    m = re.search(rf'\s{attr}="\s*([\d.]+)\s*(px)?\s*"', root)
    return float(m.group(1)) if m else None


def svg_size(svg: bytes) -> tuple[float, float]:
    """畫出來的寬高：有 width、height 用它們（卡達的檔 viewBox 是 75×18、preserveAspectRatio="none"，
    靠 width、height 拉成 28:11），沒有時用 viewBox"""
    root = _root(svg)
    w, h = _length(root, "width"), _length(root, "height")
    if w and h:
        return w, h
    vb = re.search(r'viewBox="([^"]+)"', root)
    _, _, vw, vh = (float(x) for x in re.split(r"[\s,]+", vb.group(1).strip()))
    return vw, vh


def with_size(svg: bytes) -> bytes:
    """根元素要有數值的 width、height（<img> 與 canvas 要知道原本的大小，沒有的話瀏覽器當成 300×150）"""
    root = _root(svg)
    if _length(root, "width") and _length(root, "height"):
        return svg
    text = svg.decode("utf-8")
    m = re.search(r"<svg\b[^>]*>", text, re.S)
    w, h = svg_size(svg)
    fixed = re.sub(r'\s(width|height)="[^"]*"', "", m.group(0)).replace("<svg", f'<svg width="{w:g}" height="{h:g}"', 1)
    return (text[:m.start()] + fixed + text[m.end():]).encode("utf-8")


# ── 顏色 ─────────────────────────────────────────────────────────────

def oklch(rgb: np.ndarray) -> np.ndarray:
    """sRGB（0–255，形狀 (…, 3)）→ OKLCH（L 0–1、C、h 度）"""
    c = rgb.astype(float) / 255
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929],
                   [0.2119034982, 0.6806995451, 0.1073969566],
                   [0.0883024619, 0.2817188376, 0.6299787005]])
    lms = np.cbrt(lin @ m1.T)
    m2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468],
                   [1.9779984951, -2.4285922050, 0.4505937099],
                   [0.0259040371, 0.7827717662, -0.8086757660]])
    lab = lms @ m2.T
    chroma = np.hypot(lab[..., 1], lab[..., 2])
    hue = np.degrees(np.arctan2(lab[..., 2], lab[..., 1])) % 360
    return np.stack([lab[..., 0], chroma, hue], axis=-1)


def classify(rgb: tuple[int, int, int]) -> str:
    """一個顏色歸到哪一類（COLOURS）。門檻（OKLCH）是逐一看過各國旗面積 0.5% 以上的顏色後定的：
    不丹的橘 h 41、印度 42 是橘，馬拉威的紅 h 32 是紅；牙買加的黑（#2d2926）L 0.28；卡達的栗色 h 5 算紅"""
    L, C, h = oklch(np.array(rgb))
    if C < 0.04:
        if L >= 0.8:
            return "white"  # 含銀色
        if L <= 0.36:
            return "black"
        return "other"  # 灰色
    if L < 0.25 and C < 0.08:
        return "black"
    if h >= 345 or h < 40:
        return "red"
    if h < 72:
        return "other" if L < 0.5 or C < 0.09 else "orange"  # 暗的、灰的是棕色、土色
    if h < 112:
        return "other" if C < 0.09 or (L < 0.5 and C < 0.12) else "yellow"  # 米色、土黃
    if h < 200:
        return "green"
    if h < 290:
        return "blue"
    return "other"  # 紫色、洋紅


def colour_shares(iso: str, svg: bytes) -> tuple[dict[str, float], float, list[tuple[str, str, float]]]:
    """({類別: 占比 0–1}, 不透明像素占外框的比例, [(色碼, 類別, 占比)…面積 0.5% 以上的顏色])"""
    img = render(svg, 600, crisp=True)
    mask = img[..., 3] >= 128
    px = img[..., :3][mask].reshape(-1, 3)
    keys, counts = np.unique(px, axis=0, return_counts=True)
    total = counts.sum()
    shares: dict[str, float] = defaultdict(float)
    major = []
    for key, n in zip(keys, counts):
        hexc = "#%02x%02x%02x" % tuple(int(x) for x in key)
        cls = COLOUR_FIXES.get((iso, hexc), (classify(tuple(int(x) for x in key)),))[0]
        shares[cls] += n / total
        if n / total >= 0.005:
            major.append((hexc, cls, n / total))
    return dict(shares), float(mask.mean()), sorted(major, key=lambda x: -x[2])


def ratio_text(w: float, h: float) -> str:
    """高:寬 化成最簡的整數比，例如 2:3、10:19、13:15：先找 40 以內、誤差 0.15% 以內的（圖檔的寬高常常四捨五入過），
    再找 400 以內、幾乎相等的（薩爾瓦多的 189:335），都沒有就寫 1:1.77"""
    r = w / h

    def error(p: int) -> float:
        q = round(r * p)
        return abs(q / p - r) / r if q else 1.0

    def text(p: int) -> str:
        f = Fraction(round(r * p), p)
        return f"{f.denominator}:{f.numerator}"

    # 幾乎相等的取最小的整數（丹麥 370×280 是 28:37，不是誤差 0.1% 的 25:33）
    exact = next((p for p in range(1, 401) if error(p) < 0.0002), None)
    if exact and exact <= 40:
        return text(exact)
    best = min(range(1, 41), key=error)
    if error(best) < 0.0015:
        return text(best)
    return text(exact) if exact else f"1:{r:.2f}"


# ═════════════════════════════════════════════════════════════════════
def build() -> None:
    all_units = units()
    stmts, _qids = wikidata_flags.statements()
    today = wikidata_flags.fetched_date()
    flag_items = wikidata_flags.items()

    def st(u: str) -> list[wikidata_flags.FlagStatement]:
        return stmts.get(WIKI_ISO.get(u, u), [])

    # ── 畫哪一面旗 ──
    chosen: dict[str, str] = {}
    for u in all_units:
        files = current_files(st(u), today)
        if u in FLAG_FILES:
            chosen[u] = FLAG_FILES[u][0]
            print(f"  {u}：指定 {chosen[u]}（Wikidata 的現行值 {files or '沒有'}）")
        elif len(files) == 1:
            chosen[u] = files[0]
        else:
            raise ValueError(f"{u} 的國旗圖檔不是剛好一個（{files}），請在 FLAG_FILES 指定")

    # 屬地：畫的是主權國的國旗還是自己的旗
    status: dict[str, dict] = {}
    for u in all_units:
        if u in TERRITORIES:
            sov = TERRITORIES[u][0]
            status[u] = {"sov": sov, "own": chosen[u] != chosen.get(sov)}

    # ── 圖檔、授權、最佳化 ──
    infos = commons.file_info(sorted(set(chosen.values())))
    missing = sorted(set(chosen.values()) - set(infos))
    if missing:
        raise ValueError(f"Commons 上找不到：{missing}")
    for name in sorted(set(chosen.values())):
        lic = infos[name].meta.get("LicenseShortName", "")
        if lic not in LICENCES:
            raise ValueError(f"{name} 的授權是「{lic}」，不在允許的清單裡（LICENCES）")
    # 同一個檔只處理一次，用它本來的國家命名（法國的旗給法屬聖馬丁等地共用，名稱、年份、圖案都跟著法國）
    owner: dict[str, str] = {}
    for name in sorted(set(chosen.values())):
        users = [u for u in all_units if chosen[u] == name]
        owner[name] = next((u for u in users if u not in TERRITORIES), users[0])
    raw: dict[str, bytes] = {}
    for name, u in owner.items():
        data = commons.download(infos[name])
        if UNSAFE.search(data):
            raise ValueError(f"{name} 含有程式碼或外部連結，不使用")
        raw[u] = data
    optimised = svgo_batch(raw)
    final: dict[str, bytes] = {}
    method: Counter = Counter()
    for u, data in raw.items():
        reference = render(data, 400)
        for digits in (1, 2, 3):
            candidate = optimised[digits][u]
            if same_picture(reference, render(candidate, 400)):
                final[u], how = candidate, f"svgo-{digits}"
                break
        else:
            candidate = scour_svg(data)
            final[u], how = (candidate, "scour") if same_picture(reference, render(candidate, 400)) else (data, "原檔")
            print(f"  {u}：svgo 畫出來跟原檔不同，用 {how}")
        final[u] = with_size(final[u])
        method[how] += 1
    print(f"  最佳化：{dict(method)}；原檔 {sum(map(len, raw.values())) / 1e6:.2f} MB → {sum(map(len, final.values())) / 1e6:.2f} MB")

    if SVG_DIR.exists():
        shutil.rmtree(SVG_DIR)
    SVG_DIR.mkdir(parents=True)
    file_of: dict[str, str] = {}
    for u, data in final.items():
        fname = f"{u}-{hashlib.sha1(data).hexdigest()[:8]}.svg"
        (SVG_DIR / fname).write_bytes(data)
        file_of[u] = fname

    # ── 顏色 ──
    colours: dict[str, dict[str, float]] = {}
    coverage: dict[str, float] = {}
    review: dict[str, list] = {}
    for u, data in final.items():
        shares, cover, major = colour_shares(u, data)
        colours[u], coverage[u], review[u] = shares, cover, major
    used = {(u, hexc) for u in final for hexc, _cls, _share in review[u]}
    for key, (cls, reason) in COLOUR_FIXES.items():
        if key not in used:
            raise ValueError(f"COLOUR_FIXES 的 {key} 沒有用到（國旗的顏色改了？）")

    # ── 名稱 ──
    def flag_item(u: str) -> str | None:
        """國旗項目（P163 的現行值）；好幾個時（瑞士的國旗與商船旗）取 QID 最小的"""
        found = sorted({s.value for s in current(st(u), "P163", today)}, key=lambda q: int(q[1:]))
        return found[0] if found else None

    item_of = {u: flag_item(owner[chosen[u]]) for u in all_units}

    # ── 圖案：清單跟 Wikidata 核對 ──
    members = {k: set(v.split()) for k, v in FEATURES.items()}
    for k, m in members.items():
        unknown = m - set(all_units)
        if unknown:
            raise ValueError(f"FEATURES[{k}] 有地圖上沒有的地區：{sorted(unknown)}")
    disagreements = []
    for u in all_units:
        q = item_of[u]
        depicts = set(flag_items.get(q, {}).get("P180", [])) if q else set()
        if not depicts or owner[chosen[u]] != u:
            continue
        for k, qids in WIKIDATA_FEATURES.items():
            wd = bool(depicts & qids)
            mine = u in members[k]
            if wd != mine and (u, k) not in FEATURE_REASONS:
                disagreements.append(f"{u} {k}：清單{'有' if mine else '沒有'}、Wikidata {'有' if wd else '沒有'}")
    if disagreements:
        raise ValueError("圖案跟 Wikidata 不同、沒有寫理由：\n    " + "\n    ".join(disagreements))
    for (u, k), reason in FEATURE_REASONS.items():
        if u not in all_units or k not in members:
            raise ValueError(f"FEATURE_REASONS 的 {(u, k)} 對不到")

    family_of: dict[str, int] = {}
    for code, (ms, _why) in FAMILIES.items():
        for u in ms.split():
            if u in family_of:
                raise ValueError(f"{u} 同時屬於兩個家族")
            family_of[u] = code
    if set(FAMILIES[2][0].split()) != members["unionjack"]:
        raise ValueError("英國國旗家族跟圖案的「英國國旗」不一致")

    # ── 採用年份 ──
    years: dict[str, int] = {}
    dates: dict[str, str] = {}
    problems = []
    for u in all_units:
        o = owner[chosen[u]]
        if o != u:
            continue
        a = sorted({s.start for s in current(st(u), "P41", today) if s.value == chosen[u] and s.start})
        q = item_of[u]
        b = sorted({v[:10] for v in flag_items.get(q, {}).get("P571", [])}) if q else []
        a_years = {int(x[:4]) for x in a}
        b_years = {int(x[:4]) for x in b}
        auto = min(a_years) if a_years else (min(b_years) if b_years else None)
        agree = auto is not None and (not a_years or not b_years or bool(a_years & b_years))
        if u in YEAR_FIXES:
            years[u] = YEAR_FIXES[u][0]
        elif agree:
            years[u] = auto
        else:
            problems.append(f"{u}：圖檔陳述 {a or '—'}、國旗項目 {b or '—'}")
            continue
        # 側欄寫完整的日期：Wikidata 的日期跟採用年份同一年時
        for d in a + b:
            if int(d[:4]) == years[u] and not d.endswith("-01-01"):
                dates[u] = d
                break
    if problems:
        raise ValueError("採用年份對不上、沒有在 YEAR_FIXES 指定：\n    " + "\n    ".join(problems))
    tw = [s for s in current(st("TWN"), "P41", today) if s.value == chosen["TWN"]]
    if chosen["TWN"] != TAIWAN_FLAG[0] or not tw or tw[0].start != TAIWAN_FLAG[1] or years["TWN"] != 1928:
        print(f"  ！台灣的國旗跟預期不同：{chosen['TWN']}，{[s.start for s in tw]}，{years.get('TWN')}")
    else:
        print(f"  台灣：{chosen['TWN']}，{TAIWAN_FLAG[1]} 起（跟 Wikidata 一致）")
    for u in all_units:
        o = owner[chosen[u]]
        if o != u:
            years[u] = years[o]
            if o in dates:
                dates[u] = dates[o]

    # ── 長寬比 ──
    ratio: dict[str, str] = {}
    ratio_code: dict[str, int] = {}
    ratio_items = sorted({x for u in final if item_of[u] for x in flag_items.get(item_of[u], {}).get("P2061", [])})
    ratio_labels = wikidata_flags.labels(ratio_items)
    for u, data in final.items():
        w, h = svg_size(data)
        if coverage[u] < 0.95:
            ratio[u], ratio_code[u] = ratio_text(w, h), NON_RECT
            continue
        ratio[u] = RATIO_TEXT.get(u, ratio_text(w, h))
        ratio_code[u] = RATIO_CODES.get(ratio[u], RATIO_OTHER)
        # Wikidata 的長寬比項目名稱是「3:2」「1.90:1」這種寫法（寬:高或高:寬都有），有一個對得上就好
        names = [ratio_labels.get(x, (None, None))[1] or "" for x in flag_items.get(item_of[u], {}).get("P2061", [])]
        if names and u not in RATIO_TEXT and not any(_same_ratio(n, w / h) for n in names):
            print(f"  長寬比 {u}：SVG {ratio[u]}，Wikidata {names}")

    # ── 輸出 ──
    out_units: dict[str, dict] = {}
    for u in all_units:
        o = owner[chosen[u]]
        info = infos[chosen[u]]
        shares = colours[o]
        entry = {
            "f": f"svg/{file_of[o]}",
            "r": ratio[o],
            "c": [[c, round(float(shares[c]) * 100, 1)] for c in sorted(shares, key=lambda c: -shares[c]) if shares[c] >= 0.0005],
            "ft": [k for k in FEATURES if u in members[k]],
            "y": years[u],
        }
        if o in NAME_FIXES:
            entry["name"] = list(NAME_FIXES[o])
        if o in NICKNAMES:
            entry["nick"] = list(NICKNAMES[o])
        if u in dates:
            entry["d"] = dates[u]
        if family_of.get(u):
            entry["fam"] = family_of[u]
        if FOCAL.get(o):
            entry["fx"], entry["fy"] = FOCAL[o]
        if u in status:
            entry["sov"] = status[u]["sov"]
            entry["own"] = 1 if status[u]["own"] else 0
        if u in NOTES:
            entry["note"] = list(NOTES[u])
        if o in YEAR_FIXES:
            entry["yn"] = list(YEAR_FIXES[o][1:])
        meta = info.meta
        entry["src"] = {
            "file": info.name,
            "page": info.page,
            "lic": LICENCES[meta.get("LicenseShortName", "")],
            "ins": 1 if "insignia" in meta.get("Restrictions", "") else 0,
        }
        out_units[u] = entry

    write_json(OUT / "flags.json", {"date": today, "units": out_units})

    def ind(name: str, unit: str, values: dict[str, float], **extra) -> None:
        write_json(OUT / f"{name}.json", indicator_file(name, unit, [YEAR], {u: [v] for u, v in sorted(values.items())}, **extra),
                   quiet=name.count("/") > 0)

    # 採用年份（也是國旗地圖的指標檔）：tooltip 的短註是國旗的通稱或名稱，附註是年份的理由
    named = {u: e.get("nick") or e.get("name") for u, e in out_units.items() if e.get("nick") or e.get("name")}
    hints = {u: n[0] for u, n in named.items()}
    hints_en = {u: n[1] for u, n in named.items()}
    notes = {u: e["yn"][0] for u, e in out_units.items() if "yn" in e}
    notes_en = {u: e["yn"][1] for u, e in out_units.items() if "yn" in e}
    ind("adopted", "年", {u: e["y"] for u, e in out_units.items()}, hints=hints, hintsEn=hints_en, notes=notes, notesEn=notes_en)

    def summary(u: str, lang: str) -> str:
        names = COLOUR_ZH if lang == "zh" else COLOUR_EN
        parts = [f"{names[c]} {s:g}%" for c, s in out_units[u]["c"] if s >= 1][:4]
        return ("、" if lang == "zh" else ", ").join(parts)

    # 主要顏色：面積最大的顏色；前兩種差不到 2 個百分點的（法國、義大利這類三色旗）沒有單一的主要顏色
    main = {}
    for u, e in out_units.items():
        top = [(c, s) for c, s in e["c"] if c != "other"] or [("other", 100.0)]
        main[u] = TIED if len(top) > 1 and top[0][1] - top[1][1] < 2 else COLOUR_CODE[top[0][0]]
    ind("main-colour", "", main, hints={u: summary(u, "zh") for u in out_units}, hintsEn={u: summary(u, "en") for u in out_units})
    for c in COLOURS:
        ind(f"colours/{c}", "%", {u: dict(e["c"]).get(c, 0.0) for u, e in out_units.items()})
    for k in FEATURES:
        ind(f"features/{k}", "", {u: 1 if u in members[k] else 0 for u in out_units})
    ind("family", "", {u: family_of.get(u, 0) for u in out_units})
    # 確切的比例只寫在「其他比例」與「不是長方形」（類別名稱本身就是比例的不必重複）
    ratio_hints = {u: out_units[u]["r"] for u in out_units if ratio_code[owner[chosen[u]]] in (RATIO_OTHER, NON_RECT)}
    ind("ratio", "", {u: ratio_code[owner[chosen[u]]] for u in out_units}, hints=ratio_hints, hintsEn=ratio_hints)

    # 授權與出處
    lines = [
        "國旗圖檔的來源與授權 / Sources and licences of the flag images",
        "",
        "這個資料夾的 SVG 取自 Wikimedia Commons，經 svgo 最佳化（數值的小數位數、去掉編輯器的資料），畫出來跟原檔相同。",
        "每個檔的授權依 Commons 檔案頁的授權模板（API 的 extmetadata），取得日期：" + today + "。",
        "標 insignia 的是國徽、國旗這類國家象徵：它們的使用可能受各國法律限制（例如不得用於商標或有損尊嚴的用途），跟著作權無關。",
        "",
        "The SVG files in this folder come from Wikimedia Commons, optimised with svgo (numeric precision, editor metadata) so that they",
        "render identically to the originals. Licences follow each Commons file page (API extmetadata), retrieved " + today + ".",
        "Files marked 'insignia' are national symbols whose use may be restricted by national laws, independently of copyright.",
        "",
    ]
    for name, u in sorted(owner.items(), key=lambda x: x[1]):
        info = infos[name]
        meta = info.meta
        users = " ".join(x for x in all_units if chosen[x] == name)
        artist = meta.get("Artist", "")
        lines.append(f"{file_of[u]}  ({users})")
        lines.append(f"  {info.page}")
        lines.append(f"  {LICENCES[meta['LicenseShortName']]}"
                     + (f" — {meta.get('UsageTerms')}" if meta.get("AttributionRequired") == "true" and meta.get("UsageTerms") else "")
                     + (" — insignia" if "insignia" in meta.get("Restrictions", "") else ""))
        if artist:
            lines.append(f"  Author: {artist[:300]}")
    (SVG_DIR / "CREDITS.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")

    licences = Counter(out["src"]["lic"] for out in (out_units[u] for u in set(owner.values())))
    meta = {
        "generatedAt": now_iso(),
        "dataDate": today,
        "flags": len(out_units),
        "files": len(final),
        "bytes": sum(len(d) for d in final.values()),
        "licences": dict(licences),
        "insignia": sum(1 for u in set(owner.values()) if out_units[u]["src"]["ins"]),
        "sovereignFlag": sorted(u for u, s in status.items() if not s["own"]),
        "yearFixes": len(YEAR_FIXES),
        "fileOverrides": len(FLAG_FILES),
    }
    write_json(OUT / "manifest.json", meta)

    # ── 印出來核對 ──
    print(f"  授權：{dict(licences)}；insignia {meta['insignia']} 個")
    print(f"  用主權國國旗的屬地：{meta['sovereignFlag']}")
    counts = Counter(main.values())
    print(f"  主要顏色：{ {c: counts[COLOUR_CODE[c]] for c in COLOURS} }，差不多的 {counts[TIED]}")
    print(f"  長寬比：{Counter(ratio_code[owner[chosen[u]]] for u in out_units)}；其他：{sorted({ratio[u] for u in ratio if ratio_code[u] == RATIO_OTHER})}")
    print(f"  採用年份：最早 {sorted(years.items(), key=lambda x: x[1])[:5]}，最新 {sorted(years.items(), key=lambda x: -x[1])[:8]}")
    for u in ("JPN", "TWN", "BRA", "BTN", "NPL", "USA"):
        print(f"  {u}：{out_units[u]['c']}")


def _same_ratio(name: str, r: float) -> bool:
    """Wikidata 的長寬比名稱（例如「3:2」「1.90:1」「1:1.2190103」）跟 SVG 的寬高比相差 1% 以內"""
    m = re.match(r"^\s*([\d.]+)\s*:\s*([\d.]+)\s*$", name or "")
    if not m:
        return False
    a, b = float(m.group(1)), float(m.group(2))
    return any(abs(x - r) / r < 0.01 for x in (a / b, b / a))
