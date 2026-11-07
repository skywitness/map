"""節慶的擴充：這個節日在哪些國家放假、假日跟著哪一本曆走（2026-11-07，製作手冊第二十七批 559，候選 1262、1263；
步驟 holiday-calendars，輸出 topics/festivals/）。

資料：Python 套件 holidays 0.108（MIT，跟「國定假日」主題同一版，離線計算），2026 年、category public、不含補假
（observed=False），國家的範圍跟 topics/holidays.py 一樣（網站的國家清單、全國層級，不算各州）。

**怎麼知道一天是哪個節日**：手冊提醒只比對日期會誤判（台灣 12 月 25 日是行憲紀念日、不是聖誕節），名稱又是各國語言。
這裡改成記錄「是套件裡哪一個方法加進去的」：套件的各國規則用共用的節日方法（holidays/groups/ 的
ChristianHolidays._add_christmas_day、IslamicHolidays._add_eid_al_fitr_day、ChineseCalendarHolidays._add_chinese_new_years_day…）
或 HolidayBase 的 _add_holiday_<月>_<日>、_add_holiday_<第幾>_<星期>_of_<月>、_add_holiday_<n>_days_past_easter。
執行時把這些方法包一層，記下（方法所屬的類別、方法名稱、日期），不改套件的結果。
- 台灣的 12 月 25 日是 _add_holiday_dec_25（行憲紀念日），不會算成聖誕節；東正教的聖誕節（1 月 7 日）也是 _add_christmas_day，算聖誕節。
- 沒有被任何方法記到的（直接用 _add_holiday(名稱, 日期)：日本的春分、秋分，南韓的설날前後一天）：前後 2 天內有農曆、伊斯蘭曆等
  非固定的假日就跟它同一類（설날 전날、다음날）；否則看 2021–2030 年同名假日的日期，九成以上的年份同月同日算固定日期
  （日本的山の日 2021 年因為奧運搬過一次），其他算「其他」（春分、秋分）。
- 十年裡不到 3 年有的名目是一次性的假日（南韓 2026 年的地方選舉日、伊朗臨時的放假），列在側欄，但不算進曆法的統計。
  同一天有兩個假日時套件把名稱用「; 」連起來（亞塞拜然的 Novruz bayramı; Ramazan bayrami），拆開來各算一個名目。

**1262 節日放假的地圖**（FESTIVALS，子項目）：放假（套件的 public 假日裡有那個方法加的日子）、不放假。聯邦制國家只算全國層級
（加拿大、瑞士的全國假日本來就少）；套件 0.108 的孟加拉已經有開齋節（手冊提醒的漏列已經補上），所以不另外標「資料不完整」。
**1263 假日跟著哪一本曆走**：每個假日名目（同名的連續幾天算一個）依方法分類（CALENDARS）；指標是不固定在格里曆同一天的
名目數，與這些名目最多跟哪一本曆（類別圖）。
"""
from __future__ import annotations

import datetime as dt
import functools
import json
import re
from collections import Counter, defaultdict

import holidays
from holidays import groups
from holidays.holiday_base import HolidayBase

from common import OUT_DIR, indicator_file, write_json
from sources.countries import from_alpha2
from topics.holidays import SKIP, SUBSTITUTED

OUT = OUT_DIR / "topics" / "festivals"
YEAR = 2026
DRIFT_YEARS = range(2021, 2031)
ZH_LANG = {"TW": "zh_TW", "HK": "zh_HK", "MO": "zh_MO", "CN": "zh_TW"}

