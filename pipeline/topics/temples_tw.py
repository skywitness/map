"""台灣的寺廟與教會：縣市分布與主祀神祇（2026-11-07，製作手冊第二十七批 557，候選 1253；擴充「宗教」的台灣層，
步驟 temples-tw，輸出 topics/religion/）。

資料：內政部「全國宗教資訊系統資料－寺廟」（data.gov.tw 8203，temple.xml，12,427 筆）與「－法人教會」（8204，
church.xml，1,036 筆），政府資料開放授權條款第 1 版。religion.moi.gov.tw 從 cloud 連不上，本機 session 2026-11-07 照一般方式
下載，放在 skywitness/map-plan 的 data/moi/（commit ba3fe41，README 寫了欄位、筆數與 SHA-256）；重跑前複製到
pipeline/.cache/moi-religion/。縣市人口用戶政司（sources/ris.py）2025 年底。

- 只有登記的寺廟（正式登記、補辦登記）與立案成財團法人的教會：沒有登記的神壇、私人宮廟與一般的教會、堂會都不在裡面
  （內政部的宗教統計 2025 年底登記的寺廟 12,397 座、教會〔堂〕2,855 所，這裡的教會只有 1,036 個財團法人），說明寫明。
- 主祀神祇是自由填寫的文字（1,950 種寫法），依關鍵字歸成 8 類（GROUPS，第一個符合的算）：媽祖、土地公、王爺、玄天上帝、
  關聖帝君、觀音、佛與菩薩（不含觀音；濟公活佛是民間信仰的神明，不算）、其他神明。
- 點：檔案裡有 WGS84 座標，台灣與金馬範圍外（沒有座標、0 或接近 0 的錯值）不畫，但算進縣市的數目；不放負責人與電話
  （真實姓名，map-plan 的 README 建議不要顯示）。
- 縣市統計（tw-temples-summary.json）：各縣市的寺廟、法人教會數、每十萬人幾座寺廟、8 類的組成，全國最多的主祀神祇寫法。
"""
from __future__ import annotations

import hashlib
import re
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict

from common import CACHE_DIR, OUT_DIR, indicator_file, points_file, write_json
from sources import ris

OUT = OUT_DIR / "topics" / "religion"
DIR = CACHE_DIR / "moi-religion"
FILES = {
    "temple.xml": "354ef7636e40aefc6ccd1b0b603fe61bd7c883d52e3698d9785cb122e4cd558f",
    "church.xml": "2408243d6aa3f11682fadc557480ec55d4163a5d728df120ade4ce4ad95e6404",
}
POP_YEAR = 2025
CHURCH = 9
# (類別, 關鍵字)；依序比對，第一個符合的算（「天上聖母、南天福德正神」算媽祖）
GROUPS = [
    (1, ("天上聖母", "媽祖", "天后", "天妃", "湄洲")),
    (2, ("福德", "土地公", "伯公", "土地爺")),
    (3, ("千歲", "王爺", "代天巡狩")),
    (4, ("玄天上帝", "真武", "北極", "上帝公", "帝爺公")),
    (5, ("關聖", "關公", "文衡聖帝", "協天大帝", "恩主公", "關帝")),
    (6, ("觀世音", "觀音")),
    (7, ("佛", "菩薩", "如來", "西方三聖")),
]
OTHER = 8
NOT_BUDDHA = ("濟公", "活佛")
NAMES = {1: "媽祖", 2: "土地公", 3: "王爺", 4: "玄天上帝", 5: "關聖帝君", 6: "觀音", 7: "佛與菩薩", 8: "其他神明", 9: "法人教會"}


def deity_group(deity: str) -> int:
    for g, keys in GROUPS:
        if g == 7 and any(k in deity for k in NOT_BUDDHA):
            continue
        if any(k in deity for k in keys):
            return g
    return OTHER


def _rows(name: str) -> list[dict[str, str]]:
    path = DIR / name
    if not path.exists():
        raise RuntimeError(f"沒有 {path}：請把 map-plan 的 data/moi/{name} 複製到這裡")
    if hashlib.sha256(path.read_bytes()).hexdigest() != FILES[name]:
        raise RuntimeError(f"{path} 的 SHA-256 跟 map-plan 的 README 不一樣，檔案可能換了版本，先看過再改 FILES")
    return [{c.tag: (c.text or "").strip() for c in r} for r in ET.parse(path).getroot()]


