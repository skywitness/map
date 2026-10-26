import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, formatSignedPercent } from '../lib/format';
import type { FlowLabels, FlowLayer, IndicatorDef, Text, TopicDefinition } from './types';

/**
 * 開發者與開源（pipeline/topics/developers.py）：GitHub Innovation Graph（CC0 1.0）的各經濟體開發者帳號、
 * git 推送與跨經濟體協作，每年取第 1 季。人均用 UN WPP 2024。
 * 協作沿用流向圖（src/map/flows.ts）：選了經濟體才畫它對外貢獻的對象、或外來協作者的所在地。
 * 決定與資料陷阱見 DESIGN.md 第 8 節第 80 點。
 */

/** 每年取第幾季（pipeline 的 QUARTER，會檢查） */
export const QUARTER = 1;
/** 開發者不到這麼多的經濟體不算增加率（看前一年）與每個帳號的推送次數（pipeline 的 MIN_DEVELOPERS，會檢查） */
export const MIN_DEVELOPERS = 1000;
const MIN_TEXT = MIN_DEVELOPERS.toLocaleString('en-US');

/** 時間軸的年份是那一年的第 1 季（1–3 月；人數是 3 月底的帳號數） */
const Q1 = {
  label: { zh: '每年第 1 季', en: 'Q1 of each year' },
  year: (y: number) => tr({ zh: `${y} 年第 1 季`, en: `Q1 ${y}` }),
};

const DEVELOPERS = { zh: '人', en: 'developers' };
const CONTRIBUTIONS = { zh: '次', en: 'contributions' };

/** 所在地怎麼判斷，每個指標的說明都要寫 */
const LOCATION: Text = {
  zh: '所在地依連線的 IP 位址判斷，VPN 會讓人被算到別的地方。',
  en: 'Location is inferred from IP addresses, so VPNs move people elsewhere.',
};

const COLLAB_LABELS: Record<'export' | 'import', FlowLabels> = {
  export: {
    partners: { zh: '開發者貢獻的對象', en: 'economies its developers contribute to' },
    main: { zh: '這裡的開發者主要貢獻給', en: 'Where its developers contribute most' },
    verb: (origin, partner) =>
      tr({ zh: `${origin}的開發者對${partner}的專案的推送與 PR`, en: `Pushes and PRs by developers in ${origin} to projects in ${partner}` }),
  },
  import: {
    partners: { zh: '外來協作者的所在地', en: 'economies whose developers contribute here' },
    main: { zh: '外來協作者主要來自', en: 'Where outside contributors come from' },
    verb: (origin, partner) =>
      tr({ zh: `${partner}的開發者對${origin}的專案的推送與 PR`, en: `Pushes and PRs by developers in ${partner} to projects in ${origin}` }),
  },
};

const COLLAB_NOTE = {
  zh: '協作是推送次數加上開的 PR 數；一季少於 100 位開發者參與的組合不公布，所以總數是下限，同一個經濟體裡的協作不算。',
  en: 'Collaboration counts pushes plus pull requests opened; pairs with fewer than 100 developers in a quarter are not published, so totals are lower bounds, and collaboration within an economy is not counted.',
};

function collabIndicator(id: string, label: Text, description: { zh: string; en: string }, file: string, direction: 'export' | 'import'): IndicatorDef {
  const layer: Omit<FlowLayer, 'kind'> = {
    file: 'flows/{year}.json',
    direction,
    labels: COLLAB_LABELS,
    legendKey: { zh: '由開發者所在地（淺）到專案所在地（深）', en: "From the developers' economy (light) to the project's (dark)" },
  };
  return {
    id,
    label,
    description: { zh: `${description.zh}${COLLAB_NOTE.zh}`, en: `${description.en} ${COLLAB_NOTE.en}` },
    unit: CONTRIBUTIONS,
    file,
    layer: { kind: 'flow', ...layer },
    format: (v) => tr({ zh: `${formatLargeNumber(v)} 次`, en: `${formatLargeNumber(v)} contributions` }),
    formatTick: formatLargeTick,
    shareOfWorld: true,
    timeAxis: Q1,
  };
}

