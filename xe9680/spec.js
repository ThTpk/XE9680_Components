// Dell PowerEdge XE9680 — the single source of truth.
//
// Every number here is read from the Dell PowerEdge XE9680 Technical Guide, Regulatory Model E90S,
// Rev. A09, July 2025, and is tagged with the table it came from. The geometry (server.js), the
// panels (console.js) and the power/thermal/acoustic model below all read from this file, so nothing
// on screen can disagree with anything else on screen.
//
// Values marked DERIVED are computed by the model at the bottom of this file from the guide's numbers;
// the console marks them MODEL so they are never mistaken for published figures.

export const DOC = {
  title: 'PowerEdge XE9680',
  vendor: 'Dell Technologies',
  guide: 'Technical Guide · Rev. A09 · July 2025',
  regModel: 'E90S',
  regType: 'E90S001',
};

// ---------------------------------------------------------------- chassis, mm (Table 2, Table 31)
export const CH = {
  W: 482.0, // Xa, 18.97 in
  H: 263.2, // Y, 10.36 in
  D: 995.0, // without bezel (1008.77 with bezel)
  Dbezel: 1008.77,
  Wrail: 447.0, // Xb top
  Zear: 35.77, // Za, ear to front face with bezel
  Zwall: 966.0, // Zb, ear to rear wall
  Zfan: 973.0, // Zc, ear to rear GPU fan handle
  U: 6,
};

// chassis-local frame used by the geometry: x right, y up from the floor, z toward the FRONT
export const BOX = {x0: -CH.W / 2, x1: CH.W / 2, y0: 0, y1: CH.H, z0: -CH.D / 2, z1: CH.D / 2};
export const DECK = 152; // the sheet-metal floor of the upper (CPU) deck

