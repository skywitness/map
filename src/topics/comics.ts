import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 漫畫是哪裡來的（新主題，2026-11-08，製作手冊第二十七批 655，候選 1436–1438；pipeline/topics/media_works.py 的 comics）：
 * Wikidata 的漫畫作品（依原產國；六成沒有年份，不做時間軸）、網路漫畫、四個漫畫獎的得主。出版科學研究所與 Comichron 的市場數字不准轉載，
 * 所以只做作品數；漫畫書店的密度照手冊不做（使用者否決過兩次同類的角度）。
 */
const count = (unit: { zh: string; en: string }, enOne: string) => (v: number) =>
  tr({ zh: `${fixed(v, 0)} ${unit.zh}`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? enOne : unit.en}` });

export const comics: TopicDefinition = {
  id: 'comics',
  title: { zh: '漫畫是哪裡來的：作品的產地、網路漫畫與漫畫獎', en: 'Where comics come from: works, webtoons and comic awards' },
  shortTitle: { zh: '漫畫', en: 'Comics' },
  defaultIndicator: 'works',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: 'Wikidata：漫畫作品（Q1004）、webtoon（Q7978994）、韓國漫畫（Q562214）、中文漫畫（Q754669）、網路漫畫（Q213369）、艾斯納獎、手塚治虫文化賞、講談社漫畫賞、小學館漫畫賞（經 QLever 查詢）',
        en: 'Wikidata: comics (Q1004), webtoons (Q7978994), manhwa (Q562214), manhua (Q754669), webcomics (Q213369), and the Eisner, Tezuka Osamu Cultural Prize, Kodansha and Shogakukan manga awards (via QLever)',
      },
      url: 'https://www.wikidata.org/wiki/Q1004',
      license: 'CC0',
    },
  ],
  note: { zh: '全部來自 Wikidata（CC0，經 QLever 查詢），算的是寫進 Wikidata 的作品與得主，各國收錄得完不完整差很多（日本的漫畫收得特別多），只能看大概。國家依作品的原產國或得主的國籍；蘇聯、南斯拉夫等算在今天的繼承國。出版科學研究所與 Comichron 的市場數字不准轉載，所以只有作品數，沒有銷量或市場規模。', en: 'All from Wikidata (CC0, queried via QLever): these are the works and winners recorded in Wikidata, and coverage varies a lot by country (Japanese manga are especially well covered), so treat the figures as approximate. Countries follow a work’s country of origin or a winner’s citizenship; the Soviet Union, Yugoslavia and similar are counted under today’s successor states. Market figures from the Research Institute for Publications and Comichron may not be reproduced, so this shows numbers of works, not sales or market size.' },
  indicators: [
    {
      id: 'works',
      label: { zh: '漫畫作品（依原產國）', en: 'Comics (by country of origin)' },
      description: { zh: 'Wikidata 上的漫畫作品（含子類別）依原產國：25,250 部、64 國。日本 18,893 部、約占四分之三，美國 2,901、義大利 694、西班牙 560、法國 397、南韓 367、英國 254、比利時 242；台灣 62 部。近六成作品沒有年份，所以不做時間軸。', en: 'Comics in Wikidata (including subclasses) by country of origin: 25,250 in 64 countries. Japan has 18,893, about three-quarters, followed by the US (2,901), Italy (694), Spain (560), France (397), South Korea (367), the UK (254) and Belgium (242); Taiwan has 62. Nearly 60% have no year, so there is no timeline.' },
      unit: { zh: '部', en: 'works' },
      file: 'works.json',
      layer: { kind: 'bubble', legendValues: [10, 500, 10000] },
      timeless: true,
      integer: true,
      format: count({ zh: '部', en: 'works' }, 'work'),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'webtoons',
      label: { zh: '網路漫畫（webtoon、韓漫、中文漫畫）', en: 'Webtoons, manhwa and manhua' },
      description: { zh: '網路漫畫（webtoon）、韓國漫畫（manhwa）、中文漫畫（manhua）與網路連載漫畫（webcomic），含子類別，依原產國：629 部、22 國。南韓 350 部最多，日本 85、中國 80、美國 40、台灣 28、香港 12。', en: 'Webtoons, manhwa, manhua and webcomics (including subclasses) by country of origin: 629 in 22 countries. South Korea has the most (350), followed by Japan (85), China (80), the US (40), Taiwan (28) and Hong Kong (12).' },
      unit: { zh: '部', en: 'works' },
      file: 'webtoons.json',
      layer: { kind: 'bubble', legendValues: [5, 50, 300] },
      timeless: true,
      integer: true,
      format: count({ zh: '部', en: 'works' }, 'work'),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'awards',
      label: { zh: '漫畫獎的得主', en: 'Comic award winners' },
      description: { zh: '艾斯納獎、手塚治虫文化賞、講談社漫畫賞、小學館漫畫賞四個獎的得主（作品依原產國、人依國籍），只算 Wikidata 有記錄的，合計 168 次、9 國：日本 124 次、美國 29、法國與以色列各 3。三個日本的獎幾乎都頒給日本作品，所以這張圖主要反映選了哪幾個獎；台灣沒有。', en: 'Winners of the Eisner Awards, the Tezuka Osamu Cultural Prize, the Kodansha Manga Award and the Shogakukan Manga Award (works by country of origin, people by citizenship), counting only winners recorded in Wikidata: 168 in all, 9 countries. Japan has 124, the US 29, and France and Israel 3 each. The three Japanese prizes go almost entirely to Japanese works, so the map mostly reflects which prizes were chosen; Taiwan has none.' },
      unit: { zh: '次', en: 'awards' },
      file: 'awards.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 100] },
      timeless: true,
      integer: true,
      format: count({ zh: '次', en: 'awards' }, 'award'),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
  ],
};
