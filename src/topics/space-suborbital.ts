import { tr } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { TopicPart } from './parts';
import type { PointRecord } from './types';

/**
 * 太空的擴充：探空火箭與次軌道發射（2026-11-07，製作手冊第二十七批 606，候選 1335；pipeline/topics/space_suborbital.py，
 * 資料在 public/data/topics/space/）：GCAT 的 launch.tsv 裡飛彈以外的次軌道發射，依發射業者的國家；疊加次軌道的發射場。
 */
const n0 = (v: number) => fixed(v, 0);
const launches = (v: number) => tr({ zh: `${n0(v)} 次`, en: `${n0(v)} ${Math.round(v) === 1 ? 'launch' : 'launches'}` });

function siteTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const n = typeof p.n === 'number' ? p.n : 0;
  const span = p.first === p.last ? String(p.first) : `${p.first}–${p.last}`;
  return {
    title: String(p.name ?? ''),
    detail: [typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null, tr({ zh: `次軌道發射 ${n0(n)} 次（${span}）`, en: `${launches(n)} suborbital (${span})` })]
      .filter(Boolean)
      .join(' · '),
    properNoun: typeof p.full === 'string' && p.full !== p.name ? p.full : undefined,
  };
}

export const spaceSuborbitalPart: TopicPart = {
  name: { zh: '次軌道發射', en: 'Suborbital launches' },
  sources: [],
  note: {
    zh: '次軌道發射是 GCAT 發射清單裡沒有進入軌道的火箭：探空火箭、高空探空火箭、載人的次軌道飛行、火箭的測試飛行與差一點入軌的，不含飛彈試射、沒有離開大氣層的火箭與彈頭的再入測試。國家是發射業者所屬的國家（蘇聯算俄羅斯），206 次對不到國家。海上與空中發射沒有固定的場址，不畫成點。',
    en: 'Suborbital launches are rockets in GCAT’s launch list that did not reach orbit: sounding rockets, high-altitude sounding rockets, crewed suborbital flights, rocket test flights and near-orbital flights; missile tests, rockets that stayed within the atmosphere and warhead re-entry tests are excluded. Countries are the launch provider’s (Soviet launches count for Russia); 206 launches could not be assigned. Sea and air launches have no fixed site and are not shown as points.',
  },
  overlays: [
    {
      kind: 'points',
      id: 'suborbital-sites',
      file: 'suborbital-sites.json',
      label: { zh: '發射場（次軌道）', en: 'Launch sites (suborbital)' },
      indicators: ['suborbital'],
      radius: { field: 'n', stops: [[1, 1.6], [10, 3], [100, 5.5], [1000, 10], [5000, 14]] },
      color: MAP_TOKENS.hues.red,
      sortField: 'n',
      timeField: 'first',
      sizeLegend: { title: { zh: '次軌道發射次數', en: 'Suborbital launches' }, values: [10, 100, 1000], format: n0 },
      tooltip: siteTooltip,
    },
  ],
  indicators: [
    {
      id: 'suborbital',
      label: { zh: '每年次軌道發射次數（探空火箭等）', en: 'Suborbital launches per year (sounding rockets and others)' },
      description: {
        zh: '每年沒有進入軌道的火箭發射（探空火箭、載人的次軌道飛行、火箭測試等，不含飛彈），依發射業者的國家。1945 年到 2026 年共 50,189 次，比入軌發射多很多；1970 年最多（2,894 次），1980 年 2,050、1990 年 721、2000 年 111、2010 年 50，2025 年 46 次。累計美國 33,169 次、俄羅斯（含蘇聯）9,545、印度 1,483、日本 1,390、德國 836、加拿大 602、法國 521、西班牙 519、英國 515、澳洲 423。台灣 12 次：國家太空中心的探空火箭從屏東九鵬發射 10 次（1998–2014 年），2021 年晉陞太空的 HAPITH I 在澳洲發射，2026 年中科院在九鵬 1 次。地圖上的點是次軌道的發射場。',
        en: 'Rocket launches each year that did not reach orbit (sounding rockets, crewed suborbital flights, rocket tests and so on, excluding missiles), by launch provider’s country. 50,189 from 1945 to 2026, far more than orbital launches; the peak was 1970 (2,894), then 2,050 in 1980, 721 in 1990, 111 in 2000, 50 in 2010 and 46 in 2025. In total the US 33,169, Russia (including the Soviet Union) 9,545, India 1,483, Japan 1,390, Germany 836, Canada 602, France 521, Spain 519, the UK 515 and Australia 423. Taiwan 12: 10 sounding rockets of its space agency from Jiupeng in Pingtung (1998–2014), TiSpace’s HAPITH I in Australia in 2021 and one by NCSIST at Jiupeng in 2026. Points are suborbital launch sites.',
      },
      unit: { zh: '次', en: 'launches' },
      file: 'suborbital.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: launches,
      formatTick: formatLargeTick,
      integer: true,
      shareOfWorld: true,
      overlayTime: 'cumulative',
    },
  ],
};
