"""賽車（新主題，社會類「獎項與運動」，2026-10-30，製作手冊第九批順序 160、第一百零九節）：
各類賽事今年（2026）的地點與日期，加上歷年辦過的地點與次數。F1 的累計分站數與車手冠軍照舊由 topics/f1.py 輸出到同一個資料夾。

使用者決定（2026-10-30）：F1 從「運動」搬到這裡；收 F1、MotoGP（含 Moto2、Moto3，同一個週末畫成一站）、UCI 登山車世界盃的
越野（XCO＋XCC）與速降（DHI）、WRC、WEC（含利曼 24 小時）、Formula E、IndyCar、NASCAR Cup、環法、環義、環西、
法國的「地獄山」（Mountain of Hell，雙阿爾卑斯）與「超級雪崩」（Megavalanche，阿爾普迪埃與留尼旺）；同類型的大眾速降另外收
Maxiavalanche 系列、瑞士的 Bike Attack（倫策海德）與冰河速降（薩斯費），三個今年都沒有辦，只有歷年（使用者 2026-10-30 要加）。
台灣都沒有辦過，不另加賽事。

**資料**（sources/wiki_racing.py）：英文維基百科的賽季條目與歷年列表（CC BY-SA 4.0，固定版本），座標用 Wikidata（CC0）。
- **今年**：每一站一個點（日期、站名、場地），賽事的站名、場地照條目的英文原文。同一個週末同一個場地的兩場併成一站
  （Formula E、IndyCar 的 double-header；登山車的 XCO 與 XCC）。三大環賽是每一個賽段：點畫在賽段的終點，線是起點到終點的直線
  （不是實際路線）。比完的與還沒比的分開（AS_OF 那一天以前結束的算比完）。
- **歷年**：各賽事的列表給的次數（F1 是 Jolpica 的分站數、MotoGP 是在這條賽道辦過的大獎賽、WRC 是拉力賽依總部的城鎮、
  Formula E 是各 ePrix 比過的場數、WEC 是比過的賽季數、IndyCar 是 1996 年 IRL 起的場數、三大環賽是開幕站的城鎮、
  超級雪崩是兩站各自有成績的年份、地獄山是觀光局新聞稿的屆數、Maxiavalanche 與瑞士的兩個是各場地辦過的年份）；NASCAR（列表只有比賽名稱）、登山車世界盃（沒有場地的列表）只有今年。

**輸出**（public/data/topics/racing/）：
- season/<子項目>.json：今年的點（子項目 all 是全部，其他是各賽事）；stages/<子項目>.json：三大環賽的賽段連線
- season-count/<子項目>.json：各國今年辦幾場（賽車的一站算一場，環賽經過這個國家算一場）；month-count/<子項目>.json：依月份
- venues/<子項目>.json：歷年辦過的地點（點的大小是次數）；venues-count/<子項目>.json：各國辦過的次數
"""
from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import date

import geoindex
from common import OUT_DIR, indicator_file, lines_file, points_file, write_json, write_manifest_part
from sources import wiki_racing as wiki

OUT = OUT_DIR / "topics" / "racing"
AS_OF = date(2026, 10, 30)  # 這一天以前結束的站算比完了

# 賽事：代碼（地圖上的顏色依代碼的範圍分組，見 src/topics/racing.ts 的 SERIES）
SERIES: dict[str, int] = {
    "f1": 1, "fe": 2, "wec": 3, "indycar": 4, "nascar": 5, "wrc": 6, "motogp": 7,
    "xc": 8, "dh": 9, "mega": 10, "moh": 11, "maxi": 12, "attack": 13, "saasfee": 14, "tdf": 15, "giro": 16, "vuelta": 17,
}
TOURS = ("tdf", "giro", "vuelta")

# 月份的編號：2000 年 1 月是 0（跟「各國在讀什麼」的時間軸一樣，src/topics/reads.ts 的 monthOf）
def month_index(d: date) -> int:
    return (d.year - 2000) * 12 + d.month - 1


def ymd(d: date) -> int:
    return d.year * 10000 + d.month * 100 + d.day


