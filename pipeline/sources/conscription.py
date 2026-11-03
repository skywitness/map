"""徵兵制（2026-11-03，法律與制度的「之後」階段，使用者 2026-11-03 決定做）。

**資料**：CIA World Factbook 的「Military service age and obligation」（美國政府作品，公有領域）。Factbook 2026 年 2 月停刊，
用 GitHub 上的 JSON 鏡像 factbook/factbook.json（CC0 1.0）固定的 commit（`COMMIT`，2026-09-11），文字多半是 2025 年的狀態。
codeload 的 zip 下載點回 403，所以用 git 抓那個 commit（`git fetch --depth 1`）。英文維基「Conscription by country」已經
轉址到「Military service」，那頁沒有各國的表，不用。

**分類**（依 Factbook 的文字逐國歸類，`CATEGORY`；1 最嚴，越嚴越深）：
1 徵兵，男女都要：義務役的條文寫男女都適用（以色列、北韓、挪威、瑞典、丹麥、緬甸、中國、厄利垂亞等）。
2 徵兵：只寫男性或沒寫性別（多數只徵男性）。選擇性徵兵、抽籤也算（泰國、墨西哥）。
3 法律上有，但暫停、不實施，或只在戰時、緊急、志願兵不足時才徵召（德國、荷蘭、阿根廷、印尼…）。
4 只有志願役。
5 沒有軍隊：沒有「兵役」欄、「Military and security forces」寫沒有正規軍隊的主權國家（冰島、哥斯大黎加、巴拿馬…）。
利比亞、葉門的文字是「not available」「limited available information」，不畫。
"""
from __future__ import annotations

import json
import re
import subprocess

from common import CACHE_DIR
from sources.countries import from_name

REPO = "https://github.com/factbook/factbook.json.git"
COMMIT = "144d6977b2b01ac1cbd220de754c0a005616760b"
BOTH, MEN, DORMANT, VOLUNTARY, NO_ARMY = 1, 2, 3, 4, 5
FIELD = "Military service age and obligation"

# Factbook 的國家代碼（檔名，GEC）→ 類別；沒列的有「兵役」欄就是志願役（4）
CATEGORY: dict[str, int] = {
    **{k: BOTH for k in "is kn er no sw da bm cd mz bn ml ng pu su mo ch".split()},
    **{k: MEN for k in ("ag aj am ti tx uz ts es gt ks sn th vm au cy gr lg lh sz up ir jo ku qa tu mx bl co bt ao cv eg "
                        "ek gv cu kg kz rs la tw bo en fi md ae br gg mg hr cb pa").split()},
    **{k: DORMANT for k in "cg iv ma so id mr tp bh et ci gm nl ar po sm sy ct uv tt ve".split()},
    **{k: NO_ARMY for k in "mp cs do gj pm st vc an ic ls mn bp kr fm nh nr ps rm tv ws".split()},
}
SKIP = {"ly", "ym"}  # 文字是「not available」「limited available information」
# Factbook 的國名 pycountry 對不到或會對錯的
NAMES = {"Burma": "MMR", "DRC": "COD", "Congo (Brazzaville)": "COG", "Cote d'Ivoire": "CIV", "C&ocirc;te d'Ivoire": "CIV",
         "The Gambia": "GMB", "The Bahamas": "BHS", "Holy See (Vatican City)": "VAT", "Kosovo": "XKX", "Micronesia": "FSM",
         "Turkey (Turkiye)": "TUR", "Turkey": "TUR", "Laos": "LAO", "Timor-Leste": "TLS", "Eswatini": "SWZ", "Czechia": "CZE",
         "Taiwan": "TWN", "South Korea": "KOR", "North Korea": "PRK", "Russia": "RUS", "Moldova": "MDA", "Iran": "IRN",
         "Syria": "SYR", "Vietnam": "VNM", "Bolivia": "BOL", "Venezuela": "VEN", "Tanzania": "TZA", "Brunei": "BRN",
         "Cabo Verde": "CPV", "Sao Tome and Principe": "STP", "North Macedonia": "MKD", "Bermuda": "BMU",
         "The Dominican": "DOM"}  # 多明尼加共和國的簡稱在 Factbook 裡是「The Dominican」
