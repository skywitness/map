"""開發者與開源主題：GitHub Innovation Graph（CC0 1.0）的各經濟體開發者、推送、跨國協作。

資料（sources/innovation_graph.py）：2020 年第 1 季起每季一筆。這裡**每年只取第 1 季**（1–3 月；人數、專案數是
3 月底的帳號數），跟網路速度主題每年取第 3 季一樣：同一個季節年年可比，最新的一季（2026 年第 1 季）也在裡面。
側欄另外有每一季的開發者、組織、公開版本庫與推送次數。

人均用 UN WPP 2024 的年中人口（2024 年起是中推估）。

輸出（public/data/topics/developers/）：
- per-1000.json（每千人的開發者，預設）、developers.json（開發者人數）、growth.json（比前一年第 1 季的增加率）、
  pushes-per-developer.json（每個開發者帳號一季的 git 推送次數）
- collab-out.json、collab-in.json（跨經濟體協作的總量，兩個方向）與 flows/<年>.json（流向，每個經濟體前 15 名）
- countries/<ISO3>.json（側欄：每季的人數與推送、最多人用的程式語言與授權條款）、world.json、manifest.json
"""
from __future__ import annotations

import re
from collections import defaultdict

from common import OUT_DIR, ROOT, indicator_file, now_iso, write_json
from sources import innovation_graph as ig
from sources import wpp

OUT = OUT_DIR / "topics" / "developers"
QUARTER = 1  # 每年取第 1 季
TOP_N = 15  # 流向檔每個經濟體存的夥伴數
LANG_SHOWN = 10  # 側欄列出的程式語言數
LICENSE_SHOWN = 8  # 側欄列出的授權條款數
# 開發者不到這麼多的經濟體不算增加率（看前一年第 1 季）與每個帳號的推送次數：從 100 多人變 200 人就是倍增，
# 每個帳號的推送次數也是小地方排在最前面（奧蘭群島 3.8 次）
MIN_DEVELOPERS = 1000
MIN_POPULATION = 1_000  # 人口不到這個數不算人均（梵蒂岡約 500 人、180 個帳號，IP 定位到那裡的帳號多半不住在當地）
SUSPECT_PER_1000 = 150  # 每千人超過這麼多開發者的地方要有說明（VPN、代理），不然 pipeline 報錯
# 開發者數相對人口明顯偏高或偏低、要在附註與 tooltip 說明的地方
FLAGGED = {
    "CHN": (
        "很多開發者用 Gitee 等中國的平台，連 GitHub 也常要經由 VPN（會被算到香港、新加坡、美國等地），明顯低估",
        "Many developers use Chinese platforms such as Gitee, and reaching GitHub often takes a VPN (which places them in Hong Kong, Singapore, the US and elsewhere), so this is a clear undercount",
    ),
    "HKG": (
        "帳號數接近人口的一半，可能有很多是經由香港的 VPN、代理或雲端主機連線的中國大陸開發者，明顯偏高",
        "Accounts approach half the population; many may be mainland Chinese developers connecting through Hong Kong VPNs, proxies or cloud servers, so this is clearly too high",
    ),
    "SGP": (
        "帳號數超過人口的三分之一，可能有不少是經由新加坡的 VPN、代理或雲端主機連線的帳號，明顯偏高",
        "Accounts exceed a third of the population; many may connect through Singapore VPNs, proxies or cloud servers, so this is clearly too high",
    ),
    "SYC": (
        "帳號數相對人口特別多，可能有不少是 VPN 或代理伺服器的連線，明顯偏高",
        "Unusually many accounts for the population; many may be VPN or proxy connections, so this is clearly too high",
    ),
}
# 授權條款的 NOASSERTION：找到授權檔但認不出來，或有好幾種授權（datasheet 第 6 點第 6 項）
NOASSERTION = "NOASSERTION"


def check_topic() -> None:
    """主題設定（src/topics/developers.ts）裡寫的門檻要跟這裡一樣"""
    text = (ROOT / "src" / "topics" / "developers.ts").read_text(encoding="utf-8")
    for name, value in (("MIN_DEVELOPERS", MIN_DEVELOPERS), ("QUARTER", QUARTER)):
        found = re.search(rf"export const {name} = ([\d_]+);", text)
        if not found or int(found.group(1).replace("_", "")) != value:
            raise ValueError(f"src/topics/developers.ts 的 {name} 跟 pipeline 的 {value} 不同")


