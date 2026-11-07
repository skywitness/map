"""旅行實用：外國旅客購物退稅（2026-11-07，製作手冊第二十四批 433 合併的候選 1026；步驟 tax-refund，輸出 topics/travel/）。

- 使用者 2026-11-07 決定：外國挑 15–20 國逐國回各國稅務機關、海關的官方頁核對（英文維基的 55 國清單與門檻表過期，不用）；
  台灣先接關務署的退稅統計。下面的 COUNTRIES 是 2026-11-07 用 curl（誠實的 User-Agent、先讀 robots.txt）讀官方頁逐項核對的
  結果，每一國附官方網址；官方頁沒寫的項目寫「未核對」，沒有用二手資料補。義大利（官方網站全部 403）、馬來西亞（GST 時期的
  退稅頁 503，現行頁沒提到）沒核對成功，不畫。
- 台灣的統計：財政部關務署「辦理旅客購買特定貨物退稅人次、筆數、金額統計表」（data.gov.tw 17153、17154、17156，政府資料
  開放授權條款第 1 版，opendata.customs.gov.tw 的 CSV），逐月逐關別；2017 年起高雄機場分關只有全年一列（月份「1〜12」），
  一起加。開放資料只到 2021 年（民國 110 年）。
"""
from __future__ import annotations

import csv
import io

from common import OUT_DIR, download, indicator_file, write_json, write_manifest_part

