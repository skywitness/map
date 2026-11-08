import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { WATER_LIST, WATER_PARKS_PER_100K, WATER_VISITORS } from './attractions-visitors';
import type { TopicDefinition } from './types';
import { withTerritories } from './osm-territories';

/**
 * 水上樂園（新主題，2026-11-08，製作手冊第二十七批 636，候選 1378；pipeline/topics/water_parks.py 與 attractions_visitors.py）：
 * 景點地圖的水上樂園人次（英文維基轉載 TEA／AECOM 的五張區域排名）與 OSM 的水上樂園搬過來，資料照舊在 ../attractions/；
 * 新加 OSM 的各國處數。舊網址 t/attractions/?ind=water-parks 轉到這裡（指標 id 不變）（redirects.ts 的 INDICATOR_MOVES）。
 */
export const waterParks: TopicDefinition = {
  id: 'water-parks',
  title: { zh: '水上樂園', en: 'Water parks' },
  shortTitle: { zh: '水上樂園', en: 'Water parks' },
  defaultIndicator: 'visitors',
  defaultYear: 2024,
  sources: [
    {
      name: { zh: '英文維基百科「List of amusement park rankings」的水上樂園排名（TEA／AECOM 的人次）', en: 'English Wikipedia, “List of amusement park rankings”, water park rankings (TEA/AECOM attendance)' },
      url: 'https://en.wikipedia.org/wiki/List_of_amusement_park_rankings?oldid=1377863670',
      license: 'CC BY-SA 4.0',
    },
    { name: { zh: 'Wikidata（水上樂園的位置）', en: 'Wikidata (water park locations)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
    {
      name: { zh: 'OpenStreetMap 的水上樂園（leisure=water_park），經 QLever，2026 年 11 月', en: 'OpenStreetMap water parks (leisure=water_park), via QLever, November 2026' },
      url: 'https://www.openstreetmap.org/copyright',
      license: { zh: 'ODbL 1.0，© OpenStreetMap 貢獻者', en: 'ODbL 1.0, © OpenStreetMap contributors' },
    },
  ],
  note: withTerritories({
    zh: '人次是 TEA／AECOM 的估計，經英文維基轉載（TEA 的報告本身不能用），2021、2022 年 TEA 沒有發水上樂園的排名，2020 年人次因疫情腰斬；世界前 20 有不少是歐洲的溫泉水療複合體（Therme），跟亞洲、美洲的戶外水上樂園不是同一種設施。各國的處數是 OpenStreetMap 標成 leisure=water_park 的地方：德國人把有滑水道的市立泳池（Erlebnisbad、Spaßbad）也這樣標，所以德國特別多；每十萬人只替 OSM 覆蓋良好的國家上色。五張排名表都沒有台灣的水上樂園。',
    en: 'Attendance figures are TEA/AECOM estimates as reproduced on English Wikipedia (the TEA reports themselves cannot be used); TEA published no water park rankings for 2021 and 2022, and 2020 attendance was halved by the pandemic. Many of the world top 20 are European thermal spa complexes (Therme), a different kind of facility from the outdoor water parks of Asia and the Americas. Country counts are places tagged leisure=water_park in OpenStreetMap: Germans also tag municipal pools with slides (Erlebnisbad, Spaßbad) this way, so Germany has especially many; rates per 100,000 people are shown only for countries well covered by OSM. None of Taiwan’s water parks appears in the five rankings.',
  }),
  overlays: [{ ...WATER_VISITORS, file: '../attractions/water-park-visitors.json' }],
  listPanel: [{ ...WATER_LIST, file: '../attractions/water-park-visitors.json' }],
  indicators: [
    {
      id: 'visitors',
      label: { zh: '最多人造訪的水上樂園', en: 'Most-visited water parks' },
      description: {
        zh: 'TEA／AECOM 五張水上樂園排名（世界前 20、北美前 20、拉丁美洲 10、亞太 20、歐洲中東非洲 10，經英文維基轉載）上找得到位置的 52 座水上樂園，點的大小是一年的人次，拖時間軸看 2009–2024 年。2024 年廣州長隆水上樂園 281 萬人次最多，杜拜 Aquaventure World 200 萬、德國 Therme Erding 191 萬、巴西 Thermas dos Laranjais 185 萬、迪士尼颱風灣 182 萬。52 座裡美國 18 座、巴西 5 座、中國 4 座（哈爾濱、鄭州、廈門的 3 座與巴西、南韓各 1 座找不到位置，沒畫）；五張表都沒有台灣。左邊的清單依人次列出。',
        en: 'The 52 water parks that can be located in TEA/AECOM’s five water park rankings (world top 20, North America top 20, Latin America 10, Asia-Pacific 20, and Europe, Middle East and Africa 10, as reproduced on English Wikipedia), sized by visitors a year; drag the time slider for 2009–2024. In 2024 Chimelong Water Park in Guangzhou led with 2.81 million visitors, ahead of Aquaventure World in Dubai (2.0 million), Therme Erding in Germany (1.91 million), Thermas dos Laranjais in Brazil (1.85 million) and Disney’s Typhoon Lagoon (1.82 million). 18 of the 52 are in the US, 5 in Brazil and 4 in China (three in Harbin, Zhengzhou and Xiamen and one each in Brazil and South Korea could not be located and are not shown); none of the rankings includes Taiwan. The list on the left ranks them by visitors.',
      },
      unit: '',
      file: '../attractions/visitors.json',
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      defaultYear: 2024,
      missing: { zh: '這個指標只有點，國家不上色', en: 'This indicator shows points only' },
    },
    {
      id: 'count',
      label: { zh: '各國有幾處水上樂園（OSM）', en: 'Water parks by country (OSM)' },
      description: {
        zh: 'OpenStreetMap 上標成水上樂園（leisure=water_park）的地方，全世界 13,330 處、171 個國家或地區：德國 3,159 處最多，美國 1,511、奧地利 640、巴西 526、法國 470、墨西哥 431；台灣 22 處。德國人把有滑水道的市立泳池也標成水上樂園，所以德國特別多。',
        en: 'Places tagged as water parks (leisure=water_park) on OpenStreetMap: 13,330 in 171 countries and territories. Germany has the most (3,159), followed by the US (1,511), Austria (640), Brazil (526), France (470) and Mexico (431); Taiwan has 22. Germans also tag municipal pools with slides as water parks, so Germany has especially many.',
      },
      unit: { zh: '處', en: 'places' },
      file: 'count.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 處`, en: `${fixed(v, 0)} places` }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    { ...WATER_PARKS_PER_100K, file: '../attractions/water-parks.json', label: { zh: '每十萬人有幾處水上樂園（OSM）', en: 'Water parks per 100,000 people (OSM)' } },
  ],
};
