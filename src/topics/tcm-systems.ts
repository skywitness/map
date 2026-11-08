import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, ListPanelDef, ListRow, PointRecord, TopicDefinition } from './types';

/**
 * 傳統醫學的制度（新主題，2026-11-08，製作手冊第二十九批 691，候選 1552、1544；pipeline/topics/tcm_systems.py）：
 * WHO 2024 年報告 Annex 1 的四次調查（194 個會員國有沒有回報），與 2019 年報告區域表的政策、法規國數（說明裡）。
 * 2026-11-08 起（第二十九批 704、695–697、705）：2019 年報告第 5 章國家段落的逐國抽取（pipeline/data/who-tcm/countries-2019.csv，
 * 逐列附頁碼與原文）：六項制度的分數、各項制度、保險給付、點名的體系、有沒有寫到中醫、國家醫療服務輸送計畫。
 * 兩份報告 CC BY-NC-SA 3.0 IGO。
 */
const C = MAP_TOKENS.categorical;
const STATUS: CategoryDef[] = [
  { value: 1, label: { zh: '有', en: 'Yes' } },
  { value: 2, label: { zh: '正在訂', en: 'In preparation' } },
  { value: 3, label: { zh: '沒有', en: 'No' } },
  { value: 4, label: { zh: '報告沒寫明', en: 'Not stated' }, color: MAP_TOKENS.categoricalOther },
];
const INSURANCE: CategoryDef[] = [
  { value: 1, label: { zh: '公營保險有給付（或公私都有）', en: 'Covered by public insurance (or both)' }, color: C[0] },
  { value: 2, label: { zh: '只有私人保險給付', en: 'Private insurance only' }, color: C[1] },
  { value: 3, label: { zh: '有給付，報告沒寫是誰', en: 'Covered, insurer not stated' }, color: C[2] },
  { value: 4, label: { zh: '沒有給付', en: 'Not covered' }, color: C[3] },
  { value: 5, label: { zh: '報告沒寫明', en: 'Not stated' }, color: MAP_TOKENS.categoricalOther },
];
const SYSTEMS: CategoryDef[] = [
  { value: 1, label: { zh: '古典亞洲體系與歐美替代療法都點名', en: 'Both classical Asian systems and Western alternative therapies named' }, color: C[0] },
  { value: 2, label: { zh: '只點名古典亞洲體系', en: 'Classical Asian systems only' }, color: C[1] },
  { value: 3, label: { zh: '只點名歐美替代療法', en: 'Western alternative therapies only' }, color: C[2] },
  { value: 4, label: { zh: '都沒有點名', en: 'Neither named' }, color: MAP_TOKENS.categoricalOther },
];
const CHINESE: CategoryDef[] = [
  { value: 1, label: { zh: '段落寫到中醫（Chinese medicine）', en: 'Mentions Chinese medicine' }, color: C[0] },
  { value: 2, label: { zh: '寫的是韓醫或高麗醫學', en: 'Uses Korean or Koryo medicine instead' }, color: C[1] },
  { value: 3, label: { zh: '沒有寫到', en: 'Not mentioned' }, color: MAP_TOKENS.categoricalOther },
  { value: 4, label: { zh: '台灣（依台灣的法規，不在 WHO 報告）', en: 'Taiwan (from its own rules; not in the WHO report)' }, color: C[2] },
];
const PLAN: CategoryDef[] = [{ value: 1, label: { zh: '回答有（61 國裡的 13 國）', en: 'Yes (13 of 61 respondents)' } }];

