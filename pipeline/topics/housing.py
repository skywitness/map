"""住宅主題：住宅類型（公寓住戶比例）、自有住宅率、平均每戶人數、居住擁擠率、住房負擔過重率、都市貧民窟人口比例。

- 歐洲用 Eurostat 的 EU-SILC（以人計算）；歐洲以外的 OECD 國家用 OECD 可負擔住宅資料庫（多半以戶計算）補上。
  住宅類型、擁擠、負擔這幾項沒有全球的開放資料，所以主要只有歐洲與 OECD 國家，見 DESIGN.md 第 8 節。
- 平均每戶人數用聯合國的家戶規模資料庫（各國普查與調查，幾乎所有國家，但年份零散），歐洲另用 EU-SILC 的逐年資料。
- 都市貧民窟人口比例用世界銀行轉載的 UN-Habitat 估計，每兩年一次。
- 台灣：住宅類型用內政部房屋稅籍（依建築總樓層），自有住宅率與平均每戶人數用主計總處家庭收支調查。
- 普查、調查的年份零散，指標檔加上 latestWithin：前端顯示每個國家 N 年內最近一年的值，並標出資料年份。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, latest_year_span, to_series, write_json, write_manifest_part
from sources import eurostat, fies, moi_realestate, oecd_ahd, un_households, worldbank

Series = dict[str, dict[int, float]]

DWELLING_FILE = "HM1-5-Housing-stock-by-dwelling-type.xlsx"
DWELLING_TYPES = {"Detached house": "detached", "Semi-detached house": "semi", "Flat": "flat", "Others": "other", "Unspecified": "other"}
TENURE_FILE = "HM1-3-Housing-tenures.xlsx"
OWNER = {"Own outright", "Owner with mortgage"}
TENURES = OWNER | {"Rent (private)", "Rent (subsidised)", "Other, unknown"}
# EU-SILC 的住宅類型代碼 → 側欄分類（FLAT 就是公寓住戶比例本身）
EU_DWELLING = {"detached": "HOUSE_D", "semi": "HOUSE_SD", "flat": "FLAT", "other": "OTH"}
# OECD 把雙併併進獨棟的國家；紐西蘭的雙併與公寓合在「未分類」，算不出公寓比例，不收
DETACHED_INCLUDES_SEMI = {"CHL", "COL", "MEX"}
DWELLING_SKIP = {"NZL"}
# 台灣依建築總樓層：4 層以上算公寓（公寓、華廈、大樓），1–3 層算透天厝與平房
TAIWAN_FLOORS = {"floors-1-3": ["1-3"], "floors-4-5": ["4-5"], "floors-6-10": ["6-10"], "floors-11": ["11-15", "16+"]}
TAIWAN_FLAT_FLOORS = ["4-5", "6-10", "11-15", "16+"]

# 各指標：每個國家顯示幾年內最近一年的值（latestWithin）
WITHIN = {
    "apartment-share": 10,  # OECD 的國家多半 2–5 年一次（日本 5 年、美國 2 年），墨西哥、哥倫比亞只有一次普查
    "home-ownership": 10,
    "household-size": 10,  # 普查 10 年一次
    "overcrowding": 3,  # Eurostat 每年都有，只補還沒公布的最新一年
    "cost-overburden": 3,
}

OECD_NOTE = {
    "apartment-share": (
        "OECD 可負擔住宅資料庫（各國普查或住宅調查），以有人居住的住宅計算（歐洲是以人計算）",
        "OECD Affordable Housing Database (national censuses or housing surveys): share of occupied dwellings "
        "(counted by household), whereas European figures are shares of people",
    ),
    "home-ownership": (
        "OECD 可負擔住宅資料庫（各國的家戶調查），以戶計算（歐洲是以人計算），含有房貸與無房貸的自有住宅",
        "OECD Affordable Housing Database (national household surveys), counted by household (European figures "
        "are shares of people); includes owners with and without a mortgage",
    ),
}
SEMI_NOTE = ("；無法區分獨棟與雙併，雙併算在獨棟裡", "; detached and semi-detached houses cannot be told apart, so both count as detached")

TAIWAN_NOTES = {
    "apartment-share": (
        "內政部不動產資訊平台的房屋稅籍住宅（含空屋，每年第 4 季），台灣官方統計只依整棟建築的總樓層分類："
        "4 層以上算公寓（公寓、華廈、大樓），1–3 層算透天厝與平房。4–5 層的透天厝也會算成公寓，可能略為高估",
        "Dwellings on the property tax register (including vacant ones, fourth quarter of each year) from the Ministry "
        "of the Interior's real estate information platform. Taiwan's official statistics classify dwellings only by "
        "the number of floors of the building: 4 floors or more count as apartments, 1–3 floors as houses (mostly "
        "terraced townhouses). Townhouses with 4–5 floors are also counted as apartments, so the share may be "
        "slightly overstated",
    ),
    "home-ownership": (
        f"主計總處家庭收支調查，住宅由戶內經常居住成員擁有的家庭比例（以戶計算），{fies.OWNERSHIP_FROM} 年起；"
        "之前的定義含不住在一起的配偶、父母或子女擁有的住宅，不能接起來。2020 年人口及住宅普查是 78.6%，調查方式不同",
        "Share of households whose home is owned by a member who usually lives there, from the DGBAS Survey of "
        f"Family Income and Expenditure (counted by household), from {fies.OWNERSHIP_FROM}; the earlier definition "
        "also counted homes owned by a spouse, parent or child living elsewhere, so it is not comparable. "
        "The 2020 census gives 78.6% using a different method",
    ),
    "household-size": (
        "主計總處家庭收支調查的平均每戶人數（台灣不在聯合國的資料庫中）",
        "Average household size from the DGBAS Survey of Family Income and Expenditure (Taiwan is not in the UN database)",
    ),
}


def add_after(base: Series, extra: Series) -> set[str]:
    """把 extra 補進 base：base 沒有的國家整個補上；有的國家只補 base 最後一年之後的年份（例如英國脫歐後）。
    回傳有用到 extra 的國家。"""
    used = set()
    for iso3, values in extra.items():
        last = max(base[iso3]) if base.get(iso3) else -1
        later = {y: v for y, v in values.items() if y > last}
        if later:
            base.setdefault(iso3, {}).update(later)
            used.add(iso3)
    return used


def oecd_notes(key: str, used: set[str], europe: Series, extra: dict[str, tuple[str, str]] | None = None) -> tuple[dict, dict]:
    zh, en = OECD_NOTE[key]
    notes, notes_en = {}, {}
    for iso3 in sorted(used):  # set 的順序每次執行都不同，排序後輸出的檔案才穩定
        add_zh, add_en = (extra or {}).get(iso3, ("", ""))
        if europe.get(iso3):
            since = max(europe[iso3]) + 1
            notes[iso3] = f"{since} 年起改用 {zh}{add_zh}"
            notes_en[iso3] = f"From {since}: {en}{add_en}"
        else:
            notes[iso3] = zh + add_zh
            notes_en[iso3] = en + add_en
    return notes, notes_en


def dwelling_types() -> tuple[dict[str, Series], set[str], Series, Series]:
    """{分類: {iso3: {year: %}}}、用到 OECD 的國家、台灣依樓層的組成 {分類: {year: %}}，以及 Eurostat 原本的公寓比例。"""
    # 先放 Eurostat，再補上 OECD 的國家與年份
    types = {kind: eurostat.series("ilc_lvho01", rskpovth="TOTAL", building=code, deg_urb="TOTAL", unit="PC")
              for kind, code in EU_DWELLING.items()}
    oecd = oecd_ahd.annex(DWELLING_FILE, "HM1.5.A1", set(DWELLING_TYPES))
    extra: dict[str, Series] = {kind: {} for kind in EU_DWELLING}
    for iso3, by_type in oecd.items():
        if iso3 in DWELLING_SKIP or "Flat" not in by_type:
            continue
        for label, values in by_type.items():
            kind = DWELLING_TYPES[label]
            for year, v in values.items():
                if year in by_type["Flat"]:  # 其他分類只收有公寓比例的年份
                    target = extra[kind].setdefault(iso3, {})
                    target[year] = target.get(year, 0) + v  # 「其他」與「未分類」相加
    used = set()
    last_eu = {iso3: dict(s) for iso3, s in types["flat"].items()}
    for kind in EU_DWELLING:
        # 都依公寓比例決定哪些年份用 OECD，各分類才會是同一個來源
        for iso3, values in extra[kind].items():
            last = max(last_eu[iso3]) if iso3 in last_eu else -1
            later = {y: v for y, v in values.items() if y > last}
            if later:
                types[kind].setdefault(iso3, {}).update(later)
                used.add(iso3)

    floors = moi_realestate.dwellings_by_floors()
    taiwan = {kind: {y: sum(c[k] for k in keys) / c["total"] * 100 for y, c in floors.items()}
              for kind, keys in TAIWAN_FLOORS.items()}
    types["flat"]["TWN"] = {y: sum(c[k] for k in TAIWAN_FLAT_FLOORS) / c["total"] * 100 for y, c in floors.items()}
    return types, used, taiwan, last_eu


def _writer():
    out = OUT_DIR / "topics" / "housing"

    def write(key: str, unit: str, series: Series, digits: int, years: list[int] | None = None, **extra: object) -> list[int]:
        within = WITHIN.get(key)
        years = years or latest_year_span(series, within or 0)
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, unit, years,
                {iso3: s for iso3, s in ((c, to_series(v, years, digits)) for c, v in series.items()) if any(x is not None for x in s)},
                **({"latestWithin": within} if within else {}),
                **extra,
            ),
        )
        return years

    return out, write


def build_household_size(write=None) -> None:
    """平均每戶人數：歐洲 2003 年起用 EU-SILC，其他國家與更早的年份用聯合國的資料庫（2026 版）。
    可以單獨跑（run.py 的 housing-household-size）：內政部不動產資訊平台從 cloud 回「Request Rejected」時，
    整個 housing 步驟跑不完，這一項不需要它。"""
    write = write or _writer()[1]
    sizes = eurostat.series("ilc_lvph01", unit="AVG")
    un = un_households.average_household_size()
    notes, notes_en = {}, {}
    for iso3, values in un.items():
        first = min(sizes[iso3]) if iso3 in sizes else None
        if first is None:
            sizes[iso3] = values
            continue
        sizes[iso3].update({y: v for y, v in values.items() if y < first})
        notes[iso3] = f"{first} 年起是 Eurostat 的 EU-SILC，之前是聯合國的家戶規模資料庫"
        notes_en[iso3] = f"From {first}, Eurostat EU-SILC; earlier years from the UN Database on Household Size and Composition"
    sizes["TWN"] = fies.household_size()
    notes["TWN"], notes_en["TWN"] = TAIWAN_NOTES["household-size"]
    write("household-size", "人", sizes, 2, notes=notes, notesEn=notes_en)


def build() -> None:
    out, write = _writer()

    # 住宅類型：地圖畫公寓比例，側欄另讀獨棟、雙併、其他與台灣依樓層的組成
    types, used, taiwan_floors, europe_flat = dwelling_types()
    notes, notes_en = oecd_notes(
        "apartment-share", used, europe_flat, {iso3: SEMI_NOTE for iso3 in DETACHED_INCLUDES_SEMI},
    )
    notes["TWN"], notes_en["TWN"] = TAIWAN_NOTES["apartment-share"]
    years = write("apartment-share", "%", types["flat"], 1, notes=notes, notesEn=notes_en)
    for kind in ("detached", "semi", "other"):
        write(f"dwelling-{kind}", "%", types[kind], 1, years)
    write("dwelling-taiwan", "%", taiwan_floors, 1, years)

    # 自有住宅率
    owners = eurostat.series("ilc_lvho02", rskpovth="TOTAL", hhcomp="TOTAL", tenure="OWN", unit="PC")
    europe = {iso3: dict(s) for iso3, s in owners.items()}
    tenure = oecd_ahd.annex(TENURE_FILE, "HM1.3.A1", TENURES)
    oecd_owners: Series = {}
    for iso3, by_tenure in tenure.items():
        for label in OWNER & set(by_tenure):  # 韓國、土耳其的有房貸與無房貸合在一起
            for year, v in by_tenure[label].items():
                oecd_owners.setdefault(iso3, {})[year] = oecd_owners.get(iso3, {}).get(year, 0) + v
    used = add_after(owners, oecd_owners)
    notes, notes_en = oecd_notes("home-ownership", used, europe)
    owners["TWN"] = fies.home_ownership()
    notes["TWN"], notes_en["TWN"] = TAIWAN_NOTES["home-ownership"]
    write("home-ownership", "%", owners, 2, notes=notes, notesEn=notes_en)

    build_household_size(write)

    # 居住擁擠率、住房負擔過重率：只有 EU-SILC
    write("overcrowding", "%", eurostat.series("ilc_lvho05a", rskpovth="TOTAL", age="TOTAL", sex="T", unit="PC"), 1)
    write("cost-overburden", "%", eurostat.series("ilc_lvho07a", rskpovth="TOTAL", age="TOTAL", sex="T", unit="PC"), 1)

    # 都市貧民窟人口比例：UN-Habitat 每兩年估計一次，只收大多數國家都有的年份（2009、2019 年只有一兩國）
    slums, _world = worldbank.fetch("EN.POP.SLUM.UR.ZS", 1990)
    counts: dict[int, int] = {}
    for s in slums.values():
        for y in s:
            counts[y] = counts.get(y, 0) + 1
    write("slums", "%", slums, 1, sorted(y for y, n in counts.items() if n >= max(counts.values()) * 0.5))

    write_manifest_part(out, "housing", "housing", {
        "source": "Eurostat EU-SILC; OECD Affordable Housing Database; UN DESA Household Size and Composition 2026; "
                  "World Bank WDI (UN-Habitat); 內政部不動產資訊平台; 主計總處家庭收支調查",
    })
