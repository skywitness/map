import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 電視劇的產地（新主題，2026-11-08，製作手冊第二十七批 656，候選 1451；pipeline/topics/media_works.py 的 tv_series）：
 * Wikidata 的電視劇（P31 直接是 Q5398426）依原產國與首播年份累計，和 2000 年以後首播的比例。
 * 「出口」沒有開放的資料（Wikidata 沒有授權或發行國的欄位），只做產地。
 */
export const tvSeries: TopicDefinition = {
  id: 'tv-series',
  title: { zh: '電視劇的產地：各國拍了幾部、哪裡是新興的', en: 'Where TV series come from: how many each country makes' },
  shortTitle: { zh: '電視劇', en: 'TV series' },
  defaultIndicator: 'series',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'Wikidata：電視劇（Q5398426）的原產國與首播年份（經 QLever 查詢）', en: 'Wikidata: television series (Q5398426), country of origin and first-aired year (via QLever)' },
      url: 'https://www.wikidata.org/wiki/Q5398426',
      license: 'CC0',
    },
  ],
  note: { zh: '全部來自 Wikidata（CC0，經 QLever 查詢），只算直接標成「電視劇」（Q5398426）的項目，不含子類別；各國收錄得完不完整差很多，只能看大概。國家依原產國；蘇聯、捷克斯洛伐克、南斯拉夫算在俄羅斯、捷克、塞爾維亞。近三成項目沒有首播年份，不算進時間軸與比例（滑過國家看各國有幾部）。「出口」沒有開放的資料，所以只做產地。', en: 'All from Wikidata (CC0, queried via QLever), counting only items classed directly as television series (Q5398426), not subclasses; coverage varies a lot by country, so treat the figures as approximate. Countries follow the country of origin; the Soviet Union, Czechoslovakia and Yugoslavia are counted under Russia, Czechia and Serbia. Nearly 30% of items have no first-aired year and are left out of the timeline and the share (hover a country for its count). There are no open data on exports, so only origin is shown.' },
  indicators: [
    {
      id: 'series',
      label: { zh: '電視劇（依原產國累計）', en: 'TV series (cumulative, by country of origin)' },
      description: { zh: '電視劇依原產國、首播年份累計（Wikidata 有首播年份的 54,767 部；另有 22,330 部沒有年份，沒算進來）。到 2026 年美國 11,295 部最多，英國 5,708、日本 4,698、南韓 3,632、德國 2,209、加拿大 2,127；台灣 381 部（另有 441 部沒有年份）。南韓 1990 年累計 286 部，2010 年 1,650 部，2026 年 3,632 部。', en: 'TV series by country of origin, cumulative by first-aired year (54,767 series with a year in Wikidata; another 22,330 have no year and are left out). By 2026 the US has the most (11,295), followed by the UK (5,708), Japan (4,698), South Korea (3,632), Germany (2,209) and Canada (2,127); Taiwan has 381 (plus 441 with no year). South Korea had 286 by 1990, 1,650 by 2010 and 3,632 by 2026.' },
      unit: { zh: '部', en: 'series' },
      file: 'series.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 部`, en: `${fixed(v, 0)} series` }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'since-2000',
      label: { zh: '2000 年以後首播的比例', en: 'Share first aired since 2000' },
      description: { zh: '有首播年份的電視劇裡，2000 年以後首播的比例（有年份的至少 50 部的 57 國），看哪裡是近年才大量拍劇，或近年才大量寫進 Wikidata。泰國 98.1%、斯洛伐克 96.9%、中國 96.7%、烏克蘭 96.0%、土耳其 95.3% 最高；台灣 89.0%、南韓 78.2%、日本 76.7%、美國 64.7%、英國 59.5%；墨西哥 48.1%、捷克 44.4%、委內瑞拉 39.5%、塞爾維亞 39.1% 最低。', en: 'Among TV series with a first-aired year, the share first aired in 2000 or later (57 countries with at least 50 dated series), showing where series production, or Wikidata coverage of it, is recent. Thailand (98.1%), Slovakia (96.9%), China (96.7%), Ukraine (96.0%) and Turkey (95.3%) are highest; Taiwan has 89.0%, South Korea 78.2%, Japan 76.7%, the US 64.7% and the UK 59.5%; Mexico (48.1%), Czechia (44.4%), Venezuela (39.5%) and Serbia (39.1%) are lowest.' },
      unit: '%',
      file: 'since-2000.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [50, 60, 70, 80, 90, 95] } },
      timeless: true,
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      missing: { zh: '這國有年份的電視劇不到 50 部', en: 'Fewer than 50 dated TV series from here' },
    },
  ],
};
