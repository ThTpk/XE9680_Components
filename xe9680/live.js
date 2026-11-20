// The XE9680 as a page you drive. Eight subsystem buttons isolate a part of the machine, six views
// move the camera, five display toggles take it apart, and the two sliders set the operating point
// that every number and the fan speed come from. Left alone it plays the tour with the operator's
// cursor; a click, drag, wheel or key hands control over, 22 s of quiet hands it back.
import {warmComposer} from './warm.js';
import {createConsole, DISPLAY, DRIVES, SUB_KEYS, VIEWS} from './console.js';
import {GPU_ORDER, GPUS, model, SUBS} from './spec.js';
import {createStage} from './stage.js';
import {ambientAt, camAt, DURATION, displayAt, easedDisplay, gpuAt, loadAt, makeCursor, SCRIPT, subAt, VIEW_FN, viewAt} from './tour.js';

const W = 1600;
const H = 900;
const IDLE = 22;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smoother = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
// how far each view pulls back as the machine comes apart
const EX_PULL = {hero: 0.78, front: 0.5, rear: 0.5, top: 0.42, gputray: 0.26, cputray: 0.26};

const CSS = `
html,body{background:#e9edf1;overflow:hidden;margin:0}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{position:absolute;left:0;top:0;width:${W}px;height:${H}px;touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.bt{pointer-events:auto;cursor:pointer}
.bt:hover{filter:brightness(.97)}
.hit{position:absolute;pointer-events:auto;cursor:ew-resize}
.tourchip{position:absolute;left:800px;top:100px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:22px;padding:0 11px;border:1px solid #d7dfe7;border-radius:4px;background:rgba(255,255,255,.95);color:#101620;font:700 9px 'JetBrains Mono',monospace;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto;z-index:60}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#0b74d4}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:16px;text-align:center;font:600 12px/1.4 'JetBrains Mono',monospace;letter-spacing:1px;color:#8b96a2;text-transform:uppercase;display:none}
@media (orientation:portrait) and (max-width:860px){.turn{display:block}}
`;

