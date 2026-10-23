"""護照與簽證：Passport Index 的簽證待遇（sources/passport_index.py），199 本護照、2026 年 2 月的單一快照。

輸出（public/data/topics/passport/）：
- visa/<護照>.json：持這本護照前往各目的地的類別（類別圖，代碼見 sources/passport_index.py），另外附
  days（免簽證可停留的天數）與 recoded（改列為「另用通行證」的目的地，原本資料集的類別），側欄用。
  自己的護照不收（前端寫主題的 selfLabel「本國護照」）。
- power.json：護照實力，免簽證、需要旅行授權（eTA）的免簽證、落地簽證加起來的目的地數（最多 198）。
  跟 Henley Passport Index 的算法一樣：出發前不必等政府核准的都算；電子簽證不算。
  Passport Index 網站自己的 Mobility Score 另外把「3 天內核發」的電子簽證也算進去，資料集沒有核發天數，沒辦法照算。
- openness.json：開放程度，有幾本護照（其他 198 本）可以用同樣的方式入境這個目的地。
- manifest.json：資料日期、來源、commit。

兩岸與港澳（PERMIT_PAIRS）：這幾組實際上用通行證或許可入境、不用護照，資料集的分類（免簽證或需要簽證）
不符合實情，改列為「另用通行證」（代碼 7，地圖上是「其他」的淺色），也不算進護照實力與開放程度；
原本的類別記在 recoded，側欄會寫出來。香港、澳門的護照前往台灣，台灣護照前往香港、澳門用的是護照，照資料集。

台灣護照：跟台灣的外交主題的領事事務局名單（public/data/topics/taiwan-diplomacy/visa.json，代碼相同）比對，
印出一致與不一致的目的地；側欄也會即時比對。
"""
from __future__ import annotations

import json
import re
from collections import Counter

from common import OUT_DIR, ROOT, indicator_file, now_iso, write_json
from sources import passport_index as pi

OUT = OUT_DIR / "topics" / "passport"
YEAR = int(pi.DATA_DATE[:4])
# 護照實力、開放程度算進去的類別：出發前不必等政府核准
EASY = {pi.VISA_FREE, pi.ETA, pi.ON_ARRIVAL}

# (護照, 目的地)：用通行證或許可入境，不用護照
PERMIT_PAIRS = {
    ("TWN", "CHN"): "臺灣居民來往大陸通行證（台胞證）",
    ("CHN", "TWN"): "大陸居民往來台灣通行證與中華民國臺灣地區入出境許可證",
    ("CHN", "HKG"): "往來港澳通行證",
    ("CHN", "MAC"): "往來港澳通行證",
    ("HKG", "CHN"): "港澳居民來往內地通行證（回鄉證）",
    ("MAC", "CHN"): "港澳居民來往內地通行證（回鄉證）",
}

# 側欄的附註（中文, 英文），四本護照的三個指標檔都附
PERMIT_NOTE = (
    "兩岸與港澳之間用通行證或許可入境、不用護照，Passport Index 原本的分類（免簽證或需要簽證）改列為「另用通行證」，"
    "也不算進護照實力與開放程度。",
    "Travel between mainland China, Taiwan, Hong Kong and Macao uses dedicated travel permits rather than passports, so the "
    "Passport Index category (visa-free or visa required) is shown as \"travel permit\" instead and not counted towards "
    "passport power or openness.",
)
NOTES: dict[str, tuple[str, str]] = {
    "TWN": (
        "Passport Index 把台灣護照前往中國大陸列為免簽證，實際上台灣居民前往中國大陸用的是台胞證（臺灣居民來往大陸通行證），"
        "不用護照，所以改列為「另用通行證」，不算進護照實力；中國大陸居民來台用的是往來台灣通行證與入出境許可證，也一樣改列。"
        "香港（免簽證 30 天）、澳門（免簽證）照資料集，前往香港要先網上預辦入境登記；兩岸與港澳事務由陸委會主管。"
        "側欄另外跟外交部領事事務局的名單逐國比對。",
        "Passport Index lists mainland China as visa-free for the Taiwan passport, but Taiwan residents travel there on the "
        "Mainland Travel Permit for Taiwan Residents rather than a passport, so it is shown as \"travel permit\" and not counted "
        "towards passport power; mainland residents visiting Taiwan likewise use travel permits and entry permits. Hong Kong "
        "(visa-free, 30 days) and Macao (visa-free) follow the dataset; Hong Kong requires online pre-arrival registration. "
        "Cross-strait and Hong Kong/Macao matters fall under the Mainland Affairs Council. The side panel compares every "
        "destination with the Bureau of Consular Affairs list.",
    ),
    "CHN": PERMIT_NOTE,
    "HKG": PERMIT_NOTE,
    "MAC": PERMIT_NOTE,
}

