import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { choroplethColors } from '../map/categories';
import { MAP_TOKENS } from '../theme/tokens';
import type { ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 乳糖不耐：成人能不能消化乳糖（2026-11-03，製作手冊第十九批 290；pipeline/topics/lactase.py）：
 * Itan 等 2010 的 233 個調查點（CC BY 2.0）。國家值是國內調查點依樣本數加權的平均，點與左側欄看每一筆。
 * 族群名稱照原表的英文（不翻譯）。
 */

const THRESHOLDS = [10, 25, 40, 60, 80, 90];
const pct = (v: number) => `${fixed(v, 0)}%`;
const num = (v: unknown) => (typeof v === 'number' ? v : null);

/** 檢測方法（pipeline 的 METHODS） */
const METHODS: Record<number, Text> = {
  1: { zh: '血糖法', en: 'blood glucose test' },
  2: { zh: '呼氣氫氣法', en: 'breath hydrogen test' },
  3: { zh: '尿液半乳糖法', en: 'urinary galactose test' },
  4: { zh: '小腸切片', en: 'intestinal biopsy' },
};

const COLORS = choroplethColors({ type: 'sequential', thresholds: THRESHOLDS }, MAP_TOKENS);

function facts(p: PointRecord): string {
  const f = num(p.f) ?? 0;
  const n = num(p.n) ?? 0;
  const m = METHODS[num(p.m) ?? 0];
  return tr({
    zh: `${pct(f)} 能消化乳糖（${fixed(n, 0)} 人${m ? `，${tr(m)}` : ''}）`,
    en: `${pct(f)} can digest lactose (${fixed(n, 0)} people${m ? `, ${tr(m)}` : ''})`,
  });
}

const SURVEYS: PointsOverlayDef = {
  kind: 'points',
  id: 'lactase-surveys',
  file: 'surveys.json',
  label: { zh: '調查點（Itan 等 2010 彙整的 233 筆）', en: 'Surveys (233 compiled by Itan et al. 2010)' },
  radius: { field: 'n', stops: [[10, 2.5], [100, 4], [500, 6.5], [2000, 10]] },
  color: {
    field: 'f',
    title: { zh: '能消化乳糖的比例', en: 'Can digest lactose' },
    thresholds: THRESHOLDS,
    classes: COLORS.map((color, i) => ({
      color,
      label:
        i === 0
          ? { zh: `不到 ${THRESHOLDS[0]}%`, en: `Under ${THRESHOLDS[0]}%` }
          : i === THRESHOLDS.length
            ? { zh: `${THRESHOLDS[i - 1]}% 以上`, en: `${THRESHOLDS[i - 1]}% and over` }
            : { zh: `${THRESHOLDS[i - 1]}–${THRESHOLDS[i]}%`, en: `${THRESHOLDS[i - 1]}–${THRESHOLDS[i]}%` },
    })),
  },
  sizeLegend: { title: { zh: '樣本數', en: 'Sample size' }, values: [50, 500, 2000], format: (v) => fixed(v, 0) },
  sortField: 'n',
  tooltip: (p, ctx) => ({
    title: String(p.p ?? ''),
    detail: [typeof p.c === 'string' ? ctx.countryName(p.c) : null, facts(p)].filter(Boolean).join(' · '),
    extra: typeof p.r === 'string' && p.r ? [tr({ zh: `出處：${p.r}`, en: `Source: ${p.r}` })] : [],
  }),
};

function row(p: PointRecord, countryName: (iso3: string) => string, group?: string): ListRow {
  return {
    key: `${p.c}-${p.p}-${p.lon}-${p.lat}-${p.n}`,
    title: String(p.p ?? ''),
    titleProper: true,
    lines: [
      [typeof p.c === 'string' ? countryName(p.c) : null, facts(p)].filter(Boolean).join(' · '),
      ...(typeof p.r === 'string' && p.r ? [p.r] : []),
    ],
    target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 5 },
    ...(group ? { group } : {}),
  };
}

