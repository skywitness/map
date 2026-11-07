import { fixed } from '../lib/format';
import type { ScaleSpec, TopicDefinition } from './types';

/**
 * 資料能不能出國：數位貿易的壁壘（新主題，2026-11-07，製作手冊第二十七批 586，候選 1306；科技・網路與連線）：
 * OECD Digital Services Trade Restrictiveness Index，pipeline/topics/digital_trade.py；側欄 panels/DigitalTradePanel.tsx 是五個支柱。
 */
const ALL: ScaleSpec = { type: 'sequential', thresholds: [0.05, 0.1, 0.2, 0.3, 0.4, 0.5] };
const PILLAR: ScaleSpec = { type: 'sequential', thresholds: [0.01, 0.02, 0.04, 0.06, 0.08, 0.1] };

export const digitalTrade: TopicDefinition = {
  id: 'digital-trade',
  title: { zh: '資料能不能出國：數位貿易的壁壘', en: 'Digital trade barriers' },
  shortTitle: { zh: '數位貿易壁壘', en: 'Digital trade' },
  defaultIndicator: 'dstri',
  defaultYear: 2025,
  sources: [
    {
      name: { zh: 'OECD：Digital Services Trade Restrictiveness Index（DF_STRI_DIGITAL）', en: 'OECD: Digital Services Trade Restrictiveness Index (DF_STRI_DIGITAL)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_STRI%40DF_STRI_DIGITAL&df[ag]=OECD.TAD.TPD',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: 'OECD 的數位服務貿易限制指數逐條讀各國的法規，把影響「透過網路提供服務」的限制加權成 0（完全開放）到 1（完全封閉），越高越封閉。分成五個支柱：基礎設施與連線（網路互連、資料要不要留在境內、跨境傳輸）、電子交易（電子簽章、網路交易的法律）、支付系統、智慧財產權、其他障礙。有些項目是「沒有相關法律」也算限制（例如沒有承認電子簽章的法律），所以法規還不完整的國家分數會偏高，不一定是管得嚴。只評了 129 個經濟體，台灣不在裡面。',
    en: 'The OECD Digital Services Trade Restrictiveness Index reads each country’s regulations and weights the restrictions on services delivered over the internet into a score from 0 (fully open) to 1 (fully closed); higher means more closed. It has five pillars: infrastructure and connectivity (interconnection, data localisation, cross-border data flows), electronic transactions (e-signature and online contract law), payment systems, intellectual property and other barriers. Some items count the absence of a law as a restriction (no legal recognition of e-signatures, for example), so countries whose regulations are still incomplete score higher without necessarily being strict. Only 129 economies are scored; Taiwan is not among them.',
  },
  panelExtra: () => import('./panels/DigitalTradePanel'),
  indicators: [
    {
      id: 'dstri',
      label: { zh: '的數位貿易限制', en: 'Digital trade restrictiveness' },
      description: {
        zh: '數位服務貿易限制指數（OECD，0–1，越高越封閉），2014 年起。2025 年索馬利亞 0.649、哈薩克 0.607、寮國 0.559、突尼西亞 0.528、坦尚尼亞 0.527 最高；俄羅斯 0.468、印尼 0.290、中國 0.286、印度 0.283、越南 0.225、新加坡 0.181；法國 0.105、德國與南韓 0.083、美國 0.061、日本 0.042；英國、挪威、瑞士、澳洲、哥斯大黎加都是 0.021 最低。子項目看五個支柱：中國的分數大多在「基礎設施與連線」（0.159；這個支柱包含資料在地化與跨境傳輸的規定），印度在「支付系統」比別國高（0.055）。點國家看五個支柱怎麼組成。',
        en: 'Digital Services Trade Restrictiveness Index (OECD, 0–1, higher is more closed), from 2014. In 2025 Somalia (0.649), Kazakhstan (0.607), Laos (0.559), Tunisia (0.528) and Tanzania (0.527) scored highest; Russia 0.468, Indonesia 0.290, China 0.286, India 0.283, Vietnam 0.225 and Singapore 0.181; France 0.105, Germany and South Korea 0.083, the US 0.061 and Japan 0.042; the UK, Norway, Switzerland, Australia and Costa Rica are lowest at 0.021. Sub-items show the five pillars: most of China’s score is in infrastructure and connectivity (0.159; this pillar covers data localisation and cross-border transfer rules), and India scores higher than most on payment systems (0.055). Click a country to see how the pillars add up.',
      },
      unit: { zh: '指數', en: 'index' },
      file: 'dstri/{item}.json',
      dimension: {
        label: { zh: '支柱', en: 'Pillar' },
        options: [
          { id: 'all', label: { zh: '整體', en: 'Overall' } },
          { id: 'infrastructure', label: { zh: '基礎設施與連線', en: 'Infrastructure and connectivity' } },
          { id: 'transactions', label: { zh: '電子交易', en: 'Electronic transactions' } },
          { id: 'payments', label: { zh: '支付系統', en: 'Payment systems' } },
          { id: 'ip', label: { zh: '智慧財產權', en: 'Intellectual property' } },
          { id: 'other', label: { zh: '其他障礙', en: 'Other barriers' } },
        ],
        defaultOption: 'all',
      },
      layer: {
        kind: 'choropleth',
        scale: ALL,
        itemScales: { all: ALL, infrastructure: { type: 'sequential', thresholds: [0.02, 0.05, 0.1, 0.15, 0.2, 0.3] }, transactions: PILLAR, payments: PILLAR, ip: PILLAR, other: PILLAR },
      },
      format: (v) => fixed(v, 3),
      formatTick: (v) => fixed(v, 2),
      lowerIsBetter: true,
    },
  ],
};
