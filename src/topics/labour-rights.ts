import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 勞動權利與解僱保護（2026-11-07，製作手冊第二十五批 455，合併候選 1127、1129；pipeline/topics/labour_rights.py）：
 * OECD 的解僱保護嚴格程度（EPL，VERSION1）與 ILO 的 SDG 8.8.2 勞動權利遵守程度。兩個都沒有台灣
 */
const NO_TW = { zh: 'OECD 與 ILO 的資料都沒有台灣', en: 'Taiwan is not in the OECD or ILO data' };

export const labourRights: TopicDefinition = {
  id: 'labour-rights',
  title: { zh: '勞動權利與解僱保護', en: 'Labour rights and employment protection' },
  shortTitle: { zh: '勞動權利', en: 'Labour rights' },
  defaultIndicator: 'epl',
  defaultYear: 2024,
  sources: [
    {
      name: { zh: 'OECD Employment Protection Legislation（解僱保護的嚴格程度，Version 1）', en: 'OECD Employment Protection Legislation (strictness of employment protection, Version 1)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_EPL%40DF_EPL&df[ag]=OECD.ELS.JAI',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'ILOSTAT：SDG 8.8.2 國家對結社自由與團體協商權的遵守程度（DF_SDG_0882_NOC_RT）', en: 'ILOSTAT: SDG 8.8.2 national compliance with freedom of association and collective bargaining rights (DF_SDG_0882_NOC_RT)' },
      url: 'https://ilostat.ilo.org/data/',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '解僱保護是法條的嚴格程度，不是執行得好不好：拉丁美洲、南亞的法條分數常常很高，但多數人是非正式就業（見「就業、失業與退休」），法條保護不到。OECD 的指標有四套方法（Version 1–4），這裡用涵蓋最廣的 Version 1（1985 年起、73 國）；新的 Version 4（2013 年起、43 國）把美國算成 0.75、荷蘭 2.85，數字不一樣，不能混著比。OECD 以外的國家多半只評到 2012–2015 年，地圖用 10 年內最近一次並標年份。勞動權利的分數是依國際勞工組織監督機制的違規紀錄計算，有通報、有案件的國家分數會比較高，資訊封閉的國家不一定比較低。台灣不在兩份資料裡：勞動基準法規定終止契約要有法定事由（第 11、12 條）、依年資預告 10 到 30 天（第 16 條），資遣費舊制每滿一年一個月、勞退新制每滿一年半個月，最多 6 個月。',
    en: 'Employment protection measures how strict the law is, not how well it is enforced: Latin American and South Asian laws often score high while most people work informally (see Employment, unemployment and retirement), beyond the law’s reach. The OECD indicator has four methodologies (Versions 1–4); this uses the widest, Version 1 (from 1985, 73 countries). The newer Version 4 (from 2013, 43 countries) scores the US at 0.75 and the Netherlands at 2.85, so the versions cannot be compared. Countries outside the OECD were mostly assessed only until 2012–2015, so the map uses each country’s latest score within 10 years and labels the year. The labour rights score is built from violations recorded by the ILO’s supervisory bodies: countries with more reporting and cases score worse, and closed countries do not necessarily score better. Taiwan is in neither dataset: its Labour Standards Act requires statutory grounds for dismissal (Arts. 11–12), 10–30 days’ notice depending on tenure (Art. 16), and severance of one month per year of service under the old scheme or half a month per year under the new pension scheme, capped at six months.',
  },
  noValue: { TWN: NO_TW },
  indicators: [
    {
      id: 'epl',
      label: { zh: '解僱保護的嚴格程度', en: 'Strictness of employment protection' },
      description: {
        zh: 'OECD 依各國勞動法給 0 到 6 分，越高表示解僱正式員工（或用定期契約）的限制越多：預告期、資遣費、解僱的理由與程序、不當解僱的救濟。正式契約的個別解僱：荷蘭 3.61、捷克 3.26、葡萄牙 3.14、拉脫維亞 3.02 最嚴，德國 2.60、法國 2.56、南韓 2.42、日本 1.37、英國 1.35，美國 0.09 幾乎沒有限制（任意僱用）。定期契約：墨西哥 4.25、土耳其 4.19 最嚴，英國 0.38、美國與加拿大 0.25 最寬。分數高低沒有好壞，是保障與彈性的取捨。',
        en: 'The OECD scores labour law from 0 to 6; higher means more restrictions on dismissing regular employees (or on using temporary contracts): notice, severance, grounds and procedures, and remedies for unfair dismissal. For individual dismissal of regular workers, the Netherlands (3.61), Czechia (3.26), Portugal (3.14) and Latvia (3.02) are strictest; Germany 2.60, France 2.56, South Korea 2.42, Japan 1.37 and the UK 1.35, while the US at 0.09 has almost no restrictions (employment at will). For temporary contracts, Mexico (4.25) and Turkey (4.19) are strictest and the UK (0.38), the US and Canada (0.25) the most permissive. Neither high nor low is better: it is a trade-off between protection and flexibility.',
      },
      unit: { zh: '分（0–6）', en: 'score (0–6)' },
      file: 'epl/{item}.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 1.5, 2, 2.5, 3, 3.5] } },
      dimension: {
        label: { zh: '契約', en: 'Contract' },
        options: [
          { id: 'regular', label: { zh: '正式契約（個別解僱）', en: 'Regular contracts (individual dismissal)' } },
          { id: 'temporary', label: { zh: '定期與派遣契約', en: 'Temporary contracts' } },
        ],
        defaultOption: 'regular',
      },
      format: (v) => fixed(v, 2),
      formatTick: (v) => fixed(v, 2),
    },
    {
      id: 'labour-rights',
      label: { zh: '勞動權利的違反程度', en: 'Violations of labour rights' },
      description: {
        zh: '國家對結社自由與團體協商權的遵守程度（SDG 8.8.2），0 到 10 分，越高表示違反越嚴重（依國際勞工組織監督機制記錄的違規計分，2015 年起每年）。2024 年緬甸、伊朗、阿聯 10.0 最差，白俄羅斯 9.92、越南 9.14、中國大陸 9.13、孟加拉 9.06、委內瑞拉 8.91、卡達 8.72；南韓 5.63、印度 4.45、美國 3.83、日本 1.11、德國 0.38；挪威、瑞典、芬蘭、義大利、愛爾蘭等 13 國是 0。分數來自有記錄的違規，不代表權利保障的程度。',
        en: 'National compliance with freedom of association and collective bargaining rights (SDG 8.8.2), scored 0 to 10, with higher meaning worse violations (based on violations recorded by the ILO supervisory bodies, yearly from 2015). In 2024 Myanmar, Iran and the UAE scored the worst at 10.0, followed by Belarus 9.92, Vietnam 9.14, mainland China 9.13, Bangladesh 9.06, Venezuela 8.91 and Qatar 8.72; South Korea 5.63, India 4.45, the US 3.83, Japan 1.11 and Germany 0.38; 13 countries including Norway, Sweden, Finland, Italy and Ireland scored 0. Scores reflect recorded violations, not how well rights are protected.',
      },
      unit: { zh: '分（0–10）', en: 'score (0–10)' },
      file: 'labour-rights.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1.5, 3, 5, 7, 9] } },
      format: (v) => fixed(v, 2),
      formatTick: (v) => fixed(v, 0),
    },
  ],
};