# 條目沒有座標、或座標不是比賽的地方的，換成別的條目查（理由寫在旁邊）
TITLE_FIX = {
    # 環法最後一站：條目是「香榭麗舍大道的賽段」，用大道本身
    "Champs-Élysées stage in the Tour de France": "Champs-Élysées",
    # Formula E 的 ePrix 條目沒有座標，項目的地點（P276）也沒有：用那個 ePrix 的賽道（各 ePrix 條目的資訊框）
    "Hyderabad ePrix": "Hyderabad Street Circuit",
    "Jeddah ePrix": "Jeddah Corniche Circuit",
    "Madrid ePrix": "Circuito del Jarama",
    "Sanya ePrix": "Sanya Street Circuit",
    "Valencia ePrix": "Circuit Ricardo Tormo",
    # 環西第 20 站的終點：英文維基沒有條目（紅色連結），Wikidata 有項目與座標（格拉納達的內華達山脈）
    "Collado del Alguacil": "wd:Q137484891",
    # 環西第 19 站的終點：連結的 [[Peñas Blancas]] 是阿根廷的聚落（Q7179698），比賽在埃斯特波納的山口（Q141302318）
    "Peñas Blancas": "wd:Q141302318",
}

# 依座標判斷的國家（geoindex，Natural Earth 1:10m）在國界河上判錯的：條目 → 國家（Wikidata 的 P17 也是這一國）
COUNTRY_FIXES = {
    "Detroit Street Circuit": "USA",  # 底特律市區的街道賽道，緊貼底特律河，1:10m 的國界把它畫進加拿大的溫莎
    "Passau": "DEU",
    "Campione d'Italia": "ITA",  # 環義的開幕站，瑞士境內的義大利飛地，1:10m 沒有畫出飛地
    "Vatican City": "VAT",  # 環義的開幕站，梵蒂岡太小，1:10m 判成義大利（網站有梵蒂岡的圓點）  # WRC 的中歐拉力賽（2023 年起）的總部，德國帕紹，在因河與多瑙河的匯流處，1:10m 判成奧地利
}

# ── 地獄山、超級雪崩：沒有賽季條目，日期與地點是自己整理的事實（DESIGN.md 第 8 節第 242 點） ──
MASS_START = [
    # (賽事, 名稱, 地點的條目, 地點, 開始, 結束)
    # 主辦單位 UCC Sport Event 的賽事頁「Alpe d'huez 10-11-12 July 2026」（男子決賽 7 月 12 日）
    ("mega", "Megavalanche Alpe d'Huez", "Alpe d'Huez", "Alpe d'Huez", date(2026, 7, 10), date(2026, 7, 12)),
    # 雙阿爾卑斯觀光局 2026-06-21 的成績新聞稿（第 26 屆，6 月 18–21 日，決賽 6 月 21 日；使用者上傳的 PDF 核對過）
    ("moh", "Mountain of Hell", "Les Deux Alpes", "Les 2 Alpes", date(2026, 6, 18), date(2026, 6, 21)),
    # 超級雪崩的留尼旺站：UCC Sport Event 的賽事頁「Megavalanche Saint Paul … 22 Novembre 2026」「Pour cette 31e édition」
    # （2026-10-30 讀的；一天，取消了排位賽日；從馬伊多 Maïdo 的山坡下到聖保羅的 Moulin à Eau，點畫在聖保羅）
    ("mega", "Megavalanche Réunion", "Saint-Paul, Réunion", "Saint-Paul (Réunion)", date(2026, 11, 22), date(2026, 11, 22)),
]

# 地獄山的歷屆：英文維基沒有條目，用雙阿爾卑斯觀光局的新聞稿（2025 年 4 月的 CP N°3，les2alpes.com）：
# 「UN CONCEPT ORIGINAL DEPUIS 2000 … MÊME APRÈS 23 ÉDITIONS」「24ème édition du vendredi 20 juin au dimanche 22 juin」
# 「(pas d'édition en 2024)」，加上 2026 年（6 月 18–21 日）辦過 → 2000–2026 年辦了 25 屆（2024 年與 2000–2023 年間的另一年
# 沒辦，新聞稿沒寫哪一年，2021、2022 年都有辦）。2026 年的新聞稿寫「26e édition」，跟 2025 年的算法差一屆，照實際辦的次數
MOH_HISTORY = {"n": 23 + 1 + 1, "first": 2000, "last": 2026}

