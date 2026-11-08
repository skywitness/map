import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { IndicatorDef, SourceDef } from './types';

/**
 * 火車站與廢線（2026-11-07，製作手冊第二十七批 565、566，候選 1277、1279、1281；pipeline/topics/rail_stations.py、
 * rail_abandoned.py）：擴充「鐵路」。OpenStreetMap 經 QLever 的火車站（不含地鐵站）與招呼站每百萬人、車站標了
 * 能不能坐輪椅進出的比例，以及已拆除（railway=abandoned）與停用（railway=disused）的鐵路長度。
 */

const OSM_NOTE: Text = {
  zh: '資料是 OpenStreetMap 上的標記，2026 年 11 月經 QLever 依國界計數（© OpenStreetMap contributors，資料檔依 ODbL 1.0 分享），不是官方名錄，同時在量 OpenStreetMap 畫得多完整。',
  en: 'Data are OpenStreetMap tags, counted by country via QLever in November 2026 (© OpenStreetMap contributors; the data files are shared under ODbL 1.0). This is not an official register, and the figures also reflect how completely OpenStreetMap is mapped.',
};
const COVERAGE_NOTE: Text = {
  zh: '照網站的規則只替 OpenStreetMap 覆蓋良好的 96 個國家或地區上色（用餐飲店對餐飲業就業人數判斷），其他國家的數字寫在滑過的說明裡。',
  en: 'Following the site’s rule, only the 96 countries and territories where OpenStreetMap is well mapped are coloured (judged by food and drink places against food-service employment); figures for other countries are in the hover text.',
};
const join = (...parts: Text[]): Text => ({
  zh: parts.map((p) => tr(p, 'zh')).join(''),
  en: parts.map((p) => tr(p, 'en')).join(' '),
});
const KM: Text = { zh: '公里', en: 'km' };
const km = (v: number) => `${fixed(v, 0)} ${tr(KM)}`;

