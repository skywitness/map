import { tr } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import type { TopicPart } from './parts';

/**
 * 太空的擴充：送上太空的不是顆數而是公斤、太空垃圾每年再入幾個（2026-11-07，製作手冊第二十七批 604，候選 1330、1331；
 * pipeline/topics/space_mass.py，資料在 public/data/topics/space/）：GCAT 的 satcat 多兩種彙總；側欄 panels/SpaceMassPanel.tsx。
 */
export const tonnes = (kg: number) =>
  kg >= 1000
    ? tr({ zh: `${fixed(kg / 1000, kg >= 1e5 ? 0 : 1)} 公噸`, en: `${fixed(kg / 1000, kg >= 1e5 ? 0 : 1)} t` })
    : tr({ zh: `${fixed(kg, 0)} 公斤`, en: `${fixed(kg, 0)} kg` });
const objects = (v: number) => tr({ zh: `${fixed(v, 0)} 個`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'object' : 'objects'}` });

export const spaceMassPart: TopicPart = {
  name: { zh: '在軌質量與再入', en: 'Mass in orbit and re-entries' },
  sources: [],
  note: {
    zh: '質量是 GCAT 的 Mass（發射時的質量，含推進劑，用了多年的衛星實際更輕），12.8% 的在軌酬載是 GCAT 估計的質量；國家同在軌酬載，蘇聯算俄羅斯，國際組織只算進世界合計。再入是狀態為再入大氣、受控離軌或降落的編目物體（酬載、火箭殘骸與碎片），年份是再入日期，用 GCAT 2026 年 11 月 6 日的更新，2026 年是到那天為止；只有追蹤得到、編進目錄的物體。',
    en: 'Mass is GCAT’s Mass field (mass at launch including propellant, so satellites that have been in service for years weigh less); 12.8% of payloads in orbit have masses estimated by GCAT. Countries follow payloads in orbit: Soviet objects count for Russia, and international organisations only in the world total. Re-entries are catalogued objects (payloads, rocket bodies and debris) whose status is re-entered, deorbited or landed, by re-entry date, from GCAT’s update of 6 November 2026, so 2026 runs to that date; only tracked, catalogued objects are included.',
  },
  panelExtra: () => import('./panels/SpaceMassPanel'),
  indicators: [
    {
      id: 'in-orbit-mass',
      label: { zh: '在軌酬載的總質量（依擁有國）', en: 'Mass of payloads in orbit (by owner)' },
      description: {
        zh: '每年年底仍在軌道上的酬載（衛星、太空船、太空站艙段）發射時的質量加總，依擁有國。2026 年全世界約 12,739 公噸：美國 8,067 公噸（13,178 顆）、俄羅斯（含蘇聯）1,474 公噸（1,672 顆）、中國 1,264 公噸（1,498 顆）、日本 256 公噸（223 顆）、英國 209 公噸（743 顆）、印度 164 公噸、法國 163 公噸、盧森堡 110 公噸、加拿大 98.6 公噸；台灣 4.1 公噸（35 顆）。英國的顆數第 4（OneWeb 的小衛星），質量排在只有 223 顆的日本後面；大型的同步軌道衛星與太空站才撐得起質量。',
        en: 'Launch mass of the payloads (satellites, spacecraft and space station modules) still in orbit at the end of each year, by owner. In 2026 the world total is about 12,739 tonnes: the US 8,067 t (13,178 payloads), Russia (including the Soviet Union) 1,474 t (1,672), China 1,264 t (1,498), Japan 256 t (223), the UK 209 t (743), India 164 t, France 163 t, Luxembourg 110 t and Canada 98.6 t; Taiwan 4.1 t (35). The UK is fourth by number (OneWeb’s small satellites) but trails Japan, with only 223, by mass: large geostationary satellites and space stations carry the weight.',
      },
      unit: { zh: '公斤', en: 'kg' },
      file: 'in-orbit-mass.json',
      layer: { kind: 'bubble', legendValues: [1e4, 1e5, 1e6] },
      format: tonnes,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'reentries',
      label: { zh: '每年再入大氣的物體', en: 'Objects re-entering each year' },
      description: {
        zh: '每年再入大氣、受控離軌或降落回地面的編目物體（酬載、火箭殘骸、碎片），依擁有國。2019 年 313 個、2020 年 412、2021 年 515，2022 年跳到 2,469，其中 1,379 個是宇宙-1408 號的碎片（俄羅斯 2021 年 11 月用反衛星飛彈擊碎的舊衛星），2023 年 2,033、2024 年 2,195、2025 年 1,908，2026 年到 11 月初 1,107。2025 年美國 993 個、中國 406、俄羅斯 283。台灣累計 16 個，福衛一號 2023 年再入，最近的是 2026 年的 Lilium 1；福衛二號還在軌道上。',
        en: 'Catalogued objects (payloads, rocket bodies and debris) re-entering the atmosphere, deorbited or landed each year, by owner. 313 in 2019, 412 in 2020 and 515 in 2021, then a jump to 2,469 in 2022, 1,379 of them fragments of Kosmos 1408 (an old satellite Russia destroyed with an anti-satellite missile in November 2021), 2,033 in 2023, 2,195 in 2024, 1,908 in 2025 and 1,107 in 2026 to early November. In 2025 the US accounted for 993, China 406 and Russia 283. Taiwan has 16 in all: FORMOSAT-1 re-entered in 2023 and the latest was Lilium 1 in 2026; FORMOSAT-2 is still in orbit.',
      },
      unit: { zh: '個', en: 'objects' },
      file: 'reentries.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: objects,
      formatTick: formatLargeTick,
      integer: true,
      shareOfWorld: true,
    },
  ],
};
