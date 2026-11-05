import { getLang, tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, PointRecord, PointsOverlayDef, ScaleSpec, TopicDefinition } from './types';

/*
 * 2026-11-04（使用者決定只在 WHO GHO 的指標不用）：吸菸率換成 data.who.int 的菸草使用率（指標 id 不變），
 * 拿掉主要酒類、各類酒的消費量（圓餅與側欄）與室內全面禁菸的場所（data.who.int 都沒有）。
 */

const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };
const LITRES = { zh: '公升純酒精', en: 'litres of pure alcohol' };
const percent = (v: number) => `${fixed(v, 1)}%`;
const percentTick = (v: number) => `${v}%`;
// 全部、男性、女性的菸草使用率共用同一組門檻，才能互相比較
const SMOKING_SCALE: ScaleSpec = { type: 'sequential', thresholds: [5, 10, 15, 20, 30, 40] };

/** 含尼古丁電子菸的規範（pipeline/topics/tobacco_policy.py 的 STATUS）：由嚴到寬，ordinal 類別圖越前面顏色越深 */
const ECIG_CATEGORIES: CategoryDef[] = [
  { value: 4, label: { zh: '禁止', en: 'Banned' } },
  { value: 3, label: { zh: '事實上禁止', en: 'De facto ban' } },
  { value: 2, label: { zh: '要處方或只在藥局', en: 'Prescription or pharmacy only' } },
  { value: 1, label: { zh: '合法（含限尼古丁濃度）', en: 'Legal (incl. nicotine limits)' } },
];
const ecigLabel = new Map(ECIG_CATEGORIES.map((c) => [c.value, c.label]));

/** 啤酒廠的點（2026-11-04，製作手冊第二十一批 370；pipeline/topics/breweries.py）：OSM 與 Open Brewery DB 兩份清冊 */
const BREWERY_SOURCES = [
  { label: { zh: 'OpenStreetMap（craft=brewery）', en: 'OpenStreetMap (craft=brewery)' }, color: MAP_TOKENS.categorical[2] },
  { label: { zh: 'Open Brewery DB', en: 'Open Brewery DB' }, color: MAP_TOKENS.categorical[1] },
];

function breweryName(p: PointRecord): { title: string; proper?: string } {
  const n = String(p.n ?? '');
  const zh = String(p.nz ?? '');
  const en = String(p.ne ?? '');
  const unnamed = tr({ zh: '（沒有名稱的啤酒廠）', en: '(unnamed brewery)' });
  if (getLang() === 'zh') return zh ? { title: zh, proper: n && n !== zh ? n : undefined } : { title: n || unnamed };
  return en ? { title: en, proper: n && n !== en ? n : undefined } : { title: n || unnamed };
}

const BREWERIES: PointsOverlayDef = {
  kind: 'points',
  id: 'breweries',
  file: 'breweries.json',
  indicators: ['breweries'],
  label: { zh: '啤酒廠', en: 'Breweries' },
  radius: 2.5,
  color: { field: 'k', title: { zh: '清冊', en: 'Source' }, thresholds: [2], classes: BREWERY_SOURCES },
  tooltip: (p, { countryName }) => {
    const { title, proper } = breweryName(p);
    return {
      title,
      extra: [[typeof p.iso3 === 'string' && p.iso3 ? countryName(p.iso3) : '', tr(BREWERY_SOURCES[Number(p.k) - 1]?.label ?? BREWERY_SOURCES[0].label)].filter(Boolean).join(' · ')],
      properNoun: proper,
    };
  },
};