# 子項目：節日 → 認得它的方法（任一個）
FESTIVALS = {
    "new-year": {"InternationalHolidays._add_new_years_day"},
    "christmas": {"ChristianHolidays._add_christmas_day"},
    "labour-day": {"InternationalHolidays._add_labor_day"},
    "good-friday": {"ChristianHolidays._add_good_friday"},
    "easter-monday": {"ChristianHolidays._add_easter_monday"},
    "eid-al-fitr": {"IslamicHolidays._add_eid_al_fitr_day"},
    "eid-al-adha": {"IslamicHolidays._add_eid_al_adha_day"},
    "lunar-new-year": {"ChineseCalendarHolidays._add_chinese_new_years_day"},
    "diwali": {"HinduCalendarHolidays._add_diwali", "HinduCalendarHolidays._add_diwali_india",
               "HinduCalendarHolidays._add_diwali_south_india", "BurmeseCalendarHolidays._add_myanmar_diwali"},
    "buddha": {"BuddhistCalendarHolidays._add_vesak", "BuddhistCalendarHolidays._add_vesak_may",
               "ChineseCalendarHolidays._add_chinese_birthday_of_buddha", "HinduCalendarHolidays._add_buddha_purnima",
               "MongolianCalendarHolidays._add_buddha_day", "SinhalaCalendarHolidays._add_vesak_poya",
               "ThaiCalendarHolidays._add_visakha_bucha"},
}
# 曆法的類別（前端 festivals 的 CALENDAR_CLASSES 一致）：1 復活節、2 伊斯蘭曆、3 農曆、4 印度曆、5 其他陰曆（佛曆、希伯來曆…）、
# 6 某月第幾個星期幾、7 其他（波斯曆、春分秋分等）、0 固定日期
FIXED, EASTER, ISLAMIC, CHINESE, HINDU, LUNAR, WEEKDAY, OTHER, ONE_OFF = 0, 1, 2, 3, 4, 5, 6, 7, 8
NON_FIXED = (ISLAMIC, CHINESE, HINDU, LUNAR, EASTER)
FIXED_SHARE = 0.9
MIN_YEARS = 3
GROUP_CLASS = {
    "IslamicHolidays": ISLAMIC, "ChineseCalendarHolidays": CHINESE, "HinduCalendarHolidays": HINDU,
    "BuddhistCalendarHolidays": LUNAR, "BurmeseCalendarHolidays": LUNAR, "ThaiCalendarHolidays": LUNAR,
    "TibetanCalendarHolidays": LUNAR, "MongolianCalendarHolidays": LUNAR, "SinhalaCalendarHolidays": LUNAR,
    "BalineseSakaCalendarHolidays": LUNAR, "HebrewCalendarHolidays": LUNAR, "MandaeanHolidays": LUNAR,
    "PersianCalendarHolidays": OTHER,
}
EASTER_METHODS = re.compile(r"easter|good_friday|holy_|palm_sunday|ascension|pentecost|whit|corpus_christi|trinity|"
                            r"ash_|carnival|maundy|shrove|rejoicing")
CLASS_NAMES = {FIXED: "固定日期", EASTER: "復活節", ISLAMIC: "伊斯蘭曆", CHINESE: "農曆", HINDU: "印度曆",
               LUNAR: "其他陰曆", WEEKDAY: "某月第幾個星期幾", OTHER: "其他", ONE_OFF: "一次性"}

LOG: list[tuple[str, str, dt.date]] = []


def _record(owner: str, name: str, result) -> None:
    for d in result if isinstance(result, (set, list, tuple)) else [result]:
        if isinstance(d, dt.date):
            LOG.append((owner, name, d))


def _instrument() -> None:
    """把節日群組的 _add_* 與 HolidayBase 動態產生的 _add_holiday_* 包一層，記下加了哪些日子（只做一次）"""
    if getattr(HolidayBase, "_map_instrumented", False):
        return
    for gname in dir(groups):
        g = getattr(groups, gname)
        if not isinstance(g, type):
            continue
        for m in list(vars(g)):
            if m.startswith("_add_") and callable(getattr(g, m)):
                orig = getattr(g, m)

                def inner(self, *a, _orig=orig, _owner=g.__name__, _m=m, **k):
                    r = _orig(self, *a, **k)
                    _record(_owner, _m, r)
                    return r
                setattr(g, m, functools.wraps(orig)(inner))
    orig_getattr = HolidayBase.__getattr__

    def getattr_(self, name):
        f = orig_getattr(self, name)
        if name.startswith("_add_holiday_") and callable(f):
            def inner(*a, **k):
                r = f(*a, **k)
                _record("HolidayBase", name, r)
                return r
            return inner
        return f
    HolidayBase.__getattr__ = getattr_
    HolidayBase._map_instrumented = True