# Maxiavalanche（超級雪崩的主辦單位 UCC Sport Event 辦的短版大眾速降系列，2002 年起，DESIGN.md 第 8 節第 242 點）：
# 各站辦過的年份（一年一個場地算一次；2013–2015 年安道爾一年兩站也只算一次），自己整理的事實，出處：
# avalanchecup.com、maxiavalanche.com、avalanchetrophy.com、ucc-sportevent.com 的 Wayback 存檔（2002–2016 年的賽程與成績頁）、
# ucc-sportevent.fr 的文章（wp-json）、enduro-mtb.com 的賽事報導。2026 年沒有辦（UCC 的系列頁到 2026-10-30 還寫「3 étapes en 2025」）。
MAXI_HISTORY = [
    # (地點的條目, 地點, 年份)
    # 安道爾（La Massana；場地名稱依滑雪場改名：Pal Arinsal → Vallnord → Pal Arinsal）。2006 年沒有找到成績，用 UCC 自己的
    # 屆數補：2024 年「En 22 éditions」＝2002–2024 年扣掉 2020 年（2022 年「21 ème anniversaire」也合）
    ("Vallnord", "Pal Arinsal (Vallnord)", [*range(2002, 2020), 2021, 2022, 2023, 2024]),
    # 切爾維尼亞：2003 年「L'étape à Cervinia n'aura pas lieu」、2010 年沒有成績、2020 年沒辦、2024 年取消；2006 年沒有成績，
    # 用 UCC 2023 年的「Voilà 18 ans」補（2018 年是第 14 屆也合）
    ("Breuil-Cervinia", "Cervinia", [2004, 2005, 2006, 2007, 2008, 2009, *range(2011, 2020), 2021, 2022, 2023]),
    # 奧倫（Auron，聖艾蒂安德蒂內鎮內；Wikidata 的 Auron 沒有座標，用鎮）；2021 年只有公告的日期、沒有找到成績，不算
    ("Saint-Étienne-de-Tinée", "Auron", [2002, 2012, 2022, 2023, 2024, 2025]),
    ("Saint-Paul-en-Jarez", "Pilat", [2002, 2003]),
    ("Villars-sur-Ollon", "Villars", [2003, 2004]),
    ("Le Lioran", "Super Lioran", [2004]),
    ("Les Orres", "Les Orres", [2004]),
    ("La Pinilla", "La Pinilla", [2007]),  # 2008 年排了 10 月 5 日，沒有找到成績
    ("Val Thorens", "Val Thorens", [2008, 2009]),
    ("Bardonecchia", "Bardonecchia", [2008, 2009]),
    ("Flims", "Flims", [2009, 2010, 2011]),
    ("Samoëns", "Samoëns", [2010]),
    ("Åre", "Åre", [2010, 2011, 2012]),  # 2013 年取消，改在安道爾
    ("Orcières", "Orcières", [2012, 2013, 2014]),
    ("Ax 3 Domaines", "Ax 3 Domaines", [2018, 2019, 2023, 2025]),  # 2018 年「première édition」；2020 年排了沒辦
    ("Méribel", "Méribel", [2019, 2020]),
    ("Alpe d'Huez", "Alpe d'Huez", [2020]),  # 超級雪崩因疫情取消的那年，8 月 1–2 日改辦 Maxiavalanche
    ("Pra-Loup", "Pra-Loup", [2022, 2023]),
]

