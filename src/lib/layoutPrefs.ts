import { useCallback, useState } from 'react';

/**
 * 版面的偏好（2026-10-30，頂列的「版面」選單 LayoutMenu.tsx）：時間軸、頁尾的資料來源與說明可以分別關掉，
 * 讓地圖大一點。存在這台裝置（localStorage），不寫進網址：分享出去的連結、嵌入的地圖照樣都有
 */
export interface LayoutPrefs {
  /** 時間軸（年份的拉桿、播放；時刻主題是日期與時間的控制） */
  time: boolean;
  /** 頁尾的資料來源、主題說明、免責聲明 */
  sources: boolean;
  /** 主題的清單側欄（TopicDefinition.listPanel，例如賽車的賽程）：桌機預設打開，窄螢幕另外預設收起來（ListSide.tsx） */
  list: boolean;
}

const KEY = 'layout';

function read(): LayoutPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<LayoutPrefs>;
    return { time: saved.time !== false, sources: saved.sources !== false, list: saved.list !== false };
  } catch {
    return { time: true, sources: true, list: true };
  }
}

export function useLayoutPrefs(): [LayoutPrefs, (patch: Partial<LayoutPrefs>) => void] {
  const [prefs, setPrefs] = useState(read);
  const update = useCallback((patch: Partial<LayoutPrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // 無痕模式等情況存不了：這次照樣生效
      }
      return next;
    });
  }, []);
  return [prefs, update];
}
