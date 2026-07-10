import { continentOf } from "./continents";

export interface Dataset {
  n: number;
  windows: string[];
  stepYears: number;
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
  level: "institution" | "country";
}

export interface DatasetInfo {
  id: string;
  label: string;
}

async function buffer(base: string, file: string): Promise<ArrayBuffer> {
  const response = await fetch(`${base}${file}`);
  if (!response.ok) throw new Error(`failed to load ${file}`);
  return response.arrayBuffer();
}

export async function loadIndex(base: string): Promise<DatasetInfo[]> {
  const response = await fetch(`${base}index.json`);
  if (!response.ok) return [{ id: "coarse", label: "3-year blocks" }];
  return response.json();
}

export async function loadDataset(base: string, id: string): Promise<Dataset> {
  const root = `${base}${id}/`;
  const manifest = await (await fetch(`${root}manifest.json`)).json();
  const names: string[] = await (await fetch(`${root}names.json`)).json();
  const [pos, posSingle, rel, rho, speed, exposure, neighbours, ccIndex] = await Promise.all([
    buffer(root, "positions.bin"),
    buffer(root, "positions_single.bin"),
    buffer(root, "reliability.bin"),
    buffer(root, "rho.bin"),
    buffer(root, "speed.bin"),
    buffer(root, "exposure.bin"),
    buffer(root, "neighbours.bin"),
    buffer(root, "country_index.bin"),
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
    stepYears: manifest.step_years ?? 3,
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
    level: "institution",
  };
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(cc: string): string {
  if (cc === "??") return "Unknown";
  try {
    return regionNames.of(cc) ?? cc;
  } catch {
    return cc;
  }
}

export function aggregateCountries(data: Dataset): Dataset {
  const W = data.windows.length;
  const codes: number[] = [];
  const memberOf = new Map<number, number>();
  for (let i = 0; i < data.n; i++) {
    const cc = data.countryIndex[i];
    if (!memberOf.has(cc)) {
      memberOf.set(cc, codes.length);
      codes.push(cc);
    }
  }
  const m = codes.length;
  const positions = new Float32Array(m * W * 3);
  const positionsSingle = new Float32Array(m * W * 3);
  const reliability = new Float32Array(m * W);
  const exposure = new Float32Array(m * W);
  const rho = new Float32Array(m * (W - 1));
  const speed = new Float32Array(m);
  const weightTotal = new Float32Array(m * W);
  const speedWeight = new Float32Array(m);

  for (let i = 0; i < data.n; i++) {
    const c = memberOf.get(data.countryIndex[i])!;
    for (let w = 0; w < W; w++) {
      const weight = 2 ** data.exposure[i * W + w];
      const cw = c * W + w;
      weightTotal[cw] += weight;
      reliability[cw] += weight * data.reliability[i * W + w];
      for (let k = 0; k < 3; k++) {
        positions[cw * 3 + k] += weight * data.positions[(i * W + w) * 3 + k];
        positionsSingle[cw * 3 + k] += weight * data.positionsSingle[(i * W + w) * 3 + k];
      }
    }
    const weight0 = 2 ** data.exposure[i * W];
    speed[c] += weight0 * data.speed[i];
    speedWeight[c] += weight0;
    for (let p = 0; p < W - 1; p++) rho[c * (W - 1) + p] += weight0 * data.rho[i * (W - 1) + p];
  }
  for (let c = 0; c < m; c++) {
    for (let w = 0; w < W; w++) {
      const cw = c * W + w;
      const total = Math.max(weightTotal[cw], 1e-9);
      reliability[cw] /= total;
      exposure[cw] = Math.log2(Math.max(total, 1));
      for (let k = 0; k < 3; k++) {
        positions[cw * 3 + k] /= total;
        positionsSingle[cw * 3 + k] /= total;
      }
    }
    const sw = Math.max(speedWeight[c], 1e-9);
    speed[c] /= sw;
    for (let p = 0; p < W - 1; p++) rho[c * (W - 1) + p] /= sw;
  }

  const K = 5;
  const neighbours = new Uint16Array(m * W * K);
  for (let w = 0; w < W; w++) {
    for (let c = 0; c < m; c++) {
      const distances: { j: number; d: number }[] = [];
      for (let j = 0; j < m; j++) {
        if (j === c) continue;
        let d = 0;
        for (let k = 0; k < 3; k++) {
          const delta = positions[(c * W + w) * 3 + k] - positions[(j * W + w) * 3 + k];
          d += delta * delta;
        }
        distances.push({ j, d });
      }
      distances.sort((a, b) => a.d - b.d);
      for (let k = 0; k < K; k++) neighbours[(c * W + w) * K + k] = distances[k].j;
    }
  }

  const countryIndex = new Uint8Array(m);
  const continentIndex = new Uint8Array(m);
  const names: string[] = [];
  for (let c = 0; c < m; c++) {
    countryIndex[c] = codes[c];
    continentIndex[c] = continentOf(data.countries[codes[c]]);
    names.push(countryName(data.countries[codes[c]]));
  }

  return {
    n: m,
    windows: data.windows,
    stepYears: data.stepYears,
    neighbourCount: K,
    varianceExplained: data.varianceExplained,
    names,
    countries: data.countries,
    countryIndex,
    continentIndex,
    positions,
    positionsSingle,
    reliability,
    rho,
    speed,
    exposure,
    neighbours,
    level: "country",
  };
}
