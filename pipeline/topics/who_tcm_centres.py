"""國際組織：WHO 的傳統、輔助與整合醫學合作中心（2026-11-08，製作手冊第二十九批 707，候選 1558；步驟 who-tcm-centres）。

- 來源：WHO 傳統、輔助與整合醫學團隊的頁面「WHO Collaborating Centres for Traditional, Complementary and Integrative Medicine」
  （頁面寫「Updated 29 March 2023」，2026-11-08 重新抓還是這一版）。WHO 的合作中心資料庫 apps.who.int/whocc 從 cloud 會被轉到
  WHO 首頁，讀不到。www.who.int 的 robots.txt 只擋一串點名的機器人，沒有限制這個 User-Agent。
- 授權：WHO 網站的 Terms of use（Copyright notice）原文「Extracts of the information in the web site may be reviewed, reproduced or
  translated for research or private study but not for sale or for use in conjunction with commercial purposes. Any use of
  information in the web site should be accompanied by an acknowledgment of WHO as the source, citing the uniform resource
  locator (URL) of the article.」——非商業、要註明 WHO 與網址（有條件）。這裡只取「哪個機構、WHO 編號、在哪一國」的事實
  自行整理在 CENTRES，不轉載頁面；中文名稱自己譯。頁面的 SHA-256 不固定（WHO 的頁面有動態內容），改成核對 CENTRES 的
  每一個 WHO 編號都還在頁面上、頁面上也沒有多出來的編號，對不上就報錯（WHO 改了名單要重新整理）。
- 香港、澳門：WHO 的頁面掛在 China 底下（編號 CHN-115、CHN-131），照網站的慣例（製作手冊第十五節 1-f）各自一列、不算進中國。
- 位置：機構的英文維基條目（找不到就用所在城市的條目）經 Wikidata 的座標（sources/enwiki_coords.py，CC0），不是 WHO 的資料。
"""
from __future__ import annotations

import re
from collections import Counter

from common import OUT_DIR, download, indicator_file, points_file, write_json, write_manifest_part, write_points
from sources import enwiki_coords

OUT = OUT_DIR / "topics" / "organizations"
URL = ("https://www.who.int/teams/integrated-health-services/traditional-complementary-and-integrative-medicine/"
       "who-collaborating-centres-for-traditional-complementary-and-integrative-medicine")
AS_OF = "2023-03-29"
YEAR = 2026

