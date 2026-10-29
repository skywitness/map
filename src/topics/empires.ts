import { getLang, tr } from '../i18n/lang';
import { fetchJson } from '../lib/data';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, PointRecord, TopicDefinition } from './types';

/**
 * 帝國與疆界（pipeline/topics/empires.py）：Cliopatria（Seshat）西元前 3400 年到 2024 年各政體的範圍，
 * 加上 COLDAT 1462 年起各國被哪個歐洲國家殖民。台灣在各時期屬於誰逐一核對過，Cliopatria 錯或缺的依史實修正（fx）。
 */

/** 年份：「西元前 221 年」「1650 年」；英文「221 BCE」「1650」 */
export function yearText(y: number): string {
  return y < 0 ? tr({ zh: `西元前 ${-y} 年`, en: `${-y} BCE` }) : tr({ zh: `${y} 年`, en: `${y}` });
}

/** 年份不加「年」：「西元前 221」「1650」（範圍的起點：「1624–1662 年」） */
export function yearBare(y: number): string {
  return y < 0 ? tr({ zh: `西元前 ${-y}`, en: `${-y} BCE` }) : `${y}`;
}

/** 時間軸上的短寫法：「前 3400」「1650」；英文「3400 BCE」 */
export function yearTick(y: number): string {
  return y < 0 ? tr({ zh: `前 ${-y}`, en: `${-y} BCE` }) : `${y}`;
}

/** 範圍：起訖年份（b 是結束的下一年） */
export function spanText(a: number, b: number): string {
  const end = b - 1;
  return a === end ? yearText(a) : tr({ zh: `${yearText(a)}–${yearText(end).replace('西元前 ', '前 ')}`, en: `${yearText(a)}–${yearText(end)}` });
}

/** 政體的名稱：中文介面用 Wikidata 的中文名稱，沒有時用英文 */
export function polityName(p: { n?: unknown; z?: unknown }): string {
  if (getLang() !== 'en' && typeof p.z === 'string' && p.z) return p.z;
  return typeof p.n === 'string' ? p.n : '';
}

/**
 * 政體的顏色（pipeline 的 COLORS = 10 種，相鄰的帝國不同色）：柔和、彼此分得開的 10 種，墊在陸地上半透明；
 * 一個帝國（例如大英帝國的各部分）同一個顏色。不用藍色：底圖的海是藍的，藍色的政體（例如荷蘭的台灣）看起來像海
 */
const FILLS = ['#e8a838', '#c55aa8', '#9c6ade', '#58b368', '#e5677d', '#c8a26a', '#4cb7a5', '#d97b45', '#a0785a', '#b5b84a'];

function polityTooltip(p: PointRecord) {
  const member = getLang() !== 'en' && typeof p.w === 'string' && p.w ? p.w : typeof p.m === 'string' ? p.m : '';
  const extra: string[] = [];
  if (member) extra.push(tr({ zh: `屬於${member}`, en: `Part of the ${member}` }));
  if (p.fx) extra.push(tr({ zh: '台灣的部分依史實修正（見附註）', en: 'Taiwan corrected from historical sources (see the note)' }));
  const original = typeof p.n === 'string' ? p.n : '';
  const shown = polityName(p);
  return {
    title: shown,
    detail: typeof p.a === 'number' && typeof p.b === 'number' ? tr({ zh: `這個範圍：${spanText(p.a, p.b)}`, en: `This extent: ${spanText(p.a, p.b)}` }) : undefined,
    extra,
    properNoun: shown !== original ? original : undefined,
  };
}

function labelText(p: PointRecord): string {
  return polityName(p);
}

/** COLDAT 的殖民國代碼（pipeline 的 COLONIZERS） */
export const COLONIZERS: { value: number; label: { zh: string; en: string } }[] = [
  { value: 1, label: { zh: '英國', en: 'Britain' } },
  { value: 2, label: { zh: '法國', en: 'France' } },
  { value: 3, label: { zh: '西班牙', en: 'Spain' } },
  { value: 4, label: { zh: '葡萄牙', en: 'Portugal' } },
  { value: 5, label: { zh: '荷蘭', en: 'Netherlands' } },
  { value: 6, label: { zh: '比利時、德國、義大利', en: 'Belgium, Germany or Italy' } },
  { value: 7, label: { zh: '日本（只補了台灣）', en: 'Japan (added for Taiwan only)' } },
];

/** COLDAT 的殖民國名稱（colonial.json 的英文代碼） */
export const COLONIZER_NAMES: Record<string, { zh: string; en: string }> = {
  britain: { zh: '英國', en: 'Britain' },
  france: { zh: '法國', en: 'France' },
  spain: { zh: '西班牙', en: 'Spain' },
  portugal: { zh: '葡萄牙', en: 'Portugal' },
  netherlands: { zh: '荷蘭', en: 'Netherlands' },
  belgium: { zh: '比利時', en: 'Belgium' },
  germany: { zh: '德國', en: 'Germany' },
  italy: { zh: '義大利', en: 'Italy' },
  japan: { zh: '日本', en: 'Japan' },
};