// ---------------------------------------------------------------- accelerators (Table 2, Table 10, 26, 27, 32)
// fansRear / slots / weight / acoustics all change with the accelerator, exactly as the guide states.
export const GPUS = {
  h100: {
    key: 'h100', label: 'H100', vendor: 'NVIDIA',
    name: 'NVIDIA HGX H100', mem: '80 GB HBM3', memGB: 80, tdp: 700,
    form: 'SXM5', fabric: 'NVLink 4 · 4× NVSwitch', host: 'PCIe Gen5',
    fansRear: 10, slots: 10, weight: 107.0, weightE3S: 107.75, e3s: true,
    acou: {idle: 6.6, op: 6.7, gpu: 9.7, idle28: 7.2, max35: 10.2}, // Table 27, LwA,m (B)
    os: 'Ubuntu · RHEL · SLES · ESXi',
    note: 'The volume part. 8 SXM5 modules on one HGX baseboard, every GPU one NVLink hop from every other.',
  },
  h200: {
    key: 'h200', label: 'H200', vendor: 'NVIDIA',
    name: 'NVIDIA HGX H200', mem: '141 GB HBM3e', memGB: 141, tdp: 700,
    form: 'SXM5', fabric: 'NVLink 4 · 4× NVSwitch', host: 'PCIe Gen5',
    fansRear: 10, slots: 10, weight: 107.0, weightE3S: 107.75, e3s: true,
    acou: {idle: 6.6, op: 6.7, gpu: 9.7, idle28: 7.2, max35: 10.2},
    os: 'Ubuntu · RHEL · SLES',
    note: 'Same board and the same 700 W as H100, with 141 GB of HBM3e for models that will not fit in 80.',
  },
  h20: {
    key: 'h20', label: 'H20', vendor: 'NVIDIA',
    name: 'NVIDIA HGX H20', mem: '96 GB HBM3', memGB: 96, tdp: 500,
    form: 'SXM5', fabric: 'NVLink 4 · 4× NVSwitch', host: 'PCIe Gen5',
    fansRear: 10, slots: 10, weight: 107.0, weightE3S: 107.75, e3s: true,
    acou: {idle: 6.6, op: 6.7, gpu: 9.7, idle28: 7.2, max35: 10.2},
    os: 'Ubuntu · RHEL · SLES',
    note: '500 W per module instead of 700: the same chassis runs ~1.6 kW cooler at full tilt.',
  },
  a100: {
    key: 'a100', label: 'A100', vendor: 'NVIDIA',
    name: 'NVIDIA HGX A100', mem: '80 GB HBM2e', memGB: 80, tdp: 500,
    form: 'SXM4', fabric: 'NVLink 3 · NVSwitch', host: 'PCIe Gen4',
    fansRear: 10, slots: 10, weight: 105.0, weightE3S: 106.0, e3s: true,
    acou: {idle: 6.6, op: 6.6, gpu: 10.0, idle28: 7.2, max35: 10.1},
    os: 'Ubuntu · RHEL · SLES',
    note: 'The only Gen4 host interface of the six. Loudest of the NVIDIA boards under full GPU load.',
  },
  mi300x: {
    key: 'mi300x', label: 'MI300X', vendor: 'AMD',
    name: 'AMD Instinct MI300X', mem: '192 GB HBM3', memGB: 192, tdp: 750,
    form: 'OAM 2.0 · UBB', fabric: 'Infinity Fabric', host: 'PCIe Gen5',
    fansRear: 10, slots: 10, weight: 113.3, weightE3S: 114.05, e3s: true,
    acou: {idle: 7.4, op: 7.4, gpu: 9.8, idle28: 7.6, max35: 10.2},
    os: 'Ubuntu · RHEL · SLES',
    note: '192 GB per module, the most memory of the six. No SmartNIC/DPU support, and 2 TB of system RAM minimum.',
  },
  gaudi3: {
    key: 'gaudi3', label: 'GAUDI3', vendor: 'Intel',
    name: 'Intel Gaudi3', mem: '128 GB HBM2e', memGB: 128, tdp: 900,
    form: 'OAM 2.0 · UBB', fabric: '6× 800 Gb OSFP on-board', host: 'PCIe Gen5',
    fansRear: 12, slots: 8, weight: 111.7, weightE3S: null, e3s: false,
    acou: {idle: 7.1, op: 7.1, gpu: 8.7, idle28: 7.2, max35: 9.9},
    os: 'Ubuntu · RHEL · SLES',
    note: '900 W a module — so two extra rear fans, slots 33 and 38 blanked for airflow, no fPERC and no E3.S.',
  },
};
export const GPU_ORDER = ['h100', 'h200', 'h20', 'a100', 'mi300x', 'gaudi3'];

// ---------------------------------------------------------------- processors (Tables 7, 8)
export const CPU_5TH = [
  {sku: '8592+', ghz: 1.9, cache: 320, upi: 20, cores: 64, threads: 128, mts: 5600, tdp: 350},
  {sku: '8580', ghz: 2.0, cache: 300, upi: 20, cores: 60, threads: 120, mts: 5600, tdp: 350},
  {sku: '8568Y+', ghz: 2.3, cache: 300, upi: 20, cores: 48, threads: 96, mts: 5600, tdp: 350},
  {sku: '8562Y+', ghz: 2.8, cache: 60, upi: 20, cores: 32, threads: 64, mts: 5600, tdp: 300},
  {sku: '6548Y+', ghz: 2.5, cache: 60, upi: 20, cores: 32, threads: 64, mts: 5200, tdp: 250},
  {sku: '6542Y', ghz: 2.9, cache: 60, upi: 20, cores: 24, threads: 48, mts: 5200, tdp: 250},
];
export const CPU_4TH = [
  {sku: '8480+', ghz: 2.0, cache: 105, upi: 16, cores: 56, threads: 112, mts: 4800, tdp: 350},
  {sku: '8470', ghz: 2.0, cache: 98, upi: 16, cores: 52, threads: 104, mts: 4800, tdp: 350},
  {sku: '8468', ghz: 2.1, cache: 90, upi: 16, cores: 48, threads: 96, mts: 4800, tdp: 350},
  {sku: '8460Y+', ghz: 2.0, cache: 75, upi: 16, cores: 40, threads: 80, mts: 4800, tdp: 300},
  {sku: '8452Y', ghz: 2.0, cache: 67.5, upi: 16, cores: 36, threads: 72, mts: 4800, tdp: 300},
  {sku: '8462Y+', ghz: 2.8, cache: 60, upi: 16, cores: 32, threads: 64, mts: 4800, tdp: 300},
  {sku: '6448Y', ghz: 2.2, cache: 60, upi: 16, cores: 32, threads: 64, mts: 4800, tdp: 225},
  {sku: '6442Y', ghz: 2.6, cache: 45, upi: 16, cores: 24, threads: 48, mts: 4800, tdp: 225},
];
export const CPU_TDP_MAX = 350;

