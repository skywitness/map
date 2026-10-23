"""台灣的外交（從台灣看世界）：邦交國的歷史、駐外館處、國人的簽證待遇。

- 邦交國：sources/allies.py 整理的 1950 年起每個國家建交、斷交的日期，每年年底的狀態（類別圖，1950 年到今年）。
  今年的邦交國要跟外交部駐外館處通訊錄裡有大使館的國家一致，不一致時資料管線會報錯。
- 駐外館處：外交部通訊錄（sources/mofa.py），城市層級的經緯度（Natural Earth）；沒有館處的國家由哪個館處負責，
  用領事事務局國家清單的「兼轄館處」（sources/boca.py）。
- 國人簽證待遇：領事事務局「免簽證、落地簽證及電子簽證」名單（PDF，sources/boca.py）；
  國家清單裡有、名單裡沒有的國家是要事先申請簽證。
台灣是看世界的那一方，所有檔案都沒有 TWN；中國大陸、香港由陸委會主管，三個指標都沒有資料（澳門在免簽證名單裡）。
"""
from __future__ import annotations

import json
import re
from datetime import date

from common import OUT_DIR, indicator_file, now_iso, points_file, write_json
from geoindex import country_at
from sources import allies, boca, mofa

OUT = OUT_DIR / "topics" / "taiwan-diplomacy"

# 邦交國的類別代碼（跟 src/topics/diplomacy.ts 的 ALLY 一致）
ALLY, FORMER_ALLY, NEVER = 1, 2, 3
# 駐外館處的類別代碼（MISSION_PRESENCE）
HAS_EMBASSY, HAS_OFFICE, COVERED = 1, 2, 3

# 不是國家的地區（海外領地、自治區、無人島）：邦交國指標不畫。庫克群島、紐埃有自己的外交關係，算國家
DEPENDENCIES = {
    "ABW", "AIA", "ALA", "ASM", "ATA", "ATF", "BES", "BLM", "BMU", "BVT", "CCK", "CUW", "CXR", "CYM", "ESH", "FLK",
    "FRO", "GGY", "GIB", "GLP", "GRL", "GUF", "GUM", "HKG", "HMD", "IMN", "IOT", "JEY", "MAC", "MAF", "MNP", "MSR",
    "MTQ", "MYT", "NCL", "NFK", "PCN", "PRI", "PYF", "REU", "SGS", "SHN", "SJM", "SPM", "SXM", "TCA", "TKL", "UMI",
    "VGB", "VIR", "WLF", "_CYN", "_IOT", "_SIA",
}
# 台灣是觀點本身；中國大陸由陸委會主管，不算外國
EXCLUDED = {"TWN", "CHN"}

# 邦交國指標的附註（側欄顯示）：這張表沒有算、但年表有算的
ALLY_NOTES = {
    "VNM": (
        "1955–1975 年與越南共和國（南越）有邦交，今天沒有對應的國家，地圖上沒有畫。",
        "The ROC had diplomatic relations with the Republic of Vietnam (South Vietnam) in 1955–1975; it has no present-day counterpart, so it is not shown.",
    ),
    "MYS": (
        "1964–1974 年中華民國在吉隆坡設有領事館（只有領事關係），不算邦交。",
        "The ROC kept a consulate in Kuala Lumpur in 1964–1974 (consular relations only), which is not counted as diplomatic relations.",
    ),
    "LVA": (
        "1992–1994 年雙方互設總領事館（只有領事關係），不算邦交。",
        "Consulates-general were exchanged in 1992–1994 (consular relations only), which is not counted as diplomatic relations.",
    ),
    "KHM": (
        "1953–1958 年中華民國在金邊的總領事館繼續運作，雙方沒有正式邦交。",
        "The ROC consulate-general in Phnom Penh stayed open in 1953–1958, without formal diplomatic relations.",
    ),
}

# 領務局國家清單裡的兼轄館處，不在外交部通訊錄（陸委會的駐港機構）
EXTRA_OFFICES_EN = {"大陸委員會香港辦事處": "Taipei Economic and Cultural Office in Hong Kong (Mainland Affairs Council)"}


def states(map_ids: set[str]) -> list[str]:
    """邦交國指標要畫的國家：地圖上的國家，加上 1:50m 沒有形狀的吐瓦魯（排名表、搜尋找得到）"""
    return sorted((map_ids | {"TUV"}) - DEPENDENCIES - EXCLUDED)


def _map_ids() -> set[str]:
    with open(OUT_DIR / "geo" / "countries-50m.json", encoding="utf-8") as f:
        topo = json.load(f)
    return {g["id"] for g in topo["objects"]["countries"]["geometries"]}


