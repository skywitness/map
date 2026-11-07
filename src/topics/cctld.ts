import { tr } from '../i18n/lang';
import type { CategoryDef, TopicDefinition } from './types';

/**
 * 國家網域（ccTLD）被誰拿去用（2026-11-07，製作手冊第二十五批 507，候選 1179）：pipeline/topics/cctld.py。
 * 英文維基固定版本的備註用關鍵字歸類（註冊限制、被借用），委派年份用 Wikidata；台灣的側欄是 TWNIC 的 .tw 註冊數
 */

const BORROWED: CategoryDef[] = [
  { value: 1, label: { zh: '被借用當別的意思（.tv、.ai、.io、.fm…）', en: 'Borrowed for another meaning (.tv, .ai, .io, .fm…)' } },
  { value: 0, label: { zh: '維基沒有記載借用', en: 'No borrowing noted on Wikipedia' }, color: '#c9c4b8' },
];

const RESTRICTION: CategoryDef[] = [
  { value: 1, label: { zh: '只給本國（或歐盟等）的人與公司', en: 'Local (or EU-wide) registrants only' } },
  { value: 2, label: { zh: '全球開放，不必本地據點', en: 'Open worldwide, no local presence needed' } },
];

const DOMAIN_NOTE = {
  zh: '國碼頂級網域（ccTLD）是依 ISO 3166-1 的兩個字母代碼給各國與屬地的網域（.tw、.jp、.uk）。有些小國把網域賣給全世界，因為代碼剛好是英文縮寫：吐瓦魯的 .tv（電視）由 VeriSign 旗下的 dotTV 經營、吐瓦魯政府持股兩成；安圭拉的 .ai 被 AI 公司搶著用；英屬印度洋領地的 .io 被當成 input/output；安地卡的 .ag 被德國的股份公司（Aktiengesellschaft）用；密克羅尼西亞的 .fm 與亞美尼亞的 .am 被電台用。分類是從英文維基「Country code top-level domain」固定版本（revid 1383901539）的備註用關鍵字歸類，再逐筆看過；維基的備註不是結構化欄位，很多網域沒寫，也會過時。',
  en: 'Country code top-level domains (ccTLDs) are assigned to countries and territories by their two-letter ISO 3166-1 codes (.tw, .jp, .uk). Some small countries sell their domains worldwide because the code happens to spell something: Tuvalu’s .tv (television) is run by dotTV, a VeriSign company in which the Tuvalu government holds 20%; Anguilla’s .ai is sought after by AI companies; the British Indian Ocean Territory’s .io is read as input/output; Antigua’s .ag is used by German Aktiengesellschaften; Micronesia’s .fm and Armenia’s .am are used by radio stations. The classes come from keyword matching on the notes in a fixed revision of the English Wikipedia article “Country code top-level domain” (revid 1383901539), checked one by one; the notes are free text, many domains have none, and they go out of date.',
};