// ---------------------------------------------------------------- PSU (Tables 24, 39, 40)
export const PSUS = {
  2800: {w: 2800, peak: 4760, btu: 10500, volts: '200–240 V AC', amps: '15.6 A', cord: 'C22 inlet · C21→C20 jumper', note: 'The default. Also 240 V DC at 13.6 A.'},
  3000: {w: 3000, peak: 5100, btu: 10900, volts: '209.1–240 V AC', amps: '16 A', cord: 'APP 2006G1', note: 'Multi-rated, and only on the Gaudi3 configuration.'},
  3200: {w: 3200, peak: 5440, btu: 12000, volts: '277 V AC', amps: '13 A', cord: 'APP 2006G1', note: 'US and Canada only. 336 V DC at 11.5 A.'},
};
export const PSU_EFF = [[0.10, 0.90], [0.20, 0.94], [0.50, 0.96], [1.00, 0.94]]; // Table 40, Titanium
export const PSU_COUNT = 6;

// ---------------------------------------------------------------- PCIe (Tables 17–19, Figures 10, 11)
// Physical order across the front face, left to right, with the x position the geometry uses.
export const SLOTS = [
  {n: 31, x: -190, low: true, board: 'PBB', cpu: 2, role: 'SmartNIC / DPU > 75 W'},
  {n: 32, x: -151, board: 'PSB D', riser: 'RS4', cpu: 2, role: 'NIC / InfiniBand / DPU'},
  {n: 33, x: -129, board: 'PSB D', riser: 'RS4', cpu: 2, role: 'NIC / InfiniBand / DPU', gaudiBlocked: true},
  {n: 34, x: -58, board: 'PSB C', riser: 'RS3', cpu: 2, role: 'NIC / InfiniBand / DPU'},
  {n: 35, x: -36, board: 'PSB C', riser: 'RS3', cpu: 2, role: 'NIC / InfiniBand / DPU'},
  {n: 36, x: 36, board: 'PSB B', riser: 'RS2', cpu: 1, role: 'NIC / InfiniBand / DPU'},
  {n: 37, x: 58, board: 'PSB B', riser: 'RS2', cpu: 1, role: 'NIC / InfiniBand / DPU'},
  {n: 38, x: 129, board: 'PSB A', riser: 'RS1', cpu: 1, role: 'NIC / InfiniBand / DPU', gaudiBlocked: true},
  {n: 39, x: 151, board: 'PSB A', riser: 'RS1', cpu: 1, role: 'NIC / InfiniBand / DPU'},
  {n: 40, x: 190, low: true, board: 'PBB', cpu: 1, role: 'SmartNIC / DPU > 75 W'},
];
export const PSB_BOARDS = [
  {name: 'PSB D', x: -118, slots: [32, 33]},
  {name: 'PSB C', x: -24, slots: [34, 35]},
  {name: 'PSB B', x: 70, slots: [36, 37]},
  {name: 'PSB A', x: 164, slots: [38, 39]},
];
export const PRIORITY = '33 · 37 · 35 · 39 · 32 · 36 · 34 · 38 · 31 · 40'; // Table 20, odd slots first

