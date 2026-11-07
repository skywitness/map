import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { topicPart } from './merge';
import type { TopicDefinition } from './types';

/**
 * 小型模組化反應爐（SMR）的設計案（2026-11-07，製作手冊第二十五批 532；pipeline/topics/smr.py）：英文維基
 * 「List of small modular reactor designs」固定版本的表，依設計者的國家數件數。不單獨上架，併進「核能」（nuclear.ts）。
 */
export const smrDesigns: TopicDefinition = {
  id: 'smr',
  title: { zh: '小型模組化反應爐（SMR）的設計案', en: 'Small modular reactor (SMR) designs' },
  shortTitle: { zh: '小型模組化反應爐', en: 'SMR designs' },
  defaultIndicator: 'smr-designs',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: '英文維基百科「List of small modular reactor designs」（revid 1382956151，2026-11-07）',
        en: 'English Wikipedia, “List of small modular reactor designs” (revision 1382956151, 7 November 2026)',
      },
      url: 'https://en.wikipedia.org/w/index.php?title=List_of_small_modular_reactor_designs&oldid=1382956151',
      license: 'CC BY-SA 4.0',
    },
  ],
  indicators: [
    {
      id: 'smr-designs',
      label: { zh: '小型模組化反應爐（SMR）的設計案', en: 'Small modular reactor (SMR) designs' },
      description: {
        zh: '依設計者的國家，數英文維基清單上的小型模組化反應爐設計案（96 件，兩國合作的兩國各算一件；國家是設計者所在，不是要蓋在哪裡）；滑過看這一國有哪些。還在進行的：美國 25、俄羅斯 16、法國 11、日本 9、中國 7、加拿大 6。已經申請執照以上的只有 16 件、8 國：美國 7、俄羅斯 4、中國 2（合作案兩國各算）。運轉中的只有中國的 HTR-PM 與俄羅斯的浮動式核電廠 Akademik Lomonosov；興建中的有中國玲龍一號、俄羅斯 BREST-OD-300、美國 Natrium、加拿大安大略的 BWRX-300 等 7 件。台灣沒有設計案。',
        en: 'Small modular reactor designs on the English Wikipedia list (96), counted by the designer’s country (joint designs count for both; the country is where the designer is based, not where it will be built); hover to see which. Still active: the US 25, Russia 16, France 11, Japan 9, China 7, Canada 6. Only 16 designs in 8 countries have reached licensing or beyond: the US 7, Russia 4, China 2 (joint designs counted for each partner). Only China’s HTR-PM and Russia’s floating Akademik Lomonosov are operating; 7 are under construction, including China’s Linglong One, Russia’s BREST-OD-300, Natrium in the US and BWRX-300 in Ontario, Canada. Taiwan has no designs.',
      },
      unit: { zh: '件', en: 'designs' },
      file: 'designs/{item}.json',
      dimension: {
        label: { zh: '階段', en: 'Stage' },
        options: [
          { id: 'active', label: { zh: '還在進行（不含取消、退役）', en: 'Active (excluding cancelled and retired)' } },
          { id: 'advanced', label: { zh: '已申請執照、取得執照、興建中或運轉中', en: 'Seeking a licence, licensed, under construction or operating' } },
        ],
        defaultOption: 'active',
      },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 3, 5, 8, 12, 20] } },
      format: (v) => tr({ zh: `${fixed(v, 0)} 件`, en: `${fixed(v, 0)} ${v === 1 ? 'design' : 'designs'}` }),
      formatTick: (v) => fixed(v, 0),
      timeless: true,
      missing: { zh: '清單上沒有這一國的設計案', en: 'No designs from this country on the list' },
    },
  ],
};

export const smrPart = topicPart(smrDesigns, { name: { zh: '小型模組化反應爐', en: 'Small modular reactors' } });