# 瑞士的兩個已經停辦的大眾速降（都沒有 2026 年），辦過的年份是自己整理的事實：
OTHER_MASS_HISTORY = [
    # (賽事, 地點的條目, 地點, 年份)
    # Bike Attack（2007 年起叫 Trek Bike Attack）：倫策海德的 Parpaner Rothorn 山頂一起出發，2004 年以前到庫爾、2007 年起到
    # Churwalden。bike-attack.ch 的 Wayback 存檔（2003 年「6. Austragung」、2004 年「7. BIKE-ATTACK」、2005 年「keinen
    # BIKE-ATTACK mehr」、2007 年「wieder」）、datasport 的成績（2007–2017 年只缺 2010 年）、enduro-mtb.com（2014 年
    # 「zum 14. Mal」、2015 年「das 15.」）、lenzerheide.com（2017 年「17. Austragung」、「Kein Bike Attack 2018 … nach 17.
    # Austragungen」）。2005、2006、2010 年沒辦，屆數剛好對得起來
    ("attack", "Lenzerheide", "Lenzerheide", [*range(1998, 2005), 2007, 2008, 2009, *range(2011, 2018)]),
    # Glacier Bike Downhill：薩斯費的 Mittelallalin 冰河（約 3,500 m）一起出發，下到村裡。saas-fee.ch 的歷屆冠軍表（Wayback
    # 2020-03）列 2004–2008、2010–2018 年，2009 年天候取消、2019 年「Rennen abgesagt」；2021 年「ABGESAGT」，之後沒有再辦。
    # 官方的屆數連取消的 2009 年也算（2018 年「15. Glacier Bike Downhill」），照實際比過的次數。2004 年是「nach Jahren wieder」
    # （ride-mtb.com），更早的幾屆查不到年份，不算
    ("saasfee", "Saas-Fee", "Saas-Fee", [*range(2004, 2009), *range(2010, 2019)]),
]