# (WHO 編號, 國家或地區, 中文名稱, 英文名稱〔WHO 頁面的寫法〕, 所在地, 英文維基條目〔機構優先，最後一個是城市〕)
CENTRES = [
    ("USA-407", "USA", "伊利諾大學芝加哥分校藥學院", "College of Pharmacy, University of Illinois at Chicago", "芝加哥",
     ["University of Illinois Chicago", "Chicago"]),
    ("PER-10", "PER", "祕魯社會保險署（EsSalud）輔助醫學部", "Gerencia de Medicina Complementaria, Seguro Social de Salud del Peru", "利馬",
     ["EsSalud", "Lima"]),
    ("ITA-73", "ITA", "米蘭大學醫學生物氣候學、生物科技與自然醫學研究中心",
     "Centre of Research in Medical Bioclimatology, Biotechnologies & Natural Medicine, State University of Milan", "米蘭",
     ["University of Milan", "Milan"]),
    ("NOR-20", "NOR", "挪威北極大學國家輔助與替代醫學研究中心（NAFKAM）",
     "National Research Center in Complementary and Alternative Medicine (NAFKAM), The Arctic University of Norway", "特羅姆瑟",
     ["UiT The Arctic University of Norway", "Tromsø"]),
    ("UNK-295", "GBR", "皇家倫敦整合醫學醫院（倫敦大學學院醫院 NHS 基金信託）",
     "Royal London Hospital for Integrated Medicine, University College London Hospitals NHS Foundation Trust", "倫敦",
     ["Royal London Hospital for Integrated Medicine", "London"]),
    ("IND-117", "IND", "古吉拉特阿育吠陀大學阿育吠陀研究所教學研究所",
     "Institute for Post Graduate Teaching and Research in Ayurveda, Gujarat Ayurved University", "賈姆納加爾",
     ["Gujarat Ayurved University", "Jamnagar"]),
    ("IND-118", "IND", "莫拉吉‧德賽國家瑜伽研究所瑜伽治療與訓練系", "Department of Yoga Therapy and Training, Morarji Desai National Institute of Yoga",
     "新德里", ["Morarji Desai National Institute of Yoga", "New Delhi"]),
    ("THA-83", "THA", "瑪希隆大學詩里拉吉醫院醫學院應用泰國傳統醫學中心",
     "Center of Applied Thai Traditional Medicine, Faculty of Medicine Siriraj Hospital, Mahidol University", "曼谷",
     ["Siriraj Hospital", "Bangkok"]),
    ("KDR-6", "PRK", "高麗傳統醫學科學院", "Academy of Koryo Traditional Medicine Science", "平壤", ["Pyongyang"]),
    ("CHN-30", "CHN", "復旦大學上海醫學院中西醫結合研究院",
     "Academy of Integrated Traditional Chinese and Modern Medicine, Shanghai Medical College, Fudan University", "上海",
     ["Fudan University Shanghai Medical College", "Fudan University", "Shanghai"]),
    ("CHN-32", "CHN", "中國中醫科學院針灸研究所", "Institute of Acupuncture & Moxibustion, China Academy of Chinese Medical Sciences", "北京",
     ["China Academy of Chinese Medical Sciences", "Beijing"]),
    ("CHN-33", "CHN", "上海中醫藥大學", "Shanghai University of Traditional Chinese Medicine", "上海",
     ["Shanghai University of Traditional Chinese Medicine", "Shanghai"]),
    ("CHN-34", "CHN", "中國中醫科學院中藥研究所", "Institute of Chinese Materia Medica, China Academy of Chinese Medical Sciences", "北京",
     ["China Academy of Chinese Medical Sciences", "Beijing"]),
    ("CHN-35", "CHN", "中國中醫科學院（Institute of Clinical Research & Information）",
     "Institute of Clinical Research & Information, China Academy of Chinese Medical Sciences", "北京",
     ["China Academy of Chinese Medical Sciences", "Beijing"]),
    ("CHN-36", "CHN", "南京中醫藥大學", "Nanjing University of Chinese Medicine", "南京", ["Nanjing University of Chinese Medicine", "Nanjing"]),
    ("CHN-44", "CHN", "中國醫學科學院藥用植物研究所", "Institute of Medicinal Plant Development, Chinese Academy of Medical Sciences", "北京",
     ["Chinese Academy of Medical Sciences", "Beijing"]),
    ("CHN-115", "HKG", "香港衛生署中醫藥規管辦公室", "Chinese Medicine Regulatory Office, Department of Health, Hong Kong SAR", "香港",
     ["Department of Health (Hong Kong)", "Hong Kong"]),
    ("CHN-131", "MAC", "澳門衛生局", "Health Bureau, Macao SAR", "澳門", ["Health Bureau (Macau)", "Macau"]),
    ("CHN-139", "CHN", "中國食品藥品檢定研究院中藥民族藥檢定所",
     "Institute for Control of Chinese Traditional Medicine and Ethnic Medicine, National Institutes for Food and Drug Control", "北京",
     ["National Institutes for Food and Drug Control", "Beijing"]),
    ("JPN-46", "JPN", "北里大學東洋醫學綜合研究所", "Oriental Medicine Research Centre, Kitasato University", "東京", ["Kitasato University", "Tokyo"]),
    ("JPN-54", "JPN", "富山大學醫學藥學研究部和漢診療學講座",
     "Department of Japanese Oriental Medicine, Graduate School of Medicine and Pharmaceutical Sciences, University of Toyama", "富山",
     ["University of Toyama", "Toyama (city)"]),
    ("MAA-19", "MYS", "馬來西亞衛生部傳統與輔助醫學司", "Traditional and Complementary Medicine Division, Ministry of Health Malaysia", "布城",
     ["Ministry of Health (Malaysia)", "Putrajaya"]),
    ("KOR-17", "KOR", "慶熙大學東西醫學研究所", "East-West Medical Research Institute, Kyung Hee University", "首爾", ["Kyung Hee University", "Seoul"]),
    ("KOR-89", "KOR", "韓國韓醫學研究院", "Korea Institute of Oriental Medicine", "大田", ["Korea Institute of Oriental Medicine", "Daejeon"]),
    ("KOR-111", "KOR", "韓國韓醫藥振興院", "National Institute for Korean Medicine Development", "慶山",
     ["National Institute for Korean Medicine Development", "Gyeongsan"]),
    ("VTN-4", "VNM", "越南國家傳統醫學醫院", "National Hospital of Traditional Medicine", "河內", ["Hanoi"]),
]
TW = "台灣不是 WHO 會員國，沒有 WHO 合作中心；台灣的國家級中醫藥研究機構是衛福部國家中醫藥研究所"
TW_EN = ("Taiwan is not a WHO Member State and has no WHO collaborating centre; its national Chinese medicine research body is "
         "the National Research Institute of Chinese Medicine under the Ministry of Health and Welfare")


