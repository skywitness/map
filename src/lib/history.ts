/**
 * 改寫網址（pushState／replaceState），失敗時回傳 false，不丟出去。
 * Safari（iOS 也是）與 Firefox 限制兩者合計 10 秒內最多 100 次（Safari 有的版本是 30 秒），超過會丟 SecurityError，
 * 而且之後一陣子的呼叫都會失敗；在 React 的 effect 裡丟出來會讓整個畫面被拆掉。Chrome 超過時只是不做，不會丟錯。
 */
export function setHistoryUrl(url: string, push: boolean): boolean {
  try {
    if (push) window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
    return true;
  } catch {
    return false;
  }
}
