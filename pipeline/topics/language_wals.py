"""語言加四個特徵：語序、聲調、格與冠詞（WALS），以及大人會幾種外語（Eurostat）（2026-11-07，製作手冊第二十七批 552，
候選 1254–1257；擴充「語言」；步驟 language-wals，輸出 topics/language/）。

- WALS Online（Dryer & Haspelmath 編，CC BY 4.0）的 CLDF 版（raw.githubusercontent.com/cldf-datasets/wals，
  github.com 的網頁 403、raw 可以）：81A 主詞、受詞、動詞的語序，13A 聲調，49A 名詞的格，37A 定冠詞。
- 國家的值用「主要官方語言」：跟語言主題的 main.json 同一個算法（CLDR 的官方或事實上的官方語言裡會說的人最多的，
  沒有官方語言時取會說的人最多的）。不能把國內所有 WALS 語言聚合，不然美國會變 SOV、德國變「沒有主導語序」。
- 語言對到 WALS：WALS 的 ID 是它自己的，ISO 碼不可靠（手冊：cmn 會對到昆明話、deu 會對到柏林德語），所以
  CLDR 代碼 → ISO 639-3（巨集語言換成 CLDR 指定的代表語言：zh→cmn、ar→arb、ms→zsm）→ Glottolog 的 glottocode →
  WALS 同一個 glottocode 的語言；同一個 glottocode 有好幾筆時取這四個特徵有值最多的。glottocode 對不到的再用 ISO 碼。
  WALS 沒有那個特徵的值就留白（標準阿拉伯語沒有聲調與格的資料，不拿埃及阿拉伯語補）。
- 49A 有 9 類，類別色最多 8 種：2 格與 3 格、4 格與 5 格各合成一類。
- 側欄：WALS 的 Country_ID 列在這一國的語言與四個特徵（台灣 11 種）。
- Eurostat 成人教育調查（AES，edat_aes_l21）25–64 歲會幾種外語（0、1、2、3 種以上，自我回報），2007、2011、2016、2022；
  英國與科索沃照 Eurostat 的再利用規定不收（sources/eurostat.py）。
"""
from __future__ import annotations

import csv
from collections import Counter, defaultdict

from common import download, indicator_file, write_json
from sources import cldr, eurostat, glottolog
from sources.countries import from_alpha2
from topics.language import OUT, YEAR

BASE = "https://raw.githubusercontent.com/cldf-datasets/wals/master/cldf/"
FEATURES = {"81A": "order", "13A": "tone", "49A": "case", "37A": "articles"}
# 49A 合併：2、3 格 → 2；4、5 格 → 3；6–7 → 4；8–9 → 5；10 以上 → 6；只有邊緣格 → 7；沒有形態格 → 1
CASE_MERGE = {1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 4, 7: 5, 8: 6, 9: 7}
OFFICIAL = {"official", "de_facto_official"}
AES_ITEMS = {"0": "0", "1": "1", "2": "2", "GE3": "3"}
# glottocode 與 ISO 碼都對不到的（WALS 的阿爾巴尼亞語、亞塞拜然語沒有 glottocode；挪威語、塞爾維亞-克羅埃西亞語、
# 拉脫維亞語在 WALS 是比 CLDR 寬的語言），照名稱指定 WALS 的 ID。宗喀語（不丹）WALS 沒有收
MANUAL = {"sq": "alb", "az": "aze", "nb": "nor", "nn": "nor", "sr": "scr", "hr": "scr", "bs": "scr", "lv": "lat"}