def _classify(methods: set[str]) -> int | None:
    """一天的曆法類別（被哪些方法加的）；沒有線索回傳 None"""
    classes = set()
    for full in methods:
        owner, m = full.split(".", 1)
        if owner in GROUP_CLASS:
            classes.add(GROUP_CLASS[owner])
        elif owner == "ChristianHolidays":
            classes.add(EASTER if EASTER_METHODS.search(m) else FIXED)
        elif owner == "InternationalHolidays":
            classes.add(FIXED)
        elif owner == "HolidayBase":
            if "easter" in m:
                classes.add(EASTER)
            elif re.match(r"_add_holiday_(\d+(st|nd|rd|th)|last)_", m):
                classes.add(WEEKDAY)
            elif re.match(r"_add_holiday_[a-z]{3}_\d+$", m):
                classes.add(FIXED)
    # 同一天被好幾個方法記到時，非固定的優先（例如 EasternCalendarHolidays 之外的具體曆法）
    for c in (ISLAMIC, CHINESE, HINDU, LUNAR, EASTER, WEEKDAY, OTHER, FIXED):
        if c in classes:
            return c
    return None


def _parts(name: str) -> list[str]:
    """同一天兩個假日時套件的名稱是「甲; 乙」"""
    return [p.strip() for p in name.split(";") if p.strip()] or [name]


def _language(code: str, wanted: str) -> str | None:
    langs = holidays.country_holidays(code).supported_languages
    return wanted if wanted in langs else None


def _country(code: str) -> dict | None:
    LOG.clear()
    h = holidays.country_holidays(code, years=YEAR, categories=(holidays.PUBLIC,), observed=False)
    days = dict(h)
    if not days:
        return None
    methods: dict[dt.date, set[str]] = defaultdict(set)
    for owner, m, d in LOG:
        if d in days:
            methods[d].add(f"{owner}.{m}")
    en = _language(code, "en_US")
    names_en = dict(holidays.country_holidays(code, years=YEAR, categories=(holidays.PUBLIC,), observed=False, language=en)) if en else {}
    zh = _language(code, ZH_LANG[code]) if code in ZH_LANG else None
    names_zh = dict(holidays.country_holidays(code, years=YEAR, categories=(holidays.PUBLIC,), observed=False, language=zh)) if zh else {}
    # 調休的「休息日」（中國、越南…）不是節日
    days = {d: n for d, n in days.items() if not names_en.get(d, "").startswith(SUBSTITUTED)}
    # 十年裡同名假日的日期：沒有線索的日子判斷是不是固定日期，也找出一次性的假日
    drift: dict[str, Counter] = defaultdict(Counter)
    for y in DRIFT_YEARS:
        seen = set()
        for d, n in holidays.country_holidays(code, years=y, categories=(holidays.PUBLIC,), observed=False).items():
            for part in _parts(n):
                if (part, y) not in seen:
                    drift[part][(d.month, d.day)] += 1
                    seen.add((part, y))
    known = {d: _classify(methods[d]) for d in days}
    rows = []
    for d, n in sorted(days.items()):
        c = known[d]
        if c is None:
            near = [known[d + dt.timedelta(days=k)] for k in (-2, -1, 1, 2) if known.get(d + dt.timedelta(days=k)) in NON_FIXED]
            if near:
                c = near[0]
            else:
                part = _parts(n)[0]
                total = sum(drift[part].values())
                c = FIXED if total and drift[part].most_common(1)[0][1] / total >= FIXED_SHARE else OTHER
        if all(sum(drift[part].values()) < MIN_YEARS for part in _parts(n)):
            c = ONE_OFF
        fams = [f for f, ms in FESTIVALS.items() if methods[d] & ms]
        rows.append({"date": d, "name": n, "en": names_en.get(d), "zh": names_zh.get(d), "cls": c, "fams": fams})
    return {"rows": rows, "days": len(days)}


