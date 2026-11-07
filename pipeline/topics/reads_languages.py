"""各國在讀什麼的擴充：讀哪一種語言的維基百科、誰在寫維基百科、寫哪一種語言（2026-11-07，製作手冊第二十七批 558，
候選 1258、1259、1260；步驟 reads-languages，輸出 topics/reads/）。

1. 讀（1260）：reads.py 已經彙整的每月快取（.cache/wikimedia/months/<月>.json 的 totals：每國每個 *.wikipedia 的瀏覽次數），
   不另外下載。每國每月讀最多的語言版本（類別圖，8 類）與前三名的比例。只用快取裡已有的月份（reads 步驟決定下載哪些），
   跟「讀英文維基百科的比例」同一份數字。
2. 寫（1258、1259）：Wikimedia 的 geoeditors 月檔（https://analytics.wikimedia.org/published/datasets/geoeditors_monthly/
   <月>.tsv，CC0，2023-07 起；robots.txt 只禁 /datasets/，這個路徑不在裡面）：每個計畫、國家、活躍度（1–4、5–99、100 次以上）
   的編輯者數與編輯次數，做了差分隱私加噪（第 6–8 欄是參數），太小的格子不公布。
   - 2023-06 以前（dumps.wikimedia.org/other/geoeditors/，2018-01 起）是以十為一級的區間（上下限），沒有 1–4 次，
     跟之後的計數接不起來，不用（手冊建議的 2018 年起的折線因此改成 2023-07 起）。
   - 每百萬人幾位活躍編輯者：所有 *.wikipedia 計畫「5 次以上」（5–99 加 100 以上）的編輯者相加 ÷ 人口（WPP 2024）。
     同一個人編好幾種語言版本會重複算；國家看 IP，VPN 會歸錯國。
   - 編英文維基的比例、編最多的語言版本：用各活躍度（含 1–4 次）的編輯者，*.wikipedia 才算（commons、wikidata 等
     跨語言計畫不算語言版本）。
3. 側欄（langs/<ISO3>.json）：每月讀的前 5 種語言版本的比例、編輯者最多的前 8 個計畫（含 commons、wikidata）。
"""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict

from common import CACHE_DIR, OUT_DIR, USER_AGENT, indicator_file, write_json
from sources import wpp
from topics.reads import alpha3, month_index

OUT = OUT_DIR / "topics" / "reads"
MONTHS_DIR = CACHE_DIR / "wikimedia" / "months"
GEO_URL = "https://analytics.wikimedia.org/published/datasets/geoeditors_monthly/"
GEO_CACHE = CACHE_DIR / "wikimedia" / "geoeditors"
FIRST_GEO = (2023, 7)
# 加噪、小格子不公布：人口不到 100 萬的不算每百萬人（梵蒂岡、馬紹爾群島會是幾百到上萬），
# 各語言版本的編輯者合計不到 50 人的不算比例與類別（只剩一兩格，0% 或 100%）
MIN_POP_K = 1000
MIN_WIKI_EDITORS = 50
# 讀最多的語言版本的類別（其他的歸 8）
LANG_CLASSES = {"en": 1, "fr": 2, "es": 3, "ru": 4, "ar": 5, "de": 6, "pt": 7}
OTHER = 8
LANG_ZH = {
    "en": "英文", "fr": "法文", "es": "西班牙文", "ru": "俄文", "ar": "阿拉伯文", "de": "德文", "pt": "葡萄牙文", "zh": "中文",
    "ja": "日文", "ko": "韓文", "it": "義大利文", "pl": "波蘭文", "uk": "烏克蘭文", "id": "印尼文", "th": "泰文", "he": "希伯來文",
    "nl": "荷蘭文", "tr": "土耳其文", "fa": "波斯文", "vi": "越南文", "hi": "印地文", "ms": "馬來文", "sv": "瑞典文",
}


def _lang(project: str) -> str:
    return project.split(".")[0]


def _fetch_geo(name: str) -> str | None:
    path = GEO_CACHE / name
    if path.exists():
        return path.read_text(encoding="utf-8")
    req = urllib.request.Request(GEO_URL + name, headers={"User-Agent": USER_AGENT})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                text = r.read().decode("utf-8")
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
            time.sleep(1)
            return text
        except urllib.error.HTTPError as err:
            if err.code == 404:
                return None
            time.sleep(2 ** (attempt + 1))
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            time.sleep(2 ** (attempt + 1))
    raise RuntimeError(f"geoeditors {name} 下載失敗")