def build() -> None:
    events: list[dict] = []
    for key in ("f1", "motogp", "wrc", "wec", "fe", "indycar", "nascar", "xc", "dh"):
        for e in wiki.season(key):
            events.append({"s": key, "name": e.name, "venue": e.venue, "label": e.venue_text, "place": e.place,
                           "start": e.start, "end": e.end, "rnd": e.round, "fmt": "+".join(e.extra.get("formats", []))})
    for s, name, venue, place, start, end in MASS_START:
        events.append({"s": s, "name": name, "venue": venue, "label": place, "place": place, "start": start, "end": end,
                       "rnd": "", "fmt": ""})
    stages: list[dict] = []
    for key in TOURS:
        for st in wiki.stages(key):
            stages.append({"s": key, "rnd": st.number, "day": st.day, "a": st.start, "b": st.finish, "cancelled": st.cancelled})

    # ── 座標 ──
    titles = {TITLE_FIX.get(e["venue"], e["venue"]) for e in events}
    for st in stages:
        titles |= {TITLE_FIX.get(st["a"][0], st["a"][0]), TITLE_FIX.get(st["b"][0], st["b"][0])}
    history = _history()
    titles |= {TITLE_FIX.get(v["title"], v["title"]) for v in history if v["title"]}
    en = [t for t in titles if not t.startswith(("it:", "wd:"))]
    it = [t[3:] for t in titles if t.startswith("it:")]
    coords = wiki.coordinates(en)
    coords |= {f"it:{t}": c for t, c in wiki.coordinates(it, "it").items()} if it else {}
    coords |= {f"wd:{q}": c for q, c in wiki.item_coordinates([t[3:] for t in titles if t.startswith("wd:")]).items()}
    missing = sorted(t for t in titles if t not in coords)
    if missing:
        raise ValueError(f"這些條目在 Wikidata 找不到座標：{missing}")

    def where(title: str) -> tuple[float, float, str]:
        return coords[TITLE_FIX.get(title, title)]

    # ── 今年的點 ──
    rows: list[dict] = []
    for e in events:
        lon, lat, _ = where(e["venue"])
        rows.append({"_t": e["venue"], "lon": lon, "lat": lat, "s": SERIES[e["s"]], "name": e["name"], "venue": e["label"], "place": e["place"],
                     "rnd": e["rnd"], "fmt": e["fmt"] or None, "d0": ymd(e["start"]), "d1": ymd(e["end"]), "m": month_index(e["start"])})
    lines: list[list[tuple[float, float]]] = []
    line_rows: list[dict] = []
    for st in stages:
        a, b = where(st["a"][0]), where(st["b"][0])
        rows.append({"_t": st["b"][0], "lon": b[0], "lat": b[1], "s": SERIES[st["s"]], "name": "", "venue": st["b"][1], "place": st["b"][1],
                     "from": st["a"][1], "rnd": st["rnd"], "fmt": "x" if st["cancelled"] else None,
                     "d0": ymd(st["day"]), "d1": ymd(st["day"]), "m": month_index(st["day"])})
        if (a[0], a[1]) != (b[0], b[1]):
            lines.append([(a[0], a[1]), (b[0], b[1])])
            line_rows.append({"s": SERIES[st["s"]], "rnd": st["rnd"], "from": st["a"][1], "to": st["b"][1], "d0": ymd(st["day"]),
                              "m": month_index(st["day"]), "done": 1 if st["day"] < AS_OF else None,
                              "todo": None if st["day"] < AS_OF else 1})
    isos = geoindex.countries_at([r["lon"] for r in rows], [r["lat"] for r in rows])
    for r, iso3 in zip(rows, isos):
        iso3 = COUNTRY_FIXES.get(r["_t"], iso3)
        if iso3 is None:
            raise ValueError(f"找不到國家：{r}")
        r["iso3"] = iso3
        done = r["d1"] < ymd(AS_OF)
        r["done"], r["todo"] = (1, None) if done else (None, 1)
    rows.sort(key=lambda r: (r["d0"], r["s"]))
    stage_isos = {}  # 環賽經過的國家：賽段的起點、終點
    for st in stages:
        a, b = where(st["a"][0]), where(st["b"][0])
        for title, iso3 in zip((st["a"][0], st["b"][0]), geoindex.countries_at([a[0], b[0]], [a[1], b[1]])):
            iso3 = COUNTRY_FIXES.get(title, iso3)
            stage_isos.setdefault(st["s"], {}).setdefault(iso3, []).append(st["day"])

    OUT.mkdir(parents=True, exist_ok=True)
    fields = ["lon", "lat", "s", "name", "venue", "place", "from", "rnd", "fmt", "d0", "d1", "m", "iso3", "done", "todo"]
    scale = {"lon": 0.0001, "lat": 0.0001, "s": 1, "d0": 1, "d1": 1, "m": 1, "done": 1, "todo": 1}
    code_of = {v: k for k, v in SERIES.items()}
    # 今年沒有辦的賽事（Maxiavalanche 等）不輸出今年的檔，子項目也不列（src/topics/racing.ts 的 SEASON_DIMENSION）
    items = ["all", *(k for k in SERIES if any(code_of[r["s"]] == k for r in rows))]
    for item in items:
        sel = [r for r in rows if item == "all" or code_of[r["s"]] == item]
        write_json(OUT / "season" / f"{item}.json", points_file(sel, fields, scale, strings=("name", "venue", "place", "from")), quiet=True)
        if item in ("all", *TOURS):
            keep = [i for i, r in enumerate(line_rows) if item == "all" or code_of[r["s"]] == item]
            write_json(OUT / "stages" / f"{item}.json", lines_file(
                [lines[i] for i in keep], 0.001, records=[line_rows[i] for i in keep],
                record_fields=["s", "rnd", "from", "to", "d0", "m", "done", "todo"],
                record_scale={"s": 1, "d0": 1, "m": 1, "done": 1, "todo": 1}), quiet=True)

        # 各國今年辦幾場：賽車的一站算一場、環賽經過這個國家算一場（起點或終點在這個國家的賽段）
        per: dict[str, Counter] = defaultdict(Counter)  # 國家 → 月份 → 場數
        for r in rows:
            key = code_of[r["s"]]
            if key in TOURS or (item != "all" and key != item):
                continue
            per[r["iso3"]][r["m"]] += 1
        for key, by_iso in stage_isos.items():
            if item not in ("all", key):
                continue
            for iso3, days in by_iso.items():
                per[iso3][month_index(min(days))] += 1
        months = list(range(month_index(date(2025, 12, 1)), month_index(date(2026, 12, 1)) + 1))
        notes = {"TWN": "台灣今年沒有這些賽事的分站（F1、MotoGP、WRC、WEC、Formula E、IndyCar、NASCAR、UCI 登山車世界盃、三大環賽都沒有在台灣辦過）。"}
        notes_en = {"TWN": "Taiwan hosts none of these events this year (none of Formula One, MotoGP, WRC, WEC, Formula E, IndyCar, NASCAR, the UCI Mountain Bike World Cup or the three Grand Tours has ever been held in Taiwan)."}
        write_json(OUT / "season-count" / f"{item}.json", indicator_file(
            "season", "場", [2026], {iso3: [sum(c.values())] for iso3, c in per.items()}, notes=notes, notesEn=notes_en), quiet=True)
        write_json(OUT / "month-count" / f"{item}.json", indicator_file(
            "month", "場", months, {iso3: [c.get(m) for m in months] for iso3, c in per.items()}, notes=notes, notesEn=notes_en), quiet=True)

    for t, via in sorted(wiki.VIA.items()):
        print(f"  {t}：條目沒有座標，用{'地點（P276）' if via[0] == 'P276' else '所在的行政區（P131）'}的 {via[1:]}")
    _check_countries(coords, [(r["_t"], r["iso3"]) for r in rows])
    _write_history(history, coords)
    counts = Counter(code_of[r["s"]] for r in rows)
    write_manifest_part(OUT, "racing", "racing", {"asOf": AS_OF.isoformat(), "events": dict(counts), "stageLines": len(lines)})
    print(f"  今年 {len(rows)} 個點（{dict(counts)}），環賽連線 {len(lines)} 條；比完 {sum(1 for r in rows if r['done'])} 個")
    print(f"  今年最多：{sorted(((sum(1 for r in rows if r['iso3'] == i), i) for i in {r['iso3'] for r in rows}), reverse=True)[:8]}")


