"""大學入學的主要方式：各國上大學主要靠哪一種考試或審查。自行整理的表。

依據英文維基百科（CC BY-SA 4.0，2026-10-30 查），所以這張表與輸出的資料檔（`main-route.json`）依 CC BY-SA 4.0 分享：
- List of admission tests to colleges and universities（revid 1381783633，2026-10-24）：大學部的入學考試，約 50 國。
  條目開頭寫明只列「不在中學課程裡的考試」，所以英國的 A-Level、德國的 Abitur、法國的 Baccalauréat 不在這篇。
- List of secondary school leaving qualifications（revid 1368870013，2026-08-11）：各國的高中畢業資格（會考）。
兩篇都是文字清單，沒有分類；很多國家幾種管道並存，這裡依條目的說明取「主要」的一種（使用者 2026-10-30 決定）：
1 全國統一入學考試：專為大學入學辦的全國（或全區）考試，跟高中畢業考試分開（中國高考、南韓修能、台灣學測……）。
2 高中畢業會考當入學資格：高中畢業考試（或成績）就是申請大學的資格（德國 Abitur、法國 Baccalauréat、英國 A-Level……）。
  高中畢業與大學入學合一的考試（俄羅斯的國家統一考試、越南的高中畢業考試）也歸這一類。
3 各校申請審查：沒有全國的入學考試，各校看高中成績、標準化測驗（SAT、ACT）、推薦信等審查（美國、加拿大）。
4 各校自辦考試：各大學自己辦入學考試（墨西哥、菲律賓、孟加拉）；第四類是使用者 2026-10-30 加的。
兩篇都沒列的國家沒有值。維基的台灣段落只寫到指定科目考試（2021 年停辦），依大考中心改成 2022 年起的分科測驗；
日本段落寫的大學入試中心考試 2021 年起改成大學入學共通測驗，也改正。
"""
from __future__ import annotations

YEAR = 2026
NATIONAL, LEAVING, REVIEW, OWN = 1, 2, 3, 4

