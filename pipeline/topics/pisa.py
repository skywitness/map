"""學生能力（PISA）主題：數學、閱讀、科學三個科目的平均分數、低成就與高成就的比例、跟上一次與 2012 年比的變化、男女差距。

- 資料是 OECD《PISA 2025 Results (Volume I)》附錄 B1 的表（CC BY 4.0，`sources/oecd_pisa.py`）：
  參加 2025 年的 91 個國家與經濟體，加上它們之前每一次的成績（數學 2003、閱讀 2000、科學 2006 年起，
  OECD 認為可以比較的那幾次）。年份是每一次 PISA 的名稱（2009 年的「PISA 2009+」有些國家 2010 年才測）。
- 只參加過之前幾次的國家（俄羅斯、上海、列支敦斯登…）只在 2024 年 7 月以前出版的報告裡，那些報告不是 CC BY 4.0，
  沒有用（DESIGN.md 第 8 節第 12、68 點）。
- 只有部分地區參加的（北京上海江蘇浙江、杜尚別、庫德斯坦地區、烏克蘭的 17／18 個地區）畫成點（主題自訂的地點），
  不塗整個國家；香港、澳門在地圖上有自己的形狀。
- 臺灣（PISA 的名稱是 Chinese Taipei）跟臺灣 PISA 國家研究中心公布的分數逐一比對（`TW_SCORES`），名次另外輸出
  `taiwan.json` 給側欄對照。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import oecd_pisa

Series = dict[str, dict[int, float]]

BASE_YEAR = 2012  # 「跟 2012 年比」的基準：數學是主測、三個科目都已經可以比較的一年
GENDER_FROM = 2015
# OECD 只有限度地報告、不報告趨勢的參加者（PISA 2025 Reader's Guide）：歷次分數照列，不算變化
NO_TREND = {"ALB"}

# 臺灣 PISA 國家研究中心（國立臺灣師範大學）2026-09-08 記者會簡報公布的歷屆分數與名次
TW_SOURCE = "https://pr.ntnu.edu.tw/archive/file/PISA%2025%E8%A8%98%E8%80%85%E6%9C%83%E7%B0%A1%E5%A0%B1.pdf"
TW_PARTICIPANTS = {2006: 57, 2009: 65, 2012: 65, 2015: 72, 2018: 79, 2022: 81, 2025: 91}
TW_SCORES = {
    "math": {2006: 549, 2009: 543, 2012: 560, 2015: 542, 2018: 531, 2022: 547, 2025: 546},
    "reading": {2006: 496, 2009: 495, 2012: 523, 2015: 497, 2018: 503, 2022: 515, 2025: 508},
    "science": {2006: 532, 2009: 520, 2012: 523, 2015: 532, 2018: 516, 2022: 537, 2025: 540},
}
TW_RANKS = {
    "math": {2006: 1, 2009: 5, 2012: 4, 2015: 4, 2018: 5, 2022: 3, 2025: 4},
    "reading": {2006: 16, 2009: 23, 2012: 8, 2015: 23, 2018: 17, 2022: 5, 2025: 3},
    "science": {2006: 4, 2009: 12, 2012: 13, 2015: 4, 2018: 10, 2022: 4, 2025: 4},
}
# 同一份簡報的 2025 年未達水準 2、水準 5 以上的比例（%）
TW_LEVELS_2025 = {"math": (14.5, 31.8), "reading": (17.9, 13.4), "science": (12.9, 20.1)}

DOMAIN_ZH = {"math": "數學", "reading": "閱讀", "science": "科學"}
DOMAIN_EN = {"math": "mathematics", "reading": "reading", "science": "science"}

# ── 附註（中文、英文）：(適用的科目，None 是全部；只放在哪些指標，None 是全部) ──────────────
NOT_IN_TREND = "OECD 2025 年報告的趨勢表沒有列{year}年的成績（OECD 認為不能跟其他年份比較）"
NOT_IN_TREND_EN = "The trend tables in the OECD's 2025 report do not include {year} (not considered comparable)"
SAMPLING = "2025 年沒有達到 PISA 的抽樣標準（OECD 標上星號），"
SAMPLING_EN = "Did not meet one or more PISA sampling standards in 2025 (marked with an asterisk by the OECD); "
PFD = "2018 年的數字是 2017 年施測的 PISA for Development（給中低所得國家的版本）"
PFD_EN = "Figures under 2018 are from the PISA for Development assessment conducted in 2017"
PLUS_2009 = "2009 年的數字是 2010 年施測的（PISA 2009+）"
PLUS_2009_EN = "Figures under 2009 come from PISA 2009+, conducted in 2010"
CBA = "2025 年從紙本改成電腦測驗，跟之前比要小心"
CBA_EN = "Switched from paper to computer-based testing in 2025, so comparisons with earlier years need caution"

NOTES: dict[str, list[tuple[tuple[str, str], set[str] | None, set[str] | None]]] = {
    "TWN": [((
        "PISA 的名稱是「Chinese Taipei」。名次只在參加 2025 年的國家與經濟體之間排：2006–2012 年少了上海、列支敦斯登等"
        "沒有參加 2025 年的參加者，有幾次比臺灣 PISA 國家研究中心公布的名次前面 1–3 名（官方的名次見側欄下面的表）",
        "Listed in PISA as “Chinese Taipei”. Ranks are among participants in PISA 2025 only: for 2006–2012, without "
        "Shanghai, Liechtenstein and others that did not take part in 2025, some are 1–3 places higher than those "
        "published by Taiwan's PISA National Center (see the table further down the panel)",
    ), None, {"mean", "low", "top", "change", "change-2012"})],
    "_QCI": [((
        "中國的北京、上海、江蘇、浙江四個省市（B-S-J-Z），不是全中國，2018 年起參加。2009、2012 年的上海，2015 年的北京、上海、"
        "江蘇、廣東（B-S-J-G）沒有參加 2025 年，OECD 2025 年的報告沒有收",
        "Four provinces and municipalities of China (Beijing, Shanghai, Jiangsu and Zhejiang), not the whole country; "
        "taking part since 2018. Shanghai (2009, 2012) and B-S-J-G (2015) did not take part in 2025 and are not in "
        "the OECD's 2025 report",
    ), None, None)],
    "_QUA": [((
        "烏克蘭能施測的地區：2022 年 27 個裡的 18 個、2025 年 17 個（不含頓內茨克、盧甘斯克、哈爾科夫、札波羅熱、赫爾松、"
        "克里米亞等受戰爭影響的地區），不代表全國；2018 年全國的成績沒有收在 OECD 2025 年的報告裡",
        "The parts of Ukraine where testing was possible: 18 of 27 regions in 2022 and 17 in 2025 (excluding war-affected "
        "areas such as Donetsk, Luhansk, Kharkiv, Zaporizhzhia, Kherson and Crimea), so not the whole country. The 2018 "
        "national result is not in the OECD's 2025 report",
    ), None, None)],
    "_QKI": [((
        "只有伊拉克的庫德斯坦地區參加，而且只有公立學校",
        "Only the Kurdistan Region of Iraq took part, and only public schools",
    ), None, None)],
    "_QTJ": [((
        "只有塔吉克的首都杜尚別參加",
        "Only Dushanbe, the capital of Tajikistan, took part",
    ), None, None)],
    "CYP": [((
        "賽普勒斯政府實際管轄的地區，不含北賽普勒斯",
        "The area under the effective control of the Government of the Republic of Cyprus",
    ), None, None)],
    "LBN": [((
        "2025 年不含受中東衝突影響最大的兩個省",
        "In 2025, all governorates except the two most affected by the conflicts in the Middle East",
    ), None, None)],
    "PSE": [((
        "2025 年不含受衝突影響最大的學校；為了比較，OECD 把 2022 年的結果依同樣的範圍重算",
        "In 2025, excluding the schools most affected by conflict; the OECD recalculated the 2022 results with the "
        "same coverage for comparison",
    ), None, None)],
    "ALB": [((
        "2025 年小規模的學校沒有受測、學校回應率只有 76%，OECD 只有限度地報告、不比較趨勢："
        "歷次的分數照列，「比上一次」「跟 2012 年比」沒有阿爾巴尼亞",
        "In 2025 small schools were not tested and the school response rate was 76%, so the OECD reports Albania's "
        "results only in a limited way and without trends: scores are shown, but not the changes",
    ), None, None)],
    "USA": [((
        SAMPLING + "學校回應率（含遞補）只有 54%，OECD 提醒判讀要特別小心，偏差的方向無法判斷",
        SAMPLING_EN + "the school response rate after replacement was 54%, so the OECD urges particular caution; "
        "the direction of any bias cannot be determined",
    ), None, None)],
    "CAN": [((
        SAMPLING + "學校與學生的回應率偏低，OECD 估計分數可能偏高，科學最多約 15 分",
        SAMPLING_EN + "low school and student response rates; the OECD estimates scores may be biased upwards by up "
        "to about 15 points in science",
    ), None, None)],
    "NLD": [((
        SAMPLING + "學生回應率 78%、排除的學生 9.3%，學生未回應可能讓分數偏差約 11 分",
        SAMPLING_EN + "a student response rate of 78% and exclusions of 9.3%; student non-response could shift "
        "scores by about 11 points",
    ), None, None)],
    "NZL": [((
        SAMPLING + "學校回應率（含遞補）只有 52%，OECD 估計平均分數可能高估 10–15 分",
        SAMPLING_EN + "a school response rate after replacement of 52%; the OECD estimates mean scores may be "
        "overestimated by 10–15 points",
    ), None, None)],
    "NOR": [((
        SAMPLING + "排除的學生占 10.4%，分數可能偏高",
        SAMPLING_EN + "10.4% of students were excluded, which may bias results upwards",
    ), None, None)],
    "UZB": [((
        "2025 年的數學與閱讀作答資料有不一致的地方，OECD 沒有公布，只有科學",
        "Mathematics and reading results for 2025 were not published because of inconsistencies in the response "
        "data; only science is reported",
    ), {"math", "reading"}, None)],
    "VNM": [((
        "2025 年改用電腦測驗，之前都是紙本，OECD 不比較越南的趨勢，所以只有 2025 年",
        "Switched to computer-based testing in 2025 after paper tests in all earlier cycles, so the OECD does not "
        "compare its trends and only 2025 is shown",
    ), None, None)],
    "GTM": [((CBA + "；" + PFD, CBA_EN + ". " + PFD_EN), None, None)],
    "PRY": [((CBA + "；" + PFD, CBA_EN + ". " + PFD_EN), None, None)],
    "KHM": [((PFD, PFD_EN), None, None)],
    "ECU": [((PFD, PFD_EN), None, None)],
    "ZMB": [((PFD, PFD_EN), None, None)],
    "AZE": [((
        "2006、2009、2025 年是全國；2018、2022 年只有首都巴庫參加，OECD 2025 年的報告沒有收",
        "National results in 2006, 2009 and 2025; only the capital, Baku, took part in 2018 and 2022, which is not "
        "in the OECD's 2025 report",
    ), None, None)],
    "AUT": [((NOT_IN_TREND.format(year=" 2009 "), NOT_IN_TREND_EN.format(year="2009")), None, None)],
    "ARG": [((NOT_IN_TREND.format(year=" 2015 "), NOT_IN_TREND_EN.format(year="2015")), None, None)],
    "KAZ": [((NOT_IN_TREND.format(year=" 2015 "), NOT_IN_TREND_EN.format(year="2015")), None, None)],
    "MYS": [((NOT_IN_TREND.format(year=" 2015 "), NOT_IN_TREND_EN.format(year="2015")), None, None)],
    "ESP": [((NOT_IN_TREND.format(year=" 2018 "), NOT_IN_TREND_EN.format(year="2018")), None, None)],
    "LUX": [((NOT_IN_TREND.format(year=" 2022 "), NOT_IN_TREND_EN.format(year="2022")), None, None)],
}
for iso in ("CRI", "GEO", "MYS", "MLT", "MUS", "MDA", "ARE"):
    NOTES.setdefault(iso, []).append(((PLUS_2009, PLUS_2009_EN), None, {"mean", "low", "top", "change"}))
for iso, year in (*((i, 2001) for i in ("ALB", "ARG", "BGR", "CHL", "IDN", "MKD", "PER", "THA")),
                  *((i, 2002) for i in ("HKG", "ISR", "ROU"))):
    NOTES.setdefault(iso, []).append((
        (f"閱讀 2000 年的數字是 {year} 年施測的（PISA 2000+）", f"Reading figures under 2000 come from PISA 2000+, conducted in {year}"),
        {"reading"}, {"mean", "low", "top", "change"},
    ))
NOTES["USA"].append((
    (NOT_IN_TREND.format(year=" 2006 "), NOT_IN_TREND_EN.format(year="2006")), {"reading"}, {"mean", "low", "top", "change"},
))


def notes_for(domain: str, kind: str, codes: set[str]) -> tuple[dict[str, str], dict[str, str]]:
    zh: dict[str, str] = {}
    en: dict[str, str] = {}
    for code, items in NOTES.items():
        if code not in codes:
            continue
        texts = [t for t, domains, kinds in items if (domains is None or domain in domains) and (kinds is None or kind in kinds)]
        if texts:
            zh[code] = "；".join(t[0] for t in texts)
            en[code] = ". ".join(t[1] for t in texts)
    return zh, en


def diff(s: dict[int, float], pairs: list[tuple[int, int]]) -> dict[int, float]:
    """{後一年: 後一年 − 前一年}，兩年都有值才算"""
    return {y: s[y] - s[p] for y, p in pairs if y in s and p in s}


def write(out, kind: str, domain: str, unit: str, years: list[int], countries: Series, groups: Series, digits: int) -> None:
    values = {c: to_series(s, years, digits) for c, s in countries.items()}
    values = {c: v for c, v in values.items() if any(x is not None for x in v)}
    zh, en = notes_for(domain, kind, set(values))
    aggregates = {k: to_series(groups.get(k, {}), years, digits) for k in ("OECD23", "OECD")}
    write_json(
        out / kind / f"{domain}.json",
        indicator_file(
            f"{kind}-{domain}", unit, years, values,
            aggregates={k: v for k, v in aggregates.items() if any(x is not None for x in v)},
            notes=zh, notesEn=en,
        ),
        quiet=True,
    )
    last = years[-1]
    latest = sorted(((s[last], c) for c, s in countries.items() if last in s), reverse=True)
    tw = next((i + 1 for i, (_, c) in enumerate(latest) if c == "TWN"), None)
    print(
        f"  {kind}/{domain}：{years[0]}–{last}，{len(values)} 個（{last} 年 {len(latest)} 個）；"
        f"最高 {', '.join(f'{c} {v:.1f}' for v, c in latest[:3])}；最低 {', '.join(f'{c} {v:.1f}' for v, c in latest[-2:])}；"
        f"臺灣 {countries.get('TWN', {}).get(last, float('nan')):.1f}（第 {tw}）；OECD-23 {groups.get('OECD23', {}).get(last, float('nan')):.1f}"
    )


def rank_of(countries: Series, code: str, year: int) -> int | None:
    if year not in countries.get(code, {}):
        return None
    v = countries[code][year]
    return 1 + sum(1 for s in countries.values() if s.get(year, float("-inf")) > v)


def build() -> None:
    out = OUT_DIR / "topics" / "pisa"
    taiwan: dict[str, object] = {"source": TW_SOURCE, "participants": TW_PARTICIPANTS, "domains": {}}
    for domain in oecd_pisa.DOMAINS:
        mean, mean_g, oecd_diff = oecd_pisa.means(domain)
        low, low_g, top, top_g = oecd_pisa.levels(domain)
        gap, gap_g = oecd_pisa.gender_gap(domain)
        years = sorted({y for s in mean.values() for y in s})

        # OECD 公布的「2025 年減某一年」要跟平均分數相減的結果一樣（四捨五入的誤差以內）
        for code, s in oecd_diff.items():
            for y, v in s.items():
                if abs((mean[code][2025] - mean[code][y]) - v) > 0.05:
                    raise RuntimeError(f"{domain} {code} 2025 − {y} 的差跟 OECD 的表不一樣")

        trend = {c: s for c, s in mean.items() if c not in NO_TREND}
        previous = list(zip(years[1:], years[:-1]))
        since = [(y, BASE_YEAR) for y in years if y > BASE_YEAR]
        change = {c: d for c, s in trend.items() if (d := diff(s, previous))}
        change_g = {k: diff(s, previous) for k, s in mean_g.items()}
        change_base = {c: d for c, s in trend.items() if (d := diff(s, since))}
        change_base_g = {k: diff(s, since) for k, s in mean_g.items()}
        gender_years = [y for y in years if y >= GENDER_FROM]

        write(out, "mean", domain, "分", years, mean, mean_g, 2)
        write(out, "low", domain, "%", years, low, low_g, 1)
        write(out, "top", domain, "%", years, top, top_g, 1)
        write(out, "change", domain, "分", years[1:], change, change_g, 2)
        write(out, "change-2012", domain, "分", [y for y, _ in since], change_base, change_base_g, 2)
        write(out, "gender", domain, "分", gender_years, gap, gap_g, 2)

        # 臺灣：跟臺灣 PISA 國家研究中心公布的分數比對；名次放進 taiwan.json 給側欄對照
        tw = mean["TWN"]
        wrong = {y: (round(tw.get(y, -1)), v) for y, v in TW_SCORES[domain].items() if round(tw.get(y, -1)) != v}
        if wrong:
            raise RuntimeError(f"臺灣的{DOMAIN_ZH[domain]}分數跟臺灣 PISA 國家研究中心公布的不一樣：{wrong}")
        lo, hi = TW_LEVELS_2025[domain]
        if abs(low["TWN"][2025] - lo) > 0.05 or abs(top["TWN"][2025] - hi) > 0.05:
            raise RuntimeError(f"臺灣 2025 年{DOMAIN_ZH[domain]}的低／高成就比例跟國家研究中心公布的不一樣")
        ours = {y: rank_of(mean, "TWN", y) for y in TW_RANKS[domain]}
        print(f"  臺灣的{DOMAIN_ZH[domain]}名次（這裡／官方）：" + "、".join(
            f"{y} {ours[y]}/{r}" for y, r in TW_RANKS[domain].items()))
        taiwan["domains"][domain] = {"ranks": TW_RANKS[domain], "scores": TW_SCORES[domain]}  # type: ignore[index]

    write_json(out / "taiwan.json", taiwan)
    write_json(
        out / "manifest.json",
        {
            "topic": "pisa",
            "generatedAt": now_iso(),
            "source": "OECD (2026), PISA 2025 Results (Volume I): Future-Ready Students, https://doi.org/10.1787/73451bc5-en "
            "(Annex B1, StatLinks https://stat.link/mrq53f and https://stat.link/68stqn), CC BY 4.0; "
            "臺灣 PISA 國家研究中心 2026-09-08 記者會簡報（臺灣的名次）",
        },
    )
