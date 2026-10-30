import { getLang, tr, type Text } from '../i18n/lang';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, PointRecord, TopicDefinition } from './types';

/**
 * 特殊地形（pipeline/topics/special_landforms.py）：Wikidata 的綠洲、峽灣、天然拱門與奇岩、環礁與珊瑚島、泥火山、天坑（滲穴）、
 * 間歇泉七類的點。使用者 2026-10-30 決定：七類合成一個主題、不用 OpenStreetMap，台灣的野柳女王頭、烏山頂泥火山手工補。
 */

/** 類別代碼跟 pipeline 的 KINDS 一致 */
export const KINDS: { value: number; label: Text; plural: Text }[] = [
  { value: 1, label: { zh: '綠洲', en: 'Oasis' }, plural: { zh: '綠洲', en: 'Oases' } },
  { value: 2, label: { zh: '峽灣', en: 'Fjord' }, plural: { zh: '峽灣', en: 'Fjords' } },
  { value: 3, label: { zh: '天然拱門與奇岩', en: 'Natural arch or rock pillar' }, plural: { zh: '天然拱門與奇岩', en: 'Natural arches and rock pillars' } },
  { value: 4, label: { zh: '環礁與珊瑚島', en: 'Atoll or coral island' }, plural: { zh: '環礁與珊瑚島', en: 'Atolls and coral islands' } },
  { value: 5, label: { zh: '泥火山', en: 'Mud volcano' }, plural: { zh: '泥火山', en: 'Mud volcanoes' } },
  { value: 6, label: { zh: '天坑與滲穴', en: 'Sinkhole' }, plural: { zh: '天坑與滲穴', en: 'Sinkholes' } },
  { value: 7, label: { zh: '間歇泉', en: 'Geyser' }, plural: { zh: '間歇泉', en: 'Geysers' } },
];

const KIND_COLORS: ColorClasses = {
  field: 'k',
  title: { zh: '地形', en: 'Landform' },
  thresholds: [2, 3, 4, 5, 6, 7],
  classes: KINDS.map((k, i) => ({ color: MAP_TOKENS.categorical[i], label: k.plural })),
};

export const kindLabel = (k: unknown) => tr(KINDS.find((x) => x.value === k)?.label ?? '');

function placeName(p: PointRecord): string {
  if (getLang() === 'zh' && typeof p.zh === 'string') return p.zh;
  return String(p.en ?? p.zh ?? '');
}

const n0 = (v: number) => Math.round(v).toLocaleString(getLang() === 'zh' ? 'zh-TW' : 'en-US');

