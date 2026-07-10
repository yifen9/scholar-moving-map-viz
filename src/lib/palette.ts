export const SURFACE = "#0d0d0d";
export const PANEL = "#1a1a19";
export const INK = "#ffffff";
export const INK_SECONDARY = "#c3c2b7";
export const INK_MUTED = "#898781";

export const CONTINENTS = [
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Africa",
  "Oceania",
  "Other",
] as const;

export const CONTINENT_COLORS: Record<string, string> = {
  Asia: "#3987e5",
  Europe: "#199e70",
  "North America": "#c98500",
  "South America": "#9085e9",
  Africa: "#e66767",
  Oceania: "#d55181",
  Other: "#706e64",
};

export const SPEED_RAMP = [
  "#104281",
  "#1c5cab",
  "#2a78d6",
  "#3987e5",
  "#6da7ec",
  "#9ec5f4",
  "#cde2fb",
];

export function rampColor(ramp: string[], t: number): [number, number, number] {
  const x = Math.min(Math.max(t, 0), 1) * (ramp.length - 1);
  const i = Math.min(Math.floor(x), ramp.length - 2);
  const f = x - i;
  const a = hex(ramp[i]);
  const b = hex(ramp[i + 1]);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export function hex(color: string): [number, number, number] {
  const v = parseInt(color.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}
