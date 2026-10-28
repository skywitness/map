"""血型分布主題：英文維基百科「Blood type distribution by country」第一個表的各國 ABO 與 Rh 血型比例。

- 最多的血型（main，類別圖）：O、A、B、AB 四型（Rh 陽性加陰性）裡比例最高的一型，代碼 1–4。
- O、A、B、AB 型的比例（o、a、b、ab）：那一型的 Rh 陽性加陰性。
- Rh 陰性的比例（rh-neg）：O−、A−、B−、AB− 的合計。
- 側欄的 8 種血型與出處：types.json（點國家時讀）。
- 不分年份（各國的資料年份不同），單一快照（前端 timeless）。
- 沒有出處的國家（包括台灣）照常畫，tooltip 與側欄標「維基百科沒有註明出處」（使用者 2026-10-28 決定）。
- 表裡少數格子不是數字：埃及只有 ABO（Rh 四格是 n/a，O+ 那四格其實是 ABO 的合計）、阿曼的 AB− 是 n/a、紐西蘭的 AB− 寫
  「<1.0%」；這些格子當成沒有值，那一型與 Rh 陰性的合計只加有值的（附註寫明）。

授權：維基百科的內容是 CC BY-SA 4.0，所以這個主題的資料檔也依 CC BY-SA 4.0 分享（public/data/topics/blood-types/LICENSE.txt）。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, write_json
from sources import countries, wiki_blood_types as wiki

OUT = OUT_DIR / "topics" / "blood-types"
YEAR = 2026  # 單一快照（前端 timeless）

# 表裡 pycountry 查不到的國名
NAMES = {"DRC": "COD", "Bosnia": "BIH", "Ivory Coast": "CIV", "Macao": "MAC", "Hong Kong": "HKG", "Taiwan": "TWN"}
ABO = ["O", "A", "B", "AB"]
TYPE_ZH = {"O": "O 型", "A": "A 型", "B": "B 型", "AB": "AB 型"}

# 埃及：Rh 那四格是 n/a，O+、A+、B+、AB+ 那四格加起來 99.99%，是 ABO 的合計
ABO_ONLY = {"EGY"}


def r2(v: float) -> float:
    return round(v + 0.0, 2)


def build() -> None:
    rows = wiki.table()
    by_iso: dict[str, wiki.Row] = {}
    for row in rows:
        iso3 = NAMES.get(row.name) or countries.from_name(row.name)
        if not iso3:
            raise RuntimeError(f"維基的血型表有查不到 ISO 代碼的國名：{row.name}")
        if iso3 in by_iso:
            raise RuntimeError(f"維基的血型表有兩列都是 {iso3}：{by_iso[iso3].name}、{row.name}")
        by_iso[iso3] = row
    sourced = sum(wiki.has_source(r) for r in rows)
    print(f"  維基百科（revid {wiki.REVISION}）：{len(rows)} 國，{sourced} 國附了出處")
    if len(rows) < 120:
        raise RuntimeError(f"維基的血型表只讀到 {len(rows)} 國，表格的格式可能變了")
    tw = by_iso.get("TWN")
    if not tw or tw.values[:4] != [43.9, 25.9, 23.9, 6.0]:
        raise RuntimeError(f"台灣那一列跟 2026-10 查的不同：{tw and tw.values}")

    shares: dict[str, dict[str, float]] = {t: {} for t in ABO}
    rh_neg: dict[str, float] = {}
    main: dict[str, int] = {}
    units: dict[str, dict] = {}
    notes: dict[str, str] = {}
    notes_en: dict[str, str] = {}
    hints: dict[str, str] = {}
    hints_en: dict[str, str] = {}
    for iso3, row in sorted(by_iso.items()):
        v = row.values
        if iso3 in ABO_ONLY:
            if any(x is not None for x in v[4:]):
                raise RuntimeError(f"{row.name} 的 Rh 陰性有數字了，ABO_ONLY 要拿掉")
            abo = [x for x in v[:4]]
            eight: list[float | None] = [None] * 8
            notes[iso3] = "維基百科的表只有 ABO 血型，沒有分 Rh 陽性與陰性（表上寫在 Rh 陽性那四欄的是 ABO 的合計）。"
            notes_en[iso3] = "Wikipedia’s table gives only ABO groups for this country, without the Rh split (the figures in the Rh-positive columns are ABO totals)."
        else:
            eight = v
            abo = [None if v[i] is None and v[i + 4] is None else (v[i] or 0) + (v[i + 4] or 0) for i in range(4)]
            rh_neg[iso3] = r2(sum(x for x in v[4:] if x is not None))
            missing = [(wiki.TYPES[i], row.raw[i]) for i in range(8) if v[i] is None]
            if missing:
                zh = "、".join(f"{t.replace('-', '−')}（表上寫「{raw}」）" for t, raw in missing)
                en = ", ".join(f"{t.replace('-', '−')} (given as “{raw}”)" for t, raw in missing)
                notes[iso3] = f"{zh}沒有數字，那一型與 Rh 陰性的合計只加有數字的血型。"
                notes_en[iso3] = f"{en} has no figure; that group and the Rh-negative total add up only the types with figures."
        for t, x in zip(ABO, abo):
            if x is not None:
                shares[t][iso3] = r2(x)
        valid = [(x, i) for i, x in enumerate(abo) if x is not None]
        top = max(valid)
        if sum(1 for x, _ in valid if x == top[0]) > 1:
            raise RuntimeError(f"{row.name} 有兩型一樣多，最多的血型要另外決定")
        main[iso3] = top[1] + 1
        if main[iso3] == 4:
            raise RuntimeError(f"{row.name} 最多的是 AB 型，前端 blood-types.ts 的 MAIN 要加上 AB 型")
        summary_zh = "、".join(f"{t} {shares[t][iso3]:g}%" for t in ABO if iso3 in shares[t])
        summary_en = ", ".join(f"{t} {shares[t][iso3]:g}%" for t in ABO if iso3 in shares[t])
        if wiki.has_source(row):
            hints[iso3], hints_en[iso3] = summary_zh, summary_en
        else:
            hints[iso3] = f"{summary_zh}・維基百科沒有註明出處"
            hints_en[iso3] = f"{summary_en} · no source cited on Wikipedia"
        unit: dict[str, object] = {"v": [None if x is None else r2(x) for x in eight]}
        total = sum(x for x in (eight if iso3 not in ABO_ONLY else abo) if x is not None)
        unit["sum"] = r2(total)
        if wiki.has_source(row):
            unit["ref"] = [row.ref_title or "", row.ref_url or ""]
        if row.failed_verification:
            unit["fv"] = 1
        units[iso3] = unit

    def ind(name: str, unit: str, values: dict[str, float], **extra) -> None:
        write_json(OUT / f"{name}.json", indicator_file(name, unit, [YEAR], {u: [x] for u, x in sorted(values.items())}, **extra))

    common_extra = {"notes": notes, "notesEn": notes_en}
    ind("main", "", main, hints=hints, hintsEn=hints_en, **common_extra)
    for t in ABO:
        ind(t.lower(), "%", shares[t], hints=hints, hintsEn=hints_en, **common_extra)
    ind("rh-neg", "%", rh_neg, hints=hints, hintsEn=hints_en, **common_extra)
    write_json(OUT / "types.json", {"revision": wiki.REVISION, "page": wiki.PAGE_URL, "types": wiki.TYPES, "units": units})
    write_json(OUT / "manifest.json", {
        "topic": "blood-types",
        "generatedAt": now_iso(),
        "source": f"Wikipedia, {wiki.PAGE} (revision {wiki.REVISION}, {wiki.PAGE_URL})",
        "license": "CC BY-SA 4.0",
    })
    counts = {t: sum(1 for c in main.values() if c == i + 1) for i, t in enumerate(ABO)}
    print(f"  最多的血型：{counts}；台灣 {[shares[t]['TWN'] for t in ABO]}，Rh 陰性 {rh_neg['TWN']}%")

    (OUT / "LICENSE.txt").write_text(
        "血型分布的資料檔 / Blood type data files\n"
        "\n"
        f"這個資料夾的 JSON 是從英文維基百科「{wiki.PAGE}」（版本 {wiki.REVISION}，{wiki.PAGE_URL} ）\n"
        "第一個表整理出來的，依原條目的授權 CC BY-SA 4.0（https://creativecommons.org/licenses/by-sa/4.0/ ）分享。\n"
        "The JSON files in this folder are derived from the first table of the English Wikipedia article\n"
        f"“{wiki.PAGE}” (revision {wiki.REVISION}, {wiki.PAGE_URL} ) and are shared under the same licence,\n"
        "CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).\n"
        "\n"
        "各國的數字出處見 types.json 的 ref（維基百科該列引用的資料）；沒有 ref 的國家，維基百科沒有註明出處。\n"
        "Per-country sources are in the ref field of types.json (the reference cited on that row of the article);\n"
        "countries without a ref have no source cited on Wikipedia.\n",
        encoding="utf-8",
    )
