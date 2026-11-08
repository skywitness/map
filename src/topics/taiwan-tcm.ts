import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 台灣的中醫（新主題，2026-11-08，製作手冊第二十九批 689，候選 866、1575；pipeline/topics/taiwan_tcm.py）：
 * 衛福部統計處的統計表。全國的中醫醫院與診所（1989–2025）、門診人數與件數（2016–2024）只有台灣一個值，畫成台灣上的比例圓、
 * 拖時間軸看變化；中醫師與中藥販賣業有縣市別，畫成各縣市的比例圓（縣市的標籤點），左邊列出縣市。
 */
const C = MAP_TOKENS.categorical;
/** 台灣、金門、馬祖都在畫面裡 */
const TAIWAN: [number, number, number, number] = [118.0, 21.8, 122.4, 26.5];
const county = (p: PointRecord) => (getLang() === 'zh' ? String(p.c ?? '') : String(p.en ?? p.c ?? ''));
const n = (v: unknown) => fixed(Number(v) || 0, 0);
const countyLines = (p: PointRecord) => [
  tr({ zh: `中醫師 ${n(p.dr)} 人（每萬人 ${fixed(Number(p.drp), 2)}）`, en: `${n(p.dr)} Chinese medicine physicians (${fixed(Number(p.drp), 2)} per 10,000)` }),
  tr({ zh: `西醫師 ${n(p.wd)} 人`, en: `${n(p.wd)} Western medicine physicians` }),
  tr({ zh: `中藥販賣業 ${n(p.herb)} 家`, en: `${n(p.herb)} Chinese herbal medicine dealers` }),
];

function countyOverlay(id: string, field: 'dr' | 'herb', indicator: string, color: string, stops: [number, number][]): PointsOverlayDef {
  return {
    kind: 'points',
    id,
    file: 'counties.json',
    label: field === 'dr' ? { zh: '各縣市的中醫師', en: 'Chinese medicine physicians by county' } : { zh: '各縣市的中藥販賣業', en: 'Herbal medicine dealers by county' },
    indicators: [indicator],
    radius: { field, stops },
    color,
    sortField: field,
    sizeLegend: {
      title: field === 'dr' ? { zh: '中醫師（人）', en: 'Physicians' } : { zh: '中藥販賣業（家）', en: 'Dealers' },
      values: [100, 500, 1500],
      format: (v) => fixed(v, 0),
    },
    tooltip: (p) => ({ title: county(p), extra: countyLines(p) }),
  };
}

const COUNTY_LIST: ListPanelDef = {
  label: { zh: '各縣市', en: 'Counties and cities' },
  tabLabel: { zh: '縣市', en: 'Counties' },
  indicators: ['physicians', 'herb-dealers'],
  file: 'counties.json',
  empty: { zh: '沒有縣市的資料', en: 'No county data' },
  rows: (points) =>
    [...points]
      .sort((a, b) => Number(b.dr) - Number(a.dr))
      .map((p, i): ListRow => ({
        key: `ct-${i}`,
        title: county(p),
        lines: countyLines(p),
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 9 },
      })),
};

