import { tr } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 醫學影像與放射治療設備（2026-11-04，製作手冊第二十批 315，合併 812、814；pipeline/topics/medical_imaging.py）：
 * OECD Health Statistics 的設備台數與檢查次數（OECD 資料條款），台灣用衛福部年報表 14、15（只算醫院）。
 * 子項目是設備：設備台數有 6 種，檢查次數與每台的次數只有 CT、MRI、PET。
 */

const OECD_LICENSE = { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' };

const DEVICE_OPTIONS = [
  { id: 'ct', label: { zh: '電腦斷層（CT）', en: 'CT scanners' } },
  { id: 'mri', label: { zh: '磁振造影（MRI）', en: 'MRI units' } },
  { id: 'pet', label: { zh: '正子斷層（PET）', en: 'PET scanners' } },
  { id: 'gamma', label: { zh: '伽瑪攝影機（含 SPECT）', en: 'Gamma cameras (incl. SPECT)' } },
  { id: 'rt', label: { zh: '放射治療設備', en: 'Radiotherapy equipment' } },
  { id: 'mamm', label: { zh: '乳房攝影儀', en: 'Mammographs' } },
];
const EXAM_OPTIONS = DEVICE_OPTIONS.slice(0, 3);

const TW_HOSPITALS = {
  zh: '台灣用衛福部的醫院統計，不含診所與醫事放射所，比 OECD 的醫療院所合計偏低（台灣的附註有 OECD 國家只算醫院的數字）。',
  en: 'Taiwan uses the Ministry of Health and Welfare’s hospital statistics, which exclude clinics and imaging centres, so it is lower than the OECD all-provider totals (Taiwan’s note gives hospital-only figures for OECD countries).',
};

export const medicalImaging: TopicDefinition = {
  id: 'medical-imaging',
  title: { zh: '醫學影像與放射治療設備', en: 'Medical imaging and radiotherapy equipment' },
  shortTitle: { zh: '醫學影像設備', en: 'Medical imaging' },
  defaultIndicator: 'devices',
  defaultYear: 2023,
  sources: [
    {
      name: {
        zh: 'OECD Health Statistics：Medical technologies（設備台數）、Diagnostic exams（檢查次數）',
        en: 'OECD Health Statistics: Medical technologies (equipment) and Diagnostic exams',
      },
      url: 'https://data-explorer.oecd.org/',
      license: OECD_LICENSE,
    },
    {
      name: {
        zh: '衛生福利部統計處，醫療機構現況及醫院醫療服務量統計年報（114 年）表 14、表 15',
        en: 'Ministry of Health and Welfare (Taiwan), hospital services statistics 2025, tables 14 and 15',
      },
      url: 'https://www.mohw.gov.tw/dl-101451-edb3ead7-5658-4ec3-bdd8-38b891082abc.html',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
    {
      name: { zh: 'United Nations, World Population Prospects 2024（台灣的人口）', en: 'United Nations, World Population Prospects 2024 (Taiwan’s population)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  note: {
    zh: '只有向 OECD 回報的約 50 國（OECD 會員與幾個合作國）與台灣；WHO 的醫療設備統計只在 GHO 資料庫，條款不能改作，不用。各國用 5 年內最近的一年。設備台數是醫療院所合計（醫院加門診影像中心），有的國家只報醫院、有的漏報（CT、MRI 的 0 不畫），只能大略比較；PET 的 0 是真的沒有。檢查次數的 0 是沒有回報，不畫；每台一年超過 4 萬次的是機器數低報，不畫（哥倫比亞的 MRI 台數與每台次數都不畫）。',
    en: 'Only the roughly 50 countries reporting to the OECD (members and a few partners) and Taiwan; WHO’s medical device statistics are only in the GHO database, whose terms do not allow adaptation, so they are not used. Each country shows its latest year within five. Equipment counts cover all providers (hospitals plus outpatient imaging centres), but some countries report hospitals only and some under-report (zeros for CT and MRI are not shown), so comparisons are approximate; zeros for PET are genuine. Zero exam counts mean no report and are not shown; over 40,000 exams per scanner a year reflects under-counted machines and is not shown (Colombia’s MRI units and exams per unit are omitted).',
  },
  indicators: [
    {
      id: 'devices',
      label: { zh: '每百萬人的設備台數', en: 'Equipment per million people' },
      description: {
        zh: `每百萬人有幾台，選上方的「設備」切換。CT：日本 119.8 台（2023 年）遙遙領先，澳洲 80.0、紐西蘭 70.5、希臘 52.2；英國、以色列 10.9、墨西哥 7.2、哥倫比亞 6.0，台灣 21.3。MRI：日本 59.8、希臘 41.4、南韓 39.3、美國 38.0；墨西哥 2.9，台灣 13.7。PET：丹麥 9.2、美國 5.8；英國 0.4、墨西哥 0.1，台灣 3.3。放射治療：比利時 18.4、瑞士 16.9；墨西哥 1.7，台灣 9.9。${TW_HOSPITALS.zh}`,
        en: `Units per million people; switch with “Equipment” above. CT: Japan far ahead at 119.8 (2023), then Australia 80.0, New Zealand 70.5 and Greece 52.2; the UK and Israel 10.9, Mexico 7.2, Colombia 6.0; Taiwan 21.3. MRI: Japan 59.8, Greece 41.4, South Korea 39.3, the US 38.0; Mexico 2.9; Taiwan 13.7. PET: Denmark 9.2, the US 5.8; the UK 0.4, Mexico 0.1; Taiwan 3.3. Radiotherapy: Belgium 18.4, Switzerland 16.9; Mexico 1.7; Taiwan 9.9. ${TW_HOSPITALS.en}`,
      },
      unit: { zh: '台/百萬人', en: 'per million' },
      file: 'devices-{item}.json',
      dimension: { label: { zh: '設備', en: 'Equipment' }, options: DEVICE_OPTIONS, defaultOption: 'ct' },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [10, 15, 20, 30, 40, 60] },
        itemScales: {
          mri: { type: 'sequential', thresholds: [5, 10, 15, 20, 30, 40] },
          pet: { type: 'sequential', thresholds: [0.5, 1, 2, 3, 4, 6] },
          gamma: { type: 'sequential', thresholds: [2, 4, 6, 8, 12, 20] },
          rt: { type: 'sequential', thresholds: [3, 5, 7, 9, 11, 14] },
          mamm: { type: 'sequential', thresholds: [10, 15, 20, 30, 40, 60] },
        },
      },
      format: (v) => tr({ zh: `每百萬人 ${fixed(v, 1)} 台`, en: `${fixed(v, 1)} per million` }),
      formatTick: (v) => fixed(v, v < 10 ? 1 : 0),
    },
    {
      id: 'exams',
      label: { zh: '每千人的檢查次數', en: 'Exams per 1,000 people' },
      description: {
        zh: `一年做幾次檢查，每千人。CT：南韓 338.7 次（2024 年）、盧森堡 296、匈牙利 279、拉脫維亞 263、美國 254；哥倫比亞 43、秘魯 8.8，台灣 165.6。MRI：盧森堡 169、奧地利 168、德國 167、法國 163；台灣 52.1。PET：丹麥 31.1、法國 15.9；台灣 4.5。日本的機器最多，檢查次數卻只有 2014 年（CT 每千人 231 次）。${TW_HOSPITALS.zh}`,
        en: `Exams a year per 1,000 people. CT: South Korea 338.7 (2024), Luxembourg 296, Hungary 279, Latvia 263, the US 254; Colombia 43, Peru 8.8; Taiwan 165.6. MRI: Luxembourg 169, Austria 168, Germany 167, France 163; Taiwan 52.1. PET: Denmark 31.1, France 15.9; Taiwan 4.5. Japan has the most machines but reported exam counts only for 2014 (231 CT exams per 1,000). ${TW_HOSPITALS.en}`,
      },
      unit: { zh: '次/千人', en: 'per 1,000' },
      file: 'exams-{item}.json',
      dimension: { label: { zh: '設備', en: 'Equipment' }, options: EXAM_OPTIONS, defaultOption: 'ct' },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [75, 100, 150, 200, 250, 300] },
        itemScales: {
          mri: { type: 'sequential', thresholds: [25, 50, 75, 100, 125, 150] },
          pet: { type: 'sequential', thresholds: [1, 2, 4, 6, 10, 15] },
        },
      },
      format: (v) => tr({ zh: `每千人 ${fixed(v, 1)} 次`, en: `${fixed(v, 1)} per 1,000` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'per-scanner',
      label: { zh: '每台一年的檢查次數', en: 'Exams per scanner a year' },
      description: {
        zh: `每台機器一年做幾次檢查，看機器用得多兇。CT：匈牙利 24,272 次（2024 年）、以色列 18,248、盧森堡 12,015、加拿大 11,527；日本只有 2,153（2014 年，最新的一年）、賽普勒斯 1,993，台灣 7,780。日本的機器最多、每台做得最少，匈牙利、以色列機器少、每台做得多。MRI：匈牙利、比利時、以色列約 1 萬次；南韓 2,116，台灣 3,797。${TW_HOSPITALS.zh}`,
        en: `Exams per machine a year, a measure of how intensively machines are used. CT: Hungary 24,272 (2024), Israel 18,248, Luxembourg 12,015, Canada 11,527; Japan only 2,153 (2014, its latest year), Cyprus 1,993; Taiwan 7,780. Japan has the most machines and uses each the least; Hungary and Israel have few and use them heavily. MRI: about 10,000 in Hungary, Belgium and Israel; South Korea 2,116; Taiwan 3,797. ${TW_HOSPITALS.en}`,
      },
      unit: { zh: '次', en: 'exams' },
      file: 'per-scanner-{item}.json',
      dimension: { label: { zh: '設備', en: 'Equipment' }, options: EXAM_OPTIONS, defaultOption: 'ct' },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [3000, 4000, 5000, 7000, 10000, 15000] },
        itemScales: {
          mri: { type: 'sequential', thresholds: [2500, 3500, 4500, 6000, 7500, 9000] },
          pet: { type: 'sequential', thresholds: [1000, 1500, 2000, 3000, 4000, 5000] },
        },
      },
      format: (v) => tr({ zh: `每台 ${fixed(v, 0)} 次`, en: `${fixed(v, 0)} per scanner` }),
      formatTick: formatLargeTick,
    },
  ],
};
