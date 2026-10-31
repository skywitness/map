import { getLang, tr, type Text } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, SourceDef } from './types';

/**
 * 世界遺產的擴充（2026-10-31，製作手冊第十批 181；pipeline/topics/heritage_extra.py，DESIGN.md 第 8 節第 263 點）：
 * 預備名單（Wikidata，台灣的 18 處潛力點另一色）、世界地質公園（英文維基與 Wikidata，台灣國內的地質公園另一色）、
 * 拉姆薩國際重要濕地（RSIS）。
 */

const TYPES: Record<number, Text> = { 1: { zh: '文化', en: 'cultural' }, 2: { zh: '自然', en: 'natural' }, 3: { zh: '複合', en: 'mixed' } };

const sitesText = (v: number) => tr({ zh: `${fixed(v, 0)} 處`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'site' : 'sites'}` });
const itemsText = (v: number) => tr({ zh: `${fixed(v, 0)} 件`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'entry' : 'entries'}` });
const haText = (v: number) => tr({ zh: `${formatLargeNumber(v)} 公頃`, en: `${formatLargeNumber(v)} ha` });

/** 名稱：中文介面有中文名就用，英文介面用英文名（台灣的潛力點、地質公園只有中文名） */
function nameOf(p: PointRecord): { title: string; proper?: string } {
  const zh = typeof p.zh === 'string' && p.zh ? p.zh : null;
  const en = typeof p.name === 'string' && p.name ? p.name : null;
  if (getLang() === 'zh') return { title: zh ?? en ?? '', proper: zh && en ? en : undefined };
  return { title: en ?? zh ?? '', proper: en ? undefined : zh ?? undefined };
}

function countries(p: PointRecord, countryName: (iso3: string) => string): string | null {
  const list = [p.iso3, ...(typeof p.more === 'string' ? p.more.split(',') : [])].filter((s): s is string => typeof s === 'string' && s !== '');
  return list.length ? list.map(countryName).join(tr({ zh: '、', en: ', ' })) : null;
}

const TENTATIVE: PointsOverlayDef = {
  kind: 'points',
  id: 'tentative',
  file: 'tentative-points.json',
  label: { zh: '預備名單與台灣的潛力點', en: 'Tentative List and Taiwan’s potential sites' },
  indicators: ['tentative'],
  radius: 2.6,
  color: {
    field: 'cls',
    title: { zh: '名單', en: 'List' },
    thresholds: [1.5],
    classes: [
      { color: MAP_TOKENS.categorical[2], label: { zh: '世界遺產預備名單（還沒登錄）', en: 'Tentative List (not yet inscribed)' } },
      { color: MAP_TOKENS.categorical[7], label: { zh: '臺灣世界遺產潛力點（文化部）', en: 'Taiwan’s potential World Heritage sites (Ministry of Culture)' } },
    ],
  },
  sortField: 'cls',
  tooltip: (p, { countryName }) => {
    const { title, proper } = nameOf(p);
    if (p.cls === 2) {
      return {
        title,
        detail: tr({ zh: `臺灣世界遺產潛力點 · ${tr(TYPES[Number(p.t)] ?? '')} · ${p.y} 年入選`, en: `Taiwan potential World Heritage site · ${tr(TYPES[Number(p.t)] ?? '')} · selected ${p.y}` }),
        properNoun: proper,
      };
    }
    return {
      title,
      detail: [tr({ zh: '世界遺產預備名單', en: 'Tentative List' }), countries(p, countryName)].filter(Boolean).join(' · '),
      properNoun: proper,
    };
  },
};

const GEOPARKS: PointsOverlayDef = {
  kind: 'points',
  id: 'geoparks',
  file: 'geopark-points.json',
  label: { zh: 'UNESCO 世界地質公園', en: 'UNESCO Global Geoparks' },
  indicators: ['geoparks'],
  radius: 3,
  color: MAP_TOKENS.categorical[5],
  timeField: 'y',
  tooltip: (p, { countryName }) => {
    const { title, proper } = nameOf(p);
    return {
      title,
      detail: [tr({ zh: `世界地質公園 · ${p.y} 年加入`, en: `UNESCO Global Geopark · joined ${p.y}` }), countries(p, countryName)].filter(Boolean).join(' · '),
      properNoun: proper,
    };
  },
};

