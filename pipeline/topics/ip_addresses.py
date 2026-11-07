"""網路位址分給了誰：IPv4 與 IPv6 的存量（新主題，2026-11-07，製作手冊第二十七批 588，候選 1309；步驟 ip-addresses，
輸出 topics/ip-addresses/）。

- APNIC 的 delegated-apnic-latest（https://ftp.apnic.net/stats/apnic/，README 的使用條件：「The files are freely available
  for download and use on the condition that APNIC will not be held responsible for any loss or damage…」）。
  每列：registry|cc|type|start|value|date|status；ipv4 的 value 是位址數，ipv6 是前綴長度（換成 /32 的個數 = 2^(32−長度)），
  asn 是個數；status 只收 allocated、assigned。
- **只做 APNIC 的服務區（亞太）**：手冊要開工前確認五個區域註冊機構的授權——RIPE NCC 的著作權聲明「All rights restricted」、
  不得修改（不能做衍生的國家彙總），ARIN 的條款頁 2026-11-07 是 HTTP 404、LACNIC 與 AFRINIC 沒有查到明確的條款，
  所以照手冊的退路只用 APNIC 的檔，其他國家灰色並寫明。APNIC 也有少數位址分給登記在區外國家的機構（德國、英國…），
  那些國家的主要分配在別的註冊機構，不畫。
- 國碼是登記者所在的國家，不是網路實際使用的位置；被收回的位址不在檔裡，依分配日期累計回推的歷年會低估（手冊的陷阱）。
- 時間軸：依分配日期累計到每一年年底（今年到檔案的日期）；每人位址數用 WPP 的人口。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from sources import wpp
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "ip-addresses"
URL = "https://ftp.apnic.net/stats/apnic/delegated-apnic-latest"
FIRST, LAST = 1990, 2026
# APNIC 的服務區（亞太）：東亞、東南亞、南亞、大洋洲
REGION = set("""AF AS AU BD BN BT CC CK CN CX FJ FM GU HK ID IN IO JP KH KI KP KR LA LK MH MM MN MO MP MV MY NC NF NP NR
NU NZ PF PG PH PK PN PW SB SG TH TK TL TO TV TW VN VU WF WS""".split())


def build() -> None:
    path = download(URL, "apnic", "delegated-apnic-latest.txt")
    v4, v6, asn = (defaultdict(lambda: defaultdict(float)) for _ in range(3))
    first: dict[str, int] = {}
    for line in open(path, encoding="utf-8"):
        f = line.strip().split("|")
        if line.startswith("#") or len(f) < 7 or f[1] in ("*", "") or f[6] not in ("allocated", "assigned") or f[1] not in REGION:
            continue
        cc, kind, value, date = f[1], f[2], f[4], f[5]
        year = max(FIRST, int(date[:4]))
        if kind == "ipv4":
            v4[cc][year] += int(value)
            first[cc] = min(first.get(cc, 9999), int(date[:4]))
        elif kind == "ipv6":
            v6[cc][year] += 2 ** (32 - int(value))
        elif kind == "asn":
            asn[cc][year] += int(value)
    years = list(range(FIRST, LAST + 1))

    def cumulative(d: dict[str, dict[int, float]]) -> dict[str, list[float]]:
        out = {}
        for cc, by_year in d.items():
            iso3 = from_alpha2(cc)
            run, row = 0.0, []
            for y in years:
                run += by_year.get(y, 0)
                row.append(run)
            if iso3:
                out[iso3] = row
        return out

    c4, c6, ca = cumulative(v4), cumulative(v6), cumulative(asn)
    hints = {from_alpha2(cc): f"最早在 {y} 年分到 IPv4 位址" for cc, y in first.items() if from_alpha2(cc)}
    hints_en = {from_alpha2(cc): f"First IPv4 allocation in {y}" for cc, y in first.items() if from_alpha2(cc)}
    pop = wpp.demographic(["TPopulation1July"], last_year=LAST)["TPopulation1July"]  # 千人
    per = {c: [round(v / (pop[c][y] * 1000), 6) if pop.get(c, {}).get(y) and v else None for y, v in zip(years, row)] for c, row in c4.items()}
    lic = "APNIC 統計檔的使用條件（免費使用，APNIC 不負責）"
    extra = dict(license=lic)  # 區外國家的說明在前端的 missing
    write_json(OUT / "ipv4-per-person.json", indicator_file("ipv4-per-person", "個/人", years, per, hints=hints, hintsEn=hints_en, **extra))
    write_json(OUT / "ipv4.json", indicator_file("ipv4", "個", years, {c: [round(v) or None for v in r] for c, r in c4.items()}, hints=hints, hintsEn=hints_en, **extra))
    write_json(OUT / "ipv6.json", indicator_file("ipv6", "個 /32", years, {c: [round(v, 3) or None for v in r] for c, r in c6.items()}, **extra))
    write_json(OUT / "asn.json", indicator_file("asn", "個", years, {c: [round(v) or None for v in r] for c, r in ca.items()}, **extra))

    last = len(years) - 1
    print(f"  APNIC 區 {len(c4)} 個經濟體有 IPv4；IPv4 合計 {sum(r[last] for r in c4.values()):,.0f}")
    print(f"  IPv4：{sorted(((round(r[last]), c) for c, r in c4.items()), reverse=True)[:8]}")
    print(f"  每人：{sorted(((v[last], c) for c, v in per.items() if v[last]), reverse=True)[:10]} … 低 {sorted((v[last], c) for c, v in per.items() if v[last])[:8]}")
    print(f"  台灣 IPv4 {c4['TWN'][last]:,.0f}（每人 {per['TWN'][last]}，最早 {first['TW']}）IPv6 {c6['TWN'][last]:.0f} ASN {ca['TWN'][last]:.0f}")
    print(f"  IPv6：{sorted(((round(r[last]), c) for c, r in c6.items()), reverse=True)[:8]}；ASN：{sorted(((round(r[last]), c) for c, r in ca.items()), reverse=True)[:8]}")
    print(f"  1995 年台灣 {c4['TWN'][1995 - FIRST]:,.0f}、日本 {c4['JPN'][1995 - FIRST]:,.0f}、中國 {c4['CHN'][1995 - FIRST]:,.0f}")
