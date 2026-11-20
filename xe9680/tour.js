// The views, and the tour the page plays when nobody is touching it: a walk through every subsystem,
// the machine coming apart, the accelerator swapped for the 900 W one, and the load run up to full.
// Everything here is a pure function of tour time, so the page and a captured still agree.
import {DISPLAY} from './console.js';

export const SCRIPT = [
  {t: 0.0, view: 'hero', sub: 'chassis'},
  {t: 2.2, display: 'labels'},
  {t: 5.0, view: 'front'},
  {t: 6.2, sub: 'storage'},
  {t: 9.0, view: 'hero', sub: 'pcie'},
  {t: 12.0, display: 'explode'},
  {t: 16.4, sub: 'gpu', view: 'gputray'},
  {t: 20.0, display: 'explode'},
  {t: 21.4, view: 'cputray', sub: 'compute'},
  {t: 25.0, view: 'top'},
  {t: 25.6, display: 'xray'},
  {t: 28.6, view: 'rear', sub: 'power'},
  {t: 32.0, sub: 'cooling'},
  {t: 32.6, display: 'airflow'},
  {t: 35.6, view: 'hero'},
  {t: 36.2, display: 'xray'},
  {t: 38.6, gpu: 'gaudi3'},
  {t: 42.4, sub: 'io'},
  {t: 45.0, display: 'orbit'},
  {t: 48.4, gpu: 'h100'},
  {t: 50.0, display: 'labels'},
  {t: 50.4, display: 'airflow'},
  {t: 51.2, display: 'orbit'},
  {t: 51.6, sub: 'chassis'},
];
export const DURATION = 54;

// the GPU load the tour runs the machine at
const LOAD_KEYS = [[0, 0.12], [9, 0.12], [13, 0.45], [26, 0.45], [31, 1.0], [40, 1.0], [46, 0.62], [52, 0.12], [54, 0.12]];
const AMB_KEYS = [[0, 22], [30, 22], [34, 33], [44, 33], [50, 22], [54, 22]];
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
const keyed = (keys, t) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i];
    const [t1, v1] = keys[i + 1];
    if (t <= t1) return v0 + (v1 - v0) * smoother((t - t0) / (t1 - t0));
  }
  return keys[keys.length - 1][1];
};
export const loadAt = (t) => keyed(LOAD_KEYS, t);
export const ambientAt = (t) => keyed(AMB_KEYS, t);

export const subAt = (t) => SCRIPT.filter((e) => e.sub && e.t <= t).pop()?.sub ?? 'chassis';
export const gpuAt = (t) => SCRIPT.filter((e) => e.gpu && e.t <= t).pop()?.gpu ?? 'h100';
export const displayAt = (t) => {
  const out = Object.fromEntries(DISPLAY.map((k) => [k, 0]));
  for (const e of SCRIPT) if (e.display && e.t <= t) out[e.display] = out[e.display] ? 0 : 1;
  return out;
};
const lastFlip = (key, t) => SCRIPT.filter((e) => e.display === key && e.t <= t).pop()?.t ?? -9;
export const easedDisplay = (key, t, dur = 0.8) => {
  const on = displayAt(t)[key];
  const k = ss(lastFlip(key, t), lastFlip(key, t) + dur, t);
  return on ? k : 1 - k;
};