TOPIC_TS = ROOT / "src" / "topics" / "passport.ts"
BOCA_VISA = OUT_DIR / "topics" / "taiwan-diplomacy" / "visa.json"
BOCA_MANIFEST = OUT_DIR / "topics" / "taiwan-diplomacy" / "manifest.json"
NAMES = {1: "免簽證", 2: "免簽證（旅行授權）", 3: "落地簽證", 4: "電子簽證", 5: "需事先申請", 6: "不准入境", 7: "另用通行證"}


def _map_ids() -> set[str]:
    with open(OUT_DIR / "geo" / "countries-50m.json", encoding="utf-8") as f:
        topo = json.load(f)
    return {g["id"] for g in topo["objects"]["countries"]["geometries"]}


def _check_topic_ts(passports: set[str]) -> None:
    """src/topics/passport.ts 的護照清單（REGIONS，「ISO3:ISO2」）、沒有收的地方（NOT_COVERED）與資料日期要跟資料一致"""
    with open(OUT_DIR / "countries.json", encoding="utf-8") as f:
        iso2 = {k: v.get("iso2") for k, v in json.load(f).items()}
    ts = TOPIC_TS.read_text(encoding="utf-8")
    pairs = re.findall(r"\b([A-Z]{3}):([A-Z]{2})\b", ts)
    listed = Counter(a for a, _ in pairs)
    wrong = [f"{a}:{b}（應為 {iso2.get(a)}）" for a, b in pairs if iso2.get(a) != b]
    dup = sorted(a for a, n in listed.items() if n > 1)
    missing, extra = sorted(passports - set(listed)), sorted(set(listed) - passports)
    m = re.search(r"NOT_COVERED = '([A-Z_ ]*)'", ts)
    not_covered = set(m.group(1).split()) if m else set()
    expected = _map_ids() - passports
    problems = []
    if wrong or dup or missing or extra:
        problems.append(f"REGIONS：ISO2 不對 {wrong}、重複 {dup}、缺少 {missing}、多出 {extra}")
    if not_covered != expected:
        problems.append(f"NOT_COVERED 應為 '{' '.join(sorted(expected))}'")
    m = re.search(r"DATA_DATE = '([0-9-]+)'", ts)
    if not m or m.group(1) != pi.DATA_DATE:
        problems.append(f"DATA_DATE 應為 '{pi.DATA_DATE}'（指標說明與頁尾寫的日期也要一起改）")
    if problems:
        raise ValueError("src/topics/passport.ts 跟資料不一致：" + "；".join(problems))


def _cross_check(twn: dict[str, int]) -> None:
    """台灣護照跟領事事務局名單（台灣的外交主題）比對，印出摘要（DESIGN.md 第 8 節的數字從這裡來）"""
    if not BOCA_VISA.exists():
        print("  沒有 taiwan-diplomacy/visa.json，跳過跟領事事務局的比對（先跑 npm run data -- taiwan-diplomacy）")
        return
    with open(BOCA_VISA, encoding="utf-8") as f:
        boca_file = json.load(f)
    # 單一年份、差分編碼：[指數, 值]
    boca = {k: v[1] * 10 ** v[0] for k, v in boca_file["values"].items() if v[1] is not None}
    updated = ""
    if BOCA_MANIFEST.exists():
        with open(BOCA_MANIFEST, encoding="utf-8") as f:
            updated = json.load(f).get("visaListUpdated", "")
    common = sorted(set(twn) & set(boca))
    same = [k for k in common if twn[k] == boca[k]]
    print(f"  台灣護照 vs 領事事務局（{updated} 版）：共同 {len(common)} 個目的地，一致 {len(same)}、不一致 {len(common) - len(same)}；"
          f"只有 Passport Index：{sorted(set(twn) - set(boca))}；只有領事事務局 {len(set(boca) - set(twn))} 個（屬地等）")
    pairs = Counter((boca[k], twn[k]) for k in common if twn[k] != boca[k])
    for (b, p), n in sorted(pairs.items(), key=lambda x: -x[1]):
        dests = [k for k in common if boca[k] == b and twn[k] == p]
        print(f"    領事事務局 {NAMES[b]} → Passport Index {NAMES[p]}：{n}（{' '.join(dests)}）")


