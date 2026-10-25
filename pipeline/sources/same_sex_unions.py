"""同性伴侶的法律地位：哪些國家可以同性結婚、有民事結合或伴侶登記，從哪一年開始。自行整理的表，每個國家寫出依據的法律或判決。

依據英文維基百科的條目整理（CC BY-SA 4.0，2026-10-26 查），所以這張表與輸出的資料檔（`same-sex.json`）依 CC BY-SA 4.0 分享：
- Same-sex marriage（revid 1381842102）的年表與「Same-sex marriage around the world」
- Civil union（revid 1375621169）的「List of jurisdictions recognizing same-sex unions」與「Countries with former civil unions」
- Recognition of same-sex unions by country（revid 1366041485）
- 個別條目：Same-sex marriage in Nepal（1375537938）、Recognition of same-sex unions in Poland（1380285382）、
  …in Lithuania（1363853156）、…in Bolivia（1371381868）、…in Israel（1381233498）、…in Hong Kong（1351415275）、
  …in Japan（1380030337）、Same-sex marriage in Aruba, Curaçao and Sint Maarten（1363317656）、…in Bermuda（1375551912）、
  …in American Samoa（1374909553）、…in the Cayman Islands（1379176254）

分類（每年年底的狀態）：
1 同性婚姻：可以在國內結婚。
2 其他全國性的承認：民事結合、伴侶登記等全國性的伴侶制度（照 Civil union 條目的國家清單），或承認在國外締結的同性婚姻
  （以色列、美屬薩摩亞、荷屬聖馬丁，以及 2026 年起承認其他歐盟國家婚姻的波蘭）。
3 沒有全國性的法律承認：包括只有部分州、縣市有伴侶登記的國家（日本、2019 年以前的台灣），以及美國、墨西哥、加拿大、
  巴西、澳洲在全國開放以前（各州陸續開放）的年份。
只有部分地區先開放的國家，以全國（或絕大部分地區）開放的那一年為準，附註寫出最早的地區。
"""
from __future__ import annotations

FIRST_YEAR = 1989  # 丹麥的伴侶登記，世界第一個
LAST_YEAR = 2026

MARRIAGE, OTHER, NONE = 1, 2, 3