def _check_page() -> None:
    page = download(URL, "who-tcm", "collaborating-centres.html").read_text(encoding="utf-8")
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", page))
    if f"Updated {29} March 2023" not in text:
        raise RuntimeError("WHO 合作中心頁面的更新日期換了（原本是 2023-03-29），重新整理 CENTRES")
    on_page = set(re.findall(r"Ref\. No: ([A-Z]{3}-\d+)", text))
    ours = {c[0] for c in CENTRES}
    if on_page != ours:
        raise RuntimeError(f"WHO 合作中心頁面的編號跟 CENTRES 不同：頁面多 {sorted(on_page - ours)}、頁面少 {sorted(ours - on_page)}")


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    _check_page()
    titles = sorted({t for c in CENTRES for t in c[5]})
    found = enwiki_coords.coords(titles, "who-tcm-centres")
    rows = []
    for ref, iso3, zh, en, place, cands in CENTRES:
        hit = next((t for t in cands if t in found), None)
        if not hit:
            raise RuntimeError(f"{ref} 的位置查不到：{cands}")
        rows.append({"lon": round(found[hit]["lon"], 4), "lat": round(found[hit]["lat"], 4), "iso3": iso3, "ref": ref, "name": zh,
                     "nameEn": en, "place": place, "at": hit})
    # 同一個條目（中國中醫科學院的三個所）的點錯開一點，地圖上看得到三個
    seen: Counter = Counter()
    for r in rows:
        k = (r["lon"], r["lat"])
        if seen[k]:
            r["lon"] = round(r["lon"] + 0.02 * seen[k], 4)
        seen[k] += 1
    count = Counter(r["iso3"] for r in rows)
    hints = {c: "、".join(f"{r['name']}（{r['ref']}）" for r in rows if r["iso3"] == c) for c in count}
    hints_en = {c: "; ".join(f"{r['nameEn']} ({r['ref']})" for r in rows if r["iso3"] == c) for c in count}
    write_json(OUT / "who-tcm-centres.json", indicator_file("who-tcm-centres", "個", [YEAR], {c: [v] for c, v in sorted(count.items())},
                                                            hints=hints, hintsEn=hints_en, noValue={"TWN": TW}, noValueEn={"TWN": TW_EN}))
    write_points(OUT / "who-tcm-centres-points.json",
                 points_file([{k: v for k, v in r.items() if k != "at"} for r in rows], ["lon", "lat", "iso3", "ref", "place", "name", "nameEn"],
                             {"lon": 0.0001, "lat": 0.0001}, strings=("iso3", "ref", "place")), ("name", "nameEn"))
    write_manifest_part(OUT, "organizations", "who-tcm-centres", {
        "source": "WHO, WHO Collaborating Centres for Traditional, Complementary and Integrative Medicine (updated 29 March 2023)",
        "asOf": AS_OF,
    })
    print(f"  WHO 傳統醫學合作中心 {len(rows)} 個、{len(count)} 個國家或地區：" + "、".join(f"{c} {v}" for c, v in count.most_common()))
    print("    位置：" + "；".join(f"{r['ref']} {r['at']}" for r in rows))