export const specialLandforms: TopicDefinition = {
  id: 'special-landforms',
  title: { zh: '特殊地形', en: 'Remarkable landforms' },
  shortTitle: { zh: '特殊地形', en: 'Landforms' },
  defaultIndicator: 'map',
  defaultYear: 2026,
  timeless: true,
  sources: [
    { name: { zh: 'Wikidata（地形的類別、位置、名稱、所屬國家）', en: 'Wikidata (landform classes, locations, names, countries)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
  ],
  note: {
    zh:
      '點是 Wikidata 收錄、有座標的七類地形：綠洲、峽灣、天然拱門與奇岩（天然拱門、海蝕柱、岩柱）、環礁與珊瑚島、泥火山、天坑與滲穴（含墨西哥猶加敦的天然井）、間歇泉，包括這些類別的子類別。Wikidata 是志願者編輯的，收得多不多跟各國有沒有人整理有關，數量不能直接比：挪威的峽灣占了一半以上（縮小時只畫有英文或中文維基百科條目的）；泥火山只有二十多個（亞塞拜然、義大利最多，學術彙編沒有開放資料）；中文說的「天坑」集中在中國西南，Wikidata 沒有這個類別，重慶小寨天坑等幾乎沒收；間歇泉約八成在美國黃石公園一帶，俄羅斯堪察加的間歇泉谷、智利的 El Tatio 都沒有收。「岩石地形」這個類別太廣（3 萬多筆，多半是地名匯入），不收。台灣有小門鯨魚洞、石門洞、深澳象鼻岩，野柳女王頭、烏山頂泥火山在 Wikidata 歸為岩石地形與自然保留區，這裡手工補上。國家依座標判斷，遠洋的小島用 Wikidata 的所屬國家；南海等地 Wikidata 列了好幾個國家的，滑過寫「主權有爭議」。',
    en:
      'Dots are seven kinds of landform recorded in Wikidata with coordinates, including their subclasses: oases, fjords, natural arches and rock pillars (arches, sea stacks and hoodoos), atolls and coral islands, mud volcanoes, sinkholes (including the cenotes of Yucatán) and geysers. Wikidata is edited by volunteers, so coverage depends on who has catalogued what and counts are not comparable between countries: Norway accounts for over half of the fjords (zoomed out, only those with an English or Chinese Wikipedia article are drawn); there are only about twenty mud volcanoes (most in Azerbaijan and Italy; scholarly inventories are not openly licensed); the giant tiankeng of south-west China have no class of their own and are almost all missing; about 80% of geysers are around Yellowstone, while Kamchatka’s Valley of Geysers and Chile’s El Tatio are absent. The broad “rock formation” class (over 30,000 items, mostly imported place names) is left out. Taiwan has three arches (Xiaomen Whale Cave, Shimen Cave and the Shen’ao Elephant Trunk Rock); the Queen’s Head at Yehliu and the Wushanding mud volcano, classed in Wikidata as a rock formation and a nature reserve, are added by hand. Countries are assigned by location, with Wikidata’s country used for remote islands; where Wikidata lists several countries (as in the South China Sea), the tooltip says sovereignty is disputed.',
  },
  panelExtra: () => import('./panels/SpecialLandformsPanel'),
  overlays: [
    {
      kind: 'points',
      id: 'landforms',
      file: 'points.json',
      label: { zh: '特殊地形', en: 'Landforms' },
      radius: { field: 'sl', stops: [[0, 2.2], [5, 2.8], [20, 4], [60, 5.5]] },
      color: KIND_COLORS,
      sortField: 'sl',
      // 縮小時只畫有英文或中文維基條目的（挪威的小峽灣才不會蓋滿北歐）
      minValue: { field: 'w', stops: [[0, 1], [5, 0]] },
      tooltip: (p, ctx) => {
        const name = placeName(p);
        const parts = [kindLabel(p.k)];
        if (typeof p.iso3 === 'string') parts.push(ctx.countryName(p.iso3));
        const extra: string[] = [];
        if (p.d === 1) extra.push(tr({ zh: 'Wikidata 列了好幾個國家：主權有爭議', en: 'Wikidata lists several countries: sovereignty disputed' }));
        return {
          title: name,
          detail: parts.join(' · '),
          extra: extra.length ? extra : undefined,
          properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== name ? p.en : undefined,
        };
      },
    },
  ],
  indicators: [
    {
      id: 'map',
      label: { zh: '特殊地形地圖', en: 'Landform map' },
      description: {
        zh: '沙漠裡的綠洲、冰河切出的峽灣、海浪與風化留下的天然拱門與海蝕柱、珊瑚礁圍成的環礁、噴出泥漿的泥火山、石灰岩崩塌的天坑、噴出熱水的間歇泉，七類地形的點（Wikidata）。點越大，維基百科條目越多；縮小時只畫有英文或中文條目的。滑過看名稱，點國家列出它的特殊地形。',
        en: 'Oases in the desert, fjords carved by glaciers, arches and sea stacks left by waves and weathering, atolls ringed by coral reefs, mud volcanoes, sinkholes where limestone collapsed and geysers spouting hot water: seven kinds of landform from Wikidata. Bigger dots have more Wikipedia articles; zoomed out, only those with an English or Chinese article are drawn. Hover for the name, and select a country for its list.',
      },
      unit: '',
      file: 'map.json',
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      missing: { zh: '國家不上色，看地圖上的點', en: 'Countries are not coloured; see the dots on the map' },
    },
    {
      id: 'count',
      label: { zh: '數量', en: 'Count' },
      description: {
        zh: 'Wikidata 收錄、有座標的這一類地形有幾處（比例圓）。Wikidata 收得多不多跟各國有沒有人整理有關，只能看大概。',
        en: 'How many landforms of this kind Wikidata records with coordinates (proportional circles). Coverage depends on who has catalogued what, so treat it as a rough guide.',
      },
      unit: { zh: '處', en: 'places' },
      file: 'count/{item}.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      integer: true,
      format: (v) => tr({ zh: `${n0(v)} 處`, en: `${n0(v)} ${Math.round(v) === 1 ? 'place' : 'places'}` }),
      formatTick: n0,
      shareOfWorld: true,
      dimension: {
        label: { zh: '地形', en: 'Landform' },
        options: [{ id: 'all', label: { zh: '七類合計', en: 'All seven kinds' } }, ...KINDS.map((k) => ({ id: String(k.value), label: k.plural }))],
        defaultOption: 'all',
      },
    },
  ],
};
