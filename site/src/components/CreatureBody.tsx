import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { OrganId } from "../organs";

/*
 * The creature, whole: real human anatomy (BodyParts3D, © The Database Center for Life Science,
 * CC BY 4.0) under translucent, stitched skin, as the 1818 novel describes it: skin that "scarcely
 * covered the work of muscles and arteries beneath". Electricity, not blood, runs through it.
 */

export type Point = { x: number; y: number };
export type CreatureSceneHandle = {
  socket(part: OrganId): Point | null;
  strike(): Promise<void>;
};
type Props = { parts: Set<OrganId>; alive: boolean; charging: boolean; intro: boolean; speaking: boolean; entered: boolean };

const BODY_URL = "/models/creature/creature-body.glb";
/** About 30% of the triangles, for weaker machines. */
const BODY_LITE_URL = "/models/creature/creature-body-lite.glb";
const VEINS_URL = "/models/creature/creature-veins.bin";

const BG = new THREE.Color("#2b2a2e");
const ARC = new THREE.Color("#9fc2ff");
const ARC_HOT = new THREE.Color("#e6f0ff");
const COPPER_DULL = new THREE.Color("#5c3d26");
const COPPER_HOT = new THREE.Color("#e0995a");

const HEIGHT = 3.7; // the body's height in scene units
const FLOOR = -2.15;
/** +1 if the body faces +z after import, -1 if it faces -z. */
const FRONT = 1;

/** Build timeline in seconds (kept in step with BUILD_MS in Lab.tsx). */
const T = { bones: [0, 1.3], muscle: [0.9, 2.3], skin: [1.9, 3.3], seams: [3.0, 3.6], cables: [3.2, 3.9] };

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const ease = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const phase = (t: number, [a, b]: number[]) => ease((t - a) / (b - a));

/* ───────── shaders ───────── */

const NOISE = /* glsl */ `
  float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float vnoise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }
`;

/** Shared body motion: the head turns on the neck, the chest breathes, the jaw drops. */
const MOTION_DECL = /* glsl */ `
  uniform float uNeckY; uniform vec2 uLook; uniform float uBreath;
  uniform float uJaw; uniform vec3 uJawPivot; uniform float uMouthY;
  vec3 bodyMotion(vec3 p) {
    float headW = smoothstep(uNeckY - 0.06, uNeckY + 0.08, p.y);
    vec3 q = p - vec3(0.0, uNeckY, 0.0);
    float ay = uLook.x * 0.45 * headW; float ax = uLook.y * 0.18 * headW;
    q.xz = mat2(cos(ay), -sin(ay), sin(ay), cos(ay)) * q.xz;
    q.yz = mat2(cos(ax), -sin(ax), sin(ax), cos(ax)) * q.yz;
    p = q + vec3(0.0, uNeckY, 0.0);
    float chest = smoothstep(uNeckY - 0.9, uNeckY - 0.45, p.y) * (1.0 - smoothstep(uNeckY - 0.3, uNeckY - 0.1, p.y));
    p.xz *= 1.0 + chest * uBreath * 0.018;
    return p;
  }
`;