// pipeline 的 ITEMS（加上最後的保險給付）同順序；facts.json 的 k 是這裡的位置，99 是點名的體系
const ITEMS: { id: string; label: Text }[] = [
  { id: 'policy', label: { zh: '國家級政策', en: 'National policy' } },
  { id: 'law', label: { zh: '法律或法規', en: 'Laws or regulations' } },
  { id: 'office', label: { zh: '國家級主管機關', en: 'National office' } },
  { id: 'institute', label: { zh: '國家級研究機構', en: 'National research institute' } },
  { id: 'herbal-reg', label: { zh: '草藥納入藥品管理', en: 'Herbal medicines regulated' } },
  { id: 'registration', label: { zh: '草藥要註冊', en: 'Herbal medicines registered' } },
  { id: 'pharmacopoeia', label: { zh: '用收了草藥的藥典', en: 'Pharmacopoeia with herbal medicines' } },
  { id: 'gmp', label: { zh: '草藥的製造規範', en: 'Manufacturing requirements' } },
  { id: 'surveillance', label: { zh: '上市後監視包含草藥', en: 'Post-market surveillance of herbal medicines' } },
  { id: 'neml', label: { zh: '基本藥物清單收草藥', en: 'Herbal medicines on the essential medicines list' } },
  { id: 'provider-reg', label: { zh: '從業人員受法規管', en: 'Providers regulated' } },
  { id: 'education', label: { zh: '正式的傳統醫學教育', en: 'Formal traditional medicine education' } },
];
const FACT_LABELS: Text[] = [...ITEMS.map((i) => i.label), { zh: '保險給付', en: 'Insurance coverage' }];
// 資料檔裡的名稱（pipeline 的 ASIAN、WESTERN 的中文鍵）→ 英文；鍵只當代碼用
const SYSTEM_EN: Record<string, string> = {
  中醫: 'Chinese medicine', 針灸: 'acupuncture', 阿育吠陀: 'Ayurveda', 尤納尼: 'Unani', 悉達: 'Siddha', 漢方: 'Kampo', 韓醫: 'Korean medicine', // i18n-ignore（代碼）
  高麗醫學: 'Koryo medicine', 藏醫: 'Sowa Rigpa', 泰國傳統醫學: 'Thai traditional medicine', 順勢療法: 'homeopathy', 自然療法: 'naturopathy', // i18n-ignore（代碼）
  整脊: 'chiropractic', 整骨: 'osteopathy', 人智醫學: 'anthroposophic medicine', // i18n-ignore（代碼）
};
const SEP = '、'; // i18n-ignore（資料檔的分隔符號）
const str = (v: unknown) => (typeof v === 'string' && v ? v : '');
const catLabel = (cats: CategoryDef[]) => (v: number) => tr(cats.find((c) => c.value === v)?.label ?? { zh: '', en: '' });

const FACTS_LIST: ListPanelDef = {
  label: { zh: 'WHO 報告怎麼寫', en: 'What the WHO report says' },
  tabLabel: { zh: '制度', en: 'Systems' },
  indicators: ['score', 'items', 'insurance', 'systems', 'chinese-medicine'],
  file: 'facts.json',
  countryField: 'iso3',
  empty: { zh: 'WHO 2019 年報告沒有這裡的段落', en: 'No country summary in the WHO 2019 report' },
  rows: (points: PointRecord[]) =>
    [...points]
      .sort((a, b) => Number(a.k) - Number(b.k))
      .map((p, i): ListRow => {
        const k = Number(p.k);
        const page = p.page == null || p.page === '' ? null : Number(p.page);
        if (k === 99) {
          const names = str(p.quote).split(SEP);
          return {
            key: `f-${i}`,
            title: tr({ zh: '報告點名的體系', en: 'Systems named in the report' }),
            lines: [getLang() === 'zh' ? names.join(SEP) : names.map((n) => SYSTEM_EN[n] ?? n).join(', ')],
            target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 3 },
          };
        }
        const label = tr(FACT_LABELS[k] ?? { zh: '', en: '' });
        const value = tr(STATUS.find((c) => c.value === Number(p.v))?.label ?? { zh: '', en: '' });
        return {
          key: `f-${i}`,
          title: `${label}${tr({ zh: '：', en: ': ' })}${value}`,
          lines: [
            str(p.quote),
            page === null
              ? tr({ zh: '依台灣的法規（不是 WHO 的資料）', en: 'From Taiwan’s own rules (not WHO data)' })
              : tr({ zh: `WHO 2019 年報告第 ${page} 頁`, en: `WHO 2019 report, p. ${page}` }),
          ],
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 3 },
        };
      }),
};
const RESPONDED: CategoryDef[] = [
  { value: 1, label: { zh: '有回報', en: 'Responded' } },
  { value: 2, label: { zh: '沒有回報', en: 'Did not respond' } },
];

