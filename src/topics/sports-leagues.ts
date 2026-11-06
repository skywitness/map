import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicPart } from './parts';

/**
 * 運動的擴充：聯賽、俱樂部與進場人數（2026-11-06，製作手冊第二十四批 426；pipeline/topics/sports_leagues.py）。
 * Wikidata 的聯賽與俱樂部數（覆蓋偏差大，只能說「Wikidata 上有幾個」），英文維基百科的聯賽平均進場人數，台灣用運動部的中職觀眾人次。
 */
const count = (unit: { zh: string; en: string }) => (v: number) => tr({ zh: `${fixed(v, 0)} ${unit.zh}`, en: `${fixed(v, 0)} ${unit.en}` });

export const sportsLeaguesPart: TopicPart = {
  name: { zh: '聯賽、俱樂部與進場人數', en: 'Leagues, clubs and attendance' },
  sources: [
    { name: { zh: 'Wikidata（運動聯賽與俱樂部，經 QLever 查詢）', en: 'Wikidata (sports leagues and clubs, queried via QLever)' }, url: 'https://www.wikidata.org/wiki/Q623109', license: 'CC0' },
    {
      name: {
        zh: '英文維基百科「List of attendance figures at domestic professional sports leagues」（revid 1382037028，平均進場人數）',
        en: 'English Wikipedia, “List of attendance figures at domestic professional sports leagues” (revision 1382037028, average attendance)',
      },
      url: 'https://en.wikipedia.org/wiki/List_of_attendance_figures_at_domestic_professional_sports_leagues?oldid=1382037028',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: '運動部：中華職棒大聯盟歷年現場觀眾總人次、平均單場人次（data.gov.tw 11284）', en: 'Sports Administration (Taiwan): CPBL attendance (data.gov.tw 11284)' },
      url: 'https://data.gov.tw/dataset/11284',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: {
    zh: '聯賽與俱樂部是 Wikidata 上標成運動聯賽、運動俱樂部（含子類別，例如足球俱樂部）而且有國家的項目，Wikidata 的覆蓋差很多（德國 1 萬多個俱樂部，台灣 55 個），也分不出職業與業餘，不能當運動風氣讀。進場人數照英文維基百科條目的「平均進場人數」表，只取第一級聯賽（資料檔依 CC BY-SA 4.0 分享）；球季從 2017 到 2025 不一樣，有的只算常規賽、有的是售票數，條目自己也這麼註明。跨國聯賽（美國職棒、NHL、NBA 有加拿大球隊）兩國都算。台灣用運動部的中職觀眾人次，開放資料只到 2023 年。',
    en: 'Leagues and clubs are Wikidata items typed as sports leagues or sports clubs (including subclasses such as football clubs) with a country. Wikidata coverage varies greatly (over 10,000 clubs for Germany, 55 for Taiwan) and does not separate professional from amateur, so do not read it as how sporty a country is. Attendance follows the average attendance table of the English Wikipedia article, top-tier leagues only (the data file is shared under CC BY-SA 4.0); seasons range from 2017 to 2025, and some count regular seasons only or tickets sold, as the article notes. Cross-border leagues (MLB, the NHL and the NBA have Canadian teams) count for both countries. Taiwan uses the Sports Administration’s CPBL attendance, whose open data stops at 2023.',
  },
  indicators: [
    {
      id: 'league-attendance',
      label: { zh: '頂級聯賽的平均進場人數', en: 'Top-league average attendance' },
      description: {
        zh: '這個國家平均每場進場最多的頂級職業聯賽有多少人（英文維基百科的整理，各聯賽最近一個完整球季）。美國國家美式足球聯盟 NFL 約 6.95 萬人最多，德甲 3.95 萬、英超 3.84 萬、澳式足球 AFL 3.84 萬、日本職棒 3.11 萬；滑過國家看前幾個聯賽。台灣是中華職棒，2023 年平均每場約 6,000 人（運動部的開放資料只到 2023 年）。',
        en: 'Average attendance per game of each country’s best-attended top-tier professional league (compiled by English Wikipedia, each league’s latest full season). The NFL leads with about 69,500, then the Bundesliga 39,500, the Premier League 38,400, the AFL 38,400 and Nippon Professional Baseball 31,100; hover for more leagues. Taiwan’s is the CPBL, about 6,000 per game in 2023 (the Sports Administration’s open data stops at 2023).',
      },
      unit: { zh: '人', en: 'people' },
      file: 'league-attendance.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5000, 10000, 15000, 20000, 30000, 40000] } },
      format: count({ zh: '人', en: 'per game' }),
      formatTick: (v) => `${v / 1000}k`,
      missing: { zh: '條目沒有這國的聯賽', en: 'No league listed for this country' },
    },
    {
      id: 'sport-leagues',
      label: { zh: 'Wikidata 上的運動聯賽', en: 'Sports leagues on Wikidata' },
      description: {
        zh: 'Wikidata 上有幾個這個國家的運動聯賽（全球 8,086 個有國家）。美國 2,139 個最多（含大學與小聯盟），英國 505、加拿大 438、澳洲 406、德國 388、日本 265、捷克 260；台灣 28 個。只能說 Wikidata 上有幾個，各國的編輯程度差很多。',
        en: 'Sports leagues on Wikidata for each country (8,086 with a country). The US has the most at 2,139 (including college and minor leagues), then the UK 505, Canada 438, Australia 406, Germany 388, Japan 265 and Czechia 260; Taiwan 28. This only counts what Wikidata has, and coverage varies greatly.',
      },
      unit: { zh: '個', en: 'leagues' },
      file: 'sport-leagues.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: count({ zh: '個', en: 'leagues' }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'sport-clubs',
      label: { zh: 'Wikidata 上的運動俱樂部', en: 'Sports clubs on Wikidata' },
      description: {
        zh: 'Wikidata 上有幾個這個國家的運動俱樂部（含足球俱樂部等子類別，全球 86,923 個有國家）。德國 10,738 最多，英國 6,632、美國 5,422、澳洲 3,790、西班牙 3,496、挪威 3,440、瑞典 3,372、法國 3,323；日本 771、南韓 332、台灣 55。只能說 Wikidata 上有幾個。',
        en: 'Sports clubs on Wikidata for each country (including subclasses such as football clubs; 86,923 with a country). Germany has the most at 10,738, then the UK 6,632, the US 5,422, Australia 3,790, Spain 3,496, Norway 3,440, Sweden 3,372 and France 3,323; Japan 771, South Korea 332, Taiwan 55. This only counts what Wikidata has.',
      },
      unit: { zh: '個', en: 'clubs' },
      file: 'sport-clubs.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      format: count({ zh: '個', en: 'clubs' }),
      formatTick: (v) => fixed(v, 0),
    },
  ],
};