// ---------------------------------------------------------------- the views
// target in metres in the chassis frame, az/el in degrees, d in metres. u = seconds on this view.
export const VIEW_FN = {
  hero: (u) => ({tx: 0, ty: 0.125, tz: 0, az: 26 + 1.6 * u, el: 20, d: 1.86, sx: 0, sy: -14}),
  front: (u) => ({tx: 0, ty: 0.128, tz: 0.16, az: -2 + 1.2 * u, el: 7, d: 1.26, sx: 0, sy: -14}),
  rear: (u) => ({tx: 0, ty: 0.135, tz: -0.18, az: 182 - 1.2 * u, el: 9, d: 1.26, sx: 0, sy: -14}),
  top: (u) => ({tx: 0, ty: 0.1, tz: 0, az: 90 + 0.8 * u, el: 80, d: 2.0, sx: 0, sy: -10}),
  gputray: (u) => ({tx: 0, ty: 0.055, tz: -0.02, az: 34 + 2.2 * u, el: 16, d: 1.22, sx: 0, sy: -14}),
  cputray: (u) => ({tx: 0, ty: 0.2, tz: 0.05, az: 26 + 2.0 * u, el: 29, d: 1.36, sx: 0, sy: -14}),
};
const VIEWS = SCRIPT.filter((e) => e.view).map((e) => [e.t, e.view]);
const blend = (a, b, k) => {
  const o = {};
  for (const key in b) o[key] = key === 'az' ? a.az + ((((b.az - a.az + 540) % 360) - 180) * k) : a[key] + (b[key] - a[key]) * k;
  const swing = Math.min(1, Math.abs(((b.az - a.az + 540) % 360) - 180) / 90);
  o.d += Math.max(0, Math.max(a.d, b.d) + 0.4 * swing - o.d) * Math.sin(Math.PI * k);
  return o;
};
export const camAt = (t, orbit = 0) => {
  let i = 0;
  while (i < VIEWS.length - 1 && VIEWS[i + 1][0] <= t) i++;
  const cur = VIEW_FN[VIEWS[i][1]](t - VIEWS[i][0]);
  let o = cur;
  if (i > 0) {
    const k = ss(VIEWS[i][0], VIEWS[i][0] + 1.5, t);
    if (k < 1) o = blend(VIEW_FN[VIEWS[i - 1][1]](t - VIEWS[i - 1][0]), cur, k);
  }
  if (orbit > 0) o = {...o, az: o.az + 15 * Math.max(0, t - lastFlip('orbit', t)) * orbit};
  return o;
};
export const viewAt = (t) => VIEWS.filter(([a]) => a <= t).pop();

// ---------------------------------------------------------------- the operator's pointer
const REST = [[800, 470], [700, 400], [900, 520], [760, 360]];
export function makeCursor(ui) {
  const EV = SCRIPT.filter((e) => e.t > 0).flatMap((e) => {
    const out = [];
    if (e.sub && ui.spots[e.sub]) out.push({t: e.t, spot: ui.spots[e.sub]});
    if (e.view && ui.spots[e.view]) out.push({t: e.t + (e.sub ? 0.4 : 0), spot: ui.spots[e.view]});
    if (e.display && ui.spots[e.display]) out.push({t: e.t, spot: ui.spots[e.display]});
    if (e.gpu && ui.spots[e.gpu]) out.push({t: e.t, spot: ui.spots[e.gpu]});
    return out;
  });
  const WP = [[0, 820, 560]];
  EV.forEach((e, i) => {
    WP.push([e.t - 0.18, ...e.spot], [e.t + 0.24, ...e.spot]);
    WP.push([e.t + 1.5, ...REST[i % REST.length]]);
  });
  WP.sort((a, b) => a[0] - b[0]);
  return (t) => {
    let i = 0;
    while (i < WP.length - 2 && t > WP[i + 1][0]) i++;
    const [t0, x0, y0] = WP[i];
    const [t1, x1, y1] = WP[i + 1];
    const k = ss(t0, t1, t);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const bow = Math.sin(Math.PI * k) * Math.min(26, len * 0.07);
    let press = false;
    let ring = 0;
    let rx = 0;
    let ry = 0;
    for (const e of EV) {
      if (t >= e.t - 0.07 && t < e.t + 0.1) press = true;
      if (t >= e.t && t < e.t + 0.55) {
        ring = 1 - (t - e.t) / 0.55;
        [rx, ry] = e.spot;
      }
    }
    return {
      x: x0 + (x1 - x0) * k + (len ? (-(y1 - y0) / len) * bow : 0),
      y: y0 + (y1 - y0) * k + (len ? ((x1 - x0) / len) * bow : 0),
      press, ring, ringX: rx, ringY: ry,
    };
  };
}
