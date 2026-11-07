import { tr } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { PointsOverlayDef, TopicDefinition } from './types';

/**
 * 全世界的研究機構在哪裡（新主題，2026-11-07，製作手冊第二十七批 597，候選 1321；科技・研發與創新）：
 * ROR 研究機構註冊表的 Zenodo 傾印，pipeline/topics/research_orgs.py。座標是城市中心，所以依城市群聚成點；
 * 側欄 panels/ResearchOrgsPanel.tsx 是類型的組成與機構最多的城市。候選 1324（re3data 的資料典藏庫）等本機 session 的檔。
 */
export const ORG_TYPES = [
  { id: 'education', label: { zh: '大學與學校', en: 'Education' } },
  { id: 'company', label: { zh: '企業', en: 'Companies' } },
  { id: 'healthcare', label: { zh: '醫療機構', en: 'Healthcare' } },
  { id: 'nonprofit', label: { zh: '非營利組織', en: 'Nonprofits' } },
  { id: 'facility', label: { zh: '研究設施', en: 'Research facilities' } },
  { id: 'government', label: { zh: '政府機關', en: 'Government' } },
  { id: 'funder', label: { zh: '只做資助的機構', en: 'Funders only' } },
  { id: 'other', label: { zh: '其他（含檔案館）', en: 'Other (incl. archives)' } },
] as const;

const count = (v: number) => tr({ zh: `${fixed(v, 0)} 個`, en: fixed(v, 0) });
const NOTE = {
  zh: 'ROR 是社群維護的註冊表，收多少取決於有沒有人登錄：日本 13,121 個比中國 7,830 個多是登錄的差別，不是研究實力。',
  en: 'ROR is a community-maintained registry, so coverage depends on who has registered: Japan’s 13,121 against China’s 7,830 reflects registration, not research strength.',
};

const CITIES: PointsOverlayDef = {
  kind: 'points',
  id: 'research-org-cities',
  file: 'cities.json',
  label: { zh: '研究機構所在的城市（ROR）', en: 'Cities with research organisations (ROR)' },
  indicators: ['research-orgs', 'research-orgs-per-million'],
  radius: { field: 'n', stops: [[1, 1.6], [10, 3], [100, 6], [1000, 11], [4000, 16]] },
  sortField: 'n',
  minValue: { field: 'n', stops: [[0, 20], [4, 5], [6, 1]] },
  color: {
    field: 't',
    title: { zh: '最多的類型', en: 'Most common type' },
    thresholds: ORG_TYPES.slice(1).map((_, i) => i + 1.5),
    classes: ORG_TYPES.map((t, i) => ({ label: t.label, color: t.id === 'other' ? MAP_TOKENS.categoricalOther : MAP_TOKENS.categorical[i] })),
  },
  tooltip: (p, { countryName }) => ({
    title: String(p.city ?? ''),
    properNoun: String(p.city ?? ''),
    detail: [
      tr({ zh: `${fixed(Number(p.n), 0)} 個研究機構`, en: `${fixed(Number(p.n), 0)} research organisations` }),
      tr({ zh: `大學與學校 ${fixed(Number(p.e ?? 0), 0)}、企業 ${fixed(Number(p.co ?? 0), 0)}`, en: `education ${fixed(Number(p.e ?? 0), 0)}, companies ${fixed(Number(p.co ?? 0), 0)}` }),
      typeof p.iso3 === 'string' ? countryName(p.iso3) : null,
    ]
      .filter(Boolean)
      .join(' · '),
  }),
};

