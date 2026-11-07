import { tr } from '../i18n/lang';
import type { CategoryDef } from './types';
import type { TopicPart } from './parts';

/**
 * 旅行實用的擴充：出境要繳的錢（2026-11-07，製作手冊第二十四批 433；pipeline/topics/departure_tax.py）。
 * 英文維基「Departure tax」的表（37 國），依說明分怎麼收；金額寫在滑過的說明，沒有逐國跟官方核對。
 */

/** 怎麼收（pipeline 的 CITIZENS…UNKNOWN） */
const FEE_KINDS: CategoryDef[] = [
  { value: 4, label: { zh: '含在機票裡', en: 'Included in the ticket' } },
  { value: 3, label: { zh: '要另外付（現場付現或出境前繳）', en: 'Paid separately (cash or before departure)' } },
  { value: 2, label: { zh: '航空乘客稅（依距離、艙等）', en: 'Air passenger duty (by distance or class)' } },
  { value: 1, label: { zh: '只向本國人收', en: 'Citizens only' } },
  { value: 5, label: { zh: '表上沒寫怎麼收', en: 'Collection not stated' } },
];

export const travelFeesPart: TopicPart = {
  name: { zh: '出境要繳的錢', en: 'Departure taxes' },
  sources: [
    {
      name: { zh: '英文維基百科「Departure tax」的表（revid 1371947177）', en: 'English Wikipedia, “Departure tax” table (revision 1371947177)' },
      url: 'https://en.wikipedia.org/wiki/Departure_tax?oldid=1371947177',
      license: { zh: 'CC BY-SA 4.0（引用事實）', en: 'CC BY-SA 4.0 (facts cited)' },
    },
  ],
  note: {
    zh: '出境稅跟簽證是兩回事：就算免簽證，離境時也可能要繳錢（日本對台灣免簽，但每個搭機或搭船離境的旅客都要繳 1,000 日圓）。資料是英文維基「Departure tax」的表，只有 37 國，不是完整的清單；怎麼收依表上的說明分類，金額寫在滑過的說明（只列當地幣別），沒有逐國跟各國官方核對，各國調整得很快，出發前請以官方公告為準。斯里蘭卡的金額明顯不合理，沒有列。台灣不在表上。各國的外國旅客退稅（維基的清單與門檻表明顯過期）沒有做。',
    en: 'Departure taxes are separate from visas: even without a visa you may pay to leave (Japan waives visas for Taiwanese travellers but charges every departing air or sea passenger ¥1,000). The data are the table in English Wikipedia’s “Departure tax” article, covering only 37 countries, not a complete list; collection methods are classified from the table’s notes, and amounts appear in the tooltip (in local currency only). They have not been checked against each government’s own sources and change often, so check official notices before travelling. Sri Lanka’s amount is clearly implausible and is not shown. Taiwan is not in the table. Tourist VAT refunds are not mapped (Wikipedia’s list and threshold table are clearly out of date).',
  },
  indicators: [
    {
      id: 'departure-tax',
      label: { zh: '出境要繳的錢', en: 'Departure taxes' },
      description: {
        zh: '英文維基表上 37 國的出境稅、離境費怎麼收，滑過看金額：14 國含在機票裡（中國 90 人民幣、香港搭機 120 港幣、泰國 700 泰銖、澳洲 70 澳幣），6 國要另外付（菲律賓、孟加拉的陸路出境），德國、英國、荷蘭、瑞典、奧地利是依距離或艙等課的航空乘客稅（英國 13–194 英鎊），土耳其、伊朗只向本國人收；日本的國際觀光旅客稅 1,000 日圓（2019 年 1 月 7 日起）在表上沒寫怎麼收。表上沒有的國家是灰色，不代表不收。',
        en: 'How departure taxes and exit fees are collected in the 37 countries listed in English Wikipedia’s table; hover for amounts. 14 include them in the ticket (China CN¥90, Hong Kong HK$120 by air, Thailand ฿700, Australia A$70), 6 require separate payment (the Philippines, Bangladesh at land borders), Germany, the UK, the Netherlands, Sweden and Austria levy air passenger duty by distance or class (the UK £13–194), and Türkiye and Iran charge only their own citizens; Japan’s ¥1,000 international tourist tax (since 7 January 2019) has no collection method in the table. Grey countries are not in the table, which does not mean they charge nothing.',
      },
      unit: '',
      file: 'departure-tax.json',
      layer: { kind: 'categorical', categories: FEE_KINDS },
      format: (v) => tr(FEE_KINDS.find((c) => c.value === v)?.label ?? ''),
      unranked: true,
      rankingBars: false,
      panelChart: false,
      missing: { zh: '不在英文維基的表上', en: 'Not in the Wikipedia table' },
    },
  ],
};