def _check_countries(coords: dict, pairs: list[tuple[str, str]]) -> None:
    """依座標判斷的國家跟 Wikidata 的 P17 對照，不一樣的印出來（看過的寫進 COUNTRY_FIXES；英國的屬地、荷蘭的 P17
    是王國，本來就對不上）"""
    qids = {t: coords[TITLE_FIX.get(t, t)][2] for t, _ in pairs}
    wd = wiki.item_countries(list(qids.values()))
    for t, iso3 in sorted(set(pairs)):
        known = wd.get(qids[t], set())
        if known and iso3 not in known:
            print(f"  國家對不上：{t} 依座標是 {iso3}，Wikidata 是 {sorted(known)}")


# ── 歷年 ────────────────────────────────────────────────────────────
def _f1_circuits() -> list[dict]:
    """F1：topics/f1.py 輸出的賽道（Jolpica 的分站數、經緯度）；要先跑 f1 這一步"""
    data = json.loads((OUT / "circuits.json").read_text(encoding="utf-8"))
    cols = dict(zip(data["fields"], data["columns"]))
    sc = data["scale"]
    out = []
    for i in range(len(cols["name"])):
        out.append({"s": "f1", "title": None, "label": cols["name"][i], "n": cols["n"][i] * sc.get("n", 1),
                    "first": cols["first"][i], "last": cols["last"][i], "iso3": cols["iso3"][i],
                    "lon": cols["lon"][i] * sc["lon"], "lat": cols["lat"][i] * sc["lat"]})
    return out


def _history() -> list[dict]:
    out = _f1_circuits()
    for v in wiki.motogp_circuits() + wiki.wrc_rallies():
        out.append({"s": v.series, "title": v.title, "label": v.label, "n": v.n, "first": v.first, "last": v.last})
    for title, label, n, seasons in wiki.fe_eprix():
        # 第 1 季是 2014–15：年份寫成季開始的那一年
        out.append({"s": "fe", "title": title, "label": label, "n": n,
                    "first": 2014 + min(seasons) if seasons else None, "last": 2014 + max(seasons) if seasons else None})
    by_town: dict[str, list] = defaultdict(list)
    for year, title, label in wiki.tdf_departs():
        by_town[title].append((year, label))
    for title, ys in by_town.items():
        years = [y for y, _ in ys]
        out.append({"s": "tdf", "title": title, "label": ys[-1][1], "n": len(years), "first": min(years), "last": max(years)})
    for v in wiki.wec_races() + wiki.indycar_tracks():
        out.append({"s": v.series, "title": v.title, "label": v.label, "n": v.n, "first": v.first, "last": v.last})
    for key, series in (("giro-starts", "giro"), ("vuelta-starts", "vuelta")):
        by_town = defaultdict(list)
        for year, title, label in wiki.grand_starts(key):
            by_town[title].append((year, label))
        for title, ys in by_town.items():
            years = [y for y, _ in ys]
            out.append({"s": series, "title": title, "label": ys[-1][1], "n": len(years), "first": min(years), "last": max(years)})
    for venue, title, label in (("Megavalanche Alpe D'Huez", "Alpe d'Huez", "Alpe d'Huez"),
                                ("Megavalanche Réunion", "Saint-Paul, Réunion", "Saint-Paul (Réunion)")):
        mega = wiki.megavalanche_years(venue)
        out.append({"s": "mega", "title": title, "label": label, "n": len(mega), "first": min(mega), "last": max(mega)})
    out.append({"s": "moh", "title": "Les Deux Alpes", "label": "Les 2 Alpes", **MOH_HISTORY})
    for title, label, years in MAXI_HISTORY:
        out.append({"s": "maxi", "title": title, "label": label, "n": len(years), "first": min(years), "last": max(years)})
    for series, title, label, years in OTHER_MASS_HISTORY:
        out.append({"s": series, "title": title, "label": label, "n": len(years), "first": min(years), "last": max(years)})
    return out


