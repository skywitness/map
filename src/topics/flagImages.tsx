/**
 * 國旗主題的國旗檔（pipeline/topics/flags.py 的 flags.json）與國旗圖片元件：
 * 國旗主題的側欄、排名表的小國旗、國家小檔案最上面的國旗都用這裡。放在首頁的 bundle（排名表用到），所以要小。
 */
import { dataUrl, useJson } from '../lib/data';

export const FLAGS_FILE = 'topics/flags/flags.json';

/** flags.json 裡一個地區的國旗；鍵很短是為了檔案小 */
export interface FlagEntry {
  /** 圖檔，相對於 data/topics/flags/（svg/<地區>-<雜湊>.svg，內容一樣的共用） */
  f: string;
  /** 長寬比（高:寬），例如 2:3、10:19；尼泊爾是外框的比例 */
  r: string;
  /** 顏色組成：[類別, 占面積的 %]，由大到小 */
  c: [string, number][];
  /** 圖案（FEATURES 的鍵） */
  ft: string[];
  /** 這一版開始使用的年份；d 是完整的日期（Wikidata 有的話） */
  y: number;
  d?: string;
  /** 正式名稱不是「<國名>國旗」的（中華民國國旗、香港特別行政區區旗），[中文, 英文] */
  name?: [string, string];
  /** 通稱（青天白日滿地紅旗、星條旗） */
  nick?: [string, string];
  /** 旗幟家族（FAMILIES 的代碼） */
  fam?: number;
  /** 地圖上國旗的重點（0–1）：國土比國旗瘦長要裁切時盡量留住這一點；沒寫是正中央 */
  fx?: number;
  fy?: number;
  /** 屬地：主權國與畫的是不是自己的旗（0 是主權國的國旗） */
  sov?: string;
  own?: 0 | 1;
  /** 側欄的說明 [中文, 英文]：屬地、爭議地區用哪一面旗、比例特別的 */
  note?: [string, string];
  /** 採用年份的理由 [中文, 英文] */
  yn?: [string, string];
  /** 圖檔的出處：Commons 的檔名、頁面、授權，ins 是 Commons 標了 insignia（國家象徵） */
  src: { file: string; page: string; lic: string; ins: 0 | 1 };
}

export interface FlagsFile {
  /** Wikidata 的查詢日期 */
  date: string;
  units: Record<string, FlagEntry>;
}

export function flagUrl(entry: FlagEntry): string {
  return dataUrl(`topics/flags/${entry.f}`);
}

/** 寬 ÷ 高（長寬比寫成「高:寬」） */
export function flagAspect(entry: FlagEntry): number {
  const [h, w] = entry.r.split(':').map(Number);
  return w / h;
}

export function useFlags(enabled = true): FlagsFile | null {
  return useJson<FlagsFile>(enabled ? FLAGS_FILE : null).data;
}

/** 排名表國名前面的小國旗（TopicDefinition.rowIcon） */
export function FlagIcon({ iso3 }: { iso3: string }) {
  const entry = useFlags()?.units[iso3];
  if (!entry) return <span className="flag-icon is-empty" aria-hidden="true" />;
  return <img className="flag-icon" src={flagUrl(entry)} alt="" loading="lazy" decoding="async" />;
}

/**
 * 側欄、國家小檔案的國旗：依原本的長寬比，高 height px（太寬的縮到容器的寬度），有細邊框（白色的部分才看得出邊）
 */
export function FlagImage({ entry, alt, height, className }: { entry: FlagEntry; alt: string; height: number; className?: string }) {
  const aspect = flagAspect(entry);
  return (
    <img
      className={`flag-image${className ? ` ${className}` : ''}`}
      src={flagUrl(entry)}
      alt={alt}
      decoding="async"
      style={{ aspectRatio: String(aspect), width: `min(100%, ${Math.round(height * aspect)}px)` }}
    />
  );
}
