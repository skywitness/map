"""旅行實用：入境的健康規定（2026-11-07，製作手冊第二十四批 434；步驟 travel-health，輸出 topics/travel/）。

- WHO《International Travel and Health》Country list（2021-05-12 版，PDF 46 頁，CC BY-NC-SA 3.0 IGO：非商業、
  相同方式分享；這裡做出來的資料檔同樣用 CC BY-NC-SA 3.0 IGO 分享，跟 WHO 血液安全報告、道路安全報告的處理一樣）。
  cdn.who.int 沒有 robots.txt（回 Azure 的錯誤 XML）。用 pypdf 抽文字，去掉頁碼與頁尾註腳後，依全大寫的國名切段，
  每段取 Yellow fever（Country requirement at entry、WHO vaccination recommendation）、Malaria（WHO recommended
  prevention）、Other country requirement(s)。「X see Y」是指向，Y 的規定不套到 X（屬地常有自己的規定，WHO 沒寫）。
  - 入境要不要黃熱病疫苗證明：不要、來自疫區（或在疫區轉機）的旅客要、所有旅客都要。
  - WHO 建議要不要打：建議、建議但部分地區除外、只建議部分地區、一般不建議、不建議。
  - 瘧疾預防：A 只要防蚊、B 防蚊加預防藥（非惡性瘧）、C 防蚊加預防藥（惡性瘧）、依地區不同、已認證無瘧疾、
    沒有列瘧疾風險（WHO 說只有有瘧疾風險區的國家才寫 Malaria 一段）。
  每一國的英文原文放附註（側欄），中文摘要（年齡門檻、轉機、年份）放滑過的說明；原文沒有逐條中譯。
- 台灣不在 WHO 的名單上。台灣的角度用衛生福利部疾病管制署的兩筆開放資料（政府資料開放授權條款第 1 版；
  od.cdc.gov.tw 從 cloud 連不上，本機 session 2026-11-05 下載，放在 map-plan 的 data/cdc/，README 有 SHA-256）：
  - 「國際旅遊處方箋網頁內容」（data.gov.tw 42781，TMPrescription.csv，2026-10-21 版）的「國際旅遊疫情建議等級」列：
    每國現在最高的等級與疾病。另一筆「國際旅遊疫情建議等級表」（10567，TCDCTravelAlert.csv）是發布紀錄，
    取最新一列算出來的結果跟處方箋一致（只差國名寫法），但新冠的舊病名「嚴重特殊傳染性肺炎」2020 年的紀錄沒有解除，
    直接用會多算，所以地圖用處方箋，時間軸沒做。
  - 處方箋「預防接種規定及建議」列了「瘧疾預防用藥」的 110 個國家或地區。
"""
from __future__ import annotations

import csv
import hashlib
import re
import shutil
from collections import Counter, defaultdict
from pathlib import Path

from common import CACHE_DIR, OUT_DIR, download, indicator_file, write_json, write_manifest_part
from sources.countries import from_name, from_numeric

OUT = OUT_DIR / "topics" / "travel"
WHO_URL = "https://cdn.who.int/media/docs/default-source/documents/emergencies/travel-advice/ith2021_countrylist.pdf"
WHO_YEAR = 2021
CDC_YEAR = 2026
PLAN_CDC = Path(__file__).resolve().parents[3] / "map-plan" / "data" / "cdc"
CDC_DIR = CACHE_DIR / "cdc"
CDC_FILES = {
    "TMPrescription.csv": "a7a21fdfd5c8389ff982f6dd113244d6ac68c1c334ee86199d8c58d2f4cd50ae",
}

# 入境要不要黃熱病疫苗證明（src/topics/travel-health.ts 的 YF_ENTRY）
YF_NO, YF_FROM_RISK, YF_ALL = 1, 2, 3
# WHO 建議要不要打（YF_WHO）
REC_NO, REC_GENERALLY_NOT, REC_SOME_AREAS, REC_EXCEPT, REC_YES = 1, 2, 3, 4, 5
# 瘧疾預防（MALARIA）
MAL_NONE_LISTED, MAL_FREE, MAL_A, MAL_B, MAL_MIXED, MAL_C, MAL_NO_PREVENTION = 1, 2, 3, 4, 5, 6, 7
# 疾管署的建議等級（CDC_LEVELS）
CDC_LEVEL = {"第一級": 1, "第二級": 2, "第三級": 3}
CDC_LEVEL_EN = {1: "Level 1 Watch", 2: "Level 2 Alert", 3: "Level 3 Warning"}