// ── tooltip 的「今天的〇〇在那一年屬於…」：countries.json（側欄同一個檔，fetchJson 有快取） ──────────
export interface CountriesFile {
  names: Record<string, string>;
  countries: Record<string, [number, number, string, number][]>;
}
let timeline: CountriesFile | null = null;
let loading = false;
/** 今天的國土那一年屬於哪些政體；還沒讀到是 null（tooltip 先不寫，滑鼠再動一下就有） */
function rulersAt(iso3: string, year: number): string[] | null {
  if (!timeline && !loading) {
    loading = true;
    fetchJson<CountriesFile>('topics/empires/countries.json').then(
      (d) => (timeline = d),
      () => (loading = false),
    );
  }
  if (!timeline) return null;
  const spans = timeline.countries[iso3] ?? [];
  return spans
    .filter(([a, b]) => a <= year && year <= b)
    .map(([, , name, share]) => {
      const shown = getLang() !== 'en' ? (timeline!.names[name] ?? name) : name;
      return share >= 95 ? shown : tr({ zh: `${shown}（${share}%）`, en: `${shown} (${share}%)` });
    });
}

const AXIS = { label: { zh: '年份', en: 'Year' }, year: yearText, tick: yearTick };

const indicators: IndicatorDef[] = [
  {
    id: 'polities',
    label: { zh: '各時期的疆域', en: 'Polities through time' },
    description: {
      zh: '時間軸那一年世界各政體的範圍（Cliopatria），顏色依帝國分（同一個帝國的各部分同色，相鄰的不同色）；滑過看名稱與這個範圍的年份。國家不上色，滑到國家上看今天的國土在那一年屬於誰，點國家看歷代。西元前每 100 年、西元 1800 年以前每 50 年、之後每 5 年一格。',
      en: 'The extent of every polity in the selected year (Cliopatria), coloured by empire (parts of one empire share a colour; neighbours differ). Hover for the name and the years of that extent. Countries are not coloured: hover over one to see who held today’s territory that year, or click it for its history. Every 100 years BCE, every 50 years until 1800 and every 5 years after.',
    },
    unit: '',
    file: 'polities-years.json',
    layer: { kind: 'none' },
    overlayTime: 'cumulative',
    unranked: true,
    rankingBars: false,
    panelChart: false,
    format: () => '',
    timeAxis: AXIS,
    missing: { zh: '國家不上色，看地圖上的疆域', en: 'Countries are not coloured; see the polities on the map' },
  },
  {
    id: 'colonizer',
    label: { zh: '殖民帝國', en: 'Colonial rule' },
    description: {
      zh: '那一年是哪個歐洲國家的殖民地（COLDAT：英國、法國、西班牙、葡萄牙、荷蘭、比利時、德國、義大利 8 國，用平均的起訖年份）；同時有兩個的取比較晚開始的那個。只補了台灣：荷蘭 1624–1662、西班牙 1626–1642（北部）、日本 1895–1945，其他被日本、美國、俄羅斯、鄂圖曼等統治的地方沒有收。',
      en: 'Which European country ruled the territory as a colony that year (COLDAT: Britain, France, Spain, Portugal, the Netherlands, Belgium, Germany and Italy, with average start and end dates); where two overlap, the later one is shown. Only Taiwan has been added: the Netherlands 1624–1662, Spain 1626–1642 (the north) and Japan 1895–1945; other territories ruled by Japan, the United States, Russia, the Ottomans and others are not included.',
    },
    unit: '',
    file: 'colonizer.json',
    layer: {
      kind: 'categorical',
      categories: COLONIZERS.map((c) => ({ value: c.value, label: c.label })),
    },
    format: (v) => {
      const c = COLONIZERS.find((k) => k.value === v);
      return c ? tr(c.label) : '';
    },
    timeAxis: AXIS,
    defaultYear: 1900,
    missing: { zh: '這一年不是這 8 個歐洲國家的殖民地', en: 'Not a colony of these eight European countries that year' },
  },
];

