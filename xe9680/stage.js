// The studio the XE9680 stands in: a cool pale sweep, one key light from the front left, soft contact
// shadow, screen-space AO and a trace of bloom on the status LEDs. frame(state, cam) poses the machine
// and draws one frame.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {buildServer, SCALE} from './server.js';
import {CH} from './spec.js';

const V3 = THREE.Vector3;
export const COL = {bg: '#e9edf1', ground: '#e2e7ec', shadow: '#2a3a4a'};

export function createStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  scene.fog = new THREE.Fog(COL.bg, 4.5, 14);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.02, 40);

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8}));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.85;
  gtao.updateGtaoMaterial({radius: 0.05, distanceExponent: 1.5, thickness: 0.5, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
  gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16});

  // the ground is left out of the AO pass: a flat plane only darkens the whole frame
  class Toggle extends Pass {
    constructor(fn) {
      super();
      this.needsSwap = false;
      this.fn = fn;
    }
    render() {
      this.fn();
    }
  }
  const groundVis = (v) => () => {
    ground.visible = v;
    shade.visible = v;
  };
  composer.addPass(new Toggle(groundVis(false)));
  composer.addPass(gtao);
  composer.addPass(new Toggle(groundVis(true)));
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.2, 0.5, 0.94);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // a small studio as the environment: a broad top light, two side cards, a floor bounce
  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#8e9aa8');
    const card = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(0.97, 0.98, 1).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    card(14, 14, new V3(0, 12, 1), 1.0);
    card(4, 16, new V3(-11, 3, 5), 1.15);
    card(4, 16, new V3(11, 3, -3), 0.7);
    card(18, 3, new V3(0, 1, 13), 0.55);
    const g = new THREE.Mesh(new THREE.CircleGeometry(36, 32), new THREE.MeshBasicMaterial({color: '#6e7986', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -2;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    scene.environmentIntensity = 0.44;
    pm.dispose();
  }

  const SUN = new V3(-0.42, 0.78, 0.46).normalize();
  const sun = new THREE.DirectionalLight('#fffaf4', 1.95);
  sun.castShadow = true;
  const EXT = 1.08;
  Object.assign(sun.shadow.camera, {left: -EXT, right: EXT, top: EXT, bottom: -EXT, near: 0.4, far: 9});
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 7;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.0015;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight('#cfe0f2', 0.45);
  rim.position.set(2.4, 1.4, -3.2);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight('#eef4fb', '#8d99a6', 0.62));

  const ground = new THREE.Mesh(new THREE.CircleGeometry(14, 48), new THREE.MeshStandardMaterial({color: COL.ground, roughness: 0.96, metalness: 0}));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.001;
  scene.add(ground);
  const shade = new THREE.Mesh(
    new THREE.CircleGeometry(14, 48),
    new THREE.ShadowMaterial({color: COL.shadow, opacity: 0.26, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}),
  );
  shade.rotation.x = -Math.PI / 2;
  shade.receiveShadow = true;
  scene.add(shade);

  const server = buildServer();
  // the chassis floor sits on the ground
  server.root.position.y = 0.004;
  scene.add(server.root);

  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const tmp = new V3();
  const right = new V3().crossVectors(new V3(0, 1, 0), SUN).normalize();
  const upL = new V3().crossVectors(SUN, right);
  let texel = (2 * EXT) / sun.shadow.mapSize.x;

  /** cam: {tx, ty, tz} in metres, az/el in radians, d in metres, sx/sy screen shift in px. */
  const frame = (st, cam) => {
    server.update(st);
    const {tx, ty, tz} = cam;
    camera.position.set(
      tx + cam.d * Math.cos(cam.el) * Math.sin(cam.az),
      ty + cam.d * Math.sin(cam.el),
      tz + cam.d * Math.cos(cam.el) * Math.cos(cam.az),
    );
    camera.lookAt(tx, ty, tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    // the shadow camera follows the subject, snapped to the texel grid so the edge does not crawl
    tmp.set(0, CH.H * SCALE * 0.5, 0);
    const rr = Math.round(tmp.dot(right) / texel) * texel;
    const uu = Math.round(tmp.dot(upL) / texel) * texel;
    sun.target.position.copy(right).multiplyScalar(rr).addScaledVector(upL, uu).addScaledVector(SUN, tmp.dot(SUN));
    sun.position.copy(sun.target.position).addScaledVector(SUN, 4);
    sun.target.updateMatrixWorld();
    composer.render();
  };

  const pv = new V3();
  const project = (v) => {
    pv.copy(v).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  /** The world point of a callout anchor: its local offset inside the node it belongs to. */
  const wp = new V3();
  const anchor = (part) => {
    wp.set(part.off[0], part.off[1], part.off[2]);
    part.node.updateWorldMatrix(true, false);
    return project(part.node.localToWorld(wp));
  };

  const setQuality = ({samples, ao, shadow}) => {
    if (samples !== undefined)
      for (const t of [composer.renderTarget1, composer.renderTarget2]) {
        t.samples = samples;
        t.dispose();
      }
    if (ao !== undefined) gtao.enabled = ao;
    if (shadow !== undefined) {
      sun.shadow.mapSize.set(shadow, shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      texel = (2 * EXT) / shadow;
    }
  };

  return {renderer, scene, camera, composer, gtao, sun, server, resize, frame, project, anchor, size, setQuality};
}