# WHO 的國名（大寫）→ ISO3：sources.countries.from_name 認不得的
WHO_NAMES = {
    "BOLIVIA (PLURINATIONAL STATE OF)": "BOL", "BONAIRE": "BES", "BRITISH INDIAN OCEAN TERRITORY": "IOT",
    "CABO VERDE": "CPV", "CÔTE D’IVOIRE": "CIV", "CURAÇAO": "CUW", "CZECHIA": "CZE",
    "DEMOCRATIC PEOPLE’S REPUBLIC OF KOREA": "PRK", "DEMOCRATIC REPUBLIC OF THE CONGO": "COD", "CONGO": "COG",
    "ESWATINI": "SWZ", "IRAN (ISLAMIC REPUBLIC OF)": "IRN", "LAO PEOPLE’S DEMOCRATIC REPUBLIC": "LAO",
    "MICRONESIA (FEDERATED STATES OF)": "FSM", "REPUBLIC OF KOREA": "KOR", "REPUBLIC OF MOLDOVA": "MDA",
    "REUNION": "REU", "RUSSIAN FEDERATION": "RUS", "SAINT BARTHELEMY": "BLM", "SAINT HELENA": "SHN",
    "SAINT MARTIN": "MAF", "SINT MAARTEN": "SXM", "SYRIAN ARAB REPUBLIC": "SYR", "TURKEY": "TUR",
    "UNITED KINGDOM (WITH CHANNEL ISLANDS AND ISLE OF MAN)": "GBR", "UNITED REPUBLIC OF TANZANIA": "TZA",
    "VENEZUELA (BOLIVARIAN REPUBLIC OF)": "VEN", "VIET NAM": "VNM", "PITCAIRN ISLANDS": "PCN",
    "CHRISTMAS ISLAND": "CXR", "NORTH MACEDONIA": "MKD", "BRUNEI DARUSSALAM": "BRN", "TIMOR-LESTE": "TLS",
    "FAROE ISLANDS": "FRO", "WALLIS AND FUTUNA": "WLF", "SAO TOME AND PRINCIPE": "STP",
    # 沙巴、聖佑達修斯跟波奈同屬荷蘭加勒比區（BES），威克島沒有自己的國界，都不畫
    "SABA": None, "SINT EUSTATIUS": None, "WAKE ISLAND": None,
}
HEADING = re.compile(r"[A-Z][A-Z ,.'()\-’ÔÉÇ]+")
SEE = re.compile(r"[A-Z][A-Z ,.'()\-’ÔÉÇ]+,? see [A-Z ,.'()\-’ÔÉÇ]+")
# 原文自相矛盾：利比亞寫「no a yellow fever vaccination certificate is required for travellers aged 1 year or over
# arriving from countries with risk…」，依後半句當作來自疫區的旅客要，說明寫明
CONTRADICTORY = {"LBY"}


def _cdc(name: str) -> Path:
    path = CDC_DIR / name
    if not path.exists():
        src = PLAN_CDC / name
        if not src.exists():
            raise RuntimeError(f"沒有 {path}：請把 map-plan 的 data/cdc/{name} 複製到這裡")
        CDC_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, path)
    if hashlib.sha256(path.read_bytes()).hexdigest() != CDC_FILES[name]:
        raise RuntimeError(f"{path} 的 SHA-256 跟 map-plan 的 README 不一樣，檔案可能換了版本，先看過再改 CDC_FILES")
    return path


def _clean_lines(text: str) -> list[str]:
    """去掉頁碼與頁尾註腳（註腳前面有一行長空白，到下一個頁碼為止）。"""
    out, skip = [], False
    for line in text.split("\n"):
        s = line.strip()
        if skip:
            skip = not re.fullmatch(r"\d{1,2}", s)
            continue
        if not s and len(line) >= 40:
            skip = True
            continue
        if re.fullmatch(r"\d{1,2}", s):
            continue
        out.append(s)
    return out


