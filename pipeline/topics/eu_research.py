"""歐盟研究計畫的錢流向哪裡（新主題，2026-11-08，製作手冊第二十七批 598，候選 1322；科技・研發與創新；步驟 eu-research）。

- 資料：CORDIS「EU research projects under HORIZON EUROPE (2021-2027)」的 CSV zip
  （https://cordis.europa.eu/data/cordis-HORIZONprojects-csv.zip）。cordis.europa.eu 的 robots.txt 寫 `Disallow: /data/`，
  程式不抓；使用者 2026-11-08 用瀏覽器下載，放在 skywitness/map-plan 的 `data/cordis/`（README 寫了格式與檢查），
  重跑前複製到 pipeline/.cache/cordis/。授權：European Commission reuse notice（2011/833/EU；執委會的內容 CC BY 4.0）。
- 格式（map-plan 的 README）：分號分隔、每欄加引號。project.csv 有 198 筆 objective 的引號不成對，一般的 CSV 解析器會錯位，
  所以每一行去掉頭尾的引號、用 `";"` 切開、`""` 換回 `"`。organization.csv 用一般的解析器讀得對；它的 netEcContribution
  是句點小數（project.csv 的金額是逗號小數，這裡不用）。
- 金額：各國拿到多少用 organization.csv 的 netEcContribution（歐盟實際給這個參與者的錢，扣掉轉給聯繫夥伴的部分）；
  associatedPartner（聯繫夥伴）不拿歐盟的錢，金額是 0，但算參與筆數。
- 國家：歐盟的代碼（EL 希臘、UK 英國）換成 ISO；空白 10 筆不算；「DE;HU」2 筆（同一個機構）算德國。
- 時間軸：計畫的簽約日（project.csv 的 ecSignatureDate）的年份，2021–2026（2026 年到 9 月 30 日），值是累計到那一年。
- 點：歐盟撥款合計 500 萬歐元以上的機構（1,606 個），座標是 organization.csv 的 geolocation（「緯度,經度」）。
"""
from __future__ import annotations

import csv
import hashlib
import io
import zipfile
from collections import Counter, defaultdict

from common import CACHE_DIR, OUT_DIR, indicator_file, points_file, write_json
from sources import wpp
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "eu-research"
ZIP = CACHE_DIR / "cordis" / "cordis-HORIZONprojects-csv.zip"
SHA256 = "b9919057b77e897a884bbbd82005db1e25defd56f7c7be9e97d6ef9495ace6c4"
YEARS = list(range(2021, 2027))
EU_CODES = {"EL": "GRC", "UK": "GBR"}
TYPES = {"HES": 1, "PRC": 2, "REC": 3, "PUB": 4, "OTH": 5}
TYPE_ZH = {1: "高等教育", 2: "企業", 3: "研究機構", 4: "公部門", 5: "其他"}
TYPE_EN = {1: "higher education", 2: "companies", 3: "research organisations", 4: "public bodies", 5: "other"}
POINT_MIN_EUR = 5_000_000
MIN_POPULATION = 100  # 千人


def _zip() -> zipfile.ZipFile:
    if not ZIP.exists():
        raise RuntimeError(f"沒有 {ZIP}：請把 map-plan 的 data/cordis/cordis-HORIZONprojects-csv.zip 複製到這裡")
    if hashlib.sha256(ZIP.read_bytes()).hexdigest() != SHA256:
        raise RuntimeError(f"{ZIP} 的 SHA-256 跟 map-plan 的 README 不一樣，檔案可能換了版本，先看過再改 SHA256")
    return zipfile.ZipFile(ZIP)


def _project_years(z: zipfile.ZipFile) -> dict[str, int]:
    """計畫 id → 簽約年（project.csv 用 `";"` 切，見檔頭）"""
    text = z.read("project.csv").decode("utf-8")
    # 換行是 LF；splitlines() 還會切 \x85、\u2028 這類欄位裡的字元，所以只切 \n
    lines = text.rstrip('\n').split('\n')
    header = lines[0].strip('"').split('";"')
    i_id, i_sign = header.index("id"), header.index("ecSignatureDate")
    out = {}
    for line in lines[1:]:
        cells = [c.replace('""', '"') for c in line[1:-1].split('";"')]
        if len(cells) != len(header):
            raise ValueError(f"project.csv 欄數 {len(cells)}，應該是 {len(header)}：{line[:80]}")
        out[cells[i_id]] = int(cells[i_sign][:4])
    return out


def _iso3(code: str) -> str | None:
    code = code.split(";")[0].strip()
    return EU_CODES.get(code) or from_alpha2(code)


