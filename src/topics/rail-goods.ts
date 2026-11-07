import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { CategoryDef, FlowLabels, FlowDirection, IndicatorDef, SourceDef } from './types';

/**
 * 鐵路運的是什麼（貨類與危險品）、國際鐵路貨運的流向（2026-11-07，製作手冊第二十七批 568，候選 1282、1283；
 * pipeline/topics/rail_goods.py）：擴充「鐵路」。Eurostat 的 NST 2007 貨類、危險品、貨櫃與國際鐵路貨運（裝車國 → 卸車國）。
 */
export const RAIL_GOODS_IDS = ['rail-goods-main', 'rail-dangerous-share', 'rail-container-share'];

/** NST 2007 的 20 個貨類（側欄用）；代碼跟 Eurostat 的 nst07 一樣 */
export const NST07: Record<string, Text> = {
  GT01: { zh: '農林漁產品（含木材）', en: 'Agriculture, forestry and fishing products' },
  GT02: { zh: '煤、原油與天然氣', en: 'Coal, crude oil and natural gas' },
  GT03: { zh: '金屬礦與砂石', en: 'Metal ores, stone, sand and gravel' },
  GT04: { zh: '食品、飲料與菸草', en: 'Food, beverages and tobacco' },
  GT05: { zh: '紡織品與皮革', en: 'Textiles and leather' },
  GT06: { zh: '木製品、紙漿與紙', en: 'Wood products, pulp and paper' },
  GT07: { zh: '焦炭與煉製油品', en: 'Coke and refined petroleum products' },
  GT08: { zh: '化學品、塑膠與核燃料', en: 'Chemicals, plastics and nuclear fuel' },
  GT09: { zh: '水泥、玻璃等非金屬礦產品', en: 'Cement, glass and other non-metallic mineral products' },
  GT10: { zh: '基本金屬與金屬製品', en: 'Basic metals and metal products' },
  GT11: { zh: '機械', en: 'Machinery' },
  GT12: { zh: '運輸設備（汽車等）', en: 'Transport equipment (cars etc.)' },
  GT13: { zh: '家具與其他製品', en: 'Furniture and other manufactured goods' },
  GT14: { zh: '廢棄物與二次原料', en: 'Waste and secondary raw materials' },
  GT15: { zh: '郵件與包裹', en: 'Mail and parcels' },
  GT16: { zh: '空貨櫃等運輸器材', en: 'Empty containers and other transport equipment' },
  GT17: { zh: '搬家行李與送修車輛', en: 'Household removals, baggage and vehicles for repair' },
  GT18: { zh: '混裝貨物', en: 'Grouped goods' },
  GT19: { zh: '不明貨類（多半在貨櫃裡）', en: 'Unidentifiable goods (mostly in containers)' },
  GT20: { zh: '其他', en: 'Other goods' },
};

/** 類別圖（pipeline/topics/rail_goods.py 的 CLASSES，代碼要一致）；其他貨類是 8，歸到「其他貨類」 */
const MAIN: CategoryDef[] = [
  { value: 1, label: NST07.GT03 },
  { value: 2, label: NST07.GT10 },
  { value: 3, label: NST07.GT02 },
  { value: 4, label: NST07.GT07 },
  { value: 5, label: NST07.GT01 },
  { value: 6, label: { zh: '化學品', en: 'Chemicals' } },
  { value: 7, label: { zh: '食品與飲料', en: 'Food and beverages' } },
];
const OTHER: Text = { zh: '其他貨類', en: 'Other goods' };

const kt = (v: number) => tr({ zh: `${fixed(v, 0)} 千公噸`, en: `${fixed(v, 0)} thousand tonnes` });

const FLOW_LABELS: Record<FlowDirection, FlowLabels> = {
  export: {
    partners: { zh: '鐵路貨運運往哪些國家', en: 'where its rail freight goes' },
    main: { zh: '鐵路貨運主要運往', en: 'Main destinations of rail freight' },
    verb: (origin, partner) => tr({ zh: `${origin}用鐵路運到${partner}`, en: `${origin} to ${partner} by rail` }),
  },
  import: {
    partners: { zh: '鐵路貨運從哪些國家來', en: 'where its rail freight comes from' },
    main: { zh: '鐵路貨運主要來自', en: 'Main origins of rail freight' },
    verb: (origin, partner) => tr({ zh: `${partner}用鐵路運到${origin}`, en: `${partner} to ${origin} by rail` }),
  },
};

