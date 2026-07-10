import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Dataset } from "./data";
import { CONTINENT_COLORS, SPEED_RAMP, hex, rampColor } from "./palette";
import { CONTINENT_NAMES } from "./continents";

const VERTEX = /* glsl */ `
attribute vec3 pA; attribute vec3 pB;
attribute vec3 qA; attribute vec3 qB;
attribute float relA; attribute float relB;
attribute vec3 aColor;
attribute float aSize;
attribute float aVisible;
attribute float aDim;
uniform float uF;
uniform float uSingle;
uniform float uFlat;
uniform float uScale;
uniform float uHaloPass;
uniform float uHaloScale;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vAlpha;

void main() {
  float s = smoothstep(0.0, 1.0, uF);
  vec3 pos = mix(mix(pA, pB, s), mix(qA, qB, s), uSingle);
  if (uFlat > 0.5) pos.z = 0.0;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float rel = clamp(mix(relA, relB, uF), 0.0, 1.0);
  float uncertainty = 1.0 - rel;
  float core = aSize * uScale;
  float halo = core * (1.8 + 7.0 * uncertainty * uHaloScale);
  float size = mix(core, halo, uHaloPass);
  gl_PointSize = min(size * uPixelRatio * 2.0 / -mv.z, 56.0);
  gl_Position = projectionMatrix * mv;
  vColor = aColor;
  float coreAlpha = 0.85;
  float haloAlpha = 0.38 * uncertainty * aDim;
  vAlpha = mix(coreAlpha, haloAlpha, uHaloPass) * aVisible * aDim;
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vAlpha;
uniform float uHaloPass;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float soft = uHaloPass > 0.5 ? (1.0 - d) * (1.0 - d) : smoothstep(1.0, 0.72, d);
  float alpha = vAlpha * soft;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(vColor, alpha);
}
`;

const EDGE_VERTEX = /* glsl */ `
attribute vec3 pA; attribute vec3 pB;
attribute vec3 aColor;
uniform float uF;
uniform float uFlat;
varying vec3 vColor;
void main() {
  float s = smoothstep(0.0, 1.0, uF);
  vec3 pos = mix(pA, pB, s);
  if (uFlat > 0.5) pos.z = 0.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  vColor = aColor;
}
`;

