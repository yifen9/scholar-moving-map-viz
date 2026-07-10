export type ColorMode = "continent" | "speed" | "exposure";
export type Level = "institution" | "country";

export const ui = $state({
  t: 0,
  playing: true,
  playSpeed: 0.35,
  colorBy: "continent" as ColorMode,
  minExposureLog: 3,
  halo: true,
  haloScale: 1,
  singleRun: false,
  trails: false,
  view2d: true,
  pointScale: 1,
  linkK: 2,
  labels: true,
  autoRotate: false,
  level: "institution" as Level,
  datasetId: "",
  selected: -1,
  hovered: -1,
  hoverX: 0,
  hoverY: 0,
  loaded: false,
  aboutOpen: false,
});
