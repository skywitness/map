/**
 * 讀 zip 裡的第一個檔（2026-10-29 起，此刻世界的新聞熱點：GDELT 每 15 分鐘一個 export.CSV.zip）。
 * 用瀏覽器內建的 DecompressionStream('deflate-raw') 解壓，不加套件；只支援不壓縮（0）與 deflate（8），
 * 不支援加密、分割、ZIP64。從檔尾的中央目錄找第一個檔的位置與大小（本地檔頭可能把大小放在資料後面的描述區）。
 */

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

export async function unzipFirst(buffer: ArrayBuffer): Promise<{ name: string; text: string }> {
  const view = new DataView(buffer);
  // 中央目錄結尾（EOCD）在檔尾 22 bytes 起往前找（後面可能有註解，最多 65,535 bytes）
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 22 - 65_535); i--) {
    if (view.getUint32(i, true) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip file');
  const central = view.getUint32(eocd + 16, true);
  if (view.getUint32(central, true) !== CENTRAL) throw new Error('zip central directory not found');
  const method = view.getUint16(central + 10, true);
  const compressed = view.getUint32(central + 20, true);
  const nameLength = view.getUint16(central + 28, true);
  const local = view.getUint32(central + 42, true);
  const name = new TextDecoder().decode(new Uint8Array(buffer, central + 46, nameLength));
  if (view.getUint32(local, true) !== LOCAL) throw new Error('zip local header not found');
  const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
  const data = new Uint8Array(buffer, start, compressed);
  if (method === 0) return { name, text: new TextDecoder().decode(data) };
  if (method !== 8) throw new Error(`zip compression method ${method} not supported`);
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return { name, text: await new Response(stream).text() };
}
