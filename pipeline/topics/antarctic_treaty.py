"""南極：南極條約的締約國與協商國（2026-11-08，製作手冊第二十七批 551，候選 1239；步驟 antarctic-treaty，輸出 topics/antarctica/）。

- 資料：南極條約秘書處（Secretariat of the Antarctic Treaty，ATS）的締約國表 https://www.ats.aq/devAS/Parties?lang=e 。
  www.ats.aq 的 robots.txt 對一般程式是 `Disallow: /`，所以程式不抓；使用者 2026-11-08 用瀏覽器存下整頁，
  放在 skywitness/map-plan 的 `data/ats/Parties.html`（README 寫了內容與檢查）。重跑前複製到 pipeline/.cache/ats/。
- 授權：ATS 的 copyright 頁「ATS copyrighted material maybe used as long as the source is indicated」，註明出處就可以用。
- 內容：兩張表，協商國 29、非協商國 29，共 58 國；欄位是條約生效日、取得協商國地位的日期（協商國才有）、
  環境議定書的生效日、CCAS 與 CCAMLR 打勾。日期後面的「(n)」是聲明、繼承或適用範圍的附註（在 data-footnotes 屬性）。
- 時間軸：每一年的地位依日期的年份（1961 年 12 個原始簽署國加波蘭等，到 2026 年 58 國）；
  捷克與斯洛伐克的生效日是 1993-01-01（繼承捷克斯洛伐克 1962 年的加入）。
- 斯洛伐克的環境議定書只有「(n)」沒有日期：附註寫捷克斯洛伐克 1992 年簽署、之後分成兩國；捷克 2004 年生效，
  斯洛伐克沒有生效日，當作「沒有加入」並寫在說明。
"""
from __future__ import annotations

import hashlib
import html
import re
from datetime import date

from common import CACHE_DIR, OUT_DIR, indicator_file, write_json

OUT = OUT_DIR / "topics" / "antarctica"
HTML = CACHE_DIR / "ats" / "Parties.html"
SHA256 = "d822caa4cbab57e3af9a33ce74745aec174e0bf2d2570f008bcb481e565b8115"
FIRST, LAST = 1961, 2026

ISO3 = {
    "Argentina": "ARG", "Australia": "AUS", "Belgium": "BEL", "Brazil": "BRA", "Bulgaria": "BGR", "Chile": "CHL",
    "China": "CHN", "Czechia": "CZE", "Ecuador": "ECU", "Finland": "FIN", "France": "FRA", "Germany": "DEU",
    "India": "IND", "Italy": "ITA", "Japan": "JPN", "Korea (ROK)": "KOR", "Netherlands": "NLD", "New Zealand": "NZL",
    "Norway": "NOR", "Peru": "PER", "Poland": "POL", "Russian Federation": "RUS", "South Africa": "ZAF", "Spain": "ESP",
    "Sweden": "SWE", "Ukraine": "UKR", "United Kingdom": "GBR", "United States": "USA", "Uruguay": "URY",
    "Austria": "AUT", "Belarus": "BLR", "Canada": "CAN", "Colombia": "COL", "Costa Rica": "CRI", "Cuba": "CUB",
    "Denmark": "DNK", "Estonia": "EST", "Greece": "GRC", "Guatemala": "GTM", "Hungary": "HUN", "Iceland": "ISL",
    "Kazakhstan": "KAZ", "Korea (DPRK)": "PRK", "Malaysia": "MYS", "Monaco": "MCO", "Mongolia": "MNG", "Pakistan": "PAK",
    "Papua New Guinea": "PNG", "Portugal": "PRT", "Romania": "ROU", "San Marino": "SMR", "Saudi Arabia": "SAU",
    "Slovakia": "SVK", "Slovenia": "SVN", "Switzerland": "CHE", "Türkiye": "TUR", "United Arab Emirates": "ARE",
    "Venezuela": "VEN",
}
MONTHS = {m: i + 1 for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}


def _date(text: str) -> date | None:
    m = re.match(r"(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})", text)
    return date(int(m.group(3)), MONTHS[m.group(2)], int(m.group(1))) if m else None


def _cell(td: str) -> str:
    text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", td))).strip()
    return "✓" if not text and "check" in td else text


