import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 歐洲森林的擾動是誰造成的（2026-11-07，製作手冊第二十五批 497，候選 1164）：Senf & Seidl 的歸因圖（34 國 30 公尺
 * GeoTIFF，pipeline/topics/forest_disturbance.py 數像素）。不單獨登記，用 topicPart 併進「森林」（forest.ts）；
 * 資料在 public/data/topics/forest/（dataTopic）
 */
export const forestDisturbance: TopicDefinition = {
  id: 'forest-disturbance',
  dataTopic: 'forest',
  title: { zh: '歐洲森林的擾動', en: 'Forest disturbance in Europe' },
  shortTitle: { zh: '森林擾動', en: 'Forest disturbance' },
  defaultIndicator: 'disturbance-cause',
  defaultYear: 2020,
  timeless: true,
  focus: [-25, 34, 45, 71],
  sources: [
    {
      name: {
        zh: 'Senf & Seidl：Attributing European forest disturbances to storm and fire（Zenodo 8202241）；Senf, C. and Seidl, R. (2021) Mapping the forest disturbance regimes of Europe. Nature Sustainability',
        en: 'Senf & Seidl: Attributing European forest disturbances to storm and fire (Zenodo 8202241); Senf, C. and Seidl, R. (2021) Mapping the forest disturbance regimes of Europe. Nature Sustainability',
      },
      url: 'https://doi.org/10.5281/zenodo.8202241',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '用 Landsat 衛星 30 公尺的森林擾動圖，把 1986–2020 年每一塊林冠擾動歸成三類：樹皮甲蟲或風倒（技術上分不開，併成一類）、火、其他（多半是採伐，也含搶救性伐木與小規模的自然擾動，所以自然擾動的比例是低估）。這裡把 34 國各自的像素數加總，是 35 年合計，沒有逐年。作者提醒衛星圖會有錯；野火的面積跟野火主題的 GWIS 不同。',
    en: 'Each canopy disturbance patch in a 30 m Landsat-based forest disturbance map for 1986–2020 is attributed to one of three causes: bark beetle or windthrow (technically inseparable, so combined), fire, or other (mostly harvest, but also salvage logging and small natural disturbances, so natural disturbance is underestimated). Pixel counts are summed for each of 34 countries over the whole 35 years, not year by year. The authors warn that satellite maps contain errors; fire areas differ from GWIS in the wildfire topic.',
  },
  indicators: [
    {
      id: 'disturbance-cause',
      label: { zh: '歐洲森林擾動的成因（1986–2020）', en: 'Causes of forest disturbance in Europe (1986–2020)' },
      description: {
        zh: '1986–2020 年各國森林擾動面積裡，樹皮甲蟲或風倒、火、其他（多半是採伐）各占多少。樹皮甲蟲或風倒：德國 40.8%、斯洛維尼亞與愛爾蘭 32.9%、摩爾多瓦 28.1%、瑞士 27.6%、英國 26.1%、捷克 26.0%、斯洛伐克 25.0%、法國 23.2%。火：希臘 54.6%、蒙特內哥羅 45.3%、北馬其頓 44.2%、阿爾巴尼亞 37.7%、西班牙 32.0%、葡萄牙 23.0%。其他（採伐）：芬蘭 99.4%、挪威 97.8%、瑞典 96.2%，波羅的海三國也都超過 94%。',
        en: 'Share of each country’s forest disturbance area in 1986–2020 attributed to bark beetle or windthrow, fire, and other causes (mostly harvest). Bark beetle or windthrow: Germany 40.8%, Slovenia and Ireland 32.9%, Moldova 28.1%, Switzerland 27.6%, the UK 26.1%, Czechia 26.0%, Slovakia 25.0%, France 23.2%. Fire: Greece 54.6%, Montenegro 45.3%, North Macedonia 44.2%, Albania 37.7%, Spain 32.0%, Portugal 23.0%. Other (harvest): Finland 99.4%, Norway 97.8%, Sweden 96.2%, and over 94% in all three Baltic states.',
      },
      unit: '%',
      file: 'disturbance-cause/{item}.json',
      dimension: {
        label: { zh: '成因', en: 'Cause' },
        options: [
          { id: 'natural', label: { zh: '樹皮甲蟲或風倒', en: 'Bark beetle or windthrow' } },
          { id: 'fire', label: { zh: '火', en: 'Fire' } },
          { id: 'other', label: { zh: '其他（多半是採伐）', en: 'Other (mostly harvest)' } },
        ],
        defaultOption: 'natural',
      },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 20, 30, 50] }, itemScales: { other: { type: 'sequential', thresholds: [50, 60, 70, 80, 90, 95] } } },
      format: (v) => fixed(v, 1) + '%',
      formatTick: (v) => v + '%',
      missing: { zh: '沒有資料（只有歐洲 34 國）', en: 'No data (34 European countries only)' },
    },
    {
      id: 'disturbance-area',
      label: { zh: '歐洲森林擾動的面積（1986–2020）', en: 'Forest disturbance area in Europe (1986–2020)' },
      description: {
        zh: '1986–2020 年 35 年合計被擾動（林冠被移除或受損）的森林面積，34 國合計約 4,241 萬公頃：瑞典 845 萬、芬蘭 665 萬、西班牙 361 萬、法國 312 萬、葡萄牙 227 萬、德國 204 萬、波蘭 192 萬、挪威 166 萬公頃（一個像素只會歸到一類）。',
        en: 'Total forest area disturbed (canopy removed or damaged) over the 35 years 1986–2020, about 42.4 million ha across 34 countries: Sweden 8.45 million, Finland 6.65 million, Spain 3.61 million, France 3.12 million, Portugal 2.27 million, Germany 2.04 million, Poland 1.92 million, Norway 1.66 million ha (each pixel is attributed to one class).',
      },
      unit: { zh: '公頃', en: 'ha' },
      file: 'disturbance-area.json',
      layer: { kind: 'bubble', legendValues: [1e5, 1e6, 5e6] },
      format: (v) => tr({ zh: formatLargeNumber(v) + ' 公頃', en: formatLargeNumber(v) + ' ha' }),
      formatTick: formatLargeTick,
      missing: { zh: '沒有資料（只有歐洲 34 國）', en: 'No data (34 European countries only)' },
    },
  ],
};
