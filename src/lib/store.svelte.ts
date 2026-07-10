export type ColorMode = "continent" | "country" | "speed" | "exposure";
export type Level = "institution" | "country";

export const VISUAL_DEFAULTS = {
  playing: true,
  playSpeed: 0.35,
  colorBy: "country" as ColorMode,
  minExposureLog: 3,
  halo: true,
  haloScale: 1,
  singleRun: false,
  view2d: true,
  pointScale: 0.9,
  pointOpacity: 0.85,
  trail: 0.5,
  spread: 0.85,
  sizeContrast: 1.2,
  axisX: 0,
  axisY: 1,
  axisZ: 2,
  linkK: 2,
  linkOpacity: 0.05,
  linkMinSim: -1,
  linkMutual: false,
  labelCount: 30,
  moversOpen: false,
  dimOnSelect: true,
  autoRotate: true,
};

export const ui = $state({
  ...VISUAL_DEFAULTS,
  t: 0,
  level: "institution" as Level,
  datasetId: "",
  countryFilter: -1,
  selected: -1,
  hovered: -1,
  hoverX: 0,
  hoverY: 0,
  camLive: "",
  loaded: false,
  aboutOpen: false,
});

export function resetSettings(): void {
  Object.assign(ui, VISUAL_DEFAULTS);
  ui.countryFilter = -1;
}