const EYE_VERT = /* glsl */ `
  varying vec3 vLocal; varying vec3 vViewNormal;
  void main() {
    vLocal = normalize(position);
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const EYE_FRAG = /* glsl */ `
  uniform float uTime; uniform float uPower;
  varying vec3 vLocal; varying vec3 vViewNormal;
  ${NOISE}
  void main() {
    vec3 n = vLocal; float t = uTime;
    float ridge = 1.0 - abs(fbm3(n * 5.0 + vec3(0.0, t * 0.6, t * 0.3)) * 2.0 - 1.0);
    float veins = pow(ridge, 14.0) * smoothstep(0.75, 0.2, n.z);
    float irisMask = smoothstep(0.80, 0.84, n.z);
    float plasma = fbm3(n * 9.0 + vec3(t * 1.4, -t * 0.9, 0.0));
    float rings = 0.5 + 0.5 * sin(acos(clamp(n.z, -1.0, 1.0)) * 70.0 - t * 6.0);
    float pupil = smoothstep(0.972, 0.965, n.z);
    vec3 arc = vec3(0.62, 0.76, 1.0); vec3 hot = vec3(0.92, 0.96, 1.0);
    vec3 col = vec3(0.07, 0.07, 0.09) + vec3(0.18, 0.05, 0.06) * smoothstep(0.4, 0.9, fbm3(n * 3.0));
    col += arc * veins * 3.0 * uPower;
    col = mix(col, mix(arc * 0.6, hot, plasma) * (1.2 + rings * 0.8) * uPower, irisMask);
    col = mix(col, vec3(0.01), irisMask * (1.0 - pupil) * 0.95);
    col += hot * smoothstep(0.995, 0.999, n.z) * 2.0 * uPower;
    col += vec3(pow(max(dot(normalize(vViewNormal), normalize(vec3(-0.4, 0.5, 1.0))), 0.0), 60.0)) * 0.6;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const VEIN_VERT = /* glsl */ `
  attribute float dist;
  varying float vDist;
  ${MOTION_DECL}
  void main() {
    vDist = dist;
    vec3 p = bodyMotion(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const VEIN_FRAG = /* glsl */ `
  uniform float uFlood; uniform float uTime; uniform float uIdle; uniform vec3 uArc;
  varying float vDist;
  void main() {
    // the flood front sweeps outward from the heart; behind it, pulses keep travelling
    float reached = smoothstep(vDist - 0.04, vDist, uFlood);
    float front = smoothstep(0.025, 0.0, abs(uFlood - vDist)) * step(uFlood, 1.02);
    float pulse = pow(0.5 + 0.5 * sin((vDist * 18.0 - uTime * 3.2) * 6.2831 / 6.0), 6.0);
    float b = reached * (uIdle * (0.45 + pulse * 1.5)) + front * 2.2;
    if (b < 0.01) discard;
    gl_FragColor = vec4(uArc * b, 1.0);
  }
`;

export const CreatureBody = forwardRef<CreatureSceneHandle, Props>(function CreatureBody(
  { parts, alive, charging, intro, speaking, entered },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef({ parts, alive, charging, speaking, entered });
  state.current = { parts, alive, charging, speaking, entered };
  const api = useRef<CreatureSceneHandle>({ socket: () => null, strike: async () => {} });
  useImperativeHandle(ref, () => ({ socket: (p) => api.current.socket(p), strike: () => api.current.strike() }));

  useEffect(() => {
    const el = host.current!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const playIntro = intro && !reduce;

    /* ───── renderer and post ───── */
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.localClippingEnabled = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const canvas = renderer.domElement;

    const scene = new THREE.Scene();
    scene.background = BG;
    scene.fog = new THREE.Fog(BG, 9, 20);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.3;

    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 80);
    const cam = { dist: 10.5, target: new THREE.Vector3(0, -0.3, 0), closeUp: 0 };
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.9, 0.45, 0.9);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const key = new THREE.DirectionalLight("#dfe6f2", 1.9);
    key.position.set(-4, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    scene.add(key);
    const rim = new THREE.DirectionalLight("#8fb3ff", 2.2);
    rim.position.set(4, 3, -5);
    scene.add(rim);
    scene.add(new THREE.HemisphereLight("#9aa6c2", "#120f10", 0.14));
    const strikeLight = new THREE.PointLight(ARC_HOT, 0, 10, 1.6);
    strikeLight.position.set(0, 1.4, 0.8);
    scene.add(strikeLight);

    /* ───── the room ───── */
    const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshStandardMaterial({ color: "#232226", roughness: 0.92 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR;
    floor.receiveShadow = true;
    scene.add(floor);
    const darkMetal = new THREE.MeshStandardMaterial({ color: "#2a292e", metalness: 0.75, roughness: 0.42 });
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.16, 64), darkMetal);
    plinth.position.y = FLOOR + 0.08;
    plinth.receiveShadow = plinth.castShadow = true;
    scene.add(plinth);

    const copper = new THREE.MeshStandardMaterial({ color: COPPER_DULL, metalness: 0.95, roughness: 0.34, emissive: COPPER_HOT, emissiveIntensity: 0 });
    const porcelain = new THREE.MeshStandardMaterial({ color: "#d8d4ca", roughness: 0.25 });
    const polished = new THREE.MeshStandardMaterial({ color: "#8a8890", metalness: 0.9, roughness: 0.32 });
    const tipMat = new THREE.MeshStandardMaterial({ color: "#8a8890", metalness: 1, roughness: 0.2, emissive: ARC, emissiveIntensity: 0 });
    const coilTips: THREE.Mesh[] = [];
    function makeCoil(x: number) {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.36, 40), darkMetal);
      base.position.y = 0.18;
      g.add(base);
      for (let i = 0; i < 4; i++) {
        const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.12, 24), porcelain);
        ins.position.y = 0.42 + i * 0.13;
        g.add(ins);
      }
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 2.1, 32), darkMetal);
      core.position.y = 1.97;
      g.add(core);
      const turns = 46;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= turns * 24; i++) {
        const t = i / (turns * 24);
        const a = t * turns * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * 0.185, 0.97 + t * 2.0, Math.sin(a) * 0.185));
      }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, 0.012, 6, false), copper));
      const torus = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.12, 24, 64), polished);
      torus.rotation.x = Math.PI / 2;
      torus.position.y = 3.12;
      g.add(torus);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 16), tipMat);
      tip.position.y = 3.32;
      g.add(tip);
      coilTips.push(tip);
      g.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).castShadow = true) : null));
      g.position.set(x, FLOOR, -0.7);
      g.scale.setScalar(1.08);
      scene.add(g);
    }
    makeCoil(-2.1);
    makeCoil(2.1);

    /** 1 on capable machines; 0 swaps the costliest per-pixel effects for cheap versions. */
    const detail = { value: 1 };

    /* ───── the room around it: stone walls, a storm window, dust in the air, an instrument wall ───── */
    const stoneWall = new THREE.MeshStandardMaterial({ color: "#2f2d33", roughness: 0.95, side: THREE.BackSide });
    stoneWall.onBeforeCompile = (shader) => {
      shader.uniforms.uDetail = detail;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vW;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\nvarying vec3 vW; uniform float uDetail;\n${NOISE}`)
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          // rough stone blocks with mortar lines
          vec2 b = vec2(atan(vW.z, vW.x) * 9.0 * 0.6, vW.y * 1.4);
          b.x += step(1.0, mod(floor(b.y), 2.0)) * 0.5;
          vec2 f = fract(b);
          float mortar = smoothstep(0.0, 0.04, f.x) * smoothstep(1.0, 0.96, f.x) * smoothstep(0.0, 0.06, f.y) * smoothstep(1.0, 0.94, f.y);
          float grain = uDetail > 0.5 ? fbm3(vW * 1.7) : vnoise(vW * 1.7);
          diffuseColor.rgb *= mix(0.45, 1.0, mortar) * (0.75 + 0.5 * grain);`,
        );
    };
    const room = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 12, 72, 1, true), stoneWall);
    room.position.y = FLOOR + 6;
    room.receiveShadow = true;
    scene.add(room);

    // an arched window behind the creature, with a storm outside
    const stormUniforms = { uTime: { value: 0 }, uFlash: { value: 0 } };
    const storm = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 6),
      new THREE.ShaderMaterial({
        uniforms: stormUniforms,
        fog: false,
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `uniform float uTime; uniform float uFlash; varying vec2 vUv;
          ${NOISE}
          void main(){
            // arched opening
            vec2 p = vUv * 2.0 - 1.0;
            float arch = step(p.y, 0.55) + step(0.55, p.y) * step(length(vec2(p.x, (p.y - 0.55) * 1.4)), 1.0);
            if (arch < 0.5 || abs(p.x) > 1.0) discard;
            float clouds = fbm3(vec3(vUv * vec2(3.0, 2.0) + vec2(uTime * 0.02, 0.0), uTime * 0.03));
            vec3 sky = mix(vec3(0.03, 0.035, 0.06), vec3(0.16, 0.18, 0.26), clouds);
            sky += vec3(0.45, 0.55, 0.85) * uFlash * (0.15 + clouds * 0.45);
            // rain streaks
            float rain = step(0.985, fract(sin(floor(vUv.x * 260.0) * 91.7) * 43758.5 + vUv.y * 3.0 + uTime * 2.6));
            sky += vec3(0.25, 0.28, 0.35) * rain * 0.5;
            // window bars
            float bars = step(abs(fract(p.x * 1.5) - 0.5), 0.02) + step(abs(fract(p.y * 2.0) - 0.5), 0.015);
            sky = mix(sky, vec3(0.02), clamp(bars, 0.0, 1.0));
            gl_FragColor = vec4(sky, 1.0);
          }`,
      }),
    );
    storm.position.set(0, 1.0, -8.9);
    scene.add(storm);
    const windowLight = new THREE.DirectionalLight("#b9ccff", 0);
    windowLight.position.set(0, 3, -9);
    windowLight.target.position.set(0, 0, 0);
    scene.add(windowLight, windowLight.target);
    // two gas lamps on the back wall: warm, flickering light against the cold electricity
    const lamps = [-4.6, 4.6].map((x) => {
      const g = new THREE.Group();
      g.position.set(x, 1.3, -7.4);
      const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), darkMetal);
      bracket.rotation.x = Math.PI / 2;
      bracket.position.z = -0.25;
      g.add(bracket);
      const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.09, 0.32, 16, 1, true),
        new THREE.MeshStandardMaterial({ color: "#3a2a1a", transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
      );
      g.add(glass);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: "#ffb35c" }));
      flame.scale.y = 1.6;
      g.add(flame);
      const light = new THREE.PointLight("#ff9f4a", 5, 10, 1.6);
      g.add(light);
      scene.add(g);
      return { light, flame };
    });
    let nextThunder = performance.now() + 4000;

    // dust drifting in the air
    const dustCount = 900;
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      const r = Math.sqrt(Math.random()) * 7.5;
      const a = Math.random() * Math.PI * 2;
      dustPos.set([Math.cos(a) * r, FLOOR + Math.random() * 6.5, Math.sin(a) * r], i * 3);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dustTime = { value: 0 };
    const dustMat = new THREE.PointsMaterial({ color: "#cfd7e8", size: 0.025, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true });
    // the drift runs in the vertex shader, so the CPU never touches the points after setup
    dustMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = dustTime;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace(
          "#include <begin_vertex>",
          `vec3 transformed = position;
          transformed.y = ${FLOOR.toFixed(2)} + mod(position.y - (${FLOOR.toFixed(2)}) + uTime * 0.03, 6.5);
          transformed.x += sin(uTime * 0.3 + position.z * 3.1) * 0.15;
          transformed.z += cos(uTime * 0.23 + position.x * 2.7) * 0.12;`,
        );
    };
    const dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);

    // the instrument wall: brass gauges that read the visitor's real machine
    const brass = new THREE.MeshStandardMaterial({ color: "#a07a3c", metalness: 0.9, roughness: 0.35 });
    const gaugeWall = new THREE.Group();
    gaugeWall.position.set(-6.7, 0.25, 1.4);
    gaugeWall.rotation.y = Math.PI / 2;
    scene.add(gaugeWall);
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 0.12), new THREE.MeshStandardMaterial({ color: "#3a2a1f", roughness: 0.7 }));
    board.castShadow = board.receiveShadow = true;
    gaugeWall.add(board);
    const needles: Array<{ mesh: THREE.Mesh; target: number }> = [];
    function dialTexture(label: string) {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const g = c.getContext("2d")!;
      g.fillStyle = "#e9e3d4";
      g.beginPath();
      g.arc(128, 128, 124, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#2a2724";
      for (let i = 0; i <= 24; i++) {
        const ang = ((-120 + i * 10 - 90) * Math.PI) / 180;
        const r1 = i % 4 === 0 ? 84 : 94;
        g.lineWidth = i % 4 === 0 ? 4 : 2;
        g.beginPath();
        g.moveTo(128 + Math.cos(ang) * r1, 128 + Math.sin(ang) * r1);
        g.lineTo(128 + Math.cos(ang) * 106, 128 + Math.sin(ang) * 106);
        g.stroke();
      }
      g.fillStyle = "#2a2724";
      g.font = "600 22px Georgia, serif";
      g.textAlign = "center";
      g.fillText(label, 128, 190);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }
    ["Memory", "Storage", "Threads"].forEach((label, i) => {
      const gauge = new THREE.Group();
      gauge.position.set(-1.05 + i * 1.05, 0.15, 0.08);
      const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 16, 48), brass);
      gauge.add(bezel);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.42, 48), new THREE.MeshStandardMaterial({ map: dialTexture(label), roughness: 0.6 }));
      face.position.z = 0.005;
      gauge.add(face);
      const needle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.32, 0.01), new THREE.MeshStandardMaterial({ color: "#a8351f" }));
      needle.geometry.translate(0, 0.14, 0);
      needle.position.z = 0.02;
      needle.rotation.z = (120 * Math.PI) / 180;
      gauge.add(needle);
      const glass = new THREE.Mesh(
        new THREE.SphereGeometry(0.43, 32, 16, 0, Math.PI * 2, 0, Math.PI / 6),
        new THREE.MeshPhysicalMaterial({ color: "#ffffff", transmission: 0.9, roughness: 0.05, transparent: true, opacity: 0.25 }),
      );
      glass.rotation.x = Math.PI / 2;
      glass.position.z = -0.32;
      gauge.add(glass);
      gaugeWall.add(gauge);
      needles.push({ mesh: needle, target: (120 * Math.PI) / 180 });
    });
    // a WebGPU lamp under the dials
    const lampMat = new THREE.MeshStandardMaterial({ color: "#3a2a24", emissive: ARC, emissiveIntensity: 0 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), lampMat);
    lamp.position.set(0, -0.72, 0.1);
    gaugeWall.add(lamp);
    import("../probe").then(({ probeDevice }) =>
      probeDevice().then((sig) => {
        const frac = [(sig.memoryGB ?? 0) / 8, (sig.storageGB ?? 0) / 10, (sig.cores ?? 0) / 16];
        // dials sweep 240 degrees, from 120 (left) to -120 (right)
        frac.forEach((f, i) => (needles[i].target = ((120 - Math.min(f, 1) * 240) * Math.PI) / 180));
        lampMat.emissiveIntensity = sig.webgpu ? 2.4 : 0;
      }),
    );

    /* ───── shared uniforms ───── */
    const motion = {
      uNeckY: { value: 0 },
      uLook: { value: new THREE.Vector2() },
      uBreath: { value: 0 },
      uJaw: { value: 0 },
      uJawPivot: { value: new THREE.Vector3() },
      uMouthY: { value: 0 },
    };
    const bonesPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), playIntro ? -9 : 9);
    const musclePlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), playIntro ? -9 : 9);
    const skinPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), playIntro ? -9 : 9);

    /** Add the shared head/breath motion to any standard material. */
    function withMotion<M extends THREE.Material>(mat: M, extra?: (s: THREE.WebGLProgramParametersWithUniforms) => void): M {
      mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, motion);
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", `#include <common>\n${MOTION_DECL}`)
          .replace("#include <begin_vertex>", "vec3 transformed = bodyMotion(vec3(position));");
        extra?.(shader);
      };
      return mat;
    }

    // translucent, stitched skin: see-through face-on, solid at the edges, sewn from patches
    const skinUniforms = { uSeams: { value: playIntro ? 0 : 1 }, uDetail: detail };
    const skinMat = withMotion(
      new THREE.MeshPhysicalMaterial({
        color: "#cbc3ae", // the novel's yellowed skin, gone cold
        roughness: 0.45,
        sheen: 0.4,
        sheenColor: new THREE.Color("#e8d8c0"),
        transparent: true,
        opacity: 1,
        depthWrite: false,
        clippingPlanes: [skinPlane],
      }),
      (shader) => {
        Object.assign(shader.uniforms, skinUniforms);
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nvarying vec3 vObj;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;");
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", `#include <common>\nuniform float uSeams; uniform float uDetail; varying vec3 vObj;\n${NOISE}`)
          .replace(
            "#include <dithering_fragment>",
            `#include <dithering_fragment>
            vec3 V = normalize(vViewPosition);
            float fres = pow(1.0 - abs(dot(normalize(vNormal), V)), 2.2);
            // patchwork: cells of a 3D Voronoi-ish field, with dark sutures along their borders
            vec3 g = vObj * 2.3;
            vec3 ip = floor(g); vec3 fp = fract(g);
            float d1 = 9.0; float d2 = 9.0;
            // the 27-cell search is the costliest thing on screen; weak machines get plain skin instead
            if (uDetail > 0.5) for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
              vec3 o = vec3(float(x), float(y), float(z));
              vec3 r = o + vec3(hash3(ip + o), hash3(ip + o + 13.1), hash3(ip + o + 27.7)) - fp;
              float d = dot(r, r);
              if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
            }
            float edge = uDetail > 0.5 ? sqrt(d2) - sqrt(d1) : 1.0;
            float seam = (1.0 - smoothstep(0.035, 0.075, edge)) * uSeams;
            float stitch = (1.0 - smoothstep(0.0, 0.12, edge)) * uSeams * step(0.62, fract((vObj.x + vObj.y + vObj.z) * 70.0));
            float tone = fbm3(vObj * 2.0 + floor(g)) * 0.18; // each patch from a different donor
            gl_FragColor.rgb *= 1.0 - tone;
            gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.1, 0.04, 0.04), max(seam * 0.9, stitch));
            gl_FragColor.a = clamp(0.14 + fres * 0.66 + seam * 0.75 + stitch, 0.0, 1.0);`,
          );
      },
    );
    const muscleMat = withMotion(
      new THREE.MeshStandardMaterial({ color: "#7c2c25", roughness: 0.5, metalness: 0.05, clippingPlanes: [musclePlane] }),
    );
    const boneMat = withMotion(new THREE.MeshStandardMaterial({ color: "#d9d0bd", roughness: 0.65, clippingPlanes: [bonesPlane] }));
    const brainUniforms = { uBrain: { value: 0 }, uTime: { value: 0 } };
    const brainMat = withMotion(new THREE.MeshStandardMaterial({ color: "#b79a95", roughness: 0.55, clippingPlanes: [bonesPlane] }), (shader) => {
      Object.assign(shader.uniforms, brainUniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vObj;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\nuniform float uBrain; uniform float uTime; varying vec3 vObj;\n${NOISE}`)
        .replace(
          "#include <dithering_fragment>",
          `#include <dithering_fragment>
          float r = 1.0 - abs(fbm3(vObj * 22.0 + vec3(0.0, uTime * 0.8, 0.0)) * 2.0 - 1.0);
          gl_FragColor.rgb += vec3(0.62, 0.76, 1.0) * pow(r, 10.0) * 3.0 * uBrain;`,
        );
    });
    const heartUniforms = { uBeat: { value: 0 } };
    const heartMat = withMotion(new THREE.MeshStandardMaterial({ color: "#5e1f1c", roughness: 0.45, clippingPlanes: [musclePlane] }), (shader) => {
      Object.assign(shader.uniforms, heartUniforms);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uBeat;")
        .replace("#include <dithering_fragment>", "#include <dithering_fragment>\ngl_FragColor.rgb += vec3(0.62, 0.76, 1.0) * uBeat * 1.6;");
    });
    const veinMat = new THREE.ShaderMaterial({
      uniforms: { ...motion, uFlood: { value: 0 }, uTime: { value: 0 }, uIdle: { value: 0 }, uArc: { value: ARC.clone() } },
      vertexShader: VEIN_VERT,
      fragmentShader: VEIN_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    /* ───── load the body ───── */
    const creature = new THREE.Group();
    scene.add(creature);
    const draco = new DRACOLoader().setDecoderPath("/draco/");
    const loader = new GLTFLoader().setDRACOLoader(draco);
    let disposed = false;
    let skin: THREE.Mesh | null = null;
    let jaw: THREE.Group | null = null;
    let scale = 1;
    let bodyTop = 0;
    let start = performance.now();
    const raycaster = new THREE.Raycaster();

    const eyes: THREE.Group[] = [];
    const anchors: Record<string, THREE.Vector3> = {};
    const eyeMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uPower: { value: 0 } }, vertexShader: EYE_VERT, fragmentShader: EYE_FRAG });
    const implants = new Map<OrganId, THREE.Group[]>();
    const implantScale = new Map<OrganId, number>();
    const threadMat = new THREE.MeshStandardMaterial({ color: "#3a1715", roughness: 0.8 });
    const mouthLight = new THREE.PointLight(ARC, 0, 0.8, 2);
    creature.add(mouthLight);

    // electrodes: copper clamps on the temples, cabled to the coil tops; they come off after the run
    type Electrode = { clamp: THREE.Group; anchor: THREE.Vector3; normal: THREE.Vector3; cable: THREE.Mesh; tip: THREE.Mesh; detach: number };
    const electrodes: Electrode[] = [];
    const terminalMat = new THREE.MeshStandardMaterial({ color: "#6e6c74", metalness: 0.8, roughness: 0.3, emissive: ARC, emissiveIntensity: 0 });
    const cableMat = new THREE.MeshStandardMaterial({ color: "#1c1b1f", roughness: 0.6 });

    function surface(from: THREE.Vector3, dir: THREE.Vector3) {
      if (!skin) return null;
      raycaster.set(from, dir.clone().normalize());
      const h = raycaster.intersectObject(skin, false)[0];
      if (!h || !h.face) return null;
      const n = h.face.normal.clone().transformDirection(skin.matrixWorld);
      if (n.dot(dir) > 0) n.negate();
      return { point: h.point.clone(), normal: n };
    }
    function orientTo(obj: THREE.Object3D, p: THREE.Vector3, n: THREE.Vector3) {
      obj.position.copy(p);
      obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    }
    function stitchRing(radius: number) {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.005, 6, 40), threadMat);
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      const st = new THREE.BoxGeometry(0.007, 0.007, radius * 0.5);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const s = new THREE.Mesh(st, threadMat);
        s.position.set(Math.cos(a) * radius, 0.003, Math.sin(a) * radius);
        s.rotation.y = -a;
        g.add(s);
      }
      return g;
    }
    function makeImplant(r: number) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, 0.03, 32), darkMetal));
      const rimM = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.15, 10, 40), copper);
      rimM.rotation.x = Math.PI / 2;
      rimM.position.y = 0.01;
      g.add(rimM);
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.36, r * 0.36, 0.035, 20),
        new THREE.MeshStandardMaterial({ color: "#3a3940", emissive: ARC, emissiveIntensity: 0, metalness: 0.3, roughness: 0.3 }),
      );
      core.position.y = 0.012;
      core.name = "core";
      g.add(core);
      g.add(stitchRing(r * 1.35));
      g.scale.setScalar(0.0001);
      return g;
    }

    function setup(gltf: { scene: THREE.Object3D }) {
      const byName: Record<string, THREE.Mesh> = {};
      gltf.scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) byName[o.name] = o as THREE.Mesh;
      });
      skin = byName.skin ?? null;
      if (!skin) return;
      const box = new THREE.Box3().setFromObject(skin);
      scale = HEIGHT / box.getSize(new THREE.Vector3()).y;
      const wrap = new THREE.Group();
      wrap.scale.setScalar(scale);
      wrap.position.set(0, FLOOR + 0.16 - box.min.y * scale, 0);
      if (FRONT < 0) wrap.rotation.y = Math.PI;
      const mats: Record<string, THREE.Material> = { skin: skinMat, muscles: muscleMat, skeleton: boneMat, brain: brainMat, heart: heartMat, mandible: boneMat };
      for (const [name, mesh] of Object.entries(byName)) {
        mesh.material = mats[name] ?? boneMat;
        mesh.castShadow = name !== "skin";
        mesh.receiveShadow = true;
        if (name === "skin") mesh.renderOrder = 2;
        wrap.add(mesh);
      }
      creature.add(wrap);
      wrap.updateMatrixWorld(true);

      const wb = new THREE.Box3().setFromObject(skin);
      bodyTop = wb.max.y;
      const h = wb.max.y - wb.min.y;
      // body-space (pre-scale) landmarks for the shaders
      const toLocal = (y: number) => (y - wrap.position.y) / scale;
      motion.uNeckY.value = toLocal(wb.max.y - h * 0.145);
      const eyeY = wb.max.y - h * 0.068;
      const mouthY = wb.max.y - h * 0.105;
      motion.uMouthY.value = toLocal(mouthY);
      motion.uJawPivot.value.set(0, toLocal(wb.max.y - h * 0.085), 0);
      // the jaw swings from its hinge (top back corner of the mandible), not from the body origin
      const mandible = byName.mandible;
      if (mandible) {
        mandible.geometry.computeBoundingBox();
        const mb = mandible.geometry.boundingBox!;
        jaw = new THREE.Group();
        jaw.position.set(0, mb.max.y, FRONT > 0 ? mb.min.z : mb.max.z);
        wrap.add(jaw);
        jaw.add(mandible);
        mandible.position.sub(jaw.position);
      }

      // eyes: just behind the skin, in the orbits
      [-1, 1].forEach((side) => {
        const s = surface(new THREE.Vector3(side * h * 0.019, eyeY, FRONT * 4), new THREE.Vector3(0, 0, -FRONT));
        if (!s) return;
        const pivot = new THREE.Group();
        pivot.position.copy(s.point).add(new THREE.Vector3(0, 0, -FRONT * h * 0.012));
        if (FRONT < 0) pivot.rotation.y = Math.PI;
        const ball = new THREE.Mesh(new THREE.SphereGeometry(h * 0.0072, 40, 28), eyeMat);
        ball.rotation.y = 0;
        pivot.add(ball);
        creature.add(pivot);
        eyes.push(pivot);
      });

      // implants for ears, voice and memory, sewn onto the skin
      const at = (part: OrganId, rays: Array<[THREE.Vector3, THREE.Vector3]>, r: number) => {
        const list: THREE.Group[] = [];
        rays.forEach(([from, dir]) => {
          const s = surface(from, dir);
          if (!s) return;
          const imp = makeImplant(r);
          orientTo(imp, s.point, s.normal);
          creature.add(imp);
          list.push(imp);
        });
        implants.set(part, list);
        implantScale.set(part, 0);
      };
      const earY = wb.max.y - h * 0.075;
      at("ears", [
        [new THREE.Vector3(-3, earY, 0), new THREE.Vector3(1, 0, 0)],
        [new THREE.Vector3(3, earY, 0), new THREE.Vector3(-1, 0, 0)],
      ], 0.05);
      at("voice", [[new THREE.Vector3(0, wb.max.y - h * 0.16, FRONT * 3), new THREE.Vector3(0, 0, -FRONT)]], 0.055);
      at("memory", [[new THREE.Vector3(0, wb.max.y - h * 0.02, -FRONT * 3), new THREE.Vector3(0, -0.25, FRONT)]], 0.06);
      mouthLight.position.set(0, mouthY, FRONT * h * 0.05);
      // where the anatomy labels point
      const heartMesh = byName.heart;
      anchors.brain = new THREE.Vector3(0, wb.max.y - h * 0.045, 0);
      if (eyes[0]) anchors.eyes = eyes[0].position.clone();
      if (implants.get("ears")?.[0]) anchors.ears = implants.get("ears")![0].position.clone();
      if (implants.get("voice")?.[0]) anchors.voice = implants.get("voice")![0].position.clone();
      if (implants.get("memory")?.[0]) anchors.memory = implants.get("memory")![0].position.clone();
      if (heartMesh) anchors.heart = new THREE.Box3().setFromObject(heartMesh).getCenter(new THREE.Vector3());

      // electrodes on the temples, cabled to the coils
      [-1, 1].forEach((side, i) => {
        const s = surface(new THREE.Vector3(side * 3, wb.max.y - h * 0.055, FRONT * h * 0.02), new THREE.Vector3(-side, 0, 0));
        if (!s) return;
        const clamp = new THREE.Group();
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.04, 24), copper);
        clamp.add(pad);
        const term = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), terminalMat);
        term.position.y = 0.06;
        clamp.add(term);
        orientTo(clamp, s.point, s.normal);
        creature.add(clamp);
        const cable = new THREE.Mesh(new THREE.BufferGeometry(), cableMat);
        scene.add(cable);
        electrodes.push({ clamp, anchor: s.point.clone(), normal: s.normal.clone(), cable, tip: coilTips[i], detach: 0 });
      });

      // veins: raw floats from the build (x, y, z, distance from the heart), two vertices per segment
      fetch(VEINS_URL)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
        .then((buf) => {
          if (disposed) return;
          const f = new Float32Array(buf);
          const n = f.length / 4;
          const pos = new Float32Array(n * 3);
          const dist = new Float32Array(n);
          for (let i = 0; i < n; i++) {
            pos[i * 3] = f[i * 4];
            pos[i * 3 + 1] = f[i * 4 + 1];
            pos[i * 3 + 2] = f[i * 4 + 2];
            dist[i] = f[i * 4 + 3];
          }
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
          g.setAttribute("dist", new THREE.BufferAttribute(dist, 1));
          const lines = new THREE.LineSegments(g, veinMat);
          lines.frustumCulled = false;
          lines.renderOrder = 3; // after the skin, so the current shows through it
          wrap.add(lines);
        })
        .catch(() => {});
      start = performance.now();
    }

    const cableKey = new Map<Electrode, string>();
    function updateCable(e: Electrode, k: number) {
      // a sagging cable from the coil tip to the clamp; k < 1 while it is reeling in after detaching.
      // Rebuilding a tube is costly, so only do it when the cable's shape really changed.
      const key = `${k.toFixed(3)}|${e.clamp.position.x.toFixed(3)}|${e.clamp.position.y.toFixed(3)}`;
      if (cableKey.get(e) === key) return;
      cableKey.set(e, key);
      const a = e.tip.getWorldPosition(new THREE.Vector3());
      const b = e.clamp.getWorldPosition(new THREE.Vector3());
      const end = a.clone().lerp(b, k);
      const mid = a.clone().lerp(end, 0.5).add(new THREE.Vector3(0, -0.6 * k, 0.15));
      const curve = new THREE.QuadraticBezierCurve3(a, mid, end);
      e.cable.geometry.dispose();
      e.cable.geometry = new THREE.TubeGeometry(curve, 32, 0.018, 6, false);
      e.cable.visible = k > 0.02;
    }

    /* ───── lightning ───── */
    const boltGroup = new THREE.Group();
    scene.add(boltGroup);
    const boltCore = new THREE.LineBasicMaterial({ color: ARC_HOT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    let strikeUntil = 0;
    let nextRestrike = 0;
    function bolt(a: THREE.Vector3, b: THREE.Vector3, spread: number, depth: number, out: THREE.Vector3[][]) {
      const pts = [a.clone(), b.clone()];
      let s = spread;
      for (let d = 0; d < depth; d++) {
        for (let i = pts.length - 1; i > 0; i--) {
          const mid = pts[i - 1].clone().add(pts[i]).multiplyScalar(0.5);
          mid.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(s));
          pts.splice(i, 0, mid);
        }
        s *= 0.5;
      }
      out.push(pts);
    }
    function clearBolts() {
      boltGroup.children.forEach((c) => (c as THREE.Line).geometry.dispose());
      boltGroup.clear();
    }
    function drawBolts() {
      clearBolts();
      const lines: THREE.Vector3[][] = [];
      electrodes.forEach((e) => {
        const a = e.tip.getWorldPosition(new THREE.Vector3());
        const b = e.clamp.getWorldPosition(new THREE.Vector3());
        bolt(a, b, a.distanceTo(b) * 0.3, 6, lines);
      });
      lines.forEach((p) => boltGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), boltCore)));
    }

    /* ───── sizing and input ───── */
    let visible = true;
    const fit = () => {
      const w = Math.max(el.clientWidth, 1);
      const h = Math.max(el.clientHeight, 1);
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      bloom.setSize(w, h);
      camera.aspect = w / h;
      cam.dist = w / h < 0.8 ? 13.5 : 10.5;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    fit();

    /* ───── adaptive quality: start from a guess about the hardware, then follow the real frame rate ───── */
    const gl = renderer.getContext();
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const gpuName = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase();
    const nav = navigator as Navigator & { deviceMemory?: number };
    const mobile = /android|iphone|ipad|mobile/i.test(navigator.userAgent);
    let tier = 2;
    if (/swiftshader|llvmpipe|softpipe|software|basic render/.test(gpuName)) tier = 0;
    else if (mobile || (nav.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4) tier = 1;
    else if (/intel|uhd|iris|mali|adreno|powervr/.test(gpuName)) tier = 2;
    else if (/nvidia|geforce|rtx|gtx|radeon|rx |apple m/.test(gpuName)) tier = 3;
    const maxTier = Math.min(3, tier + 1);
    let useComposer = true;

    function applyTier(next: number) {
      tier = next;
      const dpr = [0.5, 0.85, 1.5, 2][tier];
      detail.value = tier >= 2 ? 1 : 0;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dpr));
      composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dpr));
      useComposer = tier >= 1;
      bloom.enabled = tier >= 1;
      const shadows = tier >= 2;
      if (renderer.shadowMap.enabled !== shadows) {
        renderer.shadowMap.enabled = shadows;
        key.castShadow = shadows;
        // materials compile differently with and without shadows
        scene.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
          (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => (x.needsUpdate = true));
        });
      }
      const size = tier >= 3 ? 2048 : 1024;
      if (key.shadow.mapSize.x !== size) {
        key.shadow.mapSize.set(size, size);
        key.shadow.map?.dispose();
        key.shadow.map = null;
      }
      dust.visible = tier >= 1;
      document.documentElement.dataset.quality = String(tier);
      fit();
    }
    applyTier(tier);
    loader.load(tier <= 1 ? BODY_LITE_URL : BODY_URL, (g) => !disposed && setup(g));
    let fpsFrames = 0;
    let fpsSince = performance.now();
    let lastChange = performance.now();
    let lastDrop = 0;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);
    const pointer = new THREE.Vector2();
    const onMove = (e: PointerEvent) => pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    window.addEventListener("pointermove", onMove);
    const orbit = { yaw: 0, pitch: 0, dragging: false, x: 0, y: 0 };
    canvas.style.touchAction = "pan-y";
    const down = (e: PointerEvent) => {
      Object.assign(orbit, { dragging: true, x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!orbit.dragging) return;
      orbit.yaw = THREE.MathUtils.clamp(orbit.yaw - (e.clientX - orbit.x) * 0.006, -1.2, 1.2);
      orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + (e.clientY - orbit.y) * 0.003, -0.12, 0.35);
      orbit.x = e.clientX;
      orbit.y = e.clientY;
    };
    const up = () => (orbit.dragging = false);
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    const toScreen = (obj: THREE.Object3D): Point => {
      const v = obj.getWorldPosition(new THREE.Vector3()).project(camera);
      const r = canvas.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    };
    api.current = {
      socket: (part) => {
        if (part === "eyes") return eyes[0] ? toScreen(eyes[0]) : null;
        if (part === "brain") return skin ? toScreen(eyes[0] ?? creature) : null;
        const l = implants.get(part);
        return l?.[0] ? toScreen(l[0]) : null;
      },
      strike: () =>
        new Promise<void>((resolve) => {
          if (reduce) return resolve();
          strikeUntil = performance.now() + 900;
          window.setTimeout(resolve, 950);
        }),
    };

    /* ───── frame loop ───── */
    let raf = 0;
    let aliveSince = 0;
    const sectionWeight: Record<string, number> = {};
    const camPos = new THREE.Vector3(0, 0.25, 10.5);
    const camLook = new THREE.Vector3(0, -0.3, 0);
    // allocated once: the frame loop creates no garbage, so there are no collector hiccups
    const SHOT_KEYS = [".lab", ".anatomy", ".vitals", ".how", ".end"];
    const shotPos = SHOT_KEYS.map(() => new THREE.Vector3());
    const shotTarget = SHOT_KEYS.map(() => new THREE.Vector3());
    const sectionEls = new Map<string, Element | null>();
    const want = new THREE.Vector3();
    const wantT = new THREE.Vector3();
    const off = new THREE.Vector3();
    const UP = new THREE.Vector3(0, 1, 0);
    const tmp = new THREE.Vector3();
    let pinEls: HTMLElement[] = [];
    let pinsShown = true;
    let flood = 0;
    let nextBlink = 0;
    let open = 0;
    const clock = new THREE.Clock();
    const look = new THREE.Vector2();

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const now = performance.now();
      const time = clock.elapsedTime;
      const { parts: p, alive: a, charging: ch, speaking: sp } = state.current;
      // the build waits behind the title screen, then starts the moment the visitor enters
      if (!state.current.entered) start = now;
      const t = skin ? (playIntro ? (now - start) / 1000 : 99) : 0;
      if (a && !aliveSince) aliveSince = now;
      if (!a) aliveSince = 0;
      const sinceAlive = aliveSince ? (now - aliveSince) / 1000 : 0;
      if (!reduce) look.lerp(pointer, 1 - Math.exp(-dt * 2.5));

      // camera: the page is a walk through the lab. Each section has a shot; scrolling blends between them.
      cam.closeUp += ((a ? 1 : 0) - cam.closeUp) * Math.min(dt * 0.6, 1);
      const narrow = camera.aspect < 0.8;
      const sx = narrow ? 0 : -1.5;
      const cu = cam.closeUp;
      const zFar = narrow ? 13.5 : 10.5;
      const zNear = narrow ? 6.5 : 5;
      shotPos[0].set(sx + (sx * 0.4 - sx) * cu, 0.25 + (bodyTop - 0.55) * cu, zFar + (zNear - zFar) * cu);
      shotTarget[0].set(sx + (sx * 0.4 - sx) * cu, -0.3 + (bodyTop - 0.25) * cu, 0);
      shotPos[1].set(narrow ? 2.6 : 3.4, 0.9, narrow ? 6.2 : 4.6);
      shotTarget[1].set(0, 0.35, 0);
      shotPos[2].set(-3.4, 0.5, 3.2);
      shotTarget[2].set(-6.7, 0.25, 1.2);
      shotPos[3].set(5, 4.6, narrow ? 15 : 11);
      shotTarget[3].set(0, -0.6, 0);
      shotPos[4].set(0, 1.2, narrow ? 22 : 18);
      shotTarget[4].set(0, 0.1, 0);
      const vh = window.innerHeight;
      let wsum = 0;
      want.set(0, 0, 0);
      wantT.set(0, 0, 0);
      SHOT_KEYS.forEach((sel, i) => {
        if (!sectionEls.get(sel)) sectionEls.set(sel, document.querySelector(sel));
        const node = sectionEls.get(sel);
        if (!node) return;
        const r = node.getBoundingClientRect();
        const d = Math.abs(r.top + Math.min(r.height, vh) / 2 - vh / 2) / vh;
        const w = Math.pow(Math.max(0, 1 - d * 1.5), 2);
        sectionWeight[sel] = w;
        want.addScaledVector(shotPos[i], w);
        wantT.addScaledVector(shotTarget[i], w);
        wsum += w;
      });
      if (wsum < 0.001) {
        want.copy(shotPos[0]);
        wantT.copy(shotTarget[0]);
      } else {
        want.multiplyScalar(1 / wsum);
        wantT.multiplyScalar(1 / wsum);
        Object.keys(sectionWeight).forEach((k) => (sectionWeight[k] /= wsum));
      }
      // ease toward the shot so scrolling feels like a dolly, not a jump
      const k = reduce ? 1 : 1 - Math.exp(-dt * 3);
      camPos.lerp(want, k);
      camLook.lerp(wantT, k);
      if (!orbit.dragging) {
        orbit.yaw *= 1 - Math.min(dt * 1.2, 1);
        orbit.pitch *= 1 - Math.min(dt * 1.2, 1);
      }
      // drag orbits around the current target; a slow drift keeps the room breathing
      const yawOff = orbit.yaw + (reduce ? 0 : Math.sin(time * 0.12) * 0.05);
      off.copy(camPos).sub(camLook);
      off.applyAxisAngle(UP, yawOff);
      off.y += orbit.pitch * off.length() * 0.6;
      camera.position.copy(camLook).add(off);
      camera.lookAt(camLook);

      // the room: storm and thunder outside, dust drifting, gauges settling
      stormUniforms.uTime.value = time;
      lamps.forEach((l, i) => {
        const f = reduce ? 1 : 0.85 + Math.sin(time * 9 + i * 3) * 0.06 + Math.sin(time * 23 + i) * 0.05 + (Math.random() - 0.5) * 0.06;
        l.light.intensity = 5 * f * (1 - (sectionWeight[".end"] ?? 0) * 0.6);
        l.flame.scale.set(1, 1.6 * f, 1);
      });
      if (!reduce && now > nextThunder) {
        stormUniforms.uFlash.value = 1;
        window.dispatchEvent(new CustomEvent("lab:thunder"));
        nextThunder = now + 5000 + Math.random() * 9000;
      }
      stormUniforms.uFlash.value *= Math.exp(-dt * 5);
      windowLight.intensity = stormUniforms.uFlash.value * 1.6;
      if (!reduce) dustTime.value = time;
      const showGauges = sectionWeight[".vitals"] ?? 0;
      needles.forEach((n) => {
        const goal = showGauges > 0.3 ? n.target : (120 * Math.PI) / 180;
        n.mesh.rotation.z += (goal - n.mesh.rotation.z) * Math.min(dt * 2.5, 1);
      });
      // the end: the lab goes dark except for the creature's light
      const endW = sectionWeight[".end"] ?? 0;
      key.intensity = 2.6 * (1 - endW * 0.7);
      rim.intensity = 2.2 * (1 - endW * 0.4);

      // anatomy labels follow their organs on screen
      const anatomyW = sectionWeight[".anatomy"] ?? 0;
      const pinOpacity = Math.max(0, (anatomyW - 0.35) / 0.65);
      if (!pinEls.length) pinEls = Array.from(document.querySelectorAll<HTMLElement>("[data-anchor]"));
      if (pinOpacity > 0 || pinsShown) {
        pinsShown = pinOpacity > 0;
        for (const label of pinEls) {
          const pt = anchors[label.dataset.anchor as string];
          if (!pt) continue;
          tmp.copy(pt).project(camera);
          const x = ((tmp.x + 1) / 2) * window.innerWidth;
          const y = ((1 - tmp.y) / 2) * window.innerHeight;
          label.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
          label.style.opacity = pinOpacity.toFixed(3);
        }
      }

      if (skin) {
        // the build: bones, then muscle, then skin, sweeping upward; then the seams are sewn
        const lo = FLOOR;
        const hi = bodyTop + 0.1;
        const sweep = (k: number) => (k >= 1 ? 99 : lo + (hi - lo) * k);
        bonesPlane.constant = sweep(phase(t, T.bones));
        musclePlane.constant = sweep(phase(t, T.muscle));
        skinPlane.constant = sweep(phase(t, T.skin));
        skinUniforms.uSeams.value = phase(t, T.seams);
        const kc = phase(t, T.cables);

        // electrodes: on through feeding and the run, off a moment after it wakes
        electrodes.forEach((e, i) => {
          const detachAt = 2.2 + i * 0.35;
          if (a && sinceAlive > detachAt && !e.detach) e.detach = now;
          if (!a) e.detach = 0;
          const k = e.detach ? 1 - ease((now - e.detach) / 900) : kc;
          if (e.detach) {
            // the clamp pops off the skin and falls away
            const u = (now - e.detach) / 1000;
            e.clamp.position.copy(e.anchor).addScaledVector(e.normal, u * 0.6);
            e.clamp.position.y -= 2.4 * u * u;
            e.clamp.visible = u < 0.9;
          } else {
            e.clamp.position.copy(e.anchor);
            e.clamp.visible = kc > 0.05;
          }
          e.clamp.scale.setScalar(Math.max(kc, 0.0001));
          updateCable(e, k);
        });

        implants.forEach((list, part) => {
          const cur = implantScale.get(part)!;
          const next = cur + ((p.has(part) ? 1 : 0) - cur) * (1 - Math.exp(-dt * 12));
          implantScale.set(part, next);
          list.forEach((g) => {
            g.scale.setScalar(Math.max(next, 0.0001));
            const core = g.getObjectByName("core") as THREE.Mesh;
            (core.material as THREE.MeshStandardMaterial).emissiveIntensity = a ? 2 : ch ? 1 + Math.random() * 1.4 : 0;
          });
        });

        // the brain lights up as soon as it is stitched in; fully once alive
        brainUniforms.uTime.value = time;
        brainUniforms.uBrain.value += ((p.has("brain") ? (a ? 1 : 0.25) : 0) - brainUniforms.uBrain.value) * Math.min(dt * 3, 1);

        // current floods the veins from the heart when the switch is thrown, then keeps pulsing
        flood = ch ? Math.min(flood + dt * 0.55, 0.6) : a ? Math.min(flood + dt * 0.7, 1.05) : 0;
        veinMat.uniforms.uFlood.value = flood;
        veinMat.uniforms.uTime.value = time;
        veinMat.uniforms.uIdle.value += ((a ? 1 : ch ? 0.6 : 0) - veinMat.uniforms.uIdle.value) * Math.min(dt * 2, 1);
        const beat = a ? Math.pow(Math.max(Math.sin(time * 6.0), 0), 12) + 0.6 * Math.pow(Math.max(Math.sin(time * 6.0 - 0.9), 0), 12) : 0;
        heartUniforms.uBeat.value = beat;

        // eyes: open once alive, follow the cursor, blink
        const hasEyes = p.has("eyes");
        let target = a && hasEyes ? 1 : 0;
        if (target && now > nextBlink) {
          if (now < nextBlink + 130) target = 0;
          else nextBlink = now + 2400 + Math.random() * 3800;
        }
        open += (target - open) * (1 - Math.exp(-dt * (target ? 9 : 22)));
        eyeMat.uniforms.uTime.value = time;
        eyeMat.uniforms.uPower.value = open * (0.85 + Math.random() * 0.25);
        eyes.forEach((e) => {
          e.visible = hasEyes;
          e.scale.set(1, Math.max(open, 0.08), 1);
          e.rotation.y = (FRONT < 0 ? Math.PI : 0) + look.x * 0.5;
          e.rotation.x = look.y * 0.35;
        });

        // body motion: head follows the cursor, chest breathes, jaw speaks
        motion.uLook.value.set(a && !reduce ? look.x : 0, a && !reduce ? look.y : 0);
        motion.uBreath.value = a && !reduce ? Math.sin(time * 1.4) : 0;
        const syl = Math.abs(Math.sin(time * 10.5)) * (0.55 + 0.45 * Math.sin(time * 3.3 + 1.3));
        motion.uJaw.value += ((sp && p.has("voice") ? 0.25 + syl * 0.75 : 0) - motion.uJaw.value) * Math.min(dt * 18, 1);
        if (jaw) jaw.rotation.x = motion.uJaw.value * 0.14 * FRONT;
        mouthLight.intensity = motion.uJaw.value * 2.2;
      }

      // power: coils hot during the run, cooling once the electrodes are off
      const powered = ch || (a && sinceAlive < 3.4);
      copper.color.lerp(powered ? COPPER_HOT : COPPER_DULL, 1 - Math.exp(-dt * 4));
      copper.emissiveIntensity += ((ch ? 0.5 + Math.random() * 0.4 : powered ? 0.2 : 0) - copper.emissiveIntensity) * Math.min(dt * 6, 1);
      tipMat.emissiveIntensity = ch ? 2 + Math.random() * 3 : powered ? 1 : 0;
      terminalMat.emissiveIntensity = ch ? 2 + Math.random() * 2 : powered ? 1.2 : 0;

      if (now < strikeUntil) {
        if (now > nextRestrike) {
          drawBolts();
          nextRestrike = now + 110 + Math.random() * 80;
          strikeLight.intensity = 34;
        }
        strikeLight.intensity *= 0.86;
      } else if (boltGroup.children.length) {
        strikeLight.intensity *= 0.8;
        boltCore.opacity *= 0.8;
        if (boltCore.opacity < 0.02) {
          clearBolts();
          boltCore.opacity = 1;
        }
      }

      if (useComposer) composer.render();
      else renderer.render(scene, camera);

      // every two seconds: drop a tier if it is struggling, climb back slowly if there is headroom
      fpsFrames++;
      if (now - fpsSince > 2000) {
        const fps = (fpsFrames * 1000) / (now - fpsSince);
        fpsFrames = 0;
        fpsSince = now;
        if (fps < 42 && tier > 0 && now - lastChange > 2500) {
          applyTier(tier - 1);
          lastChange = lastDrop = now;
        } else if (fps > 58 && tier < maxTier && now - lastChange > 8000 && now - lastDrop > 25000) {
          applyTier(tier + 1);
          lastChange = now;
        }
      }
    };
    frame();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      draco.dispose();
      pmrem.dispose();
      composer.dispose();
      renderer.dispose();
      el.removeChild(canvas);
    };
  }, []);

  return (
    <div
      ref={host}
      className="creature3d creature3d--body"
      role="img"
      aria-label={`The creature standing between two Tesla coils, with ${parts.size} of 5 parts stitched${alive ? ", alive" : ""}. Drag to look around.`}
    />
  );
});

export default CreatureBody;
