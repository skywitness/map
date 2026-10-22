/** 讓瀏覽器下載一個檔案 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  // 有些瀏覽器在下載開始後才讀取網址，晚一點再釋放
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** 檔名不能用的字元（Windows 最嚴格）換成底線 */
export function safeFilename(name: string): string {
  return name.replace(/[\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim();
}

/** 複製文字；不支援 Clipboard API 的環境（非 HTTPS、舊瀏覽器）改用暫時的文字框 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}
