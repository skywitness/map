/**
 * 點圖層縮小時聚成圓環的偏好（2026-11-13，使用者要求「縮小後用圓環顯示比例的主題可以取消用圓環來顯示」）：
 * 圖層圖例裡的「縮小時聚成圓環」（map/Overlays.tsx 的 LayerControls）。存在這台裝置（localStorage），所有主題共用，
 * 不寫進網址；存不了（無痕模式等）時這次照樣生效
 */
const KEY = 'clusters';

export function readClusterPref(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveClusterPref(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // 存不了：這次照樣生效
  }
}
