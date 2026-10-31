import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 研發投入最多的公司（2026-10-31，製作手冊第十批 173；pipeline/topics/rd_companies.py）：歐盟 JRC「EU Industrial R&D
 * Investment Scoreboard」的全球研發前 2,000 大公司。使用者決定 736、737 合成獨立的主題，放科技的「研發與太空」欄。
 */

const SECTORS: { value: number; label: { zh: string; en: string } }[] = [
  { value: 1, label: { zh: '資通訊硬體', en: 'ICT hardware' } },
  { value: 2, label: { zh: '軟體與資訊服務', en: 'Software and ICT services' } },
  { value: 3, label: { zh: '製藥、生技與醫材', en: 'Health' } },
  { value: 4, label: { zh: '汽車與零件', en: 'Automobiles and parts' } },
  { value: 5, label: { zh: '工業、航太與國防', en: 'Industrials, aerospace and defence' } },
  { value: 6, label: { zh: '其他', en: 'Other' } },
];
const SECTOR_COLORS: ColorClasses = {
  field: 'sec',
  title: { zh: '產業', en: 'Sector' },
  thresholds: [1.5, 2.5, 3.5, 4.5, 5.5],
  classes: SECTORS.map((s, i) => ({ color: i === 5 ? MAP_TOKENS.inkMuted : MAP_TOKENS.categorical[i], label: s.label })),
};
const sectorText = (v: unknown) => tr(SECTORS.find((s) => s.value === v)?.label ?? { zh: '', en: '' });

/** 百萬歐元 → 「65.3 億歐元」「€6.5bn」 */
function eur(v: number): string {
  const trim = (x: string) => x.replace(/\.0$/, '');
  if (v >= 1000) return tr({ zh: `${trim(fixed(v / 100, 1))} 億歐元`, en: `€${trim(fixed(v / 1000, 1))}bn` });
  return tr({ zh: `${fixed(v, 0)} 百萬歐元`, en: `€${fixed(v, 0)}m` });
}

