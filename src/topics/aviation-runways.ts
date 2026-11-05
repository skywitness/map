import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { AIRPORTS_ZH } from './longest-flights-names';
import type { IndicatorDef, ListPanelDef, ListRow, PointRecord, SourceDef } from './types';

/**
 * 跑道（2026-11-05，製作手冊第二十三批 399；pipeline/topics/airport_runways.py）：擴充「機場與旅客」。
 * 跑道總長與 3,000 公尺以上的跑道只算有定期航班的機場（OurAirports），鋪面機場的比例用 CIA World Factbook 2022 年版
 * （全部機場，多數 2021 年）。左側欄列有定期航班的機場與最長的跑道；台灣的側欄另列民航局的機場設施表。
 */

export const RUNWAY_INDICATORS = ['runway-km', 'runways-3000', 'paved-share'];
const LIST_LIMIT = 100;

/** OurAirports 的 surface 欄常見的寫法（不是控制詞彙，其他的照原文） */
const SURFACES: [RegExp, { zh: string; en: string }][] = [
  [/^(ASP|ASPH|ASPHALT|BIT|BITUMEN|TAR)/, { zh: '柏油', en: 'asphalt' }],
  [/^(CON|CONC|CONCRETE)/, { zh: '混凝土', en: 'concrete' }],
  [/^PEM/, { zh: '部分混凝土、部分柏油', en: 'part concrete, part asphalt' }],
  [/^(GRS|GRASS|TURF)/, { zh: '草地', en: 'grass' }],
  [/^(GRE|GRV|GRVL|GRAVEL)/, { zh: '碎石', en: 'gravel' }],
  [/^(DIRT|EARTH|SAND|SOIL|LAT|LATERITE|CLAY)/, { zh: '泥土或砂', en: 'dirt or sand' }],
  [/^(ICE|SNOW)/, { zh: '冰雪', en: 'ice or snow' }],
];

function surfaceText(raw: unknown): string | null {
  const s = String(raw ?? '');
  if (!s || s === 'UNK' || s === 'U') return null;
  const hit = SURFACES.find(([re]) => re.test(s));
  return hit ? tr(hit[1]) : s;
}

function airportName(p: PointRecord): { title: string; proper?: string } {
  const en = String(p.name ?? '');
  const zh = getLang() === 'zh' && p.iata ? AIRPORTS_ZH[String(p.iata)] : undefined;
  return zh ? { title: zh, proper: en } : { title: en };
}

const RUNWAY_LIST: ListPanelDef = {
  label: { zh: '有定期航班的機場（依最長的跑道）', en: 'Airports with scheduled flights (by longest runway)' },
  indicators: RUNWAY_INDICATORS,
  file: 'runways.json',
  countryField: 'iso3',
  rows: (points, { countryName, country }) => {
    const sorted = [...points].sort((a, b) => Number(b.m) - Number(a.m));
    return (country ? sorted : sorted.slice(0, LIST_LIMIT)).map((p): ListRow => {
      const { title, proper } = airportName(p);
      const codes = [p.iata, p.icao].filter(Boolean).join(' / ');
      const details = [
        tr({ zh: `最長的跑道 ${fixed(Number(p.m), 0)} 公尺（${p.rwy}）`, en: `Longest runway ${fixed(Number(p.m), 0)} m (${p.rwy})` }),
        surfaceText(p.surface),
        p.lit ? tr({ zh: '有夜間照明', en: 'lighted' }) : null,
        Number(p.n) > 1 ? tr({ zh: `共 ${p.n} 條跑道`, en: `${p.n} runways` }) : null,
      ];
      return {
        key: `${p.icao}-${p.lon}`,
        title,
        properNoun: proper,
        lines: [[typeof p.iso3 === 'string' ? countryName(p.iso3) : null, codes].filter(Boolean).join(' · '), details.filter(Boolean).join(' · ')],
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 12 },
      };
    });
  },
  empty: { zh: '沒有有定期航班的機場', en: 'No airports with scheduled flights' },
};

