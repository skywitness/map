import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicPart } from './parts';
import type { DimensionDef } from './types';

/**
 * 警察、法官與監所管理員（2026-11-05，製作手冊第二十二批 390；pipeline/topics/crime_staff.py，資料在 crime/staff/）：
 * Eurostat crim_just_job 的歐洲 37 國，治安與司法主題（crime.ts）用 withParts 接上。英國各地區與科索沃依 Eurostat 條款不收，
 * UNODC 的全球警察人數不准轉載，所以只有歐洲；多國最新年份很舊，用 10 年內最近一年。
 */

const OCCUPATION: DimensionDef = {
  label: { zh: '職業', en: 'Occupation' },
  options: [
    { id: 'police', label: { zh: '警察', en: 'Police officers' } },
    { id: 'judges', label: { zh: '職業法官', en: 'Professional judges' } },
    { id: 'prison-staff', label: { zh: '成人監所管理員', en: 'Adult prison staff' } },
  ],
  defaultOption: 'police',
};

const PER_100K = { zh: '人/十萬人', en: 'per 100,000 people' };
/** Eurostat crim_just_job 有資料的 37 國（英國各地區、科索沃不收）；要跟 staff-detail.json 的國家一致 */
const COVERAGE = {
  countries: 'ALB AUT BEL BGR BIH CHE CYP CZE DEU DNK ESP EST FIN FRA GRC HRV HUN IRL ISL ITA LIE LTU LUX LVA MKD MLT MNE NLD NOR POL PRT ROU SRB SVK SVN SWE TUR'.split(' '),
  reason: { zh: '只有歐洲（Eurostat）', en: 'Europe only (Eurostat)' },
};

/** 這兩個指標用這一段的側欄 */
export const STAFF_INDICATORS = ['justice-staff', 'justice-staff-female'];

export const justiceStaffPart: TopicPart = {
  name: { zh: '警察、法官與監所管理員', en: 'Police, judges and prison staff' },
  sources: [
    {
      name: { zh: 'Eurostat，警察、法官與監所人員（crim_just_job）', en: 'Eurostat, Police officers, professional judges and prison staff (crim_just_job)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/crim_just_job/default/table',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: 'Eurostat 的警察是 ISCO-08 的 5412「警察」這個職業，憲兵（義大利的 Carabinieri、法國的 Gendarmerie）、邊防等各國歸類不同，數字可能差兩成；職業法官不含陪審員、非職業的法官。英國各地區與科索沃依 Eurostat 的條款只准非商業使用，沒有畫；UNODC 的全球警察人數不准轉載，所以只有歐洲。多國最新的年份很舊（塞爾維亞 2015、挪威 2014），地圖用 10 年內最近一年，tooltip 寫年份。台灣沒有找到這幾種人數的開放資料。',
    en: 'Eurostat’s police are ISCO-08 occupation 5412 “police officers”; gendarmeries (Italy’s Carabinieri, France’s Gendarmerie), border guards and others are classified differently from country to country, which can shift figures by a fifth. Professional judges exclude jurors and lay judges. The UK’s regions and Kosovo may only be used non-commercially under Eurostat’s terms and are not shown, and UNODC’s global police figures may not be redistributed, so only Europe is covered. Some countries’ latest figures are old (Serbia 2015, Norway 2014); the map uses the latest year within ten, given in the tooltip. No open data was found for Taiwan.',
  },
  panelExtra: () => import('./panels/JusticeStaffPanel'),
  indicators: [
    {
      id: 'justice-staff',
      label: { zh: '人數（每十萬人）', en: 'per 100,000 people' },
      description: {
        zh: '每 10 萬人有幾位警察、職業法官、成人監所管理員，選上方的「職業」切換（Eurostat，歐洲 37 國，10 年內最近一年）。警察：塞爾維亞 596.3（2015）、土耳其 578.5、賽普勒斯 564.9、蒙特內哥羅 561.7、希臘 559.2 最多，芬蘭 139.4、挪威 168.4（2014）、丹麥 194.2 最少；德國 320.4、西班牙 379.0。職業法官：列支敦斯登 50.0、克羅埃西亞 43.3、蒙特內哥羅 42.5，德國 26.3、法國 11.2、義大利 7.9，英美法系的愛爾蘭 3.6 最少。成人監所管理員：阿爾巴尼亞 149.2（2023）、盧森堡 130.1、匈牙利 104.1，冰島 35.9（2023）、芬蘭 37.1、波蘭 40.3 最少。',
        en: 'Police officers, professional judges and adult prison staff per 100,000 people; switch with “Occupation” above (Eurostat, 37 European countries, latest year within ten). Police: Serbia 596.3 (2015), Turkey 578.5, Cyprus 564.9, Montenegro 561.7 and Greece 559.2 have the most; Finland 139.4, Norway 168.4 (2014) and Denmark 194.2 the fewest; Germany 320.4, Spain 379.0. Judges: Liechtenstein 50.0, Croatia 43.3, Montenegro 42.5; Germany 26.3, France 11.2, Italy 7.9; common-law Ireland the fewest at 3.6. Adult prison staff: Albania 149.2 (2023), Luxembourg 130.1, Hungary 104.1; Iceland 35.9 (2023), Finland 37.1 and Poland 40.3 the fewest.',
      },
      unit: PER_100K,
      file: 'staff/{item}.json',
      dimension: OCCUPATION,
      defaultYear: 'latest',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 50, 100, 250, 400] } },
      format: (v) => tr({ zh: `${fixed(v, 1)} 人`, en: `${fixed(v, 1)} per 100,000` }),
      formatTick: (v) => fixed(v, 0),
      coverage: COVERAGE,
    },
    {
      id: 'justice-staff-female',
      label: { zh: '女性比例', en: 'who are women' },
      description: {
        zh: '警察、職業法官、成人監所管理員有多少比例是女性，選上方的「職業」切換（Eurostat，10 年內最近一年）。職業法官多半女性比較多：斯洛維尼亞 81.4%、拉脫維亞 79.7%、希臘 75.5%，最少的賽普勒斯（2023）也有 42.3%。警察：拉脫維亞 48.9%、立陶宛 43.3%（2023）、荷蘭 40.9%，土耳其 7.4%、義大利 8.7%（2019）。成人監所管理員：愛沙尼亞 57.3%（2023）、瑞典 48.9%，希臘 12.4%、土耳其 14.0%。',
        en: 'Share of police officers, professional judges and adult prison staff who are women; switch with “Occupation” above (Eurostat, latest year within ten). Most judges are women in most countries: Slovenia 81.4%, Latvia 79.7%, Greece 75.5%, and even the lowest, Cyprus (2023), 42.3%. Police: Latvia 48.9%, Lithuania 43.3% (2023), the Netherlands 40.9%; Turkey 7.4%, Italy 8.7% (2019). Adult prison staff: Estonia 57.3% (2023), Sweden 48.9%; Greece 12.4%, Turkey 14.0%.',
      },
      unit: '%',
      file: 'staff-female/{item}.json',
      dimension: OCCUPATION,
      defaultYear: 'latest',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 20, 30, 40, 50, 65] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${fixed(v, 0)}%`,
      coverage: COVERAGE,
    },
  ],
};
