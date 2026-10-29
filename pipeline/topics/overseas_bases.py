"""海外軍事基地（軍事主題的擴充，2026-10-29，製作手冊第五批 64）：各國在國外的軍事基地，國家層級的流向。

使用者 2026-10-29 決定：只做國家層級的流向（派駐國→駐在國），不畫每個基地的點。
資料是英文維基百科「List of countries with overseas military bases」（CC BY-SA 4.0，固定 revid，
sources/wiki_overseas_bases.py），資料檔也用 CC BY-SA 4.0。

- bases-abroad.json：派駐國在幾個國家有軍事基地；foreign-bases.json：駐在國有幾個國家的軍事基地。
- bases-flows.json：流向檔（FlowFile），每一組派駐國→駐在國的值是 1（只有有沒有，沒有數量）；
  notes 是有爭議或要說明的組合（克里米亞、南千島群島…），側欄列出來。
- 表上的「海外領土」：英國的亞克羅提利與德凱利亞主權基地區在賽普勒斯島上，畫到賽普勒斯；亞森欣島算聖赫勒拿。
- 年份是維基百科那個版本的年份（2026），只有一年。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, write_json
from sources import wiki_overseas_bases as wiki
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "military"
LICENSE = "CC BY-SA 4.0"
YEAR = 2026
# 表上的地區 → 地圖上的國家
HOST_FIX = {"Akrotiri and Dhekelia": "CYP", "Ascension Island": "SHN"}
# 要說明的組合（派駐國, 駐在國）→ (中文, 英文)
PAIR_NOTES = {
    ("RUS", "UKR"): ("克里米亞，2014 年起被俄羅斯占領", "Crimea, occupied by Russia since 2014"),
    ("RUS", "GEO"): ("阿布哈茲與南奧塞提亞，2008 年戰爭後俄羅斯駐軍", "Abkhazia and South Ossetia, garrisoned by Russia since the 2008 war"),
    ("RUS", "MDA"): ("聶斯特河沿岸（摩爾多瓦東部的分離地區）", "Transnistria, a breakaway region of eastern Moldova"),
    ("RUS", "JPN"): ("南千島群島：俄羅斯實際控制，日本主張主權（北方領土）", "Southern Kuril Islands: controlled by Russia, claimed by Japan"),
    ("ISR", "SYR"): ("戈蘭高地與敘利亞南部（以色列占領）", "Golan Heights and southern Syria, occupied by Israel"),
    ("TUR", "CYP"): ("北賽普勒斯", "Northern Cyprus"),
    ("USA", "CYP"): ("英國的亞克羅提利與德凱利亞主權基地區", "The UK's Akrotiri and Dhekelia Sovereign Base Areas"),
    ("USA", "SHN"): ("亞森欣島（英國海外領土）", "Ascension Island, a British overseas territory"),
    ("USA", "GRL"): ("格陵蘭（丹麥）", "Greenland (Denmark)"),
    ("USA", "ABW"): ("阿魯巴（荷蘭）", "Aruba (Netherlands)"),
    ("USA", "CUW"): ("古拉索（荷蘭）", "Curaçao (Netherlands)"),
    ("USA", "IOT"): ("迪戈加西亞（英屬印度洋領地）", "Diego Garcia (British Indian Ocean Territory)"),
}
TAIWAN_NOTE = "台灣沒有海外軍事基地，表上也沒有駐在台灣的外國軍事基地。"
TAIWAN_NOTE_EN = "Taiwan has no overseas military bases, and the list shows no foreign bases in Taiwan."


def build() -> None:
    pairs: dict[tuple[str, str], bool] = {}
    unknown = []
    for b in wiki.bases():
        op, host = from_name(b.operator), HOST_FIX.get(b.host) or from_name(b.host)
        if not op or not host:
            unknown.append(b.operator if not op else b.host)
            continue
        if op != host:
            pairs.setdefault((op, host), False)
            pairs[(op, host)] |= b.disputed
    if unknown:
        raise RuntimeError(f"國名對不到 ISO3：{sorted(set(unknown))}")
    missing = [p for p in PAIR_NOTES if p not in pairs]
    if missing:
        raise RuntimeError(f"PAIR_NOTES 的組合不在表上：{missing}")
    disputed = [p for p, d in pairs.items() if d and p not in PAIR_NOTES]
    if disputed:
        raise RuntimeError(f"表上寫 disputed、PAIR_NOTES 沒有說明：{disputed}")
    by: dict[str, dict[str, list[str]]] = {"export": defaultdict(list), "import": defaultdict(list)}
    for op, host in pairs:  # 照表上的順序
        by["export"][op].append(host)
        by["import"][host].append(op)
    flows: dict[str, object] = {"item": "bases", "year": YEAR, "unit": "國", "scale": 1}
    for direction, countries in by.items():
        flows[direction] = {c: [len(ps), [[p, 1] for p in ps]] for c, ps in sorted(countries.items())}
    flows["notes"] = {f"{op}>{host}": list(text) for (op, host), text in PAIR_NOTES.items()}
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "bases-flows.json", flows)
    for name, direction in (("bases-abroad", "export"), ("foreign-bases", "import")):
        values = {c: [len(ps)] for c, ps in sorted(by[direction].items())}
        write_json(OUT / f"{name}.json", indicator_file(
            name, "國", [YEAR], values, license=LICENSE, notes={"TWN": TAIWAN_NOTE}, notesEn={"TWN": TAIWAN_NOTE_EN}))
    top = sorted(((len(v), k) for k, v in by["export"].items()), reverse=True)
    hosts = sorted(((len(v), k) for k, v in by["import"].items()), reverse=True)
    print(f"  {len(pairs)} 組：派駐國 {len(by['export'])} 個 {top}；駐在國 {len(by['import'])} 個，最多 {hosts[:8]}")


if __name__ == "__main__":
    build()
