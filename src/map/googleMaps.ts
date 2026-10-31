/**
 * Google 地圖上的那個位置：Google Maps URLs 的 search（https://developers.google.com/maps/documentation/urls/get-started），
 * 不需要金鑰，在那一點釘一個標記；手機上會交給 Google 地圖 App
 */
export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)}%2C${lng.toFixed(6)}`;
}