// 健保特約的中醫院所（2026-11-08 使用者要求；pipeline/topics/taiwan_tcm_clinics.py）：位置只到鄉鎮市區
const KINDS = [
  { zh: '中醫醫院', en: 'Chinese medicine hospital' },
  { zh: '中醫診所', en: 'Chinese medicine clinic' },
  { zh: '醫院的中醫科', en: 'Hospital Chinese medicine department' },
];
const kindOf = (p: PointRecord) => tr(KINDS[Number(p.k) - 1] ?? KINDS[1]);
const area = (p: PointRecord) => (getLang() === 'zh' ? String(p.area ?? '') : String(p.areaEn ?? p.area ?? ''));
const TOWNSHIPS: PointsOverlayDef = {
  kind: 'points',
  id: 'nhi-townships',
  file: 'nhi-townships.json',
  label: { zh: '各鄉鎮市區的健保特約中醫院所', en: 'NHI-contracted Chinese medicine providers by township' },
  indicators: ['nhi-clinics'],
  radius: { field: 'n', stops: [[1, 2.5], [10, 5], [50, 10], [120, 16]] },
  color: C[1],
  sortField: 'n',
  sizeLegend: { title: { zh: '中醫院所（家）', en: 'Providers' }, values: [10, 50, 100], format: (v) => fixed(v, 0) },
  tooltip: (p) => ({
    title: getLang() === 'zh' ? String(p.c ?? '') : String(p.en ?? p.c ?? ''),
    extra: [
      tr({ zh: `中醫院所 ${n(p.n)} 家`, en: `${n(p.n)} Chinese medicine providers` }),
      tr({ zh: `診所 ${n(p.cl)}、醫院 ${n(p.h)}`, en: `${n(p.cl)} clinics, ${n(p.h)} hospitals` }),
    ],
  }),
};
const CLINIC_LIST: ListPanelDef = {
  label: { zh: '健保特約的中醫院所', en: 'NHI-contracted Chinese medicine providers' },
  tabLabel: { zh: '院所', en: 'Providers' },
  indicators: ['nhi-clinics'],
  file: 'nhi-clinics.json',
  countryField: 'iso3',
  empty: { zh: '沒有資料', en: 'No data' },
  rows: (points) =>
    points.map((p, i): ListRow => ({
      key: `nc-${i}`,
      title: String(p.name ?? ''),
      titleProper: getLang() !== 'zh',
      lines: [String(p.addr ?? ''), kindOf(p)],
      group: area(p),
      target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 12 },
    })),
};

const count = (unit: { zh: string; en: string }) => (v: number) => tr({ zh: `${fixed(v, 0)} ${unit.zh}`, en: `${fixed(v, 0)} ${unit.en}` });