# 同性婚姻：iso3 → (生效日, 中文依據, 英文依據)
MARRIAGES: dict[str, tuple[str, str, str]] = {
    "NLD": ("2001-04-01", "《開放婚姻法》（Wet openstelling huwelijk），世界第一個", "Act on the Opening Up of Marriage; the first country in the world"),
    "BEL": ("2003-06-01", "2003 年 2 月 13 日的法律", "Law of 13 February 2003"),
    "ESP": ("2005-07-03", "第 13/2005 號法律", "Law 13/2005"),
    "CAN": ("2005-07-20", "《民事婚姻法》（Civil Marriage Act）；安大略省等省 2003 年起已依法院判決開放",
            "Civil Marriage Act; Ontario and other provinces had allowed it by court rulings since 2003"),
    "ZAF": ("2006-11-30", "《民事結合法》（Civil Union Act, 2006）", "Civil Union Act, 2006"),
    "NOR": ("2009-01-01", "修正《婚姻法》", "amended Marriage Act"),
    "SWE": ("2009-05-01", "修正《婚姻法》", "amended Marriage Code"),
    "PRT": ("2010-06-05", "第 9/2010 號法律", "Law 9/2010"),
    "ISL": ("2010-06-27", "修正《婚姻法》", "amended Marriage Act"),
    "ARG": ("2010-07-22", "第 26.618 號法律（平等婚姻法）", "Law 26.618 (Equal Marriage Act)"),
    "DNK": ("2012-06-15", "修正《婚姻法》", "amended Marriage Act"),
    "BRA": ("2013-05-16", "國家司法委員會第 175 號決議（最高聯邦法院 2011 年承認同性的穩定結合）",
            "Resolution 175 of the National Justice Council (the Supreme Federal Court recognised same-sex stable unions in 2011)"),
    "FRA": ("2013-05-18", "第 2013-404 號法律（Mariage pour tous），海外省與海外領地同樣適用",
            "Law 2013-404 (Mariage pour tous), also applying in the overseas departments and territories"),
    "URY": ("2013-08-05", "第 19.075 號法律", "Law 19.075"),
    "NZL": ("2013-08-19", "《2013 年婚姻（婚姻定義）修正法》；不含庫克群島、紐埃、托克勞",
            "Marriage (Definition of Marriage) Amendment Act 2013; not in the Cook Islands, Niue or Tokelau"),
    "GBR": ("2014-03-13", "《2013 年婚姻（同性伴侶）法》（英格蘭與威爾斯）；蘇格蘭 2014 年 12 月、北愛爾蘭 2020 年 1 月",
            "Marriage (Same Sex Couples) Act 2013 (England and Wales); Scotland from December 2014, Northern Ireland from January 2020"),
    "LUX": ("2015-01-01", "2014 年 7 月 4 日的法律", "Law of 4 July 2014"),
    "USA": ("2015-06-26", "最高法院 Obergefell v. Hodges 判決；麻薩諸塞州 2004 年起最早開放，之後各州陸續開放",
            "Supreme Court ruling in Obergefell v. Hodges; Massachusetts was the first state, in 2004"),
    "IRL": ("2015-11-16", "2015 年 5 月公投後的《2015 年婚姻法》", "Marriage Act 2015, after the May 2015 referendum"),
    "COL": ("2016-04-28", "憲法法院 SU-214/2016 判決", "Constitutional Court ruling SU-214/2016"),
    "FIN": ("2017-03-01", "修正《婚姻法》（公民提案）", "amended Marriage Act (a citizens' initiative)"),
    "MLT": ("2017-09-01", "《2017 年婚姻法及其他法律修正法》", "Marriage Act and other Laws (Amendment) Act 2017"),
    "DEU": ("2017-10-01", "《同性婚姻法》（Gesetz zur Einführung des Rechts auf Eheschließung für Personen gleichen Geschlechts）",
            "Act Introducing the Right to Marry for Persons of the Same Sex"),
    "AUS": ("2017-12-09", "《2017 年婚姻修正（定義與宗教自由）法》，在全國郵寄意向調查之後；之前聯邦法律承認同性的事實伴侶（2009 年起），部分州有伴侶登記",
            "Marriage Amendment (Definition and Religious Freedoms) Act 2017, after a national postal survey; federal law had "
            "recognised same-sex de facto couples since 2009 and some states had relationship registers"),
    "AUT": ("2019-01-01", "憲法法院 2017 年 12 月的判決", "Constitutional Court ruling of December 2017"),
    "TWN": ("2019-05-24", "《司法院釋字第七四八號解釋施行法》，亞洲第一個；之前多數縣市自 2015 年起有同性伴侶註記（沒有法律效力）",
            "Act for Implementation of J.Y. Interpretation No. 748, the first in Asia; most cities and counties had offered "
            "same-sex partnership notations without legal effect from 2015"),
    "ECU": ("2019-07-08", "憲法法院 2019 年 6 月的判決", "Constitutional Court ruling of June 2019"),
    "CRI": ("2020-05-26", "最高法院憲法庭 2018 年的判決生效", "a 2018 ruling of the Constitutional Chamber of the Supreme Court took effect"),
    "CHL": ("2022-03-10", "第 21.400 號法律", "Law 21.400"),
    "CHE": ("2022-07-01", "2021 年公投通過的「人人皆可結婚」修法（Ehe für alle）", "the “Marriage for all” amendment approved in a 2021 referendum"),
    "SVN": ("2022-07-09", "憲法法院的判決", "Constitutional Court ruling"),
    "CUB": ("2022-09-27", "公投通過的《家庭法》（Código de las Familias）", "Family Code approved in a referendum"),
    "MEX": ("2022-12-31", "各州陸續開放，2022 年底最後一州（格雷羅州）；墨西哥城 2010 年最早，最高法院 2015 年起的判例要求各州開放",
            "opened state by state, the last (Guerrero) at the end of 2022; Mexico City was the first, in 2010, and Supreme "
            "Court jurisprudence from 2015 required every state to allow it"),
    "AND": ("2023-02-17", "2022 年的婚姻法修正", "2022 amendment to the marriage law"),
    "EST": ("2024-01-01", "修正《家庭法》", "amended Family Law Act"),
    "GRC": ("2024-02-16", "第 5089/2024 號法律", "Law 5089/2024"),
    "LIE": ("2025-01-01", "修正《婚姻法》", "amended Marriage Act"),
    "THA": ("2025-01-23", "修正《民商法典》（婚姻平權法），東南亞第一個",
            "amended Civil and Commercial Code (Marriage Equality Act), the first in Southeast Asia"),
    "NPL": ("2026-06-18", "最高法院的終審判決（Pinky Gurung 案）要求政府全面承認同性婚姻；2023 年 11 月起已依法院的臨時命令另冊登記，民法還沒有修改",
            "Supreme Court final verdict (Pinky Gurung case) ordering the government to fully recognise same-sex marriage; "
            "marriages had been entered in a separate register under an interim order since November 2023, and the Civil Code "
            "has not yet been amended"),
    # 屬地
    "GRL": ("2016-04-01", "丹麥的婚姻法延伸適用", "Danish marriage law extended to Greenland"),
    "FRO": ("2017-07-01", "丹麥的婚姻法延伸適用", "Danish marriage law extended to the Faroe Islands"),
    "BES": ("2012-10-10", "荷蘭的婚姻法延伸到加勒比海的波奈、聖佑達修斯、沙巴", "Dutch marriage law extended to Bonaire, Sint Eustatius and Saba"),
    "ABW": ("2024-07-12", "荷蘭最高法院維持聯合法院的判決，婚姻禁令違憲；2021 年起有伴侶登記",
            "the Supreme Court of the Netherlands upheld the Joint Court of Justice ruling that the ban was unconstitutional; registered partnerships since 2021"),
    "CUW": ("2024-07-12", "荷蘭最高法院維持聯合法院的判決，婚姻禁令違憲",
            "the Supreme Court of the Netherlands upheld the Joint Court of Justice ruling that the ban was unconstitutional"),
    "GIB": ("2016-12-15", "《2016 年民事婚姻修正法》；2014 年起有民事伴侶", "Civil Marriage Amendment Act 2016; civil partnerships since 2014"),
    "IMN": ("2016-07-22", "《2016 年婚姻與民事伴侶修正法》；2011 年起有民事伴侶", "Marriage and Civil Partnership (Amendment) Act 2016; civil partnerships since 2011"),
    "JEY": ("2018-07-01", "《2018 年婚姻與民事地位修正法》；2012 年起有民事伴侶", "Marriage and Civil Status (Amendment) Law 2018; civil partnerships since 2012"),
    "GGY": ("2017-05-02", "根西島；阿爾德尼 2018 年、薩克 2020 年", "Guernsey; Alderney from 2018 and Sark from 2020"),
    "FLK": ("2017-04-29", "婚姻條例修正", "amended Marriage Ordinance"),
    "SHN": ("2017-12-20", "聖赫勒拿的婚姻條例；阿森松島 2017 年 1 月、特里斯坦達庫尼亞 2017 年 8 月",
            "Saint Helena marriage ordinance; Ascension from January 2017 and Tristan da Cunha from August 2017"),
    "PCN": ("2015-05-14", "婚姻條例修正", "amended Marriage Ordinance"),
}
# 跟隨所屬國家（同一部婚姻法、同樣的伴侶制度）
FOLLOWS = {
    "PRI": "USA", "GUM": "USA", "VIR": "USA", "MNP": "USA",
    "GUF": "FRA", "GLP": "FRA", "MTQ": "FRA", "REU": "FRA", "BLM": "FRA", "MAF": "FRA", "SPM": "FRA",
    "MYT": "FRA", "NCL": "FRA", "PYF": "FRA", "WLF": "FRA",
    "NFK": "AUS", "CXR": "AUS", "CCK": "AUS", "_IOT": "AUS",
    "SJM": "NOR", "ALA": "FIN",
}
# 其他全國性的承認：iso3 → (開始的年, 中文, 英文)；同時有婚姻的國家，這是開放婚姻以前的制度
OTHERS: dict[str, tuple[int, str, str]] = {
    "DNK": (1989, "伴侶登記（registreret partnerskab），世界第一個", "registered partnerships, the first in the world"),
    "NOR": (1993, "伴侶登記", "registered partnerships"),
    "SWE": (1995, "伴侶登記", "registered partnerships"),
    "ISL": (1996, "伴侶登記", "registered partnerships"),
    "GRL": (1996, "伴侶登記", "registered partnerships"),
    "NLD": (1998, "伴侶登記（geregistreerd partnerschap）", "registered partnerships"),
    "FRA": (1999, "民事伴侶契約（PACS）", "civil solidarity pacts (PACS)"),
    "BEL": (2000, "法定同居（cohabitation légale）", "statutory cohabitation"),
    "PRT": (2001, "事實婚姻（união de facto）的法律承認", "legal recognition of de facto unions"),
    "DEU": (2001, "生活伴侶（Lebenspartnerschaft）", "registered life partnerships"),
    "FIN": (2002, "伴侶登記", "registered partnerships"),
    "LUX": (2004, "伴侶登記（partenariat）", "registered partnerships"),
    "AND": (2005, "穩定結合（2014 年起改為民事結合）", "stable unions (civil unions from 2014)"),
    "GBR": (2005, "民事伴侶（civil partnership）", "civil partnerships"),
    "NZL": (2005, "民事結合（civil union）", "civil unions"),
    "CZE": (2006, "伴侶登記（registrované partnerství），2025 年起擴大為幾乎等同婚姻的權利",
            "registered partnerships, expanded in 2025 to nearly all the rights of marriage"),
    "SVN": (2006, "伴侶登記", "registered partnerships"),
    "CHE": (2007, "伴侶登記（eingetragene Partnerschaft）", "registered partnerships"),
    "ISR": (2006, "承認在國外締結的同性婚姻（最高法院 2006 年 11 月的判決），國內沒有民事婚姻",
            "recognition of same-sex marriages performed abroad (High Court of Justice ruling of November 2006); there is no domestic civil marriage"),
    "URY": (2008, "同居結合（unión concubinaria）", "concubinary unions"),
    "ECU": (2008, "事實結合（unión de hecho，2008 年憲法）", "de facto unions (2008 Constitution)"),
    "COL": (2009, "事實婚姻結合（unión marital de hecho）", "de facto marital unions"),
    "HUN": (2009, "伴侶登記（bejegyzett élettársi kapcsolat）", "registered partnerships"),
    "AUT": (2010, "伴侶登記（eingetragene Partnerschaft）", "registered partnerships"),
    "BRA": (2011, "穩定結合（união estável，最高聯邦法院判決）", "stable unions (Supreme Federal Court ruling)"),
    "IRL": (2011, "民事伴侶（civil partnership）", "civil partnerships"),
    "LIE": (2011, "伴侶登記", "registered partnerships"),
    "BES": (2012, "伴侶登記", "registered partnerships"),
    "MLT": (2014, "民事結合（civil union）", "civil unions"),
    "HRV": (2014, "生活伴侶（životno partnerstvo）", "life partnerships"),
    "CHL": (2015, "民事結合協議（Acuerdo de Unión Civil）", "civil union agreements"),
    "CYP": (2015, "民事同居（civil cohabitation）", "civil cohabitation"),
    "GRC": (2015, "同居協議（σύμφωνο συμβίωσης）", "cohabitation agreements"),
    "EST": (2016, "同居協議（kooseluleping）", "cohabitation agreements"),
    "ITA": (2016, "民事結合（unione civile）", "civil unions"),
    "SMR": (2018, "民事結合（unione civile）", "civil unions"),
    "MCO": (2020, "共同生活契約（contrat de vie commune）", "cohabitation agreements"),
    "MNE": (2021, "生活伴侶（životno partnerstvo）", "life partnerships"),
    "BOL": (2023, "自由結合（unión libre，憲法法院判決，2023 年 3 月起全國適用）",
            "free unions (Plurinational Constitutional Tribunal ruling, nationwide from March 2023)"),
    "LVA": (2024, "伴侶登記（partnerība）", "registered partnerships"),
    "LTU": (2025, "經法院登記的伴侶關係（憲法法院 2025 年 4 月判決，國會還沒有立法）",
            "partnerships registered through the courts (Constitutional Court ruling of April 2025; parliament has not yet legislated)"),
    "POL": (2026, "只承認在其他歐盟國家締結的同性婚姻（最高行政法院 2026 年 3 月的判決），國內沒有伴侶制度",
            "recognition only of same-sex marriages performed in other EU member states (Supreme Administrative Court ruling of "
            "March 2026); there is no domestic partnership scheme"),
    # 屬地
    "GUF": (1999, "民事伴侶契約（PACS）", "civil solidarity pacts (PACS)"),
    "GLP": (1999, "民事伴侶契約（PACS）", "civil solidarity pacts (PACS)"),
    "MTQ": (1999, "民事伴侶契約（PACS）", "civil solidarity pacts (PACS)"),
    "REU": (1999, "民事伴侶契約（PACS）", "civil solidarity pacts (PACS)"),
    "BLM": (1999, "民事伴侶契約（PACS）", "civil solidarity pacts (PACS)"),
    "MAF": (1999, "民事伴侶契約（PACS）", "civil solidarity pacts (PACS)"),
    "SPM": (1999, "民事伴侶契約（PACS）", "civil solidarity pacts (PACS)"),
    "NCL": (2009, "民事伴侶契約（PACS）", "civil solidarity pacts (PACS)"),
    "WLF": (2009, "民事伴侶契約（PACS）", "civil solidarity pacts (PACS)"),
    "ABW": (2007, "承認在荷蘭王國其他地區締結的同性婚姻（荷蘭最高法院 2007 年 4 月的判決）；2021 年起有伴侶登記",
            "recognition of same-sex marriages performed elsewhere in the Kingdom of the Netherlands (Supreme Court ruling of "
            "April 2007); registered partnerships from 2021"),
    "CUW": (2007, "承認在荷蘭王國其他地區締結的同性婚姻（荷蘭最高法院 2007 年 4 月的判決）",
            "recognition of same-sex marriages performed elsewhere in the Kingdom of the Netherlands (Supreme Court ruling of April 2007)"),
    "SXM": (2007, "承認在荷蘭王國其他地區締結的同性婚姻（荷蘭最高法院 2007 年 4 月的判決），自己還不能登記結婚",
            "recognition of same-sex marriages performed elsewhere in the Kingdom of the Netherlands (Supreme Court ruling of "
            "April 2007); same-sex couples cannot yet marry there"),
    "ASM": (2022, "不能登記結婚，但依美國《2022 年尊重婚姻法》承認在其他地方締結的同性婚姻",
            "same-sex marriages are not performed, but those from elsewhere are recognised under the US Respect for Marriage Act of 2022"),
    "CYM": (2020, "民事伴侶（Civil Partnership Law 2020，由總督頒布）", "civil partnerships (Civil Partnership Law 2020, enacted by the Governor)"),
    "GIB": (2014, "民事伴侶", "civil partnerships"),
    "IMN": (2011, "民事伴侶", "civil partnerships"),
    "JEY": (2012, "民事伴侶", "civil partnerships"),
    "FLK": (2017, "民事伴侶", "civil partnerships"),
}
# 百慕達：2017 年 5 月法院判決開放，2018 年 6 月起改為同居伴侶（Domestic Partnership Act），同年 11 月上訴法院恢復，
# 2022 年 3 月英國樞密院司法委員會推翻，之後只剩同居伴侶
BERMUDA = {
    "marriage": (2017, 2021),
    "other": (2018, "同居伴侶（Domestic Partnership Act 2018）；同性婚姻 2017 年 5 月由法院判決開放，2022 年 3 月英國樞密院司法委員會推翻，之前締結的婚姻仍然有效",
              "domestic partnerships (Domestic Partnership Act 2018); same-sex marriage was opened by a court ruling in May 2017 "
              "and ended by the Judicial Committee of the Privy Council in March 2022, though marriages performed before then remain valid"),
}
# 沒有全國性承認、但值得一提的
NONE_NOTES: dict[str, tuple[str, str]] = {
    "JPN": ("沒有全國性的法律承認；多數都道府縣與數百個市町村有同性伴侶宣誓或證明制度（沒有婚姻的法律效力），多個高等法院判決婚姻禁令違憲",
            "no nationwide legal recognition; most prefectures and hundreds of municipalities issue partnership certificates "
            "without the legal effect of marriage, and several high courts have ruled the marriage ban unconstitutional"),
    "HKG": ("沒有民事結合或婚姻；法院判決給予同性伴侶部分權利（配偶簽證、公務員配偶福利等），終審法院 2023 年 9 月要求政府在兩年內建立伴侶制度",
            "no civil unions or marriage; court rulings have granted same-sex couples some rights (spousal visas, civil servants' "
            "spousal benefits and others), and the Court of Final Appeal ordered the government in September 2023 to create a "
            "partnership framework within two years"),
}
UNINHABITED = {"ATA", "ATF", "BVT", "HMD", "UMI", "_SIA", "SGS", "IOT"}


