import { BarList } from '../../charts/BarList';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { WorldPanelProps } from '../types';

/** pipeline/topics/drug_genes.py 的 groups.json：9 個生物地理群、每個等位基因在各群的頻率（%）與人數 */
interface GroupsFile {
  groups: string[];
  alleles: Record<string, { gene: string; allele: string; f: (number | null)[]; n: (number | null)[] }>;
}

const GROUP_NAMES: Record<string, { zh: string; en: string }> = {
  'East Asian': { zh: '東亞', en: 'East Asian' },
  'Central/South Asian': { zh: '中亞與南亞', en: 'Central/South Asian' },
  'Near Eastern': { zh: '近東（中東、北非）', en: 'Near Eastern' },
  European: { zh: '歐洲', en: 'European' },
  'Sub-Saharan African': { zh: '撒哈拉以南非洲', en: 'Sub-Saharan African' },
  'African American/Afro-Caribbean': { zh: '非裔美洲與加勒比海', en: 'African American/Afro-Caribbean' },
  Latino: { zh: '拉丁美洲裔', en: 'Latino' },
  American: { zh: '美洲原住民', en: 'Indigenous American' },
  Oceanian: { zh: '大洋洲', en: 'Oceanian' },
};

/** 每個等位基因的說明：跟什麼藥、會怎樣 */
const ABOUT: Record<string, { zh: string; en: string }> = {
  b1502: {
    zh: '抗癲癇藥 carbamazepine（也用於三叉神經痛、躁鬱症）：帶 HLA-B*15:02 的人吃了，可能發生史蒂芬斯-強森症候群、毒性表皮溶解症這類致命的嚴重皮膚過敏。東亞、東南亞與南亞較多，歐洲、非洲幾乎沒有，所以台灣、香港、新加坡等地用藥前先檢測；台灣健保 2010 年起給付這項檢測（衛福部）。',
    en: 'The epilepsy drug carbamazepine (also used for trigeminal neuralgia and bipolar disorder): carriers of HLA-B*15:02 can develop Stevens–Johnson syndrome or toxic epidermal necrolysis, life-threatening skin reactions. It is commoner in East, Southeast and South Asia and almost absent in Europe and Africa, so Taiwan, Hong Kong, Singapore and others test before treatment; Taiwan’s national health insurance has paid for the test since 2010 (Ministry of Health and Welfare).',
  },
  a3101: {
    zh: '同一種藥 carbamazepine 的另一種過敏（藥物疹、藥物反應伴嗜酸性白血球增多與全身症狀）：在日本人與歐洲人身上，跟 HLA-A*31:01 比較相關。',
    en: 'Another kind of reaction to the same drug, carbamazepine (drug rash, or DRESS): among Japanese and European patients it is linked more to HLA-A*31:01.',
  },
  b5801: {
    zh: '降尿酸藥 allopurinol（治痛風）：帶 HLA-B*58:01 的人發生嚴重皮膚過敏的風險高很多。東亞（台灣、中國、泰國等）、南亞與非洲較多，歐洲較少。',
    en: 'The uric-acid-lowering drug allopurinol (for gout): carriers of HLA-B*58:01 have a much higher risk of severe skin reactions. It is commoner in East Asia (Taiwan, China, Thailand and others), South Asia and Africa than in Europe.',
  },
  b5701: {
    zh: '愛滋病藥 abacavir：帶 HLA-B*57:01 的人容易發生過敏反應，用藥前要先檢測，是藥物基因檢測最早普及的例子之一。歐洲與南亞較多，東亞較少。',
    en: 'The HIV drug abacavir: carriers of HLA-B*57:01 are prone to a hypersensitivity reaction, so testing comes first; it was one of the first pharmacogenetic tests to become routine. Commoner in Europe and South Asia than in East Asia.',
  },
  'cyp2c19-2': {
    zh: 'CYP2C19*2 讓這個代謝酵素失去功能：帶兩個（慢代謝型）的人吃抗血小板藥 clopidogrel 效果差，部分抗憂鬱藥與胃藥（氫離子幫浦抑制劑）的濃度會偏高。大洋洲約六成、東亞與南亞約三成，歐洲約一成半。',
    en: 'CYP2C19*2 knocks out this drug-metabolising enzyme: people with two copies (poor metabolisers) get little benefit from the antiplatelet drug clopidogrel, and some antidepressants and stomach drugs (proton pump inhibitors) build up. About 60% in Oceania, about 30% in East and South Asia and about 15% in Europe.',
  },
  'cyp2c9-3': {
    zh: 'CYP2C9*3 讓這個酵素變慢：抗凝血藥 warfarin、抗癲癇藥 phenytoin 代謝慢，容易出血或過量，要減量。南亞、近東與歐洲較多。',
    en: 'CYP2C9*3 slows this enzyme: the blood thinner warfarin and the epilepsy drug phenytoin are cleared slowly, risking bleeding or toxicity, so doses are lowered. Commoner in South Asia, the Near East and Europe.',
  },
  'nudt15-3': {
    zh: 'thiopurine 類藥物（azathioprine、6-mercaptopurine，用於白血病與免疫疾病）：帶 NUDT15*3 的人容易骨髓抑制。東亞與南亞較多，歐洲很少（歐洲常用的是另一個基因 TPMT 的檢測）。',
    en: 'Thiopurine drugs (azathioprine and 6-mercaptopurine, for leukaemia and immune diseases): carriers of NUDT15*3 are prone to bone marrow suppression. Commoner in East and South Asia and rare in Europe (where testing usually focuses on another gene, TPMT).',
  },
  'dpyd-2a': {
    zh: '化療藥 fluorouracil、capecitabine：帶 DPYD*2A 的人無法正常分解這類藥，可能發生致命的毒性，歐洲已經建議用藥前檢測。歐洲約 0.8%，東亞很少。',
    en: 'The chemotherapy drugs fluorouracil and capecitabine: carriers of DPYD*2A cannot break them down normally and may suffer fatal toxicity, so European agencies recommend testing first. About 0.8% in Europe and rare in East Asia.',
  },
};

