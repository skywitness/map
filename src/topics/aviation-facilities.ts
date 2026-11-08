import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, PointsOverlayDef, SourceDef } from './types';

/**
 * 機場的設施：登機門、空橋、報到櫃台、停車位與用地面積（2026-11-07，製作手冊第二十七批 570，候選 1286；
 * pipeline/topics/airport_facilities.py）：擴充「機場與旅客」。Eurostat 各機場申報的基礎設施（點與側欄的表）、
 * OpenStreetMap 的登機門個數與機場範圍的面積。
 */
export const FACILITY_IDS = ['osm-gates', 'aerodrome-area'];

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const num = (v: unknown) => (typeof v === 'number' ? v : null);

const OSM_NOTE: Text = {
  zh: 'OpenStreetMap 的資料 2026 年 11 月經 QLever 依國界加總（© OpenStreetMap contributors，ODbL 1.0），不是官方數字。',
  en: 'OpenStreetMap data summed by country via QLever in November 2026 (© OpenStreetMap contributors, ODbL 1.0); not official figures.',
};

/** Eurostat 申報的機場：大小是登機門 */
const EU_AIRPORTS: PointsOverlayDef = {
  kind: 'points',
  id: 'eu-airport-facilities',
  file: 'airport-facilities.json',
  label: { zh: '歐洲機場的登機門（Eurostat）', en: 'Gates at European airports (Eurostat)' },
  indicators: FACILITY_IDS,
  radius: { field: 'g', stops: [[5, 2.5], [50, 5], [100, 8], [230, 12]] },
  color: MAP_TOKENS.hues.violet,
  sortField: 'g',
  sizeLegend: { title: { zh: '登機門', en: 'Gates' }, values: [20, 100, 200], format: (v) => fixed(v, 0) },
  tooltip: (p) => {
    const g = num(p.g);
    const bb = num(p.bb);
    const lines = [
      num(p.ck) !== null ? tr({ zh: `報到櫃台 ${fixed(num(p.ck)!, 0)} 個`, en: `${fixed(num(p.ck)!, 0)} check-in desks` }) : null,
      num(p.pk) !== null ? tr({ zh: `停車位 ${fixed(num(p.pk)!, 0)} 個`, en: `${fixed(num(p.pk)!, 0)} parking spaces` }) : null,
      num(p.rw) !== null ? tr({ zh: `跑道 ${fixed(num(p.rw)!, 0)} 條`, en: `${fixed(num(p.rw)!, 0)} runways` }) : null,
    ].filter((x): x is string => Boolean(x));
    return {
      title: str(p.name) ?? '',
      properNoun: str(p.name) ?? undefined,
      detail: tr({
        zh: `${p.y} 年：登機門 ${g === null ? '—' : fixed(g, 0)} 個${bb !== null ? `（有空橋的 ${fixed(bb, 0)} 個）` : ''}`,
        en: `${p.y}: ${g === null ? '—' : fixed(g, 0)} gates${bb !== null ? ` (${fixed(bb, 0)} with jet bridges)` : ''}`,
      }),
      extra: lines,
    };
  },
};

