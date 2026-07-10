export type ColorMode = "continent" | "speed" | "exposure";

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
  selected: -1,
  loaded: false,
  aboutOpen: false,
});
