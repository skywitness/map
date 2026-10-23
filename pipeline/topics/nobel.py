"""諾貝爾獎主題：各國出生的得主人數（依今日國界）、每千萬人的得主數、當年的得主人數。

- 來源：Nobel Prize API 2.1（Nobel Prize Outreach，CC0，`sources/nobel.py`）。中文名稱用 Wikidata（CC0），
  人均的分母用 UN WPP 2024 的年中人口。
- **國家**：得主的出生地，用 API 的 `birth.place.countryNow`（出生地今天所在的國家）。例如出生在布雷斯勞
  （Breslau，今波蘭 Wrocław）的玻恩算波蘭，出生在台灣新竹的李遠哲算台灣，出生在美國的丁肇中算美國。
  不是國籍：同一個人只算一個國家。API 的國名用 COUNTRY_NAMES 與 sources/countries.py 換成 ISO alpha-3，
  對不上就報錯（不做模糊比對，「Northern Ireland」才不會被配成愛爾蘭）。
- **API 沒有出生地的得主**（2026 年的版本有古納、羅賓森、馬丁尼斯 3 位）：改用 Wikidata 的出生地（P19）
  所在國家（P17），附註會寫出來。還是查不到的只算進世界合計。
- **組織**（紅十字國際委員會、聯合國難民署等 28 個）沒有出生地，不算進各國的人數，也不算進世界合計；
  側欄另外列出成立地點在這個國家的得獎組織（API 的 `founded.place.countryNow`）。
- **計數**：一位得主在一個獎項只算一次，所以「全部獎項」裡居禮夫人（1903 物理、1911 化學）、鮑林、巴丁、
  桑格、夏普萊斯都只算一人；分獎項時居禮夫人在物理、化學各算一次（各獎項加起來會比「全部獎項」多）。
  累計人數從他第一次得獎的那一年起算。拒絕領獎的沙特、黎德壽與被迫放棄的巴斯特納克也算（諾貝爾基金會也列為得主）。
- **每千萬人**：累計人數 ÷ 當年的年中人口（WPP 2024，2024 年起是中推估）× 1,000 萬。WPP 從 1950 年開始，
  所以這個指標從 1950 年（經濟學獎 1969 年）開始，不拿 1950 年的人口去除更早的年份。
- 經濟學獎（瑞典中央銀行紀念諾貝爾經濟科學獎）1969 年才開始頒發，這個子項目的年份從 1969 年開始。
"""
from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field

import pycountry

from common import OUT_DIR, indicator_file, now_iso, write_json
from sources import nobel, wpp
from sources.countries import NAME_ALIASES

OUT = OUT_DIR / "topics" / "nobel"
FIRST_YEAR = 1901
WPP_FIRST = 1950
PER = 1e7  # 每千萬人

# API 的英文類別 → 子項目代碼（跟 src/topics/nobel.ts 的 CATEGORIES 一致）
CATEGORIES = {
    "Physics": "physics",
    "Chemistry": "chemistry",
    "Physiology or Medicine": "medicine",
    "Literature": "literature",
    "Peace": "peace",
    "Economic Sciences": "economics",
}
ITEMS = ["all", *CATEGORIES.values()]
START = {"economics": 1969}  # 經濟學獎 1969 年起頒發
CATEGORY_ZH = {
    "physics": "物理學獎", "chemistry": "化學獎", "medicine": "生理學或醫學獎",
    "literature": "文學獎", "peace": "和平獎", "economics": "經濟學獎",
}
CATEGORY_EN = {
    "physics": "Physics", "chemistry": "Chemistry", "medicine": "Physiology or Medicine",
    "literature": "Literature", "peace": "Peace", "economics": "Economic Sciences",
}

# API 的 countryNow 名稱裡 pycountry 與 sources/countries.py 的 NAME_ALIASES 查不到、或會查錯的
COUNTRY_NAMES = {
    "USA": "USA",
    "the Netherlands": "NLD",
    "East Timor": "TLS",
    "Scotland": "GBR",
    "Northern Ireland": "GBR",
    # 自治領地、海外省：API 自己就寫成「(Denmark)」「, France」，算在所屬的國家（附註會寫）
    "Faroe Islands (Denmark)": "DNK",
    "Guadeloupe, France": "FRA",
}
# 上面算到所屬國家的領地：(領地自己的 ISO 代碼, 中文名, 英文名)，兩邊的附註都會寫
TERRITORIES = {
    "Faroe Islands (Denmark)": ("FRO", "法羅群島", "the Faroe Islands"),
    "Guadeloupe, France": ("GLP", "瓜地洛普", "Guadeloupe"),
}

