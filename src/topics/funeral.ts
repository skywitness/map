import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ListPanelDef, ListRow, PointRecord, TopicDefinition } from './types';

/**
 * 喪葬與墓地（新主題，2026-11-07，製作手冊第二十七批 555，候選 1250、1251；pipeline/topics/funeral.py）：
 * OpenStreetMap（經 QLever）的墓地（landuse=cemetery）、墓園（amenity=grave_yard）、殯葬業者（shop／office=funeral_directors）
 * 每十萬人（只替 OSM 覆蓋良好的國家上色），火葬場（amenity=crematorium）的點與各國座數，以及每 100 處墓地有幾座火葬場。
 */

function crematoriumName(p: PointRecord): { title: string; proper?: string } {
  const n = String(p.n ?? '');
  const zh = String(p.nz ?? '');
  const en = String(p.ne ?? '');
  const unnamed = tr({ zh: '（沒有名稱的火葬場）', en: '(unnamed crematorium)' });
  if (getLang() === 'zh') return zh ? { title: zh, proper: n && n !== zh ? n : undefined } : { title: n || unnamed };
  return en ? { title: en, proper: n && n !== en ? n : undefined } : { title: n || unnamed };
}

/** 每十萬人：10 以上寫整數，以下寫一位小數 */
const per100k = (unit: Text) => (v: number) =>
  tr({ zh: `每十萬人 ${fixed(v, v >= 10 ? 0 : 1)} ${tr(unit, 'zh')}`, en: `${fixed(v, v >= 10 ? 0 : 1)} per 100,000` });
const tick = (v: number) => fixed(v, Number.isInteger(v) ? 0 : v < 0.1 ? 2 : 1);

const OSM_NOTE: Text = {
  zh: '資料是 OpenStreetMap 上的標記，2026 年 11 月經 QLever 依國界計數（© OpenStreetMap contributors，資料檔依 ODbL 1.0 分享），不是官方名錄：同時在量 OpenStreetMap 畫得多完整。',
  en: 'Data are OpenStreetMap tags, counted by country via QLever in November 2026 (© OpenStreetMap contributors; the data files are shared under ODbL 1.0). This is not an official register, and the counts also reflect how completely OpenStreetMap is mapped.',
};
const COVERAGE_NOTE: Text = {
  zh: '照網站的規則只替 OpenStreetMap 覆蓋良好的 93 國上色（用餐飲店對餐飲業就業人數判斷），人口是聯合國 WPP 2024，人口不到 10 萬的不畫。',
  en: 'Following the site’s rule, only the 93 countries where OpenStreetMap is well mapped are coloured (judged by food and drink places against food-service employment); population is from UN WPP 2024, and countries under 100,000 people are not shown.',
};
const join = (...parts: Text[]): Text => ({
  zh: parts.map((p) => tr(p, 'zh')).join(''),
  en: parts.map((p) => tr(p, 'en')).join(' '),
});

const LIST: ListPanelDef = {
  label: { zh: '火葬場', en: 'Crematoria' },
  indicators: ['crematoria-count', 'crematoria-ratio'],
  file: 'crematoria.json',
  countryField: 'iso3',
  rows: (points) =>
    [...points]
      .filter((p) => p.n || p.nz || p.ne)
      .map((p) => ({ p, name: crematoriumName(p) }))
      .sort((a, b) => a.name.title.localeCompare(b.name.title, getLang() === 'zh' ? 'zh-Hant' : 'en'))
      .map(({ p, name }, i): ListRow => ({
        key: `crem-${i}`,
        title: name.title,
        lines: name.proper ? [name.proper] : [],
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 14 },
      })),
};

