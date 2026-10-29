"""交通安全主題：道路交通死亡率、死亡人數、行人與機車騎士的死亡占比、每萬輛機動車死亡數。

- 死亡率：WHO 估計值（GHO `RS_198`，2000–2023），30 天定義（事故後 30 天內死亡）。
- 死亡人數：WHO 的死亡率 × 聯合國 WPP 2024 的年中人口（WHO 的死亡人數 `RS_196` 只有 2021 年；
  兩者在 2021 年的中位數差約 1.5%，見 _check_deaths()）。
- 行人、機車騎士的死亡占比：各國向 WHO 通報的死亡人數依道路使用者分（Global Status Report on Road Safety
  2018 與 2023 兩輪調查，大多是 2016、2021 年的資料）；不是 WHO 的估計值，通報不完整的國家可能有偏差。
- 每萬輛機動車死亡數：WHO 估計的死亡人數 ÷ 各國通報的登記機動車輛數 × 1 萬（兩輪調查各一次）。
- 機車大國（build_motorcycles，2026-10-29，製作手冊第五批 58）：GSRRS 2023 的登記機車數（二、三輪機動車，CP_39，
  2020 或 2021 年）÷ WPP 人口 × 1,000，與占登記機動車輛（CP_36a）的比例。機車數比車輛總數還多的（菲律賓、喬治亞、
  賽普勒斯、查德、南蘇丹：單位填錯）兩個指標都不用；台灣用交通部表 101 的年底登記機車數（使用者 2026-10-29 決定）。
  車輛數的年份跟死亡人數差 2 年以內才算；每千人不到 1 輛的通報值當成填錯，不用。
- **台灣**（WHO 沒有）：交通部統計查詢網的 30 日內死亡人數（2008 年起，`sources/motc.py`），跟 WHO 同樣是 30 天定義；
  人口用 WPP（跟其他國家一致），機動車輛是交通部的年底登記數。
  台灣的「機車」只算騎士，乘客不分車種另外一類，所以機車占比比 WHO 的定義（含乘客）略低。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, latest_year_span, now_iso, to_series, write_json
from sources import motc, who_road, wpp

OUT = OUT_DIR / "topics" / "road-safety"
FIRST_YEAR = 2000
TWN_LAST = 2025  # 交通部的 30 日死亡人數已經有全年資料的最後一年
SHARE_WITHIN = 5  # 占比與每萬輛：各國用 5 年內最近一次調查的值
VEHICLE_GAP = 2  # 登記車輛數跟死亡人數的年份最多差幾年

# 台灣（交通部表 127）的駕乘車種 → 側欄的分類；跟其他國家的 WHO 五類不完全一樣（乘客不分車種）
TWN_USERS = {
    "car": ["大客車", "大貨車", "小客車", "小貨車", "特種車"],
    "moto": ["機車"],
    "pedestrian": ["行人"],
    "cyclist": ["自行車"],  # 含腳踏自行車、電動輔助自行車、微型電動二輪車
    "passenger": ["乘客"],
    "other": ["其他", "不明"],
}


def _taiwan() -> dict[str, dict[int, float]]:
    """台灣的 30 日內死亡人數（總計與各駕乘車種）與年底登記的機動車輛數，到 TWN_LAST 年"""
    col = "死亡人數(人)"
    out: dict[str, dict[int, float]] = {"total": motc.annual(motc.DEATHS_BY_USER, col, "總計")}
    for user, names in TWN_USERS.items():
        by_year: dict[int, float] = {}
        for name in names:
            for y, v in motc.annual(motc.DEATHS_BY_USER, col, name).items():
                by_year[y] = by_year.get(y, 0) + v
        out[user] = by_year
    vehicles = motc.annual(motc.VEHICLES_TO_2012, "總計", "總計")
    vehicles = {y: v for y, v in vehicles.items() if y <= 2011}
    vehicles.update(motc.annual(motc.VEHICLES_FROM_2012, "總計", "車齡別總計"))
    out["vehicles"] = vehicles
    out = {k: {y: v for y, v in s.items() if y <= TWN_LAST} for k, s in out.items()}
    # 各類加起來要等於總計（交通部的表有「總計」，分類的 0 寫成「-」）
    for y, total in out["total"].items():
        parts = sum(out[u].get(y, 0) for u in TWN_USERS)
        if abs(parts - total) > 0.5:
            raise RuntimeError(f"交通部 {y} 年各駕乘車種的死亡人數加起來 {parts}，不等於總計 {total}")
    return out


def build_motorcycles() -> None:
    """每千人機車數與機車占機動車輛的比例：各國 2020／2021 年（GSRRS 2023），台灣 2012 年起每年（交通部表 101）"""
    pop = wpp.demographic(["TPopulation1July"], last_year=TWN_LAST)["TPopulation1July"]  # 千人
    per_1000: dict[str, dict[int, float]] = {}
    share: dict[str, dict[int, float]] = {}
    dropped = []
    for iso3, (year, moto, total) in who_road.gsrrs_2023_motorcycles().items():
        people = pop.get(iso3, {}).get(year)
        if moto > total or not people:
            dropped.append(iso3)
            continue
        per_1000[iso3] = {year: round(moto / people, 1)}  # 人口是千人
        share[iso3] = {year: round(moto / total * 100, 1)}
    moto_tw = {y: v for y, v in motc.annual(motc.VEHICLES_FROM_2012, "機車", "車齡別總計").items() if y <= TWN_LAST}
    total_tw = {y: v for y, v in motc.annual(motc.VEHICLES_FROM_2012, "總計", "車齡別總計").items() if y <= TWN_LAST}
    per_1000["TWN"] = {y: round(v / pop["TWN"][y], 1) for y, v in moto_tw.items() if pop["TWN"].get(y)}
    share["TWN"] = {y: round(v / total_tw[y] * 100, 1) for y, v in moto_tw.items() if total_tw.get(y)}
    years = list(range(min(moto_tw), TWN_LAST + 1))
    y = TWN_LAST
    note = (f"台灣是交通部統計查詢網表 101 的年底登記機車數（{y} 年底 {moto_tw[y] / 1e4:,.0f} 萬輛，含重型、輕型機車）"
            f" ÷ 聯合國的年中人口；占機動車輛的比例是機車 ÷ 全部登記的機動車輛（{total_tw[y] / 1e4:,.0f} 萬輛）。")
    note_en = (f"Taiwan: motorcycles registered at year end in table 101 of the Ministry of Transportation and Communications "
               f"statistics database ({moto_tw[y] / 1e6:.1f} million at the end of {y}, heavy and light motorcycles) divided by "
               f"UN mid-year population; the share is motorcycles divided by all registered motor vehicles ({total_tw[y] / 1e6:.1f} million).")
    for name, unit, data in (("motorcycles-per-1000", "輛/千人", per_1000), ("motorcycle-share", "%", share)):
        write_json(OUT / f"{name}.json", indicator_file(
            name, unit, years, {k: to_series(s, years) for k, s in sorted(data.items())},
            latestWithin=SHARE_WITHIN, notes={"TWN": note}, notesEn={"TWN": note_en},
        ))
    top = sorted(((next(iter(s.values())), k) for k, s in per_1000.items() if k != "TWN"), reverse=True)
    print(f"  機車：{len(per_1000) - 1} 國＋台灣；不用（機車多於車輛總數或沒有人口）：{dropped}")
    print(f"  每千人最多 {top[:8]}；台灣 {y} 年 {per_1000['TWN'][y]}（占 {share['TWN'][y]}%）")


def build() -> None:
    rate, world_rate = who_road.death_rate()
    last = max(y for s in rate.values() for y in s)
    years = list(range(FIRST_YEAR, last + 1))
    pop = wpp.demographic(["TPopulation1July"], last_year=TWN_LAST)["TPopulation1July"]  # 千人
    world_pop = pop.pop("WLD")

    tw = _taiwan()
    tw_pop = pop["TWN"]
    tw_rate = {y: tw["total"][y] / (tw_pop[y] * 1000) * 1e5 for y in tw["total"] if y in tw_pop}

    # ── 死亡率、死亡人數 ──
    rate_values = {iso3: to_series(s, years, 1) for iso3, s in rate.items()}
    rate_values["TWN"] = to_series({y: round(v, 1) for y, v in tw_rate.items()}, years)
    deaths = {
        iso3: {y: round(v / 1e5 * pop[iso3][y] * 1000) for y, v in s.items() if y in pop.get(iso3, {})}
        for iso3, s in rate.items()
        if iso3 in pop
    }
    deaths["TWN"] = {y: v for y, v in tw["total"].items()}
    world_deaths = {y: round(v / 1e5 * world_pop[y] * 1000) for y, v in world_rate.items() if y in world_pop}
    _check_deaths(deaths)

    tw_note_rate = (
        "台灣不在 WHO 的資料裡，這裡用交通部統計查詢網的道路交通事故 30 日內死亡人數（事故後 30 天內死亡，2008 年起，"
        "跟 WHO 的定義相同）÷ 聯合國 WPP 的年中人口。警察機關的 A1 類事故只算當場或 24 小時內死亡，"
        "早年常被引用的死亡人數是 24 小時的定義，比 30 日的少很多，不能跟其他國家比。"
        f"{TWN_LAST - 1}、{TWN_LAST} 年的 30 日內死亡人數是 {tw['total'][TWN_LAST - 1]:,.0f}、{tw['total'][TWN_LAST]:,.0f} 人"
        f"（每 10 萬人 {tw_rate[TWN_LAST - 1]:.1f}、{tw_rate[TWN_LAST]:.1f}），WHO 的資料只到 {last} 年，所以地圖只到 {last} 年。"
    )
    tw_note_rate_en = (
        "Taiwan is not in the WHO data. Its figures are road traffic deaths within 30 days of the crash from the Ministry of "
        "Transportation and Communications (since 2008, the same definition as WHO) divided by the UN WPP mid-year population. "
        "Police A1 crash statistics count only deaths at the scene or within 24 hours; the 24-hour totals often quoted in the past "
        "are much lower than the 30-day ones and are not comparable with other countries. "
        f"Deaths within 30 days were {tw['total'][TWN_LAST - 1]:,.0f} in {TWN_LAST - 1} and {tw['total'][TWN_LAST]:,.0f} in {TWN_LAST} "
        f"({tw_rate[TWN_LAST - 1]:.1f} and {tw_rate[TWN_LAST]:.1f} per 100,000); WHO data end in {last}, so the map does too."
    )
    write_json(
        OUT / "rate.json",
        indicator_file(
            "rate", "每 10 萬人", years, rate_values,
            aggregates={"WLD": to_series(world_rate, years, 1)},
            notes={"TWN": tw_note_rate}, notesEn={"TWN": tw_note_rate_en},
        ),
    )
    write_json(
        OUT / "deaths.json",
        indicator_file(
            "deaths", "人", years, {k: to_series(s, years, 0) for k, s in deaths.items()},
            aggregates={"WLD": to_series(world_deaths, years, 0)},
            notes={"TWN": tw_note_rate}, notesEn={"TWN": tw_note_rate_en},
        ),
    )

    # ── 行人、機車騎士的死亡占比；組成（側欄） ──
    rounds = [who_road.gsrrs_2016(), who_road.gsrrs_2023()]
    shares: dict[str, dict[str, dict[int, float]]] = {u: {} for u in who_road.USERS}
    composition: dict[str, dict[int, list[float | None]]] = {}
    for survey in rounds:
        for iso3, s in survey.items():
            total = sum(s.shares.values())
            if not s.year or len(s.shares) < len(who_road.USERS) or not 95 <= total <= 105:
                continue  # 五類沒填齊、或加起來不是 100% 的不用
            for u in who_road.USERS:
                shares[u].setdefault(iso3, {})[s.year] = s.shares[u]
            composition.setdefault(iso3, {})[s.year] = [round(s.shares[u], 1) for u in who_road.USERS]
    tw_share = {u: {y: tw[u].get(y, 0) / t * 100 for y, t in tw["total"].items()} for u in TWN_USERS}
    for u in ("moto", "pedestrian"):
        shares[u]["TWN"] = tw_share[u]
    share_years = latest_year_span({k: v for k, v in shares["pedestrian"].items() if k != "TWN"}, SHARE_WITHIN)
    share_years = list(range(share_years[0], min(share_years[-1], last) + 1))

    tw_moto_note = (
        "台灣用交通部的 30 日內死亡人數依死者的駕乘車種分（每年都有）。台灣的「機車」只算騎士，乘客不分車種另外一類"
        f"（{TWN_LAST} 年 {tw['passenger'][TWN_LAST]:,.0f} 人），所以比 WHO 的定義（二、三輪機動車的騎士與乘客）略低。"
    )
    tw_moto_note_en = (
        "Taiwan uses Ministry of Transportation and Communications deaths within 30 days by the victim's mode of travel (every year). "
        "Its motorcycle figure counts riders only; passengers of all vehicles form a separate group "
        f"({tw['passenger'][TWN_LAST]:,.0f} in {TWN_LAST}), so it is a little lower than under the WHO definition "
        "(riders and passengers of powered two- and three-wheelers)."
    )
    ped = tw_share["pedestrian"]
    tw_ped_note = (
        f"台灣用交通部的 30 日內死亡人數（每年都有）：行人死亡 2022 年 {tw['pedestrian'][2022]:,.0f} 人、"
        f"{TWN_LAST} 年 {tw['pedestrian'][TWN_LAST]:,.0f} 人（占 {ped[TWN_LAST]:.1f}%）。"
        "2022 年 12 月 CNN 的旅遊專欄引用網友的說法，形容台灣是「行人地獄」（a living hell for pedestrians），"
        "這個說法之後在國內廣泛流傳，也帶動民間對行人安全的訴求。交通部 2023 年 8 月向行政院提出「行人交通安全政策綱領」"
        "（2024–2027 年），《道路交通安全基本法》2023 年 12 月公布、2024 年 1 月 1 日施行，以 2050 年道路交通事故零死亡為目標。"
    )
    tw_ped_note_en = (
        f"Taiwan uses Ministry of Transportation and Communications deaths within 30 days (every year): {tw['pedestrian'][2022]:,.0f} "
        f"pedestrians died in 2022 and {tw['pedestrian'][TWN_LAST]:,.0f} in {TWN_LAST} ({ped[TWN_LAST]:.1f}% of road deaths). "
        "In December 2022 a CNN travel column quoted a description of Taiwan as \"a living hell for pedestrians\"; the phrase "
        "spread widely in Taiwan and fed public calls for safer streets. The Ministry presented a pedestrian traffic safety "
        "policy framework (2024–2027) to the Executive Yuan in August 2023, and the Road Traffic Safety Basic Act, promulgated in "
        "December 2023 and in force from 1 January 2024, sets a goal of zero road deaths by 2050."
    )
    for user, name, note, note_en in (
        ("pedestrian", "pedestrians", tw_ped_note, tw_ped_note_en),
        ("moto", "motorcyclists", tw_moto_note, tw_moto_note_en),
    ):
        write_json(
            OUT / f"{name}.json",
            indicator_file(
                name, "%", share_years,
                {k: to_series({y: round(v, 1) for y, v in s.items()}, share_years) for k, s in shares[user].items()},
                latestWithin=SHARE_WITHIN, notes={"TWN": note}, notesEn={"TWN": note_en},
            ),
        )

    # ── 每萬輛機動車死亡數 ──
    per_vehicle: dict[str, dict[int, float]] = {}
    for survey, death_year in zip(rounds, (2016, 2021)):
        for iso3, s in survey.items():
            d = deaths.get(iso3, {}).get(death_year)
            if not s.vehicles or not s.vehicles_year or d is None or abs(s.vehicles_year - death_year) > VEHICLE_GAP:
                continue
            people = pop.get(iso3, {}).get(s.vehicles_year, 0) * 1000
            if s.vehicles < people / 1000:
                # 每千人不到 1 輛：通報的單位錯了（菲律賓 2021 年填 13），不用
                print(f"  略過 {iso3} {s.vehicles_year} 年的登記車輛數 {s.vehicles:,.0f}（人口 {people:,.0f}）")
                continue
            per_vehicle.setdefault(iso3, {})[death_year] = round(d / s.vehicles * 1e4, 2)
    per_vehicle["TWN"] = {y: round(tw["total"][y] / v * 1e4, 2) for y, v in tw["vehicles"].items() if y in tw["total"]}
    pv_years = list(range(2016, last + 1))
    tw_pv_note = (
        "台灣是交通部的 30 日內死亡人數 ÷ 年底登記的機動車輛數（汽車與機車，"
        f"{TWN_LAST} 年底 {tw['vehicles'][TWN_LAST] / 1e4:,.0f} 萬輛，其中約六成是機車）。"
    )
    tw_pv_note_en = (
        "Taiwan: Ministry of Transportation and Communications deaths within 30 days ÷ registered motor vehicles at year end "
        f"(cars and motorcycles; {tw['vehicles'][TWN_LAST] / 1e6:.1f} million at the end of {TWN_LAST}, about 60% of them motorcycles)."
    )
    write_json(
        OUT / "per-vehicles.json",
        indicator_file(
            "per-vehicles", "每萬輛", pv_years,
            {k: to_series(s, pv_years) for k, s in per_vehicle.items()},
            latestWithin=SHARE_WITHIN, notes={"TWN": tw_pv_note}, notesEn={"TWN": tw_pv_note_en},
        ),
    )

    # ── 側欄：各類道路使用者的組成 ──
    composition["TWN"] = {
        y: [round(tw[u].get(y, 0) / t * 100, 1) for u in TWN_USERS] for y, t in tw["total"].items() if y >= share_years[0]
    }
    write_json(
        OUT / "composition.json",
        {
            "users": who_road.USERS,
            "twnUsers": list(TWN_USERS),
            "countries": {k: {str(y): v for y, v in sorted(s.items())} for k, s in sorted(composition.items())},
        },
    )
    build_motorcycles()
    write_json(OUT / "manifest.json", {"generatedAt": now_iso(), "whoLastYear": last})

    tw23 = tw_rate[2023]
    print(f"  台灣 2023 年：30 日內死亡 {tw['total'][2023]:,.0f} 人、每 10 萬人 {tw23:.1f}；行人 {ped[2023]:.1f}%、機車 {tw_share['moto'][2023]:.1f}%")
    print(f"  占比的年份 {share_years[0]}–{share_years[-1]}，{len(shares['pedestrian'])} 國；每萬輛 {len(per_vehicle)} 國")


def _check_deaths(deaths: dict[str, dict[int, float]]) -> None:
    """WHO 的死亡率 × WPP 人口，跟 WHO 自己的 2021 年死亡人數（RS_196，GSRRS 2023 的估計）比。
    死亡率是 2026 年更新的估計（Global Health Estimates），個別國家改過（阿根廷、葉門約差 15%），
    所以只看中位數：差太多表示人口或單位算錯了。"""
    from sources import who

    reported, _ = who.gho("RS_196", {})
    worst = []
    for iso3, s in reported.items():
        mine = deaths.get(iso3, {}).get(2021)
        if mine and s.get(2021) and s[2021] > 500:
            worst.append((abs(mine / s[2021] - 1), iso3, mine, s[2021]))
    worst.sort(reverse=True)
    median = sorted(w[0] for w in worst)[len(worst) // 2]
    print(f"  死亡率 × 人口 vs WHO 2021 死亡人數：中位數差 {median:.1%}，差最多的 {[(i, round(m), round(r)) for _, i, m, r in worst[:3]]}")
    if median > 0.03:
        raise RuntimeError(f"死亡人數跟 WHO 的差太多（中位數 {median:.1%}）")
