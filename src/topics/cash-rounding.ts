import type { TopicPart } from './parts';
import type { CategoryDef } from './types';
import { tr } from '../i18n/lang';

/**
 * 付現金時湊整到多少（2026-11-05，製作手冊第二十二批 395；pipeline/topics/prices_cash_rounding.py，資料在 fiscal/）：
 * 英文維基「Cash rounding」逐國整理（表加散文），物價與消費主題（prices.ts）用 withParts 接上。資料檔 CC BY-SA 4.0。
 */

/** 級距（pipeline 的 PERIODS 第三欄） */
export const CASH_STEPS: CategoryDef[] = [
  { value: 1, label: { zh: '湊到 5 個最小單位（0.05 元、5 福林…）', en: 'To 5 minor units (0.05, 5 forints…)' } },
  { value: 2, label: { zh: '湊到 10 個最小單位（0.10 元、10 韓元…）', en: 'To 10 minor units (0.10, 10 won…)' } },
  { value: 3, label: { zh: '湊到 0.25', en: 'To 0.25' } },
  { value: 4, label: { zh: '湊到 0.50', en: 'To 0.50' } },
  { value: 5, label: { zh: '湊到整數（1 克朗、1 盧比…）', en: 'To whole units (1 krona, 1 rupee…)' } },
  { value: 6, label: { zh: '其他（越南湊到 1,000 盾）', en: 'Other (Vietnam, to 1,000 dong)' } },
];

export const cashRoundingPart: TopicPart = {
  name: { zh: '付現金時湊整', en: 'Cash rounding' },
  sources: [
    {
      name: { zh: '英文維基百科「Cash rounding」（2026 年 9 月 16 日的版本）', en: 'Wikipedia, “Cash rounding” (revision of 16 September 2026)' },
      url: 'https://en.wikipedia.org/w/index.php?title=Cash_rounding&oldid=1375275378',
      license: 'CC BY-SA 4.0',
    },
  ],
  note: {
    zh: '最小的硬幣不再流通或不再發行時，付現金的總額湊到最近的可找零金額（刷卡、轉帳通常不湊）。依英文維基「Cash rounding」逐國整理：只有「湊到 0.05」那一節有表，其他級距是條目的敘述；條目沒寫開始年份的國家只畫在最新的一年，條目沒提到的國家（包括台灣）是沒有資料，不代表不湊整。有的是法律規定（比利時），有的是商家習慣或自願（中國、愛爾蘭、義大利、美國），滑過國家看。資料檔依 CC BY-SA 4.0 分享。',
    en: 'When the smallest coins are withdrawn or no longer issued, cash totals are rounded to the nearest amount that can be paid (card and bank payments usually are not). Compiled country by country from the Wikipedia article “Cash rounding”: only the 0.05 section has a table, and the other intervals come from the article’s text. Countries with no start year in the article are shown in the latest year only; countries the article does not mention (including Taiwan) have no data, which does not mean they never round. In some places rounding is required by law (Belgium), in others it is merchant practice or optional (China, Ireland, Italy, the US); hover to see. The data file is shared under CC BY-SA 4.0.',
  },
  panelExtra: () => import('./panels/CashRoundingPanel'),
  indicators: [
    {
      id: 'cash-rounding',
      label: { zh: '付現金時湊整到多少', en: 'Cash rounding' },
      description: {
        zh: '付現金時總額湊到最近的多少（依英文維基「Cash rounding」逐國整理，1960 年起；拖時間軸看小硬幣一個個消失）。2026 年 53 個國家與地區裡，31 個湊到 5 個最小單位（加拿大、澳洲、瑞士、荷蘭、比利時、愛爾蘭、新加坡、馬來西亞…），10 個湊到 10（香港、中國、南韓、紐西蘭、以色列、南非…），阿聯、卡達、泰國湊到 0.25，丹麥、奈及利亞湊到 0.50，瑞典、挪威、捷克、印度、牙買加湊到整數。瑞典 1972 年就開始湊整，一路從 0.05、0.10、0.50 升到 2010 年起的 1 克朗。美國 2025 年停鑄 1 分，商家可以但不一定要湊到 5 分。條目沒提到台灣。',
        en: 'What cash totals are rounded to (compiled from the Wikipedia article “Cash rounding”, from 1960; drag the timeline to watch small coins disappear). Of 53 countries and territories in 2026, 31 round to 5 minor units (Canada, Australia, Switzerland, the Netherlands, Belgium, Ireland, Singapore, Malaysia…), 10 to 10 (Hong Kong, China, South Korea, New Zealand, Israel, South Africa…), the UAE, Qatar and Thailand to 0.25, Denmark and Nigeria to 0.50, and Sweden, Norway, Czechia, India and Jamaica to whole units. Sweden began in 1972 and stepped up from 0.05 to 0.10, 0.50 and, since 2010, 1 krona. The US stopped minting pennies in 2025, and merchants may, but need not, round to 5 cents. The article does not mention Taiwan.',
      },
      unit: '',
      file: 'cash-rounding.json',
      defaultYear: 'latest',
      layer: { kind: 'categorical', categories: CASH_STEPS },
      format: (v) => tr(CASH_STEPS.find((c) => c.value === v)?.label ?? ''),
    },
  ],
};
