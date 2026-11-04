import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { PointRecord, TopicDefinition } from './types';

/**
 * 博弈：賭場、彩券行與投注站（2026-11-04，製作手冊第二十一批 369；pipeline/topics/gambling.py）：
 * OpenStreetMap（經 QLever）的 amenity=casino（點與各國家數）、shop=lottery 與 amenity=gambling（每十萬人，只替 OSM 覆蓋良好的國家上色）。
 * 博弈的合法性在「法律與制度」主題。
 */

function casinoName(p: PointRecord): { title: string; proper?: string } {
  const n = String(p.n ?? '');
  const zh = String(p.nz ?? '');
  const en = String(p.ne ?? '');
  const unnamed = tr({ zh: '（沒有名稱的賭場）', en: '(unnamed casino)' });
  if (getLang() === 'zh') return zh ? { title: zh, proper: n && n !== zh ? n : undefined } : { title: n || unnamed };
  return en ? { title: en, proper: n && n !== en ? n : undefined } : { title: n || unnamed };
}

const per100k = (v: number) => tr({ zh: `每十萬人 ${fixed(v, 2)} 家`, en: `${fixed(v, 2)} per 100,000` });

export const gambling: TopicDefinition = {
  id: 'gambling',
  title: { zh: '博弈：賭場、彩券行與投注站', en: 'Gambling: casinos, lottery shops and betting shops' },
  shortTitle: { zh: '博弈', en: 'Gambling' },
  defaultIndicator: 'casinos-count',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: { zh: 'OpenStreetMap 貢獻者（經 QLever 查詢，2026 年 11 月）', en: 'OpenStreetMap contributors (queried via QLever, November 2026)' },
      url: 'https://www.openstreetmap.org/copyright',
      license: 'ODbL',
    },
  ],
  note: {
    zh: 'OpenStreetMap 上標成賭場（amenity=casino）、彩券行（shop=lottery）、投注站與吃角子老虎店（amenity=gambling）的地方，2026 年 11 月的快照（© OpenStreetMap contributors，資料檔依 ODbL 1.0 分享），不是官方名錄，各國的標法也不一樣：德國把吃角子老虎店（Spielhalle）也標成賭場；英國的彩券在便利商店賣、標成商店的附屬服務，所以彩券行很少，不是英國人不買彩券；西班牙、匈牙利、台灣、阿根廷真的有很多專賣彩券的店。賭場依點的位置分國，澳門的賭場算澳門；台灣沒有合法賭場，OSM 上 5 處標成賭場的是電子遊戲場與餐廳，伊拉克的 303 處名稱多是咖啡館、茶館，這兩國都不算。彩券行、投注站的每十萬人只替 OSM 覆蓋良好的國家上色（判準跟「外食與喝一杯」相同）。各國哪些博弈合法，見「法律與制度」主題的「博弈的合法性」。',
    en: 'Places tagged on OpenStreetMap as casinos (amenity=casino), lottery shops (shop=lottery) or betting shops and gaming halls (amenity=gambling), as of November 2026 (© OpenStreetMap contributors; the data files are shared under ODbL 1.0). This is not an official register, and tagging differs by country: Germany also tags slot-machine halls (Spielhallen) as casinos; in the UK lottery tickets are sold in convenience stores and tagged as a shop service, so there are very few lottery shops, which does not mean Britons do not play; Spain, Hungary, Taiwan and Argentina really do have many lottery-only shops. Casinos are assigned to countries by location, so Macau’s count as Macau. Taiwan has no legal casinos, and the 5 places tagged as casinos there are amusement arcades and a restaurant; Iraq’s 303 are mostly cafés and tea houses by name; neither is counted. Lottery and betting shops per 100,000 people are shown only where OSM is reasonably complete (the same test as the Eating out topic). For which kinds of gambling are legal, see “Legality of gambling” in the Laws and institutions topic.',
  },
  overlays: [
    {
      kind: 'points',
      id: 'casinos',
      file: 'casinos.json',
      indicators: ['casinos-count'],
      label: { zh: '賭場', en: 'Casinos' },
      radius: 3,
      color: MAP_TOKENS.categorical[6],
      tooltip: (p, { countryName }) => {
        const { title, proper } = casinoName(p);
        return { title, extra: [typeof p.iso3 === 'string' && p.iso3 ? countryName(p.iso3) : ''].filter(Boolean), properNoun: proper };
      },
    },
  ],
  indicators: [
    {
      id: 'casinos-count',
      label: { zh: '賭場', en: 'Casinos' },
      description: {
        zh: 'OpenStreetMap 上標成賭場的地方（點，各國家數是比例圓）。美國 1,328 處最多，德國 853（含吃角子老虎店）、羅馬尼亞 283、哥倫比亞 280、西班牙 270、英國 248、阿根廷 229、法國 206、秘魯 205；澳門 25、南韓 21、新加坡 2（兩座大型綜合度假村）。台灣沒有合法賭場，伊拉克標成賭場的多是咖啡館，這兩國不算。',
        en: 'Places tagged as casinos on OpenStreetMap (dots; bubbles show the count per country). The US has the most at 1,328, followed by Germany 853 (including slot-machine halls), Romania 283, Colombia 280, Spain 270, the UK 248, Argentina 229, France 206 and Peru 205; Macau 25, South Korea 21 and Singapore 2 (its two integrated resorts). Taiwan has no legal casinos, and Iraq’s “casinos” are mostly cafés; neither is counted.',
      },
      unit: { zh: '處', en: 'casinos' },
      file: 'casinos-count.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 處`, en: fixed(v, 0) }),
    },
    {
      id: 'lottery',
      label: { zh: '彩券行', en: 'Lottery shops' },
      description: {
        zh: 'OpenStreetMap 上的彩券行，每十萬人。馬爾他 7.3、匈牙利 6.6、西班牙 5.2、阿根廷 4.4 最多，台灣 2.8（645 家）排第五；日本 0.5、美國與英國幾乎是 0（彩券在便利商店、加油站賣，不是專門的店）。',
        en: 'Lottery shops on OpenStreetMap per 100,000 people. Malta 7.3, Hungary 6.6, Spain 5.2 and Argentina 4.4 have the most, with Taiwan fifth at 2.8 (645 shops); Japan 0.5, and the US and the UK almost none (tickets are sold in convenience stores and petrol stations, not dedicated shops).',
      },
      unit: { zh: '家／十萬人', en: 'per 100,000' },
      file: 'lottery.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.1, 0.5, 1, 2, 4] } },
      format: per100k,
      formatTick: (v) => `${v}`,
    },
    {
      id: 'betting',
      label: { zh: '投注站與吃角子老虎店', en: 'Betting shops and gaming halls' },
      description: {
        zh: 'OpenStreetMap 上的投注站、吃角子老虎店等博弈場所（不含賭場與彩券行），每十萬人。蒙特內哥羅 2.4、西班牙 1.4、德國 1.4、拉脫維亞 1.4 最多；日本 0.6、英國 0.5、美國 0.1、台灣 0.1。',
        en: 'Betting shops, slot-machine halls and other gambling venues on OpenStreetMap (not casinos or lottery shops) per 100,000 people. Montenegro 2.4, Spain 1.4, Germany 1.4 and Latvia 1.4 have the most; Japan 0.6, the UK 0.5, the US 0.1 and Taiwan 0.1.',
      },
      unit: { zh: '家／十萬人', en: 'per 100,000' },
      file: 'betting.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.1, 0.3, 0.6, 1, 1.5] } },
      format: per100k,
      formatTick: (v) => `${v}`,
    },
  ],
};
