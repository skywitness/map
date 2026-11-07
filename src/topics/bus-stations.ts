import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 長途客運站與公車站（新主題，2026-11-07，製作手冊第二十七批 576，候選 1292；pipeline/topics/bus_stations.py）。
 * OpenStreetMap 經 QLever：客運站（amenity=bus_station）的點與各國座數、公車站牌（highway=bus_stop）每千人。
 */

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

function stationName(p: PointRecord): { title: string; proper?: string } {
  const n = str(p.n);
  const local = getLang() === 'zh' ? str(p.nz) : str(p.ne);
  const unnamed = tr({ zh: '（沒有名稱的客運站）', en: '(unnamed bus station)' });
  if (local) return { title: local, proper: n && n !== local ? n : undefined };
  return { title: n ?? unnamed, proper: undefined };
}

const OSM_NOTE: Text = {
  zh: '資料是 OpenStreetMap 上的標記，2026 年 11 月經 QLever 依國界計數（© OpenStreetMap contributors，點的資料檔依 ODbL 1.0 分享），不是官方名錄：同時在量 OpenStreetMap 畫得多完整，各國標法也不一樣（菲律賓、秘魯把小站也標成客運站）。',
  en: 'Data are OpenStreetMap tags counted by country via QLever in November 2026 (© OpenStreetMap contributors; the point files are shared under ODbL 1.0). This is not an official register: the counts also reflect how completely OpenStreetMap is mapped, and tagging differs between countries (the Philippines and Peru tag small stops as bus stations too).',
};

const STATIONS: PointsOverlayDef = {
  kind: 'points',
  id: 'bus-stations',
  file: 'stations.json',
  label: { zh: '客運站與公車總站（OpenStreetMap）', en: 'Bus stations and terminals (OpenStreetMap)' },
  indicators: ['bus-stations', 'bus-stops'],
  radius: 2.6,
  color: MAP_TOKENS.hues.orange,
  heatmap: { maxZoom: 3, label: { zh: '縮小時畫成密度，放大看一個個客運站', en: 'Shown as density when zoomed out; zoom in for individual stations' } },
  tooltip: (p, { countryName }) => {
    const { title, proper } = stationName(p);
    return { title, properNoun: proper ?? str(p.n) ?? undefined, detail: typeof p.iso3 === 'string' ? countryName(p.iso3) : undefined };
  },
};

const LIST: ListPanelDef = {
  label: { zh: '客運站與公車總站', en: 'Bus stations and terminals' },
  indicators: ['bus-stations'],
  file: 'stations.json',
  countryField: 'iso3',
  rows: (points) =>
    [...points]
      .filter((p) => p.n || p.nz || p.ne)
      .map((p) => ({ p, name: stationName(p) }))
      .sort((a, b) => a.name.title.localeCompare(b.name.title, getLang() === 'zh' ? 'zh-Hant' : 'en'))
      .map(({ p, name }, i): ListRow => ({
        key: `bs-${i}`,
        title: name.title,
        lines: name.proper ? [name.proper] : [],
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 15 },
      })),
  empty: { zh: 'OpenStreetMap 沒有這個國家有名稱的客運站', en: 'No named bus stations in this country on OpenStreetMap' },
};

export const busStations: TopicDefinition = {
  id: 'bus-stations',
  title: { zh: '長途客運站與公車站', en: 'Bus stations and bus stops' },
  shortTitle: { zh: '客運站與公車站', en: 'Bus stations' },
  defaultIndicator: 'bus-stations',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: { zh: 'OpenStreetMap 貢獻者（客運站與公車站牌；經 QLever 查詢，2026 年 11 月）', en: 'OpenStreetMap contributors (bus stations and bus stops; queried via QLever, November 2026)' },
      url: 'https://www.openstreetmap.org/copyright',
      license: 'ODbL',
    },
  ],
  note: OSM_NOTE,
  overlays: [STATIONS],
  listPanel: LIST,
  indicators: [
    {
      id: 'bus-stations',
      label: { zh: '客運站與公車總站', en: 'Bus stations and terminals' },
      description: {
        zh: `OpenStreetMap 上標成客運站（amenity=bus_station：長途客運站與公車總站）的地點，圓是各國座數、點是每一個客運站，左邊的清單列出有名稱的。全世界 197 國 67,798 座：中國 7,697、印度 6,243、巴西 4,438、俄羅斯 2,778、美國 2,270、墨西哥 2,192、菲律賓 1,653、印尼 1,427、德國 1,324、日本 1,278；台灣 280、南韓 895、新加坡 73。南蘇丹有 1,060 座，多半是把小站也標成客運站。長途客運是交通主題裡還沒有的運具，這裡看的是「客運站在哪裡」，不是住得離站多近。${tr(OSM_NOTE, 'zh')}`,
        en: `Places tagged on OpenStreetMap as bus stations (amenity=bus_station: intercity coach stations and bus terminals); circles show each country’s count, points each station, and the list on the left the named ones. Worldwide 67,798 in 197 countries: China 7,697, India 6,243, Brazil 4,438, Russia 2,778, the US 2,270, Mexico 2,192, the Philippines 1,653, Indonesia 1,427, Germany 1,324 and Japan 1,278; Taiwan 280, South Korea 895 and Singapore 73. South Sudan has 1,060, mostly small stops tagged as stations. Intercity coaches are a mode the transport topics did not cover yet; this shows where the stations are, not how close people live to them. ${tr(OSM_NOTE, 'en')}`,
      },
      unit: { zh: '座', en: 'stations' },
      file: 'stations-count.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 座`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
    },
    {
      id: 'bus-stops',
      label: { zh: '公車站牌的密度', en: 'Bus stops per 1,000 people' },
      description: {
        zh: `每千人有幾個公車站牌（OpenStreetMap 的 highway=bus_stop，人口是 UN WPP 2024），照網站的規則只替 OpenStreetMap 覆蓋良好的國家上色。全世界 203 國 4,182,156 個：德國 411,170、中國 345,380、美國 336,195、英國 286,674、法國 259,553、俄羅斯 201,355、日本 178,674；台灣 49,013。每千人芬蘭 16.79、挪威 15.85、愛沙尼亞 13.08 最多，德國 4.92、瑞士 4.20、英國 4.10、法國 3.89、荷蘭 2.33、台灣 2.13、南韓 2.04、日本 1.46，美國與新加坡 0.96（新加坡 5,651 個明顯偏低，站牌的完整度各國差很多）。`,
        en: `Bus stops per 1,000 people (OpenStreetMap highway=bus_stop; population from UN WPP 2024), shaded only for countries where OpenStreetMap is well mapped, following the site’s rule. Worldwide 4,182,156 in 203 countries: Germany 411,170, China 345,380, the US 336,195, the UK 286,674, France 259,553, Russia 201,355 and Japan 178,674; Taiwan 49,013. Per 1,000 people Finland (16.79), Norway (15.85) and Estonia (13.08) lead, then Germany 4.92, Switzerland 4.20, the UK 4.10, France 3.89, the Netherlands 2.33, Taiwan 2.13, South Korea 2.04 and Japan 1.46, with the US and Singapore at 0.96 (Singapore’s 5,651 is clearly low; completeness varies widely).`,
      },
      unit: { zh: '個／千人', en: 'per 1,000' },
      file: 'bus-stops.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 4, 8, 12] } },
      format: (v) => tr({ zh: `每千人 ${fixed(v, 2)} 個`, en: `${fixed(v, 2)} per 1,000` }),
      formatTick: (v) => fixed(v, 1),
    },
  ],
};
