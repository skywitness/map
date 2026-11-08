import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, TopicDefinition } from './types';
import { digitalTrade } from './digital-trade';
import { hostOnly, topicPart } from './merge';
import { withParts } from './parts';

/**
 * 上網用什麼：搜尋引擎、瀏覽器與作業系統（新主題，2026-11-07，製作手冊第二十七批 587，候選 1307、1308；
 * 科技・網路與連線）：StatCounter Global Stats 的各國每月市占（pipeline/topics/web_platforms.py），
 * 地圖畫每一國的第一名與 iOS 減 Android；側欄 panels/WebPlatformsPanel.tsx。
 */
const OTHER = MAP_TOKENS.categoricalOther;
// 代碼要跟 pipeline/topics/web_platforms.py 的 CATEGORY、OTHER 一致
const SEARCH: CategoryDef[] = [
  { value: 1, label: 'Google' },
  { value: 2, label: { zh: '百度', en: 'Baidu' } },
  { value: 3, label: 'Yandex' },
  { value: 4, label: 'Naver' },
  { value: 5, label: 'Bing' },
  { value: 6, label: 'Yahoo!' },
  { value: 7, label: 'Seznam' },
  { value: 8, label: { zh: '其他', en: 'Other' }, color: OTHER },
];
const BROWSER: CategoryDef[] = [
  { value: 1, label: 'Chrome' },
  { value: 2, label: 'Safari' },
  { value: 3, label: 'Internet Explorer' },
  { value: 4, label: 'Firefox' },
  { value: 5, label: 'Opera' },
  { value: 6, label: 'Edge' },
  { value: 7, label: 'UC Browser' },
  { value: 8, label: { zh: '其他', en: 'Other' }, color: OTHER },
];
const OS: CategoryDef[] = [
  { value: 1, label: 'Windows' },
  { value: 2, label: 'Android' },
  { value: 3, label: 'iOS' },
  { value: 4, label: 'macOS' },
  { value: 5, label: { zh: '其他（Nokia、Symbian 等）', en: 'Other (Nokia, Symbian…)' }, color: OTHER },
];
const label = (cats: CategoryDef[]) => (v: number) => {
  const c = cats.find((x) => x.value === v)?.label;
  return c ? (typeof c === 'string' ? c : tr(c)) : '';
};
const MISSING = { zh: '人口太少或 StatCounter 沒有資料', en: 'Too few people or no StatCounter data' };

