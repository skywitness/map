import type { Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { IndicatorDef, ScaleSpec, TopicDefinition } from './types';

/**
 * 光害：人工夜空有多亮（新主題，2026-11-07，製作手冊第二十五批 489，候選 1152；環境的「污染與廢棄物」）：
 * Falchi 等人 2016 的人工夜空亮度地圖集（CC BY-NC 4.0，只准非商業），本機 session 在原始 30 角秒網格上分成論文 Fig. 10 的 6 級，
 * 配 GHS-POP 2015 年的 30 角秒人口，算各國人口與國土在各級的比例（pipeline/topics/light_pollution.py）。
 * 側欄 panels/LightPollutionPanel.tsx 是這一國人口與國土在 6 級的分布。
 */

/** 6 級（跟 pipeline 的分級檔一樣，人工亮度 μcd/m²） */
export const SKY_CLASSES: Text[] = [
  { zh: '原始夜空（人工光不到自然夜空的 1%）', en: 'Pristine (artificial light under 1% of natural)' },
  { zh: '比自然亮 1–8%', en: '1–8% above natural' },
  { zh: '比自然亮 8–50%', en: '8–50% above natural' },
  { zh: '比自然亮 50% 以上，還看得到銀河', en: 'Over 50% above natural, Milky Way still visible' },
  { zh: '看不到銀河', en: 'Milky Way hidden' },
  { zh: '亮到眼睛無法暗適應', en: 'Too bright for night-adapted vision' },
];

const percent = (v: number) => `${fixed(v, 1)}%`;
const tick = (v: number) => `${v}%`;

const NC_NOTE = {
  zh: '只准非商業使用（CC BY-NC 4.0），這個主題的資料檔也用同一種授權',
  en: 'non-commercial use only (CC BY-NC 4.0); the data files of this topic are shared under the same licence',
};

const share = (
  id: string,
  label: Text,
  description: Text,
  thresholds: number[],
): IndicatorDef => ({
  id,
  label,
  description,
  unit: '%',
  file: `${id}.json`,
  layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds } satisfies ScaleSpec },
  format: percent,
  formatTick: tick,
  compareWorld: true,
});