# 附註：Factbook 代碼 → (中文, 英文)。英文是 Factbook 原文的摘要（公有領域）
NOTES: dict[str, tuple[str, str]] = {
    "tw": ("18–36 歲男性可以志願入伍，或服 12 個月的義務役（2024 年 1 月起，2005 年以後出生的男性從 4 個月恢復為 12 個月）；"
           "有些情況可以服替代役；女性可以志願入伍",
           "Men 18–36 may volunteer or must serve 12 months (since January 2024, for men born in 2005 or later, up from 4 months); "
           "civil service can sometimes be substituted; women may volunteer"),
    "ks": ("18–35 歲男性都要服兵役，役期 18–21 個月（依軍種）", "Compulsory for all eligible men 18–35; 18–21 months depending on service"),
    "sn": ("18–21 歲男性要服 24 個月的義務役", "Men 18–21 serve 24 months of compulsory service"),
    "is": ("18–21 歲男女都要服兵役，士兵最長 36 個月（依性別、婚姻與職務）；猶太人與德魯茲人徵召，基督徒、切爾克斯人、穆斯林可以志願",
           "Compulsory for men and women 18–21, up to 36 months for enlisted personnel (depending on sex, marital status and job); "
           "Jews and Druze are conscripted, while Christians, Circassians and Muslims may volunteer"),
    "kn": ("男性 17–30 歲、女性 17–23 歲都要服兵役，男性最長約 10 年、女性約 7 年",
           "Compulsory for men (17–30) and women (17–23); service reportedly up to 10 years for men and 7 for women"),
    "er": ("18–40 歲的國民都要服兵役或國民役，名義上 18 個月，實際上常無限期延長",
           "Military and national service mandatory for all citizens 18–40; nominally 18 months but often extended indefinitely"),
    "no": ("19–44 歲的國民（男女）都要接受選擇性徵兵", "All citizens 19–44, men and women, are subject to selective compulsory service"),
    "sw": ("18 歲起男女都要接受選擇性徵兵，役期 9–15 個月", "Selective conscription for men and women from 18; 9–15 months"),
    "da": ("男女都要服兵役（抽籤決定），役期 11 個月；2025 年 6 月起女性也納入徵兵",
           "Compulsory for men and women (chosen by lottery); 11 months; conscription was extended to women in June 2025"),
    "bm": ("男女都要服兵役；2010 年的兵役法 2024 年 2 月起實施，軍政府每年徵召約 6 萬人",
           "Compulsory for men and women; the 2010 service law has been enforced since February 2024, with about 60,000 called up a year"),
    "ch": ("男女都適用選擇性徵兵，役期 24 個月；解放軍依需要分配各省員額，志願兵不足時地方政府才強制徵召",
           "Selective compulsory service for men and women, 24 months; the PLA sets provincial quotas, and local governments may "
           "compel service only if volunteers fall short"),
    "vm": ("法律上男女都適用，實際上只徵召男性；役期 24–36 個月", "Applies to men and women in law, but in practice only men are drafted; 24–36 months"),
    "th": ("17 歲男性都要登記，21 歲時抽籤選擇性徵召", "All men register at 17 and are subject to selective (lottery) service at 21"),
    "mx": ("18 歲男性抽籤決定是否服 12 個月的義務役", "Men are subject to a lottery for 12 months of compulsory service at 18"),
    "br": ("18–45 歲男性要服兵役，但只有 5–10% 被徵召的人真的要服役", "Compulsory for men 18–45, but only 5–10% of those inducted actually serve"),
    "rs": ("18–30 歲男性要服 12 個月的義務役", "Compulsory service for men 18–30; at least 12 months"),
    "up": ("男性 25 歲起徵召，役期 18–24 個月", "Conscription for men from age 25; 18–24 months"),
    "sz": ("18–30 歲男性都要服兵役或替代役（245 天）；女性可以志願", "Every man 18–30 must do military or civilian service (245 days); women may volunteer"),
    "gg": ("2016 年廢除，2017 年恢復，18–27 歲男性", "Abolished in 2016 and reinstated in 2017 for men 18–27"),
    "hr": ("2008 年廢除；依 Factbook（2025 年）的說法，2026 年起 19–29 歲男性要受 2 個月基本軍事訓練",
           "Abolished in 2008; according to the Factbook (2025), from 2026 men 19–29 must undergo two months of basic training"),
    "jo": ("25–29 歲沒有工作的男性 2020 年起要服 12 個月的義務役；依 Factbook（2025 年）的說法，18 歲男性的 3 個月選擇性義務役 2026 年恢復",
           "Compulsory service for jobless men 25–29 since 2020; according to the Factbook (2025), 3 months of selective service for "
           "men turning 18 resumes in 2026"),
    "cb": ("2006 年的法律要求 18–30 歲服役 18 個月，但從未實施；依 Factbook，政府 2025 年宣布 2026 年起實施、改成 24 個月",
           "A 2006 law requiring 18 months of service for those 18–30 was never enforced; according to the Factbook, the government "
           "announced in 2025 that it would be enforced from 2026, with 24 months"),
    "pa": ("18–25 歲男性要服至少 12 個月的兵役", "All men 18–25 must serve at least 12 months"),
    "gm": ("2011 年起暫停徵兵；2025 年 12 月的兵役改革，2026 年起 18 歲男性要填寫是否願意服役的問卷，女性仍是自願",
           "Conscription ended in 2011; under a December 2025 reform, from 2026 men turning 18 must fill in a questionnaire on their "
           "willingness to serve, while it stays voluntary for women"),
    "nl": ("全志願役；徵兵制還在法律裡，但 1997 年起暫停", "All-volunteer; conscription remains in law but has been suspended since 1997"),
    "ar": ("1995 年起暫停；危機、戰爭或缺員時仍可以徵召", "Suspended in 1995; citizens can still be drafted in a crisis or war, or if vacancies cannot be filled"),
    "po": ("2004 年廢除義務役，但志願兵不足時可以徵召", "Compulsory service abolished in 2004, but conscription is possible if volunteers are insufficient"),
    "sy": ("阿薩德政權時期 18–38 歲男性要服役 18–21 個月；政權垮台後過渡政府宣布廢除，只在戰爭等緊急狀況才恢復",
           "Under Assad, men 18–38 served 18–21 months; after his fall the interim government abolished it except in emergencies such as war"),
    "id": ("法律准許徵兵，但沒有實施", "Compulsory service is authorised but not used"),
    "ci": ("男性選擇性徵兵，但志願兵通常就夠了", "Selective compulsory service for men, but there are usually enough volunteers"),
    "mr": ("有兩年義務役的法律，但據報從未實施", "A two-year compulsory service law reportedly has never been applied"),
    "bh": ("志願兵不足時才可以徵兵，但從未實施", "Conscription is allowed only if volunteers are insufficient, but has never been implemented"),
    "et": ("沒有義務役，但軍方必要時可以徵召", "No compulsory service, but the military can conduct call-ups when necessary"),
    "su": ("法律上男女都要服 12–24 個月；據報實施不一，內戰中政府軍與快速支援部隊都被指控強迫男性與男孩入伍",
           "Compulsory for men and women in law, 12–24 months; implementation is reportedly uneven, and both the SAF and RSF are "
           "accused of forced recruitment of men and boys during the conflict"),
    "us": ("1973 年起全志願役；18–25 歲男性要向選徵兵役局登記，國會立法可以恢復徵兵",
           "All-volunteer since 1973; men 18–25 must register with Selective Service, and Congress can reinstate the draft"),
    "cs": ("1948 年廢除軍隊，由公安部的警察與準軍事單位負責安全", "Abolished its army in 1948; security is handled by police and paramilitary units"),
    "ic": ("沒有正規軍隊，由警察與海岸防衛隊負責", "No regular military forces; police and the Coast Guard"),
    "pm": ("沒有正規軍隊，由國家警察等公共力量負責", "No regular military forces; the Public Forces include the National Police"),
}


