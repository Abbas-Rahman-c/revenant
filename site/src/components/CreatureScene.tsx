import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { OrganId } from "../organs";

/*
 * The whole lab in one 3D scene: a scanned human head ("Infinite, 3D Head Scan" by Lee Perry-Smith,
 * CC BY 3.0) on a slab between two Tesla coils. Electricity glows through a bloom pass; everything
 * else stays cold and grey. An optional MakeHuman body (CC0) is stitched on when present.
 */

export type Point = { x: number; y: number };

const HEAD_URL = "/models/head-scan/LeePerrySmith.glb";
const TEX = "/models/head-scan/";
const BODY_URL = "/models/creature-body.glb";

const BG = new THREE.Color("#2b2a2e");
const ARC = new THREE.Color("#9fc2ff");
const ARC_HOT = new THREE.Color("#e6f0ff");
const COPPER_DULL = new THREE.Color("#5c3d26");
const COPPER_HOT = new THREE.Color("#e0995a");

type Ray = { from: THREE.Vector3; dir: THREE.Vector3 };
const R = (fx: number, fy: number, fz: number, dx: number, dy: number, dz: number): Ray => ({
  from: new THREE.Vector3(fx, fy, fz),
  dir: new THREE.Vector3(dx, dy, dz),
});

/** Where each part attaches: a ray cast at the head from outside, in normalized head-box coords. */
const ANCHORS: Record<Exclude<OrganId, "eyes">, Ray[]> = {
  brain: [R(0, 1.25, 1.2, 0, -0.75, -1)],
  ears: [R(-1.4, 0.665, -0.12, 1, 0, 0), R(1.4, 0.665, -0.12, -1, 0, 0)],
  memory: [R(1.4, 0.86, -0.4, -1, -0.12, 0.2)],
  voice: [R(0.32, 0.36, 1.4, -0.35, 0.12, -1)],
};
const TEMPLES = [R(-1.4, 0.76, 0.22, 1, 0, 0), R(1.4, 0.76, 0.22, -1, 0, 0)];
const EYES = [R(-0.19, 0.713, 1.4, 0, 0, -1), R(0.19, 0.713, 1.4, 0, 0, -1)];
/** Height of the lip line, as a fraction of the head box. */
const MOUTH_Y = 0.605;

