import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { IndicatorDef, SourceDef } from './types';

/**
 * 搭火車有多安全：鐵路事故的死傷（2026-11-07，製作手冊第二十七批 567，候選 1280；pipeline/topics/rail_accidents.py）：
 * 擴充「鐵路」。Eurostat 的重大鐵路事故件數與死亡人數（2004–2015／2016 年），側欄是死者的身分與事故類型。
 */
export const RAIL_ACCIDENT_IDS = ['rail-deaths', 'rail-passenger-deaths', 'rail-accidents'];

const people = (v: number) => tr({ zh: `${fixed(v, 0)} 人`, en: fixed(v, 0) });

export const railSafety: { sources: SourceDef[]; indicators: IndicatorDef[] } = {
  sources: [
    {
      name: {
        zh: 'Eurostat：重大鐵路事故的死傷人數（rail_ac_catvict）與件數（rail_ac_catnmbr）',
        en: 'Eurostat: victims of significant railway accidents (rail_ac_catvict) and number of accidents (rail_ac_catnmbr)',
      },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/rail_ac_catvict/default/table',
      license: 'CC BY 4.0',
    },
  ],
  indicators: [
    {
      id: 'rail-deaths',
      label: { zh: '鐵路事故的死亡人數', en: 'Deaths in railway accidents' },
      description: {
        zh: '重大鐵路事故的死亡人數（Eurostat，2004–2015 年，只有歐洲；自殺不算）。死者絕大多數不是乘客，而是走過平交道或擅自走進路線被車撞的人：2015 年 31 國共 1,064 人死亡，其中旅客 27 人、鐵路員工 39 人，其他 998 人。波蘭 2004 年 276 人 → 2015 年 227 人最多，德國 167 → 146、匈牙利 94 → 108、羅馬尼亞 40 → 81、法國 93 → 53，土耳其 219 → 50 降得最多。捷克 2005 年 251 人、2006 年 52 人，這種跳動多半是申報口徑改變，不能當成真的少了八成。Eurostat 2016 年以後不再收這個表（移交歐盟鐵路局），所以只到 2015 年。點國家看死者的身分與事故類型。',
        en: 'Deaths in significant railway accidents (Eurostat, 2004–2015, Europe only; suicides are excluded). Most of the dead are not passengers but people crossing at level crossings or walking onto the line: in 2015 the 31 countries recorded 1,064 deaths, of which 27 were passengers, 39 railway staff and 998 others. Poland has the most, 276 in 2004 and 227 in 2015; Germany went from 167 to 146, Hungary from 94 to 108, Romania from 40 to 81, France from 93 to 53, and Türkiye fell the most, from 219 to 50. Czechia’s fall from 251 in 2005 to 52 in 2006 is most likely a change in reporting, not a real drop of four fifths. Eurostat stopped collecting this table after 2016 (the European Union Agency for Railways took it over), so it ends in 2015. Click a country for the victims and accident types.',
      },
      unit: { zh: '人', en: 'deaths' },
      file: 'rail-deaths.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: people,
      integer: true,
      defaultYear: 2015,
    },
    {
      id: 'rail-passenger-deaths',
      label: { zh: '鐵路事故死亡的旅客', en: 'Passengers killed in railway accidents' },
      description: {
        zh: '重大鐵路事故裡死亡的旅客（Eurostat，2004–2015 年，只有歐洲）。每個國家每年多半只有個位數：2015 年捷克 6 人、法國 4 人、德國、匈牙利、羅馬尼亞各 3 人，歐盟 27 國合計 27 人；同一年歐盟 27 國的道路死亡是 24,358 人（Eurostat tran_sf_roadro）。大事故才會讓數字跳上去：西班牙 2013 年 82 人，其中出軌 79 人（那年 7 月聖地牙哥－德孔波斯特拉附近的高速列車出軌）。',
        en: 'Passengers killed in significant railway accidents (Eurostat, 2004–2015, Europe only). Most countries have single figures each year: in 2015 Czechia had 6, France 4, and Germany, Hungary and Romania 3 each, 27 across the EU‑27, against 24,358 road deaths in the EU‑27 that year (Eurostat tran_sf_roadro). Only major accidents push the figure up: Spain had 82 in 2013, 79 of them in derailments (the high-speed derailment near Santiago de Compostela that July).',
      },
      unit: { zh: '人', en: 'deaths' },
      file: 'rail-passenger-deaths.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 50] },
      format: people,
      integer: true,
      defaultYear: 2015,
    },
    {
      id: 'rail-accidents',
      label: { zh: '重大鐵路事故件數', en: 'Significant railway accidents' },
      description: {
        zh: '重大鐵路事故的件數（Eurostat，2004–2016 年，只有歐洲）：有人死亡或重傷、財物損失很大，或交通中斷很久的事故，包括碰撞、出軌、平交道事故、行進中的車輛撞到人與車輛起火。歐盟 27 國 2006 年 4,939 件 → 2015 年 2,220 件，少了一半多；出軌 455 → 198 件。波蘭 2015 年 639 件最多（出軌 127 件）。',
        en: 'Number of significant railway accidents (Eurostat, 2004–2016, Europe only): accidents involving a death or serious injury, significant damage or long disruption, including collisions, derailments, level-crossing accidents, people struck by moving rolling stock and fires in rolling stock. The EU‑27 went from 4,939 in 2006 to 2,220 in 2015, down by more than half, and derailments from 455 to 198. Poland had the most in 2015, 639 (127 derailments).',
      },
      unit: { zh: '件', en: 'accidents' },
      file: 'rail-accidents.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: (v) => tr({ zh: `${fixed(v, 0)} 件`, en: fixed(v, 0) }),
      integer: true,
      defaultYear: 2015,
    },
  ],
};
