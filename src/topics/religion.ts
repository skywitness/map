import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { religionExtra } from './religion-extra';
import type { CategoryDef, IndicatorDef, ScaleSpec, TopicDefinition } from './types';

/**
 * 宗教：Pew Research Center 2010、2020 年的宗教組成。
 * Pew 的條款只允許發布摘錄，所以沒有七大類各自的比例（見 pipeline/sources/pew.py 與 DESIGN.md）。
 */

/** 主要宗教的類別代碼（跟 pipeline/topics/religion.py 的 CODES 一致） */
const RELIGIONS: CategoryDef[] = [
  { value: 1, label: { zh: '基督宗教', en: 'Christian' } },
  { value: 2, label: { zh: '伊斯蘭教', en: 'Muslim' } },
  { value: 3, label: { zh: '無宗教信仰', en: 'Religiously unaffiliated' } },
  { value: 4, label: { zh: '印度教', en: 'Hindu' } },
  { value: 5, label: { zh: '佛教', en: 'Buddhist' } },
  { value: 6, label: { zh: '猶太教', en: 'Jewish' } },
  { value: 7, label: { zh: '其他宗教（民間信仰、道教等）', en: 'Other religions (folk religions, Taoism, etc.)' } },
];
const religionLabel = (v: number) => tr(RELIGIONS.find((r) => r.value === v)?.label ?? '');

/** 2026-11-07（製作手冊 553）：OSM 禮拜場所的宗教（pipeline/topics/worship.py 的 GROUPS） */
const WORSHIP: CategoryDef[] = [
  { value: 1, label: { zh: '基督宗教', en: 'Christian' } },
  { value: 2, label: { zh: '伊斯蘭', en: 'Muslim' } },
  { value: 3, label: { zh: '佛教', en: 'Buddhist' } },
  { value: 4, label: { zh: '印度教', en: 'Hindu' } },
  { value: 5, label: { zh: '神道', en: 'Shinto' } },
  { value: 6, label: { zh: '道教與民間信仰', en: 'Taoist and folk' } },
  { value: 7, label: { zh: '猶太教', en: 'Jewish' } },
  { value: 8, label: { zh: '其他', en: 'Other' } },
];
const OSM_NOTE = {
  zh: '資料是 OpenStreetMap 標成禮拜場所（amenity=place_of_worship）的地點，經 QLever 依國界計數；包括已經不用的建築，也同時在量 OpenStreetMap 畫得多完整。',
  en: 'Data are places tagged as places of worship (amenity=place_of_worship) on OpenStreetMap, counted by country via QLever; disused buildings are included, and the counts also reflect how completely OpenStreetMap is mapped.',
};
const pct = (v: number) => `${fixed(v, v < 10 ? 1 : 0)}%`;

/**
 * 2026-11-07（製作手冊第二十七批 554，候選 1248、1249）：V-Dem 的宗教自由與宗教組織（pipeline/topics/religion_vdem.py），
 * 1789–2025 年。測量模型的估計值是區間尺度（約 −4 到 +3），不是 0–1 指數，門檻另外定；
 * 「說不說得上話」高分不等於好（伊朗的神權體制分數高），用單色漸層、不用紅藍的好壞配色
 */
const VDEM_UNIT = { zh: 'V-Dem 估計值', en: 'V-Dem estimate' };
const vdemValue = (v: number) => {
  const s = fixed(Math.abs(v), 2);
  return v < 0 && s !== fixed(0, 2) ? `−${s}` : s;
};
const vdemTick = (v: number) => `${v < 0 ? '−' : ''}${fixed(Math.abs(v), Number.isInteger(v) ? 0 : 1)}`;
const VDEM_DIVERGING: ScaleSpec = { type: 'diverging', thresholds: [-2, -1, -0.5, 0.5, 1, 2] };
const VDEM_TAIL = {
  zh: 'V-Dem 依各國專家的評分用測量模型估計，1789 年起；0 大約是所有國家年份的平均；點國家看 68% 可信區間與歷年變化。',
  en: 'V-Dem estimates it from country experts’ ratings with a measurement model, from 1789; 0 is roughly the average of all country-years; click a country for the 68% credible interval and the trend over time.',
};

function vdem(id: string, label: IndicatorDef['label'], about: { zh: string; en: string }, scale: ScaleSpec): IndicatorDef {
  return {
    id,
    label,
    description: { zh: `${about.zh}${VDEM_TAIL.zh}`, en: `${about.en} ${VDEM_TAIL.en}` },
    unit: VDEM_UNIT,
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale },
    format: vdemValue,
    formatTick: vdemTick,
    defaultYear: 2025,
  };
}

