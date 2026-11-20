// The XE9680 as geometry, built from code against the guide's chassis views (Figures 1, 3, 5–11).
//
// Everything is modelled in millimetres in the chassis frame — x right, y up from the floor, z toward
// the FRONT — and the root is scaled to metres at the end, so every number below is the real one.
//
// Each subsystem is one THREE.Group with its own explode vector and its own set of materials, so
// isolating a subsystem is a per-material opacity, not a rebuild. update(state) poses everything.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {BOX, CH, DECK, GPUS, PSB_BOARDS, SLOTS} from './spec.js';

const V3 = THREE.Vector3;
export const SCALE = 0.001;

// ---------------------------------------------------------------- the palette
const BASE = {
  shell: {color: '#474f59', roughness: 0.56, metalness: 0.4}, // chassis sheet metal
  shellLit: {color: '#6b747f', roughness: 0.5, metalness: 0.38},
  dark: {color: '#1b1f24', roughness: 0.78, metalness: 0.18}, // plastics, grilles, bezels
  alu: {color: '#9aa2ab', roughness: 0.46, metalness: 0.6}, // heatsinks
  aluDark: {color: '#6b737c', roughness: 0.52, metalness: 0.55},
  pcb: {color: '#123028', roughness: 0.8, metalness: 0.06}, // boards
  pcbBlue: {color: '#12243a', roughness: 0.78, metalness: 0.08},
  gold: {color: '#bb963f', roughness: 0.4, metalness: 0.85}, // contacts
  tab: {color: '#d9561d', roughness: 0.58, metalness: 0.04}, // the orange pull tabs
  pale: {color: '#aab3bd', roughness: 0.62, metalness: 0.15}, // labels, carriers
  blue: {color: '#1b84e0', roughness: 0.45, metalness: 0.2, emissive: '#0d4f8c', emissiveIntensity: 0.35},
};
const GHOST = new THREE.Color('#94a2b1');

/** One palette per subsystem: isolating a subsystem is then an opacity animation on 11 materials. */
function makePalettes(keys) {
  const out = {};
  for (const k of keys) {
    const p = {};
    for (const [name, def] of Object.entries(BASE)) {
      const m = new THREE.MeshStandardMaterial({
        color: def.color,
        roughness: def.roughness,
        metalness: def.metalness,
        emissive: def.emissive ?? '#000000',
        emissiveIntensity: def.emissiveIntensity ?? 0,
        transparent: true,
        opacity: 1,
        envMapIntensity: 0.34,
      });
      m.userData.base = new THREE.Color(def.color);
      m.userData.emi = def.emissiveIntensity ?? 0;
      p[name] = m;
    }
    out[k] = p;
  }
  return out;
}

// ---------------------------------------------------------------- small builders
const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
/** A box given by its bounds, so the layout reads as the real coordinates. */
const slab = (mat, x0, x1, y0, y1, z0, z1) =>
  mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
const bx = (mat, w, h, d, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);

/** A finned heatsink as one instanced mesh: n fins of (t × h × d), spread over w along x. */
function fins(mat, {w, h, d, n, t = 1.1}) {
  const g = new THREE.BoxGeometry(t, h, d);
  const im = new THREE.InstancedMesh(g, mat, n);
  im.castShadow = true;
  im.receiveShadow = true;
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    m.makeTranslation(-w / 2 + (w / (n - 1)) * i, h / 2, 0);
    im.setMatrixAt(i, m);
  }
  im.instanceMatrix.needsUpdate = true;
  return im;
}

/** A perforation texture: the punched sheet of the front intake and the fan grilles. */
function perfTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#2a2e33';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#0a0c0e';
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      g.beginPath();
      g.arc(x * 8 + 4 + (y % 2) * 4, y * 8 + 4, 2.6, 0, Math.PI * 2);
      g.fill();
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** An axial fan rotor: hub plus swept blades, merged into one geometry and reused by all 16 fans. */
function rotorGeometry(r = 29, blades = 9) {
  const parts = [new THREE.CylinderGeometry(r * 0.38, r * 0.42, 16, 20).rotateX(Math.PI / 2)];
  for (let i = 0; i < blades; i++) {
    const b = new THREE.BoxGeometry(r * 0.64, 2.2, 13);
    b.rotateX(0.62);
    b.translate(r * 0.66, 0, 0);
    b.rotateZ((i / blades) * Math.PI * 2);
    parts.push(b);
  }
  return mergeGeometries(parts);
}

// ---------------------------------------------------------------- the subsystems
const KEYS = ['chassis', 'compute', 'gpu', 'pcie', 'storage', 'power', 'cooling', 'io'];