def _norm(name: str) -> str:
    """館處名稱的比對用：去掉空白、括號裡的附註與「台北」「台灣」，臺 → 台"""
    name = re.sub(r"\s+", "", name).replace("臺", "台")
    name = re.sub(r"[（(][^）)]*[）)]", "", name)
    return name.replace("台北", "").replace("台灣", "")


# ── 簽證說明 ───────────────────────────────────────────────
CJK = "㐀-鿿"  # 中日韓統一表意文字 U+3400–U+9FFF
UNIT = r"(天|日|個月)"
# 說明開頭不是天數時（「每 6 個月期間內可停留至多 90 天」「12 個月內停留不超過 6 個月」），依序找這些寫法
STAY_PATTERNS = [
    rf"可停留(?:至多|最多)?\s*(\d+)\s*{UNIT}",
    rf"停留(?:期限|時間)?(?:最多|至多|不超過|不得逾|最長)?(?:為)?\s*(\d+)\s*{UNIT}",
    rf"(?:最多|至多|最長期限|最長)\s*(\d+)\s*{UNIT}",
    rf"^\D{{0,6}}?(\d+)\s*{UNIT}(?!以上|內|期間)",  # 「落地簽證 30 天…」，不是「持憑 6 個月以上效期的護照」
]


def _stay(text: str) -> tuple[str, str] | None:
    """說明裡的可停留天數，中文與英文：「90 天」「最多 90 天」「45/90 天」「30–90 天」「1 個月」"""
    text = re.sub(r"\s+", " ", text)
    # 開頭的天數：「90 天」「最多 90 天」「45/90 天」「30 至 90 天」「21 日或 120 日」
    m = re.match(rf"^(最多|至多|最長期限)?\s*(\d+)\s*(?:天|日)?\s*(?:([/／至－-]|或)\s*(\d+))?\s*{UNIT}(?!內|期間)", text)
    alternative = None
    if m:
        up_to = bool(m.group(1))
        sep = m.group(3)
        n = m.group(2) + (f"–{m.group(4)}" if sep in ("至", "－", "-") else f"/{m.group(4)}" if sep and sep != "或" else "")
        alternative = m.group(4) if sep == "或" else None
        unit = m.group(5)
    else:
        for pattern in STAY_PATTERNS:
            if m := re.search(pattern, text):
                up_to, n, unit = not pattern.startswith("^"), m.group(1), m.group(2)
                break
        else:
            return None
    plural = n != "1" or alternative is not None
    zh_unit = "個月" if unit == "個月" else "天"
    en_unit = ("months" if plural else "month") if unit == "個月" else ("days" if plural else "day")
    zh_n, en_n = (f"{n} 或 {alternative}", f"{n} or {alternative}") if alternative else (n, n)
    return (f"{'最多 ' if up_to else ''}{zh_n} {zh_unit}", f"{'up to ' if up_to else ''}{en_n} {en_unit}")


# 網址（PDF 換行時中間會多出空白，例如「https://www.gov.uk/guida nce/apply-…」）與前面的「網址：」「申請網頁：」
URL = r"(?:https?://|www\.)[A-Za-z0-9./:?=&%#~+_-]+(?:\s[A-Za-z0-9./:?=&%#~+_-]*[./-][A-Za-z0-9./:?=&%#~+_-]*)*"
URL_LABEL = r"(?:(?:申請)?(?:網址|網頁)(?:為)?|官網)?\s*[:：]?\s*"
# 叫人去看「簽證及入境須知」或某個網站的句子（從上一個逗號、句號或括號開始）
REFERRAL = r"(?:請參閱|請參考|請閱)"
SEE_ALSO = [
    rf"[（(][^（）()]*(?:{REFERRAL}|詳請|詳情)[^（）()]*[）)]",  # 整個括號都是參考資訊：「（詳請及其他事項，請參考…官網）」
    rf"[^。，；（(]*{REFERRAL}\s*「(?:簽證及入境須知|入境及簽證須知)」[^。；）)]*",
    rf"[^。，；（(]*{REFERRAL}[^。；（(]*網站[^。；）)]*",
]


def _balance(text: str) -> str:
    """去掉沒有對應的右括號、補上沒有對應的左括號（全形、半形混用的「(…）」算一對）"""
    out: list[str] = []
    open_: list[str] = []
    for ch in text:
        if ch in ("）", ")"):
            if open_:
                open_.pop()
            else:
                continue
        elif ch in ("（", "("):
            open_.append(ch)
        out.append(ch)
    closing = {"（": "）", "(": ")"}
    return "".join(out) + "".join(closing[c] for c in reversed(open_))