export const aviationFacilities: { sources: SourceDef[]; indicators: IndicatorDef[]; overlays: PointsOverlayDef[] } = {
  sources: [
    {
      name: { zh: 'Eurostat：各機場的基礎設施（avia_if_typ）', en: 'Eurostat: airport infrastructure by airport (avia_if_typ)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/avia_if_typ/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'OpenStreetMap 貢獻者（登機門與機場範圍；經 QLever 查詢，2026 年 11 月）', en: 'OpenStreetMap contributors (gates and aerodrome outlines; queried via QLever, November 2026)' },
      url: 'https://www.openstreetmap.org/copyright',
      license: 'ODbL',
    },
  ],
  overlays: [EU_AIRPORTS],
  indicators: [
    {
      id: 'osm-gates',
      label: { zh: '機場的登機門', en: 'Airport gates' },
      description: {
        zh: `OpenStreetMap 上標成登機門（aeroway=gate）的個數，圓是各國的總數（照網站的規則只替 OSM 覆蓋良好的國家上色）；紫色的點是向 Eurostat 申報設施的歐洲機場，大小是登機門。OSM 全世界 158 個國家或地區 21,637 個：美國 5,945、中國 2,342、巴西 1,009、英國 720、法國 692、德國 667、加拿大 610、西班牙 577、印度 535、日本 527；南韓 243、新加坡 132、台灣 96。Eurostat 的申報是自願的，很多機場只有幾年，各取最近有登機門數字的一年：馬德里 229 個（136 個有空橋，2024 年）、法蘭克福 210（2021）、慕尼黑 189（2021）、戴高樂 180（2016）、巴塞隆納 165（2003 年只有 63）、伊斯坦堡 147；報到櫃台伊斯坦堡 610、法蘭克福 481、馬德里 454；停車位伊斯坦堡 40,000（2018 年 18,000）、巴塞隆納 25,535、都柏林 23,130；阿姆斯特丹有 6 條跑道。英國的機場 Eurostat 有（希斯洛 2017 年 171 個登機門、929 個報到櫃台），照網站的規則不畫。點國家看各機場的設施表。${tr(OSM_NOTE, 'zh')}`,
        en: `Features tagged as gates (aeroway=gate) on OpenStreetMap; circles show each country’s total (following the site’s rule, only countries where OSM is well mapped are shaded). Purple points are European airports that report facilities to Eurostat, sized by gates. OSM has 21,637 gates in 158 countries and territories: the US 5,945, China 2,342, Brazil 1,009, the UK 720, France 692, Germany 667, Canada 610, Spain 577, India 535 and Japan 527; South Korea 243, Singapore 132 and Taiwan 96. Reporting to Eurostat is voluntary and many airports report only a few years, so each shows its latest year with a gate count: Madrid 229 (136 with jet bridges, 2024), Frankfurt 210 (2021), Munich 189 (2021), Paris-Charles de Gaulle 180 (2016), Barcelona 165 (63 in 2003) and Istanbul 147; check-in desks Istanbul 610, Frankfurt 481 and Madrid 454; parking Istanbul 40,000 (18,000 in 2018), Barcelona 25,535 and Dublin 23,130; Amsterdam has 6 runways. Eurostat has UK airports too (Heathrow: 171 gates and 929 check-in desks in 2017), but by the site’s rule they are not shown. Click a country for a table of its airports. ${tr(OSM_NOTE, 'en')}`,
      },
      unit: { zh: '個', en: 'gates' },
      file: 'osm-gates.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 個`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      timeless: true,
    },
    {
      id: 'aerodrome-area',
      label: { zh: '機場用地的面積', en: 'Land area of airports' },
      description: {
        zh: `OpenStreetMap 上機場範圍（aeroway=aerodrome 的面）的面積加總，圓是各國的總面積；含軍用機場，滑過看標成軍用的有幾座、多大（不是每座軍用機場都有標，只能當下限）。美國 8,637 平方公里最多（其中標成軍用的 3,644.3），俄羅斯 1,642、中國 1,401、沙烏地阿拉伯 910.7、伊拉克 834.5（標成軍用的 627.8）、澳洲 804.4、印度 730.9；法國 523.5、德國 397.2、英國 314.2、日本 237.2、南韓 122.3、台灣 94.1（45 座，標成軍用的 15 座、60.7 平方公里）、新加坡 46.1。${tr(OSM_NOTE, 'zh')}`,
        en: `Total area of airport outlines (aeroway=aerodrome areas) on OpenStreetMap; circles show each country’s total. Military airfields are included; hover for how many are tagged military and their area (not every military airfield is tagged, so this is a lower bound). The US has the most, 8,637 km² (3,644.3 tagged military), then Russia 1,642, China 1,401, Saudi Arabia 910.7, Iraq 834.5 (627.8 tagged military), Australia 804.4 and India 730.9; France 523.5, Germany 397.2, the UK 314.2, Japan 237.2, South Korea 122.3, Taiwan 94.1 (45 airfields, 15 of them tagged military covering 60.7 km²) and Singapore 46.1. ${tr(OSM_NOTE, 'en')}`,
      },
      unit: { zh: '平方公里', en: 'km²' },
      file: 'aerodrome-area.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: (v) => tr({ zh: `${fixed(v, v >= 1000 ? 0 : 1)} 平方公里`, en: `${fixed(v, v >= 1000 ? 0 : 1)} km²` }),
      formatTick: (v) => fixed(v, 0),
      timeless: true,
    },
  ],
};
