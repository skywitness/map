"""各國在讀什麼：從哪裡取得新聞（2026-11-06，製作手冊第二十四批 423；步驟 news-dnr，輸出 topics/reads/）。

- Reuters Institute Digital News Report 2026（48 個市場，2026 年 1–2 月 YouGov 的線上問卷）。PDF 第 2 頁寫明
  「This work is licensed under CC BY 4.0」（網站本身沒有授權頁，以 PDF 為準）；2026-11-06 讀過 robots.txt
  （/sites/default/files/ 沒有禁止）。PDF 33 MB，用 pypdf 抽字（要裝 fontTools，否則字型編碼會出錯）。
- 每個市場頁有「Also / News podcasts x% (±n) / AI chatbots y% (±n)」：每週用新聞 podcast、用 AI 聊天機器人取得新聞
  的比例。抽字時字距會斷（「T aiwan」「AI cha tbots」），先把空白合併再比對。塞爾維亞的版面不同，數字寫在註腳
  「news podcasts (11%), and AI chatbots (9%)」；印度、肯亞、奈及利亞、南非、摩洛哥的頁面沒有這兩個數字，不畫。
- 2026-11-07 補：整體信任新聞、有時或常常避開新聞、過去一年付費看線上新聞（同一頁的三個數字）。社群媒體看新聞的比例
  在圖裡、抽字後分不出是哪一條線，沒做；歷年折線要讀 2015–2025 年的報告，沒做。
- 2026-11-08（製作手冊第二十七批 658，候選 1440）：每個市場頁的「TOP SOCIAL, MESSAGING, AND VIDEO NETWORKS」表，
  YouTube、Facebook、Instagram、TikTok 的每週觸達，「看新聞」與「整體」兩欄（抽字後是「YouT ube 48% (+2) 79%」：
  前一個是看新聞、括號是跟前一年的差、後一個是整體；台灣 YouTube 48%／79% 跟手冊一致）。表只列每個市場前幾名的平台，
  沒列的不畫。
- 只限「新聞」podcast，不是所有 podcast 的收聽率。樣本是上網的人，網路普及率低的地方偏向年輕、都市、高學歷。
"""
from __future__ import annotations

import re

from common import OUT_DIR, download, indicator_file, write_json
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "reads"
URL = "https://reutersinstitute.politics.ox.ac.uk/sites/default/files/2026-06/DNR%202026%20FINAL_2.pdf"
YEAR = 2026
EXTRA = {"Czech Republic": "CZE", "Turkey": "TUR"}


def build() -> None:
    from pypdf import PdfReader

    reader = PdfReader(str(download(URL, "reuters-dnr", "DNR-2026.pdf")))
    pods: dict[str, int] = {}
    bots: dict[str, int] = {}
    trust: dict[str, int] = {}
    avoid: dict[str, int] = {}
    pay: dict[str, int] = {}
    platforms = {"youtube": "YouT ?ube", "facebook": "Facebook", "instagram": "Instagram", "tiktok": "TikT ?ok"}
    reach_all: dict[str, dict[str, int]] = {k: {} for k in platforms}
    reach_news: dict[str, dict[str, int]] = {k: {} for k in platforms}
    for page in reader.pages[60:]:
        text = re.sub(r"\s+", " ", page.extract_text() or "")
        m = re.search(r"Digital News Report 2026 \| (.+?) (?=[A-Z]{2,}|TV|Trust|\d)", text)
        if not m:
            continue
        name = re.sub(r"\b([A-Z]) (?=[a-z])", r"\1", m.group(1)).strip()  # 「T aiwan」→「Taiwan」
        iso3 = EXTRA.get(name) or from_name(name)
        if not iso3:
            continue
        flat = text.replace("cha tbots", "chatbots").replace("Cha tbots", "Chatbots")
        p = re.search(r"News podcasts\s*\(?\s*(\d+)\s*%", flat, re.I)
        # 「…news podcasts, and AI chatbots 0% 50% 100%」是圖的刻度（摩洛哥），不算；塞爾維亞是「AI chatbots (9%)」
        b = re.search(r"(?<!and )AI chatbots\s*(\d+)\s*%|AI chatbots\s*\((\d+)\s*%", flat, re.I)
        # 2026-11-07 補：整體信任新聞（「25% (-5) GLOBAL AVERAGE 37% OVERALL TRUST」）、避開新聞與付費訂閱線上新聞
        # （「19% (-2) 10% (-4) AVOID THE NEWS」：前一個是有時或常常避開新聞，後一個是過去一年付費；用希臘 60%／8%、
        # 挪威 39%／40% 核對過順序。只有一個數字的〔土耳其〕是避開新聞，付費沒有寫）
        t = re.search(r"(\d+)% \([^)]*\) GLOBAL AVERAGE \d+% OVERALL TRUST", flat)
        if t:
            trust.setdefault(iso3, int(t.group(1)))
        # 塞爾維亞的版面不同：「Social media 64% (-3) 53% (+7) AVOID THE NEWS」前一個是社群媒體，只有避開新聞
        two = re.search(r"(?<!media )\b(\d+)% \([^)]*\) (\d+)% \([^)]*\) AVOID THE NEWS", flat)
        one = re.search(r"(\d+)% \([^)]*\) AVOID THE NEWS", flat)
        if two:
            avoid.setdefault(iso3, int(two.group(1)))
            pay.setdefault(iso3, int(two.group(2)))
        elif one:
            avoid.setdefault(iso3, int(one.group(1)))
        for key, pat in platforms.items():
            pm = re.search(rf"\b{pat}\s+(\d+)%\s*\([^)]*\)\s*(\d+)%", text)
            if pm:
                reach_news[key].setdefault(iso3, int(pm.group(1)))
                reach_all[key].setdefault(iso3, int(pm.group(2)))
        if p:
            pods.setdefault(iso3, int(p.group(1)))
        if b:
            bots.setdefault(iso3, int(b.group(1) or b.group(2)))
    if not 40 <= len(pods) <= 48:
        raise RuntimeError(f"Digital News Report：新聞 podcast 只抽到 {len(pods)} 個市場，PDF 的版面可能改了")
    for key in platforms:
        for folder, data in (("social-reach", reach_all), ("social-news", reach_news)):
            write_json(OUT / folder / f"{key}.json", indicator_file(f"{folder}-{key}", "%", [YEAR], {k: [v] for k, v in sorted(data[key].items())},
                                                                    license="CC BY 4.0"))
        ranked = sorted(((v, k) for k, v in reach_all[key].items()), reverse=True)
        print(f"  {key}：整體 {len(reach_all[key])} 個市場 {ranked[:5]}…{ranked[-4:]}；台灣 {reach_all[key].get('TWN')}／看新聞 {reach_news[key].get('TWN')}")
    for ind, values in (("news-podcasts", pods), ("news-ai-chatbots", bots), ("news-trust", trust), ("news-avoid", avoid),
                        ("news-pay", pay)):
        write_json(OUT / f"{ind}.json", indicator_file(ind, "%", [YEAR], {k: [v] for k, v in sorted(values.items())},
                                                       license="CC BY 4.0"))
        ranked = sorted(((v, k) for k, v in values.items()), reverse=True)
        print(f"  {ind}：{len(values)} 個市場；最高 {ranked[:6]}；最低 {ranked[-5:]}；台灣 {values.get('TWN')}")
