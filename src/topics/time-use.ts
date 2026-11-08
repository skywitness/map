import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { IndicatorDef, TopicDefinition } from './types';

/**
 * 一天的時間怎麼用（2026-11-04，製作手冊第二十一批 345，合併 882、887；pipeline/topics/time_use.py）：
 * OECD 的時間運用（35 國，沒有年份）、Eurostat HETUS 2020（11 國）、OECD How's Life（各國最近一年），不分年份。
 */

const hm = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return tr({ zh: h ? `${h} 小時 ${m} 分` : `${m} 分鐘`, en: h ? `${h} h ${m} min` : `${m} min` });
};
const MIN = { zh: '分鐘／天', en: 'minutes a day' };

const minutes = (id: string, label: IndicatorDef['label'], description: IndicatorDef['description'], thresholds: number[]): IndicatorDef => ({
  id,
  label,
  description,
  unit: MIN,
  file: `${id}.json`,
  layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds } },
  format: hm,
  formatTick: (v) => (v >= 60 ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}` : `${v}`),
});

export const timeUse: TopicDefinition = {
  id: 'time-use',
  title: { zh: '一天的時間怎麼用：休閒、睡眠與家務', en: 'How people spend their day: leisure, sleep and housework' },
  shortTitle: { zh: '時間運用', en: 'Time use' },
  defaultIndicator: 'leisure',
  defaultYear: 2026,
  timeless: true,
  noValue: { zh: '台灣的時間運用調查（主計總處）最近一次是 2004 年', en: 'Taiwan’s last time-use survey (DGBAS) was in 2004' },
  sources: [
    {
      name: { zh: 'OECD Gender Data Portal：Time use（時間運用）', en: 'OECD Gender Data Portal: Time use' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_TIME_USE%40DF_TIME_USE&df[ag]=OECD.WISE.INE',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'Eurostat：Harmonised European Time Use Surveys 2020 波次（tus_20age）', en: 'Eurostat: Harmonised European Time Use Surveys, 2020 wave (tus_20age)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/tus_20age/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'OECD How’s Life?：Current well-being（自己的時間、時間運用滿意度、社交時間）', en: 'OECD How’s Life?: Current well-being (time off, satisfaction with time use, social interactions)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_HSL%40DF_HSL_CWB&df[ag]=OECD.WISE.WDP',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '休閒、個人照顧、無酬工作與男女差距是 OECD 整理的各國時間運用調查（35 國），各國的調查年份不同、OECD 沒有列出，分類也不完全一致（OECD 把一半以上的國家標成「定義不同」，滑過國家看）；睡眠算在個人照顧裡（還有吃飯、盥洗）。睡覺、通勤、看電視是歐盟統一的時間運用調查 2020 波次（11 國，各國約 2018–2023 年調查），是全部人口的平均（沒做的人算 0），通勤只算上下班。自己的時間、時間運用滿意度、社交時間是 OECD How’s Life 的指標，各國取最近一年，年份差很多（滑過國家看）。台灣的時間運用調查只辦過 2000 與 2004 年，沒有資料。',
    en: 'Leisure, personal care, unpaid work and the gender gap come from national time-use surveys compiled by the OECD (35 countries). Survey years differ by country and are not listed by the OECD, and categories are not fully harmonised (the OECD flags more than half of the countries as “definition differs”; hover to see). Sleep is part of personal care (with eating and grooming). Sleep, commuting and television come from the 2020 wave of the Harmonised European Time Use Surveys (11 countries, fielded about 2018–2023) and are averages over the whole population (counting zero for those who did not do the activity); commuting means travel to and from work only. Time off, satisfaction with time use and social time are OECD How’s Life indicators, taking each country’s latest year, which varies widely (hover to see). Taiwan has run time-use surveys only in 2000 and 2004, so it has no data.',
  },
  indicators: [
    minutes(
      'leisure',
      { zh: '一天的休閒時間', en: 'Leisure a day' },
      {
        zh: '一天花多少時間在休閒（運動、看電視、社交、上網、娛樂等）。挪威 5 小時 54 分最多，德國、比利時、希臘都超過 5 小時半；美國 4 小時 40 分、日本 4 小時 29 分、南韓 4 小時 18 分、印度 4 小時 14 分；中國 3 小時 48 分、加拿大 3 小時 31 分、墨西哥 3 小時 23 分最少。',
        en: 'Time spent on leisure a day (sport, TV, socialising, internet, entertainment and so on). Norway leads at 5 h 54 min, with Germany, Belgium and Greece above 5½ hours; the US 4 h 40 min, Japan 4 h 29 min, South Korea 4 h 18 min and India 4 h 14 min; China 3 h 48 min, Canada 3 h 31 min and Mexico least at 3 h 23 min.',
      },
      [210, 240, 270, 300, 330],
    ),
    minutes(
      'personal-care',
      { zh: '睡覺、吃飯與盥洗', en: 'Sleep, eating and personal care' },
      {
        zh: '一天花多少時間在個人照顧：睡覺、吃飯、盥洗。法國 12 小時 32 分最多，保加利亞、義大利、南非、中國也長；日本 10 小時 40 分、挪威 10 小時 13 分、墨西哥 10 小時 6 分最少。',
        en: 'Time spent on personal care a day: sleeping, eating and grooming. France leads at 12 h 32 min, followed by Bulgaria, Italy, South Africa and China; Japan 10 h 40 min, Norway 10 h 13 min and Mexico 10 h 6 min are lowest.',
      },
      [630, 660, 690, 720],
    ),
    minutes(
      'unpaid-work',
      { zh: '一天的無酬家務', en: 'Unpaid work a day' },
      {
        zh: '一天花多少時間在沒有薪水的工作：煮飯、打掃、照顧家人、購物、志工。墨西哥 4 小時 16 分、波蘭 4 小時 8 分、澳洲 4 小時 3 分最多；日本 2 小時 5 分、南韓 2 小時 12 分最少，中國 2 小時 44 分（男女平均）。',
        en: 'Time spent on unpaid work a day: cooking, cleaning, caring for family, shopping and volunteering. Mexico 4 h 16 min, Poland 4 h 8 min and Australia 4 h 3 min are highest; Japan 2 h 5 min and South Korea 2 h 12 min lowest, with China at 2 h 44 min (average of women and men).',
      },
      [150, 180, 200, 220, 240],
    ),
    minutes(
      'unpaid-gap',
      { zh: '無酬家務的男女差距', en: 'Gender gap in unpaid work' },
      {
        zh: '女性一天比男性多做幾分鐘無酬家務。印度 300 分鐘（5 小時）最多，土耳其、葡萄牙、墨西哥都超過 3 小時，義大利、南韓、日本、中國也多；北歐最少：芬蘭 47、瑞典 49、挪威 52 分鐘，美國 76 分鐘。滑過國家看女性與男性各做多少。',
        en: 'How many more minutes of unpaid work women do than men each day. India has the largest gap at 300 minutes (5 hours), with Türkiye, Portugal and Mexico above 3 hours and Italy, South Korea, Japan and China also high; the Nordics are lowest: Finland 47, Sweden 49 and Norway 52 minutes, and the US 76. Hover to see women’s and men’s time.',
      },
      [60, 90, 120, 150, 200],
    ),
    minutes(
      'sleep',
      { zh: '一天睡多久（歐洲）', en: 'Sleep a day (Europe)' },
      {
        zh: '一天睡覺的時間（歐盟統一時間運用調查 2020 波次，只有 11 國）。保加利亞 9 小時 17 分最多，愛沙尼亞、奧地利、荷蘭、德國 8 小時 40 到 51 分，匈牙利 8 小時 14 分最少。',
        en: 'Time spent sleeping a day (2020 wave of the Harmonised European Time Use Surveys, 11 countries only). Bulgaria sleeps longest at 9 h 17 min, Estonia, Austria, the Netherlands and Germany 8 h 40–51 min, and Hungary least at 8 h 14 min.',
      },
      [500, 510, 520, 530],
    ),
    minutes(
      'commute',
      { zh: '一天的上下班通勤（歐洲）', en: 'Commuting a day (Europe)' },
      {
        zh: '一天花在上下班路上的時間，全部人口的平均（沒上班的人算 0，所以比上班族的通勤短）。匈牙利 25 分鐘最多，克羅埃西亞、保加利亞 22 分鐘；德國 13、芬蘭 10 分鐘最少。只有 11 國。',
        en: 'Time spent commuting to and from work a day, averaged over the whole population (people not working count as zero, so it is shorter than a worker’s commute). Hungary is highest at 25 minutes, Croatia and Bulgaria 22; Germany 13 and Finland 10 are lowest. 11 countries only.',
      },
      [12, 15, 18, 21, 24],
    ),
    minutes(
      'tv',
      { zh: '一天看電視（歐洲）', en: 'Television a day (Europe)' },
      {
        zh: '一天看電視、影片的時間。塞爾維亞 2 小時 27 分最多，芬蘭 2 小時 19 分，德國、奧地利 2 小時 7 分；挪威 1 小時 49 分最少。只有 11 國。',
        en: 'Time spent watching television or video a day. Serbia is highest at 2 h 27 min, Finland 2 h 19 min, Germany and Austria 2 h 7 min; Norway is lowest at 1 h 49 min. 11 countries only.',
      },
      [110, 120, 130, 140],
    ),
    // 2026-11-08（製作手冊第二十七批 653，候選 1431）
    minutes(
      'gaming',
      { zh: '一天打電玩（歐洲）', en: 'Video games a day (Europe)' },
      {
        zh: '一天玩電腦、主機與手機遊戲的時間，全部人口的平均（不玩的人算 0）。挪威 23 分鐘最多，芬蘭 19、德國 17，荷蘭、愛沙尼亞、奧地利 12；克羅埃西亞 4 分鐘最少。只有 11 國。',
        en: 'Time spent playing computer, console and mobile games a day, averaged over the whole population (non-players count as zero). Norway is highest at 23 minutes, then Finland 19 and Germany 17, with the Netherlands, Estonia and Austria at 12; Croatia is lowest at 4 minutes. 11 countries only.',
      },
      [5, 10, 15, 20],
    ),
    {
      id: 'time-off',
      label: { zh: '自己的時間', en: 'Time off' },
      description: {
        zh: '一天扣掉工作與家務，留給休閒與個人照顧（含睡眠）的時間（OECD How’s Life）。義大利 16.5 小時、法國 16.2 小時最多，澳洲 14.4 小時最少；日本 15.2、南韓 14.8、美國 14.7 小時。各國調查年份差很多（澳洲 2006、奧地利 2022）。',
        en: 'Hours a day left for leisure and personal care (including sleep) after work and chores (OECD How’s Life). Italy 16.5 and France 16.2 hours lead, Australia 14.4 is lowest; Japan 15.2, South Korea 14.8 and the US 14.7. Survey years differ widely (Australia 2006, Austria 2022).',
      },
      unit: { zh: '小時／天', en: 'hours a day' },
      file: 'time-off.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [14.5, 15, 15.5, 16] } },
      format: (v) => tr({ zh: `${fixed(v, 1)} 小時`, en: `${fixed(v, 1)} h` }),
      formatTick: (v) => `${v}`,
    },
    {
      id: 'time-satisfaction',
      label: { zh: '時間運用滿意度', en: 'Satisfaction with time use' },
      description: {
        zh: '對自己怎麼用時間有多滿意，0 到 10 分（OECD How’s Life，多半是 2021–2022 年）。加拿大 7.8、墨西哥 7.7、芬蘭 7.7 最高；希臘 5.5、以色列 6.0 最低。跟「幸福感」主題的生活評價不同：這裡只問時間怎麼用。',
        en: 'How satisfied people are with how they use their time, on a 0–10 scale (OECD How’s Life, mostly 2021–2022). Canada 7.8, Mexico 7.7 and Finland 7.7 are highest; Greece 5.5 and Israel 6.0 lowest. Unlike the life evaluations in the Happiness topic, this asks only about time use.',
      },
      unit: { zh: '分（0–10）', en: 'score (0–10)' },
      file: 'time-satisfaction.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [6.5, 7, 7.25, 7.5] } },
      format: (v) => tr({ zh: `${fixed(v, 2)} 分`, en: fixed(v, 2) }),
      formatTick: (v) => `${v}`,
    },
    {
      id: 'social-time',
      label: { zh: '一週的社交時間', en: 'Social time a week' },
      description: {
        zh: '一週花多少時間在社交互動：跟親友相處、聊天、聚會（OECD How’s Life）。荷蘭 8.4、土耳其 8.2、紐西蘭 7.8 小時最多；日本只有 1.2 小時，遠低於其他國家，南韓 4.9、美國 5.1 小時。',
        en: 'Hours a week spent socialising (OECD How’s Life). The Netherlands 8.4, Türkiye 8.2 and New Zealand 7.8 hours lead; Japan has only 1.2 hours, far below everyone else, South Korea 4.9 and the US 5.1.',
      },
      unit: { zh: '小時／週', en: 'hours a week' },
      file: 'social-time.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [4, 5, 6, 7] } },
      format: (v) => tr({ zh: `${fixed(v, 1)} 小時`, en: `${fixed(v, 1)} h` }),
      formatTick: (v) => `${v}`,
    },
  ],
};