def _write_history(history: list[dict], coords: dict) -> None:
    for v in history:
        if v["title"]:
            v["lon"], v["lat"], v["qid"] = coords[TITLE_FIX.get(v["title"], v["title"])]
    isos = geoindex.countries_at([v["lon"] for v in history], [v["lat"] for v in history])
    for v, iso3 in zip(history, isos):
        # F1 的賽道照 Jolpica 的國家（跟「舉辦的分站數」一致）；其他依座標
        iso3 = v.get("iso3") or COUNTRY_FIXES.get(v["title"], iso3)
        if iso3 is None:
            raise ValueError(f"找不到國家：{v}")
        v["iso3"] = iso3
    _check_countries(coords, [(v["title"], v["iso3"]) for v in history if v["title"]])
    fields = ["lon", "lat", "s", "name", "iso3", "n", "first", "last", "mix"]
    scale = {"lon": 0.0001, "lat": 0.0001, "s": 1, "n": 1, "first": 1, "last": 1}
    keys = sorted({v["s"] for v in history}, key=lambda k: SERIES[k])
    for item in ["all", *keys]:
        sel = [v for v in history if item == "all" or v["s"] == item]
        if item == "all":
            # 全部：同一個地方（座標相差不到約 2 km）的各賽事併成一個點，mix 列出各賽事的次數，顏色依次數最多的賽事
            merged: list[dict] = []
            for v in sorted(sel, key=lambda v: -v["n"]):
                same = next((m for m in merged if abs(m["lon"] - v["lon"]) < 0.02 and abs(m["lat"] - v["lat"]) < 0.02), None)
                if same:
                    same["n"] += v["n"]
                    same["parts"].append(v)
                else:
                    merged.append({**v, "parts": [v]})
            pts = []
            for m in merged:
                parts = sorted(m["parts"], key=lambda p: -p["n"])
                pts.append({"lon": m["lon"], "lat": m["lat"], "s": SERIES[parts[0]["s"]], "name": parts[0]["label"], "iso3": m["iso3"],
                            "n": m["n"], "first": min((p["first"] for p in parts if p["first"]), default=None),
                            "last": max((p["last"] for p in parts if p["last"]), default=None),
                            "mix": "|".join(f"{SERIES[p['s']]}:{p['n']}:{p['label']}" for p in parts) if len(parts) > 1 else None})
        else:
            pts = [{"lon": v["lon"], "lat": v["lat"], "s": SERIES[v["s"]], "name": v["label"], "iso3": v["iso3"], "n": v["n"],
                    "first": v["first"], "last": v["last"], "mix": None} for v in sel]
        # 大的先畫、小的疊在上面（比例符號地圖的慣例，大的圓不會把旁邊的小點蓋掉）
        pts.sort(key=lambda p: -p["n"])
        write_json(OUT / "venues" / f"{item}.json", points_file(pts, fields, scale, strings=("name",)), quiet=True)
        per = Counter()
        for v in sel:
            per[v["iso3"]] += v["n"]
        notes = {"TWN": "台灣沒有辦過這些賽事。"}
        notes_en = {"TWN": "Taiwan has never hosted any of these events."}
        write_json(OUT / "venues-count" / f"{item}.json", indicator_file(
            "venues", "次", [2026], {iso3: [n] for iso3, n in per.items()}, notes=notes, notesEn=notes_en), quiet=True)
        if item == "all":
            print(f"  歷年 {len(sel)} 個地點、併成 {len(pts)} 個點；最多：{per.most_common(8)}")
        else:
            print(f"  歷年 {item}：{len(sel)} 個地點、{sum(v['n'] for v in sel)} 次")


if __name__ == "__main__":
    build()
