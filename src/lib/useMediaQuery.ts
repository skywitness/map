import { useCallback, useSyncExternalStore } from 'react';

/** 手機版面：國家側欄改成底部抽屜、指標按鈕改成下拉選單（與 styles.css 的 @media (max-width: 768px) 一致） */
export const NARROW_QUERY = '(max-width: 768px)';
/** 寬螢幕：側欄浮在地圖上、時間軸與資料來源放進地圖下方（styles.css 的 .stage.is-map，跟那裡的 min-width: 901px 一樣） */
export const FLOAT_QUERY = '(min-width: 901px)';

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}
