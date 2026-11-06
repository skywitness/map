"""各國在讀什麼：從哪裡取得新聞（2026-11-06，製作手冊第二十四批 423；步驟 news-dnr，輸出 topics/reads/）。

- Reuters Institute Digital News Report 2026（48 個市場，2026 年 1–2 月 YouGov 的線上問卷）。PDF 第 2 頁寫明
  「This work is licensed under CC BY 4.0」（網站本身沒有授權頁，以 PDF 為準）；2026-11-06 讀過 robots.txt
  （/sites/default/files/ 沒有禁止）。PDF 33 MB，用 pypdf 抽字（要裝 fontTools，否則字型編碼會出錯）。
- 每個市場頁有「Also / News podcasts x% (±n) / AI chatbots y% (±n)」：每週用新聞 podcast、用 AI 聊天機器人取得新聞
  的比例。抽字時字距會斷（「T aiwan」「AI cha tbots」），先把空白合併再比對。塞爾維亞的版面不同，數字寫在註腳
  「news podcasts (11%), and AI chatbots (9%)」；印度、肯亞、奈及利亞、南非、摩洛哥的頁面沒有這兩個數字，不畫。
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
        if p:
            pods.setdefault(iso3, int(p.group(1)))
        if b:
            bots.setdefault(iso3, int(b.group(1) or b.group(2)))
    if not 40 <= len(pods) <= 48:
        raise RuntimeError(f"Digital News Report：新聞 podcast 只抽到 {len(pods)} 個市場，PDF 的版面可能改了")
    for ind, values in (("news-podcasts", pods), ("news-ai-chatbots", bots)):
        write_json(OUT / f"{ind}.json", indicator_file(ind, "%", [YEAR], {k: [v] for k, v in sorted(values.items())},
                                                       license="CC BY 4.0"))
        ranked = sorted(((v, k) for k, v in values.items()), reverse=True)
        print(f"  {ind}：{len(values)} 個市場；最高 {ranked[:6]}；最低 {ranked[-5:]}；台灣 {values.get('TWN')}")
