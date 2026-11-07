"""太空的擴充：衛星放在哪一層軌道、巨型星座的競賽、六大衛星導航系統（2026-11-07，製作手冊第二十七批 605，
候選 1332、1333、1334；步驟 space-orbits，輸出 topics/space/）。資料是太空主題既有的 GCAT `satcat.tsv`（CC BY 4.0）。

- **主要的軌道層**：每年年底在軌的酬載（同 space.py）依 GCAT 的 `OpOrbit`（運作軌道類別）斜線前的部分分層：
  LLEO（實測平均高度約 600 公里以下）、LEO（約 600–2,000 公里）、MEO、GEO、其他（HEO、VHEO、GTO 這些高橢圓與轉移軌道）；
  一國取顆數最多的那一層，至少 5 顆才上色（手冊的陷阱：一兩顆時「主要軌道」沒有意義）。
- **巨型星座**：五個低軌寬頻星座，用 `Owner`（業者代碼）認：Starlink（SPXS）、OneWeb（ONEWEB、ONEWEBN、ONEWEBE）、
  Kuiper（KUIP）、千帆（YUANX，上海垣信）、國網（ZXW，中國衛星網路集團，GCAT 的名稱是 WHDW）。每年年底在軌的顆數，
  依擁有國（State）。
- **衛星導航**：類別是人工整理的事實（自建全球系統：美國 GPS、俄羅斯 GLONASS、中國北斗；歐盟的 Galileo；
  自建區域系統：日本 QZSS、印度 NavIC）；在軌顆數從 GCAT 的名稱認（GPS／Navstar、PLName 的 Uragan、Beidou、Galileo、
  QZS、IRNSS／NVS，QZS 與 NVS 也看 PLName），含已經停用但還在軌道上的。
"""
from __future__ import annotations

from collections import Counter, defaultdict

from common import OUT_DIR, indicator_file, write_json
from sources import gcat

OUT = OUT_DIR / "topics" / "space"
FIRST_YEAR = 1957
MIN_PAYLOADS = 5
LAYERS = {"LLEO": 1, "LEO": 2, "MEO": 3, "GEO": 4, "HEO": 5, "VHEO": 5, "GTO": 5}
CONSTELLATIONS = {
    "starlink": {"SPXS"},
    "oneweb": {"ONEWEB", "ONEWEBN", "ONEWEBE"},
    "kuiper": {"KUIP"},
    "qianfan": {"YUANX"},
    "guowang": {"ZXW"},
}
MEGA_FIRST = 2019
GNSS_SYSTEMS = {
    "gps": lambda r: r["Name"].startswith(("GPS", "Navstar")),
    "glonass": lambda r: "Uragan" in r["PLName"],
    "beidou": lambda r: r["Name"].startswith("Beidou"),
    "galileo": lambda r: "Galileo" in r["Name"],
    "qzss": lambda r: "QZS" in r["Name"] + " " + r["PLName"],
    "navic": lambda r: any(k in r["Name"] + " " + r["PLName"] for k in ("IRNSS", "NVS")),
}
# 1 自建全球系統、2 歐盟的 Galileo、3 自建區域系統
EU = ["AUT", "BEL", "BGR", "HRV", "CYP", "CZE", "DNK", "EST", "FIN", "FRA", "DEU", "GRC", "HUN", "IRL", "ITA", "LVA", "LTU",
      "LUX", "MLT", "NLD", "POL", "PRT", "ROU", "SVK", "SVN", "ESP", "SWE"]
GNSS_ROLE = {"USA": 1, "RUS": 1, "CHN": 1, **{c: 2 for c in EU}, "JPN": 3, "IND": 3}
GNSS_OF = {"USA": ["gps"], "RUS": ["glonass"], "CHN": ["beidou"], "JPN": ["qzss"], "IND": ["navic"]}