def _geo_months() -> list[tuple[int, int]]:
    req = urllib.request.Request(GEO_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as r:
        listing = r.read().decode("utf-8")
    found = sorted({(int(y), int(m)) for y, m in re.findall(r'href="(\d{4})-(\d{2})\.tsv"', listing)})
    return [ym for ym in found if ym >= FIRST_GEO]


def build() -> None:
    # ── 讀：每月快取的 totals ──
    read_months = sorted(p.stem for p in MONTHS_DIR.glob("*.json"))
    read_years = [month_index(int(s[:4]), int(s[5:7])) for s in read_months]
    read_main: dict[str, list] = defaultdict(lambda: [None] * len(read_years))
    read_top: dict[str, dict[str, list]] = defaultdict(dict)
    for i, s in enumerate(read_months):
        totals = json.loads((MONTHS_DIR / f"{s}.json").read_text(encoding="utf-8"))["totals"]
        for cc, by_project in totals.items():
            iso3 = alpha3(cc)
            total = sum(by_project.values())
            if not iso3 or not total:
                continue
            langs = Counter()
            for project, v in by_project.items():
                langs[_lang(project)] += v
            top = langs.most_common(5)
            read_main[iso3][i] = LANG_CLASSES.get(top[0][0], OTHER)
            read_top[iso3][str(read_years[i])] = [[lang, round(v / total * 100, 1)] for lang, v in top]

    # ── 寫：geoeditors ──
    geo_months = _geo_months()
    geo_years = [month_index(y, m) for y, m in geo_months]
    pop = wpp.demographic(["TPopulation1July"], last_year=max(y for y, _ in geo_months))["TPopulation1July"]
    editors: dict[str, list] = defaultdict(lambda: [None] * len(geo_years))
    english: dict[str, list] = defaultdict(lambda: [None] * len(geo_years))
    edit_main: dict[str, list] = defaultdict(lambda: [None] * len(geo_years))
    edit_top: dict[str, dict[str, list]] = defaultdict(dict)
    active_last: dict[str, int] = {}
    for i, (y, m) in enumerate(geo_months):
        text = _fetch_geo(f"{y}-{m:02d}.tsv")
        if text is None:
            continue
        active, wiki_all, projects = Counter(), defaultdict(Counter), defaultdict(Counter)
        for line in text.splitlines():
            parts = line.split("\t")
            if len(parts) < 11:
                continue
            _db, project, _country, cc, level, _e, _d, _s, n, _edits, _month = parts[:11]
            iso3 = alpha3(cc)
            if not iso3:
                continue
            n = int(n)
            projects[iso3][project] += n
            if project.endswith(".wikipedia"):
                wiki_all[iso3][_lang(project)] += n
                if level != "1 to 4":
                    active[iso3] += n
        if i == len(geo_months) - 1:
            active_last = {c: n for c, n in active.items() if n}
        for iso3 in projects:
            p = pop.get(iso3, {}).get(y)
            if p and p >= MIN_POP_K and active[iso3]:
                editors[iso3][i] = round(active[iso3] / p * 1000, 2)  # 人口是千人
            total = sum(wiki_all[iso3].values())
            if total >= MIN_WIKI_EDITORS:
                english[iso3][i] = round(wiki_all[iso3].get("en", 0) / total * 100, 1)
                edit_main[iso3][i] = LANG_CLASSES.get(wiki_all[iso3].most_common(1)[0][0], OTHER)
            edit_top[iso3][str(geo_years[i])] = [[pr, n] for pr, n in projects[iso3].most_common(8)]

    def hints_for(top: dict[str, dict[str, list]], fmt) -> tuple[dict, dict]:
        zh, en = {}, {}
        for c, by in top.items():
            last = max(by, key=int)
            zh[c], en[c] = fmt(by[last])
        return zh, en

    read_zh, read_en = hints_for(read_top, lambda rows: (
        "、".join(f"{LANG_ZH.get(lang, lang)} {s:.0f}%" for lang, s in rows[:3]),
        ", ".join(f"{lang} {s:.0f}%" for lang, s in rows[:3])))
    write_json(OUT / "read-language.json", indicator_file(
        "read-language", "category", read_years, dict(read_main), hints=read_zh, hintsEn=read_en, license="CC0"))
    ed_zh, ed_en = {}, {}
    for c, s in active_last.items():
        ed_zh[c] = f"{geo_months[-1][0]} 年 {geo_months[-1][1]} 月編輯 5 次以上的約 {s:,} 人（各語言版本相加）"
        ed_en[c] = f"About {s:,} editors with 5+ edits in {geo_months[-1][0]}-{geo_months[-1][1]:02d} (language editions added up)"
    write_json(OUT / "editors.json", indicator_file("editors", "人／百萬人", geo_years, dict(editors), hints=ed_zh, hintsEn=ed_en,
                                                    license="CC0"))
    write_json(OUT / "editors-english.json", indicator_file("editors-english", "%", geo_years, dict(english), license="CC0"))
    write_json(OUT / "edit-language.json", indicator_file("edit-language", "category", geo_years, dict(edit_main), license="CC0"))
    for c in set(read_top) | set(edit_top):
        write_json(OUT / "langs" / f"{c}.json", {"read": read_top.get(c, {}), "edit": edit_top.get(c, {})}, quiet=True)

    last_r, last_g = len(read_years) - 1, len(geo_years) - 1
    print(f"  讀：{read_months[0]}–{read_months[-1]}，{len(read_main)} 國；最新一月 "
          f"{Counter(v[last_r] for v in read_main.values() if v[last_r]).most_common()}")
    print(f"  寫：{geo_months[0]}–{geo_months[-1]}（缺 {[ym for ym in geo_months if not (GEO_CACHE / f'{ym[0]}-{ym[1]:02d}.tsv').exists()]}），"
          f"{len(editors)} 國有每百萬人；最新一月編最多的語言 {Counter(v[last_g] for v in edit_main.values() if v[last_g]).most_common()}")
    top = sorted(((v[last_g], c) for c, v in editors.items() if v[last_g] is not None), reverse=True)
    print(f"    每百萬人 {len(top)} 國：{top[:12]} … {top[-5:]}")
    for c in ("TWN", "JPN", "KOR", "USA", "GBR", "DEU", "FRA", "HKG", "SGP", "IND", "CHN", "UKR", "RUS"):
        print(f"    {c}：每百萬人 {editors.get(c, [None] * len(geo_years))[last_g]}、編英文 {english.get(c, [None] * len(geo_years))[last_g]}%、"
              f"讀 {read_top.get(c, {}).get(str(read_years[last_r]))}；編 {edit_top.get(c, {}).get(str(geo_years[last_g]), [])[:6]}")
    en = sorted(((v[last_g], c) for c, v in english.items() if v[last_g] is not None), reverse=True)
    print(f"    編英文 {len(en)} 國：{en[:8]} … {en[-8:]}")