export const researchOrgs: TopicDefinition = {
  id: 'research-orgs',
  title: { zh: '全世界的研究機構在哪裡', en: 'Where the world’s research organisations are' },
  shortTitle: { zh: '研究機構', en: 'Research organisations' },
  defaultIndicator: 'research-orgs',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'ROR（Research Organization Registry）v2.15，2026-10-20 的資料傾印（Zenodo）', en: 'ROR (Research Organization Registry) v2.15 data dump, 20 Oct 2026 (Zenodo)' },
      url: 'https://doi.org/10.5281/zenodo.23500708',
      license: 'CC0',
    },
    {
      name: { zh: '聯合國《世界人口展望》（人口）', en: 'UN World Population Prospects (population)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  note: {
    zh: 'ROR 是學術出版與研究資料用的機構識別碼，收了論文、資料集、經費會出現的組織：大學、研究所、醫院、企業、政府機關、非營利組織、資助機構等。這裡只收運作中的 143,297 個（停用與撤銷的不收）。一個機構可以有好幾個類型，取第一個不是「資助」的當主要類型；「企業」是出現在論文掛名裡的公司，不是所有公司。座標是 GeoNames 的城市中心，所以地圖上依城市併成一點，大小是機構數、顏色是最多的類型。',
    en: 'ROR provides identifiers for organisations that appear in scholarly publications, datasets and grants: universities, institutes, hospitals, companies, government bodies, nonprofits and funders. Only the 143,297 active records are used (inactive and withdrawn ones are excluded). An organisation can have several types; the first one that is not “funder” is used as its main type, and “companies” are firms that appear in paper affiliations, not all companies. Coordinates are GeoNames city centres, so organisations are grouped by city on the map, sized by count and coloured by the most common type.',
  },
  overlays: [CITIES],
  panelExtra: () => import('./panels/ResearchOrgsPanel'),
  indicators: [
    {
      id: 'research-orgs',
      label: { zh: '研究機構的數量', en: 'Research organisations' },
      description: {
        zh: `ROR 登錄的運作中研究組織，依所在國。美國 35,119 個最多，日本 13,121、英國 8,159、中國 7,830、法國 6,090、德國 5,877、加拿大 4,556、印度 4,527、捷克 2,856、印尼 2,516；台灣 533 個（台北 250、新竹 48、台中 42、高雄 40、台南 38）。最多機構的城市是東京 4,021 個、倫敦 2,283、紐約 1,540、巴黎 1,519、華盛頓 1,463、北京 1,139。${NOTE.zh}點國家看類型的組成。`,
        en: `Active research organisations registered in ROR, by country. The US has the most at 35,119, followed by Japan 13,121, the UK 8,159, China 7,830, France 6,090, Germany 5,877, Canada 4,556, India 4,527, Czechia 2,856 and Indonesia 2,516; Taiwan has 533 (Taipei 250, Hsinchu 48, Taichung 42, Kaohsiung 40, Tainan 38). The cities with the most are Tokyo 4,021, London 2,283, New York 1,540, Paris 1,519, Washington 1,463 and Beijing 1,139. ${NOTE.en} Click a country for its mix of types.`,
      },
      unit: { zh: '個', en: 'organisations' },
      file: 'orgs.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: count,
      formatTick: formatLargeTick,
      integer: true,
      timeless: true,
    },
    {
      id: 'research-orgs-per-million',
      label: { zh: '每百萬人的研究機構', en: 'Research organisations per million people' },
      description: {
        zh: `每百萬人有幾個 ROR 登錄的研究組織（人口不到 10 萬的不算）。挪威 351 個最多，捷克 271、葡萄牙 230、瑞士 223、斯洛維尼亞 198、冰島 164、瑞典 162、盧森堡 159、芬蘭 157；台灣 23。${NOTE.zh}`,
        en: `ROR-registered research organisations per million people (places under 100,000 people are excluded). Norway leads with 351, followed by Czechia 271, Portugal 230, Switzerland 223, Slovenia 198, Iceland 164, Sweden 162, Luxembourg 159 and Finland 157; Taiwan has 23. ${NOTE.en}`,
      },
      unit: { zh: '個／百萬人', en: 'per million people' },
      file: 'orgs-per-million.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 15, 30, 60, 100, 200] } },
      format: (v) => tr({ zh: `每百萬人 ${fixed(v, 0)} 個`, en: `${fixed(v, 0)} per million` }),
      formatTick: (v) => fixed(v, 0),
      timeless: true,
    },
  ],
};