const DISCLAIMER = 'Pew Research Center bears no responsibility for the analyses or interpretations of the data presented here.';

export const religion: TopicDefinition = {
  id: 'religion',
  title: { zh: '各國宗教', en: 'Religion by country' },
  shortTitle: { zh: '宗教', en: 'Religion' },
  defaultIndicator: 'main',
  defaultYear: 2020,
  sources: [
    {
      name: { zh: 'OpenStreetMap 的禮拜場所（amenity=place_of_worship），經 QLever', en: 'OpenStreetMap places of worship (amenity=place_of_worship), via QLever' },
      url: 'https://www.openstreetmap.org/copyright',
      license: { zh: 'ODbL 1.0（© OpenStreetMap contributors）', en: 'ODbL 1.0 (© OpenStreetMap contributors)' },
    },
    {
      name: {
        zh: 'Pew Research Center, Religious Composition 2010–2020（摘錄）',
        en: 'Pew Research Center, Religious Composition 2010–2020 (excerpts)',
      },
      url: 'https://www.pewresearch.org/religion/feature/religious-composition-by-country-2010-2020/',
      license: { zh: 'Pew 使用條款（只限摘錄）', en: 'Pew terms of use (excerpts only)' },
    },
    {
      name: 'Coppedge, Michael, John Gerring, Carl Henrik Knutsen, Staffan I. Lindberg, Jan Teorell, David Altman, et al. 2026. "V-Dem Country-Year Dataset v16". Varieties of Democracy (V-Dem) Project',
      url: 'https://doi.org/10.23696/vdemds26',
      license: { zh: 'CC BY-SA 4.0（宗教自由與宗教組織三項；衍生的資料檔也用 CC BY-SA 4.0）', en: 'CC BY-SA 4.0 (the three religious freedom and religious organization indicators; derived data files are shared under CC BY-SA 4.0 too)' },
    },
    {
      name: { zh: 'Eurostat：一般政府依職能分類的支出（gov_10a_exp，COFOG 08）與 GDP（nama_10_gdp）', en: 'Eurostat: general government expenditure by function (gov_10a_exp, COFOG 08) and GDP (nama_10_gdp)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/gov_10a_exp/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '內政部宗教統計（寺廟、教會登記）', en: 'Ministry of the Interior (Taiwan), religious statistics' },
      url: 'https://statis.moi.gov.tw/micst/webMain.aspx?sys=100&funid=defjsp',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
    ...religionExtra.sources,
  ],
  overlays: religionExtra.overlays,
  listPanel: religionExtra.listPanel,
  panelExtra: () => import('./panels/ReligionPanel'),
  note: {
    zh:
      'Pew 依 2,700 多份普查與調查估計 201 個國家與地區的宗教組成，分成基督宗教（天主教、基督新教、東正教等）、伊斯蘭教、無宗教信仰、印度教、佛教、猶太教與其他宗教（民間信仰、道教、神道教、錫克教、巴哈伊教等）七大類，只有 2010、2020 兩年。' +
      'Pew 的使用條款只允許發布摘錄，所以這裡只有主要宗教、它的比例、無宗教信仰比例與多樣性指數，沒有每一種宗教各自的比例。' +
      DISCLAIMER,
    en:
      'Pew estimates the religious composition of 201 countries and territories from more than 2,700 censuses and surveys, in seven groups: Christians (Catholic, Protestant, Orthodox, etc.), Muslims, the religiously unaffiliated, Hindus, Buddhists, Jews and other religions (folk religions, Taoism, Shinto, Sikhism, the Baha’i faith, etc.), for 2010 and 2020 only. ' +
      "Pew's terms of use allow publishing excerpts only, so this page shows the largest group, its share, the unaffiliated share and the diversity index, not the share of every group. " +
      DISCLAIMER,
  },
  indicators: [
    {
      id: 'main',
      label: { zh: '主要宗教', en: 'Largest religious group' },
      description: {
        zh: '人數最多的宗教類別。滑過或點選圖例可以只看某一種宗教。',
        en: 'The religious group with the most adherents. Hover over or click the legend to show a single group.',
      },
      unit: '',
      file: 'main.json',
      layer: { kind: 'categorical', categories: RELIGIONS },
      format: religionLabel,
    },
    {
      id: 'main-share',
      label: { zh: '主要宗教的人口比例', en: 'Share of the largest group' },
      description: {
        zh: '人數最多的宗教占總人口的比例。比例越低，代表沒有一種宗教占多數。',
        en: 'Share of the population belonging to the largest religious group. The lower it is, the less any single group dominates.',
      },
      unit: '%',
      file: 'main-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [40, 50, 60, 70, 80, 90] } },
      format: pct,
      formatTick: (v) => `${fixed(v, 0)}%`,
    },
    {
      id: 'unaffiliated',
      label: { zh: '無宗教信仰比例', en: 'Religiously unaffiliated' },
      description: {
        zh: '不認同任何宗教的人（無神論者、不可知論者，以及沒有特定宗教的人）占總人口的比例。',
        en: 'Share of people who do not identify with any religion (atheists, agnostics and those with no particular religion).',
      },
      unit: '%',
      file: 'unaffiliated.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 20, 35, 50] } },
      format: pct,
      formatTick: (v) => `${fixed(v, 0)}%`,
      compareWorld: true,
    },
    {
      id: 'diversity',
      label: { zh: '宗教多樣性指數', en: 'Religious Diversity Index' },
      description: {
        zh: 'Pew 的宗教多樣性指數，0–10：七大類各占七分之一是 10，全國只有一種宗教是 0。新加坡、蘇利南、台灣都很高。',
        en: "Pew's Religious Diversity Index, 0–10: 10 when each of the seven groups makes up one-seventh of the population, 0 when everyone belongs to one group. Singapore, Suriname and Taiwan score very high.",
      },
      unit: '',
      file: 'diversity.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 3, 4, 5.5, 7] } },
      format: (v) => fixed(v, 1),
      formatTick: (v) => fixed(v, v % 1 ? 1 : 0),
      compareWorld: true,
    },
    // 2026-11-07（製作手冊第二十七批 553，候選 1246、1247）：禮拜場所（pipeline/topics/worship.py）
    {
      id: 'worship-density',
      label: { zh: '每十萬人幾座禮拜場所', en: 'Places of worship per 100,000 people' },
      description: {
        zh: `${OSM_NOTE.zh}照網站的規則只替 OpenStreetMap 覆蓋良好的 93 國上色（用餐飲店對餐飲業就業人數判斷），人口是聯合國 WPP 2024。希臘每十萬人 283 座最多（到處是小教堂），奧地利 167、克羅埃西亞 141、斯洛伐克 138、斯洛維尼亞 135、葡萄牙 131、義大利 117；法國 92、德國 86、美國 78、日本 64、台灣 63（14,547 座）、英國 60、新加坡 11。全世界 OpenStreetMap 上約 162 萬座：美國 27.3 萬、印尼 9.0 萬、日本 7.9 萬、印度 7.2 萬、德國 7.2 萬。`,
        en: `${OSM_NOTE.en} Following the site’s rule, only the 93 countries where OpenStreetMap is well mapped are coloured (judged by food and drink places against food-service employment); population is from UN WPP 2024. Greece has the most at 283 per 100,000 (chapels everywhere), followed by Austria 167, Croatia 141, Slovakia 138, Slovenia 135, Portugal 131 and Italy 117; France 92, Germany 86, the US 78, Japan 64, Taiwan 63 (14,547 places), the UK 60 and Singapore 11. OpenStreetMap has about 1.62 million worldwide: 273,000 in the US, 90,000 in Indonesia, 79,000 in Japan and 72,000 each in India and Germany.`,
      },
      unit: { zh: '座／十萬人', en: 'per 100,000' },
      file: 'worship-density.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 50, 75, 100, 150] } },
      format: (v) => tr({ zh: `每十萬人 ${fixed(v, 0)} 座`, en: `${fixed(v, 0)} per 100,000` }),
      formatTick: (v) => fixed(v, 0),
      timeless: true,
    },
    {
      id: 'worship-main',
      label: { zh: '禮拜場所最多的宗教', en: 'Most common religion of places of worship' },
      description: {
        zh: `${OSM_NOTE.zh}只看有標宗教（religion）的場所，有標的不到 100 座或不到一半的國家不畫；174 國有值。這是場所的數目，不是信徒的人數：小廟多的宗教會比較多。基督宗教 116 國、伊斯蘭 44 國；佛教 9 國（中國大陸、泰國、緬甸、越南、柬埔寨、寮國、斯里蘭卡、不丹、蒙古），印度教是印度與尼泊爾，神道是日本（55%，佛教 41%），猶太教是以色列（82%）。台灣有標宗教的 8,517 座裡道教與民間信仰占 68%（道教 5,282、華人民間信仰 472），基督宗教 16%、佛教 15%：道教的宮廟是基督宗教的 4 倍，跟信徒的比例不同。滑過看前三名的比例。`,
        en: `${OSM_NOTE.en} Only places with a religion tag are counted, and countries with fewer than 100 tagged places or under half tagged are not shown; 174 countries have a value. These are numbers of places, not of believers, so religions with many small shrines count for more. Christianity leads in 116 countries and Islam in 44; Buddhism in 9 (mainland China, Thailand, Myanmar, Vietnam, Cambodia, Laos, Sri Lanka, Bhutan and Mongolia), Hinduism in India and Nepal, Shinto in Japan (55%, with Buddhism 41%) and Judaism in Israel (82%). Of Taiwan’s 8,517 tagged places, 68% are Taoist or folk temples (5,282 Taoist and 472 Chinese folk), 16% Christian and 15% Buddhist: Taoist temples outnumber churches four to one, unlike the shares of believers. Hover for the top three shares.`,
      },
      unit: '',
      file: 'worship-main.json',
      layer: { kind: 'categorical', categories: WORSHIP },
      format: (v) => tr(WORSHIP.find((r) => r.value === v)?.label ?? ''),
      timeless: true,
    },
    vdem(
      'religious-freedom',
      { zh: '宗教自由', en: 'Freedom of religion' },
      {
        zh: '個人與團體能不能自由選擇、改變、實踐宗教（包括不信教），政府會不會干預。越高越自由。2025 年紐西蘭 2.79、挪威 2.74、芬蘭 2.63、台灣 2.61 最高（台灣第 4），日本 2.58、德國 2.09、瑞典 2.00、南韓 1.84、法國 1.60、美國 0.95；印度 −0.14、緬甸 −0.63、越南 −1.40、伊朗 −1.63、沙烏地阿拉伯 −1.72、中國 −2.50，北韓 −3.25、阿富汗 −3.29 最低。台灣 1900 年（日本統治）−0.72、1940–1944 年 −1.37，1987 年解嚴時 0.22、1990 年起 2.61。世界中位數 1789 年 −1.03、1900 年 0.15、1950 年 0.34，2010 年 1.65 最高，2025 年 1.29。地圖上 177 國（V-Dem 的加薩走廊、尚吉巴另外評分，地圖上沒有形狀）。',
        en: 'Whether individuals and groups can freely choose, change and practise a religion (including none), and whether the government interferes. Higher means freer. In 2025 New Zealand (2.79), Norway (2.74), Finland (2.63) and Taiwan (2.61) were highest (Taiwan ranks 4th), followed by Japan 2.58, Germany 2.09, Sweden 2.00, South Korea 1.84, France 1.60 and the US 0.95; India −0.14, Myanmar −0.63, Vietnam −1.40, Iran −1.63, Saudi Arabia −1.72 and China −2.50, with North Korea (−3.25) and Afghanistan (−3.29) lowest. Taiwan scored −0.72 in 1900 (under Japanese rule) and −1.37 in 1940–1944, 0.22 when martial law ended in 1987 and 2.61 from 1990. The world median was −1.03 in 1789, 0.15 in 1900 and 0.34 in 1950, peaked at 1.65 in 2010 and was 1.29 in 2025. 177 countries are on the map (V-Dem scores the Gaza Strip and Zanzibar separately, and they have no shape of their own).',
      },
      VDEM_DIVERGING,
    ),
    vdem(
      'religious-repression',
      { zh: '宗教組織受不受壓制', en: 'Repression of religious organizations' },
      {
        zh: '政府怎麼對待宗教組織：從禁止、迫害到完全不干預。越高越不受壓制（V-Dem 的原始方向）。2025 年巴貝多 2.75、烏拉圭 2.69、瑞典 2.65、西班牙 2.64、台灣 2.62 最高（台灣第 5），南韓 2.47、美國 2.19、德國 1.82、日本 1.55、法國 0.76；印度 −1.43、沙烏地阿拉伯 −1.62、中國 −2.21、越南 −2.30，埃及 −2.53、尼加拉瓜 −2.54、厄利垂亞 −2.78、北韓 −3.15 最低。台灣 1987 年 0.20，解嚴後 1990 年 1.14、2000 年 2.38。世界中位數 2010 年 1.55 最高，2025 年 1.16。',
        en: 'How the government treats religious organizations, from banning and persecution to no interference at all. Higher means less repression (V-Dem’s own direction). In 2025 Barbados (2.75), Uruguay (2.69), Sweden (2.65), Spain (2.64) and Taiwan (2.62) were highest (Taiwan ranks 5th), followed by South Korea 2.47, the US 2.19, Germany 1.82, Japan 1.55 and France 0.76; India −1.43, Saudi Arabia −1.62, China −2.21 and Vietnam −2.30, with Egypt (−2.53), Nicaragua (−2.54), Eritrea (−2.78) and North Korea (−3.15) lowest. Taiwan scored 0.20 in 1987, 1.14 in 1990 after martial law ended and 2.38 in 2000. The world median peaked at 1.55 in 2010 and was 1.16 in 2025.',
      },
      VDEM_DIVERGING,
    ),
    vdem(
      'religious-consultation',
      { zh: '宗教組織說不說得上話', en: 'Consultation of religious organizations' },
      {
        zh: '政府制定政策時會不會徵詢主要的宗教組織。高分不等於好：量的是宗教組織對政策說不說得上話，不是宗教自由；伊朗的神權體制 1.57、以色列 2.25 都很高，政教分離的法國 −0.30、日本 −0.10 是負的，所以地圖用單色、不分好壞。2025 年蒙特內哥羅 2.97、東帝汶 2.86、馬拉威 2.80、賽普勒斯 2.80 最高，土耳其 1.52、俄羅斯 1.15、印度 1.11、德國 1.10、瑞典 0.87、美國 0.49、台灣 0.44（世界中位數 0.46）、南韓 0.34；中國 −1.86、白俄羅斯 −2.63、北韓 −2.88 最低。',
        en: 'Whether policymakers consult the major religious organizations when making policy. A high score is not necessarily good: it measures how much religious organizations have a say in policy, not religious freedom. Theocratic Iran (1.57) and Israel (2.25) score high, while secular France (−0.30) and Japan (−0.10) are negative, so the map uses a single hue rather than a good–bad colour scheme. In 2025 Montenegro (2.97), Timor-Leste (2.86), Malawi and Cyprus (2.80) were highest, followed by Türkiye 1.52, Russia 1.15, India 1.11, Germany 1.10, Sweden 0.87, the US 0.49, Taiwan 0.44 (world median 0.46) and South Korea 0.34; China (−1.86), Belarus (−2.63) and North Korea (−2.88) were lowest.',
      },
      { type: 'sequential', thresholds: [-1.5, -0.75, 0, 0.5, 1, 1.5] },
    ),
    // 2026-11-07（製作手冊第二十七批 556，候選 1252）：政府的宗教支出（pipeline/topics/culture_spending.py）
    {
      id: 'gov-religion',
      label: { zh: '政府的宗教與社區服務支出', en: 'Government spending on religious and community services' },
      description: {
        zh: '一般政府（中央、地方與社會安全基金）花在「宗教與其他社區服務」（聯合國政府職能分類 COFOG 08.4）的錢占 GDP，Eurostat 的金額除以 GDP，只有歐洲 30 國（不含英國），1995 年起。這一類也包括社區活動中心等，不是純宗教支出。2024 年丹麥 0.38% 最高（15.12 億歐元），匈牙利 0.34%、挪威 0.24%、冰島 0.22%、克羅埃西亞 0.19%、芬蘭 0.18%；歐盟 27 國合計 0.06%（100.64 億歐元），荷蘭 11.38 億、挪威 11.09 億、義大利 10.51 億歐元。德國 0.02%：教會稅由稅務機關代收、直接轉給教會，不算政府支出。瑞典 2000 年政教分離後幾乎是 0。台灣的歲出政事別沒有單獨的宗教科目，沒有資料。',
        en: 'Spending by general government (central, local and social security funds) on “religious and other community services” (UN COFOG 08.4) as a share of GDP: Eurostat’s euro amounts divided by GDP, for 30 European countries only (not the UK), from 1995. The category also covers community centres and the like, so it is not purely religious spending. In 2024 Denmark was highest at 0.38% (€1.51 billion), followed by Hungary 0.34%, Norway 0.24%, Iceland 0.22%, Croatia 0.19% and Finland 0.18%; the EU27 total was 0.06% (€10.06 billion), with €1.14 billion in the Netherlands, €1.11 billion in Norway and €1.05 billion in Italy. Germany is 0.02%: church tax is collected by the tax offices and passed straight to the churches, so it is not government spending. Sweden has been close to zero since church and state separated in 2000. Taiwan’s budget has no separate item for religion, so there are no data.',
      },
      unit: { zh: '% GDP', en: '% of GDP' },
      file: 'gov-religion.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.02, 0.05, 0.1, 0.2, 0.3] } },
      format: (v) => `${fixed(v, 2)}%`,
      formatTick: (v) => `${v}%`,
      defaultYear: 2024,
    },
    ...religionExtra.indicators,
  ],
};