# 台灣的附註：常被一起提到的華人得主依出生地分別算在哪裡（API 的得主 id → 應該在的國家）。
# 資料有變時（例如 API 改了出生地）建置會報錯，要回頭改附註。
TAIWAN_CHECK = {"265": "TWN", "106": "USA", "68": "CHN", "69": "CHN", "157": "CHN", "838": "CHN"}
TAIWAN_NOTE = (
    "依出生地計算，台灣只有李遠哲（1986 年化學獎，新竹出生）。丁肇中（1976 年物理學獎）出生在美國密西根州安娜堡，算在美國；"
    "楊振寧、李政道（1957 年物理學獎）、崔琦（1998 年物理學獎）、高錕（2009 年物理學獎）出生在中國大陸，算在中國。"
)
TAIWAN_NOTE_EN = (
    "By place of birth, Taiwan has only Yuan T. Lee (Chemistry 1986, born in Hsinchu). Samuel C. C. Ting (Physics 1976) "
    "was born in Ann Arbor, Michigan, and counts for the United States; Chen Ning Yang and Tsung-Dao Lee (Physics 1957), "
    "Daniel C. Tsui (Physics 1998) and Charles K. Kao (Physics 2009) were born in mainland China and count for China."
)


@dataclass
class Laureate:
    id: str
    qid: str | None
    en: str
    zh: str | None = None
    iso3: str | None = None
    place: str | None = None
    # API 的 countryNow 原文（例如「Faroe Islands (Denmark)」），附註用
    country_now: str | None = None
    # [(年, 獎項代碼, 得獎理由)]，依年份排序
    prizes: list[tuple[int, str, str]] = field(default_factory=list)
    org: bool = False


def _iso3(name: str) -> str:
    if name in COUNTRY_NAMES:
        return COUNTRY_NAMES[name]
    if name in NAME_ALIASES:
        return NAME_ALIASES[name]
    try:
        return pycountry.countries.lookup(name).alpha_3
    except LookupError:
        raise RuntimeError(f"Nobel API 的國名「{name}」對不到 ISO 代碼，請加進 COUNTRY_NAMES") from None


def _laureates() -> list[Laureate]:
    out = []
    for raw in nobel.laureates():
        org = "orgName" in raw
        en = (raw["orgName"] if org else raw["knownName"])["en"]
        person = Laureate(id=raw["id"], qid=(raw.get("wikidata") or {}).get("id"), en=en, org=org)
        if org:
            place = (raw.get("founded") or {}).get("place") or {}
            country_now = place.get("countryNow") or raw.get("foundedCountryNow")
        else:
            place = (raw.get("birth") or {}).get("place") or {}
            country_now = place.get("countryNow")
        if country_now:
            person.iso3 = _iso3(country_now["en"])
            person.place = (place.get("locationString") or {}).get("en") or country_now["en"]
            person.country_now = country_now["en"]
        for prize in raw["nobelPrizes"]:
            person.prizes.append((int(prize["awardYear"]), CATEGORIES[prize["category"]["en"]], (prize.get("motivation") or {}).get("en", "")))
        person.prizes.sort()
        out.append(person)
    return out


def _check_prizes(laureates: list[Laureate]) -> int:
    """跟 nobelPrizes 端點核對：每年每類的得主名單要一致。回傳頒發過的獎項數。"""
    from_laureates: dict[tuple[int, str], set[str]] = defaultdict(set)
    for p in laureates:
        for year, cat, _ in p.prizes:
            from_laureates[(year, cat)].add(p.id)
    awarded = 0
    for prize in nobel.prizes():
        key = (int(prize["awardYear"]), CATEGORIES[prize["category"]["en"]])
        ids = {l["id"] for l in prize.get("laureates") or []}
        if ids != from_laureates.get(key, set()):
            raise RuntimeError(f"Nobel API 的兩個端點對不上：{key} {sorted(ids)} vs {sorted(from_laureates.get(key, set()))}")
        awarded += bool(ids)
    return awarded


def _prize_text_zh(prizes: list[tuple[int, str, str]]) -> str:
    return "、".join(f"{year} 年{CATEGORY_ZH[cat]}" for year, cat, _ in prizes)


def _prize_text_en(prizes: list[tuple[int, str, str]]) -> str:
    return ", ".join(f"{CATEGORY_EN[cat]} {year}" for year, cat, _ in prizes)