def checkout() -> str:
    """Factbook 鏡像固定 commit 的資料夾（第一次用 git 抓，約 13 MB）"""
    target = CACHE_DIR / "factbook" / COMMIT
    if not (target / "README.md").exists():
        target.mkdir(parents=True, exist_ok=True)
        print(f"  git 抓 {REPO} @ {COMMIT[:10]}")
        for args in (["init", "-q"], ["remote", "add", "origin", REPO], ["fetch", "-q", "--depth", "1", "origin", COMMIT],
                     ["checkout", "-q", "FETCH_HEAD"]):
            subprocess.run(["git", "-C", str(target), *args], check=True)
    return str(target)


def _name(d: dict) -> str:
    g = d.get("Government", {}).get("Country name", {})
    short = (g.get("conventional short form") or {}).get("text") or ""
    return short if short and short != "none" else (g.get("conventional long form") or {}).get("text") or ""


def status(known: set[str]) -> tuple[dict[str, int], dict[str, tuple[str, str]]]:
    root = checkout()
    values: dict[str, int] = {}
    notes: dict[str, tuple[str, str]] = {}
    unmatched, missing = [], []
    from pathlib import Path
    for path in sorted(Path(root).glob("*/*.json")):
        code = path.stem
        d = json.loads(path.read_text(encoding="utf-8"))
        has_field = FIELD in d.get("Military and Security", {})
        if code in SKIP or (not has_field and code not in CATEGORY):
            continue
        name = re.sub(r"&[a-z]+;", "", _name(d)).strip()
        iso3 = NAMES.get(name) or NAMES.get(_name(d)) or from_name(name)
        if not iso3:
            unmatched.append((code, name))
            continue
        if iso3 not in known:
            continue
        values[iso3] = CATEGORY.get(code, VOLUNTARY)
        if code in NOTES:
            notes[iso3] = NOTES[code]
    for code in CATEGORY:
        if not any(True for _ in Path(root).glob(f"*/{code}.json")):
            missing.append(code)
    if unmatched or missing:
        raise RuntimeError(f"Factbook 的國名對不到國家代碼：{unmatched}；CATEGORY 有不存在的代碼：{missing}")
    return values, notes