def _district(r: dict[str, str]) -> str:
    """地址裡縣市後面的鄉鎮市區（臺南市白河區… → 白河區）；對不到是空字串"""
    m = re.match(r"(.{1,4}?[區鄉鎮市])", r["地址"].removeprefix(r["行政區"]).replace("台", "臺"))
    return m.group(1) if m else ""


def _coords(r: dict[str, str]) -> tuple[float, float] | None:
    try:
        lon, lat = float(r.get("WGS84X") or 0), float(r.get("WGS84Y") or 0)
    except ValueError:
        return None
    return (round(lon, 5), round(lat, 5)) if 118 < lon < 123 and 21 < lat < 27 else None


def build() -> None:
    temples, churches = _rows("temple.xml"), _rows("church.xml")
    points, counties = [], defaultdict(Counter)
    deities = Counter()
    no_coords = Counter()
    for r in temples:
        g = deity_group(r.get("主祀神祇", ""))
        counties[r["行政區"]][g] += 1
        deities[r.get("主祀神祇", "")] += 1
        c = _coords(r)
        if not c:
            no_coords["temple"] += 1
            continue
        points.append({"lon": c[0], "lat": c[1], "g": g, "n": r["寺廟名稱"], "d": r.get("主祀神祇", ""),
                       "c": r["行政區"], "a": _district(r), "r": r.get("教別", "")})
    for r in churches:
        counties[r["行政區"]][CHURCH] += 1
        c = _coords(r)
        if not c:
            no_coords["church"] += 1
            continue
        points.append({"lon": c[0], "lat": c[1], "g": CHURCH, "n": r["教會名稱"], "d": "", "c": r["行政區"],
                       "a": _district(r), "r": ""})
    points.sort(key=lambda p: (p["g"], p["c"], p["n"]))
    write_json(OUT / "tw-temples.json", points_file(
        points, ["lon", "lat", "g", "n", "d", "c", "a", "r"], {"lon": 0.00001, "lat": 0.00001, "g": 1}, strings=("d", "c", "a", "r")))
    write_json(OUT / "tw-temples-ind.json", indicator_file("tw-temples", "", [2026], {}))

    pop = ris.county_population(POP_YEAR)
    summary = {
        "groups": {str(k): v for k, v in NAMES.items()},
        "popYear": POP_YEAR,
        "total": {"temples": len(temples), "churches": len(churches), "noCoords": dict(no_coords)},
        "national": {str(g): n for g, n in sorted(Counter(deity_group(r.get("主祀神祇", "")) for r in temples).items())},
        "topDeities": [[d, n] for d, n in deities.most_common(15) if d],
        "counties": {
            c: {
                "temples": sum(n for g, n in cnt.items() if g != CHURCH),
                "churches": cnt.get(CHURCH, 0),
                "pop": pop.get(c),
                "groups": {str(g): n for g, n in sorted(cnt.items()) if g != CHURCH},
            }
            for c, cnt in sorted(counties.items())
        },
        "license": "政府資料開放授權條款第 1 版",
    }
    missing = set(summary["counties"]) - set(pop)
    if missing:
        raise RuntimeError(f"戶政司的人口沒有這些縣市：{missing}")
    write_json(OUT / "tw-temples-summary.json", summary)

    print(f"  寺廟 {len(temples):,}、法人教會 {len(churches):,}；點 {len(points):,}（沒有座標：{dict(no_coords)}）")
    print("  主祀神祇：" + "、".join(f"{NAMES[int(g)]} {n:,}" for g, n in summary["national"].items()))
    rate = sorted(((v["temples"] / v["pop"] * 1e5, c, v["temples"]) for c, v in summary["counties"].items()), reverse=True)
    print("  每十萬人的寺廟：" + "、".join(f"{c} {r:.1f}（{n}）" for r, c, n in rate))
    for g in range(1, 9):
        top = sorted(((v["groups"].get(str(g), 0) / v["temples"], c) for c, v in summary["counties"].items()), reverse=True)[:3]
        print(f"    {NAMES[g]} 比例最高：{[(c, round(s * 100, 1)) for s, c in top]}")
    print(f"  前 15 種主祀神祇：{summary['topDeities']}")