const TEXT = defineMessages({
  zh: {
    aria: (allele: string) => `${allele} 在各遺傳族群的頻率`,
    n: (n: string) => `合計 ${n} 人的研究`,
    note: '頻率是帶這個等位基因的染色體的比例（帶因的人大約是兩倍）。依遺傳族群、不是依國家；台灣的研究算在東亞。',
    pick: '在上面的「基因與藥物」換一個看看。',
  },
  en: {
    aria: (allele) => `Frequency of ${allele} by ancestry group`,
    n: (n) => `studies with ${n} people in all`,
    note: 'Frequencies are the share of chromosomes carrying the allele (roughly half the share of carriers). By ancestry group, not by country; Taiwanese studies count as East Asian.',
    pick: 'Try another one under “Gene and drug” above.',
  },
});

export default function DrugGenesPanel({ topic, item, tokens }: WorldPanelProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const { data } = useJson<GroupsFile>(`topics/${topic.id}/groups.json`);
  const id = item ?? 'b1502';
  const allele = data?.alleles[id];
  if (!data || !allele) return null;
  const name = `${allele.gene}${allele.allele.startsWith('*') ? allele.allele : ` ${allele.allele}`}`;
  const items = data.groups
    .map((g, i) => ({ g, f: allele.f[i], n: allele.n[i] }))
    .filter((x): x is { g: string; f: number; n: number | null } => x.f != null)
    .sort((a, b) => b.f - a.f)
    .map((x) => ({ key: x.g, label: (lang === 'en' ? GROUP_NAMES[x.g]?.en : GROUP_NAMES[x.g]?.zh) ?? x.g, value: x.f, color: tokens.accent }));
  const total = allele.n.reduce<number>((s, v) => s + (v ?? 0), 0);
  return (
    <section className="panel-section">
      <h3 translate="no">{name}</h3>
      <p className="note">{ABOUT[id]?.[lang]}</p>
      <BarList items={items} format={(v) => `${fixed(v, v < 1 ? 2 : 1)}%`} ariaLabel={text.aria(name)} />
      <p className="note">
        {text.note} {total > 0 && text.n(fixed(total, 0))}
      </p>
      <p className="note">{text.pick}</p>
    </section>
  );
}
