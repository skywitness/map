/** 介面文字（英文）。鍵與參數跟 zh.ts 一一對應。 */
import { fixed } from '../lib/format';
import type { Messages } from './zh';

/** 英文標題中間接小寫：「Rice」＋「Production」→「Rice production」（GDP 這類縮寫不改） */
function lowerFirst(text: string): string {
  return /^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text;
}

export const en: Messages = {
  pageTitle: 'World Data Map',
  pageDescription: 'Explore population, economy, energy, industry and agriculture data for every country on a world map',
  brand: 'World Data Map',
  topicsNav: 'Topics',
  language: 'Language',
  switchToLight: 'Switch to light mode',
  switchToDark: 'Switch to dark mode',

  indicator: 'Indicator',
  basemap: 'Basemap',
  basemapStyle: 'Basemap style',
  searchCountry: 'Search countries',
  viewMode: 'View',
  viewMap: 'Map',
  viewTable: 'Ranking',
  loadFailed: (message) => `Failed to load data: ${message}`,
  loadingMap: 'Loading map…',
  loading: 'Loading…',
  noData: 'No data',
  projected: 'Projection',
  estimated: 'Estimate',
  world: 'World',
  close: 'Close',

  itemIndicator: (item, indicator) => `${item} ${lowerFirst(indicator)}`,
  year: (year) => String(year),
  worldMapAria: 'World map',
  mapAria: (year, title, projected) => `World map: ${title} by country, ${year}${projected ? ' (projection)' : ''}`,
  tooltipProjected: ' · projection',
  largeAirport: 'Large airport',
  mediumAirport: 'Medium airport',

  sources: 'Sources: ',
  listSeparator: '; ',
  sourceLicense: (license) => ` (${license})`,
  borders: ' · Borders: ',
  publicDomain: ' (public domain)',
  generatedAt: (date) => ` · Data generated on ${date}`,
  disclaimer: 'Borders and names are shown for data presentation only and do not imply any political position.',

  singleSnapshot: 'This dataset is a single snapshot with no time series',
  play: 'Play',
  playTitle: 'Play through the years',
  pause: 'Pause',
  yearSlider: 'Year',
  yearValue: (year, projected) => `${year}${projected ? ' (projection)' : ''}`,
  projectionFrom: (year) => `Projected from ${year}`,

  mapControls: 'Map controls',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  resetView: 'Back to the whole world',
  toFlat: 'Switch to flat map',
  toGlobe: 'Switch to globe',
  flatShort: 'Flat',
  globeShort: 'Globe',
  fullscreen: 'Full screen',
  exitFullscreen: 'Exit full screen',
  boxTool: 'Select an area',
  boxToolFor: (label) => `Select an area to estimate its ${label}`,
  boxToolActive: 'Drag on the map to draw a box (Esc to cancel)',
  boxHint: 'Drag on the map to draw an area (Esc to cancel)',
  basemapFailed: 'The basemap failed to load. Check your connection and reload the page.',
  unitSuffix: (unit) => ` (${unit})`,
  layers: 'Layers',
  railways: 'Railways',
  largeAirports: 'Large airports',
  mediumAirports: 'Medium airports (scheduled flights)',

  boxAria: (label) => `${label} in the selected area`,
  boxTitle: (label) => `Estimated ${label} in the area`,
  boxClear: 'Clear selection',
  boxEmpty: (label) => `No ${label} data in this area (ocean or uninhabited land)`,
  boxLand: (year, area) => `${year} · Land area ${area}`,
  boxDensity: (density, unit) => ` · ${density} ${unit} per km²`,
  boxUnassigned: 'Small islands without borders on the map',
  boxShare: (label, share) => `${share} of national ${label}`,
  boxShareTiny: 'under 0.1%',
  boxOthers: (n, allCountries) => `${n} other ${allCountries ? (n === 1 ? 'country' : 'countries') : n === 1 ? 'place' : 'places'}`,
  boxNote: (epoch, cellSize, label) =>
    `Estimated from the ${label} distribution of the GHS-POP ${epoch} grid (about 1 km, aggregated to ${cellSize}° cells), ` +
    `then scaled to each country's total ${label} for the selected year. The distribution within each country is fixed at ${epoch}, ` +
    `so the further the year is from ${epoch}, the less accurate the estimate.`,
  area: (km2) => `${fixed(km2, 0)} km²`,

  panelAria: (name) => `Data for ${name}`,
  rank: (rank, total) => `Rank ${rank} of ${total}`,
  shareOfWorld: (share) => ` · ${share} of world`,
  shownYear: (year) => ` (${year})`,
  overTime: (label) => `${label} over time`,
  lineChartAria: (name, label) => `Line chart of ${lowerFirst(label)} in ${name} over time`,
  singleSnapshotPanel: 'This dataset is a single snapshot with no time series.',
  noCountryData: 'No data for this country.',
  dashedProjection: (year) => `Dashed line: projections from ${year} onward.`,
  note: (note) => `Note: ${note}`,
  yearMissing: (year) => ` (no data for ${year}; showing the latest year)`,

  rankingCaption: (year, title, count) => `${title} by country, ${year} (${count} countries and territories)`,
  rankCol: 'Rank',
  countryCol: 'Country/territory',
  shareCol: 'Share of world',

  chartTotal: 'Total',
};
