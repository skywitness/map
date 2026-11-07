import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 網路位址分給了誰：IPv4 與 IPv6 的存量（新主題，2026-11-07，製作手冊第二十七批 588，候選 1309；科技・網路與連線）：
 * APNIC 的 delegated-apnic-latest，pipeline/topics/ip_addresses.py。五個區域註冊機構的授權不一致，照手冊的退路只做 APNIC 區。
 */
/** 每人的位址數差好幾個數量級（新加坡 4.87、北韓 0.000038）：留三位有效數字 */
const perPerson = (v: number) => fixed(v, v >= 1 ? 2 : Math.min(6, 2 - Math.floor(Math.log10(v))));
const MISSING = {
  zh: '不在 APNIC 的服務區（亞太以外的區域註冊機構，授權不能用在這裡）',
  en: 'Outside APNIC’s service region (other regional registries’ terms do not allow this use)',
};
const NOTE = {
  zh: '只有 APNIC 的服務區（亞太）；國碼是登記的機構所在的國家，不一定是位址實際使用的地方。',
  en: 'APNIC’s service region (Asia-Pacific) only; the country is where the holder is registered, not necessarily where the addresses are used.',
};

export const ipAddresses: TopicDefinition = {
  id: 'ip-addresses',
  title: { zh: '網路位址分給了誰：IPv4 與 IPv6', en: 'Who got the internet addresses: IPv4 and IPv6' },
  shortTitle: { zh: 'IP 位址', en: 'IP addresses' },
  defaultIndicator: 'ipv4-per-person',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'APNIC：delegated-apnic-latest（亞太網路資訊中心的位址與 AS 號碼分配統計）', en: 'APNIC: delegated-apnic-latest (Asia Pacific Network Information Centre allocation statistics)' },
      url: 'https://ftp.apnic.net/stats/apnic/',
      license: { zh: 'APNIC 統計檔的使用條件（免費下載與使用，APNIC 不負責因使用造成的損失）', en: 'APNIC statistics conditions of use (free to download and use; APNIC is not liable for any loss)' },
    },
    {
      name: { zh: '聯合國《世界人口展望》（人口）', en: 'UN World Population Prospects (population)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  note: {
    zh: 'IP 位址與自治系統號碼（ASN，一個網路業者或大機構對外的編號）由五個區域網路註冊機構分配：亞太是 APNIC，歐洲與中東是 RIPE NCC，北美是 ARIN，拉丁美洲是 LACNIC，非洲是 AFRINIC。這裡只用 APNIC 公布的分配檔：RIPE NCC 的條款不准修改它的資料，ARIN 等其他機構找不到可以這樣使用的條款，所以亞太以外的國家灰色。時間軸是依分配日期累計到每一年年底；被收回、轉出的位址不在檔裡，早年的數字會偏低。IPv6 換成 /32 區塊（一個網路業者通常分到的大小）的個數。',
    en: 'IP addresses and autonomous system numbers (ASNs, the identifiers of network operators and large organisations) are allocated by five regional internet registries: APNIC for Asia-Pacific, RIPE NCC for Europe and the Middle East, ARIN for North America, LACNIC for Latin America and AFRINIC for Africa. Only APNIC’s published allocation file is used here: RIPE NCC’s terms forbid modifying its data and no terms permitting this use were found for ARIN and the others, so countries outside Asia-Pacific are grey. The timeline accumulates allocations by date up to the end of each year; reclaimed or transferred addresses are not in the file, so early years are understated. IPv6 is counted in /32 blocks (the size a network operator typically receives).',
  },
  indicators: [
    {
      id: 'ipv4-per-person',
      label: { zh: '每人分到幾個 IPv4 位址', en: 'IPv4 addresses per person' },
      description: {
        zh: `已分配的 IPv4 位址數 ÷ 人口。2026 年新加坡 4.87 個最多，南韓 2.18、香港 1.98、澳洲 1.69、台灣 1.55、日本 1.54、紐西蘭 1.23；中國 0.243、越南 0.161、印尼 0.0637、印度 0.0283；阿富汗 0.00392、緬甸 0.00448，北韓只有 0.000038（1,024 個位址）。IPv4 一共只有約 43 億個：日本、南韓、澳洲、台灣、新加坡、香港、紐西蘭的人口只占這一區的 5.5%，卻分到將近一半（48.8%）的 IPv4。${NOTE.zh}`,
        en: `Allocated IPv4 addresses divided by population. In 2026 Singapore has the most at 4.87, followed by South Korea 2.18, Hong Kong 1.98, Australia 1.69, Taiwan 1.55, Japan 1.54 and New Zealand 1.23; China 0.243, Vietnam 0.161, Indonesia 0.0637 and India 0.0283; Afghanistan 0.00392, Myanmar 0.00448 and North Korea only 0.000038 (1,024 addresses). There are only about 4.3 billion IPv4 addresses: Japan, South Korea, Australia, Taiwan, Singapore, Hong Kong and New Zealand have 5.5% of this region’s people but nearly half (48.8%) of its IPv4 addresses. ${NOTE.en}`,
      },
      unit: { zh: '個/人', en: 'per person' },
      file: 'ipv4-per-person.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.01, 0.03, 0.1, 0.3, 1, 2] } },
      format: (v) => tr({ zh: `每人 ${perPerson(v)} 個`, en: `${perPerson(v)} per person` }),
      formatTick: (v) => perPerson(v),
      missing: MISSING,
    },
    {
      id: 'ipv4',
      label: { zh: 'IPv4 位址數', en: 'IPv4 addresses' },
      description: {
        zh: `已分配的 IPv4 位址數（依分配日期累計）。2026 年中國 3.43 億個、日本 1.89 億、南韓 1.12 億、澳洲 4,588 萬、印度 4,182 萬、台灣 3,573 萬（最早在 1989 年）、新加坡 2,875 萬。1995 年日本已有 2,563 萬、中國 803 萬、台灣 434 萬。${NOTE.zh}`,
        en: `Allocated IPv4 addresses (accumulated by allocation date). In 2026 China has 343 million, Japan 189 million, South Korea 112 million, Australia 45.9 million, India 41.8 million, Taiwan 35.7 million (first allocated in 1989) and Singapore 28.7 million. In 1995 Japan already had 25.6 million, China 8.0 million and Taiwan 4.3 million. ${NOTE.en}`,
      },
      unit: { zh: '個', en: 'addresses' },
      file: 'ipv4.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: (v) => tr({ zh: `${formatLargeNumber(v)} 個`, en: formatLargeNumber(v) }),
      formatTick: formatLargeTick,
      missing: MISSING,
    },
    {
      id: 'ipv6',
      label: { zh: 'IPv6 位址（/32 區塊數）', en: 'IPv6 addresses (/32 blocks)' },
      description: {
        zh: `已分配的 IPv6 位址，換成 /32 區塊的個數。2026 年中國 68,539 個、新加坡 34,358、日本 10,158、澳洲 9,495、印度 6,335、南韓 5,272、台灣 2,576。IPv6 的位址多到分不完，數字反映的是業者申請了多少，不是用了多少。${NOTE.zh}`,
        en: `Allocated IPv6 space in /32 blocks. In 2026 China has 68,539, Singapore 34,358, Japan 10,158, Australia 9,495, India 6,335, South Korea 5,272 and Taiwan 2,576. IPv6 space is effectively unlimited, so this reflects how much operators requested, not how much is in use. ${NOTE.en}`,
      },
      unit: { zh: '個 /32', en: '/32 blocks' },
      file: 'ipv6.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: (v) => tr({ zh: `${formatLargeNumber(v)} 個 /32`, en: `${formatLargeNumber(v)} /32s` }),
      formatTick: formatLargeTick,
      missing: MISSING,
    },
    {
      id: 'asn',
      label: { zh: '自治系統號碼（ASN）', en: 'Autonomous system numbers (ASNs)' },
      description: {
        zh: `分配到的自治系統號碼個數，大約就是有幾個網路業者、大學與大型機構自己對外連網。2026 年中國 6,397 個、印度 6,262、印尼 4,043、澳洲 2,953、孟加拉 2,023、日本 1,267、香港 1,180、南韓 1,149；台灣 419。${NOTE.zh}`,
        en: `Number of autonomous system numbers allocated – roughly how many network operators, universities and large organisations connect to the internet on their own. In 2026 China has 6,397, India 6,262, Indonesia 4,043, Australia 2,953, Bangladesh 2,023, Japan 1,267, Hong Kong 1,180 and South Korea 1,149; Taiwan 419. ${NOTE.en}`,
      },
      unit: { zh: '個', en: 'ASNs' },
      file: 'asn.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: (v) => tr({ zh: `${formatLargeNumber(v)} 個`, en: formatLargeNumber(v) }),
      formatTick: formatLargeTick,
      integer: true,
      missing: MISSING,
    },
  ],
};