def _blocks(pdf: Path) -> dict[str, str]:
    from pypdf import PdfReader

    text = "\n".join(p.extract_text() for p in PdfReader(str(pdf)).pages)
    text = text[text.index("AFGHANISTAN \nYellow"):text.index("= = =")]
    lines = _clean_lines(text)
    blocks: dict[str, list[str]] = {}
    name = None
    for i, s in enumerate(lines):
        nxt = lines[i + 1] if i + 1 < len(lines) else ""
        if SEE.fullmatch(s) or s == "OF KOREA":  # 「ANGUILLA see UNITED KINGDOM」是指向，不是一段
            name = None
            continue
        head = re.sub(r"\s*\(\d{4}\)$", "", s)  # 「JORDAN (2020)」
        if HEADING.fullmatch(head) and len(head) > 3 and nxt.startswith(("Yellow fever (", "Malaria (", "(Indian Ocean)")):
            name = head.strip()
            blocks[name] = []
            continue
        if name and s != "(Indian Ocean)":
            blocks[name].append("Malaria ()" if s == "Malaria" else s)  # 幾內亞的瘧疾那一段沒寫年份
    return {k: re.sub(r"\s+", " ", " ".join(v)).strip() for k, v in blocks.items()}


def _field(txt: str, start: str, stops: tuple[str, ...]) -> str | None:
    m = re.search(start + r"\s*:\s*", txt)
    if not m:
        return None
    rest = txt[m.end():]
    end = min([i for i in (rest.find(s) for s in stops) if i >= 0] or [len(rest)])
    return re.sub(r"(?<=[a-z.)])\s*\d{1,2}$", "", rest[:end].strip()).strip()  # 欄位最後的註腳上標數字（「no 34」）


def _zh(year: str | None) -> str:
    """「prior to 2013」→「2013 年以前」"""
    return re.sub(r"prior to (\d{4})", r"\1 年以前", year or "")


def _age(req: str) -> tuple[str, str] | None:
    m = re.search(r"aged (\d+) (month|year)s?", req)
    if not m:
        return None
    n = int(m.group(1))
    return (f"{n} 個月以上" if m.group(2) == "month" else f"{n} 歲以上",
            f"aged {n} {m.group(2)}{'s' if n > 1 else ''} or over")


def _transit(req: str) -> tuple[str, str] | None:
    if "transit" not in req:
        return None
    m = re.search(r"transit\w*[^.]*?(?:more than|over|exceeding|longer than)\s+(\d+)\s+hours", req)
    if m:
        return f"在疫區機場轉機超過 {m.group(1)} 小時也算", f"including transit of more than {m.group(1)} hours"
    return "在疫區轉機也算", "including transit"


def _yf_entry(req: str) -> int:
    r = req.lower()
    if r.startswith("no ") and r[3:].startswith("a yellow fever"):
        r = r[3:]
    if r.startswith("no") and "required" not in r[:60]:
        return YF_NO
    if re.search(r"arriving from|coming from|from countries with risk|from (?:an )?areas? with risk|travellers from", r):
        return YF_FROM_RISK
    if re.search(r"all travellers|anyone", r):
        return YF_ALL
    raise RuntimeError(f"黃熱病入境規定認不得：{req[:120]!r}")


def _yf_who(rec: str) -> int:
    r = rec.lower()
    if r.startswith("in general, no") or r.startswith("generally not"):
        return REC_GENERALLY_NOT
    if r.startswith("no"):
        return REC_NO
    if r.startswith("yes"):
        if re.search(r"going to (the following|areas|the )|recommended for travellers going to", r) and "except" not in r[:120]:
            return REC_SOME_AREAS
        if "except" in r or "not recommended" in r:
            return REC_EXCEPT
        return REC_YES
    raise RuntimeError(f"WHO 黃熱病建議認不得：{rec[:120]!r}")


def _malaria(txt: str) -> tuple[int, str | None, str | None]:
    """回傳（類別、瘧疾那一段的原文、預防型別的原文）。"""
    m = re.search(r"Malaria \(([^)]*)\)\s*(.*?)(?=Other country requirement|$)", txt)
    if not m:
        return MAL_NONE_LISTED, None, None
    body = re.sub(r"(\w) -(\w)", r"\1-\2", m.group(2))  # pypdf 在連字號前多一個空白（「locally -acquired」）
    prev = _field(body, r"WHO recommended prevention[^:]*", ("Other country requirement",))
    desc = re.sub(r"(?<=[a-z.)])\s*\d{1,2}$", "", re.split(r"WHO recommended prevention", body)[0].strip())  # 註腳上標
    if prev is None:
        if re.search(r"malaria-free|free of malaria", desc, re.I):
            return MAL_FREE, desc, None
        return MAL_NO_PREVENTION, desc, None
    letters = set(re.findall(r"\b([ABC])\b", prev))
    if prev.lower().startswith("none") or not letters:
        return MAL_NO_PREVENTION, desc, prev
    if len(letters) > 1:
        return MAL_MIXED, desc, prev
    return {"A": MAL_A, "B": MAL_B, "C": MAL_C}[letters.pop()], desc, prev