def build() -> None:
    check_topic()
    devs = ig.metric("developers")
    orgs = ig.metric("organizations")
    repos = ig.metric("repositories")
    pushes = ig.metric("git_pushes")
    quarters = sorted({q for s in devs.values() for q in s})
    years = sorted({y for y, q in quarters if q == QUARTER})
    first, last = quarters[0], quarters[-1]
    if last[1] != QUARTER:
        print(f"  注意：最新的一季是 {last[0]} 年第 {last[1]} 季，地圖只到 {years[-1]} 年第 {QUARTER} 季（側欄的每季資料到最新）")
    print(f"  {first[0]} 年第 {first[1]} 季到 {last[0]} 年第 {last[1]} 季，{len(devs)} 個經濟體；地圖用 {years[0]}–{years[-1]} 年第 {QUARTER} 季")

    population = wpp.demographic(["TPopulation1July"], last_year=years[-1])["TPopulation1July"]  # 千人

    def at(series: dict[tuple[int, int], int] | None, year: int) -> int | None:
        return (series or {}).get((year, QUARTER))

    def world(metric: dict[str, dict[tuple[int, int], int]], year: int) -> int:
        return sum(s.get((year, QUARTER), 0) for s in metric.values())

    notes: dict[str, str] = {}
    notes_en: dict[str, str] = {}
    hints: dict[str, str] = {}
    hints_en: dict[str, str] = {}
    for c, (zh, en) in FLAGGED.items():
        hints[c], hints_en[c] = zh + "。", en + "."
        notes[c], notes_en[c] = zh + "（所在地依 IP 位址判斷）。", en + " (location is inferred from IP addresses)."
    _profile_notes(pushes, notes, notes_en)

    # ── 每千人的開發者 ──
    per_1000: dict[str, list[float | None]] = {}
    no_population: list[str] = []
    too_small: list[str] = []
    for c, s in devs.items():
        pop = population.get(c)
        if not pop:
            no_population.append(c)
            continue
        if min(pop.get(y, 0) for y in years) * 1000 < MIN_POPULATION:
            too_small.append(c)
            continue
        row = [round(at(s, y) / (pop[y] * 1000) * 1000, 3) if at(s, y) is not None else None for y in years]
        if any(v is not None for v in row):
            per_1000[c] = row
    if too_small != ["VAT"]:
        # src/topics/developers.ts 的 noValue 只寫了梵蒂岡
        raise ValueError(f"人口不到 {MIN_POPULATION:,} 的經濟體變了：{too_small}，記得改主題設定的 noValue")
    suspects = sorted(c for c, row in per_1000.items() if (row[-1] or 0) > SUSPECT_PER_1000 and c not in FLAGGED)
    if suspects:
        raise ValueError(f"每千人超過 {SUSPECT_PER_1000} 個開發者、沒有說明的地方：{suspects}（加進 FLAGGED）")
    print(f"  沒有 WPP 人口、不算人均：{sorted(no_population)}")
    world_pop = population["WLD"]
    per_1000_world = [round(world(devs, y) / (world_pop[y] * 1000) * 1000, 3) for y in years]
    _write("per-1000", "‰", years, per_1000, per_1000_world, notes, notes_en, hints, hints_en)

    # ── 開發者人數 ──
    totals = {c: [at(s, y) for y in years] for c, s in devs.items()}
    totals = {c: v for c, v in totals.items() if any(x is not None for x in v)}
    _write("developers", "人", years, totals, [world(devs, y) for y in years], notes, notes_en, hints, hints_en)

    # ── 增加率（比前一年第 1 季） ──
    growth_years = years[1:]
    growth: dict[str, list[float | None]] = {}
    for c, s in devs.items():
        row = []
        for y in growth_years:
            now, before = at(s, y), at(s, y - 1)
            row.append(round((now / before - 1) * 100, 2) if now and before and before >= MIN_DEVELOPERS else None)
        if any(v is not None for v in row):
            growth[c] = row
    growth_world = [round((world(devs, y) / world(devs, y - 1) - 1) * 100, 2) for y in growth_years]
    _write("growth", "%", growth_years, growth, growth_world, notes, notes_en, hints, hints_en)

    # ── 每個開發者帳號的推送次數（一季） ──
    per_dev: dict[str, list[float | None]] = {}
    for c, s in pushes.items():
        row = []
        for y in years:
            p, d = at(s, y), at(devs.get(c), y)
            row.append(round(p / d, 3) if p is not None and d and d >= MIN_DEVELOPERS else None)
        if any(v is not None for v in row):
            per_dev[c] = row
    # 全世界：有推送資料的經濟體合計（推送一季不到 100 人的經濟體不公布，開發者也不算進分母；不管有沒有 1,000 人）
    per_dev_world = []
    for y in years:
        both = [c for c in pushes if at(pushes[c], y) is not None and at(devs.get(c), y)]
        per_dev_world.append(round(sum(at(pushes[c], y) for c in both) / sum(at(devs[c], y) for c in both), 3))
    _write("pushes-per-developer", "次", years, per_dev, per_dev_world, notes, notes_en, hints, hints_en)

    # ── 跨經濟體協作：流向檔與兩個方向的總量 ──
    collab = ig.collaborators()
    out_tot: dict[str, dict[int, int]] = defaultdict(dict)
    in_tot: dict[str, dict[int, int]] = defaultdict(dict)
    world_collab: list[int] = []
    flow_bytes = 0
    for y in years:
        pairs = collab.get((y, QUARTER), {})
        by: dict[str, dict[str, dict[str, int]]] = {"export": defaultdict(dict), "import": defaultdict(dict)}
        for (src, dst), w in pairs.items():
            by["export"][src][dst] = w
            by["import"][dst][src] = w
        data: dict[str, object] = {"item": "collaboration", "year": y, "unit": "次", "scale": 1}
        for direction, countries in by.items():
            entries = {}
            for c, partners in sorted(countries.items()):
                total = sum(partners.values())
                (out_tot if direction == "export" else in_tot)[c][y] = total
                ranked = sorted(partners.items(), key=lambda kv: -kv[1])[:TOP_N]
                entries[c] = [total, [[p, v] for p, v in ranked]]
            data[direction] = entries
        world_collab.append(sum(pairs.values()))
        path = OUT / "flows" / f"{y}.json"
        write_json(path, data, quiet=True)
        flow_bytes += path.stat().st_size
    print(f"  流向檔 {len(years)} 個，共 {flow_bytes / 1024:.0f} KB")
    for name, tot in (("collab-out", out_tot), ("collab-in", in_tot)):
        values = {c: [s.get(y) for y in years] for c, s in tot.items()}
        _write(name, "次", years, values, world_collab, notes, notes_en, hints, hints_en)

    # ── 側欄：每季的數字、程式語言、授權條款 ──
    languages = ig.by_category("languages", "language")
    types = ig.language_types()
    licenses = ig.by_category("licenses", "spdx_license")

    def quarterly(metric: dict[str, dict[tuple[int, int], int]], c: str) -> list[int | None]:
        s = metric.get(c, {})
        return [s.get(q) for q in quarters]

    def top(by_q: dict[tuple[int, int], dict[str, int]], keep, n: int) -> tuple[dict[str, list], dict[str, int]]:
        ranked: dict[str, list] = {}
        total: dict[str, int] = {}
        for y in years:
            items = {k: v for k, v in by_q.get((y, QUARTER), {}).items() if keep(k)}
            if items:
                ranked[str(y)] = [[k, v] for k, v in sorted(items.items(), key=lambda kv: (-kv[1], kv[0]))[:n]]
                total[str(y)] = sum(items.values())
        return ranked, total

    def programming(lang: str) -> bool:
        return types.get(lang) == "programming"

    written = 0
    economies = sorted(set(devs) | set(pushes) | set(languages) | set(licenses))
    for c in economies:
        detail: dict[str, object] = {"first": list(first), "quarter": QUARTER}
        for key, metric in (("developers", devs), ("organizations", orgs), ("repositories", repos), ("pushes", pushes)):
            detail[key] = quarterly(metric, c)
        detail["languages"], detail["languageTotal"] = top(languages.get(c, {}), programming, LANG_SHOWN)
        detail["licenses"], detail["licenseTotal"] = top(licenses.get(c, {}), lambda _k: True, LICENSE_SHOWN)
        write_json(OUT / "countries" / f"{c}.json", detail, quiet=True)
        written += 1
    print(f"  countries/：{written} 個檔")

    # 全世界：各經濟體相加（不到 100 人的經濟體或語言不公布，所以是下限）
    world_lang: dict[tuple[int, int], dict[str, int]] = defaultdict(lambda: defaultdict(int))
    world_lic: dict[tuple[int, int], dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for src, dst in ((languages, world_lang), (licenses, world_lic)):
        for by_q in src.values():
            for q, items in by_q.items():
                for k, v in items.items():
                    dst[q][k] += v
    world_detail: dict[str, object] = {"first": list(first), "quarter": QUARTER}
    for key, metric in (("developers", devs), ("organizations", orgs), ("repositories", repos), ("pushes", pushes)):
        world_detail[key] = [sum(s.get(q, 0) for s in metric.values()) for q in quarters]
    world_detail["languages"], world_detail["languageTotal"] = top(world_lang, programming, LANG_SHOWN)
    world_detail["licenses"], world_detail["licenseTotal"] = top(world_lic, lambda _k: True, LICENSE_SHOWN)
    write_json(OUT / "world.json", world_detail)

    _report(years, devs, pushes, per_1000, growth, per_dev, out_tot, in_tot, collab, languages, licenses, types)
    write_json(
        OUT / "manifest.json",
        {
            "topic": "developers",
            "generatedAt": now_iso(),
            "source": f"GitHub Innovation Graph (data files of {first[0]} Q{first[1]} – {last[0]} Q{last[1]}); "
            "population: UN World Population Prospects 2024",
            "sourceUrl": [ig.REPO_URL, ig.DATASHEET_URL, wpp.URL],
            "license": "CC0 1.0 (GitHub Innovation Graph); CC BY 3.0 IGO (UN WPP 2024)",
            "method": f"Q{QUARTER} of each year. Developers, organizations and repositories are counts at the end of the "
            "quarter; git pushes and collaboration are counts during the quarter. Location is GitHub's IP-based "
            "economy. The EU rows (sums of the 27 member states) are dropped. Per-capita uses mid-year population "
            f"(projections from 2024). Growth (developers a year earlier) and pushes per developer need at least "
            f"{MIN_DEVELOPERS} developers.",
        },
    )


def _profile_notes(pushes: dict[str, dict[tuple[int, int], int]], notes: dict[str, str], notes_en: dict[str, str]) -> None:
    """GitHub 依個人檔案的所在地調整 VPN 後的推送（補充資料，前 29 名與各區域人均前 5 名）寫進附註，跟依 IP 位址的同期推送對照。

    補充資料是 2025 年第 3 季到 2026 年第 2 季，主資料目前只到 2026 年第 1 季，所以依 IP 的只能寫前三季。
    """
    profile = ig.profile_weighted_pushes()
    have = [q for q in ig.PROFILE_QUARTERS if any(q in s for s in pushes.values())]
    if not have or have[0] != ig.PROFILE_QUARTERS[0]:
        raise ValueError("主資料沒有補充資料那幾季的推送，附註的寫法要改")
    full = len(have) == len(ig.PROFILE_QUARTERS)
    last = have[-1]
    lines = []
    ratios: dict[str, float] = {}
    for c, (p, rank) in sorted(profile.items(), key=lambda kv: (kv[1][1] or 999, -kv[1][0])):
        ip = sum(pushes.get(c, {}).get(q, 0) for q in have)
        # 依 IP 的前三季換算成四季，在終端機看哪些地方差最多；主題頁尾寫了中國、香港、新加坡、台灣的倍數，下面檢查
        ratios[c] = p / (ip * len(ig.PROFILE_QUARTERS) / len(have))
        lines.append(f"{c} {ratios[c]:.2f}")
        span_zh = "同期" if full else f"同期的前 {len(have)} 季（到 {last[0]} 年第 {last[1]} 季）"
        span_en = "the same quarters" if full else f"the first {len(have)} of those quarters (to Q{last[1]} {last[0]})"
        rank_zh = f"，全世界第 {rank}" if rank else ""
        rank_en = f", rank {rank} in the world" if rank else ""
        zh = (
            f"GitHub 為 2026 年全球數位合作會議（GDC26）另外依開發者個人檔案填的所在地（用 LLM 判讀）調整 VPN 的影響："
            f"2025 年第 3 季到 2026 年第 2 季的推送 {p:,} 次{rank_zh}；依 IP 位址，{span_zh}是 {ip:,} 次。"
        )
        en = (
            f"For the Global Digital Collaboration Conference 2026 (GDC26), GitHub separately adjusted for VPNs using the "
            f"locations developers give in their profiles (classified with an LLM): {p:,} pushes from Q3 2025 to Q2 2026"
            f"{rank_en}; by IP address, {span_en} had {ip:,}."
        )
        notes[c] = f"{notes[c]}{zh}" if c in notes else zh
        notes_en[c] = f"{notes_en[c]} {en}" if c in notes_en else en
    print(f"  依個人檔案調整後 ÷ 依 IP（換算成四季）：{', '.join(lines)}")
    # src/topics/developers.ts 的頁尾：「中國是依 IP 的 4 倍半、香港只有約五分之一、新加坡四成多，台灣約四分之三」、「60 多個經濟體」
    # （2026-10-30 依 IP 的資料多了 2026 年第 2 季，不必再從前三季換算，比例跟著變：原本中國 5 倍多、台灣差不多）
    expected = {"CHN": (4, 5), "HKG": (0.15, 0.25), "SGP": (0.38, 0.5), "TWN": (0.65, 0.85)}
    off = [f"{c} {ratios.get(c)}" for c, (lo, hi) in expected.items() if not lo <= ratios.get(c, -1) <= hi]
    if off or not 60 <= len(profile) < 70:
        raise ValueError(f"補充資料變了（{off}，{len(profile)} 個經濟體），改 src/topics/developers.ts 的頁尾說明")


def _write(
    name: str,
    unit: str,
    years: list[int],
    values: dict[str, list[float | None]],
    world: list[float],
    notes: dict[str, str],
    notes_en: dict[str, str],
    hints: dict[str, str],
    hints_en: dict[str, str],
) -> None:
    keep = lambda d: {c: n for c, n in d.items() if c in values}  # noqa: E731
    write_json(
        OUT / f"{name}.json",
        indicator_file(
            name, unit, years, values,
            aggregates={"WLD": world},
            notes=keep(notes), notesEn=keep(notes_en), hints=keep(hints), hintsEn=keep(hints_en),
        ),
    )


def _rank(values: dict[str, list[float | None]], c: str, i: int = -1) -> str:
    row = sorted(((v[i], k) for k, v in values.items() if v[i] is not None), reverse=True)
    for n, (_, k) in enumerate(row, 1):
        if k == c:
            return f"第 {n}／{len(row)}"
    return "—"


def _report(years, devs, pushes, per_1000, growth, per_dev, out_tot, in_tot, collab, languages, licenses, types) -> None:
    y = years[-1]
    tw = "TWN"
    d = devs[tw][(y, QUARTER)]
    print(f"  台灣 {y} 年第 {QUARTER} 季：開發者 {d:,}（{_rank({c: [s.get((y, QUARTER))] for c, s in devs.items()}, tw)}），"
          f"每千人 {per_1000[tw][-1]:.1f}（{_rank(per_1000, tw)}），比前一年 {growth[tw][-1]:+.1f}%（{_rank(growth, tw)}），"
          f"每個帳號推送 {per_dev[tw][-1]:.2f} 次（{_rank(per_dev, tw)}），推送 {pushes[tw][(y, QUARTER)]:,} 次")
    print(f"  台灣 {years[0]} 年第 {QUARTER} 季：開發者 {devs[tw][(years[0], QUARTER)]:,}，每千人 {per_1000[tw][0]:.1f}")
    pairs = collab.get((y, QUARTER), {})
    out_top = sorted(((w, dst) for (src, dst), w in pairs.items() if src == tw), reverse=True)[:6]
    in_top = sorted(((w, src) for (src, dst), w in pairs.items() if dst == tw), reverse=True)[:6]
    print(f"  台灣的協作：對外 {out_tot[tw][y]:,}（{out_top}），外來 {in_tot[tw][y]:,}（{in_top}）")
    lang = sorted(((v, k) for k, v in languages[tw][(y, QUARTER)].items() if types.get(k) == "programming"), reverse=True)[:6]
    lic = sorted(((v, k) for k, v in licenses[tw][(y, QUARTER)].items()), reverse=True)[:5]
    print(f"  台灣的程式語言：{lang}；授權條款：{lic}")
