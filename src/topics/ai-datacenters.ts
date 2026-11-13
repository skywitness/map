import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { TopicPart } from './parts';
import type { ListPanelDef, ListRow, PointRecord, PointsOverlayDef } from './types';

/**
 * 各國 AI 發展（ai.ts）的前沿 AI 資料中心部分（2026-11-13，使用者要求把 AI 產業鏈全景的資料用到地圖上，
 * 採用「直接用 Epoch 的原始檔」的建議；pipeline/topics/ai_datacenters.py）：Epoch AI 的 96 個大型 AI 資料中心，
 * 每年底的 IT 電力（今天以後是依許可與公告推估的規劃）。
 */
const YEARS = Array.from({ length: 12 }, (_, i) => 2019 + i);
const THIS_YEAR = 2026;
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const num = (v: unknown) => (typeof v === 'number' ? v : null);
const mw = (v: number) =>
  v >= 1000 ? tr({ zh: `${fixed(v / 1000, 2)} GW`, en: `${fixed(v / 1000, 2)} GW` }) : tr({ zh: `${fixed(v, 0)} MW`, en: `${fixed(v, 0)} MW` });
const yearOf = (y: number | undefined) => Math.min(YEARS[YEARS.length - 1], Math.max(YEARS[0], y ?? THIS_YEAR));

/** AI 產業鏈全景的座標精度（它的 note 寫的「座標為…層級」） */
const PRECISION_EN: Record<string, string> = { 地址: 'address', 道路: 'road', 鄉鎮: 'township', 郡縣: 'county', 城市: 'city' }; // i18n-ignore（資料裡的中文鍵）
function placeLine(p: PointRecord): string {
  const pl = str(p.pl) ?? '';
  if (p.q === 1) return tr({ zh: '位置：地址（美國人口普查局的地理編碼）', en: 'Location: street address (US Census Bureau geocoder)' });
  if (p.q === 2)
    return getLang() === 'zh'
      ? `位置：${pl || '大約的'}層級（AI 產業鏈全景，OpenStreetMap）` // i18n-ignore（只在中文介面）
      : `Location: ${PRECISION_EN[pl] ?? 'approximate'} level (AI Chain, OpenStreetMap)`;
  return tr({ zh: `位置：只到城鎮（${pl}，Wikidata）`, en: `Location: town only (${pl}, Wikidata)` });
}

function lines(p: PointRecord, countryName: (iso3: string) => string, year: number): string[] {
  const y = yearOf(year);
  const at = num(p[`p${y}`]);
  const now = num(p.now);
  const max = num(p.max);
  return [
    [str(p.owner), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
    at
      ? tr({ zh: `${y} 年底 IT 電力 ${mw(at)}${y > THIS_YEAR ? '（規劃）' : ''}`, en: `IT power at end of ${y}: ${mw(at)}${y > THIS_YEAR ? ' (planned)' : ''}` })
      : tr({ zh: `${y} 年底還沒有運轉`, en: `Not yet operating at end of ${y}` }),
    [
      now ? tr({ zh: `現在 ${mw(now)}`, en: `now ${mw(now)}` }) : tr({ zh: '現在還沒有運轉', en: 'not yet operating' }),
      max ? tr({ zh: `規劃到 ${mw(max)}`, en: `planned up to ${mw(max)}` }) : null,
      num(p.y0) ? tr({ zh: `${p.y0} 年開始運轉`, en: `operating from ${p.y0}` }) : null,
    ]
      .filter(Boolean)
      .join(' · '),
    str(p.users) ? tr({ zh: `使用者：${p.users}`, en: `Users: ${p.users}` }) : '',
    placeLine(p),
  ].filter(Boolean);
}

const CAMPUSES: PointsOverlayDef = {
  kind: 'points',
  id: 'ai-campuses',
  file: 'ai-campuses.json',
  label: { zh: '前沿 AI 資料中心（大小是那一年底的 IT 電力）', en: 'Frontier AI data centres (size is IT power at year end)' },
  indicators: ['ai-campus-power'],
  epochs: { years: YEARS, values: (p, y) => ({ mw: num(p[`p${y}`]) }) },
  radius: { field: 'mw', stops: [[10, 3], [100, 5], [500, 9], [2000, 16]] },
  color: MAP_TOKENS.categorical[1],
  minValue: { field: 'mw', stops: [[0, 1]] },
  sortField: 'mw',
  sizeLegend: { title: { zh: 'IT 電力', en: 'IT power' }, values: [100, 500, 2000], format: mw },
  tooltip: (p, { countryName, year }) => {
    const [head, ...rest] = lines(p, countryName, year);
    return { title: String(p.name ?? ''), detail: head, extra: rest, properNoun: String(p.name ?? '') };
  },
};

const LIST: ListPanelDef = {
  label: { zh: '前沿 AI 資料中心', en: 'Frontier AI data centres' },
  tabLabel: { zh: '資料中心', en: 'Data centres' },
  indicators: ['ai-campus-power'],
  file: 'ai-campuses.json',
  countryField: 'iso3',
  empty: { zh: '這個國家沒有收錄的資料中心', en: 'No data centres listed for this country' },
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => (num(b.max) ?? 0) - (num(a.max) ?? 0))
      .map(
        (p, i): ListRow => ({
          key: `dc-${i}`,
          title: String(p.name ?? ''),
          titleProper: true,
          lines: lines(p, countryName, THIS_YEAR).filter((_, k) => k !== 1).slice(0, 3),
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 11 },
        }),
      ),
};

