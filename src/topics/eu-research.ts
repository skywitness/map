import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 歐盟研究計畫的錢流向哪裡（新主題，2026-11-08，製作手冊第二十七批 598，候選 1322；科技・研發與創新）：
 * CORDIS 的 Horizon Europe（2021–2027）計畫與參與機構，pipeline/topics/eu_research.py。時間軸是計畫的簽約年，值是累計。
 * 使用者用瀏覽器下載 CORDIS 的 zip（cordis.europa.eu 的 robots.txt 不准程式抓 /data/），放在 map-plan 的 data/cordis/。
 */

/** CORDIS 的機構類型（activityType）：1 高等教育 HES、2 企業 PRC、3 研究機構 REC、4 公部門 PUB、5 其他 OTH */
const TYPES = [
  { label: { zh: '高等教育', en: 'Higher education' } },
  { label: { zh: '企業', en: 'Companies' } },
  { label: { zh: '研究機構', en: 'Research organisations' } },
  { label: { zh: '公部門', en: 'Public bodies' } },
  { label: { zh: '其他', en: 'Other' } },
];
const typeLabel = (t: unknown) => tr(TYPES[(typeof t === 'number' ? t : 5) - 1]?.label ?? TYPES[4].label);

const euros = (v: number) => tr({ zh: `${formatLargeNumber(v)} 歐元`, en: `€${formatLargeNumber(v)}` });
const millions = (v: number) => tr({ zh: `${fixed(v, 1)} 百萬歐元`, en: `€${fixed(v, 1)} million` });
const ELIGIBILITY = {
  zh: '歐盟的錢只給歐盟國與聯繫國（挪威、以色列、土耳其、烏克蘭等，英國 2024 年、瑞士 2025 年起重新聯繫），其他國家的機構多半以「聯繫夥伴」參與、不拿歐盟的錢，所以這是「歐盟的研究經費給了誰」，不是各國的研究實力。',
  en: 'EU money goes only to member states and associated countries (Norway, Israel, Türkiye, Ukraine and others; the UK re-associated in 2024 and Switzerland in 2025); organisations elsewhere mostly join as associated partners without EU funding, so this shows who receives EU research money, not national research strength.',
};

function orgTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const name = String(p.name ?? '');
  return {
    title: name,
    properNoun: name,
    detail: [typeLabel(p.t), typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null].filter(Boolean).join(' · '),
    extra: [
      tr({ zh: `歐盟撥款 ${millions(Number(p.f))}`, en: `EU funding ${millions(Number(p.f))}` }),
      tr({ zh: `${fixed(Number(p.n), 0)} 筆參與、主持 ${fixed(Number(p.c), 0)} 個計畫`, en: `${fixed(Number(p.n), 0)} participations, ${fixed(Number(p.c), 0)} projects coordinated` }),
    ],
  };
}

const ORGS: PointsOverlayDef = {
  kind: 'points',
  id: 'eu-research-orgs',
  file: 'orgs.json',
  label: { zh: '拿到 500 萬歐元以上的機構', en: 'Organisations receiving €5 million or more' },
  indicators: ['funding', 'participations', 'coordinated'],
  radius: { field: 'f', stops: [[5, 2], [50, 4], [200, 7], [1000, 12]] },
  sortField: 'f',
  // 世界全圖只畫 5,000 萬歐元以上的，放大再畫小的
  minValue: { field: 'f', stops: [[0, 50], [4, 20], [5, 0]] },
  color: {
    field: 't',
    title: { zh: '機構類型', en: 'Type' },
    thresholds: [1.5, 2.5, 3.5, 4.5],
    classes: TYPES.map((t, i) => ({ label: t.label, color: i === 4 ? MAP_TOKENS.categoricalOther : MAP_TOKENS.categorical[i] })),
  },
  tooltip: orgTooltip,
};