OUT = OUT_DIR / "topics" / "travel"
YEAR = 2026
CUSTOMS = {"persons": 17153, "amount": 17156}
# 類別（src/topics/travel-fees.ts 的 REFUND_KINDS）
HAS, PENDING, ABOLISHED, NONE = 1, 2, 3, 4
# (類別, 中文說明, 英文說明, 官方網址)
COUNTRIES: dict[str, tuple[int, str, str, str]] = {
    "JPN": (HAS, "2026 年 11 月 1 日起改成先付含稅價、出境時海關確認後再退；同一店同一天不含稅 5,000 日圓以上，購買隔天起 90 天內出國；消費稅 10%",
            "From 1 November 2026 shoppers pay the tax-inclusive price and get the tax back after customs checks on departure; ¥5,000 or more before tax at one shop in one day, leaving within 90 days of the day after purchase; consumption tax 10%",
            "https://www.nta.go.jp/publication/pamph/shohi/menzei/201805/format/002.htm"),
    "KOR": (HAS, "每張收據 15,000 韓元以上，購買後 3 個月內出境（稅率未核對）",
            "KRW 15,000 or more per receipt, leaving within 3 months of purchase (VAT rate not checked)",
            "https://www.customs.go.kr/english/cm/cntnts/cntntsView.do?mi=10803&cntntsId=5504"),
    "CHN": (HAS, "同一天在同一家退稅商店 200 元人民幣以上（含增值稅），購買日到離境日不超過 90 天；增值稅 13%",
            "CN¥200 or more (VAT included) at one tax-refund shop in one day, leaving within 90 days of purchase; VAT 13%",
            "https://www.gov.cn/zhengce/zhengceku/202504/content_7021169.htm"),
    "SGP": (HAS, "100 新加坡元以上（含 GST，同一店家同一天最多 3 張收據合計），購買後 2 個月內從樟宜或實里達機場出境，16 歲以上；GST 9%",
            "S$100 or more including GST (up to 3 same-day receipts from one shop), leaving via Changi or Seletar within 2 months; aged 16 or over; GST 9%",
            "https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/consumers/tourist-refund-scheme"),
    "THA": (HAS, "每張退稅申請表 2,000 泰銖以上（含稅），購買後 60 天內帶出；加值稅 7%（減徵到 2027 年 9 月 30 日）",
            "THB 2,000 or more (VAT included) per refund form, taken out within 60 days of purchase; VAT 7% (reduced rate extended to 30 September 2027)",
            "https://www.rd.go.th/english/56331.html"),
    "AUS": (HAS, "同一家商店（同一 ABN）合計 300 澳幣以上（含 GST），離境前 60 天內購買（稅率未核對）",
            "A$300 or more including GST from one business (same ABN), bought within 60 days before departure (GST rate not checked)",
            "https://www.abf.gov.au/entering-and-leaving-australia/tourist-refund-scheme"),
    "GBR": (ABOLISHED, "大不列顛（英格蘭、蘇格蘭、威爾斯）的旅客退稅隨脫歐過渡期結束取消，2021 年 1 月 1 日起不能退；北愛爾蘭還有；加值稅 20%",
            "Abolished in Great Britain (England, Scotland, Wales) at the end of the Brexit transition period: no refunds from 1 January 2021; still available in Northern Ireland; VAT 20%",
            "https://www.gov.uk/government/publications/revenue-and-customs-brief-21-2020-withdrawal-of-the-vat-retail-export-scheme-and-the-tax-free-shopping-concession/revenue-and-customs-brief-21-2020-withdrawal-of-the-vat-retail-export-scheme-and-the-tax-free-shopping-concession"),
    "CAN": (ABOLISHED, "訪客退稅（Visitor Rebate Program）已取消，現行的消費稅法不讓個人旅客退 GST（2007 年改成只給會議與團體旅遊的方案）；GST 5%",
            "The Visitor Rebate Program was eliminated: the current Excise Tax Act gives individual visitors no GST rebate (replaced in 2007 by a programme for conventions and tour packages only); GST 5%",
            "https://laws-lois.justice.gc.ca/eng/acts/E-15/section-252.html"),
    "FRA": (HAS, "超過 100 歐元（含稅），購買月份之後第 3 個月結束前在海關驗章，16 歲以上；海關兩頁的算法寫得不同（同店同一天／同品牌 3 天內）；加值稅 20%",
            "Over €100 including tax, validated by customs before the end of the third month after purchase; aged 16 or over; two customs pages count it differently (one shop in one day / one brand within 3 days); VAT 20%",
            "https://www.douane.gouv.fr/fiche/la-detaxe-en-france-pour-les-touristes-pablo"),
    "DEU": (HAS, "每張收據超過 50 歐元（含稅），購買月份之後第 3 個月結束前出境，由商家退；加值稅 19%",
            "Over €50 including VAT per receipt, leaving before the end of the third month after purchase; refunded by the shop; VAT 19%",
            "https://www.zoll.de/DE/Privatpersonen/Reisen/Reisen-nach-Deutschland-aus-einem-nicht-eu-Staat/Zoll-und-Steuern/Tax-free-einkaufen/tax-free-einkaufen_node.html"),
    "ESP": (HAS, "2018 年起沒有最低金額，交貨後 3 個月內帶出；加值稅 21%",
            "No minimum since 2018; goods taken out within 3 months of delivery; VAT 21%",
            "https://www.boe.es/buscar/doc.php?id=BOE-A-2018-9855"),
    "NLD": (HAS, "合計 50 歐元以上（含稅），購買月份後 3 個月內帶出；加值稅 21%",
            "€50 or more including VAT, taken out within 3 months after the month of purchase; VAT 21%",
            "https://www.douane.nl/onderwerpen/reizen-en-vakantie/btw-terugvragen-bij-uitvoer/"),
    "CHE": (HAS, "至少 300 瑞士法郎（含稅），90 天內帶出，由賣方退；加值稅 8.1%",
            "At least CHF 300 including VAT, taken out within 90 days; refunded by the seller; VAT 8.1%",
            "https://www.estv.admin.ch/de/tax-free-ausfuhren-im-reiseverkehr"),
    "VNM": (HAS, "有（財政部 2026 年 7 月發布新的旅客退稅規定）；門檻、期限、稅率未核對",
            "Yes (the Ministry of Finance issued new tourist refund rules in July 2026); threshold, deadline and rate not checked",
            "https://baochinhphu.vn/quy-dinh-moi-ve-hoan-thue-gtgt-hang-hoa-nguoi-nuoc-ngoai-mang-theo-khi-xuat-canh-102260708170013006.htm"),
    "IDN": (HAS, "門檻看的是稅額：可退的加值稅合計 50 萬印尼盾以上（每張發票的稅至少 5 萬），出境前 30 天內購買（稅率未核對）",
            "The threshold is on the tax itself: refundable VAT of at least Rp500,000 in total (at least Rp50,000 per invoice), bought within 30 days before departure (rate not checked)",
            "https://pajak.go.id/sites/default/files/2026-06/Informasi%20VAT%20Refund%20for%20Tourists%20(22052026).pdf"),
    "TUR": (HAS, "同一張發票不含稅超過 1,000 里拉，發票日起 3 個月內帶出（稅率未核對）",
            "Over TRY 1,000 before tax on one invoice, taken out within 3 months of the invoice date (rate not checked)",
            "https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=19631&mevzuatTur=Teblig&mevzuatTertip=5"),
    "NZL": (NONE, "沒有旅客退稅（只能在免稅店買，或由商家直接寄出國外免 GST）；GST 15%",
            "No tourist refund (only duty-free shops, or goods exported directly by the seller zero-rated); GST 15%",
            "https://www.customs.govt.nz/travel-to-and-from-new-zealand/leaving-new-zealand"),
    "PHL": (PENDING, "2024 年立法（RA 12079），施行細則 2025 年 3 月 24 日簽署：認可商店 3,000 披索以上、購買後 60 天內帶出；2025 年 11 月還在遴選退稅業者，實際開始退稅了沒有未核對",
            "Legislated in 2024 (RA 12079), implementing rules signed on 24 March 2025: PHP 3,000 or more at accredited stores, taken out within 60 days; refund operators were still being selected in November 2025, and whether refunds have started was not checked",
            "https://www.dof.gov.ph/ph-is-now-vat-free-for-foreign-tourists/"),
    "TWN": (HAS, "同一天在同一家特約商店含稅 2,000 元以上，購買日起 90 天內出境；現場小額退稅同一天同一家 48,000 元以下（單次來台累計 12 萬、同一年 24 萬元為限）",
            "NT$2,000 or more including tax at one participating shop in one day, leaving within 90 days of purchase; on-the-spot refunds for up to NT$48,000 per shop per day (NT$120,000 per visit and NT$240,000 per year)",
            "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=K0110023"),
}


