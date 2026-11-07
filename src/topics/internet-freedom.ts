import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { ScaleSpec, TopicDefinition } from './types';

/**
 * 網路自由度：審查、斷網與因言論被抓（新主題，2026-11-07，製作手冊第二十七批 590，候選 1311；科技・網路與連線）：
 * Freedom House《Freedom on the Net》2026 年版（38 國），pipeline/topics/internet_freedom.py；
 * 側欄 panels/InternetFreedomPanel.tsx 是 21 題的得分。授權只准非商業、要註明出處。
 */
const points = (v: number) => tr({ zh: `${fixed(v, 0)} 分`, en: `${fixed(v, 0)} points` });
const NOTE = {
  zh: '2026 年版只評了 38 國（Freedom House 這一版暫停了 34 國），多半是網路管制值得注意的國家，沒有被評的國家不等於比較自由。',
  en: 'The 2026 edition covers only 38 countries (Freedom House paused 34 in this edition), mostly ones whose internet controls are of concern, so countries not assessed are not necessarily freer.',
};
const part = (max: number): ScaleSpec => ({ type: 'sequential', thresholds: [0.2, 0.4, 0.55, 0.7, 0.85].map((f) => Math.round(f * max)) });

export const internetFreedom: TopicDefinition = {
  id: 'internet-freedom',
  title: { zh: '網路自由度：審查、斷網與因言論被抓', en: 'Internet freedom: censorship, shutdowns and arrests' },
  shortTitle: { zh: '網路自由度', en: 'Internet freedom' },
  defaultIndicator: 'fotn',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'Freedom House《Freedom on the Net 2026》（國家分數頁與各國頁面）', en: 'Freedom House, Freedom on the Net 2026 (country scores and country pages)' },
      url: 'https://freedomhouse.org/report/freedom-net',
      license: { zh: 'Freedom House 內容使用規定（非商業使用、註明出處）', en: 'Freedom House content permissions (noncommercial use with citation)' },
    },
  ],
  note: {
    zh: 'Freedom House 每年請各國的研究者依 21 題評分（評的是前一年 6 月到當年 5 月），0–100 分，分越高越自由：接取障礙（0–25，基礎設施、價格、斷網、業者的多樣性、主管機關）、內容限制（0–35，封鎖、刪文、自我審查、資訊操控、線上動員）、使用者權利侵害（0–40，法律保障、因網路言論被罰、匿名與加密、監控、恐嚇與暴力、網路攻擊）。70 分以上算「自由」、40–69「部分自由」、39 以下「不自由」。分數是專家評分，不是量測值。只有最新一年：歷年的資料檔沒有公開的下載連結（只有申請表單），所以沒有歷年變化。',
    en: 'Each year Freedom House has country researchers score 21 questions (covering June of the previous year to May), 0–100 with higher meaning freer: obstacles to access (0–25: infrastructure, cost, shutdowns, provider diversity, regulators), limits on content (0–35: blocking, takedowns, self-censorship, manipulation, online mobilisation) and violations of user rights (0–40: legal protections, penalties for online speech, anonymity and encryption, surveillance, intimidation and violence, cyberattacks). 70 and above is “Free”, 40–69 “Partly Free” and 39 or below “Not Free”. Scores are expert assessments, not measurements. Only the latest year is shown: the historical data file has no public download link (only a request form).',
  },
  panelExtra: () => import('./panels/InternetFreedomPanel'),
  indicators: [
    {
      id: 'fotn',
      label: { zh: '網路自由度（總分）', en: 'Internet freedom score' },
      description: {
        zh: `Freedom on the Net 2026 的總分（0–100，越高越自由）。愛沙尼亞 91 分最高，哥斯大黎加 86、台灣 78、南非、英國、法國、澳洲各 75、美國 73；中國、伊朗、緬甸都只有 9 分，俄羅斯 16、古巴 19、白俄羅斯 21、沙烏地阿拉伯 25、委內瑞拉 26。38 國裡自由 9 國、部分自由 15 國、不自由 14 國。${NOTE.zh}點國家看 21 題各得幾分。`,
        en: `Freedom on the Net 2026 total score (0–100, higher is freer). Estonia leads with 91, followed by Costa Rica 86, Taiwan 78, South Africa, the UK, France and Australia 75 each and the US 73; China, Iran and Myanmar score just 9, Russia 16, Cuba 19, Belarus 21, Saudi Arabia 25 and Venezuela 26. Of the 38 countries, 9 are Free, 15 Partly Free and 14 Not Free. ${NOTE.en} Click a country for its scores on all 21 questions.`,
      },
      unit: { zh: '分', en: 'points' },
      file: 'fotn.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [25, 40, 55, 70, 85] } },
      format: points,
      formatTick: (v) => fixed(v, 0),
      missing: { zh: '2026 年版沒有評', en: 'Not assessed in the 2026 edition' },
    },
    {
      id: 'fotn-access',
      label: { zh: '接取障礙（0–25）', en: 'Obstacles to access (0–25)' },
      description: {
        zh: `五題、滿分 25：基礎設施、上網的價格、政府能不能斷網、業者的多樣性、主管機關是否獨立。愛沙尼亞 25 分，台灣與英國 24、法國與澳洲 23；中國 7、蘇丹、伊朗、古巴 5、緬甸 2。${NOTE.zh}`,
        en: `Five questions, maximum 25: infrastructure, cost of access, government control over connectivity (shutdowns), provider diversity and regulator independence. Estonia scores 25, Taiwan and the UK 24, France and Australia 23; China 7, Sudan, Iran and Cuba 5 and Myanmar 2. ${NOTE.en}`,
      },
      unit: { zh: '分', en: 'points' },
      file: 'fotn-access.json',
      layer: { kind: 'choropleth', scale: part(25) },
      format: points,
      formatTick: (v) => fixed(v, 0),
      missing: { zh: '2026 年版沒有評', en: 'Not assessed in the 2026 edition' },
    },
    {
      id: 'fotn-content',
      label: { zh: '內容限制（0–35）', en: 'Limits on content (0–35)' },
      description: {
        zh: `八題、滿分 35：封鎖與過濾、強迫刪文、限制是否透明、自我審查、資訊被操控、發表的成本、資訊的多樣性、線上組織與動員。哥斯大黎加 32 分、愛沙尼亞 31、南非與法國 29、美國與台灣 28；緬甸與白俄羅斯 5、俄羅斯與伊朗 3、中國 2。${NOTE.zh}`,
        en: `Eight questions, maximum 35: blocking and filtering, forced takedowns, transparency of restrictions, self-censorship, manipulation, costs of publishing, diversity of information and online mobilisation. Costa Rica scores 32, Estonia 31, South Africa and France 29, the US and Taiwan 28; Myanmar and Belarus 5, Russia and Iran 3 and China 2. ${NOTE.en}`,
      },
      unit: { zh: '分', en: 'points' },
      file: 'fotn-content.json',
      layer: { kind: 'choropleth', scale: part(35) },
      format: points,
      formatTick: (v) => fixed(v, 0),
      missing: { zh: '2026 年版沒有評', en: 'Not assessed in the 2026 edition' },
    },
    {
      id: 'fotn-rights',
      label: { zh: '使用者權利侵害（0–40）', en: 'Violations of user rights (0–40)' },
      description: {
        zh: `八題、滿分 40（分越高代表侵害越少）：法律保障與司法獨立、處罰網路言論的法律、因網路活動被罰或被抓、匿名與加密、國家監控、業者蒐集資料、恐嚇與暴力、網路攻擊。愛沙尼亞 35 分、哥斯大黎加 32、南非 27、台灣 26、美國與匈牙利 25；俄羅斯與白俄羅斯 3、緬甸 2、伊朗 1、中國 0。${NOTE.zh}`,
        en: `Eight questions, maximum 40 (higher means fewer violations): legal protections and judicial independence, laws penalising online speech, people penalised or arrested for online activity, anonymity and encryption, state surveillance, data collection by companies, intimidation and violence, and cyberattacks. Estonia scores 35, Costa Rica 32, South Africa 27, Taiwan 26, the US and Hungary 25; Russia and Belarus 3, Myanmar 2, Iran 1 and China 0. ${NOTE.en}`,
      },
      unit: { zh: '分', en: 'points' },
      file: 'fotn-rights.json',
      layer: { kind: 'choropleth', scale: part(40) },
      format: points,
      formatTick: (v) => fixed(v, 0),
      missing: { zh: '2026 年版沒有評', en: 'Not assessed in the 2026 edition' },
    },
  ],
};