export const funeral: TopicDefinition = {
  id: 'funeral',
  title: { zh: '喪葬與墓地：墓地、火葬場與殯葬業', en: 'Funerals and cemeteries: cemeteries, crematoria and funeral directors' },
  shortTitle: { zh: '喪葬與墓地', en: 'Funerals' },
  defaultIndicator: 'cemeteries',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: { zh: 'OpenStreetMap 貢獻者（經 QLever 查詢，2026 年 11 月）', en: 'OpenStreetMap contributors (queried via QLever, November 2026)' },
      url: 'https://www.openstreetmap.org/copyright',
      license: 'ODbL',
    },
    {
      name: { zh: '聯合國《世界人口展望 2024》（每十萬人的分母）', en: 'UN World Population Prospects 2024 (population for the rates)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  note: {
    zh: 'OpenStreetMap 上標成墓地（landuse=cemetery）、墓園（amenity=grave_yard，多半在教堂、寺院旁）、火葬場（amenity=crematorium）與殯葬業者（shop=funeral_directors 或 office=funeral_directors）的地方，2026 年 11 月的快照（© OpenStreetMap contributors，資料檔依 ODbL 1.0 分享），不是官方名錄。墓地與墓園是兩個標籤，同一處可能兩個都標，所以不相加；處數也不是面積。東亞的家族墓、納骨塔多半沒畫進 OpenStreetMap，台灣一定低估。火葬場也不全：日本畫了 307 座、實際有 1,400 多處，台灣畫了 22 座、實際有 30 多座公立火化場，有的火化場把每一座爐、甚至金爐各標一個；只能看各國之間的大致差異，不能當設施普查。墓地、墓園與殯葬業的每十萬人只替 OpenStreetMap 覆蓋良好的國家上色（判準跟「外食與喝一杯」相同）。各國的火葬率沒有可以轉載的資料（火葬協會的統計禁止轉載），這裡用火葬場對墓地的比值看大概的方向。',
    en: 'Places tagged on OpenStreetMap as cemeteries (landuse=cemetery), graveyards (amenity=grave_yard, mostly beside a church or temple), crematoria (amenity=crematorium) and funeral directors (shop=funeral_directors or office=funeral_directors), as of November 2026 (© OpenStreetMap contributors; the data files are shared under ODbL 1.0). This is not an official register. Cemeteries and graveyards are separate tags, and one place may carry both, so they are not added together; counts are not areas either. Family tombs and columbaria in East Asia are mostly not mapped, so Taiwan is certainly undercounted. Crematoria are incomplete too: Japan has 307 on the map against more than 1,400 in reality, and Taiwan 22 against more than 30 public crematoria, while some sites tag each furnace, or even a joss-paper burner, separately. Use them for broad differences between countries, not as a facility census. Cemeteries, graveyards and funeral directors per 100,000 people are shown only where OpenStreetMap is reasonably complete (the same test as the Eating out topic). Cremation rates by country are not available under terms that allow republishing (the Cremation Society’s statistics may not be reproduced), so the ratio of crematoria to cemeteries is used as a rough guide instead.',
  },
  listPanel: LIST,
  overlays: [
    {
      kind: 'points',
      id: 'crematoria',
      file: 'crematoria.json',
      indicators: ['crematoria-count', 'crematoria-ratio'],
      label: { zh: '火葬場', en: 'Crematoria' },
      radius: 3,
      color: MAP_TOKENS.categorical[6],
      tooltip: (p, { countryName }) => {
        const { title, proper } = crematoriumName(p);
        return { title, extra: [typeof p.iso3 === 'string' && p.iso3 ? countryName(p.iso3) : ''].filter(Boolean), properNoun: proper };
      },
    },
  ],
  indicators: [
    {
      id: 'cemeteries',
      label: { zh: '每十萬人幾處墓地', en: 'Cemeteries per 100,000 people' },
      description: join(
        OSM_NOTE,
        {
          zh: '墓地是 landuse=cemetery，全世界 OpenStreetMap 上約 60.2 萬處：美國 13.5 萬、法國 4.1 萬、俄羅斯 3.6 萬、德國 3.3 萬、烏克蘭 2.7 萬、日本 2.1 萬。每十萬人波士尼亞與赫塞哥維納 144、拉脫維亞 139、白俄羅斯 124、蒙特內哥羅 120、立陶宛 108 最多，法國 62、德國 39、美國 39、南韓 29、義大利 27、日本 17、英國 11、台灣 10（2,369 處）、瑞典 9.0，新加坡 0.4。',
          en: 'Cemeteries are landuse=cemetery; OpenStreetMap has about 602,000 worldwide: 135,000 in the US, 41,000 in France, 36,000 in Russia, 33,000 in Germany, 27,000 in Ukraine and 21,000 in Japan. Per 100,000 people Bosnia and Herzegovina (144), Latvia (139), Belarus (124), Montenegro (120) and Lithuania (108) have the most, followed by France 62, Germany 39, the US 39, South Korea 29, Italy 27, Japan 17, the UK 11, Taiwan 10 (2,369 cemeteries), Sweden 9.0 and Singapore 0.4.',
        },
        COVERAGE_NOTE,
      ),
      unit: { zh: '處／十萬人', en: 'per 100,000' },
      file: 'cemeteries.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 40, 70, 100] } },
      format: per100k({ zh: '處', en: '' }),
      formatTick: tick,
    },
    {
      id: 'grave-yards',
      label: { zh: '每十萬人幾處墓園', en: 'Graveyards per 100,000 people' },
      description: join(
        OSM_NOTE,
        {
          zh: '墓園是 amenity=grave_yard，多半是教堂、寺院旁的小墓地，跟墓地是兩個標籤、不相加；全世界約 16.0 萬處，美國 6.3 萬、英國 1.5 萬、日本 1.4 萬。每十萬人愛爾蘭 64 最多，蒙特內哥羅 36、盧森堡 29、希臘 29、瑞典 23、英國 21、美國 18、法國 12、日本 12、德國 8.3、台灣 4.8（1,097 處）、南韓 3.3。',
          en: 'Graveyards are amenity=grave_yard, mostly small burial grounds beside a church or temple; this is a separate tag from cemeteries and the two are not added. OpenStreetMap has about 160,000 worldwide: 63,000 in the US, 15,000 in the UK and 14,000 in Japan. Per 100,000 people Ireland has the most at 64, followed by Montenegro 36, Luxembourg 29, Greece 29, Sweden 23, the UK 21, the US 18, France 12, Japan 12, Germany 8.3, Taiwan 4.8 (1,097) and South Korea 3.3.',
        },
        COVERAGE_NOTE,
      ),
      unit: { zh: '處／十萬人', en: 'per 100,000' },
      file: 'grave-yards.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 3, 6, 10, 20, 30] } },
      format: per100k({ zh: '處', en: '' }),
      formatTick: tick,
    },
    {
      id: 'crematoria-count',
      label: { zh: '火葬場', en: 'Crematoria' },
      description: join(OSM_NOTE, {
        zh: '火葬場是 amenity=crematorium（點，各國座數是比例圓），全世界 3,601 座、106 國。泰國 559 座最多（寺廟幾乎都附火葬場），印度 385、英國 311、日本 307、法國 235、美國 234、德國 142、荷蘭 111、中國大陸 110、西班牙 107；南韓 25、台灣 22、新加坡 11、香港 6。OpenStreetMap 明顯不全（日本實際 1,400 多處），只能看大致的差異。點國家看那一國有名稱的火葬場。',
        en: 'Crematoria are amenity=crematorium (dots; bubbles show the count per country): 3,601 in 106 countries. Thailand has the most at 559 (nearly every temple has one), followed by India 385, the UK 311, Japan 307, France 235, the US 234, Germany 142, the Netherlands 111, mainland China 110 and Spain 107; South Korea 25, Taiwan 22, Singapore 11 and Hong Kong 6. OpenStreetMap is clearly incomplete (Japan really has more than 1,400), so only broad differences are meaningful. Select a country for its named crematoria.',
      }),
      unit: { zh: '座', en: 'crematoria' },
      file: 'crematoria-count.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 500] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 座`, en: fixed(v, 0) }),
      integer: true,
    },
    {
      id: 'crematoria-ratio',
      label: { zh: '每 100 處墓地有幾座火葬場', en: 'Crematoria per 100 cemeteries' },
      description: join(OSM_NOTE, {
        zh: '火葬場的座數除以墓地的處數（× 100），看一國的喪葬偏火葬還是土葬；同一國兩個標籤畫得一樣完整時，比值比各自的密度穩定，所以不套覆蓋度的規則，改成 OpenStreetMap 上墓地至少 200 處才畫（108 國）。全世界是 0.60。泰國 115（火葬場比墓地還多），印度 19、緬甸 6.8、英國 3.9、斯里蘭卡 3.2、荷蘭 2.7、瑞典 2.2、中國大陸 1.8、日本 1.5、台灣 0.93，法國 0.57、德國 0.43、義大利 0.31、美國 0.17、南韓 0.17、俄羅斯 0.12。土耳其、埃及、伊拉克、以色列、塞爾維亞、喬治亞等 31 國一座都沒有（伊斯蘭、猶太教的傳統與東正教會都反對火葬）。日本、台灣、南韓實際上九成以上火化，比值低是因為火葬場集中、少而大，墓地也包括納骨的靈園，所以這不是火葬率。',
        en: 'The number of crematoria divided by the number of cemeteries (× 100), a rough sign of whether a country leans towards cremation or burial. Where both tags are mapped about equally well within a country, the ratio is steadier than either density, so the coverage rule is not applied; instead countries need at least 200 cemeteries on OpenStreetMap (108 countries). The world figure is 0.60. Thailand has 115 (more crematoria than cemeteries), India 19, Myanmar 6.8, the UK 3.9, Sri Lanka 3.2, the Netherlands 2.7, Sweden 2.2, mainland China 1.8, Japan 1.5 and Taiwan 0.93; France 0.57, Germany 0.43, Italy 0.31, the US 0.17, South Korea 0.17 and Russia 0.12. Thirty-one countries, including Türkiye, Egypt, Iraq, Israel, Serbia and Georgia, have none (Islamic and Jewish tradition and the Orthodox Church oppose cremation). Japan, Taiwan and South Korea in fact cremate more than 90% of their dead; their ratios are low because crematoria there are few and large, and cemeteries include columbarium parks, so this is not a cremation rate.',
      }),
      unit: { zh: '座／百處墓地', en: 'per 100 cemeteries' },
      file: 'crematoria-ratio.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [0.05, 0.2, 0.4, 1, 3, 10] } },
      format: (v) =>
        tr({
          zh: `每 100 處墓地 ${fixed(v, v === 0 || v >= 10 ? 0 : v >= 1 ? 1 : 2)} 座火葬場`,
          en: `${fixed(v, v === 0 || v >= 10 ? 0 : v >= 1 ? 1 : 2)} per 100 cemeteries`,
        }),
      formatTick: tick,
    },
    {
      id: 'funeral-homes',
      label: { zh: '每十萬人幾家殯葬業者', en: 'Funeral directors per 100,000 people' },
      description: join(
        OSM_NOTE,
        {
          zh: '殯葬業者是 shop=funeral_directors 或 office=funeral_directors（同一處只算一次），全世界約 3.5 萬家：美國 5,750、德國 3,829、法國 3,422、英國 3,021、日本 2,528。每十萬人愛爾蘭 5.5、白俄羅斯 5.2、法國 5.1、德國 4.6、英國 4.3、比利時 4.2 最多，義大利 2.3、日本 2.1、美國 1.7，台灣 0.4（89 家）、南韓 0.4：台灣的禮儀社在 OpenStreetMap 上畫得很少。',
          en: 'Funeral directors are shop=funeral_directors or office=funeral_directors (each place counted once); OpenStreetMap has about 35,000 worldwide: 5,750 in the US, 3,829 in Germany, 3,422 in France, 3,021 in the UK and 2,528 in Japan. Per 100,000 people Ireland (5.5), Belarus (5.2), France (5.1), Germany (4.6), the UK (4.3) and Belgium (4.2) have the most, followed by Italy 2.3, Japan 2.1 and the US 1.7; Taiwan 0.4 (89) and South Korea 0.4. Few of Taiwan’s funeral parlours are on OpenStreetMap.',
        },
        COVERAGE_NOTE,
      ),
      unit: { zh: '家／十萬人', en: 'per 100,000' },
      file: 'funeral-homes.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.25, 0.5, 1, 2, 3, 4] } },
      format: per100k({ zh: '家', en: '' }),
      formatTick: tick,
    },
  ],
};