export const railStations: { sources: SourceDef[]; indicators: IndicatorDef[] } = {
  sources: [
    {
      name: {
        zh: 'OpenStreetMap 貢獻者（火車站、招呼站、車站的輪椅標記、廢線；經 QLever 查詢，2026 年 11 月）',
        en: 'OpenStreetMap contributors (railway stations, halts, station wheelchair tags, abandoned and disused railways; queried via QLever, November 2026)',
      },
      url: 'https://www.openstreetmap.org/copyright',
      license: 'ODbL',
    },
  ],
  indicators: [
    {
      id: 'rail-stations',
      label: { zh: '火車站的密度', en: 'Railway stations per million people' },
      description: join(
        {
          zh: '每百萬人有幾座火車站（OpenStreetMap 的 railway=station 加上招呼站 railway=halt；同時標 station=subway 的地鐵站不算，見「地鐵與城市軌道」主題）。中歐最密：捷克每百萬人 263 座（1,141 座車站加 1,630 個招呼站）、瑞士 220、斯洛伐克 177、奧地利 174、匈牙利 166；德國 98、日本 70、法國 51、英國 48；台灣 17（357 座車站加 26 個招呼站）、南韓 13、美國 12。站數最多的是中國 11,112 座、日本 8,473 座、印度 8,289 座，不過中國與印度的 OpenStreetMap 判斷不了或畫得不完整，沒有上色。招呼站最多的是俄羅斯 7,425 個、德國 4,370 個。',
          en: 'Railway stations per million people (OpenStreetMap railway=station plus halts, railway=halt; metro stations tagged station=subway are excluded and appear in the Metro and urban rail topic). Central Europe is densest: Czechia has 263 per million (1,141 stations plus 1,630 halts), Switzerland 220, Slovakia 177, Austria 174 and Hungary 166; Germany 98, Japan 70, France 51, the UK 48; Taiwan 17 (357 stations plus 26 halts), South Korea 13 and the US 12. China has the most stations, 11,112, then Japan 8,473 and India 8,289, but China and India are not shaded because OpenStreetMap coverage there cannot be judged or is incomplete. Russia has the most halts, 7,425, then Germany 4,370.',
        },
        COVERAGE_NOTE,
        OSM_NOTE,
      ),
      unit: { zh: '座／百萬人', en: 'per million' },
      file: 'rail-stations.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 50, 100, 200, 400] } },
      format: (v) => tr({ zh: `每百萬人 ${fixed(v, v >= 10 ? 0 : 1)} 座`, en: `${fixed(v, v >= 10 ? 0 : 1)} per million` }),
      formatTick: (v) => fixed(v, 0),
      timeless: true,
    },
    {
      id: 'station-wheelchair',
      label: { zh: '車站可以坐輪椅進出的比例', en: 'Stations tagged wheelchair accessible' },
      description: join(
        {
          zh: 'OpenStreetMap 上標了能不能坐輪椅進出（wheelchair=yes／limited／no）的火車站與地鐵站裡，標「可以」的占幾成。50 個國家或地區有 30 座以上的車站有標：愛沙尼亞有標的 39 座全部可以、新加坡 99%、以色列 97%、南韓 95%、台灣 85%（有標的 222 座裡 189 座可以、14 座不行）、日本 81%、德國 69%、英國 63%；委內瑞拉只有 15%（有標的 68 座多半是「部分」）。各國有標的比例差很多：德國 83% 的車站有標，日本 18%、中國 2%。沒標不等於不能進出：比例只用有標的車站算，有標的不到 30 座不畫；滑過看有標的車站占全部的幾成。',
          en: 'Of the railway and metro stations whose wheelchair access is tagged on OpenStreetMap (wheelchair=yes, limited or no), the share tagged “yes”. In 50 countries and territories at least 30 stations are tagged: all 39 tagged stations in Estonia say yes, Singapore 99%, Israel 97%, South Korea 95%, Taiwan 85% (189 of 222 tagged stations yes and 14 no), Japan 81%, Germany 69% and the UK 63%; Venezuela only 15% (most of its 68 tagged stations are “limited”). How many stations are tagged varies widely: 83% in Germany, 18% in Japan and 2% in China. An untagged station is not necessarily inaccessible: the share uses tagged stations only, countries with fewer than 30 tagged stations are not shown, and the hover text gives the share of all stations that are tagged.',
        },
        OSM_NOTE,
      ),
      unit: '%',
      file: 'station-wheelchair.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 40, 60, 75, 90] } },
      format: (v) => `${fixed(v, 0)}%`,
      formatTick: (v) => `${v}%`,
      timeless: true,
    },
    {
      id: 'rail-abandoned',
      label: { zh: '已拆除的廢線', en: 'Abandoned railways' },
      description: join(
        {
          zh: 'OpenStreetMap 上標成 railway=abandoned 的鐵路長度：軌道已經拆掉、路基或痕跡還在的舊鐵路（依國界加總，跨國界的線段不算）。全世界 436,148 段、462,120 km：美國 198,000 km（含大量從美國普查局 TIGER 地圖匯入的舊路線）、加拿大 34,676、俄羅斯 25,627、法國 24,554、德國 19,463、英國 16,022、澳洲 15,305、波蘭 11,390、阿根廷 7,138、日本 3,682、台灣 1,212（中國 9,822、巴西 6,892 沒有上色）。其中 149,252 段、112,337 km 同時標了 highway，已經改成道路、步道或自行車道，所以「廢線」會跟鐵道自行車道重疊：台灣 1,212 km 裡有 407 km。台灣有名稱的最長是羅東森林鐵道（50.6 km）、小港糖廠林園線（22.5 km）、臺中線平面舊線（20.9 km），多是糖鐵、林鐵與改線留下的舊線。點國家看有名稱的廢線。只算長度，沒有畫線。',
          en: 'Length of railway tagged railway=abandoned on OpenStreetMap: old lines whose track has been removed but whose trackbed or traces remain (added up by country; segments crossing a border are not counted). Worldwide 436,148 segments total 462,120 km: the US has 198,000 km (including many old lines imported from the US Census Bureau’s TIGER maps), Canada 34,676, Russia 25,627, France 24,554, Germany 19,463, the UK 16,022, Australia 15,305, Poland 11,390, Argentina 7,138, Japan 3,682 and Taiwan 1,212 (China’s 9,822 and Brazil’s 6,892 are not shaded). 149,252 segments, 112,337 km, are also tagged highway, having become roads, paths or cycleways, so abandoned railways overlap with rail trails: 407 of Taiwan’s 1,212 km. Taiwan’s longest named ones are the Luodong Forest Railway (50.6 km), the Xiaogang Sugar Factory Linyuan line (22.5 km) and the old surface Taichung line (20.9 km), mostly sugar and forest railways and lines left behind by realignments. Click a country for its named abandoned lines. Only lengths are shown; the lines themselves are not drawn.',
        },
        COVERAGE_NOTE,
        OSM_NOTE,
      ),
      unit: KM,
      file: 'rail-abandoned.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: km,
      formatTick: (v) => fixed(v, 0),
      timeless: true,
    },
    {
      id: 'rail-disused',
      label: { zh: '停用的鐵路', en: 'Disused railways' },
      description: join(
        {
          zh: 'OpenStreetMap 上標成 railway=disused 的鐵路長度：軌道還在、但已經沒有車在跑（依國界加總，跨國界的線段不算）。全世界 193,767 段、131,102 km：阿根廷 18,191 km 最多，美國 15,769、澳洲 9,292、烏克蘭 8,082、法國 6,108、德國 5,896、波蘭 5,863、俄羅斯 5,007、加拿大 3,246（巴西 10,760、中國 3,573 沒有上色）；台灣 183 km，有名稱的最長是臺中綠空鐵道（6.8 km）與阿里山林鐵的眠月線（5.9 km）。點國家看有名稱的停用鐵路。',
          en: 'Length of railway tagged railway=disused on OpenStreetMap: the track is still there but no trains run (added up by country; segments crossing a border are not counted). Worldwide 193,767 segments total 131,102 km: Argentina has the most, 18,191 km, then the US 15,769, Australia 9,292, Ukraine 8,082, France 6,108, Germany 5,896, Poland 5,863, Russia 5,007 and Canada 3,246 (Brazil’s 10,760 and China’s 3,573 are not shaded); Taiwan has 183 km, the longest named being the Taichung Green Corridor elevated line (6.8 km) and the Mianyue line of the Alishan Forest Railway (5.9 km). Click a country for its named disused lines.',
        },
        COVERAGE_NOTE,
        OSM_NOTE,
      ),
      unit: KM,
      file: 'rail-disused.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: km,
      formatTick: (v) => fixed(v, 0),
      timeless: true,
    },
  ],
};

