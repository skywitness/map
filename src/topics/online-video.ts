import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 上網看影片的人（新主題，2026-11-08，製作手冊第二十七批 657，候選 1439、1444、1456；pipeline/topics/online_video.py）：
 * Eurostat isoc_ci_ac_i 的看影片分享平台（含 16–24 歲與 65–74 歲）、看隨選影音、看電視台的網路直播、聽音樂串流，只有歐洲。
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
  ],
  note: {
    zh: 'Eurostat 每年的家戶與個人資訊與通訊科技使用調查，16–74 歲的人裡最近三個月做過這件事的比例，分母是全部人口，不是上網的人。只有歐洲（英國照網站的 Eurostat 規則不收）；台灣與歐洲以外沒有可比的資料。各國不是每年都問，地圖用 4 年內最近一年的值。',
    en: 'From Eurostat’s annual survey on ICT use in households and by individuals: the share of people aged 16–74 who did this in the last three months, with the whole population (not just internet users) as the denominator. Europe only (the UK is excluded under this site’s Eurostat rule); Taiwan and countries outside Europe have no comparable data. Not every country is asked every year, so the map uses the latest value within 4 years.',
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
  ],
};
