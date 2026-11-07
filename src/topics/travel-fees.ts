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

/** 外國旅客購物退稅（2026-11-07，433 的補強；pipeline/topics/tax_refund.py 的 HAS…NONE），逐國跟官方頁核對過的才上色 */
const REFUND_KINDS: CategoryDef[] = [
  { value: 1, label: { zh: '有外國旅客退稅', en: 'Tourist tax refunds' } },
  { value: 2, label: { zh: '已立法，開始了沒有未核對', en: 'Legislated; start not confirmed' } },
  { value: 3, label: { zh: '曾經有、已取消', en: 'Abolished' } },
  { value: 4, label: { zh: '沒有', en: 'None' } },
];

export const travelFeesPart: TopicPart = {
  name: { zh: '出境要繳的錢', en: 'Departure taxes' },
  sources: [
    {
      name: { zh: '英文維基百科「Departure tax」的表（revid 1371947177）', en: 'English Wikipedia, “Departure tax” table (revision 1371947177)' },
      url: 'https://en.wikipedia.org/wiki/Departure_tax?oldid=1371947177',
      license: { zh: 'CC BY-SA 4.0（引用事實）', en: 'CC BY-SA 4.0 (facts cited)' },
    },
    {
      name: {
        zh: '各國稅務機關、海關與財政部的旅客退稅說明（日本國稅廳、中國國務院、新加坡 IRAS、法國與德國海關…，2026-11-07 逐國核對；網址列在 pipeline/topics/tax_refund.py）',
        en: 'Tourist refund pages of national tax, customs and finance authorities (Japan’s National Tax Agency, China’s State Council, Singapore’s IRAS, French and German customs…, each checked on 7 November 2026; URLs in pipeline/topics/tax_refund.py)',
      },
      url: 'https://github.com/skywitness/map/blob/main/pipeline/topics/tax_refund.py',
      license: { zh: '引用事實', en: 'Facts cited' },
    },
    {
      name: { zh: '財政部關務署：辦理旅客購買特定貨物退稅人次、筆數、金額統計表（data.gov.tw 17153、17154、17156）', en: 'Customs Administration (Taiwan): tourist tax refund persons, cases and amounts (data.gov.tw 17153, 17154, 17156)' },
      url: 'https://data.gov.tw/dataset/17156',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: {
    zh: '出境稅跟簽證是兩回事：就算免簽證，離境時也可能要繳錢（日本對台灣免簽，但每個搭機或搭船離境的旅客都要繳 1,000 日圓）。資料是英文維基「Departure tax」的表，只有 37 國，不是完整的清單；怎麼收依表上的說明分類，金額寫在滑過的說明（只列當地幣別），沒有逐國跟各國官方核對，各國調整得很快，出發前請以官方公告為準。斯里蘭卡的金額明顯不合理，沒有列。台灣不在表上。外國旅客退稅（2026-11-07 加）沒有用維基的清單（明顯過期），而是挑 21 個地方逐國讀稅務機關、海關的官方頁核對，19 個核對成功；退稅不是退全部的稅，退稅公司會收手續費。',
    en: 'Departure taxes are separate from visas: even without a visa you may pay to leave (Japan waives visas for Taiwanese travellers but charges every departing air or sea passenger ¥1,000). The data are the table in English Wikipedia’s “Departure tax” article, covering only 37 countries, not a complete list; collection methods are classified from the table’s notes, and amounts appear in the tooltip (in local currency only). They have not been checked against each government’s own sources and change often, so check official notices before travelling. Sri Lanka’s amount is clearly implausible and is not shown. Taiwan is not in the table. Tourist tax refunds (added 7 November 2026) do not use Wikipedia’s out-of-date list: 21 places were checked one by one against the official pages of their tax or customs authorities, 19 successfully; refunds are not the whole tax, as refund companies charge a handling fee.',
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
    {
      id: 'tax-refund',
      label: { zh: '外國旅客購物退稅', en: 'Tourist tax refunds' },
      description: {
        zh: '外國旅客買東西帶出國，能不能退加值稅（營業稅、消費稅）。2026 年 11 月逐國讀稅務機關、海關的官方頁核對了 19 個地方，滑過看門檻、期限與稅率：日本 2026 年 11 月 1 日起改成先付稅、出境時海關確認後再退；門檻從西班牙的沒有最低金額、德國每張收據 50 歐元、新加坡 100 新加坡元，到瑞士 300 瑞士法郎；印尼看的是可退的稅額（50 萬印尼盾）不是消費額。英國（大不列顛 2021 年起）、加拿大已取消，紐西蘭沒有，菲律賓 2025 年訂了施行細則。台灣是同一天同一家特約商店含稅 2,000 元以上、90 天內出境；關務署統計 2015 年最多 64.3 萬人次、退稅 16.2 億元，2019 年 39.1 萬人次、8.0 億元，2020 年起因疫情幾乎歸零（開放資料只到 2021 年）。灰色是沒有核對，不代表沒有退稅。',
        en: 'Whether foreign visitors can reclaim VAT (sales or consumption tax) on goods they take home. Nineteen places were checked against the official pages of their tax or customs authorities in November 2026; hover for thresholds, deadlines and rates. From 1 November 2026 Japan collects the tax first and refunds it after customs checks on departure. Thresholds range from no minimum in Spain, €50 per receipt in Germany and S$100 in Singapore to CHF 300 in Switzerland, and Indonesia counts the refundable tax itself (Rp500,000) rather than the spend. The UK (Great Britain, from 2021) and Canada have abolished refunds, New Zealand has none, and the Philippines adopted implementing rules in 2025. In Taiwan it is NT$2,000 or more including tax at one participating shop in one day, leaving within 90 days; customs figures peaked at 643,000 refunds worth NT$1.62 billion in 2015, were 391,000 worth NT$0.80 billion in 2019 and almost vanished from 2020 with the pandemic (open data end in 2021). Grey means not checked, not that there is no refund.',
      },
      unit: '',
      file: 'tax-refund.json',
      layer: { kind: 'categorical', categories: REFUND_KINDS },
      format: (v) => tr(REFUND_KINDS.find((c) => c.value === v)?.label ?? ''),
      unranked: true,
      rankingBars: false,
      panelChart: false,
      missing: { zh: '沒有逐國核對', en: 'Not checked' },
    },
  ],
};
