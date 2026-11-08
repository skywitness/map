import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { IndicatorDef, SourceDef } from './types';

/**
 * 圓環與測速照相機（2026-11-07，製作手冊第二十七批 574，候選 1291、1296；pipeline/topics/road_features.py）：擴充「交通安全」。
 * OpenStreetMap 經 QLever：圓環（junction=roundabout，路段數）每千公里道路、測速照相機（highway=speed_camera）每百萬人。
 */

const OSM_NOTE: Text = {
  zh: '資料是 OpenStreetMap 上的標記，2026 年 11 月經 QLever 依國界計數（© OpenStreetMap contributors，資料檔依 ODbL 1.0 分享），照網站的規則只替 OpenStreetMap 覆蓋良好的國家上色，密度同時在量畫得多完整。',
  en: 'Data are OpenStreetMap tags counted by country via QLever in November 2026 (© OpenStreetMap contributors; data files shared under ODbL 1.0). Following the site’s rule, only countries where OpenStreetMap is well mapped are shaded, and density also reflects mapping completeness.',
};

export const roadFeatures: { sources: SourceDef[]; indicators: IndicatorDef[] } = {
  sources: [
    {
      name: { zh: 'OpenStreetMap 貢獻者（圓環與測速照相機；經 QLever 查詢，2026 年 11 月）', en: 'OpenStreetMap contributors (roundabouts and speed cameras; queried via QLever, November 2026)' },
      url: 'https://www.openstreetmap.org/copyright',
      license: 'ODbL',
    },
  ],
  indicators: [
    {
      id: 'roundabouts',
      label: { zh: '圓環的密度', en: 'Roundabout density' },
      description: {
        zh: `每千公里道路有幾段圓環（OpenStreetMap 的 junction=roundabout；道路長度是 CIA 世界概況 2022 年版，年份各國不同）。同一個圓環常被切成好幾段，所以數的是路段、不是座數。全世界 222 個國家或地區 1,029,378 段：法國 149,287 段最多，西班牙 126,827、義大利 85,337、英國 61,141、澳洲 60,216、美國 58,117、德國 36,524。地圖上分得出「圓環文化圈」與「號誌路口文化圈」：每千公里道路以色列 889.4 段、荷蘭 206.9、西班牙 185.6、義大利 175.0、英國 155.0、法國 141.7，德國 58.4、南韓 29.6、美國 8.8、台灣 8.5（366 段），日本只有 0.2（235 段）；中國 7,009 段沒有上色。${tr(OSM_NOTE, 'zh')}`,
        en: `Roundabout segments per 1,000 km of road (OpenStreetMap junction=roundabout; road length from the 2022 CIA World Factbook, years vary). One roundabout is often split into several segments, so these are segments, not roundabouts. Worldwide there are 1,029,378 in 222 countries and territories: France has the most, 149,287, then Spain 126,827, Italy 85,337, the UK 61,141, Australia 60,216, the US 58,117 and Germany 36,524. The map separates roundabout cultures from signalised-junction cultures: per 1,000 km of road Israel has 889.4, the Netherlands 206.9, Spain 185.6, Italy 175.0, the UK 155.0 and France 141.7, against Germany 58.4, South Korea 29.6, the US 8.8, Taiwan 8.5 (366 segments) and Japan only 0.2 (235); China’s 7,009 are not shaded. ${tr(OSM_NOTE, 'en')}`,
      },
      unit: { zh: '段／千公里道路', en: 'per 1,000 km of road' },
      file: 'roundabouts.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 20, 50, 100, 150, 250] } },
      format: (v) => tr({ zh: `每千公里道路 ${fixed(v, 1)} 段`, en: `${fixed(v, 1)} per 1,000 km` }),
      formatTick: (v) => fixed(v, 0),
      timeless: true,
    },
    {
      id: 'speed-cameras',
      label: { zh: '測速照相機的密度', en: 'Speed cameras per million people' },
      description: {
        zh: `每百萬人有幾台測速照相機（OpenStreetMap 的 highway=speed_camera，人口是 UN WPP 2024）。全世界 121 個國家或地區 77,991 台：俄羅斯 11,407 台最多，巴西 9,795、德國 5,192、義大利 5,158、法國 3,938、英國 3,472、伊朗 3,031。每百萬人克羅埃西亞 271.6、瑞典 231.2、芬蘭 162.4、奧地利 154.2 最多，台灣 41.2（948 台），高於新加坡 34.5、南韓 14.2、美國 4.0、日本 1.6。OpenStreetMap 的測速照相機由駕駛社群維護，各國收錄很不平均（日本、美國明顯偏低）；台灣各縣市警察局有官方資料集，這次沒有合併。${tr(OSM_NOTE, 'zh')}`,
        en: `Speed cameras per million people (OpenStreetMap highway=speed_camera; population from UN WPP 2024). Worldwide there are 77,991 in 121 countries and territories: Russia has the most, 11,407, then Brazil 9,795, Germany 5,192, Italy 5,158, France 3,938, the UK 3,472 and Iran 3,031. Per million people Croatia (271.6), Sweden (231.2), Finland (162.4) and Austria (154.2) lead; Taiwan has 41.2 (948 cameras), above Singapore 34.5, South Korea 14.2, the US 4.0 and Japan 1.6. Speed cameras on OpenStreetMap are maintained by driving communities and coverage is very uneven (clearly low in Japan and the US); Taiwan’s county police publish official datasets, which are not merged here. ${tr(OSM_NOTE, 'en')}`,
      },
      unit: { zh: '台／百萬人', en: 'per million' },
      file: 'speed-cameras.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 20, 50, 100, 150, 250] } },
      format: (v) => tr({ zh: `每百萬人 ${fixed(v, 1)} 台`, en: `${fixed(v, 1)} per million` }),
      formatTick: (v) => fixed(v, 0),
      timeless: true,
    },
  ],
};
