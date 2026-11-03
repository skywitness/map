import type { Text } from '../i18n/lang';
import type { TopicDefinition } from './types';

/**
 * 藥物過敏與藥效的基因（2026-11-03，製作手冊第十九批 291；pipeline/topics/drug_genes.py）：
 * CPIC 依 9 個生物地理群的等位基因頻率（CC0）。依遺傳族群、不是國家，所以地圖不上色，內容在左側欄
 * （worldPanel，panels/DrugGenesPanel.tsx；2026-11-03 以前是沒選國家時的右側欄）。各國版等 Allele Frequency Net Database 的授權確認後再補。
 */

/** 子項目：等位基因與相關的藥（側欄的說明在 DrugGenesPanel） */
export const DRUG_ALLELES: { id: string; label: Text }[] = [
  { id: 'b1502', label: { zh: 'HLA-B*15:02（抗癲癇藥 carbamazepine）', en: 'HLA-B*15:02 (carbamazepine)' } },
  { id: 'a3101', label: { zh: 'HLA-A*31:01（carbamazepine）', en: 'HLA-A*31:01 (carbamazepine)' } },
  { id: 'b5801', label: { zh: 'HLA-B*58:01（降尿酸藥 allopurinol）', en: 'HLA-B*58:01 (allopurinol)' } },
  { id: 'b5701', label: { zh: 'HLA-B*57:01（愛滋病藥 abacavir）', en: 'HLA-B*57:01 (abacavir)' } },
  { id: 'cyp2c19-2', label: { zh: 'CYP2C19*2（抗血小板藥 clopidogrel）', en: 'CYP2C19*2 (clopidogrel)' } },
  { id: 'cyp2c9-3', label: { zh: 'CYP2C9*3（抗凝血藥 warfarin）', en: 'CYP2C9*3 (warfarin)' } },
  { id: 'nudt15-3', label: { zh: 'NUDT15*3（thiopurine 類藥物）', en: 'NUDT15*3 (thiopurines)' } },
  { id: 'dpyd-2a', label: { zh: 'DPYD*2A（化療藥 fluorouracil）', en: 'DPYD*2A (fluorouracil)' } },
];

export const drugGenes: TopicDefinition = {
  id: 'drug-genes',
  title: { zh: '藥物過敏與藥效的基因', en: 'Genes behind drug reactions' },
  shortTitle: { zh: '藥物過敏的基因', en: 'Drug reaction genes' },
  defaultIndicator: 'allele',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: {
        zh: 'CPIC（Clinical Pharmacogenetics Implementation Consortium）資料庫：population_frequency_view（依生物地理群的等位基因頻率）',
        en: 'CPIC (Clinical Pharmacogenetics Implementation Consortium) database: population_frequency_view (allele frequencies by biogeographic group)',
      },
      url: 'https://cpicpgx.org/',
      license: 'CC0 1.0',
    },
    {
      name: { zh: '衛生福利部：含 Carbamazepine 成分藥品宜先檢測 HLA-B*1502（2010）', en: 'Ministry of Health and Welfare (Taiwan): HLA-B*1502 testing before carbamazepine (2010)' },
      url: 'https://www.mohw.gov.tw/cp-2704-26506-1.html',
      license: { zh: '政府網站資料開放宣告', en: 'Government website open data declaration' },
    },
  ],
  note: {
    zh: '頻率是 CPIC 把各國已發表的研究依 9 個生物地理群（東亞、中亞與南亞、近東、歐洲、撒哈拉以南非洲、非裔美洲與加勒比海、拉丁美洲裔、美洲原住民、大洋洲）依人數加權平均的結果，是依遺傳族群、不是依國家，所以地圖不上色；台灣的研究算在東亞。同一個群裡差異可能很大（例如東亞裡 HLA-B*15:02 從幾乎沒有到一成以上都有），個人要不要做基因檢測請問醫師、藥師。帶這些基因不代表一定會出事，只是風險比較高；不要把族群當成風險標籤。各國的數字（Allele Frequency Net Database）授權還沒確認，確認後再補。',
    en: 'Frequencies are CPIC’s subject-weighted averages of published studies in nine biogeographic groups (East Asian, Central/South Asian, Near Eastern, European, sub-Saharan African, African American/Afro-Caribbean, Latino, American and Oceanian). They are by genetic ancestry group, not by country, so the map is not coloured; Taiwanese studies count as East Asian. Groups vary widely inside (HLA-B*15:02 ranges from almost none to over 10% within East Asia, for example); ask a doctor or pharmacist about genetic testing. Carrying these genes does not mean a reaction will happen, only that the risk is higher; they are not labels for any group. Country figures (Allele Frequency Net Database) await licence confirmation.',
  },
  worldPanel: { title: { zh: '各遺傳族群的頻率', en: 'Frequency by ancestry group' }, load: () => import('./panels/DrugGenesPanel') },
  indicators: [
    {
      id: 'allele',
      label: { zh: '等位基因的頻率（依遺傳族群）', en: 'Allele frequency (by ancestry group)' },
      description: {
        zh: '同一顆藥在不同人身上的風險不同：例如抗癲癇藥 carbamazepine，帶 HLA-B*15:02 的人可能發生致命的嚴重皮膚過敏，這個基因在東亞、東南亞與南亞較多，所以台灣健保 2010 年起給付用藥前的基因檢測。選一個基因，左邊的側欄是它在 9 個遺傳族群的頻率（依族群，不是國家，地圖不上色）。',
        en: 'The same drug carries different risks for different people: with the epilepsy drug carbamazepine, carriers of HLA-B*15:02 can develop a life-threatening skin reaction, and the gene is more common in East, Southeast and South Asia, which is why Taiwan’s national health insurance has paid for testing before treatment since 2010. Pick a gene; the panel on the left shows its frequency in nine ancestry groups (by group, not by country, so the map is not coloured).',
      },
      unit: '',
      file: 'allele/{item}.json',
      dimension: { label: { zh: '基因與藥物', en: 'Gene and drug' }, options: DRUG_ALLELES, defaultOption: 'b1502' },
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      missing: { zh: '依遺傳族群、不是國家，國家不上色，看左邊的側欄', en: 'By ancestry group, not country; countries are not coloured (see the panel on the left)' },
    },
  ],
};