// where each subsystem goes when the machine comes apart (mm)
const EXPLODE = {
  chassis: [0, 0, 0],
  compute: [0, 230, 0],
  gpu: [0, -195, 0],
  pcie: [0, 0, 300],
  storage: [0, 0, 0],
  power: [0, 0, -300],
  cooling: [0, 0, 0],
  io: [0, 0, -420],
};

export function buildServer() {
  const root = new THREE.Group();
  const pal = makePalettes(KEYS);
  const groups = {};
  for (const k of KEYS) {
    groups[k] = new THREE.Group();
    groups[k].userData = {key: k, home: new V3(), target: new V3(...EXPLODE[k])};
    root.add(groups[k]);
  }
  const parts = []; // {sub, name, note, node, off:[x,y,z]} — the callout anchors
  const tag = (sub, name, note, node, off) => parts.push({sub, name, note, node, off});
  const perf = perfTexture();
  const rotors = [];
  // children that take an extra offset of their own when exploded; each keeps its own home, so a part
  // the configuration moves (the rear fan wall re-pitches with the fan count) is not snapped back
  const subExtras = [];
  const extra = (node, off) => {
    node.userData.home = node.position.clone();
    subExtras.push({node, off});
  };

  // =============================================================== 00 chassis shell
  {
    const G = groups.chassis;
    const M = pal.chassis;
    const t = 4; // sheet thickness
    const {x0, x1, y0, y1, z0, z1} = BOX;

    const floor = slab(M.shell, x0, x1, y0, y0 + t, z0, z1);
    const lid = slab(M.shellLit, x0, x1, y1 - t, y1, z0 + 40, z1 - 60);
    const left = slab(M.shell, x0, x0 + t, y0, y1, z0, z1);
    const right = slab(M.shell, x1 - t, x1, y0, y1, z0, z1);
    const mid = slab(M.shell, x0 + t, x1 - t, DECK - 3, DECK, z0 + 120, z1 - 40); // the mid-deck floor
    for (const m of [floor, left, right, mid]) G.add(m);
    // the shell itself opens out: the walls swing clear, the floor drops, the mid deck lifts
    extra(left, new V3(-180, 0, 0));
    extra(right, new V3(180, 0, 0));
    extra(floor, new V3(0, -120, 0));
    extra(mid, new V3(0, 96, 0));
    // the side walls carry the rail channel and two embossed ribs, so a 995 mm flank is not a blank plate
    for (const sx of [x0 + t / 2, x1 - t / 2]) {
      const o = sx < 0 ? -1 : 1;
      G.add(slab(M.shellLit, sx + o * 1.2 - 5, sx + o * 1.2 + 5, 146, 162, z0 + 50, z1 - 50));
      for (const yy of [66, 222]) G.add(slab(M.shellLit, sx + o * 0.8 - 4, sx + o * 0.8 + 4, yy, yy + 7, z0 + 90, z1 - 90));
      for (let i = 0; i < 3; i++) G.add(bx(M.dark, 3, 22, 22, sx + o * 1.6, 104, z1 - 150 - i * 240));
    }

    const lidG = new THREE.Group();
    lidG.add(lid);
    // the lid's long stiffening ribs
    for (let i = 0; i < 5; i++) lidG.add(bx(M.shellLit, CH.W - 40, 5, 10, 0, y1 - 8, z1 - 160 - i * 170));
    // the recessed service panel and its latch, so the lid is not a blank plate
    lidG.add(slab(M.shell, -170, 170, y1 - 5.6, y1 - 2.4, z1 - 320, z1 - 70));
    lidG.add(bx(M.dark, 66, 4, 26, 0, y1 - 1, z1 - 56));
    lidG.add(bx(M.blue, 24, 3, 9, 0, y1 + 0.4, z1 - 56));
    G.add(lidG);
    G.userData.lid = lidG;
    tag('chassis', 'TOP COVER', 'SERVICE ACCESS', lidG, [-110, 0, 180]);

    // front face: the ears, the frame around the drive band and the card cage
    const frontG = new THREE.Group();
    for (const s of [-1, 1]) {
      frontG.add(bx(M.shellLit, 26, CH.H - 8, 12, s * (CH.W / 2 - 13), CH.H / 2, z1 - 6)); // rack ear
      frontG.add(bx(M.tab, 5, 54, 14, s * (CH.W / 2 - 13), 150, z1 - 2)); // the latch strip
    }
    // the punched intake band between the drives and the cards
    const perfMat = new THREE.MeshStandardMaterial({color: '#39404a', map: perf, roughness: 0.85, metalness: 0.2, transparent: true});
    perfMat.map.repeat.set(26, 2.4);
    perfMat.userData = {base: new THREE.Color('#39404a'), emi: 0};
    pal.chassis.perf = perfMat;
    frontG.add(slab(perfMat, -205, 205, DECK + 4, 190, z1 - 5, z1 - 2));
    frontG.add(slab(M.dark, -205, 205, 186, 194, z1 - 7, z1 - 1));
    G.add(frontG);
    extra(frontG, new V3(0, 0, 260));
    tag('chassis', 'FRONT INTAKE', 'ALL AIR ENTERS HERE', frontG, [0, 170, 10]);

    // left and right control panels (Figure 1, items 1 and 3)
    const cpL = new THREE.Group();
    cpL.add(bx(M.dark, 26, 56, 10, -CH.W / 2 + 15, 224, z1 - 5));
    for (let i = 0; i < 4; i++) cpL.add(bx(M.blue, 3.4, 3.4, 2, -CH.W / 2 + 15, 240 - i * 9, z1 - 1));
    G.add(cpL);
    tag('chassis', 'LEFT CONTROL PANEL', 'HEALTH · ID · STATUS LED', cpL, [0, 224 - 224, 0]);
    const cpR = new THREE.Group();
    cpR.add(bx(M.dark, 26, 56, 10, CH.W / 2 - 15, 224, z1 - 5));
    cpR.add(mesh(new THREE.CylinderGeometry(5, 5, 3, 16).rotateX(Math.PI / 2), M.pale, CH.W / 2 - 15, 240, z1 - 2));
    cpR.add(bx(M.dark, 9, 4.2, 3, CH.W / 2 - 15, 226, z1 - 2)); // USB 2.0
    cpR.add(bx(M.blue, 11, 9, 3, CH.W / 2 - 15, 212, z1 - 2)); // VGA
    G.add(cpR);
    tag('chassis', 'RIGHT CONTROL PANEL', 'POWER · USB · iDRAC DIRECT', cpR, [0, 0, 0]);

    // the slide-out Express Service Tag
    G.add(bx(M.pale, 54, 4, 3, 150, 160, z1 - 3));
    tag('chassis', 'INFORMATION TAG', 'SERVICE TAG · MAC · PASSWORD', G, [150, 160, z1 + 6]);
  }

  // =============================================================== 01 compute: CPUs + 32 DIMMs
  {
    const G = groups.compute;
    const M = pal.compute;
    const y = DECK + 2;
    G.add(slab(M.pcb, -232, 232, y, y + 6, -170, 250)); // the system board

    const cpuX = [-115, 115];
    cpuX.forEach((x, i) => {
      const c = new THREE.Group();
      c.add(bx(M.aluDark, 94, 10, 94, x, y + 11, 60)); // the socket carrier
      c.add(bx(M.pale, 76, 5, 76, x, y + 18, 60)); // the IHS
      const f = fins(M.alu, {w: 88, h: 72, d: 96, n: 34});
      f.position.set(x, y + 20, 60);
      c.add(f);
      for (const zz of [-1, 1]) c.add(bx(M.aluDark, 92, 74, 5, x, y + 57, 60 + zz * 50)); // the end rails
      G.add(c);
      tag('compute', `CPU ${i + 1}`, 'SOCKET E · UP TO 350 W', c, [x, 60, 60]);
    });

    // 32 DDR5 slots: four banks of eight, the module planes along the airflow
    const dimmGeo = new THREE.BoxGeometry(3.6, 32, 133);
    const latch = new THREE.BoxGeometry(5, 7, 10);
    const BANKS = [-200, -34, 34, 200];
    BANKS.forEach((bx0, bi) => {
      const bank = new THREE.Group();
      const im = new THREE.InstancedMesh(dimmGeo, M.pale, 8);
      im.castShadow = im.receiveShadow = true;
      const mm = new THREE.Matrix4();
      for (let i = 0; i < 8; i++) {
        mm.makeTranslation(bx0 - 28 + i * 8, y + 22, 60);
        im.setMatrixAt(i, mm);
      }
      im.instanceMatrix.needsUpdate = true;
      bank.add(im);
      bank.add(bx(M.dark, 70, 7, 141, bx0, y + 8, 60)); // the slot bodies
      for (const zz of [-1, 1]) bank.add(bx(M.dark, 70, 5, 9, bx0, y + 12, 60 + zz * 71));
      void latch;
      G.add(bank);
      tag('compute', `DIMM BANK ${'ABCD'[bi]}`, '8 × DDR5 RDIMM · 8 CHANNELS', bank, [bx0, 40, 60]);
    });

    // the rear of the board: chipset, the CPLD and the connectors that feed the lower deck
    G.add(bx(M.aluDark, 46, 14, 46, -60, y + 13, -110));
    G.add(bx(M.aluDark, 34, 10, 34, 70, y + 11, -120));
    for (let i = 0; i < 6; i++) G.add(bx(M.gold, 68, 10, 7, -170 + i * 70, y + 11, 200));
    tag('compute', 'SYSTEM BOARD', 'UPI ×4 · 160 PCIe Gen5 LANES', G, [0, DECK + 10, -150]);
  }

  // =============================================================== 02 the 8-GPU baseboard
  const gpuModules = [];
  {
    const G = groups.gpu;
    const M = pal.gpu;
    const y = 14;
    // the tray: a sheet-metal pan with two pull handles, and the baseboard on top of it
    G.add(slab(M.shell, -222, 222, 6, 12, -270, 270));
    for (const s of [-1, 1]) G.add(bx(M.tab, 10, 26, 70, s * 212, 32, 250));
    G.add(slab(M.pcb, -215, 215, y, y + 9, -255, 255));
    tag('gpu', 'GPU BASEBOARD', 'HGX / OAM UBB · SLOTS 21–28', G, [0, 20, -230]);

    // eight modules, two rows of four, the fins running along the airflow
    const xs = [-162, -54, 54, 162];
    const zs = [150, -150];
    let n = 0;
    for (const z of zs)
      for (const x of xs) {
        const g = new THREE.Group();
        g.add(bx(M.pcbBlue, 86, 7, 78, x, y + 12, z)); // the SXM / OAM package
        g.add(bx(M.pale, 62, 3, 58, x, y + 17, z));
        const f = fins(M.alu, {w: 92, h: 92, d: 104, n: 36});
        f.position.set(x, y + 18, z);
        g.add(f);
        g.add(bx(M.aluDark, 96, 7, 106, x, y + 113, z));
        g.add(bx(M.gold, 96, 4, 10, x, y + 9, z + 46));
        G.add(g);
        gpuModules.push(g);
        n++;
        if (n === 1 || n === 8) tag('gpu', `GPU ${n}`, 'ONE OF EIGHT · SLOT 2' + n, g, [x, 70, z]);
      }

    // the fabric between the rows: four switches on the NVIDIA boards
    const sw = new THREE.Group();
    for (const x of [-120, -40, 40, 120]) {
      sw.add(bx(M.pcbBlue, 54, 6, 54, x, y + 11, 0));
      const f = fins(M.alu, {w: 58, h: 34, d: 62, n: 22});
      f.position.set(x, y + 14, 0);
      sw.add(f);
      sw.add(bx(M.aluDark, 62, 5, 64, x, y + 48, 0));
    }
    G.add(sw);
    gpuModules.push(sw);
    tag('gpu', 'FABRIC SWITCHES', 'ONE HOP BETWEEN ANY TWO', sw, [0, 55, 0]);

    // the Gaudi3 board's own 800 Gb OSFP ports, shown only on that configuration
    const osfp = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      osfp.add(bx(M.dark, 26, 16, 44, -150 + i * 60, y + 16, -268));
      osfp.add(bx(M.blue, 18, 3, 3, -150 + i * 60, 30, -288));
    }
    osfp.visible = false;
    G.add(osfp);
    G.userData.osfp = osfp;
    tag('gpu', 'OSFP PORTS', '6 × 800 Gb · GAUDI3 ONLY', osfp, [0, 24, -270]);
  }

  // =============================================================== 03 PCIe: 10 cards, 4 switch boards
  const cardNodes = {};
  {
    const G = groups.pcie;
    const M = pal.pcie;
    const zFace = BOX.z1 - 6;
    for (const s of SLOTS) {
      const c = new THREE.Group();
      const y0 = s.low ? 6 : 40;
      c.add(slab(M.pcbBlue, s.x - 1.1, s.x + 1.1, y0 + 6, y0 + 100, zFace - 172, zFace - 8)); // the card
      c.add(slab(M.pale, s.x - 10, s.x + 10, y0, y0 + 112, zFace - 4, zFace)); // the bracket
      c.add(slab(M.gold, s.x - 1.6, s.x + 1.6, y0 + 2, y0 + 8, zFace - 110, zFace - 30)); // the edge fingers
      const f = fins(M.aluDark, {w: 7, h: 54, d: 120, n: 4, t: 1.4});
      f.position.set(s.x, y0 + 26, zFace - 90);
      c.add(f);
      for (const zz of [0, 1]) c.add(bx(M.dark, 15, 15, 22, s.x, y0 + 86 - zz * 22, zFace - 16)); // the cages
      G.add(c);
      cardNodes[s.n] = c;
      extra(c, new V3(0, 0, 40 + Math.abs(s.x) * 0.32));
    }
    tag('pcie', 'SLOT 31', 'BASE BOARD · SmartNIC / DPU', cardNodes[31], [-190, 70, zFace - 60]);
    tag('pcie', 'SLOT 40', 'BASE BOARD · SmartNIC / DPU', cardNodes[40], [190, 70, zFace - 60]);

    // the four PCIe switch boards the eight middle slots hang off
    PSB_BOARDS.forEach((b, i) => {
      const n = new THREE.Group();
      n.add(slab(M.pcb, b.x - 1.5, b.x + 1.5, 14, 112, zFace - 180, zFace - 34));
      const f = fins(M.aluDark, {w: 9, h: 40, d: 54, n: 5, t: 1.6});
      f.position.set(b.x, 48, zFace - 110);
      n.add(f);
      n.add(bx(M.gold, 4, 6, 70, b.x, 17, zFace - 120));
      G.add(n);
      extra(n, new V3(0, 0, -10 + i * 6));
      if (i === 0) tag('pcie', 'PSB D', 'SWITCH BOARD · SLOTS 32/33', n, [b.x, 60, zFace - 110]);
      if (i === 3) tag('pcie', 'PSB A', 'SWITCH BOARD · SLOTS 38/39', n, [b.x, 60, zFace - 110]);
    });

    // the PCIe base board the whole cage stands on
    G.add(slab(M.pcb, -228, 228, 2, 7, zFace - 196, zFace - 10));
    tag('pcie', 'PCIe BASE BOARD', 'SLOTS 31/40 · GPU POWER', G, [0, 4, zFace - 150]);
  }

  // =============================================================== 04 storage
  const driveSets = {u2: new THREE.Group(), e3s: new THREE.Group()};
  {
    const G = groups.storage;
    const M = pal.storage;
    const zF = BOX.z1 - 4;

    // 8 × 2.5-inch U.2: two columns of two on each side of the centre blank (Figure 1)
    const u2 = driveSets.u2;
    let n = 0;
    for (const side of [-1, 1])
      for (let col = 0; col < 2; col++)
        for (let row = 0; row < 2; row++) {
          const x = side * (54 + col * 82);
          const y = 200 + row * 26;
          const d = new THREE.Group();
          d.add(bx(M.pale, 76, 23, 96, x, y, zF - 48));
          d.add(bx(M.dark, 70, 17, 4, x, y, zF - 1));
          d.add(bx(M.tab, 6, 15, 5, x - 32, y, zF));
          d.add(bx(M.blue, 3, 3, 2, x + 30, y + 6, zF + 1));
          u2.add(d);
          extra(d, new V3(0, 0, 120 + n * 26));
          n++;
        }
    G.add(u2);
    tag('storage', 'FRONT DRIVE BAYS', '8 × U.2 NVMe / SAS4', u2, [-136, 213, zF - 20]);

    // 16 × E3.S: thin and upright, across the same band
    const e3 = driveSets.e3s;
    for (let i = 0; i < 16; i++) {
      const x = -196 + i * 26.2;
      const d = new THREE.Group();
      d.add(bx(M.pale, 21, 56, 96, x, 224, zF - 48));
      d.add(bx(M.dark, 16, 48, 4, x, 224, zF - 1));
      d.add(bx(M.tab, 13, 5, 5, x, 250, zF));
      e3.add(d);
      extra(d, new V3(0, 0, 110 + i * 11));
    }
    e3.visible = false;
    G.add(e3);

    // the drive backplane and the front PERC behind it
    G.add(slab(M.pcb, -210, 210, 190, 258, zF - 108, zF - 102));
    const perc = new THREE.Group();
    perc.add(slab(M.pcb, -70, 70, 196, 250, zF - 140, zF - 134));
    perc.add(bx(M.aluDark, 40, 30, 10, 0, 222, zF - 143));
    G.add(perc);
    tag('storage', 'fPERC12 H965i', 'SAS4 / SATA x8 · NO GAUDI3', perc, [0, 222, zF - 140]);

    // BOSS-N1 at the rear, between the upper pair of supplies
    const boss = new THREE.Group();
    boss.add(bx(M.dark, 64, 46, 190, 0, 234, BOX.z0 + 100));
    for (const s of [-1, 1]) boss.add(bx(M.pcbBlue, 22, 6, 80, s * 15, 234, BOX.z0 + 60));
    boss.add(bx(M.tab, 40, 5, 6, 0, 214, BOX.z0 + 7));
    boss.add(bx(M.blue, 5, 5, 2, 24, 248, BOX.z0 + 5));
    G.add(boss);
    extra(boss, new V3(0, 0, -200));
    tag('storage', 'BOSS-N1', '2 × M.2 NVMe · RAID 1 BOOT', boss, [0, 234, BOX.z0 + 20]);
  }

  // =============================================================== 05 six Titanium supplies
  {
    const G = groups.power;
    const M = pal.power;
    const z1 = BOX.z0 + 4;
    const z2 = BOX.z0 + 206;
    // four on the upper row either side of the BOSS, two on the lower row at the corners
    const BAYS = [
      {x: -196, y: 210, n: 2}, {x: -106, y: 210, n: 1},
      {x: 106, y: 210, n: 3}, {x: 196, y: 210, n: 4},
      {x: -196, y: 158, n: 5}, {x: 196, y: 158, n: 6},
    ];
    BAYS.forEach((b, i) => {
      const p = new THREE.Group();
      p.add(bx(M.shellLit, 86, 50, z2 - z1, b.x, b.y + 25, (z1 + z2) / 2));
      p.add(bx(M.dark, 80, 44, 5, b.x, b.y + 25, z1 + 1)); // the face
      // the supply's own fan and the C22 inlet
      p.add(mesh(new THREE.CylinderGeometry(19, 19, 5, 22).rotateX(Math.PI / 2), M.dark, b.x - 20, b.y + 25, z1 + 3));
      p.add(mesh(new THREE.TorusGeometry(19, 1.6, 6, 26), M.shellLit, b.x - 20, b.y + 25, z1 - 1));
      const r = mesh(rotorGeometry(15, 7), M.aluDark, b.x - 20, b.y + 25, z1 + 1);
      p.add(r);
      rotors.push({node: r, mid: false});
      p.add(bx(M.dark, 26, 24, 7, b.x + 22, b.y + 22, z1 - 1));
      p.add(bx(M.tab, 7, 18, 6, b.x + 38, b.y + 25, z1 - 1));
      p.add(bx(M.blue, 4, 4, 2, b.x + 22, b.y + 42, z1 - 3));
      G.add(p);
      extra(p, new V3(0, 0, -30 - i * 34));
      if (b.n === 1) tag('power', 'PSU 1', '2800–3200 W TITANIUM · 54 V', p, [b.x, b.y + 25, z1 + 10]);
      if (b.n === 6) tag('power', 'PSU 6', 'HOT-SWAP · 5+1 OR 3+3', p, [b.x, b.y + 25, z1 + 10]);
    });
    // the power distribution board the six plug into
    G.add(slab(M.pcb, -220, 220, 150, 156, BOX.z0 + 210, BOX.z0 + 290));
  }

  // =============================================================== 06 sixteen fans
  const fanNodes = {mid: [], rear: []};
  {
    const G = groups.cooling;
    const M = pal.cooling;
    const grille = new THREE.MeshStandardMaterial({color: '#59626d', map: perf.clone(), roughness: 0.85, metalness: 0.2, transparent: true});
    grille.map.repeat.set(9, 7);
    grille.map.needsUpdate = true;
    grille.userData = {base: new THREE.Color('#59626d'), emi: 0};
    pal.cooling.grille = grille;

    // six on the mid tray, pulling across the processors
    for (let i = 0; i < 6; i++) {
      const x = -190 + i * 76;
      const f = new THREE.Group();
      f.add(bx(M.dark, 70, 68, 8, x, 196, 292));
      f.add(bx(M.dark, 70, 68, 8, x, 196, 230));
      for (const s of [-1, 1]) f.add(bx(M.dark, 6, 68, 62, x + s * 32, 196, 261));
      const r = mesh(rotorGeometry(30, 9), M.pale, x, 196, 270);
      f.add(r);
      rotors.push({node: r, mid: true});
      f.add(bx(M.tab, 30, 6, 7, x, 228, 294));
      G.add(f);
      fanNodes.mid.push(f);
      extra(f, new V3(0, 200, 30 + i * 8));
    }
    tag('cooling', 'MID TRAY FANS 1–6', 'HPR GOLD · CPU + MEMORY PATH', fanNodes.mid[0], [-190, 232, 261]);

    // ten (twelve with Gaudi3) across the rear, pulling through the GPU heatsinks
    const zb = BOX.z0 + 2;
    for (let i = 0; i < 12; i++) {
      const row = i % 2;
      const col = (i / 2) | 0;
      const f = new THREE.Group();
      f.userData.extra = col >= 5; // the 11th and 12th exist only on Gaudi3
      const y = 42 + row * 70;
      const f6 = col >= 5;
      const x = f6 ? 0 : -192 + col * 96; // re-laid out below when the count changes
      f.position.set(x, 0, 0);
      f.add(bx(M.dark, 88, 64, 10, 0, y, zb + 78));
      f.add(slab(grille, -44, 44, y - 32, y + 32, zb, zb + 4));
      for (const s of [-1, 1]) f.add(bx(M.dark, 5, 64, 76, s * 42, y, zb + 40));
      const r = mesh(rotorGeometry(29, 9), M.pale, 0, y, zb + 48);
      f.add(r);
      rotors.push({node: r, mid: false});
      f.add(bx(M.tab, 32, 6, 8, 0, y + 26, zb + 1));
      f.add(bx(M.pale, 10, 10, 4, 34, y + 26, zb + 1));
      G.add(f);
      fanNodes.rear.push(f);
      extra(f, new V3(0, 0, -120 - col * 46));
    }
    tag('cooling', 'REAR GPU FANS 7–16', 'N+1 · 12 FANS ON GAUDI3', fanNodes.rear[0], [0, 106, zb + 14]);
  }

  // =============================================================== 07 network and rear I/O
  {
    const G = groups.io;
    const M = pal.io;
    const z = BOX.z0 + 3;
    G.add(slab(M.dark, -96, 96, 156, 206, z, z + 8)); // the rear I/O panel

    const lom = new THREE.Group();
    for (let i = 0; i < 2; i++) lom.add(bx(M.dark, 17, 14, 22, -78 + i * 20, 192, z + 10));
    for (let i = 0; i < 2; i++) lom.add(bx(M.blue, 4, 3, 2, -78 + i * 20, 200, z - 1));
    G.add(lom);
    tag('io', 'LOM · 2 × 1 GbE', 'BROADCOM BCM5720', lom, [-68, 192, z]);

    const ocp = new THREE.Group();
    ocp.add(bx(M.shellLit, 86, 32, 160, -4, 174, z + 86));
    for (let i = 0; i < 4; i++) ocp.add(bx(M.dark, 15, 15, 20, -34 + i * 20, 174, z + 10));
    ocp.add(bx(M.tab, 7, 20, 6, 38, 174, z + 1));
    G.add(ocp);
    extra(ocp, new V3(0, -60, -70));
    tag('io', 'OCP 3.0 MEZZ', 'x8 Gen4 · 25 GbE ×4 · 35 W', ocp, [-4, 174, z + 10]);

    const svc = new THREE.Group();
    svc.add(bx(M.dark, 15, 13, 20, 24, 192, z + 10)); // the dedicated iDRAC port
    svc.add(bx(M.pale, 11, 5, 14, 44, 192, z + 8)); // USB 3.0
    svc.add(bx(M.pale, 9, 4.5, 14, 60, 192, z + 8)); // USB 2.0
    svc.add(bx(M.blue, 18, 10, 14, 80, 190, z + 8)); // VGA
    svc.add(mesh(new THREE.CylinderGeometry(4, 4, 3, 14).rotateX(Math.PI / 2), M.pale, 24, 172, z + 1));
    G.add(svc);
    tag('io', 'SERVICE PORTS', 'iDRAC · USB 3.0 / 2.0 · VGA', svc, [52, 192, z]);
  }

  // =============================================================== airflow
  // Two corridors, drawn as drifting streaks: the lower one through the GPU heatsinks, the upper one
  // over the processors. Position is a pure function of t, so the live page and a still frame agree.
  const AIR_N = 170;
  const airGeo = new THREE.BoxGeometry(3.2, 3.2, 62);
  const airMat = new THREE.MeshBasicMaterial({transparent: true, opacity: 0, toneMapped: false, depthWrite: false});
  const air = new THREE.InstancedMesh(airGeo, airMat, AIR_N);
  air.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(AIR_N * 3), 3);
  air.frustumCulled = false;
  air.visible = false;
  root.add(air);
  const seeds = [];
  for (let i = 0; i < AIR_N; i++) {
    const low = i % 3 !== 0;
    const h = (n) => {
      const x = Math.sin(n * 127.1 + i * 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    seeds.push({
      low,
      x: low ? -205 + h(1) * 410 : -215 + h(2) * 430,
      y: low ? 22 + h(3) * 104 : DECK + 22 + h(4) * 78,
      p: h(5),
      v: 0.72 + h(6) * 0.56,
    });
  }
  const airM = new THREE.Matrix4();
  const cCool = new THREE.Color('#2f9ae0');
  const cWarm = new THREE.Color('#e8762f');
  const cTmp = new THREE.Color();

  // =============================================================== state
  const state = {gpu: 'h100', drives: 'u2', explode: 0, iso: null, xray: 0, air: 0, spin: 0, t: 0, duty: 0.4, lidOpen: 0, fade: {}};
  for (const k of KEYS) state.fade[k] = 1;

  const setGpu = (key) => {
    const g = GPUS[key];
    groups.gpu.userData.osfp.visible = key === 'gaudi3';
    // the rear fan wall: ten across in five columns, twelve in six when the modules are 900 W
    const n = g.fansRear;
    const cols = n / 2;
    const pitch = CH.W / cols;
    fanNodes.rear.forEach((f, i) => {
      const col = (i / 2) | 0;
      f.visible = col < cols;
      f.userData.home.x = -CH.W / 2 + pitch * (col + 0.5);
      f.position.x = f.userData.home.x;
      f.scale.x = Math.min(1, (pitch - 8) / 96);
    });
    // Gaudi3 blanks slots 33 and 38 for airflow
    for (const s of SLOTS) cardNodes[s.n].visible = !(key === 'gaudi3' && s.gaudiBlocked);
    // and never ships with the E3.S backplane
    if (!g.e3s && state.drives === 'e3s') setDrives('u2');
  };
  const setDrives = (key) => {
    state.drives = key;
    driveSets.u2.visible = key === 'u2';
    driveSets.e3s.visible = key === 'e3s';
  };

  const tmpC = new THREE.Color();
  const applyFade = () => {
    for (const k of KEYS) {
      const f = state.fade[k];
      const ghost = f < 0.995;
      for (const m of Object.values(pal[k])) {
        m.opacity = 0.12 + 0.88 * f;
        m.color.copy(tmpC.copy(m.userData.base).lerp(GHOST, (1 - f) * 0.6));
        m.emissiveIntensity = m.userData.emi * f;
        m.depthWrite = !ghost || f > 0.5;
      }
      groups[k].traverse((o) => {
        if (o.isMesh) o.castShadow = !ghost;
      });
    }
  };

  const off = new V3();
  /**
   * s: {explode 0..1, fade {key: 0..1}, xray 0..1, air 0..1, spin (revolutions), t (seconds)}
   */
  const update = (s) => {
    Object.assign(state, s);
    for (const k of KEYS) {
      const g = groups[k];
      g.position.copy(off.copy(g.userData.target).multiplyScalar(state.explode));
    }
    for (const e of subExtras) e.node.position.copy(e.node.userData.home).addScaledVector(e.off, state.explode);
    // the top cover lifts for the explode, and slides off the back for the view from above
    const lo = state.lidOpen ?? 0;
    groups.chassis.userData.lid.position.set(0, 300 * state.explode + 46 * lo, -1420 * lo);
    // the chassis also fades on its own when x-ray is on, so the insides read
    const chFade = Math.min(state.fade.chassis, 1 - state.xray * 0.86);
    const keep = state.fade.chassis;
    state.fade.chassis = chFade;
    applyFade();
    state.fade.chassis = keep;

    const rev = state.spin;
    for (const r of rotors) r.node.rotation.z = rev * (r.mid ? 1 : -1.18);

    air.visible = state.air > 0.01;
    if (air.visible) {
      const z0 = BOX.z1 - 10;
      const z1 = BOX.z0 + 90;
      const span = z0 - z1;
      for (let i = 0; i < AIR_N; i++) {
        const sd = seeds[i];
        const k = (sd.p + state.t * sd.v * (0.12 + 0.3 * (state.duty ?? 0.4))) % 1;
        const z = z0 - k * span;
        airM.makeTranslation(sd.x, sd.y, z);
        air.setMatrixAt(i, airM);
        cTmp.copy(cCool).lerp(cWarm, Math.pow(k, 1.3));
        air.setColorAt(i, cTmp);
      }
      air.instanceMatrix.needsUpdate = true;
      air.instanceColor.needsUpdate = true;
      airMat.opacity = state.air * 0.95;
    }
  };

  setGpu('h100');
  setDrives('u2');
  root.scale.setScalar(SCALE);

  return {root, groups, parts, update, setGpu, setDrives, palettes: pal, cardNodes, fanNodes, gpuModules, air};
}
