import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { TopicPart } from './parts';
import type { ListPanelDef, ListRow, PointRecord, PointsOverlayDef } from './types';

/**
 * 造船廠地圖（含已關閉的）（2026-11-07，製作手冊第二十七批 582，候選 1300；pipeline/topics/shipyards.py）：
 * 擴充「航運與港口」。Wikidata 的造船廠是造船業的「歷史地圖」，偏歐洲，不能當產業規模，所以國家不上色、只畫點與清單。
 */
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

function yardName(p: PointRecord): { title: string; proper?: string } {
  const en = str(p.n) ?? '';
  const zh = str(p.nz);
  return getLang() === 'zh' && zh ? { title: zh, proper: en || undefined } : { title: en };
}

function years(p: PointRecord): string {
  const a = typeof p.a === 'number' ? p.a : null;
  const b = typeof p.b === 'number' ? p.b : null;
  if (a && b) return tr({ zh: `${a}–${b} 年`, en: `${a}–${b}` });
  if (b) return tr({ zh: `${b} 年關閉`, en: `closed ${b}` });
  if (a) return tr({ zh: `${a} 年創立`, en: `founded ${a}` });
  return '';
}

const OVERLAY: PointsOverlayDef = {
  kind: 'points',
  id: 'shipyards',
  file: 'shipyards.json',
  label: { zh: '造船廠（Wikidata）', en: 'Shipyards (Wikidata)' },
  indicators: ['shipyards'],
  radius: 3.4,
  color: {
    field: 'closed',
    title: { zh: '造船廠', en: 'Shipyard' },
    thresholds: [0.5],
    classes: [
      { label: { zh: '沒有關閉年份', en: 'No closing year' }, color: MAP_TOKENS.categorical[0] },
      { label: { zh: '已關閉', en: 'Closed' }, color: MAP_TOKENS.categorical[1] },
    ],
  },
  tooltip: (p, { countryName }) => {
    const { title, proper } = yardName(p);
    return {
      title,
      properNoun: proper,
      detail: [years(p), str(p.city), typeof p.iso3 === 'string' && p.iso3 ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
    };
  },
};

const LIST: ListPanelDef = {
  label: { zh: '造船廠（依創立年份）', en: 'Shipyards (by year founded)' },
  indicators: ['shipyards'],
  file: 'shipyards.json',
  countryField: 'iso3',
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => (Number(a.a) || 9999) - (Number(b.a) || 9999))
      .map((p, i): ListRow => {
        const { title, proper } = yardName(p);
        return {
          key: `yard-${i}`,
          title,
          properNoun: proper,
          lines: [[years(p), str(p.city), typeof p.iso3 === 'string' && p.iso3 ? countryName(p.iso3) : null].filter(Boolean).join(' · ')],
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 12 },
        };
      }),
  empty: { zh: 'Wikidata 沒有這個國家有座標的造船廠', en: 'No shipyards with coordinates in Wikidata for this country' },
};

export const shipyardsPart: TopicPart = {
  name: { zh: '造船廠', en: 'Shipyards' },
  sources: [
    {
      name: { zh: 'Wikidata（造船廠 Q190928 與子類別的國家、座標、創立與關閉年份，經 QLever 查詢）', en: 'Wikidata (shipyards, Q190928 and subclasses: country, coordinates, founding and closing years; via QLever)' },
      url: 'https://www.wikidata.org/wiki/Q190928',
      license: 'CC0',
    },
  ],
  overlays: [OVERLAY],
  listPanel: [LIST],
  indicators: [
    {
      id: 'shipyards',
      label: { zh: '造船廠地圖（含已關閉的）', en: 'Shipyards, including closed ones' },
      description: {
        zh: 'Wikidata 記了國家的造船廠（含子類別），點依有沒有記關閉年份上色，左邊的清單依創立年份排。全部 1,623 家，有座標、畫得出來的只有 826 家；347 家記了關閉年份。德國 179、荷蘭 168、挪威 133、瑞典 117、美國 116、英國 102、印尼 71、日本 64、法國與西班牙各 60、中國 59、義大利 49。南韓只有 14 家（現代重工、三星重工、韓華海洋都在，但只有 2 家有座標），台灣 5 家（台灣國際造船、中信造船集團、三陽、靖海、新昇發，都沒有座標，地圖上看不到）。這是造船業的歷史地圖，不是現在的產業規模：歐洲的小船廠與已關閉的船廠收得很多（瑞典 117 家有 52 家、英國 102 家有 47 家記了關閉年份），東亞的大船廠反而條目少，所以國家不上色；造船量請看「造船量」指標。',
        en: 'Shipyards with a country in Wikidata (including subclasses); points are coloured by whether a closing year is recorded, and the list on the left is ordered by founding year. There are 1,623 in all, but only 826 have coordinates and can be drawn; 347 have a closing year. Germany has 179, the Netherlands 168, Norway 133, Sweden 117, the US 116, the UK 102, Indonesia 71, Japan 64, France and Spain 60 each, China 59 and Italy 49. South Korea has only 14 (HD Hyundai Heavy Industries, Samsung Heavy Industries and Hanwha Ocean are there, but only 2 have coordinates), and Taiwan 5 (CSBC, Jong Shyn, San Yang, Ting Hai and Shing Sheng Fa, none with coordinates, so none on the map). This is a historical map of shipbuilding, not today’s industry: small and closed European yards are well covered (52 of Sweden’s 117 and 47 of the UK’s 102 have a closing year), while East Asia’s big yards have few entries, so countries are not shaded; see “Shipbuilding” for output.',
      },
      unit: { zh: '家', en: 'shipyards' },
      file: 'shipyards-count.json',
      layer: { kind: 'none' },
      format: (v) => tr({ zh: `Wikidata 有 ${fixed(v, 0)} 家造船廠`, en: `${fixed(v, 0)} shipyards in Wikidata` }),
      timeless: true,
      unranked: true,
      rankingBars: false,
      panelChart: false,
    },
  ],
};