export const cctld: TopicDefinition = {
  id: 'cctld',
  title: { zh: '國家網域（ccTLD）被誰拿去用', en: 'Who uses country code domains' },
  shortTitle: { zh: '國碼網域', en: 'ccTLDs' },
  defaultIndicator: 'borrowed',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: { zh: '英文維基百科「Country code top-level domain」（revid 1383901539，2026-11-05）', en: 'English Wikipedia, “Country code top-level domain” (revid 1383901539, 5 November 2026)' },
      url: 'https://en.wikipedia.org/w/index.php?title=Country_code_top-level_domain&oldid=1383901539',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: 'Wikidata：ccTLD 的啟用日期（P571）', en: 'Wikidata: ccTLD inception dates (P571)' },
      url: 'https://www.wikidata.org/wiki/Q42032',
      license: 'CC0',
    },
    {
      name: { zh: '數位發展部：.tw、.台灣之網域名稱申請數量（TWNIC 統計資料）', en: 'Ministry of Digital Affairs (Taiwan): .tw and .台灣 domain registrations (TWNIC)' }, // i18n-ignore
      url: 'https://data.gov.tw/dataset/165202',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, Taiwan, v1' },
    },
  ],
  note: DOMAIN_NOTE,
  panelExtra: () => import('./panels/CctldPanel'),
  indicators: [
    {
      id: 'borrowed',
      label: { zh: '國碼網域被借用當別的意思', en: 'Country domains borrowed for other meanings' },
      description: {
        zh: '英文維基的備註寫了這個國碼網域「也被非正式地拿去用」的國家或屬地（42 個）：.tv 電視、.ai 人工智慧、.io 輸入輸出、.me 與 .is 當英文字（love.me、it.is）、.ly 當英文字尾、.co 當成公司、.fm 與 .am 電台、.gg 遊戲、.dj、.cd 光碟、.la 與 .lv 當洛杉磯、拉斯維加斯，.be、.yt 被 YouTube 相關網站用，.nu 在丹麥、荷蘭、瑞典是「現在」，.tk、.ml、.gq、.cf 曾當免費網域。灰色是維基沒寫，不代表沒人借用。',
        en: 'Countries and territories whose ccTLD the English Wikipedia notes as also being used unofficially (42): .tv television, .ai artificial intelligence, .io input/output, .me and .is as English words (love.me, it.is), .ly as a suffix, .co for companies, .fm and .am radio, .gg gaming, .dj, .cd compact discs, .la and .lv for Los Angeles and Las Vegas, .be and .yt for YouTube-related sites, .nu meaning “now” in Danish, Dutch and Swedish, and .tk, .ml, .gq and .cf as free domains. Grey means Wikipedia does not say, not that nobody borrows it.',
      },
      unit: '',
      file: 'borrowed.json',
      layer: { kind: 'categorical', categories: BORROWED },
      format: (v) => tr(BORROWED.find((c) => c.value === v)?.label ?? { zh: '', en: '' }),
    },
    {
      id: 'restriction',
      label: { zh: '誰可以註冊這個國碼網域', en: 'Who can register the country domain' },
      description: {
        zh: '英文維基的備註寫了註冊限制的國家或屬地：只給本國（或歐盟、歐洲經濟區）的人與公司 37 個，例如 .us、.cn、.jp、.au、.ca、.fr、.it、.no；全球開放、不必本地據點的 7 個：.tw、.fi、.co、.cc、.al（2022 年起不必公民身分）、.tz（2022 年起）、.hm。其他的維基沒寫（不畫），很多其實也全球開放。台灣的 .tw 從 1989 年委派，維基也記了 IANA 的立場：TW「designated for use to represent Taiwan, Province of China」（依 ISO 3166-1），本站不採用這個說法。',
        en: 'Countries and territories whose registration rules are noted on English Wikipedia: local (or EU/EEA-wide) individuals and companies only for 37, such as .us, .cn, .jp, .au, .ca, .fr, .it and .no; open worldwide without a local presence for 7: .tw, .fi, .co, .cc, .al (no citizenship needed since 2022), .tz (since 2022) and .hm. The rest are not noted (not shown), though many are also open. Taiwan’s .tw was delegated in 1989; Wikipedia also records IANA’s position that TW is “designated for use to represent Taiwan, Province of China” (following ISO 3166-1), which this site does not adopt.',
      },
      unit: '',
      file: 'restriction.json',
      layer: { kind: 'categorical', categories: RESTRICTION },
      format: (v) => tr(RESTRICTION.find((c) => c.value === v)?.label ?? { zh: '', en: '' }),
      missing: { zh: '維基沒寫註冊限制', en: 'Registration rules not noted on Wikipedia' },
    },
    {
      id: 'delegated',
      label: { zh: '國碼網域的啟用年份', en: 'Year the country domain was created' },
      description: {
        zh: '國碼網域的啟用年份（Wikidata 的 P571，多半是 IANA 的委派日）。最早一批是 1985 年的 .us、.uk、.il；1986 年 .jp、.kr、.de 等；.cn 1990 年；台灣的 .tw 1989 年。最晚的是新國家或新屬地：.ps 2000 年、.cw 與 .sx 2010 年、南蘇丹的 .ss 2019 年。',
        en: 'Year each ccTLD was created (Wikidata P571, mostly the IANA delegation date). The first were .us, .uk and .il in 1985, then .jp, .kr, .de and others in 1986; .cn in 1990; Taiwan’s .tw in 1989. The latest belong to new states or territories: .ps in 2000, .cw and .sx in 2010, South Sudan’s .ss in 2019.',
      },
      unit: { zh: '年', en: 'year' },
      file: 'delegated.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1987, 1990, 1993, 1995, 1997, 2000] } },
      format: (v) => String(v),
      formatTick: (v) => String(v),
      lowerIsBetter: true,
    },
  ],
};