export const lightPollution: TopicDefinition = {
  id: 'light-pollution',
  title: { zh: '光害：人工夜空有多亮', en: 'Light pollution: how bright the night sky is' },
  shortTitle: { zh: '光害', en: 'Light pollution' },
  defaultIndicator: 'milky-way-pop',
  defaultYear: 2015,
  timeless: true,
  sources: [
    {
      name: {
        zh: 'Falchi 等人（2016）：Supplement to: The New World Atlas of Artificial Night Sky Brightness（GFZ Data Services，doi:10.5880/GFZ.1.4.2016.001；從原始 30 角秒網格分成 6 級）',
        en: 'Falchi et al. (2016): Supplement to: The New World Atlas of Artificial Night Sky Brightness (GFZ Data Services, doi:10.5880/GFZ.1.4.2016.001; classified into six levels at the original 30″ resolution)',
      },
      url: 'https://doi.org/10.5880/GFZ.1.4.2016.001',
      license: NC_NOTE,
    },
    {
      name: {
        zh: 'Falchi 等人（2016）：The new world atlas of artificial night sky brightness，Science Advances 2(6)，e1600377（分級的門檻）',
        en: 'Falchi et al. (2016): The new world atlas of artificial night sky brightness, Science Advances 2(6), e1600377 (class thresholds)',
      },
      url: 'https://doi.org/10.1126/sciadv.1600377',
      license: 'CC BY-NC 4.0',
    },
    {
      name: {
        zh: 'European Commission, JRC：GHS-POP R2023A（2015 年，30 角秒網格人口）',
        en: 'European Commission, JRC: GHS-POP R2023A (2015, 30″ population grid)',
      },
      url: 'https://human-settlement.emergency.copernicus.eu/ghs_pop2023.php',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: 'Falchi 等人 2016 年的《新世界人工夜空亮度地圖集》用 2014 年的 VIIRS 衛星夜間燈光，加上光在大氣裡散射的模式，算出每個 30 角秒（約 1 公里）格子天頂的人工亮度，涵蓋北緯 85° 到南緯 60°（沒有南極洲），是凌晨 1 點衛星經過時的狀況，傍晚更亮。這裡照論文的 6 級分級：人工亮度不到自然夜空（174 μcd/m²）的 1%（1.74 μcd/m²）是原始夜空；14 μcd/m²（自然的 8%）以上算光污染；688 μcd/m²（約自然的 4 倍）以上看不到銀河；3,000 μcd/m² 以上亮到眼睛無法暗適應。各國的比例是本站把分級網格疊上歐盟 JRC 的 GHS-POP 2015 年人口網格與地圖的國界算的，跟論文的表格差一點（論文用別的人口資料）；國界用 1:50m，聖馬利諾、馬爾他這類很小的國家誤差比較大。衛星資料是 2014 年 6 個月的平均。論文也提醒：VIIRS 對藍光不敏感，路燈改成白光 LED 以後增加的光害，衛星看不出來。',
    en: 'The New World Atlas of Artificial Night Sky Brightness by Falchi et al. (2016) uses 2014 VIIRS night-time satellite imagery and a model of how light scatters in the atmosphere to estimate the artificial brightness of the zenith sky for every 30″ (about 1 km) cell from 85°N to 60°S (Antarctica is not covered), at 1 a.m. when the satellite passes; early evenings are brighter. The six levels follow the paper: artificial brightness below 1% of the natural night sky (174 μcd/m²), i.e. 1.74 μcd/m², is pristine; 14 μcd/m² (8% of natural) or more counts as light-polluted; at 688 μcd/m² (about four times natural) or more the Milky Way is hidden; above 3,000 μcd/m² the eye cannot adapt to the dark. The country shares are computed by this site by overlaying the classified grid on the JRC GHS-POP 2015 population grid and the map’s borders, so they differ slightly from the paper’s tables (which used other population data); with 1:50m borders, very small countries such as San Marino and Malta are less precise. The satellite data are an average of six months of 2014. The paper also cautions that VIIRS is not sensitive to blue light, so the extra light pollution from switching street lights to white LEDs does not show up in the satellite data.',
  },
  panelExtra: () => import('./panels/LightPollutionPanel'),
  indicators: [
    share(
      'milky-way-pop',
      { zh: '看不到銀河的人口比例', en: 'People who cannot see the Milky Way' },
      {
        zh: '住在人工夜空亮度 688 μcd/m²（約自然夜空的 4 倍）以上、在家看不到銀河的人口比例。世界 37.4%。新加坡、巴林、摩納哥、香港、科威特、卡達接近 100%；台灣 95.8%，南韓 90.0%、英國 76.2%、美國 75.2%、日本 69.7%、法國 60.9%、德國 40.3%、中國 34.6%、印度 22.3%；中非、馬達加斯加、南蘇丹是 0%。',
        en: 'Share of people living where artificial sky brightness is 688 μcd/m² (about four times natural) or more, so the Milky Way cannot be seen from home. World 37.4%. Singapore, Bahrain, Monaco, Hong Kong, Kuwait and Qatar are close to 100%; Taiwan 95.8%, South Korea 90.0%, the UK 76.2%, the US 75.2%, Japan 69.7%, France 60.9%, Germany 40.3%, China 34.6% and India 22.3%; the Central African Republic, Madagascar and South Sudan 0%.',
      },
      [5, 20, 40, 60, 80, 95],
    ),
    share(
      'polluted-pop',
      { zh: '住在光污染下的人口比例', en: 'People under light-polluted skies' },
      {
        zh: '住在人工夜空亮度 14 μcd/m²（自然夜空的 8%）以上的人口比例，論文把這個程度以上算光污染。世界 85.3%；台灣、南韓、德國、法國都是 100%，日本 99.9%、美國 99.7%、印度 94.8%、中國 90.4%；最低的是紐埃、托克勞這類太平洋小島（0%），以及南蘇丹 10.7%、蒲隆地 12.3%。',
        en: 'Share of people living where artificial sky brightness is 14 μcd/m² (8% of natural) or more, the level the paper counts as light-polluted. World 85.3%; Taiwan, South Korea, Germany and France 100%, Japan 99.9%, the US 99.7%, India 94.8% and China 90.4%; the lowest are small Pacific islands such as Niue and Tokelau (0%), South Sudan 10.7% and Burundi 12.3%.',
      },
      [20, 40, 60, 80, 95, 99.5],
    ),
    share(
      'pristine-pop',
      { zh: '住在原始夜空下的人口比例', en: 'People under pristine skies' },
      {
        zh: '住在人工光不到自然夜空 1%（1.74 μcd/m²）、幾乎沒有光害的地方的人口比例。世界 7.2%；除了錫亞琴冰川與托克勞、紐埃這類人很少的地方，南蘇丹 79.0%、中非 76.6%、索羅門群島 75.9%、馬達加斯加 73.5%、查德 72.6% 最高；台灣、日本、南韓、美國、德國、法國、英國都是 0%，中國 0.8%。',
        en: 'Share of people living where artificial light is below 1% of the natural night sky (1.74 μcd/m²), with almost no light pollution. World 7.2%; apart from sparsely populated places such as the Siachen Glacier, Tokelau and Niue, the highest are South Sudan 79.0%, the Central African Republic 76.6%, the Solomon Islands 75.9%, Madagascar 73.5% and Chad 72.6%; Taiwan, Japan, South Korea, the US, Germany, France and the UK 0%, China 0.8%.',
      },
      [0.1, 1, 5, 20, 40, 60],
    ),
    share(
      'milky-way-area',
      { zh: '看不到銀河的國土比例', en: 'Land where the Milky Way is hidden' },
      {
        zh: '國土裡人工夜空亮度 688 μcd/m² 以上、看不到銀河的面積比例。世界的陸地 1.3%。梵蒂岡、摩納哥、新加坡、澳門、直布羅陀 100%，巴林 96.2%、香港 96.1%、馬爾他 81.0%、聖馬利諾 80.5%、荷屬聖馬丁 70.8%、巴勒斯坦 60.8%、卡達 52.9%、科威特 52.7%、比利時 52.0%；台灣 31.5%，南韓 19.3%、英國 13.8%、日本 7.3%、美國 4.2%。',
        en: 'Share of a country’s land where artificial sky brightness is 688 μcd/m² or more and the Milky Way is hidden. World land 1.3%. Vatican City, Monaco, Singapore, Macao and Gibraltar 100%, Bahrain 96.2%, Hong Kong 96.1%, Malta 81.0%, San Marino 80.5%, Sint Maarten 70.8%, Palestine 60.8%, Qatar 52.9%, Kuwait 52.7% and Belgium 52.0%; Taiwan 31.5%, South Korea 19.3%, the UK 13.8%, Japan 7.3% and the US 4.2%.',
      },
      [0.1, 1, 5, 10, 25, 50],
    ),
    share(
      'pristine-area',
      { zh: '夜空原始的國土比例', en: 'Land with pristine night skies' },
      {
        zh: '國土裡人工光不到自然夜空 1% 的面積比例。世界的陸地（北緯 85° 到南緯 60°）57.8%。除了錫亞琴冰川與皮特肯群島、法屬南方領地、紐埃這類人很少的地方，格陵蘭、中非 99.7%、索馬利亞 98.8%、茅利塔尼亞 98.6%、南蘇丹 98.5%、澳洲 88.7%、中國 44.4%、美國 23.6%；台灣、南韓、德國、法國是 0%，日本 0.2%。',
        en: 'Share of a country’s land where artificial light is below 1% of the natural night sky. World land (85°N to 60°S) 57.8%. Apart from sparsely populated places such as the Siachen Glacier, the Pitcairn Islands, the French Southern Territories and Niue, Greenland and the Central African Republic 99.7%, Somalia 98.8%, Mauritania 98.6%, South Sudan 98.5%, Australia 88.7%, China 44.4% and the US 23.6%; Taiwan, South Korea, Germany and France 0%, Japan 0.2%.',
      },
      [1, 10, 25, 50, 75, 95],
    ),
  ],
};