const TW_GEOPARKS: PointsOverlayDef = {
  kind: 'points',
  id: 'tw-geoparks',
  file: 'tw-geoparks.json',
  label: { zh: '台灣國內的地質公園（Wikidata）', en: 'Taiwan’s own geoparks (Wikidata)' },
  indicators: ['geoparks'],
  radius: 3,
  color: MAP_TOKENS.categorical[7],
  tooltip: (p) => {
    const { title, proper } = nameOf(p);
    return { title, detail: tr({ zh: '台灣國內的地質公園（不是 UNESCO 世界地質公園）', en: 'A geopark in Taiwan (not a UNESCO Global Geopark)' }), properNoun: proper };
  },
};

const RAMSAR: PointsOverlayDef = {
  kind: 'points',
  id: 'ramsar',
  file: 'ramsar-points.json',
  label: { zh: '拉姆薩國際重要濕地', en: 'Ramsar sites' },
  indicators: ['ramsar', 'ramsar-area'],
  radius: { field: 'ha', stops: [[100, 1.8], [10000, 2.6], [1000000, 4.5]] },
  color: MAP_TOKENS.categorical[0],
  sortField: 'ha',
  tooltip: (p, { countryName }) => ({
    title: String(p.name ?? ''),
    detail: [tr({ zh: `拉姆薩濕地 #${p.id}`, en: `Ramsar site #${p.id}` }), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
    extra: typeof p.ha === 'number' ? [haText(p.ha)] : undefined,
  }),
};

/**
 * 左邊的清單（第十二批 204）：台灣的世界遺產潛力點、世界地質公園（依國家分組）、拉姆薩濕地（依國家分組，組內依面積），
 * 各自在自己的指標；點了移到那一點。瀕危的世界遺產在 world-heritage.ts
 */
const firstCountry = (p: PointRecord, countryName: (iso3: string) => string) => (typeof p.iso3 === 'string' ? countryName(p.iso3) : '');
const byCountry = (countryName: (iso3: string) => string) => {
  const collator = new Intl.Collator(getLang() === 'zh' ? 'zh-Hant-TW' : 'en');
  return (a: PointRecord, b: PointRecord) => collator.compare(firstCountry(a, countryName), firstCountry(b, countryName));
};

const POTENTIAL_LIST: ListPanelDef = {
  label: { zh: '臺灣世界遺產潛力點', en: 'Taiwan’s potential World Heritage sites' },
  indicators: ['tentative'],
  file: 'tentative-points.json',
  rows: (points) =>
    points
      .filter((p) => p.cls === 2)
      .sort((a, b) => Number(a.y) - Number(b.y))
      .map((p, i): ListRow => {
        const { title, proper } = nameOf(p);
        return {
          key: `${p.zh ?? p.name}-${i}`,
          title,
          properNoun: proper,
          lines: [tr({ zh: `${tr(TYPES[Number(p.t)] ?? '')} · ${p.y} 年入選`, en: `${tr(TYPES[Number(p.t)] ?? '')} · selected ${p.y}` })],
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 10 },
        };
      }),
};

const GEOPARK_LIST: ListPanelDef = {
  label: { zh: 'UNESCO 世界地質公園', en: 'UNESCO Global Geoparks' },
  indicators: ['geoparks'],
  file: 'geopark-points.json',
  countryField: 'iso3',
  rows: (points, { countryName, year }) =>
    [...points]
      .sort((a, b) => byCountry(countryName)(a, b) || Number(a.y) - Number(b.y))
      .map((p, i): ListRow => {
        const { title, proper } = nameOf(p);
        return {
          key: `${p.name}-${i}`,
          title,
          properNoun: proper,
          lines: [[tr({ zh: `${p.y} 年加入`, en: `joined ${p.y}` }), countries(p, countryName)].filter(Boolean).join(' · ')],
          group: firstCountry(p, countryName),
          muted: Number(p.y) > year,
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 9 },
        };
      }),
};

