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
  ],
  indicators: [
    {
      id: 'none',
      label: { zh: '地圖', en: 'Map' },
      description: {
        zh: '純地圖：可以一路放大到街道，用「底圖」切換陸地與海洋的配色；點國家會放大到該國，右上角可以切換地球儀與平面、全螢幕。',
        en: 'Just the map: zoom all the way in to street level and use "Basemap" to change the colours of land and sea. Click a country to zoom to it; the buttons at the top right switch between globe and flat map and turn on full screen.',
      },
      unit: '',
      file: '',
      layer: { kind: 'none' },
      format: () => '',
    },
  ],
};
