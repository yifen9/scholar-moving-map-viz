import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Dataset } from "./data";
import { CONTINENT_COLORS, SPEED_RAMP, hex, rampColor } from "./palette";
import { CONTINENT_NAMES } from "./continents";

const VERTEX = /* glsl */ `
attribute vec3 p0; attribute vec3 p1; attribute vec3 p2; attribute vec3 p3;
attribute vec3 q0; attribute vec3 q1; attribute vec3 q2; attribute vec3 q3;
attribute vec4 aRel;
attribute vec3 aColor;
attribute float aSize;
attribute float aVisible;
uniform float uT;
uniform float uSingle;
uniform float uFlat;
uniform float uScale;
uniform float uHaloPass;
uniform float uHaloScale;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vAlpha;

vec3 interp(vec3 a0, vec3 a1, vec3 a2, vec3 a3, float t) {
  if (t <= 1.0) return mix(a0, a1, smoothstep(0.0, 1.0, t));
  if (t <= 2.0) return mix(a1, a2, smoothstep(0.0, 1.0, t - 1.0));
  return mix(a2, a3, smoothstep(0.0, 1.0, t - 2.0));
}

float interp1(vec4 v, float t) {
  if (t <= 1.0) return mix(v.x, v.y, t);
  if (t <= 2.0) return mix(v.y, v.z, t - 1.0);
  return mix(v.z, v.w, t - 2.0);
}

void main() {
  vec3 avg = interp(p0, p1, p2, p3, uT);
  vec3 single = interp(q0, q1, q2, q3, uT);
  vec3 pos = mix(avg, single, uSingle);
  if (uFlat > 0.5) pos.z = 0.0;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float rel = clamp(interp1(aRel, uT), 0.0, 1.0);
  float uncertainty = 1.0 - rel;
  float core = aSize * uScale;
  float halo = core * (1.5 + 6.0 * uncertainty * uHaloScale);
  float size = mix(core, halo, uHaloPass);
  gl_PointSize = min(size * uPixelRatio * 2.0 / -mv.z, 48.0);
  gl_Position = projectionMatrix * mv;
  vColor = aColor;
  float coreAlpha = 0.85;
  float haloAlpha = 0.09 * uncertainty;
  vAlpha = mix(coreAlpha, haloAlpha, uHaloPass) * aVisible;
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
  float edge = uHaloPass > 0.5 ? smoothstep(1.0, 0.0, d) : smoothstep(1.0, 0.82, 1.0 - d) * step(d, 1.0);
  float soft = uHaloPass > 0.5 ? edge * edge : smoothstep(1.0, 0.72, d);
  float alpha = vAlpha * soft;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(vColor, alpha);
}
`;