export const aiDatacentersPart: TopicPart = {
  name: { zh: '前沿 AI 資料中心', en: 'Frontier AI data centres' },
  sources: [
    { name: 'Epoch AI, Frontier Data Centers', url: 'https://epoch.ai/data/ai-data-centers', license: 'CC BY 4.0' },
    {
      name: { zh: '美國人口普查局 Census Geocoder（美國資料中心的地址）', en: 'US Census Bureau Geocoder (US data centre addresses)' },
      url: 'https://geocoding.geo.census.gov/geocoder/',
      license: { zh: '公有領域', en: 'Public domain' },
    },
    {
      name: { zh: 'AI 產業鏈全景：資料中心園區的座標（OpenStreetMap Nominatim）', en: 'AI Chain (AI 產業鏈全景): campus coordinates (OpenStreetMap Nominatim)' }, // i18n-ignore（網站的中文名稱是專有名詞）
      url: 'https://skywitness.github.io/ai-chain/',
      license: 'ODbL 1.0',
    },
  ],
  note: {
    zh: 'Epoch AI 用衛星影像、許可文件與公開資訊估計的 96 個大型 AI 資料中心，電力是 IT 設備的電力（設施的總用電再高 20–50%），今天以後的是依許可與公告推估的規劃，可能延後或取消；它收錄的是最大的那些，不是全部的資料中心。Epoch 只給地址：美國的地址用美國人口普查局的地理編碼，對不到的（新工業區、只寫路名）沿用 AI 產業鏈全景的座標或用城鎮的位置，每一個都寫出位置的精度。',
    en: 'Epoch AI estimates 96 large AI data centres from satellite imagery, permits and public information. Power is IT power (total facility use is 20–50% higher); values after today are projections from permits and announcements and may slip or be cancelled. The dataset covers the largest sites, not all data centres. Epoch gives only addresses: US addresses are geocoded with the US Census Bureau geocoder, and those it cannot match (new industrial parks, road names only) use AI Chain’s coordinates or the town location, with the precision shown for each.',
  },
  overlays: [CAMPUSES],
  listPanel: [LIST],
  indicators: [
    {
      id: 'ai-campus-power',
      label: { zh: '前沿 AI 資料中心的電力', en: 'Frontier AI data-centre power' },
      description: {
        zh: '這一年底 Epoch AI 收錄的前沿 AI 資料中心的 IT 電力合計（MW），依所在國家。96 個裡美國 77 個、中國 5 個、馬來西亞 4 個、挪威 2 個。2022 年底只有 2 個、67 MW；2024 年底 22 個、2,015 MW；2025 年底 47 個、6,756 MW；2026 年底 84 個、17,079 MW（美國 14,091、馬來西亞 1,251、中國 1,084）；2028 年規劃到 38,176 MW，美國占 32,840。現在最大的是 Anthropic 與 Amazon 的新卡萊爾園區 1,037 MW、SpaceXAI（原 xAI）的 Colossus 2 946 MW、OpenAI Stargate 阿比林 824 MW；規劃最大的是微軟 Fairwater 威斯康辛 2,263 MW。2027 年以後是規劃。拖時間軸看每一年。',
        en: 'Total IT power (MW) of the frontier AI data centres in Epoch AI’s dataset at the end of each year, by country. Of the 96, 77 are in the US, 5 in China, 4 in Malaysia and 2 in Norway. At the end of 2022 there were only 2 with 67 MW; 22 with 2,015 MW at the end of 2024; 47 with 6,756 MW at the end of 2025; and 84 with 17,079 MW at the end of 2026 (US 14,091, Malaysia 1,251, China 1,084). Plans reach 38,176 MW by 2028, 32,840 of it in the US. The largest today are Anthropic and Amazon’s New Carlisle campus at 1,037 MW, SpaceXAI’s (formerly xAI) Colossus 2 at 946 MW and OpenAI’s Stargate Abilene at 824 MW; the largest planned is Microsoft’s Fairwater Wisconsin at 2,263 MW. Years from 2027 are plans. Drag the timeline to see each year.',
      },
      unit: { zh: 'MW', en: 'MW' },
      file: 'ai-campus-power.json',
      defaultYear: THIS_YEAR,
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      format: mw,
      formatTick: (v) => fixed(v, 0),
      missing: { zh: '沒有收錄的前沿 AI 資料中心', en: 'No frontier AI data centres listed' },
    },
  ],
};