def build() -> None:
    table = pi.load()
    passports = set(table)
    _check_topic_ts(passports)

    codes: dict[str, dict[str, int]] = {}
    recoded: dict[str, dict[str, int]] = {}
    for p, row in table.items():
        codes[p] = {d: r.code for d, r in row.items()}
    for (p, d) in PERMIT_PAIRS:
        recoded.setdefault(p, {})[d] = codes[p][d]
        codes[p][d] = pi.PERMIT

    notes = {k: v[0] for k, v in NOTES.items()}
    notes_en = {k: v[1] for k, v in NOTES.items()}

    # ── 各護照的簽證待遇（類別圖，一本護照一個檔） ──
    for p in sorted(passports):
        days = {d: r.days for d, r in table[p].items() if r.days is not None and codes[p][d] == pi.VISA_FREE}
        extra: dict[str, object] = {"days": dict(sorted(days.items()))}
        if p in recoded:
            extra["recoded"] = recoded[p]
        if p in NOTES:
            extra["notes"] = {p: notes[p]}
            extra["notesEn"] = {p: notes_en[p]}
        values = {d: [c] for d, c in sorted(codes[p].items())}
        write_json(OUT / "visa" / f"{p}.json", indicator_file("visa", "類別", [YEAR], values, **extra), quiet=True)
    print(f"  輸出 visa/*.json（{len(passports)} 本護照）")

    # ── 護照實力、開放程度 ──
    power = {p: sum(c in EASY for c in codes[p].values()) for p in passports}
    openness = {d: sum(codes[p][d] in EASY for p in passports if p != d) for d in passports}
    four = {k: notes[k] for k in NOTES}
    four_en = {k: notes_en[k] for k in NOTES}
    write_json(OUT / "power.json", indicator_file(
        "power", "個目的地", [YEAR], {p: [v] for p, v in sorted(power.items())}, notes=four, notesEn=four_en))
    write_json(OUT / "openness.json", indicator_file(
        "openness", "本護照", [YEAR], {d: [v] for d, v in sorted(openness.items())}, notes=four, notesEn=four_en))

    ranked = sorted(power.items(), key=lambda x: (-x[1], x[0]))
    rank = {p: 1 + sum(v > power[p] for v in power.values()) for p in passports}
    print(f"  護照實力：最高 {ranked[:5]}，最低 {ranked[-3:]}，台灣 {power['TWN']}（第 {rank['TWN']} 名）")
    print(f"  開放程度：對 198 本都開放 {sum(v == 198 for v in openness.values())} 國，台灣 {openness['TWN']}，"
          f"最低 {sorted(openness.items(), key=lambda x: (x[1], x[0]))[:4]}")
    overall = Counter(c for row in codes.values() for c in row.values())
    print("  全部：" + "、".join(f"{NAMES[c]} {overall[c]}" for c in sorted(overall)))
    twn = Counter(codes["TWN"].values())
    print("  台灣護照：" + "、".join(f"{NAMES[c]} {twn[c]}" for c in sorted(twn)))
    _cross_check(codes["TWN"])

    write_json(OUT / "manifest.json", {
        "topic": "passport",
        "generatedAt": now_iso(),
        "source": f"Passport Index data (passportindex.org), github.com/{pi.REPO} commit {pi.COMMIT}",
        "license": "MIT",
        "dataDate": pi.DATA_DATE,
        "years": [YEAR, YEAR],
        "passports": len(passports),
    })