const RAMSAR_LIST: ListPanelDef = {
  label: { zh: '拉姆薩國際重要濕地', en: 'Ramsar sites' },
  indicators: ['ramsar', 'ramsar-area'],
  file: 'ramsar-points.json',
  countryField: 'iso3',
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => byCountry(countryName)(a, b) || Number(b.ha ?? 0) - Number(a.ha ?? 0))
      .map(
        (p): ListRow => ({
          key: String(p.id),
          title: String(p.name ?? ''),
          titleProper: true,
          lines: [[tr({ zh: `#${p.id}`, en: `#${p.id}` }), typeof p.ha === 'number' ? haText(p.ha) : null].filter(Boolean).join(' · ')],
          group: firstCountry(p, countryName),
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 9 },
        }),
      ),
};

export const heritageExtra: { sources: SourceDef[]; overlays: PointsOverlayDef[]; indicators: IndicatorDef[]; listPanel: ListPanelDef[] } = {
  sources: [
    {
      name: { zh: 'Wikidata（世界遺產預備名單 P4171、世界地質公園、台灣的地質公園）', en: 'Wikidata (Tentative List P4171, UNESCO Global Geoparks, geoparks in Taiwan)' },
      url: 'https://www.wikidata.org/wiki/Property:P4171',
      license: 'CC0',
    },
    {
      name: { zh: '中文維基百科「臺灣世界遺產潛力點」（revid 90795963）', en: 'Chinese Wikipedia, “臺灣世界遺產潛力點” (revision 90795963)' }, // i18n-ignore（條目的原文標題）
      url: 'https://zh.wikipedia.org/w/index.php?oldid=90795963',
      license: 'CC BY-SA 4.0',
    },
    {
      name: {
        zh: '英文維基百科「UNESCO Global Geoparks」與各洲的地質公園列表（revid 1380702708 等）',
        en: 'English Wikipedia, “UNESCO Global Geoparks” and the continental lists (revision 1380702708 and others)',
      },
      url: 'https://en.wikipedia.org/w/index.php?title=UNESCO_Global_Geoparks&oldid=1380702708',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: 'Ramsar Sites Information Service（拉姆薩濕地的中心點）', en: 'Ramsar Sites Information Service (site centroids)' },
      url: 'https://rsis.ramsar.org/',
      license: 'CC BY 4.0',
    },
  ],
  overlays: [TENTATIVE, GEOPARKS, TW_GEOPARKS, RAMSAR],
  listPanel: [POTENTIAL_LIST, GEOPARK_LIST, RAMSAR_LIST],
  indicators: [
    {
      id: 'tentative',
      label: { zh: '預備名單', en: 'Tentative List' },
      description: {
        zh: '各國提交 UNESCO、準備提名的「世界遺產預備名單」裡還沒登錄的件數（Wikidata 有預備名單編號、還沒有世界遺產編號的 1,765 項，182 國）：土耳其 86、中國 55、印度 53、伊朗 50、義大利 45、法國 37。Wikidata 沒有記移出預備名單的時間，所以也含已經撤回的；UNESCO 的總數在世界遺產中心的網站上，沒辦法核對涵蓋率。點是有座標的 1,370 項。台灣不能提名，洋紅色的點是文化部 2003 年起遴選的 18 處「臺灣世界遺產潛力點」（太魯閣、棲蘭山檜木林、阿里山森林鐵路、金門戰地文化…）。',
        en: 'Entries on the Tentative Lists that countries submit to UNESCO ahead of nominations, counting only those not yet inscribed (1,765 Wikidata items with a Tentative List ID but no World Heritage ID, in 182 countries): Turkey 86, China 55, India 53, Iran 50, Italy 45 and France 37. Wikidata does not record when entries leave a list, so some withdrawn ones are included, and UNESCO’s own totals (on the World Heritage Centre’s website) could not be checked. Dots show the 1,370 items with coordinates. Taiwan cannot nominate sites; the magenta dots are the 18 “potential World Heritage sites” selected by its Ministry of Culture since 2003 (Taroko, the Chilan Mountain cypress forest, the Alishan Forest Railway, Kinmen’s battlefield culture and others).',
      },
      unit: { zh: '件', en: 'entries' },
      file: 'tentative.json',
      layer: { kind: 'bubble', legendValues: [5, 20, 50] },
      timeless: true,
      format: itemsText,
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'geoparks',
      label: { zh: '世界地質公園', en: 'UNESCO Global Geoparks' },
      description: {
        zh: 'UNESCO 世界地質公園：有國際價值的地質景觀，結合保育、教育與在地發展。各國的處數照英文維基依國家的總表（192 處、49 國，跨國的每國都算；依加入年份累計），中國 36 處最多，其次西班牙 16、義大利 12、印尼 12、英國 10。UNESCO 公布 51 國 241 處（2026 年 7 月），UNESCO 與 Global Geoparks Network 的名單都不能轉載，維基的總表約涵蓋八成；點是英文維基各洲的表與 Wikidata 有座標、有加入年份的 172 處。台灣不是 UNESCO 會員，洋紅色的點是國內的地質公園（野柳、草嶺、富岡、月世界、桶盤；高雄泥岩惡地、龍崎牛埔惡地 Wikidata 沒有座標）。',
        en: 'UNESCO Global Geoparks: landscapes of international geological significance managed for conservation, education and local development. Country counts follow English Wikipedia’s list by country (192 geoparks in 49 countries, transboundary ones counted for each; cumulative by year joined): China leads with 36, followed by Spain 16, Italy 12, Indonesia 12 and the UK 10. UNESCO lists 241 in 51 countries (July 2026), but neither UNESCO’s nor the Global Geoparks Network’s list may be republished; Wikipedia’s list covers about four-fifths. Dots show the 172 geoparks with coordinates and a year joined in Wikipedia’s continental lists and Wikidata. Taiwan is not a UNESCO member; magenta dots mark its own geoparks (Yehliu, Caoling, Fugang, Moon World and Tongpan; Wikidata has no coordinates for the Kaohsiung mudstone badlands or Longqi Niupu badlands).',
      },
      unit: { zh: '處', en: 'sites' },
      file: 'geoparks.json',
      layer: { kind: 'bubble', legendValues: [1, 5, 20] },
      overlayTime: 'cumulative',
      format: sitesText,
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'ramsar',
      label: { zh: '拉姆薩濕地', en: 'Ramsar sites' },
      description: {
        zh: '《拉姆薩公約》的國際重要濕地處數：2,536 處、172 國，合計 2.53 億公頃（Ramsar Sites Information Service）。英國 176 處最多，其次墨西哥 144、印度 103、中國 82、西班牙 76。點的大小是面積。只有目前的名單。台灣不是締約方，沒有；國家公園署另外公告國家重要濕地。',
        en: 'Wetlands of International Importance under the Ramsar Convention: 2,536 sites in 172 countries, covering 253 million hectares (Ramsar Sites Information Service). The UK has the most with 176, followed by Mexico 144, India 103, China 82 and Spain 76. Dot size shows area. Current list only. Taiwan is not a party and has none; it designates its own wetlands of national importance.',
      },
      unit: { zh: '處', en: 'sites' },
      file: 'ramsar.json',
      layer: { kind: 'bubble', legendValues: [5, 50, 150] },
      timeless: true,
      format: sitesText,
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'ramsar-area',
      label: { zh: '拉姆薩濕地的面積', en: 'Ramsar site area' },
      description: {
        zh: '拉姆薩濕地的官方面積合計（公頃，含海域，所以可能比國土大）：巴西 2,679 萬公頃最大，其次玻利維亞 1,484 萬、剛果 1,381 萬、加拿大 1,309 萬、查德 1,241 萬。',
        en: 'Total official area of Ramsar sites, in hectares (including marine areas, so it can exceed land area): Brazil is largest at 26.8 million ha, followed by Bolivia 14.8 million, Congo 13.8 million, Canada 13.1 million and Chad 12.4 million.',
      },
      unit: { zh: '公頃', en: 'ha' },
      file: 'ramsar-area.json',
      layer: { kind: 'bubble', legendValues: [1e5, 1e6, 1e7] },
      timeless: true,
      format: haText,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
  ],
};