def build() -> None:
    z = _zip()
    years = _project_years(z)
    with z.open("organization.csv") as f:
        rows = list(csv.DictReader(io.TextIOWrapper(f, encoding="utf-8"), delimiter=";"))

    money = defaultdict(lambda: defaultdict(float))  # iso3 → 年 → 歐元
    parts = defaultdict(Counter)  # iso3 → 年 → 筆數
    coord = defaultdict(Counter)  # iso3 → 年 → 主持的計畫數
    by_type = defaultdict(lambda: defaultdict(float))  # iso3 → 類型 → 歐元
    orgs_in = defaultdict(set)
    org = {}
    skipped = Counter()
    for r in rows:
        iso3 = _iso3(r["country"])
        if not iso3:
            skipped[r["country"] or "（空白）"] += 1
            continue
        y = years[r["projectID"]]
        eur = float(r["netEcContribution"] or 0)
        t = TYPES.get(r["activityType"], 5)
        money[iso3][y] += eur
        parts[iso3][y] += 1
        if r["role"] == "coordinator":
            coord[iso3][y] += 1
        by_type[iso3][t] += eur
        orgs_in[iso3].add(r["organisationID"])
        o = org.setdefault(r["organisationID"], {"name": r["name"].strip(), "iso3": iso3, "t": t, "eur": 0.0, "n": 0, "c": 0, "geo": ""})
        o["eur"] += eur
        o["n"] += 1
        o["c"] += r["role"] == "coordinator"
        o["geo"] = o["geo"] or r["geolocation"]

    def cumulative(series: dict) -> dict[str, list[float | None]]:
        out = {}
        for iso3, by_year in sorted(series.items()):
            total, row = 0.0, []
            for y in YEARS:
                total += by_year.get(y, 0)
                row.append(round(total, 2))
            out[iso3] = row
        return out

    funding = cumulative(money)
    hints, hints_en = {}, {}
    for iso3 in funding:
        total = sum(by_type[iso3].values())
        mix = [(t, v / total * 100) for t, v in sorted(by_type[iso3].items(), key=lambda kv: -kv[1]) if total and v > 0]
        n, c, k = sum(parts[iso3].values()), sum(coord[iso3].values()), len(orgs_in[iso3])
        hints[iso3] = f"{n:,} 筆參與、{k:,} 個機構、主持 {c:,} 個計畫" + (
            "；撥款 " + "、".join(f"{TYPE_ZH[t]} {p:.0f}%" for t, p in mix[:4]) if mix else "；沒有拿到歐盟的錢（聯繫夥伴）")
        hints_en[iso3] = f"{n:,} participations, {k:,} organisations, {c:,} projects coordinated" + (
            "; funding: " + ", ".join(f"{TYPE_EN[t]} {p:.0f}%" for t, p in mix[:4]) if mix else "; no EU funding (associated partners)")
    lic = "European Commission reuse notice（CC BY 4.0）"
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "funding.json", indicator_file("funding", "EUR", YEARS, funding, hints=hints, hintsEn=hints_en, license=lic))
    write_json(OUT / "participations.json", indicator_file("participations", "筆", YEARS, cumulative(parts), license=lic))
    write_json(OUT / "coordinated.json", indicator_file("coordinated", "個", YEARS, cumulative(coord), license=lic))

    pop = wpp.demographic(["TPopulation1July"], last_year=YEARS[-1])["TPopulation1July"]
    per_capita = {}
    for iso3, row in funding.items():
        s = pop.get(iso3, {})
        if row[-1] > 0 and s.get(YEARS[-1], 0) >= MIN_POPULATION:
            per_capita[iso3] = [round(v / (s[y] * 1000), 3) if s.get(y) else None for y, v in zip(YEARS, row)]
    write_json(OUT / "funding-per-capita.json", indicator_file("funding-per-capita", "EUR/person", YEARS, per_capita, license=lic))

    pts = []
    for o in org.values():
        if o["eur"] < POINT_MIN_EUR or not o["geo"]:
            continue
        lat, lon = (float(x) for x in o["geo"].split(","))
        pts.append({"lon": lon, "lat": lat, "name": o["name"], "iso3": o["iso3"], "t": o["t"],
                    "f": round(o["eur"] / 1e6, 1), "n": o["n"], "c": o["c"]})
    pts.sort(key=lambda p: p["lon"])
    write_json(OUT / "orgs.json", points_file(pts, ["lon", "lat", "name", "iso3", "t", "f", "n", "c"],
                                              {"lon": 0.001, "lat": 0.001, "t": 1, "f": 0.1, "n": 1, "c": 1}, delta=("lon",)))

    last = {c: v[-1] for c, v in funding.items()}
    top = sorted(last.items(), key=lambda kv: -kv[1])
    print(f"  歐盟研究經費：{len(rows):,} 筆參與，{len(funding)} 國；合計 {sum(last.values()) / 1e9:.2f} 十億歐元；略過 {dict(skipped)}")
    print("    前幾名：", [(c, round(v / 1e9, 2)) for c, v in top[:8]])
    print("    台灣：", round(last.get("TWN", 0), 2), sum(parts["TWN"].values()), "筆；", hints.get("TWN"))
    pc = sorted(((c, v[-1]) for c, v in per_capita.items()), key=lambda kv: -kv[1])
    print("    每人：", [(c, round(v)) for c, v in pc[:8]])
    print(f"    點：{len(pts)} 個機構（≥ {POINT_MIN_EUR / 1e6:.0f} 百萬歐元）；最多 {sorted(pts, key=lambda p: -p['f'])[:5]}")