const LIST: ListPanelDef = {
  label: { zh: '調查點', en: 'Surveys' },
  file: 'surveys.json',
  countryField: 'c',
  sorts: [
    { id: 'country', label: { zh: '依國家', en: 'By country' } },
    { id: 'high', label: { zh: '比例高到低', en: 'Highest share' } },
    { id: 'n', label: { zh: '樣本數', en: 'Sample size' } },
  ],
  rows: (records, { sort, countryName }) => {
    if (sort === 'high') return [...records].sort((a, b) => (num(b.f) ?? 0) - (num(a.f) ?? 0)).map((p) => row(p, countryName));
    if (sort === 'n') return [...records].sort((a, b) => (num(b.n) ?? 0) - (num(a.n) ?? 0)).map((p) => row(p, countryName));
    return [...records]
      .map((p) => ({ p, name: typeof p.c === 'string' ? countryName(p.c) : '' }))
      .sort((a, b) => a.name.localeCompare(b.name) || (num(b.p.n) ?? 0) - (num(a.p.n) ?? 0))
      .map(({ p, name }) => row(p, countryName, name));
  },
};

export const lactase: TopicDefinition = {
  id: 'lactase',
  title: { zh: '乳糖不耐：成人能不能消化乳糖', en: 'Lactose intolerance: can adults digest milk sugar?' },
  shortTitle: { zh: '乳糖不耐', en: 'Lactose intolerance' },
  defaultIndicator: 'persistence',
  defaultYear: 2010,
  timeless: true,
  sources: [
    {
      name: {
        zh: 'Itan 等 2010〈A worldwide correlation of lactase persistence phenotype and genotypes〉，BMC Evolutionary Biology 10:36，附件 1',
        en: 'Itan et al. 2010, “A worldwide correlation of lactase persistence phenotype and genotypes”, BMC Evolutionary Biology 10:36, additional file 1',
      },
      url: 'https://doi.org/10.1186/1471-2148-10-36',
      license: 'CC BY 2.0',
    },
  ],
  note: {
    zh: 'Itan 等 2010 彙整了 1960–2000 年代 233 個已發表的調查（51 國、共約 1.5 萬人）：每一筆是一個族群或地點的樣本、能消化乳糖的人（乳糖酶持續性）的比例與檢測方法（血糖、呼氣氫氣、尿液半乳糖或小腸切片，方法不同結果會有差）。國家值是國內各調查點依樣本數加權的平均；很多國家只有一兩筆小樣本（例如台灣只有 1972 年的 50 人），不一定代表全國，附註有寫幾個點、共幾人。族群與地點的名稱照原表的英文。能不能消化乳糖是基因決定的：小時候人人都能，斷奶後乳糖酶通常會減少，只有某些族群（北歐、東非的牧民等）帶有讓乳糖酶一直維持的基因。',
    en: 'Itan et al. 2010 compiled 233 published surveys from the 1960s to the 2000s (51 countries, about 15,000 people in all): each is a sample of one population or place, with the share of people who can digest lactose (lactase persistence) and the test used (blood glucose, breath hydrogen, urinary galactose or intestinal biopsy; results differ by method). National values are the sample-weighted average of the surveys in each country; many countries have only one or two small samples (Taiwan has just 50 people from 1972) that may not represent the whole country, and the note says how many surveys and people. Population and place names are given in the original English. Whether adults can digest lactose is genetic: all babies can, but lactase usually declines after weaning, except in populations (northern Europeans, East African herders and others) carrying genes that keep it going.',
  },
  overlays: [SURVEYS],
  listPanel: LIST,
  indicators: [
    {
      id: 'persistence',
      label: { zh: '成人能消化乳糖的比例', en: 'Adults who can digest lactose' },
      description: {
        zh: '成人喝牛奶不會乳糖不耐（能消化乳糖）的比例。愛爾蘭 96%、丹麥 96%、英國 96%、德國 86%、芬蘭 84%、肯亞 66%、西班牙 66%、沙烏地 53%、印度 40%、義大利 40%、土耳其 31%、日本 28%、奈及利亞 22%、中國 14%、台灣 12%、泰國 2%。北歐與東非、阿拉伯的牧民族群高，東亞、東南亞與西非低。點是各個調查，大小是樣本數。',
        en: 'Share of adults who can drink milk without lactose intolerance (lactase persistence). Ireland 96%, Denmark 96%, the UK 96%, Germany 86%, Finland 84%, Kenya 66%, Spain 66%, Saudi Arabia 53%, India 40%, Italy 40%, Turkey 31%, Japan 28%, Nigeria 22%, China 14%, Taiwan 12%, Thailand 2%. High among northern Europeans and East African and Arabian herding peoples, low in East and Southeast Asia and West Africa. Dots are individual surveys, sized by sample.',
      },
      unit: '%',
      file: 'persistence.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: THRESHOLDS } },
      format: pct,
      formatTick: (v) => `${v}%`,
    },
  ],
};
