import type { TopicDefinition } from './types';

/** 純地圖：不顯示統計資料，只看底圖；點國家會放大到該國 */
export const pureMap: TopicDefinition = {
  id: 'map',
  title: { zh: '世界地圖', en: 'World map' },
  shortTitle: { zh: '地圖', en: 'Map' },
  pure: true,
  defaultIndicator: 'none',
  defaultYear: new Date().getFullYear(),
  sources: [
    { name: 'OpenFreeMap', url: 'https://openfreemap.org/', license: { zh: '免費使用', en: 'free to use' } },
    { name: 'OpenMapTiles', url: 'https://openmaptiles.org/', license: 'CC BY 4.0' },
    { name: 'OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright', license: 'ODbL' },
    // 行政區界（製作手冊第十六批 265）：各國用哪一份、授權寫在左側欄最下面（data/divisions/<代碼>.json 的 sources）
    {
      name: { zh: 'Natural Earth 1:10m 第一級行政區', en: 'Natural Earth 1:10m Admin 1' },
      url: 'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/',
      license: { zh: '公有領域', en: 'public domain' },
    },
    {
      name: { zh: 'geoBoundaries（第二級行政區）', en: 'geoBoundaries (second-level divisions)' },
      url: 'https://www.geoboundaries.org/',
      license: { zh: '依各國授權', en: 'licence varies by country' },
    },
    {
      name: { zh: '內政部國土測繪中心：直轄市、縣市界線與鄉鎮市區界線', en: 'NLSC, Ministry of the Interior (Taiwan): county and township boundaries' },
      url: 'https://data.gov.tw/dataset/7441',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
    { name: { zh: 'Wikidata（行政區的中文名稱）', en: 'Wikidata (Chinese names of divisions)' }, url: 'https://www.wikidata.org/', license: 'CC0 1.0' },
  ],
  indicators: [
    {
      id: 'none',
      label: { zh: '地圖', en: 'Map' },
      description: {
        zh: '純地圖：可以一路放大到街道，用「底圖」切換陸地與海洋的配色。點國家會放大到該國並畫出它的省、州、直轄市與縣市（第一級行政區），再點一區放大並畫出它裡面的縣、區、鄉鎮市區（第二級）；左側欄列出這一層的行政區，它右邊的路徑點了回到那一層，按 Esc 回上一層。右上角可以切換地球儀與平面、3D（傾斜、旋轉，放大到城市可看到立體建築）、全螢幕。',
        en: 'Just the map: zoom all the way in to street level and use "Basemap" to change the colours of land and sea. Click a country to zoom to it and show its states and provinces (first-level divisions); click one of them to zoom in and show the counties or districts inside it (second level). The side list shows the divisions at the current level; the path next to it takes you back to any level, and Esc goes up one level. The buttons at the top right switch between globe and flat map, 3D (tilt and rotate; zoom in to a city to see 3D buildings) and full screen.',
      },
      unit: '',
      file: '',
      layer: { kind: 'none' },
      format: () => '',
    },
  ],
};