const km = (v: number) => tr({ zh: `${fixed(v, v < 10 ? 1 : 0)} 公里`, en: `${fixed(v, v < 10 ? 1 : 0)} km` });
const runways = (v: number) => tr({ zh: `${fixed(v, 0)} 條`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'runway' : 'runways'}` });

export const aviationRunways: { sources: SourceDef[]; indicators: IndicatorDef[]; listPanel: ListPanelDef } = {
  sources: [
    {
      name: { zh: 'OurAirports（跑道的長度、鋪面與照明，runways.csv）', en: 'OurAirports (runway length, surface and lighting, runways.csv)' },
      url: 'https://ourairports.com/data/',
      license: { zh: '公有領域', en: 'public domain' },
    },
    {
      name: {
        zh: 'CIA World Factbook 2022 年 12 月的版本（鋪面與未鋪面機場，factbook/factbook.json 的 commit 61dadec0）',
        en: 'CIA World Factbook, December 2022 edition (airports with paved and unpaved runways; factbook/factbook.json commit 61dadec0)',
      },
      url: 'https://github.com/factbook/factbook.json/tree/61dadec0c9c9a38eb4c9665aa779977c47dd0481',
      license: { zh: '公有領域', en: 'public domain' },
    },
    {
      name: { zh: '交通部民用航空局「民航機場設施與能量（年資料）」（台灣的側欄）', en: 'Taiwan Civil Aeronautics Administration, airport facilities and capacity (annual; Taiwan’s side panel)' },
      url: 'https://data.gov.tw/dataset/47490',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  listPanel: RUNWAY_LIST,
  indicators: [
    {
      id: 'runway-km',
      label: { zh: '跑道總長', en: 'Total runway length' },
      description: {
        zh: '有定期航班的機場的跑道加起來多長（OurAirports），圓的面積與它成正比。全世界 3,944 座機場、5,300 條跑道、共 11,670 公里（不含水上跑道）；美國 1,213 條、2,409.7 公里最多，中國 305 條、914.6 公里，加拿大 539.8、俄羅斯 414.4、澳洲 381.8、印度 335.0、日本 218.3 公里；台灣 17 條、45.0 公里。只算有定期航班的機場，因為 OurAirports 對美國的小機場收得特別齊全（全部算的話美國有 1 萬 6 千條跑道、中國只有 3 百多條），比的會是資料庫完不完整。左邊的清單依最長的跑道列出機場。',
        en: 'Combined length of the runways at airports with scheduled flights (OurAirports); circle area is proportional to it. Worldwide 3,944 airports have 5,300 runways totalling 11,670 km (excluding water runways); the US leads with 1,213 runways and 2,409.7 km, then China (305 runways, 914.6 km), Canada 539.8, Russia 414.4, Australia 381.8, India 335.0 and Japan 218.3 km; Taiwan has 17 runways and 45.0 km. Only airports with scheduled flights count, because OurAirports covers small US airfields far more thoroughly (counting everything, the US would have 16,000 runways and China only about 300), which would measure the database rather than the country. The list on the left ranks airports by their longest runway.',
      },
      unit: { zh: '公里', en: 'km' },
      file: 'runway-km.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: km,
      formatTick: (v) => fixed(v, 0),
      missing: { zh: '沒有定期航班的機場', en: 'No airports with scheduled flights' },
    },
    {
      id: 'runways-3000',
      label: { zh: '3,000 公尺以上的跑道', en: 'Runways of 3,000 m or more' },
      description: {
        zh: '有定期航班的機場裡，3,000 公尺以上的跑道有幾條（大致是長程廣體客機起降需要的長度；OurAirports），圓的面積與它成正比。美國 159 條、中國 141、俄羅斯 50、伊朗 42、土耳其 41、印度 34；日本 11、台灣 9、韓國 8，新加坡、香港各 3。台灣的 9 條在桃園（2 條）、高雄、金門，與台中、嘉義、台南（2 條）、澎湖這些軍民合用機場；新竹、志航這類沒有定期航班的空軍基地不算。',
        en: 'Number of runways 3,000 m or longer at airports with scheduled flights (roughly what long-haul wide-body aircraft need; OurAirports); circle area is proportional to it. The US has 159, China 141, Russia 50, Iran 42, Turkey 41 and India 34; Japan 11, Taiwan 9, South Korea 8, and Singapore and Hong Kong 3 each. Taiwan’s nine are at Taoyuan (two), Kaohsiung and Kinmen, and at the joint civil-military airports of Taichung, Chiayi, Tainan (two) and Penghu; air bases without scheduled flights, such as Hsinchu and Chihhang, are not counted.',
      },
      unit: { zh: '條', en: 'runways' },
      file: 'runways-3000.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 100] },
      format: runways,
      formatTick: (v) => fixed(v, 0),
      missing: { zh: '沒有定期航班的機場', en: 'No airports with scheduled flights' },
    },
    {
      id: 'paved-share',
      label: { zh: '鋪面機場的比例', en: 'Share of airports with paved runways' },
      description: {
        zh: '全部機場（含沒有定期航班的小機場）裡，跑道有鋪面（柏油或混凝土）的占幾成（CIA World Factbook 2022 年版，多數是 2021 年；之後的版本把這一欄刪了）。中國 95.7%、台灣 94.6%（37 座裡 35 座）、土耳其 92.9%、日本 81.1%、韓國 64.0%、俄羅斯 48.8%、美國 37.4%（一萬多座私人小機場多半是草地）；巴拉圭 1.9%（799 座裡 15 座）、玻利維亞 2.5%、巴布亞紐幾內亞 3.7%，吐瓦魯唯一的機場沒有鋪面。',
        en: 'Share of all airports (including small airfields without scheduled flights) whose runways are paved (asphalt or concrete), from the December 2022 CIA World Factbook (mostly 2021 data; later editions dropped the field). China 95.7%, Taiwan 94.6% (35 of 37), Turkey 92.9%, Japan 81.1%, South Korea 64.0%, Russia 48.8% and the US 37.4% (most of its many thousand private airstrips are grass); Paraguay 1.9% (15 of 799), Bolivia 2.5% and Papua New Guinea 3.7%, while Tuvalu’s only airport is unpaved.',
      },
      unit: '%',
      file: 'paved-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 50, 75, 90, 99] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${fixed(v, 0)}%`,
    },
  ],
};