def build() -> None:
    laureates = _laureates()
    awarded = _check_prizes(laureates)
    people = [p for p in laureates if not p.org]
    orgs = [p for p in laureates if p.org]
    last_year = max(y for p in laureates for y, _, _ in p.prizes)

    # ── API 沒有出生地的得主：用 Wikidata 的出生地補 ──
    notes: dict[str, list[str]] = defaultdict(list)
    notes_en: dict[str, list[str]] = defaultdict(list)
    missing = [p for p in people if p.iso3 is None]
    found = nobel.birth_countries([p.qid for p in missing if p.qid])

    # ── 中文名稱（Wikidata）──
    labels = nobel.zh_labels([p.qid for p in laureates if p.qid])
    sources = Counter()
    for p in laureates:
        p.zh, source = labels.get(p.qid or "", (None, None))
        sources[source or "英文"] += 1
    zh_name = lambda p: p.zh or p.en  # noqa: E731

    for p in missing:
        candidates = found.get(p.qid or "", [])
        if len(candidates) != 1:
            print(f"  警告：{p.en}（{p.id}）沒有出生地，Wikidata 找到 {candidates}，只算進世界合計")
            continue
        p.iso3, place = candidates[0]
        p.place = f"{place} (Wikidata)"
        notes[p.iso3].append(
            f"{zh_name(p)}（{p.en}，{_prize_text_zh(p.prizes)}）在諾貝爾獎的資料裡沒有出生地，依 Wikidata 的出生地（{place}）算在這裡。"
        )
        notes_en[p.iso3].append(
            f"{p.en} ({_prize_text_en(p.prizes)}) has no birthplace in the Nobel Prize data; Wikidata's birthplace ({place}) is used."
        )
        print(f"  {p.en} 的出生地用 Wikidata：{place} → {p.iso3}")

    # ── 附註：算到所屬國家的領地、得過兩次獎的人、台灣 ──
    for name, (code, zh, en) in TERRITORIES.items():
        moved = [p for p in people if p.country_now == name]
        if not moved:
            continue
        sovereign = COUNTRY_NAMES[name]
        who_zh = "、".join(f"{zh_name(p)}（{_prize_text_zh(p.prizes)}）" for p in moved)
        who_en = "; ".join(f"{p.en} ({_prize_text_en(p.prizes)})" for p in moved)
        notes[sovereign].append(f"含出生在{zh}的{who_zh}。")
        notes_en[sovereign].append(f"Includes {who_en}, born in {en}.")
        notes[code].append(f"出生在{zh}的{who_zh}算在{'丹麥' if sovereign == 'DNK' else '法國'}：諾貝爾獎的資料寫成「{name}」。")
        notes_en[code].append(f"{who_en}, born in {en}, counts for {'Denmark' if sovereign == 'DNK' else 'France'}: the Nobel Prize data lists the birthplace as “{name}”.")
    for p in people:
        if len(p.prizes) > 1 and p.iso3:
            notes[p.iso3].append(f"{zh_name(p)}得過兩次獎（{_prize_text_zh(p.prizes)}），「全部獎項」只算一人，各獎項分別算。")
            notes_en[p.iso3].append(f"{p.en} won twice ({_prize_text_en(p.prizes)}): one person under All, counted in each prize category.")
    by_id = {p.id: p for p in people}
    for pid, iso3 in TAIWAN_CHECK.items():
        if by_id[pid].iso3 != iso3:
            raise RuntimeError(f"{by_id[pid].en} 的出生國變成 {by_id[pid].iso3}（附註寫的是 {iso3}），要改 TAIWAN_NOTE")
    notes["TWN"].append(TAIWAN_NOTE)
    notes_en["TWN"].append(TAIWAN_NOTE_EN)
    # 同一國有好幾則附註時接起來（中文句子之間不加空格）
    note_fields = {
        "notes": {k: "".join(v) for k, v in notes.items()},
        "notesEn": {k: " ".join(v) for k, v in notes_en.items()},
    }

    # ── 人口（WPP 2024 年中人口，千人）──
    population = wpp.demographic(["TPopulation1July"], last_year=last_year)["TPopulation1July"]
    world_pop = population.pop("WLD")
    countries = sorted(set(population) | {p.iso3 for p in people if p.iso3})

    # ── 指標檔 ──
    summary = {}
    for item in ITEMS:
        start = START.get(item, FIRST_YEAR)
        years = list(range(start, last_year + 1))
        first: dict[str, int] = {}  # 得主 id → 這個子項目第一次得獎的年份
        won: dict[str, set[int]] = {}
        for p in people:
            prize_years = {y for y, cat, _ in p.prizes if item == "all" or cat == item}
            if prize_years:
                first[p.id] = min(prize_years)
                won[p.id] = prize_years
        cumulative: dict[str, list[float | None]] = {}
        annual: dict[str, list[float | None]] = {}
        for iso3 in countries:
            mine = [p for p in people if p.iso3 == iso3 and p.id in first]
            cumulative[iso3] = [sum(first[p.id] <= y for p in mine) for y in years]
            annual[iso3] = [sum(y in won[p.id] for p in mine) for y in years]
        world_cumulative = [sum(f <= y for f in first.values()) for y in years]
        world_annual = [sum(y in w for w in won.values()) for y in years]

        capita_years = [y for y in years if y >= WPP_FIRST]
        offset = years.index(capita_years[0])
        per_capita = {}
        for iso3 in countries:
            pop = population.get(iso3)
            if not pop:
                continue
            per_capita[iso3] = [
                round(cumulative[iso3][offset + i] / (pop[y] * 1000) * PER, 4) if pop.get(y) else None
                for i, y in enumerate(capita_years)
            ]
        world_capita = [round(world_cumulative[offset + i] / (world_pop[y] * 1000) * PER, 4) for i, y in enumerate(capita_years)]

        write_json(
            OUT / "laureates" / f"{item}.json",
            indicator_file("laureates", "位", years, cumulative, aggregates={"WLD": world_cumulative}, **note_fields),
            quiet=True,
        )
        write_json(
            OUT / "per-capita" / f"{item}.json",
            indicator_file("per-capita", "位／千萬人", capita_years, per_capita, aggregates={"WLD": world_capita}, **note_fields),
            quiet=True,
        )
        write_json(
            OUT / "annual" / f"{item}.json",
            indicator_file("annual", "位", years, annual, aggregates={"WLD": world_annual}, **note_fields),
            quiet=True,
        )
        last = {iso3: s[-1] for iso3, s in cumulative.items()}
        capita_last = {iso3: s[-1] for iso3, s in per_capita.items() if s[-1] is not None}
        summary[item] = (last, world_cumulative[-1], capita_last, world_capita[-1], max(max(s) for s in annual.values()))
        top = sorted(((v, k) for k, v in capita_last.items() if v > 0), reverse=True)[:6]
        print(
            f"  {item}: {years[0]}–{years[-1]}，{sum(v > 0 for v in last.values())} 國，世界 {world_cumulative[-1]} 人；"
            f"每千萬人 世界 {world_capita[-1]:.2f}，最高 {', '.join(f'{k} {v:.1f}' for v, k in top)}；"
            f"單年最多 {summary[item][4]} 人"
        )

    # ── 側欄：每個國家出生的得主與在這裡成立的得獎組織 ──
    per_country: dict[str, dict[str, list]] = defaultdict(lambda: {"laureates": [], "orgs": []})
    order = {cat: i for i, cat in enumerate(CATEGORIES.values())}
    for p in laureates:
        if not p.iso3:
            continue
        for year, cat, motivation in p.prizes:
            per_country[p.iso3]["orgs" if p.org else "laureates"].append(
                [int(p.id), p.zh, p.en, year, cat, motivation, p.place]
            )
    for iso3, data in per_country.items():
        for rows in data.values():
            rows.sort(key=lambda r: (-r[3], order[r[4]], r[2]))
        write_json(OUT / "countries" / f"{iso3}.json", {k: v for k, v in data.items() if v}, quiet=True)
    write_json(OUT / "countries" / "index.json", sorted(per_country))

    write_json(OUT / "manifest.json", {
        "topic": "nobel",
        "generatedAt": now_iso(),
        "source": "Nobel Prize API 2.1 (Nobel Prize Outreach, CC0); Wikidata (CC0); UN WPP 2024",
        "latestYear": last_year,
        "people": len(people),
        "organisations": len(orgs),
        "prizesAwarded": awarded,
    })

    # ── 檢查用的數字 ──
    last, world, capita, world_capita, _ = summary["all"]
    print(f"  {len(people)} 位個人得主、{len(orgs)} 個組織，{FIRST_YEAR}–{last_year} 年共頒發 {awarded} 個獎")
    print("  依出生地（全部獎項）：" + "、".join(f"{k} {last.get(k, 0)}" for k in ("USA", "GBR", "DEU", "FRA", "JPN", "TWN", "CHN", "POL")))
    print(f"  沒有出生國的個人得主：{sum(1 for p in people if not p.iso3)}；組織的成立地點：{sum(1 for p in orgs if p.iso3)} 個有、{sum(1 for p in orgs if not p.iso3)} 個沒有")
    print(f"  中文名稱來源：{dict(sources.most_common())}")
    print(f"  台灣：{by_id['265'].zh}（{by_id['265'].en}）")
