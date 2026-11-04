"""國定假日：一年有幾天、假日最多的月份（2026-11-04，製作手冊第二十一批 344，合併 888）。

- 資料：Python 套件 holidays 0.108（Open World Holidays Framework，MIT 授權；假日規則寫在程式碼裡，離線計算），
  只取 category 是 public 的（不算 government、optional、school、half_day…），2017–2027 年。
  套件的國家代碼是 ISO alpha-2（也有屬地，例如 AS 美屬薩摩亞），對不到網站國家清單的不收。
- 一年幾天：同一天有兩個假日算一天；落在週末的也算（法定的假日天數，不是多放幾天）。
  - 含補假：套件列出的全部（補假、中國的調休「休息日」都算）。
  - 不含補假：`observed=False`（拿掉補假），再拿掉英文名稱是「Day off (substituted from …)」的調休日（中國、越南…；
    套件有英文名稱的 429 個地區才判斷得出來，其他的只拿掉補假），而且只算含補假的版本裡也有的日子（西班牙的假日落在
    週日時移到週一，週日那天不算）。
- 假日最多的月份：含補假的天數最多的月份；同樣多時取較早的月份，tooltip 寫並列的月份。
- 聯邦制國家只算全國層級（德國 9 天、瑞士 4 天、加拿大 5 天、美國 12 天是聯邦假日）；套件有第一級行政區的，
  算出各區（州、省、邦）的天數範圍寫在 tooltip。
- 台灣：套件算出 2026 年 22 天（含補假 6 天），跟行政院人事行政總處的辦公日曆表一致（製作手冊的查證；
  2026-02-15 套件叫「農曆除夕」、官方叫小年夜）。
"""
from __future__ import annotations

import datetime as dt
import json
from collections import Counter

import holidays

from common import OUT_DIR, indicator_file, now_iso, write_json
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "holidays"
FIRST, LAST = 2017, 2027
NOTE_YEAR = 2026
SUBSTITUTED = "Day off (substituted"
SKIP = {"ATA"}  # 南極洲：套件只有幾個國際節日，不是國家的法定假日
# 名稱用中文的（套件有繁體中文的用繁體，其他用英文）
ZH_LANG = {"TW": "zh_TW", "HK": "zh_HK", "MO": "zh_MO", "CN": "zh_TW"}


def _days(code: str, year: int, **kw) -> dict[dt.date, str]:
    return dict(holidays.country_holidays(code, years=year, categories=(holidays.PUBLIC,), **kw))


def _language(code: str, wanted: str) -> str | None:
    langs = holidays.country_holidays(code).supported_languages
    return wanted if wanted in langs else None


def build() -> None:
    known = set(json.loads((OUT_DIR / "countries.json").read_text(encoding="utf-8")))
    years = list(range(FIRST, LAST + 1))
    total: dict[str, list[int | None]] = {}
    base: dict[str, list[int | None]] = {}
    peak: dict[str, list[int | None]] = {}
    hints: dict[str, str] = {}
    hints_en: dict[str, str] = {}
    notes: dict[str, str] = {}
    notes_en: dict[str, str] = {}
    for code in sorted(holidays.list_supported_countries()):
        iso3 = from_alpha2(code)
        if not iso3 or iso3 not in known or iso3 in total or iso3 in SKIP:
            continue
        en = _language(code, "en_US")
        t_row, b_row, p_row = [], [], []
        for y in years:
            days = _days(code, y, language=en) if en else _days(code, y)
            if not days:
                t_row.append(None); b_row.append(None); p_row.append(None)
                continue
            plain = _days(code, y, observed=False, language=en) if en else _days(code, y, observed=False)
            # 只算兩個版本都有的日子：西班牙等國的假日落在週日時，含補假的版本是移到週一（週日那天不算），不能反而比含補假多
            plain = {d: n for d, n in plain.items() if SUBSTITUTED not in n and d in days}
            t_row.append(len(days))
            b_row.append(len(plain))
            months = Counter(d.month for d in days)
            top = max(months.values())
            p_row.append(min(m for m, n in months.items() if n == top))
            if y == NOTE_YEAR:
                ties = sorted(m for m, n in months.items() if n == top)
                zh_lang = _language(code, ZH_LANG.get(code, "")) if code in ZH_LANG else None
                zh_days = _days(code, y, language=zh_lang) if zh_lang else days
                notes[iso3] = f"{y} 年 {len(days)} 天：" + "、".join(f"{d.month}/{d.day} {n}" for d, n in sorted(zh_days.items()))
                notes_en[iso3] = f"{y}: {len(days)} days: " + "; ".join(f"{d:%b} {d.day} {n}" for d, n in sorted(days.items()))
                parts_zh, parts_en = [], []
                if len(ties) > 1:
                    parts_zh.append(f"{'、'.join(f'{m} 月' for m in ties)}同樣 {top} 天")
                    parts_en.append(f"{', '.join(dt.date(2000, m, 1).strftime('%B') for m in ties)} tie at {top} days")
                subdivs = holidays.country_holidays(code).subdivisions
                if subdivs:
                    counts = [len(_days(code, y, subdiv=s)) for s in subdivs]
                    lo, hi = min(counts), max(counts)
                    if hi > len(days) or lo > len(days):
                        parts_zh.append(f"各地另有地方假日：{lo}–{hi} 天" if lo != hi else f"各地都是 {hi} 天")
                        parts_en.append(f"with regional holidays {lo}–{hi} days" if lo != hi else f"{hi} days everywhere with regional holidays")
                if parts_zh:
                    hints[iso3] = "；".join(parts_zh)
                    hints_en[iso3] = "; ".join(parts_en)
        if any(v is not None for v in t_row):
            total[iso3], base[iso3], peak[iso3] = t_row, b_row, p_row
    common_kw = dict(notes=notes, notesEn=notes_en)
    write_json(OUT / "public-holidays.json", indicator_file(
        "public-holidays", "天", years, total, hints=hints, hintsEn=hints_en, **common_kw))
    # 不含補假的指標不放完整的假日清單（三個檔都放太大），側欄的清單看另外兩個指標
    write_json(OUT / "public-holidays-base.json", indicator_file(
        "public-holidays-base", "天", years, base, hints=hints, hintsEn=hints_en))
    write_json(OUT / "holiday-month.json", indicator_file(
        "holiday-month", "月", years, peak, hints=hints, hintsEn=hints_en, **common_kw))
    write_json(OUT / "manifest.json", {"topic": "holidays", "generatedAt": now_iso(),
                                       "source": f"holidays {holidays.__version__} (MIT)"})
    i = years.index(NOTE_YEAR)
    ranked = sorted(((v[i], c) for c, v in total.items() if v[i] is not None), reverse=True)
    print(f"  國定假日：{len(total)} 國；{NOTE_YEAR} 年最多 {ranked[:8]}，最少 {ranked[-8:]}")
    print(f"  台灣 {total.get('TWN')}／不含補假 {base.get('TWN')}；中國 {total.get('CHN')[i]}／{base.get('CHN')[i]}；"
          f"月份 {Counter(v[i] for v in peak.values()).most_common()}")
