import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ListPanelDef, ListRow, PointRecord, PointsOverlayDef } from './types';
import type { TopicPart } from './parts';

/**
 * 運動的擴充：聯賽、俱樂部與進場人數（2026-11-06，製作手冊第二十四批 426；pipeline/topics/sports_leagues.py）。
 * Wikidata 的聯賽與俱樂部數（覆蓋偏差大，只能說「Wikidata 上有幾個」），英文維基百科的聯賽平均進場人數，台灣用運動部的中職觀眾人次。
 */
const count = (unit: { zh: string; en: string }) => (v: number) => tr({ zh: `${fixed(v, 0)} ${unit.zh}`, en: `${fixed(v, 0)} ${unit.en}` });


/**
 * 球隊的主場（2026-11-07，第二十四批 426 的補強；pipeline/topics/sports_venues.py）：Wikidata 的運動俱樂部的主場（P115），
 * 一個場館一個點，大小是那裡最有名的隊伍的維基語言數；維基語言數 10 以上的在主檔，其他放大才畫（more）。
 */
const C = MAP_TOKENS.categorical;
const SPORTS: { code: number; label: Text; color: string }[] = [
  { code: 1, label: { zh: '足球', en: 'Football' }, color: C[1] },
  { code: 2, label: { zh: '籃球', en: 'Basketball' }, color: C[2] },
  { code: 3, label: { zh: '棒球', en: 'Baseball' }, color: C[3] },
  { code: 4, label: { zh: '冰球', en: 'Ice hockey' }, color: C[5] },
  { code: 5, label: { zh: '橄欖球', en: 'Rugby' }, color: C[6] },
  { code: 6, label: { zh: '排球', en: 'Volleyball' }, color: C[7] },
  { code: 7, label: { zh: '手球', en: 'Handball' }, color: C[0] },
  { code: 8, label: { zh: '美式足球', en: 'American football' }, color: C[4] },
  { code: 9, label: { zh: '板球', en: 'Cricket' }, color: MAP_TOKENS.diverging[0] },
  { code: 10, label: { zh: '其他或不詳', en: 'Other or unknown' }, color: MAP_TOKENS.context },
];
const sportLabel = (p: PointRecord) => tr(SPORTS.find((s) => s.code === p.k)?.label ?? SPORTS[9].label);
const venueName = (p: PointRecord) => String((getLang() === 'zh' ? p.zh || p.en : p.en || p.zh) ?? '');
const clubNames = (p: PointRecord) => String((getLang() === 'zh' ? p.cz || p.c : p.c || p.cz) ?? '');