const EUROPE_ONLY: Text = {
  zh: '只有向 Eurostat 申報的歐洲各國；台灣沒有（臺鐵的貨運不是開放資料集）。',
  en: 'Only the European countries that report to Eurostat; Taiwan is not covered (Taiwan Railway freight is not published as open data).',
};
const join = (...parts: Text[]): Text => ({
  zh: parts.map((p) => tr(p, 'zh')).join(''),
  en: parts.map((p) => tr(p, 'en')).join(' '),
});

export const railGoods: { sources: SourceDef[]; indicators: IndicatorDef[] } = {
  sources: [
    {
      name: {
        zh: 'Eurostat：鐵路貨運依貨類（rail_go_grpgood）、危險品（rail_go_dnggood）、貨櫃（rail_go_contwgt）、國際鐵路貨運依卸車國（rail_go_intgong）',
        en: 'Eurostat: rail freight by type of goods (rail_go_grpgood), dangerous goods (rail_go_dnggood), intermodal units (rail_go_contwgt) and international rail freight by country of unloading (rail_go_intgong)',
      },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/rail_go_grpgood/default/table',
      license: 'CC BY 4.0',
    },
  ],
  indicators: [
    {
      id: 'rail-goods-main',
      label: { zh: '鐵路運得最多的貨類', en: 'Main type of goods carried by rail' },
      description: join(
        {
          zh: '鐵路貨運量（公噸）最大的貨類（NST 2007 的分類，Eurostat，2008 年起）。混裝與不明貨類（多半是貨櫃裡的貨）在義大利、瑞士占一半以上，不能說是「主要貨類」，比的時候扣掉，滑過看它們占幾成；空貨櫃、行李與「其他」也不算。2024 年：波蘭的鐵路是運煤與礦石的鐵路，煤、原油與天然氣 63,168 千公噸、金屬礦與砂石 59,658 千公噸；德國總量 337,515 千公噸，基本金屬 50,381、煉製油品 41,820、化學品 24,559、運輸設備 11,665、廢棄物 9,786；瑞典、挪威、奧地利、斯洛伐克、土耳其是金屬礦與砂石，芬蘭是農林產品（含木材，11,511 千公噸），瑞士、羅馬尼亞、立陶宛是煉製油品。點國家看 20 個貨類。',
          en: 'The type of goods with the most rail tonnage (NST 2007 groups, Eurostat, from 2008). Grouped and unidentifiable goods (mostly in containers) are over half of the total in Italy and Switzerland and cannot be called a “main” type, so they are left out of the comparison (hover for their share), as are empty containers, baggage and “other goods”. In 2024 Poland’s railways mainly hauled coal and ore: coal, crude oil and natural gas 63,168 thousand tonnes and metal ores, stone, sand and gravel 59,658; Germany carried 337,515 thousand tonnes in all, including basic metals 50,381, refined petroleum products 41,820, chemicals 24,559, transport equipment 11,665 and waste 9,786; Sweden, Norway, Austria, Slovakia and Türkiye mainly carry metal ores, stone, sand and gravel, Finland agriculture and forestry products including timber (11,511), and Switzerland, Romania and Lithuania refined petroleum products. Click a country for all 20 groups.',
        },
        EUROPE_ONLY,
      ),
      unit: '',
      file: 'rail-goods-main.json',
      layer: { kind: 'categorical', categories: MAIN, other: OTHER },
      format: (v) => tr(MAIN.find((c) => c.value === v)?.label ?? OTHER),
      defaultYear: 2024,
      unranked: true,
      panelChart: false,
    },
    {
      id: 'rail-dangerous-share',
      label: { zh: '鐵路貨運裡危險品的比例', en: 'Share of dangerous goods in rail freight' },
      description: join(
        {
          zh: '鐵路運的危險品（易燃液體、氣體、腐蝕性物質等，依聯合國的危險品分類）占鐵路貨運量的比例（Eurostat，公噸）。2024 年波羅的海國家最高：愛沙尼亞 40.7%、立陶宛 33.7%、拉脫維亞 27.6%；保加利亞 29.0%、德國 21.4%、瑞士 18.0%、法國 15.9%、波蘭 14.6%；瑞典 4.7%、挪威 2.1%（礦石為主）。愛爾蘭 43.4% 但總量很小。',
          en: 'Dangerous goods (flammable liquids, gases, corrosives and so on, by the UN classes) as a share of rail freight tonnage (Eurostat). In 2024 the Baltic states are highest: Estonia 40.7%, Lithuania 33.7% and Latvia 27.6%; Bulgaria 29.0%, Germany 21.4%, Switzerland 18.0%, France 15.9% and Poland 14.6%; Sweden 4.7% and Norway 2.1% (mainly ore). Ireland is 43.4%, but on a very small total.',
        },
        EUROPE_ONLY,
      ),
      unit: '%',
      file: 'rail-dangerous-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 15, 20, 30] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      defaultYear: 2024,
    },
    {
      id: 'rail-container-share',
      label: { zh: '鐵路貨運裝在貨櫃裡的比例', en: 'Share of rail freight in containers' },
      description: join(
        {
          zh: '裝在貨櫃與交換箱裡運的貨占鐵路貨運量的比例（Eurostat，公噸）。2024 年西班牙 57.9%、希臘 56.3%、葡萄牙與義大利 44.3%、瑞士 42.2%、土耳其 39.8%、荷蘭 38.2%；德國 20.2%、波蘭 11.9%；芬蘭 0.3%、立陶宛 3.7%（運的多是木材、油品）。愛爾蘭 79.2% 但總量很小。',
          en: 'Goods carried in containers and swap bodies as a share of rail freight tonnage (Eurostat). In 2024 Spain 57.9%, Greece 56.3%, Portugal and Italy 44.3%, Switzerland 42.2%, Türkiye 39.8% and the Netherlands 38.2%; Germany 20.2% and Poland 11.9%; Finland 0.3% and Lithuania 3.7% (mostly timber and oil). Ireland is 79.2%, but on a very small total.',
        },
        EUROPE_ONLY,
      ),
      unit: '%',
      file: 'rail-container-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 30, 45] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      defaultYear: 2024,
    },
    {
      id: 'rail-intl',
      label: { zh: '國際鐵路貨運的流向', en: 'International rail freight flows' },
      description: join(
        {
          zh: '各國用鐵路運出國外的貨（千公噸，Eurostat，2003 年起；裝車國申報、依卸車國）；點選國家畫出運往哪些國家，沒有申報的國家（中國、俄羅斯等）畫出歐洲各國運過去的。2024 年德國運出 46,544 千公噸：義大利 13,632、奧地利 8,148、瑞士 5,191、波蘭 4,917、捷克 3,748、比利時 1,773。歐亞陸橋的中歐班列從申報來看起伏很大：波蘭運到中國 2020 年 406 千公噸、2021 年 320、2022 年 91、2023 年 222、2024 年 64；荷蘭 2020 年 129 → 2024 年 7；芬蘭 2021 年 121，俄烏戰爭後的 2023 年起是 0。歐洲各國申報運到俄羅斯的從 2021 年 3,283 千公噸降到 2024 年 1,317。申報國只有歐洲 32 國，零星申報到其他洲、島國（鐵路開不到）的不畫。',
          en: 'Goods each country sent abroad by rail (thousand tonnes, Eurostat, from 2003; reported by the loading country, by country of unloading). Select a country to draw where its rail freight goes; for countries that do not report (China, Russia and others) the map shows what European countries sent there. In 2024 Germany sent 46,544 thousand tonnes: Italy 13,632, Austria 8,148, Switzerland 5,191, Poland 4,917, Czechia 3,748 and Belgium 1,773. Reported China–Europe rail freight swings widely: Poland to China was 406 thousand tonnes in 2020, 320 in 2021, 91 in 2022, 222 in 2023 and 64 in 2024; the Netherlands fell from 129 in 2020 to 7 in 2024; Finland sent 121 in 2021 and nothing from 2023, after the war in Ukraine. Reported freight to Russia fell from 3,283 thousand tonnes in 2021 to 1,317 in 2024. Only 32 European countries report; the odd report of a destination on another continent or an island, which rail cannot reach, is not drawn.',
        },
        EUROPE_ONLY,
      ),
      unit: { zh: '千公噸', en: 'thousand tonnes' },
      file: 'rail-intl.json',
      layer: {
        kind: 'flow',
        file: 'rail-flows/{year}.json',
        direction: 'larger',
        labels: FLOW_LABELS,
        legendKey: { zh: '由裝車國（淺）到卸車國（深）', en: 'From the loading country (light) to the unloading country (dark)' },
      },
      format: kt,
      formatTick: (v) => fixed(v, 0),
      defaultYear: 2024,
    },
  ],
};
