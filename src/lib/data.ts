import { continentOf } from "./continents";

export interface Dataset {
  n: number;
  windows: string[];
  stepYears: number;
  components: number;
  neighbourCount: number;
  varianceExplained: number[];
  names: string[];
  countries: string[];
  countryIndex: Uint8Array;
  countryRank: Uint16Array;
  continentIndex: Uint8Array;
  positions: Float32Array;
  positionsSingle: Float32Array;
  reliability: Float32Array;
  rho: Float32Array;
  speed: Float32Array;
  exposure: Float32Array;
  neighbours: Uint16Array;
  neighbourSims: Uint8Array;
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

function rankCountries(countryIndex: Uint8Array, total: number): Uint16Array {
  const counts = new Uint32Array(total);
  for (const cc of countryIndex) counts[cc]++;
  const order = Array.from({ length: total }, (_, i) => i).sort((a, b) => counts[b] - counts[a]);
  const rank = new Uint16Array(total);
  for (let r = 0; r < total; r++) rank[order[r]] = r;
  return rank;
}

export async function loadDataset(base: string, id: string): Promise<Dataset> {
  const root = `${base}${id}/`;
  const manifest = await (await fetch(`${root}manifest.json`)).json();
  const names: string[] = await (await fetch(`${root}names.json`)).json();
  const [pos, posSingle, rel, rho, speed, exposure, neighbours, sims, ccIndex] = await Promise.all([
    buffer(root, "positions.bin"),
    buffer(root, "positions_single.bin"),
    buffer(root, "reliability.bin"),
    buffer(root, "rho.bin"),
    buffer(root, "speed.bin"),
    buffer(root, "exposure.bin"),
    buffer(root, "neighbours.bin"),
    buffer(root, "neighbour_sims.bin").catch(() => new ArrayBuffer(0)),
    buffer(root, "country_index.bin"),
  ]);
  const countryIndex = new Uint8Array(ccIndex);
  const countries: string[] = manifest.countries;
  const continentIndex = new Uint8Array(countryIndex.length);
  for (let i = 0; i < countryIndex.length; i++) {
    continentIndex[i] = continentOf(countries[countryIndex[i]]);
  }
  const neighbourArray = new Uint16Array(neighbours);
  const simArray = sims.byteLength > 0 ? new Uint8Array(sims) : new Uint8Array(neighbourArray.length).fill(255);
  return {
    n: manifest.n,
    windows: manifest.windows,
    stepYears: manifest.step_years ?? 3,
    components: manifest.components ?? 3,
    neighbourCount: manifest.neighbours,
    varianceExplained: manifest.variance_explained,
    names,
    countries,
    countryIndex,
    countryRank: rankCountries(countryIndex, countries.length),
    continentIndex,
    positions: new Float32Array(pos),
    positionsSingle: new Float32Array(posSingle),
    reliability: new Float32Array(rel),
    rho: new Float32Array(rho),
    speed: new Float32Array(speed),
    exposure: new Float32Array(exposure),
    neighbours: neighbourArray,
    neighbourSims: simArray,
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
  const C = data.components;
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
  const positions = new Float32Array(m * W * C);
  const positionsSingle = new Float32Array(m * W * C);
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
      for (let k = 0; k < C; k++) {
        positions[cw * C + k] += weight * data.positions[(i * W + w) * C + k];
        positionsSingle[cw * C + k] += weight * data.positionsSingle[(i * W + w) * C + k];
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
      for (let k = 0; k < C; k++) {
        positions[cw * C + k] /= total;
        positionsSingle[cw * C + k] /= total;
      }
    }
    const sw = Math.max(speedWeight[c], 1e-9);
    speed[c] /= sw;
    for (let p = 0; p < W - 1; p++) rho[c * (W - 1) + p] /= sw;
  }

  const K = Math.min(10, m - 1);
  const neighbours = new Uint16Array(m * W * K);
  const neighbourSims = new Uint8Array(m * W * K);
  for (let w = 0; w < W; w++) {
    for (let c = 0; c < m; c++) {
      const distances: { j: number; d: number }[] = [];
      for (let j = 0; j < m; j++) {
        if (j === c) continue;
        let d = 0;
        for (let k = 0; k < C; k++) {
          const delta = positions[(c * W + w) * C + k] - positions[(j * W + w) * C + k];
          d += delta * delta;
        }
        distances.push({ j, d: Math.sqrt(d) });
      }
      distances.sort((a, b) => a.d - b.d);
      const dMax = distances[Math.min(K * 3, distances.length - 1)].d || 1;
      for (let k = 0; k < K; k++) {
        neighbours[(c * W + w) * K + k] = distances[k].j;
        const sim = Math.max(0, 1 - distances[k].d / dMax);
        neighbourSims[(c * W + w) * K + k] = Math.round(127 + sim * 128);
      }
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
    components: C,
    neighbourCount: K,
    varianceExplained: data.varianceExplained,
    names,
    countries: data.countries,
    countryIndex,
    countryRank: data.countryRank,
    continentIndex,
    positions,
    positionsSingle,
    reliability,
    rho,
    speed,
    exposure,
    neighbours,
    neighbourSims,
    level: "country",
  };
}