def _customs(dataset: int) -> dict[int, float]:
    """關務署的退稅統計：民國年 → 全國合計（各月加全年一列的單位）"""
    raw = download(f"https://opendata.customs.gov.tw/data/{dataset}/csv.csv", "customs", f"refund-{dataset}.csv")
    rows = list(csv.reader(io.StringIO(raw.read_bytes().decode("utf-8-sig"))))
    total: dict[int, float] = {}
    for r in rows[1:]:
        if len(r) < 5 or not r[4].strip():
            continue
        y = int(r[0]) + 1911
        total[y] = total.get(y, 0) + float(r[4].replace(",", ""))
    return total


def build() -> None:
    persons, amount = _customs(CUSTOMS["persons"]), _customs(CUSTOMS["amount"])
    peak = max(amount, key=amount.get)
    last = max(amount)
    tw = (f"關務署統計：2006 年 {persons[2006]:,.0f} 人次、退稅 {amount[2006] / 1e4:,.0f} 萬元，{peak} 年最多 "
          f"{persons[peak] / 1e4:.1f} 萬人次、{amount[peak] / 1e8:.1f} 億元，2019 年 {persons[2019] / 1e4:.1f} 萬人次、"
          f"{amount[2019] / 1e8:.1f} 億元，2020 年起因疫情幾乎歸零（開放資料只到 {last} 年，{last} 年 {persons[last]:,.0f} 人次）")
    tw_en = (f"Customs statistics: {persons[2006]:,.0f} refunds worth NT${amount[2006] / 1e6:,.0f} million in 2006, peaking at "
             f"{persons[peak]:,.0f} worth NT${amount[peak] / 1e9:.2f} billion in {peak}, {persons[2019]:,.0f} worth "
             f"NT${amount[2019] / 1e9:.2f} billion in 2019, and almost none from 2020 because of the pandemic (open data end in {last})")
    values = {c: [v[0]] for c, v in sorted(COUNTRIES.items())}
    hints = {c: v[1] for c, v in COUNTRIES.items()}
    hints_en = {c: v[2] for c, v in COUNTRIES.items()}
    hints["TWN"] += "。" + tw
    hints_en["TWN"] += ". " + tw_en
    no = {"ITA": "官方網站讀不到（2026-11-07 回 403），沒核對", "MYS": "官方頁沒提到旅客退稅，沒核對"}
    no_en = {"ITA": "Official sites could not be read (HTTP 403 on 7 November 2026), so not checked",
             "MYS": "Official pages do not mention tourist refunds, so not checked"}
    write_json(OUT / "tax-refund.json", indicator_file("tax-refund", "類別", [YEAR], values, hints=hints, hintsEn=hints_en,
                                                       noValue=no, noValueEn=no_en))
    write_manifest_part(OUT, "travel", "tax-refund", {"sources": [v[3] for v in COUNTRIES.values()] + [
        f"https://data.gov.tw/dataset/{d}（財政部關務署，政府資料開放授權條款第 1 版）" for d in (17153, 17154, 17156)]})
    from collections import Counter
    print(f"  旅客退稅：{len(values)} 國 {Counter(v[0] for v in values.values())}")
    print(f"    台灣：{tw}")
    print(f"    各年：{[(y, round(persons.get(y, 0)), round(amount[y] / 1e6, 1)) for y in sorted(amount)]}")