def _csv(name: str) -> list[dict]:
    with open(download(BASE + name, "wals", name), encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main_languages() -> dict[str, str]:
    """ISO3 → 主要官方語言的 CLDR 基本代碼（跟 topics/language.py 的 main.json 同一個算法）"""
    out = {}
    for iso3, t in cldr.territories().items():
        merged: dict[str, tuple[float, str | None]] = {}
        for code, pct, status in t["languages"]:
            base = code.split("_")[0]
            old = merged.get(base)
            if not old or pct > old[0]:
                merged[base] = (pct, status if status else (old[1] if old else None))
            elif status in OFFICIAL:
                merged[base] = (old[0], status)
        if not merged:
            continue
        official = {k: v for k, v in merged.items() if v[1] in OFFICIAL} or merged
        out[iso3] = max(official, key=lambda k: official[k][0])
    out["TWN"] = "zh"  # 語言主題的台灣用普查，主要語言是華語
    return out


def build() -> None:
    langs = [r for r in _csv("languages.csv")]
    values: dict[str, dict[str, int]] = defaultdict(dict)
    for v in _csv("values.csv"):
        if v["Parameter_ID"] in FEATURES:
            values[v["Language_ID"]][FEATURES[v["Parameter_ID"]]] = int(v["Value"])
    by_glotto: dict[str, list[dict]] = defaultdict(list)
    by_iso: dict[str, list[dict]] = defaultdict(list)
    for r in langs:
        if r["Glottocode"]:
            by_glotto[r["Glottocode"]].append(r)
        if r["ISO639P3code"]:
            by_iso[r["ISO639P3code"]].append(r)
    to3 = cldr.iso639_3()
    glotto_of_iso = {g["iso"]: g["glottocode"] for g in glottolog.languages() if g["iso"]}

    by_id = {r["ID"]: r for r in langs}

    def wals_for(cldr_code: str) -> dict | None:
        if cldr_code in MANUAL:
            return by_id[MANUAL[cldr_code]]
        iso = to3.get(cldr_code, cldr_code if len(cldr_code) == 3 else None)
        cands = by_glotto.get(glotto_of_iso.get(iso, ""), []) or by_iso.get(iso or "", [])
        return max(cands, key=lambda r: (len(values.get(r["ID"], {})), r["ID"]), default=None)

    mains = main_languages()
    names = cldr.names()
    out = {f: {} for f in FEATURES.values()}
    hints, hints_en = {}, {}
    unmatched = Counter()
    for iso3, code in sorted(mains.items()):
        w = wals_for(code)
        if not w:
            unmatched[code] += 1
            continue
        v = values.get(w["ID"], {})
        for f in FEATURES.values():
            if f in v:
                out[f][iso3] = [CASE_MERGE[v[f]] if f == "case" else v[f]]
        zh, en = names.get(code, (None, w["Name"]))
        hints[iso3] = f"主要官方語言：{zh or en}（WALS：{w['Name']}）"
        hints_en[iso3] = f"Main official language: {en} (WALS: {w['Name']})"
    for f in FEATURES.values():
        write_json(OUT / "wals" / f"{f}.json", indicator_file(f"wals/{f}", "category", [YEAR], out[f],
                                                             hints=hints, hintsEn=hints_en, license="CC BY 4.0"), quiet=True)

    # 側欄：每國在 WALS 裡的語言
    panel: dict[str, list] = defaultdict(list)
    for r in langs:
        v = values.get(r["ID"])
        if not v:
            continue
        for a2 in r["Country_ID"].split():
            iso3 = from_alpha2(a2)
            if iso3:
                panel[iso3].append([r["Name"], v.get("order", 0), v.get("tone", 0),
                                    CASE_MERGE[v["case"]] if "case" in v else 0, v.get("articles", 0)])
    for rows in panel.values():
        rows.sort(key=lambda x: (-sum(1 for y in x[1:] if y), x[0]))
    write_json(OUT / "wals-languages.json", {"countries": dict(sorted(panel.items()))})

    # Eurostat：25–64 歲會幾種外語
    for n_lang, item in AES_ITEMS.items():
        s = eurostat.series("edat_aes_l21", freq="A", age="Y25-64", n_lang=n_lang, unit="PC", sex="T")
        years = sorted({y for d in s.values() for y in d})
        write_json(OUT / "adult-languages" / f"{item}.json", indicator_file(
            "adult-languages", "%", years, {c: [d.get(y) for y in years] for c, d in sorted(s.items())}, license="CC BY 4.0"), quiet=True)
        if item in ("0", "3"):
            last = {c: d[max(d)] for c, d in s.items() if 2022 in d}
            print(f"  外語 {item} 種（2022，{len(last)} 國）：" + "、".join(f"{c} {v}" for c, v in sorted(last.items(), key=lambda kv: kv[1])[:6])
                  + " … " + "、".join(f"{c} {v}" for c, v in sorted(last.items(), key=lambda kv: kv[1])[-6:]))

    print(f"  主要官方語言 {len(mains)} 國；對不到 WALS 的：{dict(unmatched)}")
    for f in FEATURES.values():
        print(f"  {f}：{len(out[f])} 國，{dict(sorted(Counter(v[0] for v in out[f].values()).items()))}")
    for c in ("TWN", "CHN", "JPN", "KOR", "USA", "DEU", "FRA", "SAU", "IDN", "PHL", "FIN", "HUN", "IND", "BRA", "VNM", "THA"):
        print(f"  {c} {mains.get(c)}：{hints.get(c)}；" + "、".join(f"{f} {out[f].get(c)}" for f in FEATURES.values()))
    print("  VOS／OVS：" + str({c: (mains[c], hints.get(c)) for c, v in out["order"].items() if v[0] in (4, 5)}))
    print(f"  台灣的 WALS 語言：{[r[0] for r in panel.get('TWN', [])]}")
