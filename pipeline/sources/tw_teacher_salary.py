"""台灣公立國中教師的法定年薪（自算，製作手冊第七批 134；DESIGN.md 第 216 點）。

照 OECD《Education at a Glance》的定義：公立國中教師、年資 15 年、最普遍的資格，依薪級表的法定年薪（含固定的年度獎金），
換成購買力平價美元。數字都是法令訂的，寫成常數，出處如下：
- 最普遍的資格是碩士：教育部「114 學年學校基本概況統計結果提要分析」國中教師具研究所學歷 66.7%。
- 薪點：《教師待遇條例》（全國法規資料庫 pcode=H0150046）附表二碩士起敘 245 薪點，年資每滿一年晉一級，15 年 → 550 薪點
  （附表一：具碩士學位者本薪最高 525、年功薪至 650）。
- 薪額：人事總處《全國軍公教員工待遇支給要點》附表二「公務人員俸額表」的教育人員欄，550 → 49,560 元（114-01-01 生效）
  https://www.dgpa.gov.tw/uploads/dgpa/files/202505/7927abfd-d520-43d5-913e-c616bf4a16e7.pdf
- 學術研究加給：「公立中小學校教育人員學術研究加給表」支本薪 475 薪點以上者 35,780 元（114-01-01 生效）。
  表是行政院 114-04-22 院授人給字第 1140000001U 號函的附件（依條例第 15 條，由教育部擬訂、報行政院核定），
  人事總處、教育部、全國法規資料庫都沒有公開；用臺南大學網站轉載的函（https://www.nutn.edu.tw/gac150/upload/120250508091042.pdf ），
  並用臺中市政府人事處 115 年 3 月編的「公教人員給與簡明表」核對（數額一致）。使用者 2026-10-30 決定照這個算、出處寫清楚。
  行政院 115-07-02 宣布專業加給（含學術研究加給）定額加 2,000 元、115-07-01 生效（要等追加預算），新表還沒公布。
- 年終工作獎金 1.5 個月：人事總處《一百十四年軍公教人員年終工作獎金發給注意事項》第三點（三）「發給一點五個月」，
  計算基礎是月支薪俸加學術研究加給（第三點（一）3）
  https://www.dgpa.gov.tw/uploads/dgpa/files/202510/41ab390a-21c6-4c11-b2bc-f249f9efa54c.pdf
- 購買力平價：IMF WEO 的 PPPEX（台灣 2025 年 13.655）。
考績獎金（甲等一個月）、地域加給、導師費等看個人或職務的不算；學術研究加給在法律上是「加給」，但所有教師都領、只看本薪級距，
OECD 會不會算進去不確定，說明寫明。
"""
from __future__ import annotations

YEAR = 2025
SALARY_POINT = 550
BASE_PAY = 49_560  # 550 薪點的月支薪額
RESEARCH_ALLOWANCE = 35_780  # 本薪 475 薪點以上的學術研究加給（月）
MONTHS = 12 + 1.5  # 12 個月加年終工作獎金 1.5 個月


def annual_ntd() -> float:
    return (BASE_PAY + RESEARCH_ALLOWANCE) * MONTHS


def teacher_salary_ppp(pppex: dict[int, float]) -> tuple[dict[int, float], str, str]:
    """（{年: 購買力平價美元}, 中文附註, 英文附註）"""
    ntd = annual_ntd()
    usd = ntd / pppex[YEAR]
    zh = (f"自算：碩士（國中教師最普遍的學歷）年資 15 年是 {SALARY_POINT} 薪點，月薪額 {BASE_PAY:,} 元加學術研究加給 {RESEARCH_ALLOWANCE:,} 元，"
          f"乘以 12 個月加年終工作獎金 1.5 個月，年薪 {ntd:,.0f} 元，用 IMF 的購買力平價（{pppex[YEAR]}）換算。"
          "依教師待遇條例、人事總處俸額表與年終獎金注意事項（114 年）；學術研究加給表是行政院函的附件，"
          "引用臺南大學網站轉載的版本並用臺中市人事處的給與簡明表核對。學術研究加給 OECD 會不會算進去不確定，"
          f"只算本薪是 {BASE_PAY * MONTHS / pppex[YEAR]:,.0f}；考績獎金、導師費不算。115 年 7 月起學術研究加給預定再加 2,000 元")
    en = (f"Own calculation: a teacher with a master's degree (the most common qualification) and 15 years of experience is on "
          f"salary point {SALARY_POINT}: NT${BASE_PAY:,} a month plus an academic research allowance of NT${RESEARCH_ALLOWANCE:,}, "
          f"times 12 months plus a 1.5-month year-end bonus, NT${ntd:,.0f} a year, converted at the IMF's PPP rate "
          f"({pppex[YEAR]}). Based on the Teachers' Remuneration Act, the DGPA salary table and the 2025 year-end bonus rules; "
          "the research allowance table is an annex to an Executive Yuan letter, cited from a copy on National University of "
          "Tainan's website and checked against Taichung City's pay summary. Whether the OECD would count the research "
          f"allowance is unclear; base pay alone gives {BASE_PAY * MONTHS / pppex[YEAR]:,.0f}. Performance bonuses and homeroom "
          "allowances are not included. The research allowance is due to rise by NT$2,000 from July 2026")
    return {YEAR: usd}, zh, en
