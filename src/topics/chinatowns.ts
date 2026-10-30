import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, PointRecord, TopicDefinition } from './types';

/**
 * 唐人街（pipeline/topics/chinatowns.py）：Wikidata 的唐人街（CC0）加上依英文維基百科分區條目手工補的點（CC BY-SA 4.0）。
 * 點的顏色分來源；補的點有些只有城市的座標（c = 1），tooltip 寫明。形成年份很少有，不做時間軸。
 */
const SOURCE_COLORS: ColorClasses = {
  field: 's',
  title: { zh: '來源', en: 'Source' },
  thresholds: [2],
  classes: [
    { color: MAP_TOKENS.categorical[0], label: { zh: 'Wikidata', en: 'Wikidata' } },
    { color: MAP_TOKENS.categorical[1], label: { zh: '依維基百科條目補', en: 'Added from Wikipedia articles' } },
  ],
};

function name(p: PointRecord): string {
  if (getLang() === 'zh' && typeof p.zh === 'string') return p.zh;
  return String(p.en ?? p.zh ?? '');
}

export const chinatowns: TopicDefinition = {
  id: 'chinatowns',
  title: { zh: '世界各地的唐人街', en: 'Chinatowns around the world' },
  shortTitle: { zh: '唐人街', en: 'Chinatowns' },
  defaultIndicator: 'map',
  defaultYear: 2026,
  timeless: true,
  sources: [
    { name: { zh: 'Wikidata（唐人街 Q202509 的位置與名稱）', en: 'Wikidata (locations and names of Chinatowns, Q202509)' }, url: 'https://www.wikidata.org/wiki/Q202509', license: 'CC0' },
    {
      name: {
        zh: '英文維基百科「Chinatowns in Europe」「Chinatowns in Asia」「Chinatowns in Africa」「Chinatowns in Oceania」「Chinatowns in Latin America and the Caribbean」',
        en: 'Wikipedia, “Chinatowns in Europe”, “Chinatowns in Asia”, “Chinatowns in Africa”, “Chinatowns in Oceania” and “Chinatowns in Latin America and the Caribbean”',
      },
      url: 'https://en.wikipedia.org/w/index.php?oldid=1381063693',
      license: { zh: 'CC BY-SA 4.0（補的點與各國的數字同樣用 CC BY-SA 4.0 分享）', en: 'CC BY-SA 4.0 (the added points and the counts are shared under CC BY-SA 4.0 too)' },
    },
  ],
  note: {
    zh:
      'Wikidata 收錄、有座標的唐人街 87 處，加上依英文維基百科的歐洲、亞洲、非洲、大洋洲、拉丁美洲條目補的 48 處（條目寫明有唐人街、華人商店街的地方；寫「沒有正式的唐人街」、已經消失或只是計畫的不收）。補的點的座標取街區或城市在 Wikidata 的座標，只有城市座標的 tooltip 寫明。' +
      '美國、加拿大的條目列了上百處（多半是歷史上的），沒有另外補。「唐人街」的定義各地不同：有歷史街區、新的華人商圈，也有只剩牌樓的；收錄多寡反映的是資料的範圍，各國的數字不能直接比。台灣沒有唐人街（維基的亞洲條目也不含中國、港澳與台灣）。',
    en:
      'The 87 Chinatowns in Wikidata with coordinates, plus 48 added from the English Wikipedia articles on Chinatowns in Europe, Asia, Africa, Oceania and Latin America (places the articles say have a Chinatown or Chinese shopping street; places described as having no official Chinatown, gone or only planned are left out). Added points use the Wikidata coordinates of the neighbourhood or the city; the tooltip says when only the city is known. ' +
      'The articles on the United States and Canada list hundreds of places, mostly historical, and are not added. What counts as a Chinatown varies, from historic districts to new Chinese business areas or just a gate, and coverage reflects the data, so country counts are not comparable. Taiwan has no Chinatown (the Asia article also excludes China, Hong Kong, Macau and Taiwan).',
  },
  overlays: [
    {
      kind: 'points',
      id: 'chinatowns',
      file: 'points.json',
      label: { zh: '唐人街', en: 'Chinatowns' },
      radius: { field: 's', stops: [[1, 4], [2, 4]] },
      color: SOURCE_COLORS,
      tooltip: (p, ctx) => ({
        title: name(p),
        detail: [typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null, p.s === 2 ? tr({ zh: '依維基百科條目補', en: 'added from Wikipedia' }) : 'Wikidata']
          .filter(Boolean)
          .join(' · '),
        extra: p.c === 1 ? [tr({ zh: '位置是城市的座標', en: 'Location is the city centre' })] : [],
        properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== name(p) ? p.en : undefined,
      }),
    },
  ],
  indicators: [
    {
      id: 'map',
      label: { zh: '唐人街地圖', en: 'Chinatown map' },
      description: {
        zh: '世界各地的唐人街：美國、加拿大最多，東南亞、日本、英國、澳洲也有不少。滑過點看名稱；國家的數字是收錄的處數，不能直接比較各國有多少唐人街。',
        en: 'Chinatowns around the world: most are in the United States and Canada, with many in Southeast Asia, Japan, the UK and Australia. Hover over a dot for its name; country figures are the number of places recorded, not a comparable count of Chinatowns.',
      },
      unit: { zh: '處', en: 'places' },
      file: 'count.json',
      layer: { kind: 'none' },
      format: (v) => tr({ zh: `收錄 ${fixed(v, 0)} 處`, en: `${fixed(v, 0)} recorded` }),
      unranked: true,
      panelChart: false,
      missing: { zh: '沒有收錄的唐人街', en: 'No Chinatown recorded' },
    },
  ],
};