def build() -> None:
    pdf = download(WHO_URL, "who-ith", "ith2021_countrylist.pdf")
    blocks = _blocks(pdf)
    entry, who, mal = {}, {}, {}
    h_entry, h_entry_en, h_who, h_who_en, h_mal, h_mal_en = {}, {}, {}, {}, {}, {}
    notes, notes_en, mal_notes, mal_notes_en = {}, {}, {}, {}
    unknown = []
    for name, txt in blocks.items():
        iso3 = WHO_NAMES[name] if name in WHO_NAMES else from_name(name.title())
        if name in WHO_NAMES and iso3 is None:
            continue
        if not iso3:
            unknown.append(name)
            continue
        yf_year = re.search(r"Yellow fever \(([^)]*\d{4})\)", txt)  # 北韓是「prior to 2013」
        yf_year = yf_year.group(1) if yf_year else None
        req = _field(txt, r"Country requirement at entry", ("WHO vaccination recommendation", "Malaria (", "Other country"))
        rec = _field(txt, r"WHO vaccination recommendation", ("Malaria (", "Other country requirement"))
        other = re.search(r"Other country requirement\(s\)\s*(?:\(([^)]*)\))?\s*:?\s*(.*?)(?=Malaria \(|$)", txt)
        other = f"（{_zh(other.group(1))}）{other.group(2).strip()}" if other and other.group(1) else (other.group(2).strip() if other else None)
        mal_kind, mal_desc, mal_prev = _malaria(txt)
        mal_year = re.search(r"Malaria \(([^)]*)\)", txt)
        mal_year = (mal_year.group(1) or None) if mal_year else None
        parts, parts_en = [], []
        if req is not None:
            k = _yf_entry(req)
            entry[iso3] = [k]
            age, transit = _age(req), _transit(req)
            zh = {YF_NO: "不需要", YF_FROM_RISK: "來自有黃熱病傳播風險國家的旅客要", YF_ALL: "所有旅客都要"}[k]
            en = {YF_NO: "Not required", YF_FROM_RISK: "Required for travellers arriving from countries with risk of transmission",
                  YF_ALL: "Required for all travellers"}[k]
            if k != YF_NO:
                zh += "".join(f"，{x[0]}" for x in (age, transit) if x)
                en += "".join(f", {x[1]}" for x in (age, transit) if x)
            detained = re.search(r"detained in (?:isolation|quarantine) for up to (\d+) days", req)
            if detained:
                zh += f"；沒有證明會被隔離最多 {detained.group(1)} 天"
                en += f"; travellers without a certificate may be detained for up to {detained.group(1)} days"
            if iso3 in CONTRADICTORY:
                zh += "（原文開頭寫 no，接著又寫要證明，這裡依後半句）"
                en += " (the text begins with “no” and then states the requirement; the latter is used here)"
            h_entry[iso3], h_entry_en[iso3] = f"{zh}（WHO {_zh(yf_year)}）", f"{en} (WHO {yf_year})"
            parts.append(f"入境規定（{_zh(yf_year)}）：{req}")
            parts_en.append(f"Country requirement at entry ({yf_year}): {req}")
        if rec is not None:
            k = _yf_who(rec)
            who[iso3] = [k]
            h_who[iso3] = {REC_NO: "不建議", REC_GENERALLY_NOT: "一般不建議", REC_SOME_AREAS: "只建議去部分地區的人打",
                           REC_EXCEPT: "建議，部分地區除外", REC_YES: "建議 9 個月以上的旅客都打"}[k] + f"（WHO {_zh(yf_year)}）"
            h_who_en[iso3] = {REC_NO: "Not recommended", REC_GENERALLY_NOT: "Generally not recommended",
                              REC_SOME_AREAS: "Recommended only for some areas", REC_EXCEPT: "Recommended, except some areas",
                              REC_YES: "Recommended for all travellers aged 9 months or over"}[k] + f" (WHO {yf_year})"
            parts.append(f"WHO 建議：{rec}")
            parts_en.append(f"WHO vaccination recommendation: {rec}")
        mal[iso3] = [mal_kind]
        h_mal[iso3] = {
            MAL_NONE_LISTED: "WHO 沒有列瘧疾風險", MAL_FREE: "已認證無瘧疾", MAL_A: "A：只要防蚊",
            MAL_B: "B：防蚊加預防藥（非惡性瘧）", MAL_C: "C：防蚊加預防藥（惡性瘧）", MAL_MIXED: "依地區不同",
            MAL_NO_PREVENTION: "風險極低或已無本地感染，WHO 建議的預防是 none"}[mal_kind] + (f"（WHO {_zh(mal_year)}）" if mal_year else "")
        h_mal_en[iso3] = {
            MAL_NONE_LISTED: "No malaria risk listed by WHO", MAL_FREE: "Certified malaria-free", MAL_A: "A: mosquito-bite prevention only",
            MAL_B: "B: bite prevention plus chemoprophylaxis (non-falciparum)", MAL_C: "C: bite prevention plus chemoprophylaxis (P. falciparum)",
            MAL_MIXED: "Varies by area", MAL_NO_PREVENTION: "Very limited or no local transmission; WHO prevention: none"}[mal_kind] + (f" (WHO {mal_year})" if mal_year else "")
        if mal_prev and mal_kind == MAL_MIXED:
            h_mal[iso3] += f"：{mal_prev}"
            h_mal_en[iso3] += f": {mal_prev}"
        if mal_desc:
            mal_notes[iso3] = f"WHO 原文（英文）—瘧疾（{_zh(mal_year)}）：{mal_desc}" + (f" 預防：{mal_prev}" if mal_prev else "")
            mal_notes_en[iso3] = f"Malaria ({mal_year}): {mal_desc}" + (f" Prevention: {mal_prev}" if mal_prev else "")
        if other:
            parts.append(f"其他規定{other}")
            parts_en.append("Other country requirements " + re.sub(r"^（(.*?)）", r"(\1) ", other))
        if parts:
            notes[iso3] = "WHO 原文（英文）—" + "／".join(parts)
            notes_en[iso3] = " / ".join(parts_en)
    if unknown:
        raise RuntimeError(f"WHO 國名認不得：{unknown}")

    lic = "CC BY-NC-SA 3.0 IGO"
    taiwan = ("WHO 的名單沒有台灣", "Taiwan is not in WHO's list")
    common = {"license": lic, "noValue": {"TWN": taiwan[0]}, "noValueEn": {"TWN": taiwan[1]}}
    yf_notes = {"notes": dict(sorted(notes.items())), "notesEn": dict(sorted(notes_en.items()))}
    write_json(OUT / "yellow-fever-entry.json", indicator_file(
        "yellow-fever-entry", "類別", [WHO_YEAR], dict(sorted(entry.items())),
        hints=dict(sorted(h_entry.items())), hintsEn=dict(sorted(h_entry_en.items())), **yf_notes, **common))
    write_json(OUT / "yellow-fever-who.json", indicator_file(
        "yellow-fever-who", "類別", [WHO_YEAR], dict(sorted(who.items())),
        hints=dict(sorted(h_who.items())), hintsEn=dict(sorted(h_who_en.items())), **yf_notes, **common))
    write_json(OUT / "malaria-prevention.json", indicator_file(
        "malaria-prevention", "類別", [WHO_YEAR], dict(sorted(mal.items())),
        hints=dict(sorted(h_mal.items())), hintsEn=dict(sorted(h_mal_en.items())),
        notes=dict(sorted(mal_notes.items())), notesEn=dict(sorted(mal_notes_en.items())), **common))

    # 疾管署：國際旅遊處方箋
    rows = list(csv.DictReader(_cdc("TMPrescription.csv").open(encoding="utf-8-sig")))
    level: dict[str, int] = {}
    diseases: dict[str, list[tuple[int, str, str]]] = defaultdict(list)
    drug: dict[str, list[int]] = {}
    no_code = set()
    for r in rows:
        iso3 = from_numeric(r["ISO3166-1（numeric）"]) if r["ISO3166-1（numeric）"].strip() else None
        if not iso3:
            no_code.add(r["國名(中)"])
            continue
        if r["主類別"] == "國際旅遊疫情建議等級":
            lv = CDC_LEVEL[r["次類別"][:3]]
            level[iso3] = max(level.get(iso3, 0), lv)
            diseases[iso3].append((lv, r["疾病"], r["警示日期"]))
        elif r["疫苗"] == "瘧疾預防用藥":
            drug[iso3] = [1]
    cdc_hint, cdc_hint_en = {}, {}
    for c, raw in diseases.items():
        # 同一個疾病常有好幾列（各省、各州分開發布）：留最高的等級與最近的日期
        best: dict[str, tuple[int, str, str]] = {}
        for lv, dis, date in raw:
            key = tuple(int(x) for x in date.split("/")) if date else (0,)
            old = best.get(dis)
            if not old or (lv, key) > (old[0], tuple(int(x) for x in old[2].split("/")) if old[2] else (0,)):
                best[dis] = (lv, dis, date)
        ds = sorted(best.values(), key=lambda d: (-d[0], d[1]))
        cdc_hint[c] = "；".join(f"{d[1]} 第{'一二三'[d[0] - 1]}級（{d[2]}）" for d in ds)
        cdc_hint_en[c] = "; ".join(f"{d[1]} level {d[0]} ({d[2]})" for d in ds)
    cdc_lic = "政府資料開放授權條款第 1 版"
    write_json(OUT / "cdc-epidemic-level.json", indicator_file(
        "cdc-epidemic-level", "級", [CDC_YEAR], {c: [v] for c, v in sorted(level.items())},
        hints=dict(sorted(cdc_hint.items())), hintsEn=dict(sorted(cdc_hint_en.items())), license=cdc_lic))
    # 疾管署列了、WHO 2021 年的清單卻沒有瘧疾風險（或寫已認證無瘧疾）的，滑過時寫出來
    differ = {c: mal[c][0] if c in mal else 0 for c in drug if mal.get(c, [MAL_NONE_LISTED])[0] in (MAL_NONE_LISTED, MAL_FREE)}
    zh_d = {0: "WHO 的清單沒有這個地區", MAL_FREE: "WHO 2021 年的清單寫已認證無瘧疾", MAL_NONE_LISTED: "WHO 2021 年的清單沒有列瘧疾風險"}
    en_d = {0: "Not in WHO's list", MAL_FREE: "Certified malaria-free in WHO's 2021 list", MAL_NONE_LISTED: "No malaria risk listed in WHO's 2021 list"}
    write_json(OUT / "cdc-malaria-drug.json", indicator_file(
        "cdc-malaria-drug", "類別", [CDC_YEAR], dict(sorted(drug.items())), license=cdc_lic,
        hints={c: zh_d[k] for c, k in sorted(differ.items())}, hintsEn={c: en_d[k] for c, k in sorted(differ.items())}))
    write_manifest_part(OUT, "travel", "travel-health", {"sources": [
        WHO_URL + " (CC BY-NC-SA 3.0 IGO)",
        "https://data.gov.tw/dataset/42781 (政府資料開放授權條款第 1 版)"]})

    print(f"  WHO：{len(blocks)} 段、{len(entry)} 個有黃熱病條目、{len(mal)} 個上地圖")
    print(f"    入境規定 {Counter(v[0] for v in entry.values())}；所有旅客都要：{sorted(c for c, v in entry.items() if v[0] == YF_ALL)}")
    print(f"    WHO 建議 {Counter(v[0] for v in who.values())}")
    for k in (REC_SOME_AREAS, REC_EXCEPT, REC_YES):
        print(f"      {k}：{sorted(c for c, v in who.items() if v[0] == k)}")
    print(f"    瘧疾 {Counter(v[0] for v in mal.values())}")
    for k in (MAL_MIXED, MAL_NO_PREVENTION, MAL_FREE, MAL_A, MAL_B):
        print(f"      {k}：{sorted(c for c, v in mal.items() if v[0] == k)}")
    print(f"    轉機：{sorted(c for c, h in h_entry.items() if '轉機' in h)}")
    for c in ("AFG", "ALB", "DZA", "AGO", "ARG", "THA", "JPN", "IND", "BRA", "TZA"):
        print(f"    {c}：{h_entry.get(c)} | {h_who.get(c)} | {h_mal.get(c)}")
    print(f"  疾管署：建議等級 {len(level)} 國 {Counter(level.values())}；瘧疾預防用藥 {len(drug)}；沒有代碼 {sorted(no_code)}")
    print(f"    第二級以上：{sorted(c for c, v in level.items() if v >= 2)}；第三級：{[(c, cdc_hint[c]) for c, v in level.items() if v == 3]}")
    print(f"    有瘧疾預防用藥、WHO 卻沒列風險或已認證：{differ}")
    print(f"    WHO 是 C、疾管署沒列瘧疾預防用藥：{sorted(c for c, v in mal.items() if v[0] == MAL_C and c not in drug)}")