export interface SceneOptions {
  flat: boolean;
  data: Dataset;
  onPick?: (index: number) => void;
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
  marker: THREE.Mesh;
  trail: THREE.Line;
  moverTrails: THREE.LineSegments | null = null;
  data: Dataset;
  flat: boolean;
  raycaster = new THREE.Raycaster();
  canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, options: SceneOptions) {
    this.canvas = canvas;
    this.data = options.data;
    this.flat = options.flat;
    const { n } = options.data;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setClearColor(new THREE.Color("#0d0d0d"), 1);

    if (options.flat) {
      this.camera = new THREE.OrthographicCamera(-1.3, 1.3, 1.3, -1.3, 0.01, 10);
      this.camera.position.set(0, 0, 2);
    } else {
      this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 20);
      this.camera.position.set(1.9, 1.5, 2.4);
    }
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    if (options.flat) {
      this.controls.enableRotate = false;
      this.controls.enablePan = true;
    }

    const d = options.data;
    for (let w = 0; w < 4; w++) {
      const avg = new Float32Array(n * 3);
      const single = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < 3; k++) {
          avg[i * 3 + k] = d.positions[(i * 4 + w) * 3 + k];
          single[i * 3 + k] = d.positionsSingle[(i * 4 + w) * 3 + k];
        }
      }
      this.geometry.setAttribute(`p${w}`, new THREE.BufferAttribute(avg, 3));
      this.geometry.setAttribute(`q${w}`, new THREE.BufferAttribute(single, 3));
    }
    const rel = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      for (let w = 0; w < 4; w++) rel[i * 4 + w] = d.reliability[i * 4 + w];
    }
    this.geometry.setAttribute("aRel", new THREE.BufferAttribute(rel, 4));
    this.geometry.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const sizes = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let m = 0;
      for (let w = 0; w < 4; w++) m = Math.max(m, d.exposure[i * 4 + w]);
      sizes[i] = 1.3 + 0.38 * m;
    }
    this.geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    this.geometry.setAttribute("aVisible", new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
    this.geometry.setAttribute("position", this.geometry.getAttribute("p0"));
    this.geometry.computeBoundingSphere();

    const makeUniforms = (haloPass: number) => ({
      uT: { value: 0 },
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
    this.haloLayer.renderOrder = 0;
    this.core.renderOrder = 1;
    this.haloLayer.frustumCulled = false;
    this.core.frustumCulled = false;
    this.scene.add(this.haloLayer);
    this.scene.add(this.core);

    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.014, 0.02, 32),
      new THREE.MeshBasicMaterial({ color: "#ffffff", side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    this.marker.visible = false;
    this.scene.add(this.marker);

    this.trail = new THREE.Line(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3)),
      new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.8 })
    );
    this.trail.visible = false;
    this.scene.add(this.trail);

    canvas.addEventListener("click", (event) => this.pick(event, options.onPick));
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  positionAt(index: number, t: number, single: boolean): THREE.Vector3 {
    const source = single ? this.data.positionsSingle : this.data.positions;
    const segment = Math.min(Math.floor(t), 2);
    const f = t - segment;
    const s = f * f * (3 - 2 * f);
    const out = new THREE.Vector3();
    for (let k = 0; k < 3; k++) {
      const a = source[(index * 4 + segment) * 3 + k];
      const b = source[(index * 4 + segment + 1) * 3 + k];
      (out as any).setComponent(k, a + (b - a) * s);
    }
    if (this.flat) out.z = 0;
    return out;
  }

  setColors(mode: string): void {
    const d = this.data;
    const attribute = this.geometry.getAttribute("aColor") as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;
    let maxExposure = 0;
    if (mode === "exposure") {
      for (let i = 0; i < d.n; i++) maxExposure = Math.max(maxExposure, d.exposure[i * 4 + 3]);
    }
    for (let i = 0; i < d.n; i++) {
      let rgb: [number, number, number];
      if (mode === "continent") {
        rgb = hex(CONTINENT_COLORS[CONTINENT_NAMES[d.continentIndex[i]]]);
      } else if (mode === "speed") {
        rgb = rampColor(SPEED_RAMP, Math.min(d.speed[i] / 0.25, 1));
      } else {
        rgb = rampColor(SPEED_RAMP, d.exposure[i * 4 + 3] / (maxExposure || 1));
      }
      array[i * 3] = rgb[0];
      array[i * 3 + 1] = rgb[1];
      array[i * 3 + 2] = rgb[2];
    }
    attribute.needsUpdate = true;
  }

  setVisibility(minExposureLog: number): void {
    const d = this.data;
    const attribute = this.geometry.getAttribute("aVisible") as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;
    for (let i = 0; i < d.n; i++) {
      let m = 0;
      for (let w = 0; w < 4; w++) m = Math.max(m, d.exposure[i * 4 + w]);
      array[i] = m >= minExposureLog ? 1 : 0;
    }
    attribute.needsUpdate = true;
  }

  setMoverTrails(on: boolean): void {
    if (on && !this.moverTrails) {
      const d = this.data;
      const candidates: number[] = [];
      for (let i = 0; i < d.n; i++) {
        if (d.exposure[i * 4] >= 5 && d.speed[i] > 0) candidates.push(i);
      }
      candidates.sort((a, b) => d.speed[b] - d.speed[a]);
      const top = candidates.slice(0, 250);
      const vertices = new Float32Array(top.length * 3 * 2 * 3);
      const colors = new Float32Array(top.length * 3 * 2 * 3);
      let offset = 0;
      for (const index of top) {
        const rgb = rampColor(SPEED_RAMP, Math.min(d.speed[index] / 0.25, 1));
        for (let w = 0; w < 3; w++) {
          for (const ww of [w, w + 1]) {
            for (let k = 0; k < 3; k++) {
              vertices[offset] = this.flat && k === 2 ? 0 : d.positions[(index * 4 + ww) * 3 + k];
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
      this.scene.add(this.moverTrails);
    }
    if (this.moverTrails) this.moverTrails.visible = on;
  }

  updateSelection(index: number, t: number, single: boolean): void {
    if (index < 0) {
      this.marker.visible = false;
      this.trail.visible = false;
      return;
    }
    const p = this.positionAt(index, t, single);
    this.marker.position.copy(p);
    this.marker.visible = true;
    if (!this.flat) this.marker.lookAt(this.camera.position);
    const source = single ? this.data.positionsSingle : this.data.positions;
    const attribute = this.trail.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let w = 0; w < 4; w++) {
      for (let k = 0; k < 3; k++) {
        let v = source[(index * 4 + w) * 3 + k];
        if (this.flat && k === 2) v = 0;
        attribute.setComponent(w, k, v);
      }
    }
    attribute.needsUpdate = true;
    this.trail.geometry.computeBoundingSphere();
    this.trail.visible = true;
  }

  pick(event: MouseEvent, onPick?: (index: number) => void): void {
    if (!onPick) return;
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    this.raycaster.params.Points.threshold = this.flat ? 0.008 : 0.012;
    const t = this.uniformsCore.uT.value as number;
    const single = (this.uniformsCore.uSingle.value as number) > 0.5;
    const visible = this.geometry.getAttribute("aVisible").array as Float32Array;
    let best = -1;
    let bestDistance = Infinity;
    const ray = this.raycaster.ray;
    const point = new THREE.Vector3();
    for (let i = 0; i < this.data.n; i++) {
      if (visible[i] < 0.5) continue;
      point.copy(this.positionAt(i, t, single));
      const distanceToRay = ray.distanceToPoint(point);
      if (distanceToRay < this.raycaster.params.Points.threshold && distanceToRay < bestDistance) {
        bestDistance = distanceToRay;
        best = i;
      }
    }
    if (best >= 0) onPick(best);
  }

  focusOn(index: number): void {
    const p = this.positionAt(index, this.uniformsCore.uT.value as number, false);
    this.controls.target.copy(p);
  }

  apply(t: number, single: boolean, halo: boolean, haloScale: number, pointScale: number): void {
    for (const uniforms of [this.uniformsCore, this.uniformsHalo]) {
      uniforms.uT.value = t;
      uniforms.uSingle.value = single ? 1 : 0;
      uniforms.uScale.value = pointScale;
      uniforms.uHaloScale.value = haloScale;
    }
    this.haloLayer.visible = halo;
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
      this.camera.left = -1.3 * aspect;
      this.camera.right = 1.3 * aspect;
      this.camera.top = 1.3;
      this.camera.bottom = -1.3;
    }
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
    this.geometry.dispose();
  }
}
