import { tr, type Text } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { IndicatorDef, SourceDef } from './types';

/**
 * 車禍的受傷人數與事故件數（2026-11-07，製作手冊第二十七批 575，候選 1295；pipeline/topics/road_injuries.py）：
 * 擴充「交通安全」。OECD／ITF 的年度道路安全趨勢（1970 年起），台灣用交通部的 30 日內死傷。
 */
export const ROAD_INJURY_IDS = ['road-injured', 'injury-crashes', 'deaths-per-1000-injured'];

const DEFINITION: Text = {
  zh: '受傷的定義各國差很多（有的只收住院的、有的收所有報案的輕傷），國與國之間看趨勢、不要比大小。',
  en: 'Definitions of injury differ widely between countries (some count only hospital admissions, others every reported minor injury), so compare trends rather than levels.',
};

export const roadInjuries: { sources: SourceDef[]; indicators: IndicatorDef[] } = {
  sources: [
    {
      name: {
        zh: 'OECD／國際運輸論壇（ITF）：年度道路死亡、受傷與受傷事故（DSD_TRENDS@DF_TRENDSSAFETY）',
        en: 'OECD / International Transport Forum: annual road fatalities, injured and injury crashes (DSD_TRENDS@DF_TRENDSSAFETY)',
      },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_TRENDS%40DF_TRENDSSAFETY&df[ag]=OECD.ITF',
      license: { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD terms (reuse and adaptation allowed with attribution)' },
    },
  ],
  indicators: [
    {
      id: 'road-injured',
      label: { zh: '車禍受傷人數', en: 'People injured in road crashes' },
      description: {
        zh: `道路交通事故的受傷人數（OECD／ITF，1970 年起，56 國；台灣用交通部的 30 日內死傷）。2023 年：德國 366,557 人、日本 365,010、土耳其 350,855、南韓 283,799、法國 234,836、義大利 224,634；台灣 539,535，比這些國家都多，而且從 2008 年 226,192 人一路增加。死亡大幅下降、受傷沒有同比例下降：德國 1970 年死亡 19,193 人、受傷 531,795 人，2023 年死亡 2,839（−85%）、受傷 366,557（−31%）；日本 21,795 → 3,263 人、受傷 976,066 → 365,010。美國最近是 2021 年 2,497,657 人。${tr(DEFINITION, 'zh')}點國家看死亡、受傷、事故件數三條線。`,
        en: `People injured in road traffic crashes (OECD/ITF, from 1970, 56 countries; Taiwan uses its Ministry of Transportation’s figures). In 2023: Germany 366,557, Japan 365,010, Türkiye 350,855, South Korea 283,799, France 234,836 and Italy 224,634; Taiwan 539,535, more than all of them, up steadily from 226,192 in 2008. Deaths fell far more than injuries: Germany had 19,193 deaths and 531,795 injured in 1970, against 2,839 deaths (−85%) and 366,557 injured (−31%) in 2023; Japan went from 21,795 to 3,263 deaths and from 976,066 to 365,010 injured. The latest US figure is 2,497,657 (2021). ${tr(DEFINITION, 'en')} Click a country for three lines: deaths, injured and crashes.`,
      },
      unit: { zh: '人', en: 'people' },
      file: 'road-injured.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: (v) => tr({ zh: `${formatLargeNumber(v)} 人`, en: formatLargeNumber(v) }),
      formatTick: formatLargeTick,
      integer: true,
      defaultYear: 2023,
    },
    {
      id: 'injury-crashes',
      label: { zh: '有人受傷的車禍件數', en: 'Road crashes with injuries' },
      description: {
        zh: `有人受傷或死亡的道路交通事故件數（OECD／ITF，1970 年起，55 國）。2023 年：日本 307,930 件、德國 291,890、土耳其 235,071、南韓 198,296、義大利 166,525。台灣交通部的統計沒有事故件數。${tr(DEFINITION, 'zh')}`,
        en: `Road traffic crashes in which someone was injured or killed (OECD/ITF, from 1970, 55 countries). In 2023: Japan 307,930, Germany 291,890, Türkiye 235,071, South Korea 198,296 and Italy 166,525. Taiwan’s Ministry of Transportation statistics have no crash counts. ${tr(DEFINITION, 'en')}`,
      },
      unit: { zh: '件', en: 'crashes' },
      file: 'injury-crashes.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: (v) => tr({ zh: `${formatLargeNumber(v)} 件`, en: formatLargeNumber(v) }),
      formatTick: formatLargeTick,
      integer: true,
      defaultYear: 2023,
    },
    {
      id: 'deaths-per-1000-injured',
      label: { zh: '每千名受傷者的死亡人數', en: 'Road deaths per 1,000 injured' },
      description: {
        zh: `同一年的車禍死亡 ÷ 受傷人數 × 1,000（受傷不到 500 人的國家不算）。這個比值主要在量各國怎麼算「受傷」：2023 年台灣 5.6、德國 7.7、日本 8.9、南韓 9.0 這些連輕傷都算的國家很低；荷蘭 92.6（受傷 7,390 人、死亡 684 人）、墨西哥 291.1、亞塞拜然 630.6 只算得到很少的受傷者。不能拿來說哪國的車禍比較致命。`,
        en: `Road deaths divided by people injured in the same year, × 1,000 (countries with fewer than 500 injured are left out). The ratio mostly measures how each country counts “injured”: in 2023 Taiwan 5.6, Germany 7.7, Japan 8.9 and South Korea 9.0, which count even minor injuries, are low; the Netherlands 92.6 (7,390 injured, 684 deaths), Mexico 291.1 and Azerbaijan 630.6 record very few injuries. It does not show which country’s crashes are deadlier.`,
      },
      unit: { zh: '人／千名受傷者', en: 'per 1,000 injured' },
      file: 'deaths-per-1000-injured.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 15, 20, 30, 50, 100] } },
      format: (v) => tr({ zh: `每千名受傷者 ${fixed(v, 1)} 人死亡`, en: `${fixed(v, 1)} deaths per 1,000 injured` }),
      formatTick: (v) => fixed(v, 0),
      defaultYear: 2023,
    },
  ],
};