export const tobaccoAlcohol: TopicDefinition = {
  id: 'tobacco-alcohol',
  title: { zh: '各國菸酒', en: 'Tobacco and alcohol by country' },
  shortTitle: { zh: '菸酒', en: 'Tobacco' },
  defaultIndicator: 'smoking',
  defaultYear: 2024,
  sources: [
    {
      name: { zh: 'FAOSTAT：Crops and livestock products（啤酒產量，Item 51；外部機構提供的數字不用）', en: 'FAOSTAT: Crops and livestock products (beer production, item 51; figures from external organisations not used)' },
      url: 'https://www.fao.org/faostat/en/#data/QCL',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'WHO 資料平臺 data.who.int：菸草使用率（M_Est_tob_curr_std）、人均飲酒量（SA_0000001688）',
        en: 'WHO data platform (data.who.int): tobacco use (M_Est_tob_curr_std) and alcohol consumption per person (SA_0000001688)',
      },
      url: 'https://data.who.int/indicators/i/847662C/75DDA77',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '衛生福利部國民健康署，國人吸菸行為調查（台灣的吸菸率）', en: 'Health Promotion Administration (Taiwan), Adult Smoking Behavior Survey (Taiwan’s smoking rate)' },
      url: 'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=1718&pid=9913',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: '英文維基百科「Regulation of electronic cigarettes」的 Legal status by jurisdiction 表（revid 1377697236，2026-09-30；電子菸的規範）',
        en: 'English Wikipedia, “Regulation of electronic cigarettes”, Legal status by jurisdiction table (revid 1377697236, 30 September 2026; e-cigarette regulation)',
      },
      url: 'https://en.wikipedia.org/w/index.php?title=Regulation_of_electronic_cigarettes&oldid=1377697236',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: '全國法規資料庫，菸害防制法（台灣的電子菸）', en: 'Laws & Regulations Database (Taiwan), Tobacco Hazards Prevention Act' },
      url: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0070021',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: 'OpenStreetMap 貢獻者（啤酒廠 craft=brewery，經 QLever 查詢，2026 年 11 月）', en: 'OpenStreetMap contributors (breweries, craft=brewery, queried via QLever, November 2026)' },
      url: 'https://www.openstreetmap.org/copyright',
      license: 'ODbL',
    },
    {
      name: { zh: 'Open Brewery DB（啤酒廠清冊；Copyright (c) 2025 Open Brewery DB）', en: 'Open Brewery DB (brewery list; Copyright (c) 2025 Open Brewery DB)' },
      url: 'https://github.com/openbrewerydb/openbrewerydb',
      license: 'MIT',
    },
    {
      name: {
        zh: 'Ensembl REST（rs671 在 gnomAD v4、1000 Genomes 各族群的頻率）、NCBI dbSNP（日本、韓國、越南的研究；喝酒臉紅的基因）',
        en: 'Ensembl REST (rs671 frequencies in gnomAD v4 and 1000 Genomes) and NCBI dbSNP (Japanese, Korean and Vietnamese studies; the alcohol flush gene)',
      },
      url: 'https://rest.ensembl.org/variation/human/rs671?pops=1',
      license: { zh: '使用不受限制', en: 'No restrictions on use' },
    },
  ],
  note: {
    zh: '菸草使用率是 WHO 依各國調查做的模型估計（15 歲以上、年齡標準化，含嚼菸等不燃燒的菸草），到 2022 年，2025、2030 年是推估；2024 年顯示 2022 年的值。飲酒量是平均每個 15 歲以上的人一年喝下的純酒精公升數，含沒有登記的自釀、走私酒。兩者都取自 WHO 資料平臺 data.who.int（CC BY 4.0）；只在 WHO GHO 資料庫的吸菸率、主要酒類與室內全面禁菸的場所 2026 年 11 月拿掉。台灣不在 WHO 的資料中：改用國健署調查的吸菸率（18 歲以上、只算吸菸，跟 WHO 不完全可比），飲酒量沒有換算成純酒精的官方統計，所以留空。電子菸的規範取自英文維基百科的整理（CC BY-SA 4.0），這個資料檔也依 CC BY-SA 4.0 分享。啤酒廠是兩份都不完整的清冊：OpenStreetMap 標成啤酒廠（craft=brewery）的地方（© OpenStreetMap contributors，ODbL 1.0），以及 Open Brewery DB（MIT 授權，資料檔附上它的授權聲明）。',
    en: "Tobacco use is a WHO model estimate based on national surveys (ages 15+, age-standardised, including smokeless tobacco) up to 2022; 2025 and 2030 are projections, and 2024 shows the 2022 value. Alcohol consumption is litres of pure alcohol per person aged 15+ per year, including unrecorded home-made and smuggled drinks. Both come from WHO's data platform data.who.int (CC BY 4.0); the smoking rate, main type of drink and smoke-free places, which were only in WHO's Global Health Observatory, were removed in November 2026. Taiwan is not in the WHO data: its figure is the Health Promotion Administration's smoking rate (ages 18+, smoking only, not fully comparable with WHO's), and there are no official figures for its alcohol consumption in pure alcohol, so it is left blank. E-cigarette rules come from English Wikipedia's compilation (CC BY-SA 4.0), and that data file is shared under CC BY-SA 4.0 as well. Breweries come from two incomplete lists: places tagged as breweries (craft=brewery) on OpenStreetMap (© OpenStreetMap contributors, ODbL 1.0) and Open Brewery DB (MIT licence; its notice is included in the data file).",
  },
  overlays: [BREWERIES],
  // 左側欄（不分國家的資料，2026-11-03 起；原本是沒選國家時的右側欄）：喝酒臉紅的基因（2026-11-03，製作手冊第十九批 303；依族群，不是各國地圖）
  worldPanel: { title: { zh: '喝酒臉紅的基因', en: 'Alcohol flush gene' }, load: () => import('./panels/Aldh2Panel') },
  indicators: [
    {
      id: 'smoking',
      label: { zh: '菸草使用率', en: 'Tobacco use' },
      description: {
        zh: '15 歲以上的人裡，目前使用任何菸草（吸紙菸、雪茄、菸斗，或嚼菸、鼻菸等不燃燒的菸草，每天或偶爾）的比例，依年齡標準化，不含電子煙（WHO 資料平臺，到 2022 年）。2022 年日本 19.2%、南韓 20.0%、中國 23.4%、美國 24.3%、印尼 38.2%、緬甸 44.4%；嚼菸普遍的南亞、東南亞會比只算吸菸高。台灣是國健署調查的 18 歲以上吸菸率，2024 年 12.8%。',
        en: 'Share of people aged 15+ who currently use any tobacco (smoking cigarettes, cigars or pipes, or smokeless tobacco such as chewing tobacco and snuff, daily or occasionally), age-standardised, excluding e-cigarettes (WHO data platform, up to 2022). In 2022: Japan 19.2%, South Korea 20.0%, China 23.4%, the US 24.3%, Indonesia 38.2% and Myanmar 44.4%; where chewing tobacco is common, in South and Southeast Asia, rates are higher than for smoking alone. Taiwan’s figure is the Health Promotion Administration’s smoking rate for ages 18+, 12.8% in 2024.',
      },
      unit: '%',
      file: 'smoking.json',
      layer: { kind: 'choropleth', scale: SMOKING_SCALE },
      format: percent,
      formatTick: percentTick,
    },
    {
      id: 'smoking-male',
      label: { zh: '男性菸草使用率', en: 'Tobacco use, men' },
      description: {
        zh: '15 歲以上男性目前使用菸草的比例（年齡標準化，含不燃燒的菸草）。跟女性同一組分級門檻，可以直接比較。2022 年印尼 73.1%、緬甸 69.5%、中國 45.1%、南韓 34.1%、美國 29.9%、日本 28.7%；台灣 2024 年 21.5%（國健署的吸菸率）。',
        en: 'Share of men aged 15+ who currently use tobacco (age-standardised, including smokeless tobacco), on the same classes as the rate for women. In 2022: Indonesia 73.1%, Myanmar 69.5%, China 45.1%, South Korea 34.1%, the US 29.9% and Japan 28.7%; Taiwan 21.5% in 2024 (the Health Promotion Administration’s smoking rate).',
      },
      unit: '%',
      file: 'smoking-male.json',
      layer: { kind: 'choropleth', scale: SMOKING_SCALE },
      format: percent,
      formatTick: percentTick,
    },
    {
      id: 'smoking-female',
      label: { zh: '女性菸草使用率', en: 'Tobacco use, women' },
      description: {
        zh: '15 歲以上女性目前使用菸草的比例（年齡標準化，含不燃燒的菸草）。跟男性同一組分級門檻：東亞、非洲多數國家的女性很低（2022 年中國 1.6%、奈及利亞 0.5%），塞爾維亞、保加利亞、克羅埃西亞男女都在四成左右，孟加拉、緬甸的女性有一到兩成。台灣 2024 年 4.2%（國健署的吸菸率）。',
        en: 'Share of women aged 15+ who currently use tobacco (age-standardised, including smokeless tobacco), on the same classes as the rate for men: very low in most of East Asia and Africa (China 1.6% and Nigeria 0.5% in 2022), around 40% for both men and women in Serbia, Bulgaria and Croatia, and 10–20% of women in Bangladesh and Myanmar. Taiwan 4.2% in 2024 (the Health Promotion Administration’s smoking rate).',
      },
      unit: '%',
      file: 'smoking-female.json',
      layer: { kind: 'choropleth', scale: SMOKING_SCALE },
      format: percent,
      formatTick: percentTick,
    },
    {
      id: 'alcohol',
      label: { zh: '人均飲酒量', en: 'Alcohol consumption' },
      description: {
        zh: '平均每個 15 歲以上的人一年喝下多少公升的純酒精（10 公升約等於每天 1.7 罐 330 毫升、酒精 5% 的啤酒），含沒有登記的自釀、走私酒，扣掉觀光客喝的（SDG 3.5.2）。',
        en: 'Litres of pure alcohol drunk per person aged 15+ in a year (10 litres is about 1.7 cans of 330 ml, 5% beer a day), including unrecorded home-made and smuggled drinks and excluding what tourists drink (SDG 3.5.2).',
      },
      unit: LITRES,
      file: 'alcohol.json',
      // 2026-11-04：各類酒的比例（GHO 的 SA_0000001400）data.who.int 沒有，圓餅改回面量圖
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2.5, 5, 7.5, 10, 12.5] } },
      format: (v) => tr({ zh: `${fixed(v, 1)} 公升`, en: `${fixed(v, 1)} litres` }),
      formatTick: (v) => fixed(v, v % 1 === 0 ? 0 : 1),
      compareWorld: true,
    },
    {
      id: 'e-cigarettes',
      label: { zh: '電子菸的規範', en: 'E-cigarette rules' },
      description: {
        zh: '含尼古丁的電子菸合不合法（英文維基百科的整理，2026 年 9 月 30 日的版本，183 個國家與地區）。137 個合法，其中 45 個（歐盟等）限尼古丁濃度每毫升 20 毫克以下；澳洲只在藥局賣，南非、迦納、馬來西亞要處方；日本、土耳其、巴西、委內瑞拉沒有明文禁止但不准上市（事實上禁止）；38 個禁止，包括台灣、泰國、新加坡、印度、香港、墨西哥。法規變動快，以各國現行法規為準。台灣依《菸害防制法》第 15 條：不得製造、輸入、販賣、供應、展示、廣告或使用。',
        en: 'Whether nicotine e-cigarettes are legal (compiled by English Wikipedia, version of 30 September 2026, 183 countries and territories). 137 allow them, 45 of them (the EU and others) with a nicotine limit of 20 mg/ml; Australia sells them only in pharmacies, and South Africa, Ghana and Malaysia require a prescription; Japan, Türkiye, Brazil and Venezuela have no outright ban but allow none on the market (de facto ban); 38 ban them, including Taiwan, Thailand, Singapore, India, Hong Kong and Mexico. Rules change quickly; check current national law. Taiwan: Article 15 of the Tobacco Hazards Prevention Act bans making, importing, selling, supplying, displaying, advertising or using them.',
      },
      unit: '',
      file: 'e-cigarettes.json',
      defaultYear: 2026,
      layer: { kind: 'categorical', categories: ECIG_CATEGORIES, ordinal: true },
      format: (v) => tr(ecigLabel.get(v) ?? { zh: '其他', en: 'Other' }),
      unranked: true,
      rankingBars: false,
      panelChart: false,
    },
    {
      id: 'breweries',
      label: { zh: '啤酒廠', en: 'Breweries' },
      description: {
        zh: '點是兩份都不完整的啤酒廠清冊：琥珀色是 OpenStreetMap 標成啤酒廠的地方（全球 11,585 處、143 國，美國 3,760、法國 1,125、德國 882、日本 163，台灣 5 處），紫色是 Open Brewery DB（8,881 家，三分之二在美國，法國、日本、義大利幾乎沒有建置，台灣沒有）。國家的顏色是 OSM 每百萬人幾處，只替 OSM 覆蓋良好的國家上色：丹麥 26.9、捷克 26.7、瑞士 22.8、冰島 22.4、比利時 21.2 最多；加拿大 14.6、英國 12.5、美國 10.8、德國 10.5、日本 1.3、南韓 0.3、台灣 0.2。大型酒廠與精釀小廠混在一起，OSM 的密度同時在量繪圖者畫得多完整，只能看大概。',
        en: 'Dots come from two incomplete brewery lists: amber for places tagged as breweries on OpenStreetMap (11,585 in 143 countries: the US 3,760, France 1,125, Germany 882, Japan 163 and Taiwan 5) and purple for Open Brewery DB (8,881, two thirds in the US; France, Japan and Italy are barely covered and Taiwan not at all). Countries are shaded by OSM breweries per million people, only where OSM is reasonably complete: Denmark 26.9, Czechia 26.7, Switzerland 22.8, Iceland 22.4 and Belgium 21.2 are highest; Canada 14.6, the UK 12.5, the US 10.8, Germany 10.5, Japan 1.3, South Korea 0.3 and Taiwan 0.2. Large breweries and craft breweries are mixed together, and OSM density also reflects how thoroughly volunteers map, so treat comparisons as approximate.',
      },
      unit: { zh: '處／百萬人', en: 'per million' },
      file: 'breweries-per-million.json',
      defaultYear: 2026,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 3, 6, 10, 15, 20] } },
      format: (v) => tr({ zh: `每百萬人 ${fixed(v, 1)} 處`, en: `${fixed(v, 1)} per million` }),
      formatTick: (v) => `${v}`,
    },
    {
      // 2026-11-05（製作手冊第二十二批 385）：FAOSTAT 的啤酒產量，Flag X（外部機構提供）不畫
      id: 'beer-production',
      label: { zh: '啤酒產量', en: 'Beer production' },
      description: {
        zh: '一年生產的大麥麥芽啤酒（公噸，約等於千公升；FAOSTAT）。FAO 很多國家的數字是外部機構提供的（2023 年 166 國裡 126 國），FAO 條款寫這類第三方資料要原提供者同意才能再散布，授權待確認，所以沒有用，地圖只畫官方申報與 FAO 自己估計的國家，美國、德國、台灣等近年都是灰色（滑過寫原因）。2023 年中國 3,641 萬公噸、巴西 1,789 萬、墨西哥 1,227 萬、日本 200 萬。拖時間軸回到早年，很多國家還是官方申報；台灣 1961 年 1 萬公噸。',
        en: 'Malt beer produced in a year (tonnes, roughly thousand litres; FAOSTAT). For many countries FAO’s figures come from external organisations (126 of 166 in 2023), and FAO’s terms say such third-party data need the original provider’s consent to be redistributed; with the licence unconfirmed they are not used, so the map shows only countries with official or FAO-estimated figures, and the US, Germany, Taiwan and others are grey in recent years (hover for the reason). In 2023 China produced 36.4 million tonnes, Brazil 17.9 million, Mexico 12.3 million and Japan 2.0 million. Drag the timeline back and many more countries have official figures; Taiwan produced 10,000 tonnes in 1961.',
      },
      unit: { zh: '公噸', en: 'tonnes' },
      file: 'beer-production.json',
      defaultYear: 2023,
      layer: { kind: 'bubble', legendValues: [1e5, 1e6, 1e7] },
      format: (v) => tr({ zh: `${formatLargeNumber(v)} 公噸`, en: `${formatLargeNumber(v)} t` }),
      formatTick: formatLargeTick,
    },
    {
      id: 'beer-per-capita',
      label: { zh: '每人每年的啤酒產量', en: 'Beer production per person' },
      description: {
        zh: '啤酒產量換算成公升（密度 1.01）除以人口（聯合國 WPP）。這是產量不是喝了多少：出口多的國家會偏高，喝多少見「人均飲酒量」。2023 年奧地利 110 公升、墨西哥 94 公升、塞爾維亞 85 公升、巴西 84 公升。跟產量一樣，FAO 標成外部機構提供的數字沒有用。',
        en: 'Beer production converted to litres (density 1.01) divided by population (UN WPP). This is production, not consumption: exporters score high; see alcohol consumption for drinking. In 2023 Austria produced 110 litres per person, Mexico 94, Serbia 85 and Brazil 84. As with production, figures FAO marks as supplied by external organisations are not used.',
      },
      unit: { zh: '公升', en: 'litres' },
      file: 'beer-per-capita.json',
      defaultYear: 2023,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 15, 30, 50, 70, 90] } },
      format: (v) => tr({ zh: `每人 ${fixed(v, 1)} 公升`, en: `${fixed(v, 1)} litres per person` }),
      formatTick: (v) => `${v}`,
    },
  ],
};
