"""能源政策（2026-10-31，製作手冊第十批 167）：各國的核能政策、燃煤發電的退場年份、是否加入棄用煤炭發電聯盟。

- 核能政策（使用者決定分七類，逐國核對、寫明日期）：
  - 自動的部分用 GEM 全球電廠追蹤（GIPT，2026 年 9 月版，CC BY 4.0）的核電機組狀態：有運轉中又有興建中 → 擴建中；
    只有運轉中 → 維持；只有興建中 → 新建第一座；只有籌備或宣布 → 規劃中。
  - 政策（逐步廢核、已廢核、法律禁止）手工整理英文維基「Nuclear power phase-out」（revid 1381033908，2026-10-19）與
    「Nuclear energy policy by country」（revid 1381945093，2026-10-25）的表與各國段落（CC BY-SA 4.0）。表格掛
    「Disputed section」，很多列過時（例如比利時 2025 年已廢止廢核法、塞爾維亞 2024 年已廢止核電禁令、台灣 2026 年
    宣布重啟），以條目內文較新的段落與官方資料為準，寫在 POLICY 的附註。烏拉圭的禁令對照 IMPO 法規資料庫的法條原文。
  - 台灣歸「已廢核」（使用者決定），附註寫 2025 年核三停機、公投未過門檻、2026 年宣布重啟與核安會的審查進度。
- 燃煤發電的退場年份：英文維基「Coal phase-out」的「Coal phase-out by country」表（revid 1377174595，2026-09-28，
  37 國，年份引 Ember 的 OECD 分析，CC BY 4.0），加上同一條目越南一節（COP26 承諾 2040 年代）。表裡「not yet committed」
  的國家是「沒有承諾」（0）；表裡沒有的國家沒有值（地圖寫「沒有資料」），使用者決定分成這兩類。台灣照國發會的
  淨零路徑寫附註（沒有退場年份，算沒有承諾）。
- 棄用煤炭發電聯盟（PPCA）：pipeline/data/energy-policy/ppca.json，2026-10-31 讀聯盟網站的國家會員與加入年份；網站沒有
  資料授權，只用會籍這個事實。不是會員的國家是 0。

輸出 public/data/topics/energy-policy/：nuclear-policy.json、coal-phaseout.json、ppca.json（都是一年 2026）。
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

from common import OUT_DIR, download, indicator_file, now_iso, write_json
from sources import gem
from sources.countries import from_name
from topics.power_plants import COUNTRY_ALIASES

OUT = OUT_DIR / "topics" / "energy-policy"
DATA = Path(__file__).resolve().parent.parent / "data" / "energy-policy"
YEAR = 2026
COAL_URL = "https://en.wikipedia.org/w/index.php?title=Coal_phase-out&action=raw&oldid=1377174595"

# 核能政策的代碼（前端 src/topics/energy-policy.ts 的 NUCLEAR）
EXPANDING, KEEPING, FIRST, PLANNING, PHASING_OUT, PHASED_OUT, BANNED, NONE = 1, 2, 3, 4, 5, 6, 7, 0
POLICY_TEXT = {
    EXPANDING: ("擴建中", "Expanding"), KEEPING: ("維持", "Maintaining"), FIRST: ("新建第一座", "Building its first"),
    PLANNING: ("規劃中", "Planning"), PHASING_OUT: ("逐步廢核", "Phasing out"), PHASED_OUT: ("已廢核", "Phased out"),
    BANNED: ("法律禁止", "Banned by law"), NONE: ("沒有核電", "No nuclear power"),
}

# 政策（GEM 的狀態判斷不出來的）與附註：iso3 → (類別或 None〔照 GEM〕, 中文, 英文)
POLICY: dict[str, tuple[int | None, str, str]] = {
    "DEU": (PHASED_OUT, "2011 年福島事故後決定廢核，最後 3 部機組 2023-04-15 停機（原訂 2022 年底）。",
            "Decided to phase out nuclear power after Fukushima in 2011; the last three units shut down on 15 April 2023 "
            "(originally planned for the end of 2022)."),
    "ITA": (PHASED_OUT, "1987 年公投後關閉 4 座核電廠，最後一座 1990 年停機，2011 年公投再否決重建。2025 年 2 月政府通過重新開放核電的"
                        "法案，2026 年 9 月國會通過（維基，2026-10-19 版）。",
            "Closed its four nuclear plants after a 1987 referendum, the last in 1990; a 2011 referendum rejected a revival. "
            "The government approved a bill to lift the ban on new nuclear power in February 2025, which Parliament passed "
            "in September 2026 (Wikipedia, 19 October 2026 revision)."),
    "LTU": (PHASED_OUT, "加入歐盟的條件：跟車諾比同型的伊格納利納核電廠 2009-12-31 關閉。",
            "As a condition of joining the EU, the Ignalina plant (the same design as Chernobyl) closed on 31 December 2009."),
    "ESP": (PHASING_OUT, "2023 年 12 月政府確認 2027–2035 年依序關閉 7 部機組；2025 年 4 月表示會考慮業者延長運轉的申請。",
            "In December 2023 the government confirmed closing its seven reactors between 2027 and 2035; in April 2025 it "
            "said it would consider operators' requests to extend them."),
    "CHE": (PHASING_OUT, "2011 年決定不延長運轉、不建新廠，2017 年起法律禁止新建核電廠。2026-06-18 國會通過取消禁令，"
                         "2026 年 9 月反對者連署成功，要交付公投；公投前禁令仍有效。",
            "Decided in 2011 not to extend reactor lifetimes or build new ones; new nuclear plants have been banned by law "
            "since 2017. Parliament voted to lift the ban on 18 June 2026, but opponents forced a referendum in September "
            "2026, and the ban stays until the vote."),
    "AUT": (BANNED, "1978 年公投否決啟用已蓋好的茨文滕多夫核電廠，同年立法禁止核電；1999 年再以憲法層級的法律禁止。",
            "A 1978 referendum stopped the finished Zwentendorf plant from starting up, and a law banned nuclear power the "
            "same year; a constitutional law reaffirmed the ban in 1999."),
    "AUS": (BANNED, "聯邦法律（1998 年的輻射防護與核子安全法、1999 年的環境保護與生物多樣性保育法）禁止興建核電廠。",
            "Federal law (the 1998 radiation protection and nuclear safety act and the 1999 environment protection and "
            "biodiversity conservation act) prohibits nuclear power plants."),
    "DNK": (BANNED, "1985 年國會決議禁止興建核電廠（是國會決議，不是法律）；2025 年政府開始評估取消。",
            "A 1985 parliamentary resolution bans building nuclear power plants (a resolution rather than a law); in 2025 "
            "the government began considering lifting it."),
    "IRL": (BANNED, "1999 年的電力管制法禁止核能發電。", "The 1999 Electricity Regulation Act prohibits nuclear power generation."),
    "URY": (BANNED, "1997 年第 16.832 號法律第 27 條禁止在國內使用核能（IMPO 法規資料庫的現行條文）。",
            "Article 27 of Law 16.832 (1997) prohibits the use of nuclear energy in the country (current text in the IMPO "
            "legal database)."),
    "SRB": (NONE, "1989 年起法律禁止核電，2024 年 11 月廢止。",
            "Nuclear power was banned by law from 1989 until the law was repealed in November 2024."),
    "PRK": (NONE, "寧邊的 5 MW 反應爐主要生產核武用的鈽，不算商用核電（GEM 列為運轉中）。",
            "The 5 MW reactor at Yongbyon mainly produces plutonium for weapons and is not counted as commercial nuclear "
            "power (GEM lists it as operating)."),
    "PAN": (NONE, "1968–1976 年巴拿馬運河區有一艘美國陸軍的核電船（GEM 列為退役）。",
            "A US Army floating nuclear plant served the Panama Canal Zone from 1968 to 1976 (retired in GEM)."),
    "PRI": (NONE, "1960 年代有一座示範用的反應爐（GEM 列為退役）。",
            "Had a demonstration reactor in the 1960s (retired in GEM)."),
    "HRV": (NONE, "跟斯洛維尼亞共有克爾什科核電廠（在斯洛維尼亞）。",
            "Co-owns the Krško nuclear plant with Slovenia (located in Slovenia)."),
    "NZL": (NONE, "1987 年的無核區法禁止核武與核動力船，沒有禁止核電。",
            "The 1987 nuclear-free zone act bans nuclear weapons and nuclear-powered ships, not nuclear power."),
    "BEL": (None, "2003 年的廢核法 2025-05-17 廢止，不再廢核。",
            "The 2003 phase-out law was repealed on 17 May 2025, ending the phase-out."),
    "KOR": (None, "文在寅政府 2017 年的廢核政策 2022 年取消。",
            "The phase-out policy adopted by the Moon Jae-in government in 2017 was reversed in 2022."),
    "SWE": (None, "1980 年公投後的廢核政策 2009 年結束，2023 年政府宣布要蓋新的反應爐。",
            "The phase-out policy that followed a 1980 referendum ended in 2009; in 2023 the government announced plans "
            "for new reactors."),
    "NLD": (None, "1994 年國會決議廢核，2005 年推翻；計畫新建 2 部機組。",
            "Parliament voted for a phase-out in 1994 and reversed it in 2005; two new units are planned."),
    "JPN": (None, "2011 年福島事故後一度全部停機，2023 年內閣核准新建與延長運轉到 60 年。GEM 的興建中有大間、島根 3 號機，"
                  "也有柏崎刈羽 7 號、東海第二、泊 3 號這些停機後的安全工程。",
            "All reactors were shut down after Fukushima in 2011; in 2023 the cabinet approved new reactors and extending "
            "operation to 60 years. GEM's units under construction include Ohma and Shimane 3, as well as safety upgrades "
            "at idle units such as Kashiwazaki-Kariwa 7, Tokai 2 and Tomari 3."),
    "USA": (None, "GEM 的興建中是帕利塞茲重新運轉、凱默勒（Natrium）、Hermes 測試爐與 Pele 軍用微型反應爐。",
            "GEM's units under construction are the Palisades restart, Kemmerer (Natrium), the Hermes test reactor and "
            "the Project Pele military microreactor."),
    "UKR": (None, "札波羅熱核電廠 6 部 2022 年起被俄軍占領、停機（GEM 仍列運轉中）；赫梅利尼茨基 3、4 號機 GEM 列為擱置。",
            "Zaporizhzhia's six units have been occupied by Russia and shut down since 2022 (still operating in GEM); "
            "GEM lists Khmelnytskyi 3 and 4 as shelved."),
    "KAZ": (None, "1999 年關閉阿克套唯一的核電廠（BN-350）；2024 年公投同意興建，2026 年政府核准至少 3 座新廠（維基）。",
            "Closed its only plant (BN-350 at Aktau) in 1999; a 2024 referendum backed new construction, and in 2026 the "
            "government approved at least three new plants (Wikipedia)."),
    "PHL": (None, "巴丹核電廠 1984 年蓋好但沒有運轉；2024 年請韓國水力原子力評估重新啟用。",
            "The Bataan plant was finished in 1984 but never operated; in 2024 Korea Hydro & Nuclear Power was engaged to "
            "study bringing it into service."),
    "VNM": (None, "2016 年放棄寧順核電計畫，2024 年 11 月國會核准恢復。",
            "Abandoned the Ninh Thuan nuclear project in 2016; the National Assembly approved reviving it in November 2024."),
    "HKG": (None, "從廣東的大亞灣核電廠買電。", "Buys electricity from the Daya Bay nuclear plant in Guangdong."),
}
TAIWAN_NUCLEAR = (
    "台灣 2025-05-17 核三廠 2 號機停機後沒有運轉中的核電機組（核一 2019、核二 2023 年停機），歸「已廢核」。2025-08-23 核三"
    "重新運轉的公投，同意票占有效票 74.2%，但只有選舉人的 21.7%，未達 25% 門檻不通過。2026 年 3 月賴清德總統宣布重啟核三、"
    "核二，台電 3 月 27 日向核安會提出核三再運轉計畫（目標 2028 年，核二 2029 年）；核安會 2026-08-31 表示審查總結會議後"
    "台電已繳交修訂版，計畫核定後還要完成自主安全檢查、換發運轉執照。2026-11-28 另有「廢除非核家園」的全國性公投（第 22 案）。",
    "Taiwan has had no operating nuclear units since Maanshan unit 2 shut down on 17 May 2025 (Jinshan closed in 2019 and "
    "Kuosheng in 2023), so it is classed as phased out. A referendum on 23 August 2025 to restart Maanshan won 74.2% of "
    "valid votes, but the yes votes were only 21.7% of eligible voters, short of the 25% threshold. In March 2026 "
    "President Lai Ching-te announced plans to restart Maanshan and Kuosheng; Taipower submitted a restart plan for "
    "Maanshan to the Nuclear Safety Commission on 27 March (aiming for 2028, and 2029 for Kuosheng). On 31 August 2026 "
    "the commission said Taipower had filed a revised plan after the final review meeting; once approved, the plant "
    "still needs its own safety inspections and a renewed operating licence. A national referendum on abolishing the "
    "nuclear-free homeland policy (Case 22) is set for 28 November 2026.",
)

# 燃煤：表的國名 → ISO；表以外的國家（條目的其他段落）
COAL_NAMES = {"Turkey": "TUR", "South Korea": "KOR", "Czech Republic": "CZE"}
COAL_EXTRA = {"VNM": 2040}
COAL_HINTS = {
    "BEL": ("2009 年政府否決新建燃煤電廠，最後一座（Langerlo）2016 年 3 月停燒", "The last plant, Langerlo, burned its last coal in March 2016"),
    "BGR": ("計畫 2038 年關閉，但一般認為市場會讓它更早關", "Closure planned for 2038, though market forces are expected to bring it forward"),
    "FIN": ("最後一座大型燃煤電廠 2025 年退役；兩座生質與燃煤混燒的電廠還燒最多 30% 的煤", "The last major coal plant retired in 2025; two biomass plants still co-fire up to 30% coal"),
    "ITA": ("2025 年本土停用燃煤，只剩薩丁尼亞，預計 2038 年", "Coal-free on the mainland since 2025 except Sardinia, expected by 2038"),
    "ESP": ("2025 年本土最後一座燃煤電廠停機，只剩馬約卡島的 Es Murterar", "The last mainland plant closed in 2025; only Es Murterar on Mallorca remains"),
    "DEU": ("法律定的最晚年份", "The latest date set by law"),
    "USA": ("2035 年是拜登政府「2035 年電力無碳」的目標（Ember 引用）；2025 年上任的川普政府改為支持燃煤電廠繼續運轉",
            "2035 is the Biden administration's goal of a carbon-free power sector (as cited by Ember); the Trump administration "
            "that took office in 2025 instead backs keeping coal plants running"),
    "VNM": ("2021 年 COP26 承諾 2040 年代或稍後停用沒有減排設備的燃煤發電（條目的越南一節）",
            "Pledged at COP26 in 2021 to phase out unabated coal power in the 2040s or soon after (the article's Vietnam section)"),
}
TAIWAN_COAL = (
    "台灣沒有燃煤發電退場的年份，算「沒有承諾」。國發會《臺灣2050淨零排放路徑及策略總說明》（2022-03-30）：短期不再興建新的燃煤"
    "電廠（第 9 頁）；燃煤機組短期混燒氨，長期提高混燒率或搭配碳捕捉，並視低碳能源的供給，基於國家安全把未屆齡的燃煤機組"
    "轉為備用（第 15 頁）；2050 年的藍圖仍有 20–27% 搭配碳捕捉的火力發電（第 8 頁）。",
    "Taiwan has no coal phase-out date and is counted as not committed. The National Development Council's 2050 net-zero "
    "pathway (30 March 2022) says no new coal plants will be built in the short term (p. 9); coal units will co-fire "
    "ammonia in the short term, raise co-firing or add carbon capture in the long term, and, as low-carbon supply grows, "
    "units not yet at retirement age will be moved to reserve for national security reasons (p. 15). The 2050 blueprint "
    "still has 20–27% of power from fossil plants with carbon capture (p. 8).",
)


def nuclear() -> tuple[dict[str, int], dict, dict, dict, dict]:
    counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for u in gem.units():
        if u.fuel != "nuclear":
            continue
        iso3 = COUNTRY_ALIASES.get(u.country) or from_name(u.country)
        if not iso3:
            raise RuntimeError(f"GEM 的國名對不到 ISO：{u.country}")
        counts[iso3][u.status] += 1
    policy: dict[str, int] = {}
    hints: dict[str, str] = {}
    hints_en: dict[str, str] = {}
    for iso3, c in counts.items():
        op, con = c["operating"], c["construction"]
        plan = c["pre-construction"] + c["announced"]
        if op and con:
            cat = EXPANDING
        elif op:
            cat = KEEPING
        elif con:
            cat = FIRST
        elif plan:
            cat = PLANNING
        elif c["retired"] and iso3 != "TWN" and (iso3 not in POLICY or POLICY[iso3][0] is None):
            raise RuntimeError(f"{iso3} 在 GEM 只有退役的機組，要在 POLICY 寫它是哪一類")
        else:
            cat = NONE  # 只有取消的計畫（例如古巴、約旦），或 POLICY 另外寫了
        policy[iso3] = cat
        parts = [(op, "運轉中", "operating"), (con, "興建中", "under construction"), (plan, "籌備或宣布", "proposed"),
                 (c["retired"], "退役", "retired")]
        hints[iso3] = "GEM：" + "、".join(f"{zh} {n} 部" for n, zh, _ in parts if n)
        hints_en[iso3] = "GEM: " + ", ".join(f"{n} {en}" for n, _, en in parts if n)
    notes: dict[str, str] = {}
    notes_en: dict[str, str] = {}
    for iso3, (cat, zh, en) in POLICY.items():
        if cat is not None:
            policy[iso3] = cat
        elif iso3 not in policy:
            policy[iso3] = NONE
        notes[iso3], notes_en[iso3] = zh, en
    policy["TWN"] = PHASED_OUT
    notes["TWN"], notes_en["TWN"] = TAIWAN_NUCLEAR
    return policy, hints, hints_en, notes, notes_en


def coal() -> dict[str, tuple[int, bool]]:
    """iso3 → (年份或 0〔沒有承諾〕, 是否已完成)"""
    raw = download(COAL_URL, "wikipedia", "coal-phase-out-1377174595.txt").read_text(encoding="utf-8")
    start = raw.index("==Coal phase-out by country==")
    table = raw[raw.index("{|", start):raw.index("\n|}", start)]
    out: dict[str, tuple[int, bool]] = {}
    for row in table.split("\n|-")[1:]:
        flag = re.search(r"\{\{flag\|([^}|]+)", row)
        if not flag:
            continue
        name = flag.group(1).strip()
        iso3 = COAL_NAMES.get(name) or from_name(name)
        if not iso3:
            raise RuntimeError(f"燃煤退場的表：對不到國家「{name}」")
        if re.search(r"\{\{no\|not yet committed\}\}", row):
            out[iso3] = (0, False)
            continue
        m = re.search(r"\{\{(good|not yet)\|(\d{4})\}\}", row)
        if not m:
            raise RuntimeError(f"燃煤退場的表：看不懂「{name}」的年份")
        out[iso3] = (int(m.group(2)), m.group(1) == "good")
    if len(out) != 37:
        raise RuntimeError(f"燃煤退場的表讀到 {len(out)} 國（2026-09-28 版是 37 國），條目的版面可能變了")
    for iso3, y in COAL_EXTRA.items():
        out[iso3] = (y, False)
    out["TWN"] = (0, False)
    return out


def build() -> None:
    countries = json.loads((OUT_DIR / "topics" / "profiles" / "government.json").read_text(encoding="utf-8"))["values"]

    policy, hints, hints_en, notes, notes_en = nuclear()
    values = {c: [policy.get(c, NONE)] for c in sorted(set(countries) | set(policy))}
    write_json(OUT / "nuclear-policy.json", indicator_file(
        "nuclear-policy", "", [YEAR], values, hints=hints, hintsEn=hints_en, notes=notes, notesEn=notes_en))
    by: dict[int, list[str]] = defaultdict(list)
    for c, v in values.items():
        by[v[0]].append(c)
    print("  核能政策：" + "；".join(f"{POLICY_TEXT[k][0]} {len(v)}" for k, v in sorted(by.items())))
    for k in (FIRST, PHASING_OUT, PHASED_OUT, BANNED):
        print(f"    {POLICY_TEXT[k][0]}：{'、'.join(sorted(by[k]))}")

    table = coal()
    coal_hints = {c: h[0] for c, h in COAL_HINTS.items()}
    coal_hints_en = {c: h[1] for c, h in COAL_HINTS.items()}
    write_json(OUT / "coal-phaseout.json", indicator_file(
        "coal-phaseout", "", [YEAR], {c: [y] for c, (y, _done) in sorted(table.items())},
        hints=coal_hints, hintsEn=coal_hints_en, notes={"TWN": TAIWAN_COAL[0]}, notesEn={"TWN": TAIWAN_COAL[1]},
        noValue={"TWN": "沒有退場年份（見附註）"}, noValueEn={"TWN": "No phase-out date (see note)"}))
    done = sorted(c for c, (_y, d) in table.items() if d)
    if any(y > 2025 for c, (y, _d) in table.items() if c in done):
        raise RuntimeError("已完成的國家年份超過 2025")
    print(f"  燃煤退場：{len(table)} 國（已完成 {len(done)}、沒有承諾 {sum(1 for y, _ in table.values() if y == 0)}）")

    ppca = json.loads((DATA / "ppca.json").read_text(encoding="utf-8"))
    members: dict[str, int] = {}
    for m in ppca["members"]:
        iso3 = {"Republic of Korea": "KOR", "Kosovo": "XKX"}.get(m["name"]) or from_name(m["name"])
        if not iso3:
            raise RuntimeError(f"PPCA：對不到國家「{m['name']}」")
        members[iso3] = m["joined"] or 1
    ppca_values = {c: [members.get(c, 0)] for c in sorted(set(countries) | set(members))}
    write_json(OUT / "ppca.json", indicator_file("ppca", "", [YEAR], ppca_values))
    print(f"  棄用煤炭發電聯盟：國家會員 {len(members)}（沒有寫加入年份的 {sum(1 for v in members.values() if v == 1)}）")
    write_json(OUT / "manifest.json", {"topic": "energy-policy", "generatedAt": now_iso()})
