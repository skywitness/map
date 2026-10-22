import type { TopicDefinition } from './types';

/** 純地圖：不顯示統計資料，只看底圖；點國家會放大到該國 */
export const pureMap: TopicDefinition = {
  id: 'map',
  title: '世界地圖',
  shortTitle: '地圖',
  pure: true,
  defaultIndicator: 'none',
  defaultYear: new Date().getFullYear(),
  sources: [
    { name: 'OpenFreeMap', url: 'https://openfreemap.org/', license: '免費使用' },
    { name: 'OpenMapTiles', url: 'https://openmaptiles.org/', license: 'CC BY 4.0' },
    { name: 'OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright', license: 'ODbL' },
  ],
  indicators: [
    {
      id: 'none',
      label: '地圖',
      description: '純地圖：可以一路放大到街道，用「底圖」切換陸地與海洋的配色；點國家會放大到該國，右上角可以切換地球儀與平面、3D（傾斜、旋轉，放大到城市可看到立體建築）、全螢幕。',
      unit: '',
      file: '',
      layer: { kind: 'none' },
      format: () => '',
    },
  ],
};
