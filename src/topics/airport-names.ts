import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, SourceDef } from './types';

/**
 * 機場以誰命名（2026-11-07，製作手冊第二十七批 573，候選 1290；pipeline/topics/airport_names.py）：擴充「機場與旅客」。
 * Wikidata（經 QLever）的機場 P138（named after）是人的：點依那個人的職業分類上色，各國座數畫比例圓，左邊列出機場。
 */

/** 職業分類（pipeline 的 CATEGORIES，代碼要一致）：一個人只歸一類，政治人物 > 軍人 > 飛行員與太空人 > 作家與詩人 > 其他 */
const CATEGORIES: { label: Text }[] = [
  { label: { zh: '政治人物', en: 'Politicians' } },
  { label: { zh: '軍人', en: 'Military' } },
  { label: { zh: '飛行員與太空人', en: 'Aviators and astronauts' } },
  { label: { zh: '作家與詩人', en: 'Writers and poets' } },
  { label: { zh: '其他', en: 'Others' } },
];

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

function airportTitle(p: PointRecord): { title: string; proper?: string } {
  const en = str(p.n) ?? '';
  const zh = str(p.nz);
  return getLang() === 'zh' && zh ? { title: zh, proper: en || undefined } : { title: en };
}

function personLine(p: PointRecord): string {
  const name = str(p.pz) ? tr({ zh: `${p.pz}（${p.p}）`, en: String(p.p ?? '') }) : String(p.p ?? '');
  const life = typeof p.b === 'number' ? `${p.b}–${typeof p.d === 'number' ? p.d : ''}` : '';
  const cat = CATEGORIES[Number(p.c) - 1];
  // 中文名前後不空格，原文名前後空一格
  const named = tr({ zh: str(p.pz) ? `以${name}命名` : `以 ${name} 命名`, en: `Named after ${name}` });
  return [named, life, cat ? tr(cat.label) : null].filter(Boolean).join(' · ');
}

const OVERLAY: PointsOverlayDef = {
  kind: 'points',
  id: 'airport-names',
  file: 'airport-names.json',
  label: { zh: '以人命名的機場（Wikidata）', en: 'Airports named after people (Wikidata)' },
  indicators: ['airport-names'],
  radius: 3.2,
  color: {
    field: 'c',
    title: { zh: '那個人是', en: 'Namesake' },
    thresholds: [1.5, 2.5, 3.5, 4.5],
    classes: CATEGORIES.map((c, i) => ({ label: c.label, color: i === 4 ? MAP_TOKENS.categoricalOther : MAP_TOKENS.categorical[i] })),
  },
  tooltip: (p, { countryName }) => {
    const { title, proper } = airportTitle(p);
    return {
      title,
      properNoun: proper,
      detail: personLine(p),
      extra: [str(p.o) ? tr({ zh: `職業：${p.o}`, en: `Occupation: ${p.o}` }) : null, typeof p.iso3 === 'string' && p.iso3 ? countryName(p.iso3) : null].filter(
        (x): x is string => Boolean(x),
      ),
    };
  },
};

const LIST: ListPanelDef = {
  label: { zh: '以人命名的機場', en: 'Airports named after people' },
  indicators: ['airport-names'],
  file: 'airport-names.json',
  countryField: 'iso3',
  rows: (points) =>
    [...points]
      .map((p) => ({ p, t: airportTitle(p) }))
      .sort((a, b) => a.t.title.localeCompare(b.t.title, getLang() === 'zh' ? 'zh-Hant' : 'en'))
      .map(({ p, t }, i): ListRow => ({
        key: `an-${i}`,
        title: t.title,
        properNoun: t.proper,
        lines: [personLine(p), str(p.o) ?? ''].filter(Boolean),
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 10 },
      })),
  empty: { zh: 'Wikidata 沒有這個國家以人命名的機場', en: 'No airports named after people in Wikidata for this country' },
};

export const airportNames: { sources: SourceDef[]; indicators: IndicatorDef[]; overlays: PointsOverlayDef[]; listPanel: ListPanelDef } = {
  sources: [
    {
      name: { zh: 'Wikidata（機場的命名由來 P138，經 QLever 查詢，2026 年 11 月）', en: 'Wikidata (what airports are named after, P138; queried via QLever, November 2026)' },
      url: 'https://www.wikidata.org/wiki/Property:P138',
      license: 'CC0',
    },
  ],
  overlays: [OVERLAY],
  listPanel: LIST,
  indicators: [
    {
      id: 'airport-names',
      label: { zh: '以人命名的機場', en: 'Airports named after people' },
      description: {
        zh: 'Wikidata 記了「以什麼命名」（P138）的機場，命名對象是人的：圓是各國座數，點依那個人的職業上色（一個人常有好幾個職業，只歸一類：政治人物 > 軍人 > 飛行員與太空人 > 作家與詩人 > 其他）。Wikidata 的機場 25,090 座，5,529 座記了命名由來，絕大多數是地名（美國的城市 1,104、大城市 943、城市 932、縣治 584），以人命名的只有 582 座、579 人：政治人物 313 人、作家與詩人 51、軍人 67、飛行員與太空人 42、其他 106。例如紐約的甘迺迪、巴黎的戴高樂、德里的英迪拉·甘地、特拉維夫附近的班·古里昂、利物浦的約翰·藍儂、華沙的蕭邦。美國 85 座、俄羅斯 53、巴西 33、義大利 26 最多，但 P138 的收錄很不平均，只能看大概。台灣的機場在 Wikidata 都以地名命名（桃園機場 1979–2006 年叫「中正國際機場」，Wikidata 沒有記成 P138）。',
        en: 'Airports whose “named after” (P138) in Wikidata is a person: circles show each country’s count and points are coloured by the person’s occupation (people often have several, so each is put in one class: politicians > military > aviators and astronauts > writers and poets > others). Of Wikidata’s 25,090 airports, 5,529 record what they are named after, mostly places (US cities 1,104, big cities 943, cities 932, county seats 584); only 582 are named after people, 579 in all: 313 politicians, 51 writers and poets, 67 military figures, 42 aviators and astronauts and 106 others. Examples include Kennedy in New York, de Gaulle in Paris, Indira Gandhi in Delhi, Ben Gurion near Tel Aviv, John Lennon in Liverpool and Chopin in Warsaw. The US has 85, Russia 53, Brazil 33 and Italy 26, but P138 coverage is very uneven, so treat this as rough. Taiwan’s airports are all named after places in Wikidata (Taoyuan was Chiang Kai-shek International Airport from 1979 to 2006, which Wikidata does not record with P138).',
      },
      unit: { zh: '座', en: 'airports' },
      file: 'airport-names-count.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 50] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 座`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      timeless: true,
    },
  ],
};
