"""旅行實用：樓層怎麼數（2026-11-05，製作手冊第二十二批 396；步驟 travel-floors，補進旅行實用的資料夾，不重跑 travel）。

- **逐國的值**：維基共享資源 `File:Countries_numbering_floors.svg`（作者 Michael Peter Fustumum，CC BY-SA 4.0，2023-09-12
  的版本）的填色：#ff0000 美式（地面層就是 1 樓）、#0000ff 歐式（地面層叫 ground floor、G 或 0，上一層才是 1 樓）、
  #ff00ff 兩種都用、#c0c0c0 沒有資料。upload.wikimedia.org 從 cloud 回 429，本機 session 下載到 map-plan 的
  `data/wikimedia/`；重跑前複製到 `pipeline/.cache/wikimedia/`（SHA-256 要對得上 README）。
  SVG 的國家是 `id` 為 ISO 3166-1 alpha-2 小寫的 `<path>` 或 `<g>`；`<g>` 沒有自己的填色時取裡面陸地的填色（小國的圓圈不算）。
  `x` 開頭的是未受普遍承認的地區（阿布哈茲、北賽普勒斯…），只收科索沃（xk）。
- **香港**：SVG 塗成美式（跟中國同色），但英文維基「Storey」（revid 1376363313）明寫東亞「including China (except for
  Hong Kong)」用美式，香港照條目改成歐式，附註寫明。
- **忌諱（跳 4 樓、13 樓）**：英文維基「Tetraphobia」（revid 1375451448）與「Storey」只有零星幾國的敘述（香港、日本、
  馬來西亞、印尼、南韓、美國、加拿大、越南），沒有逐國的分類，不畫地圖，寫在那幾國的附註（notes）。跳樓層是建商與
  電梯廠商的習慣，不是法規。
- 資料檔依 CC BY-SA 4.0 分享（SVG 與兩篇條目都是）。
"""
from __future__ import annotations

import hashlib
import re
import xml.etree.ElementTree as ET
from collections import Counter

import pycountry

from common import CACHE_DIR, OUT_DIR, indicator_file, write_json

OUT = OUT_DIR / "topics" / "travel"
SVG = CACHE_DIR / "wikimedia" / "Countries_numbering_floors.svg"
SVG_SHA256 = "60a2412e4c3166ca3991daf5c7288dabc15e5c0bc96545fb4ce47fe21bfe2a11"
YEAR = 2026
# 類別（src/topics/travel.ts 的 FLOOR_NUMBERING）
AMERICAN, EUROPEAN, BOTH = 1, 2, 3
FILLS = {"#ff0000": AMERICAN, "#0000ff": EUROPEAN, "#ff00ff": BOTH}
OVERRIDE = {"HKG": EUROPEAN}  # Storey：China (except for Hong Kong)