def _note(text: str) -> str:
    """說明文字（只在中文介面顯示）：去掉網址與「請參閱簽證及入境須知」這類參考句，申根區的「左列國家」改成申根區；只有天數的不留"""
    text = re.sub(rf"(?<=[{CJK}]) (?=[{CJK}])", "", text)
    if "左列國家" in text:
        return "申根區國家的停留日數合併計算，每 180 天期間內總計最多停留 90 天。"
    text = re.sub(rf"[（(]\s*{URL_LABEL}{URL}\s*[）)]", "", text)  # 整個括號是網址
    text = re.sub(rf"(?<=[至於到])\s*{URL}", "網站", text)  # 「須事先至 https://… 線上填報」→「須事先至網站線上填報」
    text = re.sub(rf"{URL_LABEL}{URL}", "", text)
    for pattern in SEE_ALSO:
        text = re.sub(pattern, "", text)
    text = re.sub(r"\s*([，。、；：）」])\s*", r"\1", text)
    text = re.sub(r"([（「])\s+", r"\1", text)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[，、；：]+(?=[。）)]|$)", "", text)  # 拿掉參考句後留下的逗號
    text = re.sub(rf"(?<=[{CJK}]) (?=[{CJK}])", "", text)  # 拿掉網址後留下的空白（「網站 查詢」）
    text = _balance(text).replace("（）", "").replace("()", "").strip(" ，。、；：")
    if re.fullmatch(rf"(最多|至多|最長期限|最長)?\s*\d+\s*(天|日)?(\s*([/／至－-]|或)\s*\d+)?\s*{UNIT}", text):
        return ""
    return f"{text}。" if text and not text.endswith(("）", ")", "。")) else text