/** Scoreboard 的公司名稱是全大寫，畫面上改成每個字首大寫（縮寫保留） */
function title(name: string): string {
  return name
    .split(' ')
    .map((w) => (w.length <= 3 && /^[A-Z&.]+$/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(' ');
}

function lines(p: PointRecord, countryName: (iso3: string) => string): string[] {
  const out = [
    [typeof p.iso3 === 'string' ? countryName(p.iso3) : null, sectorText(p.sec)].filter(Boolean).join(' · '),
    tr({ zh: `研發第 ${p.r} 名 · ${eur(p.rd as number)}`, en: `R&D rank ${p.r} · ${eur(p.rd as number)}` }),
  ];
  if (typeof p.s === 'number') out.push(tr({ zh: `營收 ${eur(p.s)}`, en: `Net sales ${eur(p.s)}` }));
  return out;
}

const HQ: PointsOverlayDef = {
  kind: 'points',
  id: 'hq',
  file: 'hq.json',
  label: { zh: '總部（2024 會計年度，研發前 300 大與台灣的公司）', en: 'Headquarters (FY2024; top 300 by R&D and Taiwanese companies)' },
  radius: { field: 'rd', stops: [[100, 3], [1000, 5], [10000, 10], [60000, 20]] },
  color: SECTOR_COLORS,
  // 對到 Wikidata 總部座標的才畫（其他的座標是首都，只給清單用）
  minValue: { field: 'hq', stops: [[0, 1]] },
  sortField: 'rd',
  sizeLegend: { title: { zh: '研發投入', en: 'R&D investment' }, values: [1000, 10000, 50000], format: eur },
  tooltip: (p, ctx) => ({
    title: title(String(p.name ?? '')),
    detail: lines(p, ctx.countryName)[0],
    extra: lines(p, ctx.countryName).slice(1),
    properNoun: String(p.name ?? ''),
  }),
};

/** 左邊的清單（使用者 2026-10-30 決定）：前 50 大公司（依研發金額），點了移到總部；跟選取的國家連動要等第十二批的 L23 */
const LIST: ListPanelDef = {
  label: { zh: '研發前 50 大', en: 'Top 50 R&D investors' },
  file: 'hq.json',
  rows: (points, { countryName }) =>
    points
      .filter((p) => (p.r as number) <= 50)
      .sort((a, b) => (a.r as number) - (b.r as number))
      .map(
        (p): ListRow => ({
          key: String(p.r),
          title: title(String(p.name ?? '')),
          titleProper: true,
          lines: [...lines(p, countryName), p.hq === 1 ? '' : tr({ zh: '總部沒有對到座標，點了移到首都', en: 'Headquarters not located; goes to the capital' })].filter(Boolean),
          target: { lon: p.lon as number, lat: p.lat as number, zoom: p.hq === 1 ? 10 : 5 },
        }),
      ),
};

export const rdCompanies: TopicDefinition = {
  id: 'rd-companies',
  title: { zh: '研發投入最多的公司', en: 'Top corporate R&D investors' },
  shortTitle: { zh: '研發大公司', en: 'Top R&D firms' },
  defaultIndicator: 'companies',
  defaultYear: 2024,
  sources: [
    {
      name: {
        zh: '歐盟執委會 JRC：EU Industrial R&D Investment Scoreboard（2013–2025 年版，世界前 2,000 大）',
        en: 'European Commission JRC, EU Industrial R&D Investment Scoreboard (2013–2025 editions, world top 2,000)',
      },
      url: 'https://knowledge-for-policy.ec.europa.eu/economics-industrial-research-innovation-iri_en',
      license: 'CC BY 4.0',
    },
    { name: { zh: 'Wikidata（總部的位置）', en: 'Wikidata (headquarters locations)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
  ],
  note: {
    zh: '每年研發投入最多的前 2,000 家上市公司（各版收錄 2,000 或 2,500 家，這裡一律用前 2,000 大），資料是承包商從公司年報整理的。年份是會計年度（2025 年版是 2024 會計年度），金額換成歐元。研發算在總部登記的國家，不是研發實際發生的地方（例如台積電的研發算台灣、蘋果算美國）。總部的點只畫研發前 300 大與台灣的公司裡、在 Wikidata 對得到總部座標的 264 家。英文維基的科技公司營收表整份來自 Fortune Global 500，Fortune 不准轉載，所以不用。',
    en: 'The 2,000 listed companies that invest the most in R&D each year (editions cover 2,000 or 2,500 companies; the top 2,000 are used throughout), compiled by a contractor from annual reports. Years are financial years (the 2025 edition covers FY2024), with amounts in euros. R&D is counted in the country of the registered headquarters, not where the research is done (TSMC’s counts for Taiwan, Apple’s for the US). Headquarters points are drawn only for the 264 of the top 300 and Taiwanese companies whose headquarters could be located in Wikidata. The English Wikipedia table of tech companies by revenue comes entirely from the Fortune Global 500, whose terms forbid reuse, so it is not used.',
  },
  listPanel: LIST,
  overlays: [HQ],
  indicators: [
    {
      id: 'companies',
      label: { zh: '前 2,000 大的家數', en: 'Companies in the top 2,000' },
      description: {
        zh: '每個國家有幾家公司進入全球研發投入前 2,000 大。2024 會計年度美國 674 家、中國 525、日本 192、德國 109、英國 57、台灣 56、法國 53、南韓 41；中國從 2012 年的不到 100 家快速增加。',
        en: 'How many of the world’s top 2,000 corporate R&D investors are headquartered in each country. In FY2024: the US 674, China 525, Japan 192, Germany 109, the UK 57, Taiwan 56, France 53 and South Korea 41; China has risen fast from under 100 in 2012.',
      },
      unit: { zh: '家', en: 'companies' },
      file: 'companies.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 30, 100, 300] } },
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 家`, en: `${fixed(v, 0)} ${v === 1 ? 'company' : 'companies'}` }),
      formatTick: (v) => fixed(v, 0),
      missing: { zh: '沒有公司進入前 2,000 大', en: 'No company in the top 2,000' },
    },
    {
      id: 'rd',
      label: { zh: '研發投入合計', en: 'Total R&D investment' },
      description: {
        zh: '總部在這個國家、進入前 2,000 大的公司的研發投入合計（百萬歐元）。2024 會計年度美國 6,808 億歐元、中國 2,332 億、德國 1,146 億、日本 1,124 億、法國 464 億、南韓 452 億、台灣 278 億。第 1 名是亞馬遜（653 億），台積電第 41（60 億）、聯發科第 59、鴻海第 69。',
        en: 'Total R&D investment by top-2,000 companies headquartered in the country (€ millions). In FY2024: the US €680.8bn, China €233.2bn, Germany €114.6bn, Japan €112.4bn, France €46.4bn, South Korea €45.2bn and Taiwan €27.8bn. Amazon ranks first (€65.3bn); TSMC is 41st (€6.0bn), MediaTek 59th and Foxconn (Hon Hai) 69th.',
      },
      unit: { zh: '百萬歐元', en: '€ millions' },
      file: 'rd.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [100, 1000, 5000, 20000, 100000, 300000] } },
      format: eur,
      formatTick: (v) => tr({ zh: `${fixed(v / 100, 0)} 億`, en: v >= 1000 ? `${fixed(v / 1000, 0)}bn` : `${fixed(v, 0)}m` }),
      compareWorld: true,
      missing: { zh: '沒有公司進入前 2,000 大', en: 'No company in the top 2,000' },
    },
    {
      id: 'rd-share',
      label: { zh: '占前 2,000 大研發的比例', en: 'Share of top-2,000 R&D' },
      description: {
        zh: '總部在這個國家的公司占前 2,000 大研發投入合計的比例。2024 會計年度美國 47%、中國 16%、德國 8%、日本 8%，台灣 1.9%。',
        en: 'The share of the top 2,000 companies’ total R&D investment held by companies headquartered in the country. In FY2024: the US 47%, China 16%, Germany 8%, Japan 8% and Taiwan 1.9%.',
      },
      unit: '%',
      file: 'rd-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.1, 0.5, 1, 3, 10, 30] } },
      format: (v) => `${fixed(v, v < 1 ? 2 : 1)}%`,
      formatTick: (v) => `${v}%`,
      missing: { zh: '沒有公司進入前 2,000 大', en: 'No company in the top 2,000' },
    },
  ],
};