export const tcmSystems: TopicDefinition = {
  id: 'tcm-systems',
  title: { zh: '傳統醫學的制度：各國的政策、法規與保險給付', en: 'Traditional medicine systems: policies, laws and insurance' },
  shortTitle: { zh: '傳統醫學的制度', en: 'Traditional medicine policy' },
  defaultIndicator: 'score',
  defaultYear: 2023,
  sources: [
    {
      name: {
        zh: 'WHO《WHO global report on traditional, complementary and integrative medicine 2024》Annex 1「WHO Member States that responded to the surveys by Region」',
        en: 'WHO, WHO global report on traditional, complementary and integrative medicine 2024, Annex 1 (Member States that responded to the surveys, by region)',
      },
      url: 'https://iris.who.int/server/api/core/bitstreams/f67507c0-30a3-41c0-b497-2fa9034b197d/content',
      license: 'CC BY-NC-SA 3.0 IGO',
    },
    {
      name: {
        zh: 'WHO《WHO global report on traditional and complementary medicine 2019》區域表 5.1–5.6 與第 5 章的國家段落（逐國抽取，手工整理）',
        en: 'WHO, WHO global report on traditional and complementary medicine 2019, regional tables 5.1–5.6 and the chapter 5 country summaries (extracted country by country)',
      },
      url: 'https://iris.who.int/server/api/core/bitstreams/a5de1ce2-b5c1-4c5d-b529-339bc5c47e24/content',
      license: 'CC BY-NC-SA 3.0 IGO',
    },
  ],
  note: {
    zh: '兩份 WHO 報告（CC BY-NC-SA 3.0 IGO，資料檔照同一授權）。逐國的制度是從 2019 年報告第 5 章 149 個會員國與 3 個英國海外領地的段落一國一國抽出來、手工整理的（每一列附頁碼與原文，大致是 2012 到 2018 年的狀態；資料檔在 GitHub 的 pipeline/data/who-tcm/）。WHO 區域表的全球與分區數：2018 年有國家級傳統醫學政策的 98 國（2005 年 45 國），非洲 40、西太平洋 17、美洲 11、歐洲 11、東南亞 10、東地中海 9；有法律或法規的 109 國（非洲 39、歐洲 21、美洲 15、西太平洋 13、東地中海 12、東南亞 9）；有國家級主管辦公室的 107 國、專家委員會 93 國、草藥納入藥品管理的 124 國。六區相加都等於報告的全球數。2023 年的第三次調查是政策 90 國、法規 90 國、辦公室 100 國、專家委員會 76 國、草藥管理 116 國，但只有 106 國回報，跟 2018 年的數不能直接比。台灣不是 WHO 會員國，不在調查裡；台灣有《中醫藥發展法》（2019 年 12 月 31 日公布）與衛福部中醫藥司，中醫門診由全民健保給付。',
    en: 'Two WHO reports (CC BY-NC-SA 3.0 IGO; the data files carry the same licence). Country-level provisions were extracted by hand from the chapter 5 summaries of the 2019 report for 149 Member States and 3 UK Overseas Territories (each row with its page and quotation, roughly the situation from 2012 to 2018; the data file is pipeline/data/who-tcm/ on GitHub). WHO’s regional tables give these global and regional counts: in 2018, 98 countries had a national traditional medicine policy (45 in 2005), including 40 in Africa, 17 in the Western Pacific, 11 each in the Americas and Europe, 10 in South-East Asia and 9 in the Eastern Mediterranean; 109 had laws or regulations (Africa 39, Europe 21, the Americas 15, Western Pacific 13, Eastern Mediterranean 12, South-East Asia 9); 107 had a national office, 93 an expert committee and 124 regulated herbal medicines. The six regions add up to the report’s global figures. The third survey in 2023 found 90 with a policy, 90 with laws or regulations, 100 with an office, 76 with an expert committee and 116 regulating herbal medicines, but only 106 countries responded, so these are not directly comparable with 2018. Taiwan is not a WHO Member State and is not in the surveys; it has a Chinese Medicine Development Act (promulgated 31 December 2019) and a Department of Chinese Medicine and Pharmacy, and National Health Insurance covers Chinese medicine outpatient care.',
  },
  listPanel: [FACTS_LIST],
  indicators: [
    {
      id: 'score',
      label: { zh: '六項制度有幾項', en: 'How many of six provisions' },
      description: {
        zh: 'WHO 2019 年報告第 5 章 149 個會員國的段落裡，六項制度寫明「有」的有幾項：國家級政策、法律或法規、國家級主管機關、草藥納入藥品管理、用收了草藥的藥典、保險給付。6 項都有的 11 國：迦納、巴西、伊朗、土耳其、不丹、印度、泰國、中國、蒙古、南韓、越南；5 項的 23 國，0 項的 18 國。段落是自由文字，很多國家沒有每一項都寫到，「報告沒寫明」算 0，所以分數低不等於沒有制度：WHO 的區域表 2018 年有國家級政策的是 98 國、主管機關 107 國，段落裡寫明的只有 67、77 國。沒有段落的 45 個會員國不上色。滑過國家看每一項，左邊的清單列出原文與頁碼。台灣不是 WHO 會員國，依台灣自己的法規補成 6 項（中醫藥發展法、衛福部中醫藥司、藥事法、臺灣中藥典、全民健保）。',
        en: 'Of six provisions, how many the WHO 2019 report’s chapter 5 summary states that each of 149 Member States has: a national policy, laws or regulations, a national office, regulation of herbal medicines, a pharmacopoeia covering herbal medicines and insurance coverage. All six: 11 countries (Ghana, Brazil, Iran, Türkiye, Bhutan, India, Thailand, China, Mongolia, South Korea and Viet Nam); five: 23; none: 18. The summaries are free text and many do not mention every item; “not stated” counts as 0, so a low score does not mean no provision: WHO’s regional tables count 98 countries with a national policy and 107 with a national office in 2018, against 67 and 77 stated in the summaries. The 45 Member States without a summary are not shaded. Hover for each item; the list on the left quotes the report with page numbers. Taiwan is not a WHO Member State and is filled in as 6 from its own rules (Chinese Medicine Development Act, the Department of Chinese Medicine and Pharmacy, the Pharmaceutical Affairs Act, the Taiwan Herbal Pharmacopeia and National Health Insurance).',
      },
      unit: { zh: '項', en: 'of 6' },
      file: 'score.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 3, 4, 5, 6] } },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 項`, en: `${fixed(v, 0)} of 6` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'items',
      label: { zh: '各項制度', en: 'Each provision' },
      description: {
        zh: '選一項制度，看 WHO 2019 年報告的國家段落怎麼寫：有、正在訂、沒有、報告沒寫明。寫明「有」的國數：國家級政策 67、法律或法規 56、國家級主管機關 77、國家級研究機構 40、草藥納入藥品管理 108、草藥要註冊 100、用收了草藥的藥典 87、草藥的製造規範 91、上市後監視包含草藥 24、基本藥物清單收草藥 26、從業人員受法規管 77、正式的傳統醫學教育 62。每一區抽到「有」的國數都不超過 WHO 區域表的國數（區域表還算了沒有段落的國家），保險給付、從業人員法規、基本藥物清單也不超過報告的全球數（45、78、34）。「有」是有沒有這個制度，不是管得嚴不嚴；「辦公室」可以只是衛生部的一個科；藥典含用別國的（西非用 WAHO 的西非藥典）。美國、加拿大的從業人員是州省在管。「要不要執照」對不上報告的全球數（抽到 75 國、報告 70 國，抽取時把「要登記」也算進去），所以沒有放。',
        en: 'Pick a provision to see how the WHO 2019 report’s country summaries describe it: yes, in preparation, no or not stated. Countries stated as “yes”: national policy 67, laws or regulations 56, national office 77, national research institute 40, herbal medicines regulated 108, herbal medicines registered 100, pharmacopoeia with herbal medicines 87, manufacturing requirements 91, post-market surveillance of herbal medicines 24, herbal medicines on the essential medicines list 26, providers regulated 77 and formal education 62. In every region the “yes” count does not exceed WHO’s regional table (which also counts countries without a summary), and insurance, provider regulation and the essential medicines list do not exceed the report’s global figures (45, 78 and 34). “Yes” means the provision exists, not how strict it is; an “office” can be one section of a health ministry, and pharmacopoeias include other countries’ (West Africa uses the WAHO West African Pharmacopoeia). Providers in the United States and Canada are regulated by states and provinces. Licensing is left out because it does not reconcile with the report’s global figure (75 extracted against 70, as the extraction also counted registration).',
      },
      unit: '',
      file: 'items/{item}.json',
      dimension: {
        label: { zh: '制度', en: 'Provision' },
        options: ITEMS.map(({ id, label }) => ({ id, label })),
        defaultOption: 'policy',
      },
      layer: { kind: 'categorical', categories: STATUS, ordinal: true },
      timeless: true,
      unranked: true,
      format: catLabel(STATUS),
    },
    {
      id: 'insurance',
      label: { zh: '保險給付傳統醫學', en: 'Insurance coverage' },
      description: {
        zh: 'WHO 2019 年報告的國家段落寫明保險有給付某些傳統或輔助醫學的 44 國（報告的全球數 2018 年 45 國）：公營保險有給付（或公私都有）29 國、只有私人保險 10 國、沒寫是誰 5 國；寫明不給付的 19 國。公營、私人保險都算，多半只給付一部分項目（例如針灸、某些草藥），不等於國家全額給付。百慕達、開曼群島是英國海外領地（不是會員國）。台灣不在 WHO 報告裡：全民健康保險給付中醫門診。',
        en: 'Country summaries in the WHO 2019 report state that insurance covers some traditional or complementary medicine in 44 countries (the report’s global figure for 2018 is 45): public insurance (or both public and private) in 29, private insurance only in 10 and an unstated insurer in 5; 19 are stated as not covered. Public and private insurance both count and coverage is usually partial (acupuncture, some herbal medicines), not full public coverage. Bermuda and the Cayman Islands are UK Overseas Territories, not Member States. Taiwan is not in the WHO report: its National Health Insurance covers Chinese medicine outpatient care.',
      },
      unit: '',
      file: 'insurance.json',
      layer: { kind: 'categorical', categories: INSURANCE },
      timeless: true,
      unranked: true,
      format: catLabel(INSURANCE),
    },
    {
      id: 'systems',
      label: { zh: '報告點名了哪些體系', en: 'Systems named in the report' },
      description: {
        zh: '各國的段落點名了哪些醫學體系（在原文裡找名稱，是 WHO 報告的用詞，不是那一國有沒有）。分成古典亞洲體系（中醫、針灸、阿育吠陀、尤納尼、悉達、漢方、韓醫、高麗醫學、藏醫、泰國傳統醫學）與歐美的替代療法（順勢療法、自然療法、整脊、整骨、人智醫學）：兩類都點名的 81 國、只有古典亞洲體系 16 國、只有歐美替代療法 11 國、都沒有點名的 41 國（只寫到傳統醫學、草藥或原住民傳統醫學）。點名的國數：針灸 88、順勢療法 74、整脊 72、中醫 69、整骨 61、自然療法 57、阿育吠陀 55、尤納尼 34；漢方只有日本、藏醫（Sowa Rigpa）只有蒙古。點名只表示報告寫到，不表示受到承認、管理或推薦。',
        en: 'Which medical systems each country summary names (a search for their names in the text: this is the WHO report’s wording, not whether they exist in the country). Classical Asian systems (Chinese medicine, acupuncture, Ayurveda, Unani, Siddha, Kampo, Korean medicine, Koryo medicine, Sowa Rigpa, Thai traditional medicine) are separated from Western alternative therapies (homeopathy, naturopathy, chiropractic, osteopathy, anthroposophic medicine): both are named for 81 countries, Asian systems only for 16, Western therapies only for 11 and neither for 41 (only traditional, herbal or indigenous medicine). Countries naming each: acupuncture 88, homeopathy 74, chiropractic 72, Chinese medicine 69, osteopathy 61, naturopathy 57, Ayurveda 55 and Unani 34; Kampo only Japan and Sowa Rigpa only Mongolia. Being named only means the report mentions it, not that it is recognized, regulated or recommended.',
      },
      unit: '',
      file: 'systems.json',
      layer: { kind: 'categorical', categories: SYSTEMS },
      timeless: true,
      unranked: true,
      format: catLabel(SYSTEMS),
    },
    {
      id: 'chinese-medicine',
      label: { zh: '報告有沒有寫到中醫', en: 'Chinese medicine in the report' },
      description: {
        zh: 'WHO 2019 年報告的國家段落寫到「Chinese medicine」（多半是 traditional Chinese medicine）的 69 國，含中國、日本、新加坡、馬來西亞、澳洲、紐西蘭、英國、德國、瑞士、加拿大、巴西、南非。南韓與北韓的段落寫的是韓醫（Korean medicine）與高麗醫學，沒有 Chinese medicine；越南、印度也沒有寫到。這是報告的用詞，不是「哪些國家有中醫」。其他層次量的是不同的東西：2012 年承認人民使用中醫的 100 國（2019 年報告），2023 年正式醫療服務提供中醫的 38 國（2024 年報告 Fig. D.1）。台灣不在 WHO 報告裡，依台灣的法規補上（中醫藥發展法、醫師法的中醫師、全民健保給付中醫）。',
        en: 'Country summaries in the WHO 2019 report mention “Chinese medicine” (mostly traditional Chinese medicine) for 69 countries, including China, Japan, Singapore, Malaysia, Australia, New Zealand, the United Kingdom, Germany, Switzerland, Canada, Brazil and South Africa. The summaries for South and North Korea use Korean medicine and Koryo medicine instead; those for Viet Nam and India do not mention it. This is the report’s wording, not a list of countries with Chinese medicine. Other measures count different things: 100 countries acknowledged use of Chinese medicine in 2012 (2019 report) and 38 provided it in formal health services in 2023 (2024 report, Fig. D.1). Taiwan is not in the WHO report and is filled in from its own rules (Chinese Medicine Development Act, licensed Chinese medicine physicians and National Health Insurance coverage).',
      },
      unit: '',
      file: 'chinese-medicine.json',
      layer: { kind: 'categorical', categories: CHINESE },
      timeless: true,
      unranked: true,
      format: catLabel(CHINESE),
    },
    {
      id: 'delivery-plan',
      label: { zh: '國家醫療服務輸送計畫納入傳統醫學', en: 'Plan to integrate into health service delivery' },
      description: {
        zh: '2016–18 年的更新調查問各國有沒有把傳統醫學納入國家醫療服務輸送的國家計畫，61 個回答的會員國裡 13 國回答有：貝南、玻利維亞、巴西、古巴、北韓、迦納、瓜地馬拉、海地、印度、馬利、墨西哥、尼加拉瓜、泰國（WHO 2019 年報告 §1.8）。分母是回答的 61 國，不是 194 國：其他國家多半是沒有回答這一題，不是沒有計畫，所以只畫回答有的 13 國。',
        en: 'The 2016–18 update survey asked whether countries had a national plan for integrating traditional medicine into health service delivery; of the 61 Member States that answered, 13 said yes: Benin, Bolivia, Brazil, Cuba, North Korea, Ghana, Guatemala, Haiti, India, Mali, Mexico, Nicaragua and Thailand (WHO 2019 report, section 1.8). The base is the 61 respondents, not 194: most other countries did not answer the question, which does not mean they have no plan, so only the 13 are shown.',
      },
      unit: '',
      file: 'delivery-plan.json',
      layer: { kind: 'categorical', categories: PLAN },
      timeless: true,
      unranked: true,
      format: catLabel(PLAN),
    },
    {
      id: 'reports',
      label: { zh: '向 WHO 回報過幾次', en: 'Times reported to WHO' },
      description: { zh: 'WHO 做過四次傳統醫學的全球調查（2001、2012、2016–18 年的更新調查、2023 年），194 個會員國各回報過幾次。四次的回報國數是 142、134、114、106 國；四次都回報的 45 國，3 次 63 國、2 次 49 國、1 次 29 國，至少回報過一次的 186 國。從沒回報過的只有 8 國：阿爾及利亞、南蘇丹、聖克里斯多福及尼維斯、委內瑞拉、希臘、盧森堡、摩納哥、土庫曼。這張圖量的是有沒有填 WHO 的問卷，不是有沒有傳統醫學的制度：希臘、盧森堡沒回報，不代表那裡沒有。', en: 'WHO has run four global surveys on traditional medicine (2001, 2012, an update in 2016–18 and 2023); this shows how many each of the 194 Member States answered. The surveys drew 142, 134, 114 and 106 responses; 45 countries answered all four, 63 three, 49 two and 29 one, so 186 answered at least once. Only 8 never answered: Algeria, South Sudan, Saint Kitts and Nevis, Venezuela, Greece, Luxembourg, Monaco and Turkmenistan. This measures whether a country filled in WHO’s questionnaire, not whether it has traditional medicine policies: Greece and Luxembourg not answering does not mean they have none.' },
      unit: { zh: '次', en: 'surveys' },
      file: 'reports.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 3, 4] } },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${v} 次`, en: `${v} of 4` }),
      formatTick: (v) => `${v}`,
    },
    {
      id: 'responded',
      label: { zh: '每一次調查有沒有回報', en: 'Responded to each survey' },
      description: { zh: '拖時間軸看每一次調查哪些國家有回報：2001 年 142 國、2012 年 134 國、2016–18 年的更新調查 114 國（畫在 2018 年）、2023 年 106 國。2024 年報告說第二次調查另外用了 WHO 的全球與區域報告等資料補充，方法不同，所以有些項目看起來往下。', en: 'Drag the timeline to see which countries answered each survey: 142 in 2001, 134 in 2012, 114 in the 2016–18 update (shown at 2018) and 106 in 2023. The 2024 report notes that the second survey was supplemented with other sources such as WHO global and regional reports, so methodological differences make some items appear to fall.' },
      unit: '',
      file: 'responded.json',
      layer: { kind: 'categorical', categories: RESPONDED },
      unranked: true,
      format: (v) => tr(RESPONDED.find((c) => c.value === v)?.label ?? { zh: '', en: '' }),
    },
  ],
};