def build() -> None:
    year = date.today().year
    missions = mofa.missions()
    countries = boca.country_list()
    visa_entries, visa_updated = boca.visa_list()

    embassies = {m.iso3 for m in missions if m.type == mofa.EMBASSY}
    allies.check(embassies, year)

    map_ids = _map_ids()
    all_states = states(map_ids)

    # ── 邦交國（1950 年到今年） ──
    years = list(range(allies.FIRST_YEAR, year + 1))
    values = {
        iso3: [ALLY if allies.allied(iso3, y) else FORMER_ALLY if allies.former(iso3, y) else NEVER for y in years]
        for iso3 in all_states
    }
    write_json(OUT / "allies.json", indicator_file(
        "allies", "類別", years, values,
        notes={k: v[0] for k, v in ALLY_NOTES.items()}, notesEn={k: v[1] for k, v in ALLY_NOTES.items()},
    ))
    counts = {y: sum(v[i] == ALLY for v in values.values()) for i, y in enumerate(years)}
    print(f"  邦交國：1969 年 {counts[1969]} 國、1979 年 {counts[1979]} 國、{year} 年 {counts[year]} 國")

    # ── 駐外館處 ──
    # 館處所在的地區：駐關島辦事處的駐在國是美國，地圖上關島也算有辦事處
    located = {id(m): country_at(m.lon, m.lat) for m in missions}
    presence: dict[str, int] = {}
    count: dict[str, int] = {}
    for m in missions:
        kind = HAS_EMBASSY if m.type == mofa.EMBASSY else HAS_OFFICE
        places = {m.iso3}
        if located[id(m)] in DEPENDENCIES:
            places.add(located[id(m)])
        for iso3 in places:
            presence[iso3] = min(presence.get(iso3, kind), kind)
            count[iso3] = count.get(iso3, 0) + 1
    for iso3, info in countries.items():
        if iso3 not in presence and info.covered_by:
            presence[iso3] = COVERED
    for iso3 in EXCLUDED:
        presence.pop(iso3, None)
    # 由其他館處兼轄的國家是 0 個（不是無資料），跟側欄的「沒有館處，由…兼轄」一致；
    # 駐關島辦事處算在美國（駐在國），也算在關島（地圖上關島是「有辦事處」）
    for iso3 in presence:
        count.setdefault(iso3, 0)
    write_json(OUT / "missions-presence.json", indicator_file("missions-presence", "類別", [year], {k: [v] for k, v in presence.items()}))
    write_json(OUT / "mission-count.json", indicator_file("mission-count", "個", [year], {k: [v] for k, v in count.items()}))
    by_type = {t: sum(m.type == t for m in missions) for t in range(1, 6)}
    print(f"  駐外館處 {len(missions)} 個，{sum(v > 0 for v in count.values())} 個國家／地區（大使館 {by_type[1]}、總領事館 {by_type[2]}、"
          f"代表處 {by_type[3]}、辦事處 {by_type[4]}、國際組織 {by_type[5]}）；由其他館處兼轄 {sum(v == COVERED for v in presence.values())} 國")

    # 地圖上的點：依經度排序、差分；同一個城市有兩個館處（日內瓦）時，後面的稍微往東錯開，滑鼠才分得開
    points = sorted(missions, key=lambda m: (m.lon, m.lat, m.type))
    seen: dict[tuple[float, float], int] = {}
    rows = []
    for m in points:
        key = (round(m.lon, 2), round(m.lat, 2))
        shift = seen.get(key, 0)
        seen[key] = shift + 1
        rows.append({
            "lon": m.lon + 0.06 * shift, "lat": m.lat, "type": m.type, "name": m.name, "nameEn": m.name_en,
            "city": m.city, "iso3": m.iso3,
        })
    write_json(OUT / "missions.json", points_file(
        rows, ["lon", "lat", "type", "name", "nameEn", "city", "iso3"], {"lon": 0.01, "lat": 0.01, "type": 1}, ("lon",),
    ))

    # ── 國人簽證待遇 ──
    visa: dict[str, int] = {}
    for e in visa_entries:
        visa[e.iso3] = min(visa.get(e.iso3, e.category), e.category)
    for iso3 in countries:
        visa.setdefault(iso3, boca.VISA_REQUIRED)
    for iso3 in EXCLUDED:
        visa.pop(iso3, None)
    write_json(OUT / "visa.json", indicator_file("visa", "類別", [year], {k: [v] for k, v in visa.items()}))
    print("  簽證待遇：" + "、".join(
        f"{name} {sum(v == code for v in visa.values())}"
        for code, name in [(1, "免簽證"), (2, "免簽證（需旅行授權）"), (3, "落地簽證"), (4, "電子簽證"), (5, "需事先申請")]
    ))

    # ── 側欄 ──
    mission_rows = [[m.type, m.name, m.official, m.name_en, m.city, m.iso3, m.website] for m in points]
    index = {}
    for i, m in enumerate(points):
        index.setdefault(_norm(m.name), i)
        index.setdefault(_norm(m.official), i)
    details: dict[str, dict] = {}

    def entry(iso3: str) -> dict:
        return details.setdefault(iso3, {})

    for iso3 in allies.HISTORY:
        entry(iso3)["a"] = [list(p) for p in allies.HISTORY[iso3]]
    for i, m in enumerate(points):
        entry(m.iso3).setdefault("m", []).append(i)
        loc = located[id(m)]
        if loc in DEPENDENCIES and loc != m.iso3:
            entry(loc).setdefault("m", []).append(i)
    unmatched = set()
    for iso3, info in countries.items():
        if iso3 in EXCLUDED:
            continue
        if info.page:
            entry(iso3)["b"] = info.page
        if "m" in details.get(iso3, {}):
            continue
        for name in info.covered_by:
            parts = [p for p in re.split(r"[/∕]", name) if p.strip()]
            hit = next((index[_norm(p)] for p in parts if _norm(p) in index), None)
            if hit is not None:
                if hit not in entry(iso3).setdefault("c", []):
                    entry(iso3)["c"].append(hit)
            else:
                en = next((EXTRA_OFFICES_EN[p] for p in parts if p in EXTRA_OFFICES_EN), None)
                entry(iso3).setdefault("cx", []).append(["／".join(parts), en])
                unmatched.add(name)
    if unmatched:
        print(f"  兼轄館處不在外交部通訊錄裡：{sorted(unmatched)}")
    for e in visa_entries:
        if e.iso3 in EXCLUDED:
            continue
        stay = _stay(e.stay)
        row = [e.category, stay[0] if stay else None, stay[1] if stay else None, _note(e.stay)]
        if row not in entry(e.iso3).setdefault("v", []):
            entry(e.iso3)["v"].append(row)
    for iso3 in details:
        if "v" in details[iso3]:
            details[iso3]["v"].sort(key=lambda r: r[0])
    write_json(OUT / "details.json", {"missions": mission_rows, "countries": details, "visaUpdated": visa_updated})

    write_json(OUT / "manifest.json", {
        "topic": "taiwan-diplomacy",
        "generatedAt": now_iso(),
        "source": "MOFA overseas missions (data.gov.tw 6119); BOCA visa list (data.gov.tw 30749) and country list; "
        "Natural Earth 1:10m populated places; ally history compiled by hand (sources/allies.py)",
        "visaListUpdated": visa_updated,
    })
