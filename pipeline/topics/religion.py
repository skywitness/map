"""宗教主題：各國的主要宗教、最大宗教的比例、無宗教信仰比例、宗教多樣性。

- 來源：Pew Research Center, Religious Composition 2010–2020（2010、2020 兩年），含台灣。
- Pew 的條款只允許發布摘錄（見 sources/pew.py），所以不輸出七大類各自的比例，只輸出：
  主要宗教（類別圖）、主要宗教的比例、無宗教信仰比例、Pew 的宗教多樣性指數。
- 台灣的附註用內政部宗教統計（登記的寺廟、教會數）當背景。

類別代碼（跟 src/topics/religion.ts 一致）：1 基督徒、2 穆斯林、3 無宗教信仰、4 印度教徒、5 佛教徒、6 猶太教徒、7 其他宗教。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import moi_religion, pew

CODES = {
    "Christians": 1, "Muslims": 2, "Religiously_unaffiliated": 3, "Hindus": 4,
    "Buddhists": 5, "Jews": 6, "Other_religions": 7,
}
TAIWAN = "TWN"


def build() -> None:
    out = OUT_DIR / "topics" / "religion"
    comp = pew.composition()
    rdi = pew.diversity()
    years = sorted({y for s in comp.values() for y in s})
    world = comp.pop("WLD")

    main: dict[str, dict[int, float]] = {}
    main_share: dict[str, dict[int, float]] = {}
    unaffiliated: dict[str, dict[int, float]] = {}
    for iso3, by_year in comp.items():
        for year, shares in by_year.items():
            group = max(shares, key=lambda g: shares[g])
            main.setdefault(iso3, {})[year] = CODES[group]
            main_share.setdefault(iso3, {})[year] = shares[group]
            unaffiliated.setdefault(iso3, {})[year] = shares["Religiously_unaffiliated"]

    notes, notes_en = _taiwan_notes(years[-1], comp[TAIWAN][years[-1]])
    files = {
        "main": ("", main, None, None),
        "main-share": ("%", main_share, None, 1),
        "unaffiliated": ("%", unaffiliated, {y: world[y]["Religiously_unaffiliated"] for y in years}, 1),
        "diversity": ("", {c: s for c, s in rdi.items() if c != "WLD"}, rdi.get("WLD"), 2),
    }
    for key, (unit, series, world_series, digits) in files.items():
        extra: dict[str, object] = {"notes": notes, "notesEn": notes_en}
        if world_series:
            extra["aggregates"] = {"WLD": to_series(world_series, years, digits)}
        write_json(out / f"{key}.json", indicator_file(
            key, unit, years, {c: to_series(s, years, digits) for c, s in series.items()}, **extra,
        ))
    write_json(out / "manifest.json", {
        "topic": "religion", "generatedAt": now_iso(),
        "source": "Pew Research Center, Religious Composition 2010-2020 (excerpts); 內政部宗教統計",
    })
    counts = {}
    for s in main.values():
        counts[s[years[-1]]] = counts.get(s[years[-1]], 0) + 1
    print(f"  {len(main)} 國；{years[-1]} 年主要宗教的國家數：{dict(sorted(counts.items()))}")


def _taiwan_notes(pew_year: int, tw: dict[str, float]) -> tuple[dict[str, str], dict[str, str]]:
    pct = {g: round(v) for g, v in tw.items()}
    places = moi_religion.places_of_worship()
    year = max(places["temples"])
    temples, churches = places["temples"][year], places["churches"].get(year, {})
    zh = (
        f"Pew 把台灣的民間信仰與道教歸在「其他宗教」（{pew_year} 年約 {pct['Other_religions']}%），佛教徒約 {pct['Buddhists']}%、"
        f"無宗教信仰約 {pct['Religiously_unaffiliated']}%、基督徒約 {pct['Christians']}%。"
        "很多人同時拜佛、拜神、祭祖，用單一宗教分類只是近似。"
        f"內政部宗教統計：{year} 年底登記的寺廟 {temples['宗教別總計']:,} 座（道教 {temples['道教']:,}、佛教 {temples['佛教']:,}、"
        f"一貫道 {temples.get('一貫道', 0):,}），教會（堂）{churches.get('宗教別總計', 0):,} 座（基督教 {churches.get('基督教', 0):,}、"
        f"天主教 {churches.get('天主教', 0):,}）；民間信仰多半沒有登記入教，內政部沒有各宗教的信徒比例。"
    )
    en = (
        f"Pew counts Taiwan's folk religion and Taoism as \"other religions\" (about {pct['Other_religions']}% in {pew_year}); "
        f"about {pct['Buddhists']}% are Buddhist, {pct['Religiously_unaffiliated']}% unaffiliated and {pct['Christians']}% Christian. Many people worship at Buddhist and folk temples and venerate ancestors at the "
        "same time, so a single religion is only an approximation. Ministry of the Interior religious statistics: at the end "
        f"of {year} there were {temples['宗教別總計']:,} registered temples (Taoist {temples['道教']:,}, Buddhist "
        f"{temples['佛教']:,}, Yiguandao {temples.get('一貫道', 0):,}) and {churches.get('宗教別總計', 0):,} churches "
        f"(Protestant {churches.get('基督教', 0):,}, Catholic {churches.get('天主教', 0):,}); most folk-religion believers "
        "are not registered, so the ministry has no figures on the share of believers."
    )
    return {TAIWAN: zh}, {TAIWAN: en}