def build() -> None:
    mapper = gcat.StateMapper(gcat.orgs())
    sat = gcat.satcat()
    lic = {"license": "CC BY 4.0", "attribution": f"McDowell, Jonathan C., General Catalog of Artificial Space Objects, Release {gcat.RELEASE}"}
    pay = []
    for r in sat:
        launched = gcat.year(r["LDate"])
        if not r["Type"].startswith("P") or launched is None:
            continue
        pay.append({"r": r, "iso3": mapper.iso3(r["State"]), "launched": launched, "gone": gcat.year(r["DDate"]),
                    "layer": LAYERS.get(r["OpOrbit"].split("/")[0])})
    last = max(p["launched"] for p in pay)
    years = list(range(FIRST_YEAR, last + 1))

    def alive(p: dict, y: int) -> bool:
        return p["launched"] <= y and (p["gone"] is None or p["gone"] > y)

    # ── 主要的軌道層 ──
    by_country: dict[str, list[dict]] = defaultdict(list)
    for p in pay:
        if p["iso3"] and p["layer"]:
            by_country[p["iso3"]].append(p)
    main: dict[str, list[int | None]] = {}
    for c, ps in by_country.items():
        row = []
        for y in years:
            cnt = Counter(p["layer"] for p in ps if alive(p, y))
            row.append(min(cnt, key=lambda k: (-cnt[k], k)) if sum(cnt.values()) >= MIN_PAYLOADS else None)
        if any(row):
            main[c] = row
    write_json(OUT / "orbit-layer.json", indicator_file("orbit-layer", "", years, dict(sorted(main.items())), **lic))
    now_layers = {c: Counter(p["layer"] for p in ps if alive(p, last)) for c, ps in by_country.items()}
    dist = Counter(main[c][-1] for c in main if main[c][-1])
    print(f"  主要軌道層（{last} 年，至少 {MIN_PAYLOADS} 顆）：{dict(sorted(dist.items()))}；"
          + "、".join(f"{c} {main[c][-1]}" for c in ("USA", "CHN", "RUS", "JPN", "GBR", "IND", "TWN", "LUX", "IDN", "BRA") if c in main))
    world_layers = Counter(p["layer"] for p in pay if alive(p, last) and p["layer"])
    print(f"  全世界在軌酬載依層：{dict(sorted(world_layers.items()))}")

    # ── 巨型星座 ──
    owner_of = {o: k for k, os in CONSTELLATIONS.items() for o in os}
    myears = list(range(MEGA_FIRST, last + 1))
    mega: dict[str, dict[str, list[int]]] = defaultdict(lambda: {k: [0] * len(myears) for k in CONSTELLATIONS})
    for p in pay:
        k = owner_of.get(p["r"]["Owner"])
        if not k or not p["iso3"]:
            continue
        for i, y in enumerate(myears):
            if alive(p, y):
                mega[p["iso3"]][k][i] += 1
    total = {c: [sum(v[k][i] for k in CONSTELLATIONS) or None for i in range(len(myears))] for c, v in sorted(mega.items())}
    world = [sum(v[k][i] for v in mega.values() for k in CONSTELLATIONS) for i in range(len(myears))]
    write_json(OUT / "megaconstellations.json", indicator_file("megaconstellations", "顆", myears, total, world=world, **lic))
    per = {k: sum(v[k][-1] for v in mega.values()) for k in CONSTELLATIONS}
    print(f"  巨型星座在軌（{last}）：{per}；依國家 " + "、".join(f"{c} {t[-1]}" for c, t in total.items()))
    print("  全世界逐年：" + "、".join(f"{y} {w:,}" for y, w in zip(myears, world)))

    # ── 衛星導航 ──
    gnss_now = {k: sum(1 for p in pay if alive(p, last) and f(p["r"])) for k, f in GNSS_SYSTEMS.items()}
    write_json(OUT / "gnss.json", indicator_file("gnss", "", [last], {c: [v] for c, v in sorted(GNSS_ROLE.items())}, license="CC BY 4.0"))
    print(f"  衛星導航在軌（含停用）：{gnss_now}")

    detail = {}
    for c in sorted(set(now_layers) | set(mega)):
        d: dict = {}
        if sum(now_layers.get(c, {}).values()):
            d["layers"] = [now_layers[c].get(i, 0) for i in range(1, 6)]
        if c in mega:
            d["mega"] = {k: v[-1] for k, v in mega[c].items() if v[-1]}
        if c in GNSS_OF:
            d["gnss"] = {k: gnss_now[k] for k in GNSS_OF[c]}
        detail[c] = d
    write_json(OUT / "space-orbits-detail.json", {"countries": detail, "gnss": gnss_now, "year": last})
    print(f"  台灣各層：{detail.get('TWN')}")