// ---------------------------------------------------------------- memory (Tables 9, 11)
export const MEM = {
  slots: 32, perCpu: 16, channels: 8, dpc: 2, type: 'DDR5 RDIMM, 288-pin',
  speeds: {'5th Gen': '5600 MT/s 1DPC · 4400 MT/s 2DPC', '4th Gen': '4800 MT/s 1DPC · 4400 MT/s 2DPC'},
  caps: [
    {gb: 32, rank: 'dual', min: null, max: 1024},
    {gb: 64, rank: 'dual', min: 1024, max: 2048},
    {gb: 96, rank: 'dual', min: 1536, max: 3072},
    {gb: 128, rank: 'quad', min: 2048, max: 4096},
  ],
  maxTB: 4,
};

// ---------------------------------------------------------------- the subsystems the buttons select
export const SUBS = [
  {
    key: 'chassis', label: 'CHASSIS', n: '00',
    title: 'Chassis · 6U air-cooled',
    blurb: 'A 6U, two-socket rack server built around one 8-GPU baseboard. 263.2 mm tall, 482 mm wide and 995 mm deep without the bezel — longer than a normal rack server, so the rear PDU and the rack door have to be checked before it goes in.',
    rows: [
      ['FORM FACTOR', '6U rack · 2 socket'],
      ['HEIGHT', '263.2 mm (10.36 in)'],
      ['WIDTH', '482.0 mm (18.97 in)'],
      ['DEPTH', '995 mm · 1008.77 mm with bezel'],
      ['EAR → REAR FAN', '973 mm (38.30 in)'],
      ['RAILS', 'Stab-in sliding · optional CMA'],
      ['LIFT', 'Server lift required above 121 lb'],
    ],
  },
  {
    key: 'compute', label: 'COMPUTE', n: '01',
    title: 'Processors and memory',
    blurb: 'Two Xeon Scalable processors on the upper deck, each with 16 DDR5 slots across 8 channels, 80 PCIe Gen5 lanes and four UPI links to its neighbour. The CPUs feed the GPUs; they are not where the work happens.',
    rows: [
      ['SOCKETS', '2 × Socket E (LGA 4677)'],
      ['5TH GEN', 'Emerald Rapids · up to 64C / 128T'],
      ['4TH GEN', 'Sapphire Rapids · up to 56C / 112T'],
      ['MAX TDP', '350 W per socket'],
      ['UPI', '4 links · 20 GT/s (5th) · 16 GT/s (4th)'],
      ['PCIe LANES', '80 Gen5 per socket'],
      ['DIMM SLOTS', '32 × DDR5 RDIMM'],
      ['MAX MEMORY', '4 TB (32 × 128 GB quad-rank)'],
    ],
  },
  {
    key: 'gpu', label: 'ACCELERATORS', n: '02',
    title: 'Eight-GPU baseboard',
    blurb: 'One baseboard carries all eight accelerators and their fabric, and occupies the whole lower deck behind the PCIe cards. The board is what you choose when you buy the machine: HGX for NVIDIA, UBB for AMD and Intel. Slots 21–28.',
    rows: [], // filled live from the chosen accelerator
  },
  {
    key: 'pcie', label: 'PCIe', n: '03',
    title: 'PCIe Gen5 expansion',
    blurb: 'Ten x16 Gen5 slots, all full-height half-length, all loaded from the front. Eight sit on four PCIe switch boards behind the card cage; slots 31 and 40 come off the PCIe base board and are the two that take a SmartNIC or DPU over 75 W.',
    rows: [
      ['TOTAL SLOTS', '10 × x16 Gen5 FH/HL'],
      ['ON SWITCH BOARDS', '8 — slots 32…39 (PSB A–D)'],
      ['ON BASE BOARD', '2 — slots 31 and 40'],
      ['RISERS', 'RS1 · RS2 · RS3 · RS4'],
      ['HIGH-POWER DPU', 'Slots 31 and 40 only'],
      ['FILL ORDER', PRIORITY],
      ['HOT-SWAP', 'No — slots are not hot-swappable'],
    ],
  },
  {
    key: 'storage', label: 'STORAGE', n: '04',
    title: 'Front drives and boot',
    blurb: 'Three front bay options and a separate boot device at the back. The NVMe bays hang straight off the PCIe switch boards; only the SAS4/SATA option needs the front PERC.',
    rows: [
      ['OPTION C01', '16 × E3.S NVMe direct (S160)'],
      ['OPTION C02', '8 × 2.5-inch SAS4/SATA + fPERC12'],
      ['OPTION C03', '8 × 2.5-inch NVMe direct (S160)'],
      ['CONTROLLER', 'PERC H965i (SAS4/SATA)'],
      ['BOOT', 'BOSS-N1 · 2 × M.2 NVMe · HW RAID 1'],
      ['E3.S LINK', 'x4 Gen5 direct from the PSB'],
      ['HOT-SWAP', 'All front bays'],
    ],
  },
  {
    key: 'power', label: 'POWER', n: '05',
    title: 'Six Titanium supplies',
    blurb: 'Six 86 mm 54 V supplies across the top of the rear. Either 5+1 — one spare, full performance — or 3+3 fault-tolerant, which keeps the machine up through a feed failure but throttles it if more than one supply is down.',
    rows: [
      ['COUNT', '6 × hot-swap · 86 mm form factor'],
      ['RATINGS', '2800 W · 3000 W · 3200 W Titanium'],
      ['REDUNDANCY', '5+1 full perf · 3+3 fault tolerant'],
      ['EFFICIENCY', '96% at 50% load (Titanium)'],
      ['BUS', '54 V DC internal'],
      ['3200 W', 'US and Canada only'],
      ['3000 W', 'Gaudi3 configuration only'],
      ['POWER CAP', 'Not available from 7.00.60.00'],
    ],
  },
  {
    key: 'cooling', label: 'COOLING', n: '06',
    title: 'Sixteen fans, two paths',
    blurb: 'Six high-performance fans on the mid tray pull air over the processors and memory; ten more across the rear pull it through the GPU heatsinks and the PCIe cards. N+1 redundant: one rotor can fail and the machine keeps running.',
    rows: [
      ['MID TRAY', '6 × HPR Gold (fans 1–6)'],
      ['REAR', '10 × HPR GPU fans (fans 7–16)'],
      ['GAUDI3', '12 rear fans'],
      ['REDUNDANCY', 'N+1 · one rotor failure tolerated'],
      ['CONTROL', 'Open and closed loop, per sensor'],
      ['AMBIENT', '10–35 °C (ASHRAE A2)'],
      ['ALTITUDE', '1 °C derate per 300 m above 900 m'],
      ['COOLING', 'Air only'],
    ],
  },
  {
    key: 'io', label: 'NETWORK & I/O', n: '07',
    title: 'Embedded networking and ports',
    blurb: 'A two-port 1 GbE LOM for management-adjacent traffic, one OCP 3.0 slot for the real host NIC, and the rear service ports. Everything fast goes through the ten PCIe slots instead.',
    rows: [
      ['LOM', '2 × 1 GbE (Broadcom BCM5720)'],
      ['OCP', 'OCP 3.0 SFF · x8 Gen4 · up to 4 ports'],
      ['OCP SPEEDS', '25 GbE SFP28 · 10 GbE BT · 35 W'],
      ['REAR PORTS', 'USB 3.0 · USB 2.0 · VGA · iDRAC 1 GbE'],
      ['FRONT PORTS', 'USB 2.0 · VGA · iDRAC Direct micro-AB'],
      ['VIDEO', 'Matrox G200 · 16 MB · 1920×1200'],
      ['GAUDI3 ONLY', '6 × 800 Gb OSFP on the GPU board'],
      ['MANAGEMENT', 'iDRAC9 · Redfish · OpenManage'],
    ],
  },
];