export const empires: TopicDefinition = {
  id: 'empires',
  title: { zh: '帝國與疆界', en: 'Empires and borders' },
  shortTitle: { zh: '帝國與疆界', en: 'Empires' },
  defaultIndicator: 'polities',
  defaultYear: 100,
  sources: [
    {
      name: {
        zh: 'Cliopatria v0.2.1（Seshat 全球歷史資料庫；Bennett 等 2025，Scientific Data）',
        en: 'Cliopatria v0.2.1 (Seshat Global History Databank; Bennett et al. 2025, Scientific Data)',
      },
      url: 'https://doi.org/10.5281/zenodo.23128623',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'COLDAT 殖民時期資料集（Becker）', en: 'COLDAT Colonial Dates Dataset (Becker)' },
      url: 'https://doi.org/10.7910/DVN/T9SDEW',
      license: 'CC0',
    },
    {
      name: { zh: 'Wikidata（政體的中文名稱）', en: 'Wikidata (Chinese names of polities)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
  ],
  note: {
    zh: '疆域是 Seshat 全球歷史資料庫的 Cliopatria（v0.2.1，2026 年 10 月）：西元前 3400 年到 2024 年約 1,600 個政體，依 Tollefson 2014 年的歷史地圖與歷史學者的審閱整理，邊界平滑過、跟今天的海岸線對不齊，只是「一種」對過去疆域的畫法，邊界與年份常有爭議。這裡取西元前每 100 年、西元 1800 年以前每 50 年、之後每 5 年（另加 1625、1640、1670 年），形狀簡化到約 20 公里；好幾個政體組成的帝國（例如大英帝國）畫各部分、同一個顏色。台灣逐一核對後修正：荷蘭從 1624 年起（Cliopatria 1626 年起）；西班牙在北台灣只到 1642 年（Cliopatria 到 1658 年）；1662–1683 年是明鄭的東寧王國（Cliopatria 寫南明）；澎湖補進東寧、清、日本、中華民國；1950 年起金門屬於中華民國、中華民國不再包含海南島與舟山（大陳到 1955 年，太小沒有畫）。照 Cliopatria 沒有改的：清朝從 1683 年起畫整個台灣（東部山區 1875 年後才設治）；中華民國從 1946 年起（1945 年 10 月接收）。改過的範圍滑過時有標示。殖民帝國是 COLDAT（Becker 2019）8 個歐洲殖民國的起訖年份，用各來源的平均（側欄另列最早與最晚的說法），只補了台灣（使用者決定），其他被日本、美國、俄羅斯、鄂圖曼等統治的地方沒有收。中文名稱來自 Wikidata：Cliopatria 標的 Wikidata 編號有些指錯（例如中華民國指到中華人民共和國），只用英文名稱對得上的，另外自己寫了台灣相關與常見的政體；沒有中文名稱的寫英文。',
    en: 'Polities come from Cliopatria v0.2.1 (October 2026) of the Seshat Global History Databank: some 1,600 polities from 3400 BCE to 2024 CE, compiled from Tollefson’s 2014 historical maps and reviewed by historians. Borders are smoothed and do not follow today’s coastlines; they are one interpretation of past territories, and borders and dates are often disputed. Snapshots are taken every 100 years BCE, every 50 years until 1800 and every 5 years after (plus 1625, 1640 and 1670), and shapes are simplified to about 20 km; empires made of several polities (such as the British Empire) are drawn as their parts in one colour. Taiwan was checked period by period and corrected: Dutch rule from 1624 (Cliopatria: 1626); Spanish rule in northern Taiwan only until 1642 (Cliopatria: 1658); 1662–1683 is the Kingdom of Tungning of the Zheng family (Cliopatria: Southern Ming); Penghu added to Tungning, the Qing, Japan and the Republic of China; from 1950 Kinmen belongs to the Republic of China, which no longer includes Hainan and Zhoushan (the Dachen Islands, held until 1955, are too small to draw). Left as in Cliopatria: the Qing hold all of Taiwan from 1683 (the eastern mountains were only administered after 1875), and the Republic of China starts in 1946 (it took over in October 1945). Corrected extents are marked on hover. Colonial rule is COLDAT (Becker 2019): start and end years for eight European colonial powers, averaging the sources (the side panel also lists the earliest and latest), with only Taiwan added; territories ruled by Japan, the United States, Russia, the Ottomans and others are not included. Chinese names come from Wikidata: some of Cliopatria’s Wikidata links point to the wrong item (the Republic of China to the People’s Republic, for example), so a name is used only when its English label matches, and names for Taiwan-related and other major polities were written by hand; polities without a Chinese name are shown in English.',
  },
  panelExtra: () => import('./panels/EmpiresPanel'),
  tooltipLines: (iso3, { indicator, year }) => {
    if (indicator !== 'polities' || year === undefined) return [];
    const rulers = rulersAt(iso3, year);
    if (!rulers) return [];
    const sep = tr({ zh: '、', en: ', ' });
    return rulers.length
      ? [tr({ zh: `今天的國土那時屬於：${rulers.join(sep)}`, en: `Today’s territory was then held by: ${rulers.join(sep)}` })]
      : [tr({ zh: '今天的國土那時沒有畫在任何政體裡', en: 'No polity is drawn over today’s territory then' })];
  },
  overlays: [
    {
      kind: 'lines',
      id: 'polities',
      file: 'polities.json',
      label: { zh: '政體的範圍', en: 'Polities' },
      width: 0.8,
      color: {
        classes: FILLS.map((color, value) => ({ value, color, label: { zh: '', en: '' } })),
      },
      fill: { field: 'f', value: 1, opacity: 0.45, darkOpacity: 0.55, holeField: 'k' },
      timeField: 'a',
      endField: 'b',
      groupField: 'r',
      tooltip: polityTooltip,
      keyClasses: false,
      indicators: ['polities'],
    },
    {
      kind: 'points',
      id: 'polity-names',
      file: 'labels.json',
      label: { zh: '政體的名稱', en: 'Polity names' },
      radius: 0,
      color: MAP_TOKENS.ink,
      timeField: 'a',
      endField: 'b',
      sortField: 's',
      pointLabel: labelText,
      tooltip: polityTooltip,
      indicators: ['polities'],
    },
  ],
  indicators,
};
