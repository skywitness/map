import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 醫院的表現：急性照護的結果與開刀要等多久（2026-11-04，製作手冊第二十批 317，合併 819、817；pipeline/topics/hospital_quality.py）：
 * OECD Health Care Quality Indicators（急性照護）與 Health Statistics（等待時間），OECD 資料條款。台灣沒有。
 */

const OECD_LICENSE = { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' };

export const hospitalQuality: TopicDefinition = {
  id: 'hospital-quality',
  title: { zh: '醫院的表現：急重症照護與開刀要等多久', en: 'Hospital performance: acute care and surgical waiting times' },
  shortTitle: { zh: '醫院的表現', en: 'Hospital performance' },
  defaultIndicator: 'mortality',
  defaultYear: 2023,
  sources: [
    {
      name: {
        zh: 'OECD Health Care Quality Indicators：Acute care（急性照護）',
        en: 'OECD Health Care Quality Indicators: Acute care',
      },
      url: 'https://data-explorer.oecd.org/',
      license: OECD_LICENSE,
    },
    {
      name: { zh: 'OECD Health Statistics：Waiting times for elective surgery（等待時間）', en: 'OECD Health Statistics: Waiting times for elective surgery' },
      url: 'https://data-explorer.oecd.org/',
      license: OECD_LICENSE,
    },
  ],
  note: {
    zh: '只有向 OECD 回報的約 40 國（等待時間只有 15–18 國），各國用 5 年內最近的一年。死亡率是年齡與性別標準化的，但各國的住院、轉院與死因登錄方式不同，只能大略比較：這裡用「同一次住院內」的死亡（unlinked，國家多），不含出院後的死亡；串檔算出院後死亡的版本（linked）國家較少，沒有混用。台灣沒有向 OECD 回報；醫策會與健保署有各自的醫療品質指標，但口徑與標準化方式不同，沒有放進來。',
    en: 'Only the roughly 40 countries reporting to the OECD (15–18 for waiting times); each shows its latest year within five. Mortality rates are age- and sex-standardised, but countries differ in how they admit, transfer and record deaths, so comparisons are approximate. This uses deaths during the same hospital stay (unlinked data, more countries), excluding deaths after discharge; the linked version that includes them covers fewer countries and is not mixed in. Taiwan does not report to the OECD; its own hospital quality indicators use different definitions and standardisation and are not included.',
  },
  noValue: {
    TWN: { zh: '沒有向 OECD 回報', en: 'Not reported to the OECD' },
  },
  indicators: [
    {
      id: 'mortality',
      label: { zh: '住院後 30 天死亡率', en: '30-day mortality after admission' },
      description: {
        zh: '45 歲以上因急症住院，30 天內在同一次住院中死亡的比例（每 100 次住院，年齡與性別標準化），選上方的「疾病」切換。缺血性腦中風：捷克 26.2（2023 年）、拉脫維亞 17.3、墨西哥 17.2；挪威 4.0、南韓 3.3、日本 2.1。急性心肌梗塞：墨西哥 22.6、拉脫維亞 13.5、羅馬尼亞 13.1；冰島 3.0、荷蘭 2.9、挪威 2.6。出血性腦中風本來就高：拉脫維亞 50.6、羅馬尼亞 36.0；日本 9.7。捷克的腦中風特別高可能跟收治與轉院的方式有關。',
        en: 'Share of people aged 45+ admitted with an acute condition who died within 30 days during the same hospital stay (per 100 admissions, age- and sex-standardised); switch with “Condition” above. Ischaemic stroke: Czechia 26.2 (2023), Latvia 17.3, Mexico 17.2; Norway 4.0, South Korea 3.3, Japan 2.1. Heart attack: Mexico 22.6, Latvia 13.5, Romania 13.1; Iceland 3.0, the Netherlands 2.9, Norway 2.6. Haemorrhagic stroke is deadlier everywhere: Latvia 50.6, Romania 36.0; Japan 9.7. Czechia’s high stroke figure may reflect how patients are admitted and transferred.',
      },
      unit: { zh: '每 100 次住院', en: 'per 100 admissions' },
      file: 'mortality-{item}.json',
      dimension: {
        label: { zh: '疾病', en: 'Condition' },
        options: [
          { id: 'ischaemic-stroke', label: { zh: '缺血性腦中風', en: 'Ischaemic stroke' } },
          { id: 'ami', label: { zh: '急性心肌梗塞', en: 'Heart attack (AMI)' } },
          { id: 'haemorrhagic-stroke', label: { zh: '出血性腦中風', en: 'Haemorrhagic stroke' } },
        ],
        defaultOption: 'ischaemic-stroke',
      },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [4, 6, 8, 10, 13, 17] },
        itemScales: {
          ami: { type: 'sequential', thresholds: [4, 5, 6, 8, 10, 13] },
          'haemorrhagic-stroke': { type: 'sequential', thresholds: [15, 20, 25, 30, 35, 40] },
        },
      },
      format: (v) => tr({ zh: `每 100 次住院 ${fixed(v, 1)} 人`, en: `${fixed(v, 1)} per 100 admissions` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'hip-fracture',
      label: { zh: '髖骨折 2 天內開刀的比例', en: 'Hip-fracture surgery within 2 days' },
      description: {
        zh: '65 歲以上髖骨折住院，2 天內就開刀的比例（年齡與性別標準化）；越早開刀，死亡與併發症越少。挪威 98.1%（2024 年）、荷蘭 95.4%、德國 93.8%、瑞典 93.5%；羅馬尼亞 45.6%、拉脫維亞 43.7%。只有 30 國。',
        en: 'Share of people aged 65+ admitted with a hip fracture who had surgery within two days (age- and sex-standardised); earlier surgery means fewer deaths and complications. Norway 98.1% (2024), the Netherlands 95.4%, Germany 93.8%, Sweden 93.5%; Romania 45.6%, Latvia 43.7%. Only 30 countries.',
      },
      unit: '%',
      file: 'hip-fracture.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [50, 60, 70, 80, 90, 95] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'waiting',
      label: { zh: '開刀要等多久', en: 'Waiting time for surgery' },
      description: {
        zh: '從專科醫師評估到動手術，等待天數的中位數，選上方的「手術」切換。膝關節置換：智利 912 天（2025 年）、哥斯大黎加 522、澳洲 255、匈牙利 229；荷蘭 78、以色列 70、義大利 47、丹麥 42。心臟繞道：英國 84、挪威 70；義大利、加拿大 9、匈牙利 5。只有 15–18 國，地圖大部分是灰色；「還在排隊的人已經等多久」是另一種算法，沒有混用。',
        en: 'Median days from specialist assessment to surgery; switch with “Operation” above. Knee replacement: Chile 912 days (2025), Costa Rica 522, Australia 255, Hungary 229; the Netherlands 78, Israel 70, Italy 47, Denmark 42. Coronary bypass: the UK 84, Norway 70; Italy and Canada 9, Hungary 5. Only 15–18 countries, so most of the map is grey; the time already waited by people still on the list is a different measure and is not mixed in.',
      },
      unit: { zh: '天', en: 'days' },
      file: 'waiting-{item}.json',
      dimension: {
        label: { zh: '手術', en: 'Operation' },
        options: [
          { id: 'knee', label: { zh: '膝關節置換', en: 'Knee replacement' } },
          { id: 'cabg', label: { zh: '心臟繞道', en: 'Coronary bypass' } },
          { id: 'hysterectomy', label: { zh: '子宮切除', en: 'Hysterectomy' } },
          { id: 'prostatectomy', label: { zh: '經尿道前列腺切除', en: 'Transurethral prostatectomy' } },
        ],
        defaultOption: 'knee',
      },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [60, 90, 120, 180, 270, 400] },
        itemScales: {
          cabg: { type: 'sequential', thresholds: [10, 20, 30, 45, 60, 80] },
          hysterectomy: { type: 'sequential', thresholds: [30, 45, 60, 80, 120, 180] },
          prostatectomy: { type: 'sequential', thresholds: [30, 45, 60, 80, 120, 180] },
        },
      },
      format: (v) => tr({ zh: `${fixed(v, 0)} 天`, en: `${fixed(v, 0)} days` }),
      formatTick: (v) => fixed(v, 0),
    },
  ],
};