/* Eyes made of electricity: a dark wet eyeball, a plasma iris and veins that crackle like neurons. */
const EYE_VERT = /* glsl */ `
  varying vec3 vLocal;
  varying vec3 vViewNormal;
  void main() {
    vLocal = normalize(position);
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const EYE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uPower;
  varying vec3 vLocal;
  varying vec3 vViewNormal;

  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }

  void main() {
    vec3 n = vLocal;
    float t = uTime;
    // crackling veins: thin ridges of noise that drift like current
    float ridge = 1.0 - abs(fbm(n * 5.0 + vec3(0.0, t * 0.6, t * 0.3)) * 2.0 - 1.0);
    float veins = pow(ridge, 14.0) * smoothstep(0.75, 0.2, n.z);
    // the iris faces +z: swirling plasma, brighter toward the pupil
    float irisMask = smoothstep(0.80, 0.84, n.z);
    float plasma = fbm(n * 9.0 + vec3(t * 1.4, -t * 0.9, 0.0));
    float rings = 0.5 + 0.5 * sin(acos(clamp(n.z, -1.0, 1.0)) * 70.0 - t * 6.0);
    float pupil = smoothstep(0.972, 0.965, n.z);
    vec3 arc = vec3(0.62, 0.76, 1.0);
    vec3 hot = vec3(0.92, 0.96, 1.0);
    vec3 sclera = vec3(0.07, 0.07, 0.09) + vec3(0.18, 0.05, 0.06) * smoothstep(0.4, 0.9, fbm(n * 3.0));
    vec3 col = sclera + arc * veins * 3.0 * uPower;
    vec3 iris = mix(arc * 0.6, hot, plasma) * (1.2 + rings * 0.8) * uPower;
    col = mix(col, iris, irisMask);
    col = mix(col, vec3(0.01), irisMask * (1.0 - pupil) * 0.95);
    col += hot * smoothstep(0.995, 0.999, n.z) * 2.0 * uPower; // a hot spark at the center of the pupil
    // a wet highlight
    float spec = pow(max(dot(normalize(vViewNormal), normalize(vec3(-0.4, 0.5, 1.0))), 0.0), 60.0);
    col += vec3(spec) * 0.6;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Build timeline in seconds (kept in step with BUILD_MS in Lab.tsx). */
const T = { wire: [0, 1.1], muscle: [0.8, 2.0], skin: [1.6, 3.0], seam: [2.9, 3.4], clamps: [3.3, 3.7], marks: [3.5, 3.9] };

export type CreatureSceneHandle = {
  /** Screen position of a part's socket, for the jar-to-body flight. */
  socket(part: OrganId): Point | null;
  /** Lightning from both coils to the temple clamps. Resolves when the bolts fade. */
  strike(): Promise<void>;
};

type Props = {
  parts: Set<OrganId>;
  alive: boolean;
  charging: boolean;
  intro: boolean;
  /** True while the creature is speaking: drives the jaw and the light in its mouth. */
  speaking: boolean;
};

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const ease = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const phase = (t: number, [a, b]: number[]) => ease((t - a) / (b - a));

/** Midpoint displacement in 3D: split, push the midpoint sideways, halve the push, repeat. */
function boltPoints(a: THREE.Vector3, b: THREE.Vector3, spread: number, depth: number, out: THREE.Vector3[][]) {
  const pts: THREE.Vector3[] = [a.clone(), b.clone()];
  let s = spread;
  for (let d = 0; d < depth; d++) {
    for (let i = pts.length - 1; i > 0; i--) {
      const p = pts[i - 1];
      const q = pts[i];
      const mid = p.clone().add(q).multiplyScalar(0.5);
      mid.add(new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s));
      pts.splice(i, 0, mid);
      if (d >= 2 && Math.random() < 0.12) {
        const dir = q.clone().sub(p).normalize();
        const off = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        const end = mid.clone().addScaledVector(dir.add(off).normalize(), p.distanceTo(q) * (0.8 + Math.random()));
        boltPoints(mid, end, s * 0.5, depth - d - 1, out);
      }
    }
    s *= 0.5;
  }
  out.push(pts);
}

export const CreatureScene = forwardRef<CreatureSceneHandle, Props>(function CreatureScene(
  { parts, alive, charging, intro, speaking },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef({ parts, alive, charging, speaking });
  state.current = { parts, alive, charging, speaking };
  const api = useRef<CreatureSceneHandle>({ socket: () => null, strike: async () => {} });

  useImperativeHandle(ref, () => ({
    socket: (p) => api.current.socket(p),
    strike: () => api.current.strike(),
  }));

  useEffect(() => {
    const el = host.current!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const playIntro = intro && !reduce;

    /* ───── renderer, camera, post-processing ───── */
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.localClippingEnabled = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = BG;
    scene.fog = new THREE.Fog(BG, 7, 15);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.28;

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    const camTarget = new THREE.Vector3(0, -0.35, 0);
    const camBase = { yaw: 0, pitch: 0.06, dist: 7.3 };

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.8, 0.5, 0.88);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    /* ───── lights: one cold key, a blue rim, almost no fill ───── */
    const key = new THREE.DirectionalLight("#f2efe8", 2.8);
    key.position.set(-3, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    scene.add(key);
    const rim = new THREE.DirectionalLight("#8fb3ff", 1.8);
    rim.position.set(3, 2.5, -4);
    scene.add(rim);
    scene.add(new THREE.HemisphereLight("#cfd6e6", "#16141a", 0.22));
    const strikeLight = new THREE.PointLight(ARC_HOT, 0, 9, 1.6);
    strikeLight.position.set(0, 1.6, 0.6);
    scene.add(strikeLight);

    /* ───── the room: floor, slab, coils ───── */
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(14, 64),
      new THREE.MeshStandardMaterial({ color: "#232226", roughness: 0.92, metalness: 0.0 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.15;
    floor.receiveShadow = true;
    scene.add(floor);

    const stone = new THREE.MeshStandardMaterial({ color: "#3a3940", roughness: 0.85, metalness: 0.05 });
    const slab = new THREE.Mesh(new RoundedBoxGeometry(3.0, 0.32, 1.6, 4, 0.06), stone);
    slab.position.set(0, -1.6, -0.1);
    slab.castShadow = slab.receiveShadow = true;
    scene.add(slab);
    const legGeo = new THREE.BoxGeometry(0.22, 0.42, 0.22);
    [-1.25, 1.25].forEach((x) =>
      [-0.6, 0.45].forEach((z) => {
        const leg = new THREE.Mesh(legGeo, stone);
        leg.position.set(x, -1.95, z - 0.1);
        leg.castShadow = true;
        scene.add(leg);
      }),
    );

    const copper = new THREE.MeshStandardMaterial({ color: COPPER_DULL, metalness: 0.95, roughness: 0.34, emissive: COPPER_HOT, emissiveIntensity: 0 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: "#2a292e", metalness: 0.75, roughness: 0.42 });
    const porcelain = new THREE.MeshStandardMaterial({ color: "#d8d4ca", roughness: 0.25, metalness: 0.0 });
    const polished = new THREE.MeshStandardMaterial({ color: "#8a8890", metalness: 0.9, roughness: 0.32 });
    const coilTips: THREE.Mesh[] = [];
    const tipMat = new THREE.MeshStandardMaterial({ color: "#8a8890", metalness: 1, roughness: 0.2, emissive: ARC, emissiveIntensity: 0 });

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
      // the copper winding: a helix of wire around the core
      const turns = 46;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= turns * 24; i++) {
        const t = i / (turns * 24);
        const a = t * turns * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * 0.185, 0.97 + t * 2.0, Math.sin(a) * 0.185));
      }
      const wind = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, 0.012, 6, false), copper);
      g.add(wind);
      const torus = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.12, 24, 64), polished);
      torus.rotation.x = Math.PI / 2;
      torus.position.y = 3.12;
      g.add(torus);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 16), tipMat);
      tip.position.y = 3.32;
      g.add(tip);
      coilTips.push(tip);
      g.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
      });
      g.position.set(x, -2.15, -0.5);
      g.scale.setScalar(0.8);
      scene.add(g);
      return g;
    }
    const coils = [makeCoil(-1.72), makeCoil(1.72)];

    /* ───── the creature ───── */
    const creature = new THREE.Group();
    scene.add(creature);

    // clipping planes that sweep upward during the build (they keep everything below y)
    const wirePlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), playIntro ? -3 : 3);
    const musclePlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), playIntro ? -3 : 3);
    const skinPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), playIntro ? -3 : 3);

    const scanline = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 0.01, 72, 1, true),
      new THREE.MeshBasicMaterial({ color: ARC_HOT, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }),
    );
    creature.add(scanline);

    const loader = new GLTFLoader();
    const tl = new THREE.TextureLoader();
    let disposed = false;
    let head: THREE.Mesh | null = null;
    let wire: THREE.Mesh | null = null;
    let muscle: THREE.Mesh | null = null;
    let headBox = new THREE.Box3();
    const raycaster = new THREE.Raycaster();

    const implants = new Map<OrganId, THREE.Group[]>();
    const implantScale = new Map<OrganId, number>();
    const marks: THREE.Mesh[] = [];
    const clamps: THREE.Group[] = [];
    const terminals: THREE.Mesh[] = [];
    const eyeGlows: THREE.Object3D[] = [];
    let seam: THREE.Mesh | null = null;
    let seamStitches: THREE.InstancedMesh | null = null;

    /* the face's moving parts: eyelids that pull back, a jaw that swings, lips that part */
    const face = {
      uEyeL: { value: new THREE.Vector3(-9, -9, -9) },
      uEyeR: { value: new THREE.Vector3(9, -9, -9) },
      uOpen: { value: 0 },
      uJaw: { value: 0 },
      uJawPivot: { value: new THREE.Vector3(0, -9, 0) },
      uMouth: { value: new THREE.Vector3(0, -9, 0) },
      uArc: { value: ARC.clone() },
    };
    const eyeMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPower: { value: 0 } },
      vertexShader: EYE_VERT,
      fragmentShader: EYE_FRAG,
    });
    const mouthLight = new THREE.PointLight(ARC, 0, 0.9, 2);
    creature.add(mouthLight);

    const threadMat = new THREE.MeshStandardMaterial({ color: "#3a1715", roughness: 0.8 });
    const markMat = new THREE.MeshBasicMaterial({ color: "#241a19", transparent: true, opacity: 0, depthWrite: false });
    const terminalMat = new THREE.MeshStandardMaterial({ color: "#6e6c74", metalness: 0.8, roughness: 0.3, emissive: ARC, emissiveIntensity: 0 });

    function hit(ray: Ray) {
      if (!head) return null;
      const size = headBox.getSize(new THREE.Vector3());
      const c = headBox.getCenter(new THREE.Vector3());
      const origin = new THREE.Vector3(c.x + ray.from.x * size.x * 0.5, headBox.min.y + ray.from.y * size.y, c.z + ray.from.z * size.z * 0.5);
      raycaster.set(origin, ray.dir.clone().normalize());
      const h = raycaster.intersectObject(head, false)[0];
      if (!h || !h.face) return null;
      const n = h.face.normal.clone().transformDirection(head.matrixWorld);
      if (n.dot(ray.dir) > 0) n.negate();
      return { point: h.point.clone(), normal: n };
    }

    function orientTo(obj: THREE.Object3D, point: THREE.Vector3, normal: THREE.Vector3) {
      obj.position.copy(point);
      obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    }

    function stitchRing(radius: number, count: number) {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.006, 6, 48), threadMat);
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      const stitch = new THREE.BoxGeometry(0.008, 0.008, radius * 0.5);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const s = new THREE.Mesh(stitch, threadMat);
        s.position.set(Math.cos(a) * radius, 0.004, Math.sin(a) * radius);
        s.rotation.y = -a;
        g.add(s);
      }
      return g;
    }

    function makeImplant(r: number) {
      const g = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, 0.035, 40), darkMetal);
      disc.position.y = -0.004;
      g.add(disc);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.15, 12, 48), copper);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.012;
      g.add(rim);
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.36, r * 0.36, 0.04, 24),
        new THREE.MeshStandardMaterial({ color: "#3a3940", emissive: ARC, emissiveIntensity: 0, metalness: 0.3, roughness: 0.3 }),
      );
      core.position.y = 0.012;
      core.name = "core";
      g.add(core);
      g.add(stitchRing(r * 1.35, 14));
      g.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
      });
      g.scale.setScalar(0.0001);
      return g;
    }

    function placeParts() {
      if (!head) return;
      (Object.keys(ANCHORS) as Array<keyof typeof ANCHORS>).forEach((part) => {
        const list: THREE.Group[] = [];
        ANCHORS[part].forEach((a) => {
          const h = hit(a);
          if (!h) return;
          const r = part === "ears" ? 0.1 : 0.12;
          const imp = makeImplant(r);
          orientTo(imp, h.point, h.normal);
          creature.add(imp);
          list.push(imp);
          const holder = new THREE.Group();
          orientTo(holder, h.point.clone().addScaledVector(h.normal, 0.004), h.normal);
          const mark = new THREE.Mesh(new THREE.RingGeometry(r * 1.2, r * 1.28, 40), markMat);
          mark.rotation.x = -Math.PI / 2;
          holder.add(mark);
          creature.add(holder);
          marks.push(mark);
        });
        implants.set(part, list);
        implantScale.set(part, 0);
      });

      TEMPLES.forEach((a) => {
        const h = hit(a);
        if (!h) return;
        const g = new THREE.Group();
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.05, 24), copper);
        pad.position.y = 0.015;
        g.add(pad);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 12), copper);
        rod.position.y = 0.12;
        g.add(rod);
        const term = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 14), terminalMat);
        term.position.y = 0.23;
        g.add(term);
        g.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
        });
        orientTo(g, h.point, h.normal);
        creature.add(g);
        clamps.push(g);
        terminals.push(term);
      });

      // eyes made of electricity, sitting just behind the closed lids
      EYES.forEach((a, i) => {
        const h = hit(a);
        if (!h) return;
        const center = h.point.clone().add(new THREE.Vector3(0, 0, -0.058));
        (i === 0 ? face.uEyeL : face.uEyeR).value.copy(center);
        const pivot = new THREE.Group();
        pivot.position.copy(center);
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.062, 48, 32), eyeMat);
        pivot.add(ball);
        creature.add(pivot);
        eyeGlows.push(pivot);
      });

      // the mouth: a lip line to part, and a jaw hinge to swing from
      const mouth = hit(R(0, MOUTH_Y, 1.4, 0, 0, -1));
      if (mouth) {
        face.uMouth.value.set(mouth.point.x, mouth.point.y, mouth.point.z);
        face.uJawPivot.value.set(0, headBox.min.y + (headBox.max.y - headBox.min.y) * 0.66, mouth.point.z - 0.42);
        mouthLight.position.copy(mouth.point).add(new THREE.Vector3(0, 0, -0.04));
      }

      // the seam where the head was sewn on: rays from all round the neck find its real surface
      const c = headBox.getCenter(new THREE.Vector3());
      const neckY = headBox.min.y + (headBox.max.y - headBox.min.y) * 0.3;
      const ringPts: THREE.Vector3[] = [];
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        const dir = new THREE.Vector3(-Math.cos(a), -0.08, -Math.sin(a));
        raycaster.set(new THREE.Vector3(c.x + Math.cos(a) * 2, neckY + 0.16, c.z + Math.sin(a) * 2), dir.normalize());
        const h = raycaster.intersectObject(head, false)[0];
        if (h && h.face) {
          const n = h.face.normal.clone().transformDirection(head.matrixWorld);
          ringPts.push(h.point.clone().addScaledVector(n, 0.006));
        }
      }
      if (ringPts.length > 20) {
        const curve = new THREE.CatmullRomCurve3(ringPts, true);
        seam = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.007, 6, true), threadMat);
        creature.add(seam);
        const count = 34;
        seamStitches = new THREE.InstancedMesh(new THREE.BoxGeometry(0.009, 0.06, 0.009), threadMat, count);
        const m = new THREE.Matrix4();
        const upV = new THREE.Vector3(0, 1, 0);
        for (let i = 0; i < count; i++) {
          const p = curve.getPointAt(i / count);
          const tangent = curve.getTangentAt(i / count);
          const q = new THREE.Quaternion().setFromUnitVectors(upV, upV.clone().sub(tangent.multiplyScalar(upV.dot(tangent))).normalize());
          m.compose(p, q, new THREE.Vector3(1, 1, 1));
          seamStitches.setMatrixAt(i, m);
        }
        creature.add(seamStitches);
        seam.visible = seamStitches.visible = !playIntro;
      }
    }

    loader.load(HEAD_URL, (gltf) => {
      if (disposed) return;
      let found: THREE.Mesh | null = null;
      gltf.scene.traverse((o) => {
        if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh;
      });
      if (!found) return;
      const geo = (found as THREE.Mesh).geometry;
      geo.computeBoundingBox();
      // normalize: about 2.1 units tall, centered, sitting on the slab
      const b = geo.boundingBox!;
      const s = 2.1 / b.getSize(new THREE.Vector3()).y;
      geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
      geo.scale(s, s, s);
      geo.translate(0, -1.44, 0);
      geo.computeBoundingBox();
      geo.computeVertexNormals();

      const col = tl.load(TEX + "Map-COL.jpg");
      col.colorSpace = THREE.SRGBColorSpace;
      col.flipY = false;
      col.anisotropy = 8;
      const spec = tl.load(TEX + "Map-SPEC.jpg");
      spec.flipY = false;
      const nrm = tl.load(TEX + "Infinite-Level_02_Tangent_SmoothUV.jpg");
      nrm.flipY = false;

      const skin = new THREE.MeshPhysicalMaterial({
        map: col,
        color: "#e4ddd8", // slightly pale, the cold light does the rest
        normalMap: nrm,
        normalScale: new THREE.Vector2(1, 1),
        roughness: 0.56,
        specularIntensityMap: spec,
        specularIntensity: 0.75,
        sheen: 0.1,
        sheenColor: new THREE.Color("#b88f84"),
        sheenRoughness: 0.6,
        clippingPlanes: [skinPlane],
      });
      // deform the scan in the vertex shader: lids recede into the sockets, the jaw drops, lips part
      skin.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, face);
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            `#include <common>
            uniform vec3 uEyeL; uniform vec3 uEyeR; uniform float uOpen;
            uniform float uJaw; uniform vec3 uJawPivot; uniform vec3 uMouth;
            varying float vMouth;
            vec3 lid(vec3 p, vec3 eye) {
              vec2 d = (p.xy - eye.xy) / vec2(0.105, 0.06);
              float r = length(d);
              float f = (1.0 - smoothstep(0.5, 1.0, r)) * step(eye.z - 0.02, p.z);
              p.z -= f * uOpen * 0.078;
              p.y += sign(p.y - eye.y) * f * uOpen * 0.026 * (1.0 - r * 0.6);
              return p;
            }`,
          )
          .replace(
            "#include <begin_vertex>",
            `vec3 transformed = vec3(position);
            transformed = lid(transformed, uEyeL);
            transformed = lid(transformed, uEyeR);
            float below = smoothstep(uMouth.y + 0.004, uMouth.y - 0.05, transformed.y);
            float front = smoothstep(uJawPivot.z + 0.12, uJawPivot.z + 0.36, transformed.z);
            float side = 1.0 - smoothstep(0.2, 0.36, abs(transformed.x));
            float neck = smoothstep(uMouth.y - 0.34, uMouth.y - 0.2, transformed.y);
            float ang = uJaw * 0.2 * below * front * side * neck;
            vec2 yz = transformed.yz - uJawPivot.yz;
            transformed.yz = uJawPivot.yz + vec2(cos(ang) * yz.x - sin(ang) * yz.y, sin(ang) * yz.x + cos(ang) * yz.y);
            vMouth = (1.0 - smoothstep(0.004, 0.02, abs(position.y - uMouth.y)))
                   * (1.0 - smoothstep(0.05, 0.085, abs(position.x - uMouth.x)))
                   * step(uMouth.z - 0.08, position.z);`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", "#include <common>\nuniform float uJaw; uniform vec3 uArc; varying float vMouth;")
          // the scan's painted lips and eyelid marks are flat red: drain them to a cold, bloodless tone
          .replace(
            "#include <map_fragment>",
            `#include <map_fragment>
            float redness = clamp((diffuseColor.r - max(diffuseColor.g, diffuseColor.b)) * 5.0 - 0.55, 0.0, 1.0);
            float grey = dot(diffuseColor.rgb, vec3(0.3, 0.45, 0.25));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(grey) * vec3(1.02, 0.92, 0.96), redness * 0.85);`,
          )
          .replace(
            "#include <dithering_fragment>",
            `#include <dithering_fragment>
            float m = vMouth * clamp(uJaw * 1.8, 0.0, 1.0);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.015, 0.015, 0.02) + uArc * uJaw * 0.9, m);`,
          );
      };
      head = new THREE.Mesh(geo, skin);
      head.castShadow = true;
      head.receiveShadow = true;
      creature.add(head);

      wire = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color: "#cfe0ff", wireframe: true, transparent: true, opacity: 0.4, clippingPlanes: [wirePlane], depthWrite: false }),
      );
      muscle = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: "#6e2620", roughness: 0.4, normalMap: nrm, normalScale: new THREE.Vector2(2.4, 2.4), clippingPlanes: [musclePlane] }),
      );
      muscle.scale.setScalar(0.995);
      wire.scale.setScalar(1.003);
      creature.add(wire, muscle);
      wire.visible = muscle.visible = playIntro;

      head.updateMatrixWorld(true);
      headBox = new THREE.Box3().setFromObject(head);
      placeParts();
      start = performance.now();
    });

    // optional body from MakeHuman: only loaded if the file really exists
    fetch(BODY_URL, { method: "HEAD" })
      .then((r) => {
        const type = r.headers.get("content-type") ?? "";
        if (!r.ok || type.includes("text/html")) return;
        loader.load(BODY_URL, (gltf) => {
          if (disposed) return;
          const body = gltf.scene;
          const box = new THREE.Box3().setFromObject(body);
          const sc = 5.6 / box.getSize(new THREE.Vector3()).y;
          body.scale.setScalar(sc);
          box.setFromObject(body);
          body.position.set(-(box.min.x + box.max.x) / 2, -1.44 - (box.max.y - box.min.y) * 0.86, -(box.min.z + box.max.z) / 2);
          body.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = mesh.receiveShadow = true;
            const mm = mesh.material as THREE.MeshStandardMaterial;
            if (mm) mm.clippingPlanes = [skinPlane];
          });
          creature.add(body);
        });
      })
      .catch(() => {});

    /* ───── 3D lightning ───── */
    const boltGroup = new THREE.Group();
    scene.add(boltGroup);
    const boltCore = new THREE.LineBasicMaterial({ color: ARC_HOT, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const boltGlow = new THREE.LineBasicMaterial({ color: ARC, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
    let strikeUntil = 0;

    function clearBolts() {
      boltGroup.children.forEach((c) => (c as THREE.Line).geometry.dispose());
      boltGroup.clear();
    }

    function drawBolts() {
      clearBolts();
      const lines: THREE.Vector3[][] = [];
      coilTips.forEach((tip, i) => {
        const target = terminals[i] ?? terminals[0];
        if (!target) return;
        const a = tip.getWorldPosition(new THREE.Vector3());
        const b = target.getWorldPosition(new THREE.Vector3());
        boltPoints(a, b, a.distanceTo(b) * 0.38, 6, lines);
      });
      lines.forEach((pts) => {
        boltGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), boltCore));
        const offset = pts.map((p) => p.clone().add(new THREE.Vector3(0.006, 0.006, 0)));
        boltGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(offset), boltGlow));
      });
    }

    /* ───── sizing, visibility, input ───── */
    let visible = true;
    const fit = () => {
      const w = Math.max(el.clientWidth, 1);
      const h = Math.max(el.clientHeight, 1);
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      bloom.setSize(w, h);
      camera.aspect = w / h;
      // keep the whole set in frame on narrow screens
      camBase.dist = w / h < 0.8 ? 9.4 : 7.3;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    fit();
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);

    const pointer = new THREE.Vector2();
    const onMove = (e: PointerEvent) => {
      pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove);

    // drag to look around the set; it eases back when released
    const orbit = { yaw: 0, pitch: 0, dragging: false, lastX: 0, lastY: 0 };
    const canvas = renderer.domElement;
    canvas.style.touchAction = "pan-y";
    const down = (e: PointerEvent) => {
      orbit.dragging = true;
      orbit.lastX = e.clientX;
      orbit.lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!orbit.dragging) return;
      orbit.yaw = THREE.MathUtils.clamp(orbit.yaw - (e.clientX - orbit.lastX) * 0.006, -0.7, 0.7);
      orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + (e.clientY - orbit.lastY) * 0.003, -0.12, 0.3);
      orbit.lastX = e.clientX;
      orbit.lastY = e.clientY;
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
        if (part === "eyes") {
          if (eyeGlows.length < 2) return null;
          const a = toScreen(eyeGlows[0]);
          const b = toScreen(eyeGlows[1]);
          return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        }
        const list = implants.get(part);
        return list?.[0] ? toScreen(list[0]) : null;
      },
      strike: () =>
        new Promise<void>((resolve) => {
          if (reduce) return resolve();
          strikeUntil = performance.now() + 820;
          window.setTimeout(resolve, 860);
        }),
    };

    /* ───── frame loop ───── */
    let start = performance.now();
    let raf = 0;
    let nextRestrike = 0;
    let nextBlink = 0;
    const clock = new THREE.Clock();
    const look = new THREE.Vector2();

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const now = performance.now();
      const time = clock.elapsedTime;
      const t = playIntro && head ? (now - start) / 1000 : head ? 99 : 0;
      const { parts: p, alive: a, charging: ch, speaking: sp } = state.current;
      if (!reduce) look.lerp(pointer, 1 - Math.exp(-dt * 2.5));

      // camera: user orbit plus a slow drift, so the set always feels like a real space
      if (!orbit.dragging) {
        orbit.yaw *= 1 - Math.min(dt * 1.5, 1);
        orbit.pitch *= 1 - Math.min(dt * 1.5, 1);
      }
      const drift = reduce ? 0 : Math.sin(time * 0.15) * 0.08;
      const yaw = camBase.yaw + orbit.yaw + drift;
      const pitch = camBase.pitch + orbit.pitch;
      camera.position.set(
        Math.sin(yaw) * Math.cos(pitch) * camBase.dist,
        camTarget.y + Math.sin(pitch) * camBase.dist + 0.3,
        Math.cos(yaw) * Math.cos(pitch) * camBase.dist,
      );
      camera.lookAt(camTarget);

      if (head) {
        // build sweep
        const top = headBox.max.y + 0.05;
        const bottom = headBox.min.y - 0.4;
        const sweep = (k: number) => bottom + (top - bottom) * k;
        const kw = phase(t, T.wire);
        const km = phase(t, T.muscle);
        const ks = phase(t, T.skin);
        wirePlane.constant = sweep(kw);
        musclePlane.constant = sweep(km);
        skinPlane.constant = ks >= 1 ? 10 : sweep(ks);
        if (wire && muscle) wire.visible = muscle.visible = t < T.skin[1] + 0.2;
        const scanning = t > T.wire[0] && t < T.skin[1];
        scanline.position.y = ks > 0 && ks < 1 ? sweep(ks) : kw < 1 ? sweep(kw) : sweep(km);
        const sm = scanline.material as THREE.MeshBasicMaterial;
        sm.opacity = scanning ? 1 : Math.max(0, sm.opacity - dt * 3);
        const kseam = phase(t, T.seam);
        if (seam && seamStitches) {
          seam.visible = seamStitches.visible = kseam > 0;
          seamStitches.count = Math.round(34 * kseam);
        }
        const kc = phase(t, T.clamps);
        clamps.forEach((c) => c.scale.setScalar(Math.max(kc, 0.0001)));
        const kmk = phase(t, T.marks);

        implants.forEach((list, part) => {
          const target = p.has(part) ? 1 : 0;
          const cur = implantScale.get(part)!;
          const next = cur + (target - cur) * (1 - Math.exp(-dt * 12));
          implantScale.set(part, next);
          list.forEach((g) => {
            g.scale.setScalar(Math.max(next, 0.0001));
            const core = g.getObjectByName("core") as THREE.Mesh;
            (core.material as THREE.MeshStandardMaterial).emissiveIntensity = a ? 2.2 : ch ? 1 + Math.random() * 1.5 : 0;
          });
        });
        marks.forEach((m) => ((m.material as THREE.MeshBasicMaterial).opacity = 0.6 * kmk));

        // eyes: shut until it lives, then open, follow the cursor and blink
        const hasEyes = p.has("eyes");
        let openTarget = a && hasEyes ? 1 : 0;
        if (openTarget && now > nextBlink) {
          if (now < nextBlink + 130) openTarget = 0;
          else nextBlink = now + 2400 + Math.random() * 3800;
        }
        face.uOpen.value += (openTarget - face.uOpen.value) * (1 - Math.exp(-dt * (openTarget ? 9 : 22)));
        eyeMat.uniforms.uTime.value = time;
        eyeMat.uniforms.uPower.value += ((a && hasEyes ? 0.85 + Math.random() * 0.3 : 0) - eyeMat.uniforms.uPower.value) * Math.min(dt * 6, 1);
        eyeGlows.forEach((g) => {
          g.visible = hasEyes;
          g.rotation.y += (look.x * 0.5 - g.rotation.y) * Math.min(dt * 10, 1);
          g.rotation.x += (look.y * 0.35 - g.rotation.x) * Math.min(dt * 10, 1);
        });

        // voice: syllables swing the jaw and blue light spills from inside the mouth
        const syllable = Math.abs(Math.sin(time * 10.5)) * (0.55 + 0.45 * Math.sin(time * 3.3 + 1.3));
        const jawTarget = sp && p.has("voice") ? 0.25 + syllable * 0.75 : 0;
        face.uJaw.value += (jawTarget - face.uJaw.value) * Math.min(dt * 18, 1);
        mouthLight.intensity = face.uJaw.value * 2.4;
      }

      // power: dull copper until the switch, then hot
      const hot = ch || a;
      copper.color.lerp(hot ? COPPER_HOT : COPPER_DULL, 1 - Math.exp(-dt * 5));
      copper.emissiveIntensity += ((ch ? 0.5 + Math.random() * 0.4 : a ? 0.18 : 0) - copper.emissiveIntensity) * Math.min(dt * 8, 1);
      tipMat.emissiveIntensity = ch ? 2 + Math.random() * 3 : a ? 1.2 : 0;
      terminalMat.emissiveIntensity = ch ? 2 + Math.random() * 2 : a ? 1.4 : 0;

      // lightning: re-strike with new geometry, never faster than every 110 ms
      if (now < strikeUntil) {
        if (now > nextRestrike) {
          drawBolts();
          nextRestrike = now + 110 + Math.random() * 80;
          strikeLight.intensity = 30;
        }
        strikeLight.intensity *= 0.86;
        boltCore.opacity = 0.7 + Math.random() * 0.3;
      } else if (boltGroup.children.length) {
        boltCore.opacity *= 0.8;
        boltGlow.opacity *= 0.8;
        strikeLight.intensity *= 0.8;
        if (boltCore.opacity < 0.02) {
          clearBolts();
          boltCore.opacity = 1;
          boltGlow.opacity = 0.6;
        }
      }
      // small arcs crawl off the coil tops while charging
      if (ch && Math.random() < 0.08 && now > strikeUntil) {
        clearBolts();
        boltCore.opacity = 1;
        const lines: THREE.Vector3[][] = [];
        coils.forEach((_, i) => {
          const tip = coilTips[i].getWorldPosition(new THREE.Vector3());
          const end = tip.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.9, (Math.random() - 0.2) * 0.6, (Math.random() - 0.5) * 0.9));
          boltPoints(tip, end, 0.25, 4, lines);
        });
        lines.forEach((pts) => boltGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), boltCore)));
      }

      // life: tremble while charging, breathe and follow the cursor once alive
      if (ch) {
        creature.rotation.set((Math.random() - 0.5) * 0.008, (Math.random() - 0.5) * 0.008, 0);
      } else if (a && !reduce) {
        creature.rotation.y = look.x * 0.3;
        creature.rotation.x = look.y * 0.12;
        creature.position.y = Math.sin(time * 1.6) * 0.01;
      } else {
        creature.rotation.y *= 1 - Math.min(dt * 3, 1);
        creature.rotation.x *= 1 - Math.min(dt * 3, 1);
        creature.position.y *= 1 - Math.min(dt * 3, 1);
      }

      composer.render();
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
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((mm) => mm.dispose());
      });
      pmrem.dispose();
      composer.dispose();
      renderer.dispose();
      el.removeChild(canvas);
    };
  }, []);

  return (
    <div
      ref={host}
      className="creature3d"
      role="img"
      aria-label={`The creature on the slab between two Tesla coils, with ${parts.size} of 5 parts stitched${alive ? ", alive" : ""}. Drag to look around.`}
    />
  );
});

export default CreatureScene;