# 附註（英文維基 Storey 與 Tetraphobia 的敘述；中文、英文）
NOTES = {
    "HKG": (
        "香港跟中國其他地方不同，用歐式（地面層 G/F）：維基共享資源的地圖塗成跟中國一樣，這裡照英文維基「Storey」的「China (except for Hong Kong)」改成歐式。"
        "有些住宅大樓跳過 40–49 樓整段，有的 13、14 樓都跳過，連同其他帶 4 的樓層（「Tetraphobia」）。",
        "Unlike the rest of China, Hong Kong uses the European scheme (G/F): the Wikimedia Commons map colours it like China, but Wikipedia’s “Storey” says “China (except for Hong Kong)”. "
        "Some residential towers skip floors 40–49 entirely, and some skip both 13 and 14 along with other floors containing 4 (“Tetraphobia”).",
    ),
    "JPN": ("有些公寓與醫院避開 4（英文維基「Tetraphobia」）。", "Some apartments and hospitals avoid the number 4 (Wikipedia, “Tetraphobia”)."),
    "MYS": (
        "華人多的地區偶爾跳過 4 樓，或改標 3A（英文維基「Tetraphobia」）。",
        "In areas with many ethnic Chinese the 4th floor is occasionally omitted or labelled 3A (Wikipedia, “Tetraphobia”).",
    ),
    "IDN": (
        "兩種都用（英文維基「Storey」）。2000 年代起越來越多高樓跳過帶 4 的樓層（也跳 13 樓），多是華人出資的；政府大樓、國營事業的大樓照常有 4 樓（「Tetraphobia」）。",
        "Both schemes are used (Wikipedia, “Storey”). Since the 2000s a growing number of high-rises, mostly funded by Chinese Indonesians, skip floors with 4 (and the 13th); government and state-owned buildings still have a 4th floor (“Tetraphobia”).",
    ),
    "KOR": (
        "醫院、殯儀館這類公共建築幾乎都跳過 4 樓；其他建築的電梯有時把 4 樓標成 F（four），13 樓照常（英文維基「Tetraphobia」）。",
        "Hospitals, funeral halls and similar public buildings almost always skip the 4th floor; elsewhere lifts sometimes label it F (for four), while the 13th floor is labelled as usual (Wikipedia, “Tetraphobia”).",
    ),
    "USA": (
        "12 層以上的建築大多沒有標 13 的樓層（英文維基「Storey」）；拉斯維加斯有些飯店跳過 40–49 樓（「Tetraphobia」）。",
        "Most buildings with more than 12 floors have no floor numbered 13 (Wikipedia, “Storey”); some Las Vegas hotels skip floors 40–49 (“Tetraphobia”).",
    ),
    "CAN": (
        "12 層以上的建築大多沒有標 13 的樓層；魁北克以前用歐式，現在多半改成美式（英文維基「Storey」）。溫哥華的建商以前不用 4，2015 年 10 月市政府禁止不連續的樓層編號（「Tetraphobia」）。",
        "Most buildings with more than 12 floors have no floor numbered 13; Quebec formerly used the European scheme but has mostly switched to the American one (Wikipedia, “Storey”). Vancouver developers used to omit the number 4 until the city banned non-sequential numbering in October 2015 (“Tetraphobia”).",
    ),
    "VNM": (
        "北部、中部（含河內）地面層是 tầng 1（美式），南部地面層叫 trệt、上一層才是 lầu 1（歐式）；胡志明市有的大樓把 13 樓標成「12 bis」。越南不太忌諱 4（英文維基「Storey」「Tetraphobia」）。",
        "In the north and centre (including Hanoi) the ground floor is tầng 1 (American scheme); in the south it is trệt and the next floor up is lầu 1 (European). Some Ho Chi Minh City buildings label the 13th floor “12 bis”. Tetraphobia is not common in Vietnam (Wikipedia, “Storey”, “Tetraphobia”).",
    ),
    "SGP": (
        "1983 年 3 月從英式改成美式，但有的大樓仍用歐式，或把地面層標成 SL（Street Level），地圖畫成兩種都用（英文維基「Storey」）。",
        "Singapore switched from the British to the American scheme in March 1983, but some buildings still use the European scheme or label the ground level SL (Street Level), so the map shows both (Wikipedia, “Storey”).",
    ),
    "ESP": (
        "地面層（planta baja，PB）上面常有夾層 entresuelo，有時還有 principal，電梯可能跳過，所以標「1」的樓層可能在地面上兩、三層（英文維基「Storey」）。",
        "Above the ground floor (planta baja, PB) there is often a mezzanine (entresuelo) and sometimes a principal floor, which lifts may skip, so “1” can be two or three levels above the street (Wikipedia, “Storey”).",
    ),
    "ITA": ("老宮殿的 1 樓叫 piano nobile（貴族住的樓層）（英文維基「Storey」）。", "In old palaces the first floor is the piano nobile, where the noble owners lived (Wikipedia, “Storey”)."),
    "FRA": (
        "臨街的地面層叫 rez-de-chaussée（RDC），面向花園的叫 rez-de-jardin，有的建築兩個都有（英文維基「Storey」）。",
        "The ground level facing the street is the rez-de-chaussée (RDC) and one facing a garden the rez-de-jardin; some buildings have both (Wikipedia, “Storey”).",
    ),
    "HRV": (
        "有的建築地面有兩層：較低的 razizemlje（RA）與較高的 prizemlje（PR）（英文維基「Storey」）。",
        "Some buildings have two ground levels: the lower razizemlje (RA) and the upper prizemlje (PR) (Wikipedia, “Storey”).",
    ),
}
for c in ("CHL", "COL", "ECU", "PER"):
    NOTES[c] = (
        "地面層叫 primer piso（美式），跟阿根廷、墨西哥等地的 planta baja（地面層）、primer piso（上一層）不同（英文維基「Storey」）。",
        "The ground floor is the primer piso (American scheme), unlike Argentina, Mexico and others, where it is the planta baja and the primer piso is the floor above (Wikipedia, “Storey”).",
    )