const indicators: IndicatorDef[] = [
  {
    id: 'per-1000',
    label: { zh: '每千人的開發者', en: 'Developers per 1,000 people' },
    description: {
      zh: `GitHub 上所在地在這裡的開發者帳號數 ÷ 人口 × 1,000（每年第 1 季底；含已經不活躍的帳號，不含機器人與垃圾帳號）。${LOCATION.zh}香港、新加坡偏高，中國大陸明顯偏低（很多人用 Gitee 等國內平台）。`,
      en: `Developer accounts on GitHub located here per 1,000 people (end of Q1 each year; includes inactive accounts, excludes bots and spam). ${LOCATION.en} Hong Kong and Singapore look too high, and mainland China far too low (many use Chinese platforms such as Gitee).`,
    },
    unit: '‰',
    file: 'per-1000.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 20, 40, 80] } },
    format: (v) => tr({ zh: `每千人 ${fixed(v, v < 10 ? 1 : 0)} 人`, en: `${fixed(v, v < 10 ? 1 : 0)} per 1,000` }),
    formatTick: (v) => fixed(v, 0),
    compareWorld: true,
    timeAxis: Q1,
    noValue: {
      VAT: {
        zh: '人口約 500 人，IP 定位到這裡的帳號多半不住在當地，不算人均',
        en: 'Population about 500; most accounts located here by IP do not live here, so no per-capita figure',
      },
    },
  },
  {
    id: 'developers',
    label: { zh: '開發者人數', en: 'Developers' },
    description: {
      zh: `GitHub 上所在地在這裡的開發者帳號數（每年第 1 季底），圓的面積與人數成正比。含已經不活躍的帳號，不含機器人與垃圾帳號。${LOCATION.zh}`,
      en: `Developer accounts on GitHub located here (end of Q1 each year); circle area is proportional to the number. Includes inactive accounts, excludes bots and spam. ${LOCATION.en}`,
    },
    unit: DEVELOPERS,
    file: 'developers.json',
    layer: { kind: 'bubble', legendValues: [1e6, 1e7, 3e7] },
    format: (v) => tr({ zh: `${formatLargeNumber(v)} 人`, en: `${formatLargeNumber(v)} developers` }),
    formatTick: formatLargeTick,
    shareOfWorld: true,
    timeAxis: Q1,
  },
  {
    id: 'growth',
    label: { zh: '開發者增加率', en: 'Developer growth' },
    description: {
      zh: `開發者帳號數比前一年第 1 季增加多少。前一年不到 ${MIN_TEXT} 人的經濟體不算（人少時一點變化就是好幾成）。帳號只會累積，所以幾乎都是正的。`,
      en: `Change in developer accounts from Q1 of the previous year. Economies with fewer than ${MIN_TEXT} developers a year earlier are left out (small numbers swing wildly). Accounts accumulate, so this is almost always positive.`,
    },
    unit: '%',
    file: 'growth.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 20, 30, 40, 50, 75] } },
    format: (v) => formatSignedPercent(v, 1),
    formatTick: (v) => `${fixed(v, 0)}%`,
    compareWorld: true,
    timeAxis: Q1,
  },
  {
    id: 'pushes-per-developer',
    label: { zh: '每個帳號的推送次數', en: 'Pushes per developer' },
    description: {
      zh: `第 1 季的 git push 次數（含在 GitHub 網頁上直接改檔案）÷ 開發者帳號數。帳號含不活躍的，所以平均一季只有一兩次；只算公開的版本庫。開發者不到 ${MIN_TEXT} 人的經濟體不算。`,
      en: `Git pushes in Q1 (including edits made on the GitHub website) divided by developer accounts. Accounts include inactive ones, so the average is only one or two a quarter; public repositories only. Economies with fewer than ${MIN_TEXT} developers are left out.`,
    },
    unit: { zh: '次', en: 'pushes' },
    file: 'pushes-per-developer.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 1.25, 1.5, 1.75, 2, 2.5] } },
    format: (v) => tr({ zh: `${fixed(v, 2)} 次`, en: `${fixed(v, 2)} pushes` }),
    formatTick: (v) => fixed(v, v % 1 === 0 ? 0 : 2),
    compareWorld: true,
    timeAxis: Q1,
  },
  collabIndicator(
    'collab-out',
    { zh: '流向：對外協作', en: 'Flows: contributing abroad' },
    {
      zh: '點選經濟體，弧線連到它的開發者貢獻最多的 15 個經濟體的專案，線寬與推送加 PR 的次數成正比。排名表是對外協作的總次數。',
      en: "Click an economy to draw arcs to the 15 economies whose projects its developers contribute to most; line width is proportional to pushes plus pull requests. The ranking shows total contributions abroad.",
    },
    'collab-out.json',
    'export',
  ),
  collabIndicator(
    'collab-in',
    { zh: '流向：外來協作', en: 'Flows: contributors from abroad' },
    {
      zh: '點選經濟體，弧線連到對它的專案貢獻最多的 15 個經濟體，線寬與推送加 PR 的次數成正比。排名表是外來協作的總次數。',
      en: 'Click an economy to draw arcs from the 15 economies whose developers contribute most to its projects; line width is proportional to pushes plus pull requests. The ranking shows total contributions received.',
    },
    'collab-in.json',
    'import',
  ),
];