const ORG_LIST: ListPanelDef = {
  label: { zh: '拿最多歐盟研究經費的機構', en: 'Organisations with the most EU research funding' },
  tabLabel: { zh: '機構', en: 'Organisations' },
  indicators: ['funding', 'participations', 'coordinated'],
  file: 'orgs.json',
  countryField: 'iso3',
  // 選了國家時只列那一國（countryField；那一國沒有 500 萬歐元以上的機構時照樣列全部）
  rows: (points, { countryName }) =>
    points
      .slice()
      .sort((a, b) => Number(b.f) - Number(a.f))
      .slice(0, 100)
      .map(
        (p, i): ListRow => ({
          key: `${p.name}-${i}`,
          title: `${i + 1}. ${String(p.name ?? '')}`,
          titleProper: true,
          lines: [
            [typeLabel(p.t), typeof p.iso3 === 'string' ? countryName(p.iso3) : ''].filter(Boolean).join(' · '),
            tr({ zh: `${millions(Number(p.f))}、${fixed(Number(p.n), 0)} 筆參與`, en: `${millions(Number(p.f))}, ${fixed(Number(p.n), 0)} participations` }),
          ],
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 9 },
        }),
      ),
};

export const euResearch: TopicDefinition = {
  id: 'eu-research',
  title: { zh: '歐盟研究計畫的錢流向哪裡', en: 'Where EU research money goes' },
  shortTitle: { zh: '歐盟研究經費', en: 'EU research funding' },
  defaultIndicator: 'funding',
  defaultYear: 2026,
  focus: [-25, 34, 45, 71],
  sources: [
    {
      name: {
        zh: 'CORDIS：EU research projects under HORIZON EUROPE (2021-2027)（2026-10-15 版，使用者 2026-11-08 用瀏覽器下載）',
        en: 'CORDIS: EU research projects under HORIZON EUROPE (2021-2027) (15 Oct 2026 release, downloaded in a browser on 8 Nov 2026)',
      },
      url: 'https://data.europa.eu/data/datasets/cordis-eu-research-projects-under-horizon-europe-2021-2027',
      license: { zh: 'European Commission reuse notice（2011/833/EU，CC BY 4.0）', en: 'European Commission reuse notice (2011/833/EU, CC BY 4.0)' },
    },
    {
      name: { zh: '聯合國《世界人口展望》（人口）', en: 'UN World Population Prospects (population)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  note: {
    zh: `Horizon Europe 是歐盟 2021–2027 年的研究與創新計畫。這裡算每個參與機構實際拿到的歐盟撥款（netEcContribution），依機構所在國加總；時間軸是計畫的簽約年，值是累計到那一年（2026 年到 9 月 30 日）。${ELIGIBILITY.zh}`,
    en: `Horizon Europe is the EU’s research and innovation programme for 2021–2027. Figures sum the EU contribution each participating organisation actually receives (netEcContribution) by its country; the timeline is the year each grant was signed, cumulative (2026 runs to 30 September). ${ELIGIBILITY.en}`,
  },
  overlays: [ORGS],
  listPanel: ORG_LIST,
  indicators: [
    {
      id: 'funding',
      label: { zh: '拿到的歐盟研究經費', en: 'EU research funding received' },
      description: {
        zh: `Horizon Europe 計畫給各國機構的歐盟撥款，從 2021 年累計（比例圓）。2026 年 9 月底共 23,954 個計畫、640.1 億歐元：德國 100.3 億、法國 68.9 億、西班牙 66.0 億、義大利 51.9 億、荷蘭 51.6 億、比利時 44.7 億；歐盟以外英國 23.5 億、挪威 18.6 億、以色列 10.2 億、瑞士 6.8 億最多，美國 1.6 億、中國大陸 110 萬、台灣 46.6 萬（32 筆參與裡 28 筆是不拿錢的聯繫夥伴，拿錢的 4 筆是成大、臺大、中研院與國科會）。點是拿到 500 萬歐元以上的 1,604 個機構，法國國家科學研究中心 10.6 億最多。${ELIGIBILITY.zh}`,
        en: `EU funding to each country’s organisations under Horizon Europe, cumulative since 2021 (proportional circles). By the end of September 2026 there were 23,954 projects and €64.01 billion: Germany €10.03 billion, France €6.89 billion, Spain €6.60 billion, Italy €5.19 billion, the Netherlands €5.16 billion and Belgium €4.47 billion; outside the EU the UK (€2.35 billion), Norway (€1.86 billion), Israel (€1.02 billion) and Switzerland (€0.68 billion) received most, against €164 million for the US, €1.1 million for mainland China and €466,000 for Taiwan (28 of its 32 participations are unfunded associated partners; the 4 funded ones are NCKU, National Taiwan University, Academia Sinica and the National Science and Technology Council). Points are the 1,604 organisations receiving €5 million or more, led by France’s CNRS at €1.06 billion. ${ELIGIBILITY.en}`,
      },
      unit: { zh: '歐元', en: 'EUR' },
      file: 'funding.json',
      layer: { kind: 'bubble', legendValues: [1e7, 1e9, 1e10] },
      format: euros,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'funding-per-capita',
      label: { zh: '每人拿到的歐盟研究經費', en: 'EU research funding per person' },
      description: {
        zh: `Horizon Europe 的歐盟撥款除以人口（從 2021 年累計，人口不到 10 萬的不算）。盧森堡每人 427 歐元最多，比利時 379、挪威 329、芬蘭 312、賽普勒斯 300、丹麥 296、荷蘭 280、冰島 277；英國 34、瑞士 75、以色列 105；歐盟與聯繫國以外多半不到 1 歐元。${ELIGIBILITY.zh}`,
        en: `Horizon Europe EU funding divided by population (cumulative since 2021; places under 100,000 people are excluded). Luxembourg leads at €427 per person, followed by Belgium €379, Norway €329, Finland €312, Cyprus €300, Denmark €296, the Netherlands €280 and Iceland €277; the UK €34, Switzerland €75 and Israel €105; outside the EU and associated countries it is mostly under €1. ${ELIGIBILITY.en}`,
      },
      unit: { zh: '歐元／人', en: 'EUR per person' },
      file: 'funding-per-capita.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 10, 50, 100, 200, 300] } },
      format: (v) => tr({ zh: `每人 ${fixed(v, v < 10 ? 2 : 0)} 歐元`, en: `€${fixed(v, v < 10 ? 2 : 0)} per person` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'participations',
      label: { zh: '參與歐盟研究計畫的次數', en: 'Participations in EU research projects' },
      description: {
        zh: `各國機構參與 Horizon Europe 計畫的筆數（同一個機構參與幾個計畫算幾筆，含不拿錢的聯繫夥伴；從 2021 年累計，比例圓）。共 148,155 筆：德國 16,443、西班牙 16,139、義大利 13,871、法國 13,496、荷蘭 9,007、英國 8,056；美國 1,808、中國大陸 296、日本 244、韓國 152、台灣 32。${ELIGIBILITY.zh}`,
        en: `Participations by each country’s organisations in Horizon Europe projects (an organisation counts once per project, unfunded associated partners included; cumulative since 2021, proportional circles). 148,155 in all: Germany 16,443, Spain 16,139, Italy 13,871, France 13,496, the Netherlands 9,007, the UK 8,056; the US 1,808, mainland China 296, Japan 244, South Korea 152, Taiwan 32. ${ELIGIBILITY.en}`,
      },
      unit: { zh: '筆', en: 'participations' },
      file: 'participations.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 筆`, en: `${fixed(v, 0)} participations` }),
      formatTick: formatLargeTick,
      integer: true,
      shareOfWorld: true,
    },
    {
      id: 'coordinated',
      label: { zh: '主持的歐盟研究計畫', en: 'EU research projects coordinated' },
      description: {
        zh: `由這國的機構擔任主持（coordinator）的 Horizon Europe 計畫數（從 2021 年累計，比例圓）。主持的機構負責整個計畫、分配經費給夥伴。德國 3,108 個最多，西班牙 2,925、義大利 2,376、法國 2,351、荷蘭 1,845、英國 1,350；以色列 494、瑞士 313；美國、中國大陸、日本、韓國與台灣都是 0。${ELIGIBILITY.zh}`,
        en: `Horizon Europe projects coordinated by an organisation in this country (cumulative since 2021, proportional circles); the coordinator runs the project and passes funding to partners. Germany coordinates the most at 3,108, followed by Spain 2,925, Italy 2,376, France 2,351, the Netherlands 1,845 and the UK 1,350; Israel 494 and Switzerland 313; the US, mainland China, Japan, South Korea and Taiwan coordinate none. ${ELIGIBILITY.en}`,
      },
      unit: { zh: '個', en: 'projects' },
      file: 'coordinated.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 個計畫`, en: `${fixed(v, 0)} projects` }),
      formatTick: formatLargeTick,
      integer: true,
      shareOfWorld: true,
    },
  ],
};
