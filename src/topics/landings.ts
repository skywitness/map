import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { IndicatorDef, TopicDefinition } from './types';

/**
 * 月球與火星的登陸點（pipeline/topics/landings.py）：英文維基「List of landings on extraterrestrial bodies」的月球、火星兩張表，
 * 在地球地圖上畫各國累計的登陸次數（使用者 2026-10-30 決定：先不做月球、火星的底圖）。
 * 2026-10-30（第七批 118）併進「太空：衛星與發射」，這裡只匯出指標、資料來源與說明。
 */

/** 結果（pipeline 的 kind，依條目的列底色） */
export const OUTCOMES: Record<number, Text> = {
  1: { zh: '撞擊或著陸失敗', en: 'Impact or failed landing' },
  2: { zh: '成功軟著陸', en: 'Soft landing' },
  3: { zh: '軟著陸並送回樣本', en: 'Soft landing with sample return' },
  4: { zh: '載人登陸', en: 'Crewed landing' },
};

const times = (v: number) => tr({ zh: `${fixed(v, 0)} 次`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'landing' : 'landings'}` });

function indicator(id: string, label: Text, description: Text, legend: number[]): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: { zh: '次', en: 'landings' },
    file: `${id}.json`,
    layer: { kind: 'bubble', legendValues: legend },
    format: times,
    formatTick: (v) => fixed(v, 0),
    integer: true,
    shareOfWorld: true,
    missing: { zh: '沒有', en: 'None' },
  };
}

/** 太空主題（space.ts）的月球與火星登陸部分：2026-10-30 起併進太空（原本是獨立的主題「月球與火星的登陸」） */
export const landingsPart = {
  sources: [
    {
      name: {
        zh: '英文維基百科「List of landings on extraterrestrial bodies」（2026-08-31 的版本）',
        en: 'English Wikipedia, “List of landings on extraterrestrial bodies” (revision of 31 August 2026)',
      },
      url: 'https://en.wikipedia.org/w/index.php?oldid=1372275847',
      license: 'CC BY-SA 4.0',
    },
  ],
  note: {
    zh:
      '依英文維基百科「List of landings on extraterrestrial bodies」2026 年 8 月 31 日的版本：每一次抵達月球或火星表面算一次，包括成功的軟著陸、刻意的撞擊與失敗的著陸（墜毀），結果依條目的分類。國家依任務的國旗；蘇聯算在繼承國俄羅斯，合作任務每個國家各算一次，只有歐洲太空總署的（SMART-1 撞擊月球）不算進任何國家。' +
      '嫦娥六號的上升段刻意撞擊月球是同一個任務，不另外算；預定的任務（韓國 2032 年的登月）不算。地圖畫的是派出任務的國家，不是登陸的位置（月球、火星的地圖還沒有做）。台灣沒有登陸任務。資料檔依維基百科的 CC BY-SA 4.0 分享。',
    en:
      'Based on the English Wikipedia article “List of landings on extraterrestrial bodies” as of 31 August 2026: every arrival on the surface of the Moon or Mars counts once, including successful soft landings, deliberate impacts and failed landings (crashes), classified as in the article. Countries follow each mission’s flag; Soviet missions count for Russia as the successor state, joint missions count once for each country, and the one European Space Agency mission (SMART-1’s lunar impact) counts for no country. ' +
      'The deliberate impact of Chang’e 6’s ascent stage is part of the same mission and is not counted separately; planned missions (South Korea’s 2032 lander) are excluded. The map shows the countries that sent the missions, not where they landed (maps of the Moon and Mars are not available yet). Taiwan has had no landing mission. The data files are shared under Wikipedia’s CC BY-SA 4.0.',
  },
  indicators: [
    indicator(
      'moon',
      { zh: '抵達月球表面的次數', en: 'Moon landings and impacts' },
      {
        zh: '1959 年蘇聯的月球 2 號撞上月球以來，各國的探測器、太空人抵達月球表面的次數（累計，含撞擊與失敗的著陸）。美國 25 次（含 6 次阿波羅載人登陸）、蘇聯與俄羅斯 15、日本 6、中國 5、印度 3、以色列 1。',
        en: 'Spacecraft and crews reaching the surface of the Moon since the Soviet Luna 2 struck it in 1959, cumulative and including impacts and failed landings: the US 25 (including six crewed Apollo landings), the Soviet Union and Russia 15, Japan 6, China 5, India 3 and Israel 1.',
      },
      [1, 5, 20],
    ),
    indicator(
      'moon-soft',
      { zh: '月球成功軟著陸', en: 'Successful Moon soft landings' },
      {
        zh: '在月球成功軟著陸並傳回資料的次數（累計，含送回樣本與載人登陸）。1966 年蘇聯的月球 9 號第一次，2013 年中國的嫦娥三號、2023 年印度的月船三號、2024 年日本的 SLIM 先後成功。',
        en: 'Successful soft landings on the Moon that returned data, cumulative and including sample returns and crewed landings. The Soviet Luna 9 was first in 1966; China’s Chang’e 3 (2013), India’s Chandrayaan-3 (2023) and Japan’s SLIM (2024) followed.',
      },
      [1, 5, 10],
    ),
    indicator(
      'mars',
      { zh: '抵達火星表面的次數', en: 'Mars landings and impacts' },
      {
        zh: '1971 年蘇聯的火星 2 號墜落火星以來，各國的探測器抵達火星表面的次數（累計，含失敗的著陸）。美國 10 次、蘇聯 4、英國 1（小獵犬 2 號）、中國 1。',
        en: 'Spacecraft reaching the surface of Mars since the Soviet Mars 2 crashed there in 1971, cumulative and including failed landings: the US 10, the Soviet Union 4, the UK 1 (Beagle 2) and China 1.',
      },
      [1, 5, 10],
    ),
    indicator(
      'mars-soft',
      { zh: '火星成功軟著陸', en: 'Successful Mars soft landings' },
      {
        zh: '在火星成功軟著陸並傳回資料的次數（累計）：美國 9 次（海盜號、好奇號、毅力號等），蘇聯 1 次（火星 3 號，開始傳送約 20 秒後就斷訊），中國 1 次（2021 年天問一號的祝融號）。',
        en: 'Successful soft landings on Mars that returned data, cumulative: the US 9 (Viking, Curiosity, Perseverance and others), the Soviet Union 1 (Mars 3, which fell silent about 20 seconds into its transmission) and China 1 (Tianwen-1’s Zhurong rover in 2021).',
      },
      [1, 5, 10],
    ),
  ],
} satisfies Partial<TopicDefinition>;