const webPlatformsOwn: TopicDefinition = {
  id: 'web-platforms',
  title: { zh: '上網用什麼：搜尋引擎、瀏覽器與作業系統', en: 'How the world goes online: search engines, browsers and operating systems' },
  shortTitle: { zh: '上網用什麼', en: 'Search, browsers and OS' },
  defaultIndicator: 'search-leader',
  defaultYear: 2026,
  sources: [
    {
      name: 'StatCounter Global Stats',
      url: 'https://gs.statcounter.com/',
      license: 'CC BY-SA 3.0',
    },
  ],
  note: {
    zh: 'StatCounter 的數字是裝了它的追蹤碼的網站的瀏覽次數，不是使用人數，樣本偏向這些網站，中國、俄羅斯這類有自己網路生態的國家特別不具代表性。每年的值是那一年各月的平均，2026 年是 1–10 月；作業系統是桌機、手機、平板合起來算。同一家公司的品牌先合併（例如 Bing 含舊的 MSN 搜尋，Edge 含舊版 Edge，macOS 含 OS X）。人口不到 5,000 人的地區樣本太小，不畫。',
    en: 'StatCounter figures are page views on websites carrying its tracking code, not numbers of users, so the sample leans towards those sites and is especially unrepresentative in countries with their own internet ecosystems, such as China and Russia. Each year is the average of its months (January–October for 2026); operating systems combine desktop, mobile and tablet. Brands of the same company are merged (Bing includes the old MSN search, Edge includes legacy Edge, macOS includes OS X). Places with fewer than 5,000 people are not shown because their samples are too small.',
  },
  panelExtra: () => import('./panels/WebPlatformsPanel'),
  indicators: [
    {
      id: 'search-leader',
      label: { zh: '用得最多的搜尋引擎', en: 'Most used search engine' },
      description: {
        zh: '每一國這一年用得最多的搜尋引擎。2026 年 232 個地區裡 Google 在 230 個是第一，只剩中國（百度，2010 年起）與俄羅斯（Yandex，2022 年起；2017–2018 年也是）。南韓的 Naver 2010–2011 年是第一，2026 年 10 月 Google 48.6%、Naver 42.1%；台灣 2009–2010 年是 Yahoo! 第一，2026 年 10 月 Google 80.1%、Yahoo! 10.9%、Bing 8.1%。點國家看各家的百分比。',
        en: 'The search engine used most in each country in the year. In 2026 Google leads in 230 of 232 places, all but China (Baidu, since 2010) and Russia (Yandex, since 2022 and also in 2017–2018). In South Korea Naver led in 2010–2011; in October 2026 Google had 48.6% and Naver 42.1%. In Taiwan Yahoo! led in 2009–2010; in October 2026 Google had 80.1%, Yahoo! 10.9% and Bing 8.1%. Click a country for each engine’s share.',
      },
      unit: '',
      file: 'search-leader.json',
      layer: { kind: 'categorical', categories: SEARCH },
      format: label(SEARCH),
      missing: MISSING,
    },
    {
      id: 'browser-leader',
      label: { zh: '用得最多的瀏覽器', en: 'Most used browser' },
      description: {
        zh: '每一國這一年用得最多的瀏覽器。2009 年 Internet Explorer 在 223 個地區裡是 180 個的第一，Firefox 37 個（德國、捷克、印尼等）、Opera 6 個（俄羅斯、白俄羅斯、哈薩克等）；2012 年 IE 79、Chrome 67、Firefox 66；2026 年 Chrome 219 個，Safari 12 個（百慕達、巴哈馬、法羅群島等），斯里蘭卡是 Edge。印度 2014–2016 年是 UC Browser 第一。台灣 2013 年起是 Chrome，2026 年 10 月 Chrome 60.3%、Safari 26.1%。',
        en: 'The browser used most in each country in the year. In 2009 Internet Explorer led in 180 of 223 places, Firefox in 37 (including Germany, Czechia and Indonesia) and Opera in 6 (including Russia, Belarus and Kazakhstan); in 2012 IE led in 79, Chrome in 67 and Firefox in 66; in 2026 Chrome leads in 219, Safari in 12 (including Bermuda, the Bahamas and the Faroe Islands) and Edge in Sri Lanka. India’s leader was UC Browser in 2014–2016. Taiwan has been Chrome since 2013; in October 2026 Chrome had 60.3% and Safari 26.1%.',
      },
      unit: '',
      file: 'browser-leader.json',
      layer: { kind: 'categorical', categories: BROWSER },
      format: label(BROWSER),
      missing: MISSING,
    },
    {
      id: 'os-leader',
      label: { zh: '用得最多的作業系統', en: 'Most used operating system' },
      description: {
        zh: '每一國這一年用得最多的作業系統（桌機、手機、平板合起來）。2009–2012 年全部是 Windows；2015 年 Android 在 50 個地區第一，2021 年 150 個；2026 年 Android 111、Windows 98、iOS 23。iOS 第一的有台灣（2024 年起）、澳門（2019 年起）與一些小島；美國 2020–2022 年是 iOS，2023 年起又是 Windows。',
        en: 'The operating system used most in each country in the year (desktop, mobile and tablet combined). In 2009–2012 everywhere was Windows; by 2015 Android led in 50 places and by 2021 in 150; in 2026 Android leads in 111, Windows in 98 and iOS in 23. iOS leads in Taiwan (since 2024), Macao (since 2019) and a number of small islands; the US was iOS in 2020–2022 and Windows again from 2023.',
      },
      unit: '',
      file: 'os-leader.json',
      layer: { kind: 'categorical', categories: OS },
      format: label(OS),
      missing: MISSING,
    },
    {
      id: 'ios-android',
      label: { zh: 'iOS 比 Android 多幾個百分點', en: 'iOS minus Android share' },
      description: {
        zh: 'iOS 的市占減 Android 的市占（百分點，桌機、手機、平板合起來；正值是 iOS 多）。2026 年全世界 iOS 18.8%、Android 40.5%（差 −21.7）。iOS 比 Android 多的有 41 個地區：美國 +8.8、日本 +11.6、加拿大 +14.3、澳洲 +13.2、英國 +1.2、丹麥、挪威、瑞典、冰島、瑞士，台灣 +8.3；南韓 −15.3、中國 −21.9、德國 −15.5、法國 −16.0、巴西 −21.8、印尼 −29.9、印度 −72.1。',
        en: 'iOS share minus Android share (percentage points, desktop, mobile and tablet combined; positive means more iOS). In 2026 the world had 18.8% iOS and 40.5% Android (a gap of −21.7). iOS leads Android in 41 places: the US +8.8, Japan +11.6, Canada +14.3, Australia +13.2, the UK +1.2, Denmark, Norway, Sweden, Iceland and Switzerland, and Taiwan +8.3; South Korea −15.3, China −21.9, Germany −15.5, France −16.0, Brazil −21.8, Indonesia −29.9 and India −72.1.',
      },
      unit: { zh: '百分點', en: 'pp' },
      file: 'ios-android.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-50, -25, -5, 5, 25, 50] } },
      format: (v) => tr({ zh: `${v > 0 ? '+' : ''}${fixed(v, 1)} 個百分點`, en: `${v > 0 ? '+' : ''}${fixed(v, 1)} pp` }),
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
      missing: MISSING,
    },
  ],
};

/**
 * 上網用什麼與數位貿易（2026-11-08 使用者要求「網路與連線」併成更少的主題（9 個併成 4 個），放到科技的「太空」下面；併進來的主題的定義檔照舊留著，舊網址由 redirects.ts 轉過來）：
 * 搜尋引擎、瀏覽器與作業系統（主體）＋數位貿易的壁壘（digital-trade.ts，資料照舊在 digital-trade/）
 */
export const webPlatforms: TopicDefinition = withParts(
  {
    ...hostOnly(webPlatformsOwn),
    title: { zh: '上網用什麼與數位貿易：搜尋引擎、瀏覽器與資料出境', en: 'Platforms and digital trade: search engines, browsers and data flows' },
    shortTitle: { zh: '上網用什麼與數位貿易', en: 'Platforms and digital trade' },
  },
  topicPart(digitalTrade),
);