def _year(date: str) -> int:
    return int(date[:4])


def status(iso3s: list[str]) -> tuple[dict[str, dict[int, int]], dict[str, tuple[str, str]]]:
    """({iso3: {年: 分類}}, {iso3: (中文附註, 英文附註)})，年份 FIRST_YEAR–LAST_YEAR。"""
    out: dict[str, dict[int, int]] = {}
    notes: dict[str, tuple[str, str]] = {}
    for iso3 in iso3s:
        if iso3 in UNINHABITED:
            continue
        own = FOLLOWS.get(iso3, iso3)
        if own != iso3 and iso3 in MARRIAGES:
            raise RuntimeError(f"{iso3} 同時寫在 FOLLOWS 與 MARRIAGES")
        marriage = MARRIAGES.get(iso3) or (MARRIAGES.get(own) if own != iso3 else None)
        other = OTHERS.get(iso3)  # 屬地只跟隨婚姻法；伴侶制度各自不同，寫在自己的 OTHERS
        years: dict[int, int] = {}
        for y in range(FIRST_YEAR, LAST_YEAR + 1):
            if iso3 == "BMU":
                start, end = BERMUDA["marriage"]
                years[y] = MARRIAGE if start <= y <= end else OTHER if y >= BERMUDA["other"][0] else NONE
            elif marriage and _year(marriage[0]) <= y:
                years[y] = MARRIAGE
            elif other and other[0] <= y:
                years[y] = OTHER
            else:
                years[y] = NONE
        out[iso3] = years
        parts_zh, parts_en = [], []
        if iso3 == "BMU":
            parts_zh.append(BERMUDA["other"][1])
            parts_en.append(BERMUDA["other"][2])
        if marriage:
            date = marriage[0]
            parts_zh.append(f"同性婚姻 {int(date[:4])} 年 {int(date[5:7])} 月 {int(date[8:])} 日起：{marriage[1]}")
            parts_en.append(f"Same-sex marriage since {date}: {marriage[2]}")
        if other:
            if marriage:
                parts_zh.append(f"{other[0]} 年起：{other[1]}")
                parts_en.append(f"From {other[0]}: {other[2]}")
            else:
                parts_zh.append(f"{other[0]} 年起：{other[1]}")
                parts_en.append(f"Since {other[0]}: {other[2]}")
        if own != iso3:
            parts_zh.append("跟所屬國家適用同樣的法律")
            parts_en.append("the same law as the sovereign country applies")
        if iso3 in NONE_NOTES and not marriage and not other:
            parts_zh.append(NONE_NOTES[iso3][0])
            parts_en.append(NONE_NOTES[iso3][1])
        if parts_zh:
            notes[iso3] = ("；".join(parts_zh) + "。", "; ".join(p[0].upper() + p[1:] if i == 0 else p for i, p in enumerate(parts_en)) + ".")
    return out, notes