const EDGE_FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vColor;
uniform float uOpacity;
void main() {
  gl_FragColor = vec4(vColor, uOpacity);
}
`;

export interface SceneOptions {
  flat: boolean;
  data: Dataset;
  onPick?: (index: number) => void;
  onHover?: (index: number, x: number, y: number) => void;
}

export class MapScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  controls: OrbitControls;
  geometry = new THREE.BufferGeometry();
  core: THREE.Points;
  haloLayer: THREE.Points;
  uniformsCore: Record<string, THREE.IUniform>;
  uniformsHalo: Record<string, THREE.IUniform>;
  edgeGeometry: THREE.BufferGeometry | null = null;
  edgeLines: THREE.LineSegments | null = null;
  edgeUniforms: Record<string, THREE.IUniform> | null = null;
  selEdges: THREE.LineSegments;
  marker: THREE.Mesh;
  trail: THREE.Line;
  moverTrails: THREE.LineSegments | null = null;
  data: Dataset;
  flat: boolean;
  radius = 1;
  raycaster = new THREE.Raycaster();
  canvas: HTMLCanvasElement;
  observer: ResizeObserver;
  W: number;
  segment = -1;
  edgeWindow = -1;
  linkK = 0;
  edgeOpacity = 0.06;
  edgeSingle = false;
  colorMode = "continent";
  minExposureLog = 3;
  disposed = false;

  constructor(canvas: HTMLCanvasElement, options: SceneOptions) {
    this.canvas = canvas;
    this.data = options.data;
    this.flat = options.flat;
    this.W = options.data.windows.length;
    const { n } = options.data;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setClearColor(new THREE.Color("#0d0d0d"), 1);

    const norms = new Float32Array(options.data.n);
    for (let i = 0; i < options.data.n; i++) {
      let m = 0;
      for (let w = 0; w < this.W; w++) {
        for (let k = 0; k < 3; k++) m = Math.max(m, Math.abs(options.data.positions[(i * this.W + w) * 3 + k]));
      }
      norms[i] = m;
    }
    norms.sort();
    this.radius = Math.max(norms[Math.floor(options.data.n * 0.95)], 0.05);

    if (options.flat) {
      const f = this.radius * 1.3;
      this.camera = new THREE.OrthographicCamera(-f, f, f, -f, 0.01, 10);
      this.camera.position.set(0, 0, 2);
    } else {
      this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 20);
      this.camera.position.set(1.55 * this.radius, 1.2 * this.radius, 1.95 * this.radius);
    }
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotateSpeed = 0.5;
    if (options.flat) {
      this.controls.enableRotate = false;
      this.controls.enablePan = true;
    }

    for (const name of ["pA", "pB", "qA", "qB"]) {
      this.geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    }
    for (const name of ["relA", "relB"]) {
      this.geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(n), 1));
    }
    this.geometry.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const sizes = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let m = 0;
      for (let w = 0; w < this.W; w++) m = Math.max(m, this.data.exposure[i * this.W + w]);
      sizes[i] = 1.3 + 0.38 * m;
    }
    this.geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    this.geometry.setAttribute("aVisible", new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
    this.geometry.setAttribute("aDim", new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
    this.geometry.setAttribute("position", this.geometry.getAttribute("pA"));
    this.geometry.computeBoundingSphere();

    const makeUniforms = (haloPass: number) => ({
      uF: { value: 0 },
      uSingle: { value: 0 },
      uFlat: { value: options.flat ? 1 : 0 },
      uScale: { value: 1 },
      uHaloPass: { value: haloPass },
      uHaloScale: { value: 1 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    });
    this.uniformsCore = makeUniforms(0);
    this.uniformsHalo = makeUniforms(1);

    const materialFor = (uniforms: Record<string, THREE.IUniform>, blending: THREE.Blending) =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending,
      });

    this.haloLayer = new THREE.Points(this.geometry, materialFor(this.uniformsHalo, THREE.AdditiveBlending));
    this.core = new THREE.Points(this.geometry, materialFor(this.uniformsCore, THREE.NormalBlending));
    this.haloLayer.renderOrder = 1;
    this.core.renderOrder = 2;
    this.haloLayer.frustumCulled = false;
    this.core.frustumCulled = false;
    this.scene.add(this.haloLayer);
    this.scene.add(this.core);

    this.selEdges = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(this.data.neighbourCount * 2 * 3), 3)
      ),
      new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55 })
    );
    this.selEdges.visible = false;
    this.selEdges.frustumCulled = false;
    this.selEdges.renderOrder = 3;
    this.scene.add(this.selEdges);

    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.014 * this.radius, 0.02 * this.radius, 32),
      new THREE.MeshBasicMaterial({ color: "#ffffff", side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    this.marker.visible = false;
    this.marker.renderOrder = 4;
    this.scene.add(this.marker);

    this.trail = new THREE.Line(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.W * 3), 3)),
      new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.8 })
    );
    this.trail.visible = false;
    this.trail.frustumCulled = false;
    this.scene.add(this.trail);

    canvas.addEventListener("click", (event) => {
      if (this.dragDistance(event) > 6) return;
      const hit = this.pick(event.clientX, event.clientY);
      options.onPick?.(hit);
    });
    canvas.addEventListener("pointerdown", (event) => {
      this.downX = event.clientX;
      this.downY = event.clientY;
    });
    if (options.onHover && !options.flat) {
      let pending = false;
      canvas.addEventListener("pointermove", (event) => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
          pending = false;
          if (this.disposed) return;
          const hit = this.pick(event.clientX, event.clientY);
          options.onHover!(hit, event.clientX, event.clientY);
        });
      });
      canvas.addEventListener("pointerleave", () => options.onHover!(-1, 0, 0));
    }
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.setSegment(0);
  }

  downX = 0;
  downY = 0;

  dragDistance(event: MouseEvent): number {
    return Math.hypot(event.clientX - this.downX, event.clientY - this.downY);
  }

  setSegment(segment: number): void {
    this.segment = segment;
    const { n, positions, positionsSingle, reliability } = this.data;
    const W = this.W;
    const a = segment;
    const b = Math.min(segment + 1, W - 1);
    const pA = this.geometry.getAttribute("pA") as THREE.BufferAttribute;
    const pB = this.geometry.getAttribute("pB") as THREE.BufferAttribute;
    const qA = this.geometry.getAttribute("qA") as THREE.BufferAttribute;
    const qB = this.geometry.getAttribute("qB") as THREE.BufferAttribute;
    const relA = this.geometry.getAttribute("relA") as THREE.BufferAttribute;
    const relB = this.geometry.getAttribute("relB") as THREE.BufferAttribute;
    const arrPA = pA.array as Float32Array;
    const arrPB = pB.array as Float32Array;
    const arrQA = qA.array as Float32Array;
    const arrQB = qB.array as Float32Array;
    const arrRA = relA.array as Float32Array;
    const arrRB = relB.array as Float32Array;
    for (let i = 0; i < n; i++) {
      const ia = (i * W + a) * 3;
      const ib = (i * W + b) * 3;
      const o = i * 3;
      arrPA[o] = positions[ia]; arrPA[o + 1] = positions[ia + 1]; arrPA[o + 2] = positions[ia + 2];
      arrPB[o] = positions[ib]; arrPB[o + 1] = positions[ib + 1]; arrPB[o + 2] = positions[ib + 2];
      arrQA[o] = positionsSingle[ia]; arrQA[o + 1] = positionsSingle[ia + 1]; arrQA[o + 2] = positionsSingle[ia + 2];
      arrQB[o] = positionsSingle[ib]; arrQB[o + 1] = positionsSingle[ib + 1]; arrQB[o + 2] = positionsSingle[ib + 2];
      arrRA[i] = reliability[i * W + a];
      arrRB[i] = reliability[i * W + b];
    }
    for (const attribute of [pA, pB, qA, qB, relA, relB]) attribute.needsUpdate = true;
  }

  positionAt(index: number, t: number, single: boolean): THREE.Vector3 {
    const source = single ? this.data.positionsSingle : this.data.positions;
    const W = this.W;
    const segment = Math.min(Math.max(Math.floor(t), 0), W - 2);
    const f = t - segment;
    const s = f * f * (3 - 2 * f);
    const out = new THREE.Vector3();
    for (let k = 0; k < 3; k++) {
      const a = source[(index * W + segment) * 3 + k];
      const b = source[(index * W + segment + 1) * 3 + k];
      out.setComponent(k, a + (b - a) * s);
    }
    if (this.flat) out.z = 0;
    return out;
  }

  setColors(mode: string): void {
    this.colorMode = mode;
    const d = this.data;
    const attribute = this.geometry.getAttribute("aColor") as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;
    let maxExposure = 0;
    if (mode === "exposure") {
      for (let i = 0; i < d.n; i++) maxExposure = Math.max(maxExposure, d.exposure[i * this.W + this.W - 1]);
    }
    for (let i = 0; i < d.n; i++) {
      let rgb: [number, number, number];
      if (mode === "continent") {
        rgb = hex(CONTINENT_COLORS[CONTINENT_NAMES[d.continentIndex[i]]]);
      } else if (mode === "speed") {
        rgb = rampColor(SPEED_RAMP, Math.min(d.speed[i] / 0.25, 1));
      } else {
        rgb = rampColor(SPEED_RAMP, d.exposure[i * this.W + this.W - 1] / (maxExposure || 1));
      }
      array[i * 3] = rgb[0];
      array[i * 3 + 1] = rgb[1];
      array[i * 3 + 2] = rgb[2];
    }
    attribute.needsUpdate = true;
    this.edgeWindow = -1;
  }

  setVisibility(minExposureLog: number): void {
    this.minExposureLog = minExposureLog;
    const d = this.data;
    const attribute = this.geometry.getAttribute("aVisible") as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;
    for (let i = 0; i < d.n; i++) {
      let m = 0;
      for (let w = 0; w < this.W; w++) m = Math.max(m, d.exposure[i * this.W + w]);
      array[i] = m >= minExposureLog ? 1 : 0;
    }
    attribute.needsUpdate = true;
    this.edgeWindow = -1;
  }

  setDim(related: Set<number> | null): void {
    const attribute = this.geometry.getAttribute("aDim") as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;
    if (!related) {
      array.fill(1);
    } else {
      for (let i = 0; i < this.data.n; i++) array[i] = related.has(i) ? 1 : 0.08;
    }
    attribute.needsUpdate = true;
    this.edgeOpacity = related ? 0.012 : 0.06;
    if (this.edgeUniforms) this.edgeUniforms.uOpacity.value = this.edgeOpacity;
  }

  setLinks(k: number): void {
    this.linkK = k;
    this.edgeWindow = -1;
  }

  rebuildEdges(window: number): void {
    this.edgeWindow = window;
    const k = Math.min(this.linkK, this.data.neighbourCount);
    if (k <= 0) {
      if (this.edgeLines) this.edgeLines.visible = false;
      return;
    }
    const d = this.data;
    const W = this.W;
    const maxVerts = d.n * k * 2;
    if (!this.edgeGeometry || (this.edgeGeometry.getAttribute("pA").array as Float32Array).length < maxVerts * 3) {
      this.edgeGeometry?.dispose();
      this.edgeGeometry = new THREE.BufferGeometry();
      for (const name of ["pA", "pB", "aColor"]) {
        this.edgeGeometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(maxVerts * 3), 3));
      }
      this.edgeGeometry.setAttribute("position", this.edgeGeometry.getAttribute("pA"));
      this.edgeUniforms = {
        uF: { value: 0 },
        uFlat: { value: this.flat ? 1 : 0 },
        uOpacity: { value: this.edgeOpacity },
      };
      const material = new THREE.ShaderMaterial({
        uniforms: this.edgeUniforms,
        vertexShader: EDGE_VERTEX,
        fragmentShader: EDGE_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      if (this.edgeLines) this.scene.remove(this.edgeLines);
      this.edgeLines = new THREE.LineSegments(this.edgeGeometry, material);
      this.edgeLines.frustumCulled = false;
      this.edgeLines.renderOrder = 0;
      this.scene.add(this.edgeLines);
    }
    const visible = this.geometry.getAttribute("aVisible").array as Float32Array;
    const colors = this.geometry.getAttribute("aColor").array as Float32Array;
    const pA = this.edgeGeometry.getAttribute("pA") as THREE.BufferAttribute;
    const pB = this.edgeGeometry.getAttribute("pB") as THREE.BufferAttribute;
    const eColor = this.edgeGeometry.getAttribute("aColor") as THREE.BufferAttribute;
    const arrPA = pA.array as Float32Array;
    const arrPB = pB.array as Float32Array;
    const arrColor = eColor.array as Float32Array;
    const source = this.edgeSingle ? d.positionsSingle : d.positions;
    const a = this.segment;
    const b = Math.min(this.segment + 1, W - 1);
    let v = 0;
    for (let i = 0; i < d.n; i++) {
      if (visible[i] < 0.5) continue;
      for (let e = 0; e < k; e++) {
        const j = d.neighbours[(i * W + window) * d.neighbourCount + e];
        if (visible[j] < 0.5) continue;
        for (const [endpoint, offset] of [[i, v], [j, v + 1]] as const) {
          const ia = (endpoint * W + a) * 3;
          const ib = (endpoint * W + b) * 3;
          const o = offset * 3;
          arrPA[o] = source[ia]; arrPA[o + 1] = source[ia + 1]; arrPA[o + 2] = source[ia + 2];
          arrPB[o] = source[ib]; arrPB[o + 1] = source[ib + 1]; arrPB[o + 2] = source[ib + 2];
          arrColor[o] = colors[i * 3]; arrColor[o + 1] = colors[i * 3 + 1]; arrColor[o + 2] = colors[i * 3 + 2];
        }
        v += 2;
      }
    }
    this.edgeGeometry.setDrawRange(0, v);
    for (const attribute of [pA, pB, eColor]) attribute.needsUpdate = true;
    this.edgeLines!.visible = true;
  }

  updateSelection(index: number, t: number, single: boolean): void {
    if (index < 0) {
      this.marker.visible = false;
      this.trail.visible = false;
      this.selEdges.visible = false;
      return;
    }
    const p = this.positionAt(index, t, single);
    this.marker.position.copy(p);
    this.marker.visible = true;
    if (!this.flat) this.marker.lookAt(this.camera.position);
    const source = single ? this.data.positionsSingle : this.data.positions;
    const attribute = this.trail.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let w = 0; w < this.W; w++) {
      for (let k = 0; k < 3; k++) {
        let value = source[(index * this.W + w) * 3 + k];
        if (this.flat && k === 2) value = 0;
        attribute.setComponent(w, k, value);
      }
    }
    attribute.needsUpdate = true;
    this.trail.geometry.setDrawRange(0, this.W);
    this.trail.visible = true;

    const wNear = Math.min(Math.round(t), this.W - 1);
    const edgeAttr = this.selEdges.geometry.getAttribute("position") as THREE.BufferAttribute;
    const K = this.data.neighbourCount;
    for (let e = 0; e < K; e++) {
      const j = this.data.neighbours[(index * this.W + wNear) * K + e];
      const pj = this.positionAt(j, t, single);
      edgeAttr.setXYZ(e * 2, p.x, p.y, p.z);
      edgeAttr.setXYZ(e * 2 + 1, pj.x, pj.y, pj.z);
    }
    edgeAttr.needsUpdate = true;
    this.selEdges.visible = true;
  }

  pick(clientX: number, clientY: number): number {
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    const threshold = (this.flat ? 0.02 : 0.018) * this.radius;
    const t = (this.uniformsCore.uF.value as number) + this.segment;
    const single = (this.uniformsCore.uSingle.value as number) > 0.5;
    const visible = this.geometry.getAttribute("aVisible").array as Float32Array;
    let best = -1;
    let bestDistance = Infinity;
    const ray = this.raycaster.ray;
    for (let i = 0; i < this.data.n; i++) {
      if (visible[i] < 0.5) continue;
      const point = this.positionAt(i, t, single);
      const distanceToRay = ray.distanceToPoint(point);
      if (distanceToRay < threshold && distanceToRay < bestDistance) {
        bestDistance = distanceToRay;
        best = i;
      }
    }
    return best;
  }

  setMoverTrails(on: boolean): void {
    if (on && !this.moverTrails) {
      const d = this.data;
      const W = this.W;
      const candidates: number[] = [];
      for (let i = 0; i < d.n; i++) {
        if (d.exposure[i * W] >= 5 && d.speed[i] > 0) candidates.push(i);
      }
      candidates.sort((a, b) => d.speed[b] - d.speed[a]);
      const top = candidates.slice(0, 250);
      const segments = W - 1;
      const vertices = new Float32Array(top.length * segments * 2 * 3);
      const colors = new Float32Array(top.length * segments * 2 * 3);
      let offset = 0;
      for (const index of top) {
        const rgb = rampColor(SPEED_RAMP, Math.min(d.speed[index] / 0.25, 1));
        for (let w = 0; w < segments; w++) {
          for (const ww of [w, w + 1]) {
            for (let k = 0; k < 3; k++) {
              vertices[offset] = this.flat && k === 2 ? 0 : d.positions[(index * W + ww) * 3 + k];
              colors[offset] = rgb[k];
              offset++;
            }
          }
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      this.moverTrails = new THREE.LineSegments(
        geometry,
        new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.35 })
      );
      this.moverTrails.frustumCulled = false;
      this.scene.add(this.moverTrails);
    }
    if (this.moverTrails) this.moverTrails.visible = on;
  }

  focusOn(index: number): void {
    const p = this.positionAt(index, (this.uniformsCore.uF.value as number) + this.segment, false);
    this.controls.target.copy(p);
  }

  project(index: number, t: number, single: boolean): { x: number; y: number; behind: boolean } {
    const p = this.positionAt(index, t, single);
    p.project(this.camera);
    return {
      x: (p.x + 1) / 2 * this.canvas.clientWidth,
      y: (1 - p.y) / 2 * this.canvas.clientHeight,
      behind: p.z > 1,
    };
  }

  apply(t: number, single: boolean, halo: boolean, haloScale: number, pointScale: number, autoRotate: boolean): void {
    const W = this.W;
    const segment = Math.min(Math.max(Math.floor(t), 0), W - 2);
    if (segment !== this.segment) {
      this.setSegment(segment);
      this.edgeWindow = -1;
    }
    const f = t - segment;
    for (const uniforms of [this.uniformsCore, this.uniformsHalo]) {
      uniforms.uF.value = f;
      uniforms.uSingle.value = single ? 1 : 0;
      uniforms.uScale.value = pointScale;
      uniforms.uHaloScale.value = haloScale;
    }
    if (this.edgeUniforms) this.edgeUniforms.uF.value = f;
    this.haloLayer.visible = halo;
    this.controls.autoRotate = autoRotate && !this.flat;
    if (single !== this.edgeSingle) {
      this.edgeSingle = single;
      this.edgeWindow = -1;
    }
    if (this.linkK > 0) {
      const wNear = f < 0.5 ? segment : segment + 1;
      if (wNear !== this.edgeWindow) this.rebuildEdges(wNear);
    } else if (this.edgeLines && this.edgeLines.visible) {
      this.edgeLines.visible = false;
      this.edgeWindow = -1;
    }
  }

  resize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height, false);
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = width / height;
    } else {
      const aspect = width / height;
      const f = this.radius * 1.3;
      this.camera.left = -f * aspect;
      this.camera.right = f * aspect;
      this.camera.top = f;
      this.camera.bottom = -f;
    }
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.disposed = true;
    this.observer.disconnect();
    this.controls.dispose();
    this.geometry.dispose();
    this.edgeGeometry?.dispose();
    this.selEdges.geometry.dispose();
    this.trail.geometry.dispose();
    this.marker.geometry.dispose();
    this.moverTrails?.geometry.dispose();
    this.renderer.dispose();
  }
}
