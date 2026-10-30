"""房價與居住負擔主題：實質房價 5 年、10 年的漲跌，房價所得比、房價租金比（2015 年 = 100），實質房租 5 年的漲跌。

- 各國用 OECD 的 Analytical house price indicators（OECD.ECO.MPD,DSD_AN_HOUSE_PRICES@DF_HOUSE_PRICES，
  CC BY 4.0）的年資料：實質房價（RHP，名目房價指數 ÷ 民間消費平減指數）、房價所得比（HPI_YDH，名目房價 ÷ 每人
  名目可支配所得）、房價租金比（HPI_RPI）、房租（RPI，消費者物價的房租類），都是 2015 年 = 100 的指數。
  實質房租 = RPI ÷ 平減指數，平減指數用 OECD 自己的名目 ÷ 實質房價（HPI ÷ RHP）反推，跟實質房價同一個平減方式。
- OECD 沒有的 11 個經濟體（香港、新加坡、馬來西亞、泰國、菲律賓、摩洛哥、秘魯、塞爾維亞、北馬其頓、賽普勒斯、
  馬爾他）用國際清算銀行（BIS）的實質住宅價格指數補（以消費者物價平減，`sources/bis_rpp.py`），只補實質房價。
- **各國之間只能比變化，不能比水準**：OECD 的房價所得比、房價租金比是指數（2015 年 = 100），不是「幾年的所得」；
  跨國可比的「房價是幾年所得」只有 Demographia、Numbeo 這類不開放的資料，沒有用（DESIGN.md 第 8 節）。
- 台灣不在 OECD、BIS 的資料裡：
  - 實質房價：內政部住宅價格指數（實價登錄，2012 年第 3 季起，105 年 = 100）÷ 主計總處的消費者物價總指數。
  - 房價所得比：內政部的房價所得比（中位數住宅價格 ÷ 中位數家戶年可支配所得，倍）換成 2015 年 = 100；
    只用 2013 年起（實價登錄的成交價），之前是聯徵中心的擔保品估價，不能接起來。倍數本身放在台灣的側欄。
  - 房價租金比：住宅價格指數 ÷ 消費者物價的住宅租金指數；實質房租：住宅租金指數 ÷ 總指數。
- 側欄用的歷年指數（`index/`）、跟長期平均比的房價所得比與房價租金比（`ltavg/`，OECD 有約 27 國）、
  台灣各縣市的房價所得比與貸款負擔率（`taiwan.json`）另外輸出。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, latest_year_span, to_series, write_json, write_manifest_part
from sources import bis_rpp, dgbas_cpi, moi_realestate, oecd

Series = dict[str, dict[int, float]]

FLOW = "OECD.ECO.MPD,DSD_AN_HOUSE_PRICES@DF_HOUSE_PRICES,1.0"
BASE = 2015
WITHIN = 2  # latestWithin：最新一年還沒公布的國家（美國的房租、沙烏地阿拉伯）顯示 2 年內最近一年
TW_FROM = 2013  # 台灣的住宅價格指數從 2012 年第 3 季起，2013 年才有完整的一年
OECD_BIS_GAP = 10  # OECD 與 BIS 的 5 年、10 年變化差超過幾個百分點時，附註寫出 BIS 的數字
CITIES = ["全國", "新北市", "臺北市", "桃園市", "臺中市", "臺南市", "高雄市"]
CITY_EN = {
    "全國": "Taiwan", "新北市": "New Taipei", "臺北市": "Taipei", "桃園市": "Taoyuan", "臺中市": "Taichung",
    "臺南市": "Tainan", "高雄市": "Kaohsiung", "宜蘭縣": "Yilan County", "新竹縣": "Hsinchu County",
    "苗栗縣": "Miaoli County", "彰化縣": "Changhua County", "南投縣": "Nantou County", "雲林縣": "Yunlin County",
    "嘉義縣": "Chiayi County", "屏東縣": "Pingtung County", "臺東縣": "Taitung County", "花蓮縣": "Hualien County",
    "澎湖縣": "Penghu County", "基隆市": "Keelung", "新竹市": "Hsinchu City", "嘉義市": "Chiayi City",
}
BIS_NAMES = {
    "CYP": ("賽普勒斯", "Cyprus"), "HKG": ("香港", "Hong Kong"), "MAR": ("摩洛哥", "Morocco"),
    "MKD": ("北馬其頓", "North Macedonia"), "MLT": ("馬爾他", "Malta"), "MYS": ("馬來西亞", "Malaysia"),
    "PER": ("秘魯", "Peru"), "PHL": ("菲律賓", "the Philippines"), "SGP": ("新加坡", "Singapore"),
    "SRB": ("塞爾維亞", "Serbia"), "THA": ("泰國", "Thailand"),
}


def rebase(s: dict[int, float], base: int = BASE) -> dict[int, float]:
    return {y: v / s[base] * 100 for y, v in s.items()} if s.get(base) else {}


def change(s: dict[int, float], n: int) -> dict[int, float]:
    return {y: (v / s[y - n] - 1) * 100 for y, v in s.items() if s.get(y - n)}


def annual_mean(quarterly: dict[str, float]) -> dict[int, float]:
    """季資料（"2026Q1": 值）→ 四季都有的年平均"""
    by_year: dict[int, list[float]] = defaultdict(list)
    for period, v in quarterly.items():
        by_year[int(period[:4])].append(v)
    return {y: sum(v) / 4 for y, v in by_year.items() if len(v) == 4}


def oecd_measure(measure: str) -> tuple[Series, Series]:
    return oecd.series(FLOW, FREQ="A", MEASURE=measure)


def taiwan() -> dict[str, dict[int, float]]:
    """台灣的五個序列（都是 2015 年 = 100 的指數）與房價所得比的倍數"""
    hpi = annual_mean(moi_realestate.price_indicator("hpi")["全國"])
    pti = annual_mean(moi_realestate.price_indicator("price-income")["全國"])
    cpi = dgbas_cpi.annual()
    years = [y for y in hpi if y >= TW_FROM and y in cpi["all"] and y in cpi["rent"]]
    return {
        "real-price": rebase({y: hpi[y] / cpi["all"][y] for y in years}),
        "real-rent": rebase({y: cpi["rent"][y] / cpi["all"][y] for y in years}),
        "price-rent": rebase({y: hpi[y] / cpi["rent"][y] for y in years}),
        "price-income": rebase({y: v for y, v in pti.items() if y >= TW_FROM}),
        "pti-level": pti,
    }


TW_SOURCE = ("台灣不在 OECD 與 BIS 的資料裡，", "Taiwan is not covered by the OECD or the BIS; ")
TW_REAL_PRICE = (
    "內政部的住宅價格指數（實價登錄，2012 年第 3 季起）除以主計總處的消費者物價總指數",
    "the Ministry of the Interior's housing price index (based on actual transaction prices, from the third quarter "
    "of 2012) is divided by DGBAS's consumer price index",
)


def taiwan_notes(tw: dict[str, dict[int, float]], last: int) -> dict[str, tuple[str, str]]:
    pti = tw["pti-level"]
    return {
        "real-price-5y": (
            f"{TW_SOURCE[0]}改用{TW_REAL_PRICE[0]}（OECD 用民間消費平減指數）；2018 年起",
            f"{TW_SOURCE[1]}{TW_REAL_PRICE[1]} (the OECD uses the private consumption deflator instead); from 2018",
        ),
        "real-price-10y": (
            f"{TW_SOURCE[0]}改用{TW_REAL_PRICE[0]}；住宅價格指數 2012 年才開始，所以 2023 年起才有 10 年的變化",
            f"{TW_SOURCE[1]}{TW_REAL_PRICE[1]}. The index only starts in 2012, so 10-year changes begin in 2023",
        ),
        "price-income": (
            f"{TW_SOURCE[0]}改用內政部的房價所得比（中位數住宅價格 ÷ 中位數家戶年可支配所得），換成 {BASE} 年 = 100："
            f"{BASE} 年平均 {pti[BASE]:.2f} 倍、{last} 年 {pti[last]:.2f} 倍。只用 2013 年起實價登錄的資料。"
            "OECD 用房價指數 ÷ 每人可支配所得，兩者都只能看跟 2015 年比的變化，倍數不能跟其他國家比，見台灣側欄",
            f"{TW_SOURCE[1]}the Ministry of the Interior's price-to-income ratio (median home price ÷ median annual "
            f"household disposable income) is rebased to {BASE} = 100: an average of {pti[BASE]:.2f} times income in {BASE} "
            f"and {pti[last]:.2f} in {last}. Only data from 2013, based on actual transaction prices, are used. The OECD "
            "divides a house price index by disposable income per person, so both show only the change since 2015; "
            "the ratio itself cannot be compared with other countries (see Taiwan's panel)",
        ),
        "price-rent": (
            f"{TW_SOURCE[0]}改用內政部的住宅價格指數除以主計總處消費者物價的住宅租金指數；2013 年起",
            f"{TW_SOURCE[1]}the Ministry of the Interior's housing price index is divided by the housing rent index in "
            "DGBAS's consumer prices; from 2013",
        ),
        "real-rent-5y": (
            f"{TW_SOURCE[0]}改用主計總處消費者物價的住宅租金指數除以總指數；2018 年起。"
            "住宅租金指數調查的是既有租約的租金，漲得比新租約慢",
            f"{TW_SOURCE[1]}the housing rent index in DGBAS's consumer prices is divided by the overall index; from 2018. "
            "The rent index tracks rents on existing leases, which rise more slowly than rents on new leases",
        ),
    }


def write_indicator(out, key: str, unit: str, series: Series, oecd_avg: dict[int, float],
                    notes: dict[str, tuple[str, str]]) -> None:
    years = latest_year_span(series, WITHIN)
    values = {iso: to_series(s, years, 1) for iso, s in series.items()}
    values = {iso: v for iso, v in values.items() if any(x is not None for x in v)}
    write_json(
        out / f"{key}.json",
        indicator_file(
            key, unit, years, values,
            aggregates={"OECD": to_series(oecd_avg, years, 1)},
            latestWithin=WITHIN,
            notes={iso: zh for iso, (zh, _) in notes.items() if iso in values},
            notesEn={iso: en for iso, (_, en) in notes.items() if iso in values},
        ),
    )
    last = years[-1]
    latest = {iso: s[last] for iso, s in series.items() if last in s}
    print(f"  {key}：{years[0]}–{last}，{len(values)} 國（{last} 年 {len(latest)} 國），OECD 平均 {oecd_avg.get(last, float('nan')):.1f}")
    ranked = sorted(latest.items(), key=lambda kv: kv[1])
    print("    最低：" + "、".join(f"{iso} {v:.1f}" for iso, v in ranked[:6]))
    print("    最高：" + "、".join(f"{iso} {v:.1f}" for iso, v in ranked[-6:]))
    if "TWN" in latest:
        rank = sum(1 for v in latest.values() if v > latest["TWN"]) + 1
        print(f"    台灣 {latest['TWN']:.1f}（由高到低第 {rank}/{len(latest)}）")


def write_taiwan(out) -> None:
    """台灣側欄：全國與各縣市的房價所得比（倍）、貸款負擔率（%）季資料，與六都的住宅價格指數"""
    pti = moi_realestate.price_indicator("price-income")
    burden = moi_realestate.price_indicator("burden")
    hpi = moi_realestate.price_indicator("hpi")
    periods = sorted({p for s in pti.values() for p in s})
    areas = list(pti)
    if any(a not in CITY_EN for a in areas):
        raise RuntimeError(f"內政部的縣市名稱變了：{[a for a in areas if a not in CITY_EN]}")
    hpi_periods = sorted({p for s in hpi.values() for p in s})
    write_json(
        out / "taiwan.json",
        {
            "periods": periods,
            "breakAt": "2012Q3",
            "areas": [
                {
                    "zh": a, "en": CITY_EN[a],
                    "priceIncome": [pti[a].get(p) for p in periods],
                    "burden": [burden[a].get(p) for p in periods],
                }
                for a in areas
            ],
            "hpiPeriods": hpi_periods,
            "hpi": [{"zh": a, "en": CITY_EN[a], "values": [hpi[a].get(p) for p in hpi_periods]} for a in CITIES],
        },
    )
    last = periods[-1]
    print(f"  台灣 {last}：" + "、".join(f"{a} {pti[a][last]:.2f} 倍／{burden[a][last]:.1f}%" for a in CITIES))


def build() -> None:
    out = OUT_DIR / "topics" / "housing"  # 2026-10-30 併進住宅與房價（第七批 119）
    rhp, rhp_g = oecd_measure("RHP")
    hpi, hpi_g = oecd_measure("HPI")
    rpi, rpi_g = oecd_measure("RPI")
    pti, pti_g = oecd_measure("HPI_YDH")
    prr, prr_g = oecd_measure("HPI_RPI")
    pti_avg, pti_avg_g = oecd_measure("HPI_YDH_AVG")
    prr_avg, prr_avg_g = oecd_measure("HPI_RPI_AVG")
    bis, bis_g = bis_rpp.real_index()
    tw = taiwan()

    # 實質房價（2015 = 100）：OECD，沒有的用 BIS 補，再加上台灣
    real_price: Series = {iso: s for iso, s in rhp.items() if s.get(BASE)}
    filled = sorted(iso for iso in bis if iso not in real_price and iso != "TWN")
    for iso in filled:
        real_price[iso] = rebase(bis[iso])
    real_price["TWN"] = tw["real-price"]

    # 實質房租：名目房租 ÷（名目 ÷ 實質房價）
    def real_rent_of(r: dict[int, float], h: dict[int, float], rh: dict[int, float]) -> dict[int, float]:
        return rebase({y: v / (h[y] / rh[y]) for y, v in r.items() if y in h and rh.get(y)})

    real_rent: Series = {iso: rr for iso, s in rpi.items() if iso in hpi and iso in rhp
                         and (rr := real_rent_of(s, hpi[iso], rhp[iso]))}
    real_rent["TWN"] = tw["real-rent"]
    oecd_real_rent = real_rent_of(rpi_g["OECD"], hpi_g["OECD"], rhp_g["OECD"])

    last = max(y for s in real_price.values() for y in s)
    tw_notes = taiwan_notes(tw, last)

    def notes_for(key: str, extra: dict[str, tuple[str, str]] | None = None) -> dict[str, tuple[str, str]]:
        return {**(extra or {}), "TWN": tw_notes[key]}

    # BIS 補的經濟體、OECD 與 BIS 差很多的國家
    def bis_notes(n: int) -> dict[str, tuple[str, str]]:
        notes: dict[str, tuple[str, str]] = {}
        for iso in filled:
            zh, en = BIS_NAMES[iso]
            src = bis_rpp.NATIONAL_SOURCES[iso]
            notes[iso] = (
                f"OECD 的資料庫沒有{zh}，改用國際清算銀行（BIS）的實質住宅價格指數（以消費者物價平減；原始資料：{src}）",
                f"The OECD database does not cover {en}, so the Bank for International Settlements (BIS) real residential "
                f"property price index is used instead (deflated by consumer prices; national source: {src})",
            )
        for iso in sorted(set(rhp) & set(bis)):
            o, b = change(rhp[iso], n), change(bis[iso], n)
            y = max((y for y in o if y in b), default=None)
            if y is not None and abs(o[y] - b[y]) > OECD_BIS_GAP:
                notes[iso] = (
                    f"國際清算銀行（BIS）的實質住宅價格指數（另一個原始序列、以消費者物價平減）{y} 年的 {n} 年變化是 "
                    f"{b[y]:+.0f}%，跟 OECD 的 {o[y]:+.0f}% 差很多，選用的原始序列或平減指數不同",
                    f"The Bank for International Settlements (BIS) real residential property price index (a different "
                    f"national series, deflated by consumer prices) shows {b[y]:+.0f}% over the {n} years to {y}, against "
                    f"{o[y]:+.0f}% from the OECD: the two use different source series or deflators",
                )
        return notes

    oecd_rhp = rhp_g["OECD"]
    write_indicator(out, "real-price-5y", "%", {iso: change(s, 5) for iso, s in real_price.items()},
                    change(oecd_rhp, 5), notes_for("real-price-5y", bis_notes(5)))
    write_indicator(out, "real-price-10y", "%", {iso: change(s, 10) for iso, s in real_price.items()},
                    change(oecd_rhp, 10), notes_for("real-price-10y", bis_notes(10)))
    write_indicator(out, "price-income", "2015=100", {**pti, "TWN": tw["price-income"]}, pti_g["OECD"],
                    notes_for("price-income"))
    write_indicator(out, "price-rent", "2015=100", {**prr, "TWN": tw["price-rent"]}, prr_g["OECD"],
                    notes_for("price-rent"))
    write_indicator(out, "real-rent-5y", "%", {iso: change(s, 5) for iso, s in real_rent.items()},
                    change(oecd_real_rent, 5), notes_for("real-rent-5y"))

    # 側欄：歷年的實質房價、實質房租（2015 = 100），OECD 平均與 BIS 的全部經濟體平均
    for key, series, aggregates in (
        ("real-price", real_price, {"OECD": oecd_rhp, "BIS": rebase(bis_g["WLD"])}),
        ("real-rent", real_rent, {"OECD": oecd_real_rent}),
    ):
        years = list(range(min(y for s in series.values() for y in s), last + 1))
        write_json(
            out / "index" / f"{key}.json",
            indicator_file(
                key, "2015=100", years,
                {iso: to_series(s, years, 1) for iso, s in series.items() if s},
                aggregates={k: to_series(v, years, 1) for k, v in aggregates.items()},
            ),
        )
    # 側欄：跟各國自己的長期平均比（長期平均 = 100）
    for key, series, groups in (("price-income", pti_avg, pti_avg_g), ("price-rent", prr_avg, prr_avg_g)):
        years = list(range(min(y for s in series.values() for y in s), last + 1))
        write_json(
            out / "ltavg" / f"{key}.json",
            indicator_file(key, "long-term average=100", years,
                           {iso: to_series(s, years, 1) for iso, s in series.items()},
                           aggregates={"OECD": to_series(groups.get("OECD", {}), years, 1)}),
        )
        print(f"  跟長期平均比的 {key}：{len(series)} 國")
    write_taiwan(out)

    print(f"  BIS 補上的經濟體：{filled}")
    print(f"  台灣：實質房價 {last} 年 {tw['real-price'][last]:.1f}（2015 = 100）、房價所得比 {tw['pti-level'][last]:.2f} 倍")
    write_manifest_part(out, "housing", "house-prices", {
        "source": "OECD Analytical house price indicators; BIS residential property prices; 內政部不動產資訊平台; 行政院主計總處",
    })