export function runLive() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const st = createStage({canvas});
  const ui = createConsole(app);
  const tourCursor = makeCursor(ui);

  // ------------------------------------------------------------ quality tiers
  const TIERS = [
    {samples: 8, ao: true, shadow: 2048, pr: 2},
    {samples: 4, ao: false, shadow: 1024, pr: 1.5},
    {samples: 2, ao: false, shadow: 1024, pr: 1},
  ];
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  let tier = light ? 2 : 0;
  let scale = 1;
  const fit = () => {
    scale = Math.min(innerWidth / W, innerHeight / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
    st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  const applyTier = () => {
    const {pr, ...q} = TIERS[tier];
    st.setQuality(q);
    fit();
  };
  applyTier();
  addEventListener('resize', fit);
  const toStage = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };
  const tourChip = document.createElement('div');
  tourChip.className = 'tourchip';
  ui.root.appendChild(tourChip);
  const note = document.createElement('div');
  note.className = 'turn';
  note.textContent = 'Turn your phone sideways for the full console';
  document.body.appendChild(note);

  // ------------------------------------------------------------ state
  let T = 0;
  let sub = 'chassis';
  let subT = 0;
  let view = 'hero';
  let viewAt0 = 0;
  let gpu = 'h100';
  let drives = 'u2';
  let load = 0.12;
  let ambient = 22;
  let spin = 0;
  let lidOpen = 0;
  const disp = Object.fromEntries(DISPLAY.map((k) => [k, {on: 0, t: -9}]));
  const fade = Object.fromEntries(SUB_KEYS.map((k) => [k, 1]));
  const off = {az: 0, el: 0, k: 1};
  const cam = {...VIEW_FN.hero(0)};
  let ring = {t: -9, x: 0, y: 0};
  const eased = (k, dur = 0.8) => {
    const d = disp[k];
    const x = ss(d.t, d.t + dur, T);
    return d.on ? x : 1 - x;
  };
  const pulse = (k) => (ring = {t: T, x: ui.spots[k][0], y: ui.spots[k][1]});

  // ------------------------------------------------------------ the tour
  const AP = {on: true, t0: 0, loop: 0};
  let lastInput = 0;
  const startTour = () => {
    AP.on = true;
    AP.t0 = T;
    AP.loop = 0;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    const cyc = (T - AP.t0) % DURATION;
    const [t0, v] = viewAt(cyc);
    view = v;
    viewAt0 = T - (cyc - t0);
  };
  tourChip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    lastInput = T;
    if (AP.on) takeOver();
    else startTour();
  });
  addEventListener('pointerdown', (e) => {
    if (e.target !== tourChip) takeOver();
  });

  // ------------------------------------------------------------ controls
  const setGpu = (k) => {
    gpu = k;
    st.server.setGpu(k);
    if (!GPUS[k].e3s && drives === 'e3s') setDrives('u2');
  };
  const setDrives = (k) => {
    if (k === 'e3s' && !GPUS[gpu].e3s) return;
    drives = k;
    st.server.setDrives(k);
  };
  const setSub = (k) => {
    if (sub !== k) subT = T;
    sub = k;
  };
  for (const k of GPU_ORDER)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulse(k);
      setGpu(k);
    });
  for (const k of DRIVES)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulse(k);
      setDrives(k);
    });
  for (const k of SUB_KEYS)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulse(k);
      setSub(k);
    });
  for (const v of VIEWS)
    ui.btn[v].addEventListener('click', () => {
      takeOver();
      pulse(v);
      view = v;
      viewAt0 = T;
      Object.assign(off, {az: 0, el: 0, k: 1});
    });
  for (const k of DISPLAY)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulse(k);
      disp[k].on = disp[k].on ? 0 : 1;
      disp[k].t = T;
    });

  const slider = (box, y, apply) => {
    const d = document.createElement('div');
    d.className = 'hit';
    Object.assign(d.style, {left: `${box.x - 10}px`, top: `${y - 12}px`, width: `${box.w + 20}px`, height: '24px'});
    const move = (e) => {
      const [x] = toStage(e.clientX, e.clientY);
      apply(clamp((x - box.x) / box.w, 0, 1));
      lastInput = T;
    };
    d.addEventListener('pointerdown', (e) => {
      takeOver();
      d.setPointerCapture(e.pointerId);
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      move(e);
    });
    ui.root.appendChild(d);
  };
  slider(ui.LD, ui.LD.y, (k) => (load = k));
  slider(ui.AM, ui.AM.y, (k) => (ambient = 10 + k * 25));

  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    const v = VIEWS[Number(key) - 1];
    if (v) ui.btn[v].click();
    else if (key === 'e') ui.btn.explode.click();
    else if (key === 'l') ui.btn.labels.click();
    else if (key === 'x') ui.btn.xray.click();
    else if (key === 'a') ui.btn.airflow.click();
    else if (key === 'o') ui.btn.orbit.click();
    else if (key === '[' || key === ']') {
      takeOver();
      const i = GPU_ORDER.indexOf(gpu);
      setGpu(GPU_ORDER[(i + (key === ']' ? 1 : GPU_ORDER.length - 1)) % GPU_ORDER.length]);
    } else if (key === ' ') {
      lastInput = T;
      if (AP.on) takeOver();
      else startTour();
    } else return;
    e.preventDefault();
  });

  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    off.az += ((e.clientX - drag.x) / scale) * 0.26;
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.18, -28, 62);
    drag = {x: e.clientX, y: e.clientY};
    lastInput = T;
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      takeOver();
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.45, 2.2);
    },
    {passive: false},
  );

  // ------------------------------------------------------------ the callouts
  const stackCallouts = (o) => {
    if (o < 0.02) return [];
    const mine = st.server.parts.filter((p) => p.sub === sub || (sub === 'chassis' && p.sub === 'chassis'));
    const pts = mine
      .map((p) => ({p, at: p.node.visible ? st.anchor(p) : null}))
      .filter((x) => x.at && x.at[0] > 330 && x.at[0] < 1270 && x.at[1] > 110 && x.at[1] < 760);
    const L = pts.filter((x) => x.at[0] < 800).sort((a, b) => a.at[1] - b.at[1]);
    const R = pts.filter((x) => x.at[0] >= 800).sort((a, b) => a.at[1] - b.at[1]);
    const out = [];
    const stack = (col, x, w) => {
      let y = 126;
      for (const c of col.slice(0, 7)) {
        y = Math.max(y, Math.min(700, c.at[1] - 10));
        out.push({name: c.p.name, sub: c.p.note, at: c.at, label: [x, y], w, o});
        y += 36;
      }
    };
    stack(L, 338, 172);
    stack(R, 1074, 172);
    return out;
  };

  // ------------------------------------------------------------ the frame
  startTour();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    T += dt;
    if (tier < TIERS.length - 1) {
      perf.age += dt;
      if (perf.age > 2) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.5 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.029 ? perf.slow + 1 : 0;
          perf.sum = 0;
          perf.n = 0;
          if (perf.slow >= 2) {
            tier++;
            applyTier();
            Object.assign(perf, {age: 0, slow: 0});
          }
        }
      }
    }

    let tgt;
    let cursor;
    let since;
    let display;
    let explode;
    let xray;
    let air;
    let labels;
    if (AP.on) {
      const c = T - AP.t0;
      const cyc = c % DURATION;
      if (gpuAt(cyc) !== gpu) setGpu(gpuAt(cyc));
      setSub(subAt(cyc));
      load = loadAt(cyc);
      ambient = ambientAt(cyc);
      display = displayAt(cyc);
      for (const k of DISPLAY) disp[k].on = display[k];
      explode = easedDisplay('explode', cyc, 1.1);
      xray = easedDisplay('xray', cyc);
      air = easedDisplay('airflow', cyc);
      labels = easedDisplay('labels', cyc, 0.5);
      tgt = camAt(cyc, display.orbit);
      const [t0, v] = viewAt(cyc);
      view = v;
      since = cyc - t0;
      cursor = tourCursor(cyc);
      if (cyc < 0.8 && c > DURATION) {
        const end = tourCursor(DURATION - 0.01);
        const k = ss(0, 0.8, cyc);
        cursor = {...cursor, x: end.x + (cursor.x - end.x) * k, y: end.y + (cursor.y - end.y) * k};
      }
    } else {
      if (T - lastInput > IDLE) startTour();
      since = T - viewAt0;
      display = Object.fromEntries(DISPLAY.map((k) => [k, disp[k].on]));
      explode = eased('explode', 1.1);
      xray = eased('xray');
      air = eased('airflow');
      labels = eased('labels', 0.5);
      tgt = VIEW_FN[view](since);
      tgt.az += off.az + (disp.orbit.on ? 15 * (T - disp.orbit.t) : 0);
      tgt.el = clamp(tgt.el + off.el, -24, 86);
      tgt.d *= off.k;
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y};
    }

    // the model: one operating point, every number and the fan speed from it
    const m = model({gpu, load, ambient, psu: gpu === 'gaudi3' ? 3000 : 2800});
    spin += dt * m.duty * 46;

    // the camera pulls back as the machine comes apart
    const k = 1 - Math.exp(-dt / (AP.on ? 0.2 : 0.4));
    const want = {...tgt, d: tgt.d * (1 + EX_PULL[view] * explode), ty: tgt.ty + 0.055 * explode};
    cam.az += wrap(want.az - cam.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy']) cam[key] += (want[key] - cam[key]) * k;

    // isolating a subsystem: everything else goes to a ghost
    const isoK = sub === 'chassis' ? 0 : ss(subT, subT + 0.45, T);
    for (const key of SUB_KEYS) {
      const want2 = sub === 'chassis' || key === sub ? 1 : key === 'chassis' ? 0.13 : 0.24;
      fade[key] += (want2 - fade[key]) * (1 - Math.exp(-dt / 0.16));
    }
    void isoK;
    st.server.root.position.y = 0.004 + explode * 0.215;
    lidOpen += ((view === 'top' ? 1 : 0) - lidOpen) * (1 - Math.exp(-dt / 0.35));
    st.frame(
      {explode, fade, xray, air, spin, t: T, duty: m.duty, lidOpen},
      {...cam, az: cam.az * D2R, el: cam.el * D2R},
    );

    const g = GPUS[gpu];
    ui.update({
      sub, view, gpu, drives, display, load, ambient, model: m,
      rowsKey: `${sub}:${gpu}:${drives}`,
      gpuRows: [
        ['MODULES', `8 × ${g.name}`],
        ['MEMORY', `${g.mem} · ${g.memGB * 8} GB total`],
        ['BOARD TDP', `${(g.tdp * 8) / 1000} kW (8 × ${g.tdp} W)`],
        ['FORM FACTOR', g.form],
        ['FABRIC', g.fabric],
        ['HOST LINK', g.host],
        ['SYSTEM WEIGHT', `${g.weight} kg fully populated`],
        ['OS SUPPORT', g.os],
      ],
      callouts: stackCallouts(labels * ss(0.9, 1.5, since)),
      cursor,
    });

    if (tourChip.classList.contains('on') !== AP.on || !tourChip.firstChild) {
      tourChip.classList.toggle('on', AP.on);
      tourChip.innerHTML = AP.on ? '<i></i>AUTO TOUR · CLICK ANYWHERE TO TAKE OVER' : '▶ RESUME TOUR';
    }
    if (!window.SIM_SHOWN) {
      window.SIM_SHOWN = true;
      dispatchEvent(new Event('simframe'));
    }
    requestAnimationFrame(frame);
  };
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {
    st, cam, startTour, takeOver, ui,
    reset() {
      takeOver();
      for (const k of DISPLAY) {
        disp[k].on = 0;
        disp[k].t = T - 3;
      }
      Object.assign(off, {az: 0, el: 0, k: 1});
    },
    set(o) {
      takeOver();
      if (o.gpu) setGpu(o.gpu);
      if (o.drives) setDrives(o.drives);
      if (o.sub) setSub(o.sub);
      if (o.view) {
        view = o.view;
        viewAt0 = T;
      }
      if (o.load !== undefined) load = o.load;
      if (o.ambient !== undefined) ambient = o.ambient;
      if (o.display) for (const k of o.display) {
        disp[k].on = 1;
        disp[k].t = T - 3;
      }
    },
    get tier() {
      return tier;
    },
    get T() {
      return T;
    },
  };
  void SCRIPT;
  void SUBS;
}