def build() -> None:
    _instrument()
    known = set(json.loads((OUT_DIR / "countries.json").read_text(encoding="utf-8")))
    result: dict[str, dict] = {}
    for code in sorted(holidays.list_supported_countries()):
        iso3 = from_alpha2(code)
        if not iso3 or iso3 not in known or iso3 in result or iso3 in SKIP:
            continue
        r = _country(code)
        if r:
            result[iso3] = r

    # 1262：節日放假的地圖（1 放假、2 不放假）
    for fam in FESTIVALS:
        values, hints, hints_en = {}, {}, {}
        for c, r in result.items():
            hit = [x for x in r["rows"] if fam in x["fams"]]
            if hit:
                values[c] = [1]
                local = hit[0]["zh"] or hit[0]["name"]
                hints[c] = f"{YEAR} 年 {hit[0]['date'].month} 月 {hit[0]['date'].day} 日：{local}"
                hints_en[c] = f"{hit[0]['date'].isoformat()}: {hit[0]['en'] or hit[0]['name']}"
            else:
                values[c] = [2]
        write_json(OUT / "holiday" / f"{fam}.json", indicator_file(
            f"holiday-{fam}", "category", [YEAR], values, hints=hints, hintsEn=hints_en, license="MIT"))
        n = Counter(v[0] for v in values.values())
        print(f"  {fam}：放假 {n[1]}、不放假 {n[2]}；台灣 {values.get('TWN')} {hints.get('TWN', '')}；"
              f"{sorted(c for c, v in values.items() if v[0] == 1)[:40] if n[1] < 30 else ''}")

    # 1263：假日名目的曆法
    variable, main, v_hints, v_hints_en = {}, {}, {}, {}
    detail = {}
    for c, r in result.items():
        names: dict[str, int] = {}
        for x in r["rows"]:
            if x["cls"] != ONE_OFF:
                for part in _parts(x["name"]):
                    names.setdefault(part, x["cls"])
        cnt = Counter(names.values())
        nonfixed = {k: v for k, v in cnt.items() if k != FIXED}
        variable[c] = [sum(nonfixed.values())]
        main[c] = [max(nonfixed, key=lambda k: (nonfixed[k], -k)) if nonfixed else FIXED]
        parts = "、".join(f"{CLASS_NAMES[k]} {v}" for k, v in sorted(cnt.items(), key=lambda kv: -kv[1]))
        v_hints[c] = f"{YEAR} 年 {len(names)} 個假日名目：{parts}"
        en_names = {FIXED: "fixed date", EASTER: "Easter", ISLAMIC: "Islamic", CHINESE: "Chinese lunisolar", HINDU: "Hindu",
                    LUNAR: "other lunar", WEEKDAY: "nth weekday", OTHER: "other"}
        v_hints_en[c] = f"{len(names)} public holidays in {YEAR}: " + ", ".join(
            f"{en_names[k]} {v}" for k, v in sorted(cnt.items(), key=lambda kv: -kv[1]))
        detail[c] = [[x["date"].strftime("%m-%d"), x["name"], x["zh"], x["en"], x["cls"], x["fams"]] for x in r["rows"]]
    write_json(OUT / "holiday-variable.json", indicator_file(
        "holiday-variable", "個", [YEAR], variable, hints=v_hints, hintsEn=v_hints_en, license="MIT"))
    write_json(OUT / "holiday-calendar.json", indicator_file(
        "holiday-calendar", "category", [YEAR], main, hints=v_hints, hintsEn=v_hints_en, license="MIT"))
    for c, rows in detail.items():
        write_json(OUT / "holiday-list" / f"{c}.json", rows, quiet=True)

    print(f"  {len(result)} 國")
    top = sorted(((v[0], c) for c, v in variable.items()), reverse=True)
    print(f"  非固定名目最多：{top[:15]}；0 的 {sum(1 for v in variable.values() if v[0] == 0)} 國")
    print(f"  主要曆法：{Counter(CLASS_NAMES[v[0]] for v in main.values()).most_common()}")
    for k in (CHINESE, HINDU, LUNAR, OTHER, WEEKDAY):
        print(f"    {CLASS_NAMES[k]}：{sorted(c for c, v in main.items() if v[0] == k)}")
    one_off = [(c, x['name']) for c, r in result.items() for x in r['rows'] if x['cls'] == ONE_OFF]
    print(f"  一次性 {len(one_off)}：{one_off[:20]}")
    for c in ("TWN", "JPN", "KOR", "CHN", "USA", "DEU", "IND", "NPL", "LKA", "IRN", "ISR", "IDN", "MYS", "SGP", "VNM", "SAU", "BRA", "BGD"):
        print(f"    {c}：{variable.get(c)} {CLASS_NAMES.get(main.get(c, [None])[0], '-')}；{v_hints.get(c)}")
