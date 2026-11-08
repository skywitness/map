import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 上網看影片的人（新主題，2026-11-08，製作手冊第二十七批 657，候選 1439、1444、1456；pipeline/topics/online_video.py）：
 * Eurostat isoc_ci_ac_i 的看影片分享平台（含 16–24 歲與 65–74 歲）、看隨選影音、看電視台的網路直播、聽音樂串流，只有歐洲。
 * 659（候選 1441）Netflix 各國前十名跟全球一樣的比例（pipeline/topics/netflix.py）；658（候選 1442）Wikidata 的網路創作者
 * （YouTuber、實況主、VTuber，pipeline/topics/media_works.py 的 creators）。
 */
const pct = (v: number) => `${fixed(v, 1)}%`;
const EUROPE = { zh: '只有歐洲有資料', en: 'Europe only' };

export const onlineVideo: TopicDefinition = {
  id: 'online-video',
  title: { zh: '上網看影片的人：影片平台、隨選影音、網路電視與音樂串流', en: 'Watching video online: video sharing, on-demand, TV and music streaming' },
  shortTitle: { zh: '上網看影片', en: 'Online video' },
  defaultIndicator: 'video-sharing',
  defaultYear: 2024,
  sources: [
    {
      name: { zh: 'Eurostat 上網活動（isoc_ci_ac_i）', en: 'Eurostat internet activities (isoc_ci_ac_i)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/isoc_ci_ac_i/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'Wikidata：YouTuber（Q17125263）、實況主（Q152859）、VTuber（Q55155641）（經 QLever 查詢）', en: 'Wikidata: YouTubers (Q17125263), streamers (Q152859) and VTubers (Q55155641) (via QLever)' },
      url: 'https://www.wikidata.org/wiki/Q17125263',
      license: 'CC0',
    },
    { name: { zh: '聯合國《世界人口展望 2024》（每百萬人）', en: 'UN World Population Prospects 2024 (per million people)' }, url: 'https://population.un.org/wpp/', license: 'CC BY 3.0 IGO' },
    {
      name: { zh: 'Netflix Top 10（各國與全球的每週前十名；網站只放算好的比例）', en: 'Netflix Top 10 (weekly country and global charts; only computed shares are published)' },
      url: 'https://www.netflix.com/tudum/top10',
      license: { zh: '沒有找到授權；照 JODI 的前例只做非商業使用、註明出處、不轉載原始檔', en: 'No licence found; used non-commercially with attribution and without republishing the raw files, as with JODI' },
    },
  ],
  note: {
    zh: 'Eurostat 每年的家戶與個人資訊與通訊科技使用調查，16–74 歲的人裡最近三個月做過這件事的比例，分母是全部人口，不是上網的人。只有歐洲（英國照網站的 Eurostat 規則不收）；台灣與歐洲以外沒有可比的資料。各國不是每年都問，地圖用 4 年內最近一年的值。Netflix 的比例與網路創作者的人數是全世界的，算法寫在各自的說明裡。',
    en: 'From Eurostat’s annual survey on ICT use in households and by individuals: the share of people aged 16–74 who did this in the last three months, with the whole population (not just internet users) as the denominator. Europe only (the UK is excluded under this site’s Eurostat rule); Taiwan and countries outside Europe have no comparable data. Not every country is asked every year, so the map uses the latest value within 4 years. The Netflix shares and the online creator counts cover the whole world; how they are calculated is in each indicator’s description.',
  },
  indicators: [
    {
      id: 'video-sharing',
      label: { zh: '看影片分享平台的人（YouTube 這類）', en: 'Watching video-sharing services (YouTube etc.)' },
      description: {
        zh: '最近三個月看過影片分享平台（YouTube 這類）的人的比例（2024 年，歐洲 34 國；2021 年才開始問）。全部年齡：荷蘭 87.2% 最高，賽普勒斯 86.3%、芬蘭 82.6%、丹麥 81.6%；保加利亞 32.8%、羅馬尼亞 26.8%、阿爾巴尼亞 21.1% 最低。子項目看年齡：16–24 歲荷蘭 98.0%、芬蘭 97.8%，阿爾巴尼亞 37.6% 最低；65–74 歲荷蘭 63.4%、賽普勒斯 58.7%，羅馬尼亞 7.8%、阿爾巴尼亞 4.5% 最低。Eurostat 沒有單獨問「短影音」，這是最接近的代理指標。',
        en: 'Share of people who watched content from video-sharing services (such as YouTube) in the last three months (2024, 34 European countries; first asked in 2021). All ages: the Netherlands is highest at 87.2%, followed by Cyprus 86.3%, Finland 82.6% and Denmark 81.6%; Bulgaria 32.8%, Romania 26.8% and Albania 21.1% are lowest. The sub-items show age groups: among 16–24-year-olds the Netherlands has 98.0% and Finland 97.8%, with Albania lowest at 37.6%; among 65–74-year-olds the Netherlands has 63.4% and Cyprus 58.7%, with Romania 7.8% and Albania 4.5% lowest. Eurostat does not ask about short-form video specifically; this is the closest proxy.',
      },
      unit: '%',
      file: 'video-sharing/{item}.json',
      dimension: {
        label: { zh: '年齡', en: 'Age' },
        options: [
          { id: 'all', label: { zh: '16–74 歲', en: '16–74' } },
          { id: 'young', label: { zh: '16–24 歲', en: '16–24' } },
          { id: 'old', label: { zh: '65–74 歲', en: '65–74' } },
        ],
        defaultOption: 'all',
      },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [40, 50, 60, 70, 75, 80] },
        itemScales: {
          young: { type: 'sequential', thresholds: [60, 75, 85, 90, 95, 97] },
          old: { type: 'sequential', thresholds: [10, 20, 30, 40, 50, 60] },
        },
      },
      format: pct,
      formatTick: (v) => `${v}%`,
      missing: EUROPE,
    },
    {
      id: 'vod',
      label: { zh: '看隨選影音的人（Netflix 這類）', en: 'Watching on-demand video (Netflix etc.)' },
      description: {
        zh: '最近三個月看過商業的隨選影音服務（Netflix 這類）的人的比例（2024 年，歐洲 35 國，冰島是 2020 年）。冰島 79.6%、挪威 77.8%、丹麥 76.3%、荷蘭 75.4%、瑞典 72.3% 最高；波赫 16.1%、塞爾維亞 12.9%、保加利亞 11.7% 最低。',
        en: 'Share of people who watched commercial on-demand video services (such as Netflix) in the last three months (2024, 35 European countries; Iceland 2020). Iceland 79.6%, Norway 77.8%, Denmark 76.3%, the Netherlands 75.4% and Sweden 72.3% are highest; Bosnia and Herzegovina 16.1%, Serbia 12.9% and Bulgaria 11.7% are lowest.',
      },
      unit: '%',
      file: 'vod.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 30, 40, 50, 60, 70] } },
      format: pct,
      formatTick: (v) => `${v}%`,
      missing: EUROPE,
    },
    {
      id: 'live-tv',
      label: { zh: '上網看電視台節目的人', en: 'Watching TV broadcasters online' },
      description: {
        zh: '最近三個月上網看電視台的直播或回看節目的人的比例（2024 年，歐洲 35 國）。挪威 81.8%、芬蘭 79.0%、丹麥 78.8%、瑞典 76.4%、荷蘭 75.1% 最高；克羅埃西亞 25.9%、羅馬尼亞與波蘭 20.1%、波赫 19.7% 最低。',
        en: 'Share of people who watched live or catch-up TV from broadcasters online in the last three months (2024, 35 European countries). Norway 81.8%, Finland 79.0%, Denmark 78.8%, Sweden 76.4% and the Netherlands 75.1% are highest; Croatia 25.9%, Romania and Poland 20.1% and Bosnia and Herzegovina 19.7% are lowest.',
      },
      unit: '%',
      file: 'live-tv.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 30, 40, 50, 60, 70] } },
      format: pct,
      formatTick: (v) => `${v}%`,
      missing: EUROPE,
    },
    {
      id: 'music',
      label: { zh: '聽音樂串流的人', en: 'Listening to music streaming' },
      description: {
        zh: '最近三個月上網聽音樂（網路電台、音樂串流）的人的比例（2019 年，歐洲 36 國；2019 年以後 Eurostat 不再問）。冰島 84.5%、挪威 77.8%、芬蘭 75.9%、丹麥 71.0% 最高；波赫 36.1%、羅馬尼亞 31.2%、保加利亞 29.7% 最低。',
        en: 'Share of people who listened to music online (web radio or music streaming) in the last three months (2019, 36 European countries; Eurostat stopped asking after 2019). Iceland 84.5%, Norway 77.8%, Finland 75.9% and Denmark 71.0% are highest; Bosnia and Herzegovina 36.1%, Romania 31.2% and Bulgaria 29.7% are lowest.',
      },
      unit: '%',
      file: 'music.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [30, 40, 50, 60, 70, 80] } },
      defaultYear: 2019,
      format: pct,
      formatTick: (v) => `${v}%`,
      missing: EUROPE,
    },
    // 2026-11-08（製作手冊第二十七批 659，候選 1441；pipeline/topics/netflix.py）
    {
      id: 'netflix-global',
      label: { zh: 'Netflix 前十名有幾成跟全球一樣', en: 'Netflix top 10 shared with the global chart' },
      description: {
        zh: 'Netflix 各國每週前十名（到 2026-11-01 為止的 52 週，93 國）裡，同一週也在全球前十名的比例。葡萄牙 78.8%、巴拿馬與匈牙利 78.6%、巴拉圭 78.0% 最跟著全球走；日本 22.6%、南韓 37.0%、印尼 40.4%、台灣 43.8%、泰國 48.4% 最看自己的東西。子項目可以只看電影（台灣 42.3%、日本 20.2%）或劇集（台灣 45.4%、日本 25.0%）。全球榜以英語片為主，這個算法對英語市場有利；只有 Netflix 一個平台，不是全部的串流。網站只放算好的比例，不列片名。',
        en: 'Share of each country’s weekly Netflix top 10 (the 52 weeks to 1 November 2026, 93 countries) that was also in the global top 10 that week. Portugal (78.8%), Panama and Hungary (78.6%) and Paraguay (78.0%) follow the global chart most closely; Japan (22.6%), South Korea (37.0%), Indonesia (40.4%), Taiwan (43.8%) and Thailand (48.4%) watch the most of their own. Sub-items show films only (Taiwan 42.3%, Japan 20.2%) or series only (Taiwan 45.4%, Japan 25.0%). The global chart is dominated by English-language titles, which favours English-speaking markets, and this covers Netflix only, not all streaming. Only the computed shares are published; titles are not listed.',
      },
      unit: '%',
      file: 'netflix-global/{item}.json',
      dimension: {
        label: { zh: '類別', en: 'Category' },
        options: [
          { id: 'all', label: { zh: '電影與劇集', en: 'Films and series' } },
          { id: 'films', label: { zh: '電影', en: 'Films' } },
          { id: 'tv', label: { zh: '劇集', en: 'Series' } },
        ],
        defaultOption: 'all',
      },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [40, 50, 60, 65, 70, 75] } },
      timeless: true,
      format: pct,
      formatTick: (v) => `${v}%`,
      missing: { zh: 'Netflix 沒有這一國的榜單', en: 'No Netflix chart for this country' },
    },
    // 2026-11-08（製作手冊第二十七批 658，候選 1442；pipeline/topics/media_works.py 的 creators）
    {
      id: 'creators',
      label: { zh: '網路創作者（YouTuber、實況主、VTuber）', en: 'Online creators (YouTubers, streamers, VTubers)' },
      description: {
        zh: 'Wikidata 上職業是 YouTuber 或實況主（不含也是電競選手的），或本身是 VTuber 的項目，依國籍（VTuber 沒有國籍的用原產國或國家）：5,897 位、126 國。美國 1,282 位最多，日本 690、英國 325、法國 284、德國 222、加拿大 220、巴西 213；南韓 167、印度 121、台灣 102。這是被寫進 Wikidata 的創作者，不是全部的創作者，收錄偏差很大（台灣跟印度差不多）。',
        en: 'Items in Wikidata whose occupation is YouTuber or streamer (excluding those who are also esports players), or that are VTubers, by citizenship (VTubers without one by country of origin or country): 5,897 in 126 countries. The US has the most (1,282), followed by Japan (690), the UK (325), France (284), Germany (222), Canada (220) and Brazil (213); South Korea has 167, India 121 and Taiwan 102. These are creators recorded in Wikidata, not all creators, and coverage is very uneven (Taiwan and India are about level).',
      },
      unit: { zh: '人', en: 'people' },
      file: 'creators.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 人`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'person' : 'people'}` }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'creators-per',
      label: { zh: '每百萬人有幾位網路創作者', en: 'Online creators per million people' },
      description: {
        zh: '網路創作者人數 ÷ 2024 年人口（聯合國《世界人口展望》），每百萬人幾位。芬蘭 13.4 最多，挪威 9.3、瑞典 7.1、捷克 6.2、日本 5.6、加拿大 5.5；台灣 4.4、美國 3.7、南韓 3.2、印度 0.08。量的比較是 Wikidata 的編輯者寫了誰，不是各國實際有多少創作者。',
        en: 'Online creators divided by 2024 population (UN World Population Prospects), per million people. Finland is highest (13.4), followed by Norway (9.3), Sweden (7.1), Czechia (6.2), Japan (5.6) and Canada (5.5); Taiwan has 4.4, the US 3.7, South Korea 3.2 and India 0.08. This mostly reflects whom Wikidata editors have written about, not how many creators each country really has.',
      },
      unit: { zh: '人／百萬人', en: 'per million people' },
      file: 'creators-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 3, 5, 8] } },
      timeless: true,
      format: (v) => tr({ zh: `每百萬人 ${fixed(v, 2)} 位`, en: `${fixed(v, 2)} per million` }),
      formatTick: (v) => `${v}`,
    },
  ],
};