// ---------------------------------------------------------------- the model
// One input — the accelerator, the workload fraction and the inlet air temperature — drives the power
// budget, the fan speed, the airflow and the sound. Everything below is DERIVED; the console labels it.

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;

/** Titanium efficiency at a per-supply load fraction, interpolated from Table 40. */
export function psuEfficiency(frac) {
  const f = clamp(frac, 0.02, 1);
  if (f <= PSU_EFF[0][0]) return PSU_EFF[0][1];
  for (let i = 0; i < PSU_EFF.length - 1; i++) {
    const [x0, y0] = PSU_EFF[i];
    const [x1, y1] = PSU_EFF[i + 1];
    if (f <= x1) return lerp(y0, y1, (f - x0) / (x1 - x0));
  }
  return PSU_EFF[PSU_EFF.length - 1][1];
}

/**
 * state: {gpu key, load 0..1 (GPU utilisation), ambient °C, psu rating, redundancy '5+1'|'3+3', drives}
 * Returns the DC budget, the fan duty, airflow, the AC draw and the sound level.
 */
export function model({gpu = 'h100', load = 0, ambient = 25, psu = 2800, redundancy = '5+1'} = {}) {
  const g = GPUS[gpu];
  const fansRear = g.fansRear;
  const fans = 6 + fansRear;

  // --- fan duty: idle floor, the GPU load, and the inlet air. 35 °C at full load is 100%.
  const duty = clamp(0.26 + 0.56 * Math.pow(load, 0.85) + 0.018 * (ambient - 25) * (0.5 + load), 0.22, 1);
  const perFanW = 8 + 72 * Math.pow(duty, 3); // a 2U HPR Gold fan: a few watts idling, ~80 W flat out
  const fanW = fans * perFanW;
  const cfmPerFan = 18 + 92 * duty;
  const cfm = fans * cfmPerFan;

  // --- the DC budget
  const gpuW = 8 * g.tdp * (0.12 + 0.88 * load);
  const cpuW = 2 * CPU_TDP_MAX * (0.22 + 0.5 * load); // the CPUs feed the GPUs, they rarely saturate
  const memW = MEM.slots * (2.5 + 5.5 * load);
  const pcieW = g.slots * (18 + 42 * load); // ten 400G NICs in the slots
  const baseW = 190; // boards, BMC, drives, BOSS, OCP, LOM
  const dc = gpuW + cpuW + memW + pcieW + fanW + baseW;

  // --- the supplies
  const active = redundancy === '3+3' ? 3 : PSU_COUNT - 1; // 5+1 spares one, 3+3 runs on one feed
  const per = dc / active;
  const eff = psuEfficiency(per / psu);
  const ac = dc / eff;
  const btu = ac * 3.412;
  const headroom = active * psu - dc;

  // --- sound: the guide's measured points, interpolated. Table 27.
  const a = g.acou;
  const at25 = lerp(a.idle, a.gpu, Math.pow(load, 0.75));
  const amb = ambient <= 28
    ? lerp(0, a.idle28 - a.idle, clamp((ambient - 25) / 3, 0, 1))
    : lerp(a.idle28 - a.idle, a.max35 - a.gpu, clamp((ambient - 28) / 7, 0, 1));
  const lwa = clamp(at25 + amb * (1 - 0.5 * load), 6.0, 10.6);
  const lpa = Math.round(52 + (lwa - 6.6) * 10.6); // the guide's LwA/LpA pairs track at ~10.6 dB per bel

  return {
    gpu: g, load, ambient, duty, rpm: Math.round(2600 + 10400 * duty),
    fans, fansRear, cfm: Math.round(cfm),
    parts: [
      {k: 'gpu', label: `8 × ${g.label}`, w: gpuW},
      {k: 'pcie', label: `${g.slots} × PCIe CARD`, w: pcieW},
      {k: 'cooling', label: `${fans} × FAN`, w: fanW},
      {k: 'compute', label: '2 × CPU', w: cpuW},
      {k: 'compute', label: '32 × DIMM', w: memW},
      {k: 'io', label: 'BOARDS · BMC · I/O', w: baseW},
    ],
    dc, ac, btu, eff, per, active, headroom, psu, redundancy,
    lwa, lpa,
    weight: g.weight,
  };
}

export const FACTS = {
  maxDC: () => Math.round(model({gpu: 'gaudi3', load: 1, ambient: 35}).dc),
};