# iso3 → (類別, 中文的考試名稱與說明, 英文)
ROUTES: dict[str, tuple[int, str, str]] = {
    # ── 1 全國統一入學考試 ──
    "TWN": (NATIONAL, "學科能力測驗（1 月）與分科測驗（7 月，2022 年起取代指定科目考試），另有繁星推薦、個人申請等管道",
            "General Scholastic Ability Test (January) and the Advanced Subjects Test (July), which replaced the earlier Department Required Test in 2022, with other routes such as Star Plan and Personal Application"),
    "CHN": (NATIONAL, "普通高等學校招生全國統一考試（高考）", "National College Entrance Examination (gaokao)"),
    "KOR": (NATIONAL, "大學修學能力試驗（修能）", "College Scholastic Ability Test (Suneung)"),
    "JPN": (NATIONAL, "大學入學共通測驗（2021 年起取代大學入試中心考試），加上各校的個別考試",
            "Common Test for University Admissions (replaced the National Center Test in 2021), plus each university's own exams"),
    "TUR": (NATIONAL, "高等教育機構考試（YKS）", "Higher Education Institutions Examination (YKS)"),
    "IRN": (NATIONAL, "全國大學入學考試（Konkur）", "Iranian University Entrance Exam (Konkur)"),
    "ISR": (NATIONAL, "心理計量入學考試（Psychometric），加上高中的 Bagrut 證書", "Psychometric Entrance Test, together with the Bagrut certificate"),
    "CHL": (NATIONAL, "高等教育入學考試（PAES，2022 年起）", "Higher Education Access Test (PAES, since 2022)"),
    "COL": (NATIONAL, "SABER 11 考試", "SABER 11 exam"),
    "CUB": (NATIONAL, "大學入學考試（Pruebas de ingreso）", "University entrance exams (Pruebas de ingreso)"),
    "BRA": (NATIONAL, "全國高中考試（ENEM）；有些大學另辦自己的入學考試（vestibular）",
            "National High School Exam (ENEM); some universities also run their own entrance exams (vestibular)"),
    "GRC": (NATIONAL, "全國大學入學考試（Panhellenic Examinations）", "Panhellenic Examinations"),
    "ESP": (NATIONAL, "大學入學考試（PAU，舊稱 Selectividad），在高中的 Bachillerato 之後",
            "University entrance exams (PAU, formerly Selectividad), after the Bachillerato"),
    "IDN": (NATIONAL, "全國考試選拔（SNBT）；另有依在校成績的 SNBP 與各校自辦的考試",
            "National selection by test (SNBT), alongside selection by school record (SNBP) and universities' own exams"),
    "NGA": (NATIONAL, "統一高等教育入學考試（UTME），另要西非或全國的高中會考（WASSCE、NECO）",
            "Unified Tertiary Matriculation Examination (UTME), plus a school-leaving certificate (WASSCE or NECO)"),
    "SAU": (NATIONAL, "Qudurat 性向測驗與 Tahsili 學科測驗", "Qudurat aptitude test and Tahsili achievement test"),
    "IND": (NATIONAL, "全國的入學考試：中央大學的 CUET、工程的 JEE、醫學的 NEET；各邦的大學多看邦教育委員會的 12 年級考試",
            "National entrance tests: CUET for central universities, JEE for engineering, NEET for medicine; state universities mostly use state board Class 12 exams"),
    "PAK": (NATIONAL, "全國性向測驗（NAT）與醫學、工程的入學考試，加上高中證書（HSC）",
            "National Aptitude Test (NAT) and medical and engineering entrance tests, plus the Higher Secondary School Certificate"),
    "THA": (NATIONAL, "TGAT、TPAT 與 A-Level 等全國考試（TCAS 系統）", "National tests such as TGAT, TPAT and A-Level (the TCAS system)"),
    "UKR": (NATIONAL, "外部獨立評量（ZNO，現為全國多科測驗 NMT）", "External independent evaluation (ZNO, now the National Multi-subject Test)"),
    # ── 2 高中畢業會考當入學資格 ──
    "GBR": (LEAVING, "A-Level（蘇格蘭是 Highers）；少數學系另考入學測驗", "A-levels (Highers in Scotland); some courses add admissions tests"),
    "FRA": (LEAVING, "高中會考（Baccalauréat）", "Baccalauréat"),
    "DEU": (LEAVING, "高中畢業考試（Abitur）；醫學等學系另有測驗", "Abitur; medicine and some other courses add aptitude tests"),
    "AUT": (LEAVING, "高中畢業考試（Matura）", "Matura"),
    "CHE": (LEAVING, "高中畢業考試（Matura）；醫學另有性向測驗", "Matura; medicine adds an aptitude test"),
    "ITA": (LEAVING, "國家畢業考試（Maturità）", "State exam (Maturità)"),
    "NLD": (LEAVING, "中學畢業考試（VWO、HAVO 的 eindexamen）", "Secondary school final exams (VWO and HAVO eindexamen)"),
    "IRL": (LEAVING, "畢業證書考試（Leaving Certificate）", "Leaving Certificate"),
    "POL": (LEAVING, "高中畢業考試（Matura，2005 年起取代各校的入學考試）", "Matura (replaced universities' own entrance exams from 2005)"),
    "CZE": (LEAVING, "高中畢業考試（Maturita）", "Maturita"),
    "SVK": (LEAVING, "高中畢業考試（Maturita）", "Maturita"),
    "SVN": (LEAVING, "高中畢業考試（Matura）", "Matura"),
    "HUN": (LEAVING, "高中畢業考試（Érettségi）", "Érettségi (Matura)"),
    "ROU": (LEAVING, "高中會考（Bacalaureat）", "Baccalaureate (Bacalaureat)"),
    "BGR": (LEAVING, "高中畢業考試（Matura）", "Matura"),
    "HRV": (LEAVING, "國家高中畢業考試（Državna matura）", "State Matura"),
    "SRB": (LEAVING, "高中畢業考試（Matura）", "Matura"),
    "MKD": (LEAVING, "國家高中畢業考試（Matura）", "State Matura"),
    "XKX": (LEAVING, "國家高中畢業考試（Matura）", "State Matura"),
    "ALB": (LEAVING, "國家高中畢業考試（Matura Shtetërore）", "State Matura (Matura Shtetërore)"),
    "BIH": (LEAVING, "高中畢業考試（Matura）與畢業證書", "Matura and school-leaving diploma"),
    "FIN": (LEAVING, "高中畢業考試（Ylioppilastutkinto）", "Matriculation examination (Ylioppilastutkinto)"),
    "ISL": (LEAVING, "高中畢業考試（Stúdentspróf）", "Stúdentspróf"),
    "SWE": (LEAVING, "高中成績；另可考大學性向測驗（Högskoleprovet）", "Upper secondary grades; applicants may also take the Swedish Scholastic Aptitude Test (Högskoleprovet)"),
    "RUS": (LEAVING, "國家統一考試（ЕГЭ），高中畢業與大學入學合一", "Unified State Exam (EGE), combining school leaving and university entrance"),
    "VNM": (LEAVING, "高中畢業考試（2020 年起），高中畢業與大學入學合一；部分大學另有性向測驗",
            "High School Graduation Examination (since 2020), combining school leaving and university entrance; some universities add aptitude tests"),
    "HKG": (LEAVING, "香港中學文憑考試（DSE），經大學聯合招生辦法（JUPAS）申請", "Hong Kong Diploma of Secondary Education (DSE), applied through JUPAS"),
    "SGP": (LEAVING, "新加坡－劍橋 A 水準考試（另有國際文憑 IB）", "Singapore-Cambridge GCE A-Level (or the IB Diploma)"),
    "MYS": (LEAVING, "馬來西亞教育文憑（SPM）、高級學校文憑（STPM）", "Malaysian Certificate of Education (SPM) and Malaysian Higher School Certificate (STPM)"),
    "LKA": (LEAVING, "普通教育證書高級程度考試（GCE A-Level）", "GCE Advanced Level"),
    "MMR": (LEAVING, "大學入學考試（基礎教育高中畢業考試）", "Matriculation Examination (the basic education high school final exam)"),
    "NPL": (LEAVING, "12 年級的畢業考試；醫學、管理另有共同入學考試", "Grade 12 school-leaving exams; medicine and management have common entrance exams"),
    "IRQ": (LEAVING, "伊拉克高中會考（部會考試）", "Iraqi Baccalaureate (ministerial exams)"),
    "AUS": (LEAVING, "各州的高中證書換算成澳洲高等教育入學排名（ATAR）", "State senior secondary certificates converted to the Australian Tertiary Admission Rank (ATAR)"),
    "NZL": (LEAVING, "國家教育成就證書（NCEA）", "National Certificate of Educational Achievement (NCEA)"),
    "KEN": (LEAVING, "肯亞中等教育證書（KCSE）", "Kenya Certificate of Secondary Education (KCSE)"),
    "UGA": (LEAVING, "烏干達高級教育證書（UACE）", "Uganda Advanced Certificate of Education"),
    "TZA": (LEAVING, "中等教育證書考試（CSEE）", "Certificate of Secondary Education Examination (CSEE)"),
    "ZAF": (LEAVING, "國家高中證書（NSC）", "National Senior Certificate (NSC)"),
    "ZWE": (LEAVING, "ZIMSEC 的 GCE A-Level", "ZIMSEC GCE Advanced Level"),
    "SWZ": (LEAVING, "史瓦帝尼中等教育證書（EGCSE）", "Eswatini General Certificate of Secondary Education (EGCSE)"),
    "TUN": (LEAVING, "高中會考（Baccalauréat）", "Baccalauréat"),
    "GHA": (LEAVING, "西非高中證書考試（WASSCE）", "West African Senior School Certificate Examination (WASSCE)"),
    "SLE": (LEAVING, "西非高中證書考試（WASSCE）", "West African Senior School Certificate Examination (WASSCE)"),
    "LBR": (LEAVING, "西非高中證書考試（WASSCE）", "West African Senior School Certificate Examination (WASSCE)"),
    "GMB": (LEAVING, "西非高中證書考試（WASSCE）", "West African Senior School Certificate Examination (WASSCE)"),
    "BLZ": (LEAVING, "加勒比海考試委員會（CXC）的考試", "Caribbean Examinations Council (CXC) exams"),
    "SOM": (LEAVING, "中學畢業證書考試（Imtixaanka Shahaadiga）", "Secondary certification exams (Imtixaanka Shahaadiga)"),
    # ── 3 各校申請審查 ──
    "USA": (REVIEW, "各校審查高中成績、SAT 或 ACT（不少學校可以不交）、AP、推薦信與自傳",
            "Each college reviews high school grades, SAT or ACT scores (optional at many), AP exams, recommendations and essays"),
    "CAN": (REVIEW, "各校依高中畢業證書與成績審查（亞伯達省另有畢業考試）", "Each university reviews the high school diploma and grades (Alberta also has diploma exams)"),
    # ── 4 各校自辦考試 ──
    "MEX": (OWN, "各大學自辦入學考試，有些用全國評量中心的 EXANI", "Each university runs its own admission process; some use CENEVAL's EXANI tests"),
    "PHL": (OWN, "各大學自辦入學考試（全國大學入學考試 1994 年廢除）", "Each university runs its own entrance exam (the National College Entrance Examination was abolished in 1994)"),
    "BGD": (OWN, "大學自辦或幾所聯合辦的入學考試（例如 19 所大學聯合的 GST），加上高中證書（HSC）",
            "Universities run their own or joint admission tests (such as GST for 19 universities), plus the Higher Secondary Certificate"),
}


def routes() -> dict[str, tuple[int, str, str]]:
    return ROUTES