def parties() -> list[dict]:
    if not HTML.exists():
        raise RuntimeError(f"沒有 {HTML}：請把 map-plan 的 data/ats/Parties.html 複製到這裡")
    raw = HTML.read_bytes()
    if hashlib.sha256(raw).hexdigest() != SHA256:
        raise RuntimeError(f"{HTML} 的 SHA-256 跟 map-plan 的 README 不一樣，檔案可能換了版本，先看過再改 SHA256")
    tables = raw.decode("utf-8").split('<table class="table__data">')[1:]
    if len(tables) != 2:
        raise ValueError(f"締約國表應該有兩張（協商國、非協商國），找到 {len(tables)} 張")
    out = []
    for consultative, table in zip((True, False), tables):
        for row in table.split("</table>")[0].split("<tr data-id=")[1:]:
            name = re.sub(r"\s+", " ", html.unescape(re.search(r'<p title="[^"]*">(.*?)</p>', row, re.S).group(1))).strip()
            original = name.endswith("*")
            name = name.rstrip(" *")
            cells = [_cell(td) for td in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
            if consultative:
                entry, cons, protocol, ccas, ccamlr = cells[:5]
            else:
                entry, protocol, ccas, ccamlr = cells[:4]
                cons = ""
            out.append({
                "iso3": ISO3[name], "name": name, "original": original,
                "entry": _date(entry), "consultative": _date(cons), "protocol": _date(protocol),
                "protocol_note": protocol.strip() == "(n)", "ccas": ccas == "✓", "ccamlr": ccamlr == "✓",
            })
    if len(out) != 58 or sum(p["original"] for p in out) != 12:
        raise ValueError(f"締約國 {len(out)} 國、原始簽署國 {sum(p['original'] for p in out)} 國，跟 58、12 對不上")
    return out


def _zh(d: date) -> str:
    return f"{d.year} 年 {d.month} 月 {d.day} 日"


def _en(d: date) -> str:
    return f"{d.day} {d.strftime('%b')} {d.year}"


def build() -> None:
    ps = parties()
    years = list(range(FIRST, LAST + 1))
    status: dict[str, list[int | None]] = {}
    hints, hints_en = {}, {}
    for p in ps:
        row = []
        for y in years:
            if p["consultative"] and p["consultative"].year <= y:
                row.append(1)
            elif p["entry"].year <= y:
                row.append(2)
            else:
                row.append(None)
        status[p["iso3"]] = row
        zh = [f"條約 {_zh(p['entry'])} 生效" + ("（原始簽署國）" if p["original"] else "")]
        en = [f"Treaty in force {_en(p['entry'])}" + (" (original signatory)" if p["original"] else "")]
        if p["consultative"]:
            zh.append(f"協商國 {_zh(p['consultative'])} 起")
            en.append(f"consultative since {_en(p['consultative'])}")
        if p["protocol"]:
            zh.append(f"環境議定書 {_zh(p['protocol'])} 生效")
            en.append(f"Environment Protocol in force {_en(p['protocol'])}")
        elif p["protocol_note"]:
            zh.append("環境議定書：捷克斯洛伐克 1992 年簽署，對斯洛伐克還沒生效")
            en.append("Environment Protocol signed by Czechoslovakia in 1992, not in force for Slovakia")
        others = [n for n, ok in (("CCAS", p["ccas"]), ("CCAMLR", p["ccamlr"])) if ok]
        if others:
            zh.append("、".join(others) + " 締約國")
            en.append(" and ".join(others) + " party")
        hints[p["iso3"]] = "；".join(zh)
        hints_en[p["iso3"]] = "; ".join(en)
    common = dict(hints=hints, hintsEn=hints_en, license="ATS copyrighted material, used with the source indicated（Secretariat of the Antarctic Treaty）")
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "treaty-status.json", indicator_file("treaty-status", "類別", years, status, **common))

    # 三個附屬公約：1 締約（議定書是已生效），2 南極條約締約國、但沒有加入；只有 2026 年
    for key, ok in (("protocol", lambda p: p["protocol"] is not None), ("ccas", lambda p: p["ccas"]), ("ccamlr", lambda p: p["ccamlr"])):
        values = {p["iso3"]: [1 if ok(p) else 2] for p in ps}
        write_json(OUT / "treaty-instruments" / f"{key}.json", indicator_file(f"treaty-{key}", "類別", [LAST], values, **common))

    by_year = {y: sum(1 for r in status.values() if r[y - FIRST] is not None) for y in (1961, 1980, 2000, 2026)}
    print(f"  南極條約：{len(ps)} 國（協商國 {sum(1 for p in ps if p['consultative'])}），各年的締約國數 {by_year}；"
          f"環境議定書 {sum(1 for p in ps if p['protocol'])}、CCAS {sum(p['ccas'] for p in ps)}、CCAMLR {sum(p['ccamlr'] for p in ps)}")