for c in ("FIN", "NOR", "ISL"):
    NOTES[c] = ("歐洲少數用美式的國家（英文維基「Storey」）。", "One of the few European countries using the American scheme (Wikipedia, “Storey”).")


def _fill(el) -> str | None:
    m = re.search(r"fill:\s*(#[0-9a-fA-F]{6})", el.get("style") or "")
    f = m.group(1) if m else el.get("fill")
    return f.lower() if f else None


def _iso3(code: str) -> str | None:
    if code == "xk":
        return "XKX"
    if code.startswith("x") or code == "aq":
        return None
    c = pycountry.countries.get(alpha_2=code.upper())
    return c.alpha_3 if c else None


def schemes() -> dict[str, int]:
    """{ISO3: 類別}；SVG 是灰色（沒有資料）或沒有填色的不收"""
    if not SVG.exists():
        raise RuntimeError(f"沒有 {SVG}：請把 map-plan 的 data/wikimedia/Countries_numbering_floors.svg 複製到這裡")
    if hashlib.sha256(SVG.read_bytes()).hexdigest() != SVG_SHA256:
        raise RuntimeError(f"{SVG} 的 SHA-256 跟 map-plan 的 README 不一樣，檔案可能換了版本，先看過再改")
    root = ET.parse(SVG).getroot()
    out: dict[str, int] = {}
    seen: set[str] = set()
    for el in root.iter():
        code = el.get("id") or ""
        if not re.fullmatch(r"[a-z]{2}", code) or code in seen:
            continue
        seen.add(code)
        fill = _fill(el)
        if not fill:
            fills = Counter(
                f for k in el.iter() if (f := _fill(k)) and not re.search(r"circlexx|subxx|noxx|unxx", k.get("class") or "")
            )
            fill = fills.most_common(1)[0][0] if fills else None
        iso3 = _iso3(code)
        if iso3 and fill in FILLS:
            out[iso3] = FILLS[fill]
    out.update(OVERRIDE)
    return out


def build() -> None:
    values = schemes()
    notes = {c: zh for c, (zh, _) in NOTES.items()}
    notes_en = {c: en for c, (_, en) in NOTES.items()}
    write_json(OUT / "floor-numbering.json", indicator_file(
        "floor-numbering", "", [YEAR], {c: [v] for c, v in values.items()}, notes=notes, notesEn=notes_en,
        license="CC BY-SA 4.0"))
    counts = Counter(values.values())
    by = {k: sorted(c for c, v in values.items() if v == k) for k in (AMERICAN, EUROPEAN, BOTH)}
    print(f"  {len(values)} 國：美式 {counts[AMERICAN]}、歐式 {counts[EUROPEAN]}、兩種都用 {counts[BOTH]}")
    print(f"  美式 {by[AMERICAN]}")
    print(f"  兩種都用 {by[BOTH]}；台灣 {values.get('TWN')}、香港 {values.get('HKG')}")
