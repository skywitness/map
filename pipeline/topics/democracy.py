"""民主與自由主題：V-Dem Country-Year 資料集 v16（CC BY-SA 4.0），1900 年到最新一年（2025）。

指標：
- 選舉民主指數（v2x_polyarchy）、自由民主指數（v2x_libdem）、言論自由與多元資訊指數（v2x_freexp_altinf），0–1
- 政體分類（Regimes of the World，v2x_regime）：0 封閉專制、1 選舉專制、2 選舉民主、3 自由民主，類別圖
另外輸出三項指數的 68% 可信區間（codelow、codehigh），給側欄的「三項指數對照」用。

國家代碼：V-Dem 的 country_text_id 大多就是 ISO alpha-3（科索沃也是 XKX），一個代碼對應一個政體的連續序列，
這裡照 V-Dem 自己的接續方式對到今天的國界，不另外依領土拼接：
- 德國 1949–1990 年是西德（V-Dem 把聯邦德國當成德國的延續），俄羅斯 1918–1990 年是蘇聯，
  塞爾維亞 1918–2005 年是南斯拉夫、塞爾維亞與蒙特內哥羅，捷克 1918–1992 年是捷克斯洛伐克，
  越南 1945–1975 年是北越，葉門 1918–1989 年是北葉門。
- 地圖上沒有形狀的政體不收：東德、南越、南葉門、尚吉巴（坦尚尼亞的半自治區）、加薩走廊、英國託管巴勒斯坦，
  以及 1900 年以前就消失的德意志、義大利各邦。相關國家的附註會寫。
- 巴勒斯坦（PSE）用 V-Dem 的「Palestine/West Bank」（約旦河西岸）；地圖的巴勒斯坦含加薩，加薩另外評分，附註寫出加薩的值。
- 索馬利蘭（SML）對到地圖自己的形狀 _SOL：1900–1959 年是英屬索馬利蘭，1991 年起是自行宣布獨立的索馬利蘭共和國；
  1960–1990 年併在索馬利亞裡，沒有另外評分（灰色）。
- 殖民地也有評分（例如日本統治下的台灣、英屬印度），獨立前的年份是殖民政府的分數。

世界值：每年地圖上有資料的國家的簡單平均（每國一樣重，不依人口加權）。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import vdem
from sources.countries import ISO3

FIRST_YEAR = 1900

# 指標 id → V-Dem 變數
INDICES = {
    "electoral-democracy": "v2x_polyarchy",
    "liberal-democracy": "v2x_libdem",
    "free-expression": "v2x_freexp_altinf",
}
REGIME = "v2x_regime"
REGIME_NAMES = {
    0: ("封閉專制", "closed autocracy"),
    1: ("選舉專制", "electoral autocracy"),
    2: ("選舉民主", "electoral democracy"),
    3: ("自由民主", "liberal democracy"),
}

# V-Dem 代碼 → 地圖的代碼（其餘的 V-Dem 代碼就是 ISO alpha-3）
RENAME = {"SML": "_SOL"}
# 地圖上沒有形狀、不收的政體（1900 年以後還有資料的）
DROPPED = {
    "DDR": "東德",
    "VDR": "南越",
    "YMD": "南葉門",
    "ZZB": "尚吉巴",
    "PSG": "加薩走廊",
    "PSB": "英國託管巴勒斯坦",
}

# 各國附註（中文, 英文）：V-Dem 的接續方式跟今天的國界不同的地方
NOTES: dict[str, tuple[str, str]] = {
    "TWN": (
        "V-Dem 的台灣：1900–1944 年是日本統治下的台灣，1945–1948 年是設在大陸的中華民國政府，1949 年起是遷台的中華民國。",
        "V-Dem's Taiwan: Taiwan under Japanese rule in 1900–1944, the Republic of China government on the mainland in 1945–1948, "
        "and the Republic of China in Taiwan from 1949.",
    ),
    "CHN": (
        "1900–1910 年是清朝，1911–1948 年是中華民國（北洋政府、國民政府），1949 年起是中華人民共和國。",
        "Qing China in 1900–1910, the Republic of China (Beiyang and Nationalist governments) in 1911–1948, "
        "and the People's Republic of China from 1949.",
    ),
    "DEU": (
        "1949–1990 年是西德（V-Dem 把聯邦德國當成德國的延續）；東德另外評分，地圖上沒有它的形狀，所以沒有放。1945–1948 年盟軍占領，沒有評分。",
        "1949–1990 is West Germany (V-Dem treats the Federal Republic as the continuation of Germany); East Germany is scored "
        "separately and has no shape on today's map, so it is not shown. 1945–1948 (Allied occupation) is not scored.",
    ),
    "RUS": (
        "1918–1990 年是蘇聯（V-Dem 把蘇聯算在俄羅斯）；其他加盟共和國 1990 年起才有評分。",
        "1918–1990 is the Soviet Union (V-Dem scores the USSR as Russia); the other Soviet republics are scored only from 1990.",
    ),
    "SRB": (
        "1918–1991 年是南斯拉夫王國、南斯拉夫社會主義聯邦共和國，1992–2005 年是南斯拉夫聯盟共和國、塞爾維亞與蒙特內哥羅。",
        "1918–1991 is the Kingdom of Yugoslavia and socialist Yugoslavia; 1992–2005 the Federal Republic of Yugoslavia "
        "and Serbia and Montenegro.",
    ),
    "CZE": ("1918–1992 年是捷克斯洛伐克。", "1918–1992 is Czechoslovakia."),
    "VNM": (
        "1945–1975 年是北越（越南民主共和國）；南越（越南共和國）另外評分，地圖上沒有它的形狀，所以沒有放。",
        "1945–1975 is North Vietnam (Democratic Republic of Vietnam); South Vietnam (Republic of Vietnam) is scored "
        "separately and has no shape on today's map, so it is not shown.",
    ),
    "YEM": (
        "1918–1989 年是北葉門；南葉門（1990 年以前）另外評分，地圖上沒有它的形狀，所以沒有放。",
        "1918–1989 is North Yemen; South Yemen (before 1990) is scored separately and has no shape on today's map, so it is not shown.",
    ),
    "TZA": (
        "尚吉巴（1964 年起是坦尚尼亞的半自治區）另外評分，地圖上沒有它的形狀，所以沒有放。",
        "Zanzibar (a semi-autonomous region of Tanzania since 1964) is scored separately and has no shape on the map, so it is not shown.",
    ),
    "_SOL": (
        "1900–1959 年是英屬索馬利蘭，1991 年起是自行宣布獨立的索馬利蘭共和國；1960–1990 年屬於索馬利亞，沒有另外評分。",
        "British Somaliland in 1900–1959 and the self-declared Republic of Somaliland from 1991; "
        "part of Somalia in 1960–1990 and not scored separately.",
    ),
    "SOM": (
        "1900–1959 年是義屬索馬利蘭（1950 年起是聯合國託管地）；1991 年起不含自行宣布獨立的索馬利蘭（另外評分，地圖上是另一個形狀）。",
        "Italian Somaliland in 1900–1959 (a UN trust territory from 1950); from 1991 Somaliland, which declared independence, "
        "is scored separately (it has its own shape on the map).",
    ),
}


def _fmt(variable: str, value: float) -> tuple[str, str]:
    """附註裡的值：政體寫類別名稱，指數寫到小數兩位"""
    if variable == REGIME:
        return REGIME_NAMES[int(value)]
    return f" {value:.2f}", f"{value:.2f}"


def build() -> None:
    out = OUT_DIR / "topics" / "democracy"
    rows = vdem.rows()
    last_year = max(int(r["year"]) for r in rows)
    years = list(range(FIRST_YEAR, last_year + 1))

    variables = list(INDICES.values()) + [REGIME]
    bounds = [f"{v}_{b}" for v in INDICES.values() for b in ("codelow", "codehigh")]
    series: dict[str, dict[str, dict[int, float]]] = {v: defaultdict(dict) for v in variables + bounds}
    gaza: dict[str, tuple[int, float]] = {}
    unknown: set[str] = set()
    for row in rows:
        year = int(row["year"])
        if year < FIRST_YEAR:
            continue
        code = row["country_text_id"]
        if code == "PSG":
            for v in variables:
                if row[v] != "" and year >= gaza.get(v, (0, 0))[0]:
                    gaza[v] = (year, float(row[v]))
        if code in DROPPED:
            continue
        iso3 = RENAME.get(code, code)
        if iso3 not in ISO3 and iso3 != "_SOL":
            unknown.add(f"{code} {row['country_name']}")
            continue
        for v in variables + bounds:
            if row[v] != "":
                series[v][iso3][year] = float(row[v])
    if unknown:
        # V-Dem 新版多了政體時要決定怎麼對到地圖（RENAME 或 DROPPED），不要默默丟掉
        raise RuntimeError(f"V-Dem 有對不到地圖的國家代碼：{', '.join(sorted(unknown))}")

    notes = {k: zh for k, (zh, _en) in NOTES.items()}
    notes_en = {k: en for k, (_zh, en) in NOTES.items()}

    def with_gaza(variable: str) -> tuple[dict[str, str], dict[str, str]]:
        """巴勒斯坦的附註：地圖的形狀含加薩，資料是約旦河西岸，寫出加薩最近一年的值"""
        year, value = gaza[variable]
        zh, en = _fmt(variable, value)
        return (
            {**notes, "PSE": f"V-Dem 把約旦河西岸與加薩走廊分開評分，這裡用約旦河西岸的值；加薩走廊 {year} 年是{zh}。"},
            {**notes_en, "PSE": f"V-Dem scores the West Bank and the Gaza Strip separately; the West Bank is shown here. "
                                f"Gaza in {year}: {en}."},
        )

    counts: dict[str, int] = {}
    for key, variable in INDICES.items():
        values = {c: to_series(s, years) for c, s in sorted(series[variable].items())}
        # 世界：每年有資料的國家的簡單平均
        world = {}
        for i, y in enumerate(years):
            present = [s[i] for s in values.values() if s[i] is not None]
            if present:
                world[y] = round(sum(present) / len(present), 3)
        zh_notes, en_notes = with_gaza(variable)
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, "0–1", years, values,
                aggregates={"WLD": to_series(world, years)},
                notes=zh_notes,
                notesEn=en_notes,
            ),
        )
        counts[key] = len(values)
        for bound, suffix in (("codelow", "low"), ("codehigh", "high")):
            write_json(
                out / "intervals" / f"{key}-{suffix}.json",
                indicator_file(
                    f"{key}-{suffix}", "0–1", years,
                    {c: to_series(s, years) for c, s in sorted(series[f"{variable}_{bound}"].items())},
                ),
            )

    regime = {c: to_series({y: int(v) for y, v in s.items()}, years) for c, s in sorted(series[REGIME].items())}
    zh_notes, en_notes = with_gaza(REGIME)
    write_json(out / "regime.json", indicator_file("regime", "", years, regime, notes=zh_notes, notesEn=en_notes))
    counts["regime"] = len(regime)

    latest = {c: s[-1] for c, s in regime.items() if s[-1] is not None}
    tally = {REGIME_NAMES[k][0]: sum(1 for v in latest.values() if v == k) for k in REGIME_NAMES}
    print(f"  {last_year} 年政體分類：" + "、".join(f"{k} {n} 國" for k, n in tally.items()))
    write_json(
        out / "manifest.json",
        {
            "topic": "democracy",
            "generatedAt": now_iso(),
            "source": f"V-Dem Country-Year Dataset {vdem.VERSION} ({vdem.DOI}), via github.com/vdeminstitute/vdemdata tag V16",
            "license": "CC BY-SA 4.0",
            "years": [years[0], years[-1]],
            "countries": counts,
        },
    )
