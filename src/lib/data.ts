import { continentOf } from "./continents";

export interface Dataset {
  n: number;
  windows: string[];
  neighbourCount: number;
  varianceExplained: number[];
  names: string[];
  countries: string[];
  countryIndex: Uint8Array;
  continentIndex: Uint8Array;
  positions: Float32Array;
  positionsSingle: Float32Array;
  reliability: Float32Array;
  rho: Float32Array;
  speed: Float32Array;
  exposure: Float32Array;
  neighbours: Uint16Array;
}

async function buffer(base: string, file: string): Promise<ArrayBuffer> {
  const response = await fetch(`${base}${file}`);
  if (!response.ok) throw new Error(`failed to load ${file}`);
  return response.arrayBuffer();
}

export async function loadDataset(base: string): Promise<Dataset> {
  const manifest = await (await fetch(`${base}manifest.json`)).json();
  const names: string[] = await (await fetch(`${base}names.json`)).json();
  const [pos, posSingle, rel, rho, speed, exposure, neighbours, ccIndex] = await Promise.all([
    buffer(base, "positions.bin"),
    buffer(base, "positions_single.bin"),
    buffer(base, "reliability.bin"),
    buffer(base, "rho.bin"),
    buffer(base, "speed.bin"),
    buffer(base, "exposure.bin"),
    buffer(base, "neighbours.bin"),
    buffer(base, "country_index.bin"),
  ]);
  const countryIndex = new Uint8Array(ccIndex);
  const countries: string[] = manifest.countries;
  const continentIndex = new Uint8Array(countryIndex.length);
  for (let i = 0; i < countryIndex.length; i++) {
    continentIndex[i] = continentOf(countries[countryIndex[i]]);
  }
  return {
    n: manifest.n,
    windows: manifest.windows,
    neighbourCount: manifest.neighbours,
    varianceExplained: manifest.variance_explained,
    names,
    countries,
    countryIndex,
    continentIndex,
    positions: new Float32Array(pos),
    positionsSingle: new Float32Array(posSingle),
    reliability: new Float32Array(rel),
    rho: new Float32Array(rho),
    speed: new Float32Array(speed),
    exposure: new Float32Array(exposure),
    neighbours: new Uint16Array(neighbours),
  };
}