export const taiwanTcm: TopicDefinition = {
  id: 'taiwan-tcm',
  title: { zh: '台灣的中醫：醫院、診所、中醫師與門診', en: 'Chinese medicine in Taiwan: hospitals, clinics, physicians and visits' },
  shortTitle: { zh: '台灣的中醫', en: 'Chinese medicine in Taiwan' },
  defaultIndicator: 'hospitals',
  defaultYear: 2025,
  focus: TAIWAN,
  sources: [
    {
      name: {
        zh: '衛生福利部統計處：表 1.6 醫療院所家數、表 1.7 機構執業醫事人員數、表 2.2.2 藥商家數按鄉鎮市區別分、表 3.3.8 中醫總額門診醫療費用申報狀況、表 3.2.8 與 3.2.6 中醫與西醫門診件數',
        en: 'Taiwan Ministry of Health and Welfare, Department of Statistics: tables 1.6 (medical institutions), 1.7 (practising health professionals), 2.2.2 (drug dealers by township), 3.3.8 (Chinese medicine outpatient claims) and 3.2.8 and 3.2.6 (Chinese and Western medicine outpatient visits)',
      },
      url: 'https://dep.mohw.gov.tw/DOS/cp-5301-62356-113.html',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
    {
      name: {
        zh: '衛生福利部中央健康保險署 2026 健保特約醫事機構-診所、醫學中心、區域醫院、地區醫院（健保署資料開放平台）',
        en: 'National Health Insurance Administration, 2026, NHI-contracted medical institutions: clinics, medical centres, regional and district hospitals (NHIA open data platform)',
      },
      url: 'https://info.nhi.gov.tw/',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
    {
      name: { zh: '內政部國土測繪中心：鄉鎮市區界線（鄉鎮市區的位置）', en: 'Ministry of the Interior, National Land Surveying and Mapping Center: township boundaries (township locations)' },
      url: 'https://data.gov.tw/dataset/7441',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: {
    zh: '衛生福利部統計處的統計表。全國的數字只有台灣一個值，地圖上是台灣上的一個圓，拖時間軸看變化，點台灣看歷年的折線；中醫師與中藥販賣業依縣市畫圓，左邊列出各縣市。門診的人數與件數是健保中醫總額的申報，不含自費；2015 年以前的表沒有人數，從 2016 年畫起。世界各國的中醫據點與草藥店見「傳統與替代醫學的據點」主題。',
    en: 'Tables from Taiwan’s Ministry of Health and Welfare, Department of Statistics. National figures have a single value for Taiwan, shown as one circle over Taiwan: drag the timeline to see the change, or click Taiwan for the line chart. Chinese medicine physicians and herbal medicine dealers are drawn as circles by county, with the counties listed on the left. Outpatient people and visits are National Health Insurance claims under the Chinese medicine budget, excluding private payments; tables before 2016 have no head counts, so those series start in 2016. Chinese medicine places and herbalists around the world are in the Traditional and alternative medicine topic.',
  },
  overlays: [countyOverlay('county-physicians', 'dr', 'physicians', C[0], [[0, 3], [100, 6], [500, 12], [1700, 22]]),
    countyOverlay('county-herb', 'herb', 'herb-dealers', C[3], [[0, 3], [100, 6], [500, 12], [1400, 20]]), TOWNSHIPS],
  listPanel: [COUNTY_LIST, CLINIC_LIST],
  indicators: [
    {
      id: 'hospitals',
      label: { zh: '中醫醫院', en: 'Chinese medicine hospitals' },
      description: { zh: '每年底的中醫醫院家數：1989 年 78 家，1994 年最多 109 家，之後一路減少，2000 年 52 家、2010 年 16 家，2020 年起只剩 4 家（公立 1、非公立 3）。同一段時間中醫診所從 1,657 家增加到 4,270 家，看中醫幾乎都在診所。對照西醫醫院從 787 家減到 455 家、西醫診所從 6,905 家增加到 12,688 家。拖時間軸看每一年。', en: 'Chinese medicine hospitals at the end of each year: 78 in 1989, peaking at 109 in 1994 and falling ever since, to 52 in 2000, 16 in 2010 and just 4 from 2020 (1 public, 3 private). Over the same period Chinese medicine clinics rose from 1,657 to 4,270, so Chinese medicine is now practised almost entirely in clinics. For comparison, Western medicine hospitals fell from 787 to 455 and Western clinics rose from 6,905 to 12,688. Drag the timeline to see each year.' },
      unit: { zh: '家', en: 'hospitals' },
      file: 'hospitals.json',
      layer: { kind: 'bubble', legendValues: [5, 50, 100] },
      integer: true,
      format: count({ zh: '家', en: 'hospitals' }),
      formatTick: (v) => fixed(v, 0),
      unranked: true,
      missing: { zh: '只有台灣：衛福部統計處的資料', en: 'Taiwan only: Ministry of Health and Welfare data' },
    },
    {
      id: 'clinics',
      label: { zh: '中醫診所', en: 'Chinese medicine clinics' },
      description: { zh: '中醫診所：1989 年 1,657 家，2025 年底 4,270 家（全部是非公立）。中醫醫院加診所 4,274 家，占全部醫療院所 24,546 家的 17.4%；同年西醫診所 12,688 家、牙醫診所 7,128 家。OpenStreetMap 上台灣的中醫據點只有 587 處，約是官方家數的 14%。', en: 'Chinese medicine clinics: 1,657 in 1989 and 4,270 at the end of 2025, all private. With the hospitals that makes 4,274, or 17.4% of Taiwan’s 24,546 medical institutions; the same year there were 12,688 Western medicine clinics and 7,128 dental clinics. OpenStreetMap has only 587 Chinese medicine places in Taiwan, about 14% of the official number.' },
      unit: { zh: '家', en: 'clinics' },
      file: 'clinics.json',
      layer: { kind: 'bubble', legendValues: [1000, 4000] },
      integer: true,
      format: count({ zh: '家', en: 'clinics' }),
      formatTick: (v) => fixed(v, 0),
      unranked: true,
      missing: { zh: '只有台灣：衛福部統計處的資料', en: 'Taiwan only: Ministry of Health and Welfare data' },
    },
    {
      id: 'physicians',
      label: { zh: '執業中醫師', en: 'Practising Chinese medicine physicians' },
      description: { zh: '2025 年底在醫療機構執業的中醫師 8,234 人（每萬人 3.53 人），是西醫師 56,405 人的 14.6%。地圖上是各縣市（依執業的機構所在地）的人數：臺中市 1,655 人最多，臺北市 1,205、新北市 1,137、高雄市 1,021、臺南市 680、桃園市 670；每萬人以臺中市 5.77 最高，臺北市 4.94、嘉義市 4.93，澎湖縣 0.47、金門縣 0.57，連江縣沒有。', en: 'At the end of 2025 there were 8,234 Chinese medicine physicians practising in medical institutions (3.53 per 10,000 people), 14.6% as many as the 56,405 Western medicine physicians. The map shows each county or city, by where the institution is: Taichung has the most (1,655), followed by Taipei (1,205), New Taipei (1,137), Kaohsiung (1,021), Tainan (680) and Taoyuan (670); per 10,000 people Taichung is highest at 5.77, then Taipei (4.94) and Chiayi City (4.93), with Penghu at 0.47, Kinmen at 0.57 and none in Lienchiang.' },
      unit: { zh: '人', en: 'physicians' },
      file: 'physicians.json',
      layer: { kind: 'none' },
      integer: true,
      format: count({ zh: '人', en: 'physicians' }),
      formatTick: (v) => fixed(v, 0),
      unranked: true,
      missing: { zh: '只有台灣：衛福部統計處的資料', en: 'Taiwan only: Ministry of Health and Welfare data' },
    },
    {
      id: 'herb-dealers',
      label: { zh: '中藥販賣業', en: 'Chinese herbal medicine dealers' },
      description: { zh: '2025 年底的中藥販賣業（藥事法第 28 條第 2 項與第 103 條的中藥商）9,115 家，22 個縣市加總：高雄市 1,382 家最多，臺中市 1,239、新北市 1,043、臺南市 979、臺北市 903、彰化縣 676。另外有 5,311 家藥局兼營中藥調劑零售，不算在裡面。OpenStreetMap 上台灣的草藥店只有 73 處。', en: 'At the end of 2025 there were 9,115 Chinese herbal medicine dealers (licensed under articles 28(2) and 103 of the Pharmaceutical Affairs Act), summed over 22 counties and cities: Kaohsiung has the most (1,382), followed by Taichung (1,239), New Taipei (1,043), Tainan (979), Taipei (903) and Changhua (676). Another 5,311 pharmacies also dispense Chinese medicine and are not included. OpenStreetMap has only 73 herbalists in Taiwan.' },
      unit: { zh: '家', en: 'dealers' },
      file: 'herb-dealers.json',
      layer: { kind: 'none' },
      integer: true,
      format: count({ zh: '家', en: 'dealers' }),
      formatTick: (v) => fixed(v, 0),
      unranked: true,
      missing: { zh: '只有台灣：衛福部統計處的資料', en: 'Taiwan only: Ministry of Health and Welfare data' },
    },
    {
      id: 'patients',
      label: { zh: '一年看過中醫的人', en: 'People using Chinese medicine in a year' },
      description: { zh: '一年裡在健保看過中醫門診的人數（中醫總額的申報）：2016 年 661 萬人，2021 年最少 554 萬人，2023 年最多 693 萬人，2024 年 638 萬人。2024 年女性占 61%，平均每人看 6.67 次。', en: 'People with at least one National Health Insurance Chinese medicine outpatient visit in the year (claims under the Chinese medicine budget): 6.61 million in 2016, a low of 5.54 million in 2021, a high of 6.93 million in 2023 and 6.38 million in 2024. In 2024, 61% were women, and each person averaged 6.67 visits.' },
      unit: { zh: '人', en: 'people' },
      file: 'patients.json',
      layer: { kind: 'bubble', legendValues: [3e6, 6e6] },
      integer: true,
      format: count({ zh: '人', en: 'people' }),
      formatTick: (v) => fixed(v, 0),
      unranked: true,
      missing: { zh: '只有台灣：衛福部統計處的資料', en: 'Taiwan only: Ministry of Health and Welfare data' },
    },
    {
      id: 'visits',
      label: { zh: '中醫門診件數', en: 'Chinese medicine outpatient visits' },
      description: { zh: '中醫門診件數（同一個人看好幾次算好幾件；中醫總額的申報）：2016 年 4,050 萬件，2021 年最少 3,492 萬件，2023 年最多 4,409 萬件，2024 年 4,260 萬件。依疾病別的另一張表（口徑不同）2024 年是 4,544 萬件，女性 2,913 萬件、男性 1,630 萬件，女性是男性的 1.79 倍；同年西醫門診 3 億 3,066 萬件，女性是男性的 1.20 倍，中醫的件數約是西醫的 13.7%。衛福部核定的 2025 年度中醫門診總額是 341.92 億元，成長率 5.274%（衛福部 2025 年 1 月 9 日的新聞稿；除專款外是預估值）。', en: 'Chinese medicine outpatient visits (one person visiting several times counts several times; claims under the Chinese medicine budget): 40.50 million in 2016, a low of 34.92 million in 2021, a high of 44.09 million in 2023 and 42.60 million in 2024. A separate table by disease (on a different basis) gives 45.44 million for 2024: 29.13 million by women and 16.30 million by men, 1.79 times as many; the same year Western medicine had 330.66 million outpatient visits, with women at 1.20 times men, so Chinese medicine visits were about 13.7% of Western ones. The Ministry of Health and Welfare set the 2025 Chinese medicine outpatient global budget at NT$34.192 billion, a growth rate of 5.274% (ministry press release, 9 January 2025; mostly an estimate until settlement).' },
      unit: { zh: '件', en: 'visits' },
      file: 'visits.json',
      layer: { kind: 'bubble', legendValues: [2e7, 4e7] },
      integer: true,
      format: count({ zh: '件', en: 'visits' }),
      formatTick: (v) => fixed(v, 0),
      unranked: true,
      missing: { zh: '只有台灣：衛福部統計處的資料', en: 'Taiwan only: Ministry of Health and Welfare data' },
    },
    {
      id: 'nhi-clinics',
      label: { zh: '健保特約的中醫院所（依鄉鎮市區）', en: 'NHI-contracted Chinese medicine providers by township' },
      description: {
        zh: '健保署公開的特約醫事機構名單裡現在特約的中醫院所 4,230 家：中醫診所 4,074 家、中醫醫院 3 家（三義慈濟、高雄市立、天心；美德中醫醫院的合約日期已過，不算）、設有中醫科的西醫醫院 153 家。地圖上每個鄉鎮市區一個圓：368 個鄉鎮市區裡 287 個至少有一家，新北市板橋區 119 家最多，其次是臺中市北屯區 114、臺北市大安區 109、桃園市桃園區 101、高雄市三民區 90；連江縣的四個鄉都沒有。縣市是臺中市 816 家最多，新北市 582、臺北市 577、高雄市 517。左邊的清單列出每一家的名稱、地址與類型（依鄉鎮市區分組，可以搜尋），不列電話與醫師。名單只有地址、沒有座標，所以位置只到鄉鎮市區，點一家會移到它所在的鄉鎮市區。衛福部統計處 2025 年底的中醫診所是 4,270 家，比健保特約的多，因為不是每一家都跟健保簽約。',
        en: 'NHI-contracted Chinese medicine providers currently under contract in the National Health Insurance Administration’s open list: 4,230 in all, comprising 4,074 Chinese medicine clinics, 3 Chinese medicine hospitals (Sanyi Tzu Chi, Kaohsiung Municipal and Tianxin; Meide’s contract date has passed and it is not counted) and 153 Western hospitals with a Chinese medicine department. The map draws one circle per township: 287 of 368 townships have at least one, led by Banqiao District, New Taipei (119), followed by Beitun District, Taichung (114), Da’an District, Taipei (109), Taoyuan District (101) and Sanmin District, Kaohsiung (90); none of the four townships of Lienchiang County has one. By county, Taichung has the most (816), followed by New Taipei (582), Taipei (577) and Kaohsiung (517). The list on the left gives each provider’s name, address and type (grouped by township and searchable), without phone numbers or physicians. The list has addresses but no coordinates, so locations are only to the township, and clicking a provider moves to its township. The Ministry of Health and Welfare counted 4,270 Chinese medicine clinics at the end of 2025, more than contract with National Health Insurance.',
      },
      unit: { zh: '家', en: 'providers' },
      file: 'nhi-clinics-total.json',
      layer: { kind: 'none' },
      timeless: true,
      integer: true,
      format: count({ zh: '家', en: 'providers' }),
      formatTick: (v) => fixed(v, 0),
      unranked: true,
      missing: { zh: '只有台灣：健保署的資料', en: 'Taiwan only: National Health Insurance Administration data' },
    },
  ],
};
