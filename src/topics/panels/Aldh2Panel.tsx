import { BarList } from '../../charts/BarList';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { WorldPanelProps } from '../types';

/** pipeline/topics/aldh2.py 的 aldh2.json：rs671 的 A（ALDH2*2）在各族群的頻率（%）與等位基因數 */
interface Aldh2File {
  populations: { id: string; f: number; n: number | null; src: string }[];
}

const NAMES: Record<string, { zh: string; en: string }> = {
  'gnomad-eas': { zh: '東亞（gnomAD）', en: 'East Asian (gnomAD)' },
  'gnomad-sas': { zh: '南亞（gnomAD）', en: 'South Asian (gnomAD)' },
  'gnomad-nfe': { zh: '歐洲，不含芬蘭（gnomAD）', en: 'European, non-Finnish (gnomAD)' },
  'gnomad-fin': { zh: '芬蘭（gnomAD）', en: 'Finnish (gnomAD)' },
  'gnomad-afr': { zh: '非洲與非裔（gnomAD）', en: 'African/African American (gnomAD)' },
  'gnomad-amr': { zh: '拉丁美洲裔（gnomAD）', en: 'Admixed American (gnomAD)' },
  'gnomad-mid': { zh: '中東（gnomAD）', en: 'Middle Eastern (gnomAD)' },
  'kg-jpt': { zh: '日本東京（1000 Genomes）', en: 'Japanese in Tokyo (1000 Genomes)' },
  'kg-chb': { zh: '北京的漢人（1000 Genomes）', en: 'Han Chinese in Beijing (1000 Genomes)' },
  'kg-chs': { zh: '華南的漢人（1000 Genomes）', en: 'Southern Han Chinese (1000 Genomes)' },
  'kg-khv': { zh: '胡志明市的京族（1000 Genomes）', en: 'Kinh in Ho Chi Minh City (1000 Genomes)' },
  'kg-cdx': { zh: '西雙版納的傣族（1000 Genomes）', en: 'Dai in Xishuangbanna (1000 Genomes)' },
  tommo: { zh: '日本（東北醫學巨庫 ToMMo）', en: 'Japanese (ToMMo)' },
  korean: { zh: '韓國（KOREAN）', en: 'Korean (KOREAN)' },
  korea1k: { zh: '韓國（Korea1K）', en: 'Korean (Korea1K)' },
  korea4k: { zh: '韓國（Korea4K）', en: 'Korean (Korea4K)' },
  vietnamese: { zh: '越南（Vietnamese）', en: 'Vietnamese (Vietnamese study)' },
};

const TEXT = defineMessages({
  zh: {
    title: 'ALDH2*2（rs671）在各族群的頻率',
    about:
      'ALDH2 是分解乙醛（酒精代謝的中間產物）的酵素。rs671 的 A 型（ALDH2*2）讓它幾乎失去作用，喝酒後乙醛累積，臉紅、心跳加快。帶這個基因又常喝酒的人，食道癌的風險明顯比較高；對心絞痛用的硝化甘油反應也比較差。它幾乎只出現在東亞：東亞約四分之一的等位基因是 ALDH2*2（約四成的人帶至少一個），歐洲、非洲幾乎沒有。',
    aria: 'ALDH2*2 在各族群的頻率',
    note: '頻率是帶 ALDH2*2 的染色體的比例（帶因的人大約是兩倍）。依遺傳族群或研究，不是依國家；資料庫沒有台灣的分組，所以不寫台灣的數字。資料：Ensembl（gnomAD v4、1000 Genomes）與 NCBI dbSNP。',
  },
  en: {
    title: 'ALDH2*2 (rs671) by population',
    about:
      'ALDH2 is the enzyme that breaks down acetaldehyde, an intermediate product of alcohol metabolism. The A variant of rs671 (ALDH2*2) all but disables it, so acetaldehyde builds up after drinking, causing flushing and a racing heart. Carriers who drink regularly have a markedly higher risk of oesophageal cancer, and respond less well to nitroglycerin for angina. It is found almost only in East Asia: about a quarter of East Asian alleles are ALDH2*2 (some 40% of people carry at least one), and it is almost absent in Europe and Africa.',
    aria: 'Frequency of ALDH2*2 by population',
    note: 'Frequencies are the share of chromosomes carrying ALDH2*2 (roughly half the share of carriers). By ancestry group or study, not by country; the databases have no Taiwanese group, so no figure is given for Taiwan. Data: Ensembl (gnomAD v4, 1000 Genomes) and NCBI dbSNP.',
  },
});

export default function Aldh2Panel({ topic, tokens }: WorldPanelProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const { data } = useJson<Aldh2File>(`topics/${topic.id}/aldh2.json`);
  if (!data) return null;
  const items = data.populations.map((p) => ({
    key: p.id,
    label: (lang === 'en' ? NAMES[p.id]?.en : NAMES[p.id]?.zh) ?? p.id,
    value: p.f,
    color: tokens.accent,
  }));
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <p className="note">{text.about}</p>
      <BarList items={items} format={(v) => `${fixed(v, v < 1 ? 3 : 1)}%`} ariaLabel={text.aria} />
      <p className="note">{text.note}</p>
    </section>
  );
}