export const developers: TopicDefinition = {
  id: 'developers',
  title: { zh: '開發者與開源', en: 'Developers and open source' },
  shortTitle: { zh: '開發者', en: 'Developers' },
  defaultIndicator: 'per-1000',
  defaultYear: 2026,
  sources: [
    {
      name: 'GitHub Innovation Graph',
      url: 'https://github.com/github/innovationgraph',
      license: 'CC0 1.0',
    },
    {
      name: { zh: 'United Nations, World Population Prospects 2024（人口）', en: 'United Nations, World Population Prospects 2024 (population)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  note: {
    zh: '只算 GitHub 上的公開活動，不含私人版本庫，也不含 GitLab、Gitee 等其他平台。所在地依連線的 IP 位址判斷（一季裡每天的眾數），VPN、代理會讓開發者被算到別的地方：香港、新加坡的人均明顯偏高，中國大陸明顯偏低（很多人用 Gitee，連 GitHub 常要經由 VPN）。GitHub 另外依個人檔案填的所在地調整過 2025 年第 3 季到 2026 年第 2 季的推送次數（只有 60 多個經濟體），中國是依 IP 的 5 倍多、香港只有約四分之一、新加坡約一半，台灣差不多，寫在這些經濟體的附註。開發者是帳號數，含已經不活躍的帳號、不含機器人與垃圾帳號，一個人可以有好幾個帳號。一季少於 100 位開發者的項目 GitHub 不公布。每年取第 1 季（1–3 月）。歐盟（EU）是 27 個會員國的合計，不另外畫。AI 的使用見「AI」主題，研發與專利見「創新」主題，網路普及見「數位」主題。',
    en: 'Public activity on GitHub only: no private repositories and no other platforms such as GitLab or Gitee. Location is inferred from IP addresses (the most common daily location in the quarter), so VPNs and proxies move developers elsewhere: Hong Kong and Singapore look far too high per person, and mainland China far too low (many use Gitee, and reaching GitHub often takes a VPN). GitHub separately adjusted pushes from Q3 2025 to Q2 2026 using the locations in developers’ profiles (about 60 economies only): China comes out more than five times higher than by IP, Hong Kong about a quarter and Singapore about half, with Taiwan about the same; see those economies’ notes. Developers are accounts, including inactive ones and excluding bots and spam; one person can have several. GitHub does not publish figures with fewer than 100 developers in a quarter. Q1 (January–March) of each year is used. The EU, the sum of its 27 members, is not shown separately. For AI use see the AI topic; for R&D and patents, Innovation; for internet access, Digital.',
  },
  panelExtra: () => import('./panels/DevelopersPanel'),
  indicators,
};