const CLUB_VENUES: PointsOverlayDef = {
  kind: 'points',
  id: 'club-venues',
  file: 'club-venues.json',
  more: { minZoom: 5 },
  label: { zh: '球隊的主場（Wikidata）', en: 'Club home grounds (Wikidata)' },
  indicators: ['club-venues'],
  radius: { field: 'sl', stops: [[0, 2.4], [10, 3.2], [40, 5], [100, 7.5]] },
  color: { field: 'k', title: { zh: '主隊的運動', en: 'Sport of the main club' }, thresholds: SPORTS.slice(1).map((s) => s.code), classes: SPORTS },
  sortField: 'sl',
  tooltip: (p, { countryName }) => {
    const name = venueName(p);
    return {
      title: name,
      detail: [sportLabel(p), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
      extra: [
        tr({ zh: `主隊：${clubNames(p)}`, en: `Home of: ${clubNames(p)}` }),
        ...(Number(p.n) > 4 ? [tr({ zh: `共 ${p.n} 隊`, en: `${p.n} clubs in all` })] : []),
      ],
      properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== name ? p.en : undefined,
    };
  },
};

/** 台灣的運動場館（運動部 22849）：對外開放的，分類併成五組 */
const TW_KINDS: { code: number; label: Text; color: string }[] = [
  { code: 1, label: { zh: '球場與球館', en: 'Ball courts and halls' }, color: C[1] },
  { code: 2, label: { zh: '田徑場與跑道', en: 'Tracks' }, color: C[3] },
  { code: 3, label: { zh: '游泳池', en: 'Pools' }, color: C[5] },
  { code: 4, label: { zh: '健身、舞蹈與武術', en: 'Gyms, dance and martial arts' }, color: C[6] },
  { code: 5, label: { zh: '其他', en: 'Other' }, color: MAP_TOKENS.context },
];
const TW_VENUES: PointsOverlayDef = {
  kind: 'points',
  id: 'taiwan-venues',
  file: 'taiwan-venues.json',
  label: { zh: '台灣對外開放的運動場館（運動部）', en: 'Taiwan’s public sports facilities (Sports Administration)' },
  indicators: ['club-venues'],
  hidden: true,
  radius: 2.6,
  color: { field: 'k', title: { zh: '場館分類', en: 'Facility type' }, thresholds: TW_KINDS.slice(1).map((k) => k.code), classes: TW_KINDS },
  tooltip: (p) => ({
    title: String(p.n ?? ''),
    detail: [String(p.cat ?? ''), String(p.place ?? '')].filter(Boolean).join(' · '),
    extra: [
      tr(p.paid === 1 ? { zh: '付費對外開放', en: 'Open to the public (paid)' } : { zh: '免費對外開放', en: 'Open to the public (free)' }),
      ...(typeof p.y === 'number' ? [tr({ zh: `${p.y} 年啟用`, en: `Opened ${p.y}` })] : []),
    ],
    properNoun: getLang() === 'en' ? String(p.n ?? '') : undefined,
  }),
};

const CLUB_VENUE_LIST: ListPanelDef = {
  label: { zh: '最有名的球隊主場', en: 'Best-known club grounds' },
  indicators: ['club-venues'],
  file: 'club-venues.json',
  layered: true,
  countryField: 'iso3',
  rows: (points, { countryName, country }) =>
    [...points]
      .sort((a, b) => Number(b.sl) - Number(a.sl))
      .slice(0, country ? 300 : 100)
      .map((p, i): ListRow => {
        const name = venueName(p);
        return {
          key: `v${i}-${name}`,
          title: `${i + 1}. ${name}`,
          properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== name ? p.en : undefined,
          lines: [[sportLabel(p), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '), clubNames(p)],
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 12 },
        };
      }),
};

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
    {
      name: { zh: '運動部：全國運動場館資訊（data.gov.tw 22849，2026 年 1 月版）', en: 'Sports Administration (Taiwan): national sports facilities (data.gov.tw 22849, January 2026 edition)' },
      url: 'https://data.gov.tw/dataset/22849',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: {
    zh: '聯賽與俱樂部是 Wikidata 上標成運動聯賽、運動俱樂部（含子類別，例如足球俱樂部）而且有國家的項目，Wikidata 的覆蓋差很多（德國 1 萬多個俱樂部，台灣 55 個），也分不出職業與業餘，不能當運動風氣讀。進場人數照英文維基百科條目的「平均進場人數」表，只取第一級聯賽（資料檔依 CC BY-SA 4.0 分享）；球季從 2017 到 2025 不一樣，有的只算常規賽、有的是售票數，條目自己也這麼註明。跨國聯賽（美國職棒、NHL、NBA 有加拿大球隊）兩國都算。台灣用運動部的中職觀眾人次，開放資料只到 2023 年。',
    en: 'Leagues and clubs are Wikidata items typed as sports leagues or sports clubs (including subclasses such as football clubs) with a country. Wikidata coverage varies greatly (over 10,000 clubs for Germany, 55 for Taiwan) and does not separate professional from amateur, so do not read it as how sporty a country is. Attendance follows the average attendance table of the English Wikipedia article, top-tier leagues only (the data file is shared under CC BY-SA 4.0); seasons range from 2017 to 2025, and some count regular seasons only or tickets sold, as the article notes. Cross-border leagues (MLB, the NHL and the NBA have Canadian teams) count for both countries. Taiwan uses the Sports Administration’s CPBL attendance, whose open data stops at 2023.',
  },
  overlays: [CLUB_VENUES, TW_VENUES],
  listPanel: [CLUB_VENUE_LIST],
  indicators: [
    {
      id: 'club-venues',
      label: { zh: '球隊的主場', en: 'Club home grounds' },
      description: {
        zh: 'Wikidata 上有主場的運動俱樂部，一個場館一個點（8,156 個場館、12,439 隊），點的大小是在那裡比賽最有名的隊伍有幾種語言的維基百科條目，顏色是它的運動：巴塞隆納的諾坎普、皇家馬德里的伯納烏、曼聯的老特拉福最大。放大才畫出比較沒名的。美國 834 個、英國 594、波蘭 473、巴西 416、西班牙 400；八成是足球。圖層選單另有台灣運動部登錄、對外開放的 10,824 處運動場館（預設關閉）。左邊列出最有名的 100 個主場，選了國家列那一國的。',
        en: 'Sports clubs on Wikidata with a home ground, one dot per venue (8,156 venues, 12,439 clubs). Dot size is the number of Wikipedia language editions of the best-known club playing there, and colour its sport: Barcelona’s Camp Nou, Real Madrid’s Bernabéu and Manchester United’s Old Trafford are the largest. Less-known grounds appear as you zoom in. The US has 834, the UK 594, Poland 473, Brazil 416 and Spain 400; about four in five are football grounds. The layer menu also has Taiwan’s 10,824 public sports facilities registered with the Sports Administration (off by default). The list on the left shows the 100 best-known grounds, or those of the selected country.',
      },
      unit: '',
      file: 'sport-clubs.json',
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      missing: { zh: '國家不上色，看地圖上的點', en: 'Countries are not coloured; see the dots on the map' },
    },
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
