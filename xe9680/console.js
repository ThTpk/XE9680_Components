// The console around the machine, laid out at a fixed 1600 × 900 and scaled to fit the window:
// the subsystem card on the left with its specification rows, the power budget under it, the pickers
// on the right, the load and inlet-air sliders along the bottom, and the callouts with leaders into
// the 3D. update(s) redraws every live part from the frame's state.
import {DOC, GPU_ORDER, GPUS, SUBS} from './spec.js';

export const C = {
  ink: '#101620', mute: '#6b7784', faint: '#ccd5de', line: '#dfe6ec',
  panel: 'rgba(255,255,255,.94)', acc: '#0b74d4', warm: '#e0601f', good: '#1f9d63', track: '#e7ecf1',
};
export const VIEWS = ['hero', 'front', 'rear', 'top', 'gputray', 'cputray'];
export const VIEW_LABEL = {hero: 'HERO', front: 'FRONT', rear: 'REAR', top: 'TOP', gputray: 'GPU TRAY', cputray: 'CPU TRAY'};
export const DISPLAY = ['explode', 'labels', 'xray', 'airflow', 'orbit'];
export const DISPLAY_LABEL = {explode: 'EXPLODE', labels: 'LABELS', xray: 'X-RAY', airflow: 'AIRFLOW', orbit: 'ORBIT'};
export const DRIVES = ['u2', 'e3s'];
export const DRIVE_LABEL = {u2: '8 × U.2', e3s: '16 × E3.S'};
export const SUB_KEYS = SUBS.map((s) => s.key);

const PW = {
  gpu: C.acc, pcie: '#4b9ae4', cooling: '#61c0e8', compute: '#1d3f66', io: '#9fb4c6', power: '#e0601f',
};

const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.mo{font-family:'JetBrains Mono',ui-monospace,monospace}
.cp{position:absolute;background:${C.panel};border:1px solid ${C.line};border-radius:7px;box-shadow:0 2px 14px rgba(30,60,95,.07)}
.ph{position:absolute;display:flex;align-items:center;gap:9px;font:700 10.5px 'JetBrains Mono',monospace;letter-spacing:1.8px}
.ph i{display:block;width:3px;height:13px;background:${C.acc}}
.pn{position:absolute;font:500 9.5px 'JetBrains Mono',monospace;color:${C.mute};letter-spacing:1px}
.sm{font:500 9px 'JetBrains Mono',monospace;letter-spacing:1.6px;color:${C.mute};text-transform:uppercase;white-space:nowrap}
.bt{position:absolute;height:22px;padding:0 9px;display:flex;align-items:center;justify-content:center;border:1px solid ${C.faint};border-radius:4px;background:#fff;font:700 9.2px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${C.ink};white-space:nowrap;transition:background .14s,color .14s,border-color .14s}
.bt.on{background:${C.acc};border-color:${C.acc};color:#fff}
.call{position:absolute;white-space:nowrap;background:rgba(255,255,255,.9);border:1px solid #e3e9ef;border-radius:4px;padding:4px 8px 5px;box-shadow:0 1px 6px rgba(30,60,95,.1)}
.call b{display:flex;align-items:center;gap:6px;font:700 9.4px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${C.ink}}
.call b i{display:block;width:6px;height:6px;background:${C.acc}}
.call span{display:block;font:500 7.8px 'JetBrains Mono',monospace;letter-spacing:1.1px;color:${C.mute};margin-top:2px}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.ring{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1.5px solid ${C.acc};opacity:0;z-index:49}
.rowk{position:absolute;font:500 8.6px 'JetBrains Mono',monospace;letter-spacing:1.1px;color:${C.mute};white-space:nowrap}
.rowv{position:absolute;font:600 9.6px 'JetBrains Mono',monospace;letter-spacing:.3px;color:${C.ink};white-space:nowrap;text-align:right}
`;

const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = el(`<div class="ui"></div>`);
  app.appendChild(ui);
  const add = (h) => {
    const n = el(h);
    ui.appendChild(n);
    return n;
  };
  const panel = (x, y, w, h, title, n) => {
    add(`<div class="cp" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`);
    add(`<div class="ph" style="left:${x + 14}px;top:${y + 13}px"><i></i>${title}</div>`);
    add(`<div class="pn" style="right:${1600 - x - w + 14}px;top:${y + 15}px">${n}</div>`);
  };
  const btn = {};
  const btnRow = (keys, labels, x0, y, wmax, step = 27) => {
    let x = x0;
    let yy = y;
    for (const k of keys) {
      const w = Math.round(labels[k].length * 6.6 + 20);
      if (x + w > x0 + wmax) {
        x = x0;
        yy += step;
      }
      btn[k] = add(`<div class="bt" style="left:${x}px;top:${yy}px;width:${w}px">${labels[k]}</div>`);
      x += w + 6;
    }
    return yy + step;
  };

  // ------------------------------------------------------------ header
  add(`<div style="position:absolute;left:0;top:0;width:168px;height:92px;background:${C.acc}"></div>`);
  add(`<svg style="position:absolute;left:28px;top:30px" width="52" height="32" viewBox="0 0 52 32"><g fill="#fff"><path d="M2 2h12a14 14 0 0 1 0 28H2zM9 9v14h5a7 7 0 0 0 0-14z"/><path d="M32 2h7v21h11v7H32z"/></g></svg>`);
  add(`<div class="sm" style="position:absolute;left:192px;top:20px;letter-spacing:2.4px">${DOC.vendor.toUpperCase()} · ${DOC.regModel}</div>`);
  add(`<div style="position:absolute;left:191px;top:34px;font-size:33px;font-weight:700;letter-spacing:-.7px;line-height:1">Dell PowerEdge XE9680 <span style="color:${C.acc};font-weight:400">/</span></div>`);
  add(`<div class="mo" style="position:absolute;left:192px;top:74px;font-size:11px;letter-spacing:2.1px;color:#5d6873">6U AI TRAINING SERVER · 8-GPU TEARDOWN</div>`);
  const hdrGpu = add(`<div class="mo" style="position:absolute;right:252px;top:40px;text-align:right;font-size:11.5px;font-weight:700;letter-spacing:2px;color:${C.acc}"></div>`);
  const hdrSub = add(`<div class="sm" style="position:absolute;right:252px;top:58px;text-align:right"></div>`);
  add(`<div style="position:absolute;right:228px;top:30px;width:1px;height:44px;background:${C.faint}"></div>`);
  add(`<div style="position:absolute;right:112px;top:30px;color:${C.acc};font-size:38px;font-weight:700;letter-spacing:-1px;line-height:1">6U</div>`);
  add(`<div class="sm" style="position:absolute;right:28px;top:32px;line-height:14px;letter-spacing:2px;text-align:right">TWO SOCKET<br>EIGHT GPU<br>SIX SUPPLIES</div>`);

  // ------------------------------------------------------------ 01 the selected subsystem
  panel(28, 110, 292, 374, 'SUBSYSTEM', '01');
  const subTitle = add(`<div style="position:absolute;left:44px;top:146px;width:262px;font-size:17px;font-weight:700;line-height:1.15"></div>`);
  const subBlurb = add(`<div class="mo" style="position:absolute;left:44px;top:192px;width:260px;font-size:9.2px;line-height:1.78;color:#58626d"></div>`);
  const subRule = add(`<div style="position:absolute;left:44px;top:296px;width:260px;height:1px;background:${C.line}"></div>`);
  const subRows = add(`<div style="position:absolute;inset:0"></div>`);

  // ------------------------------------------------------------ 02 the power budget
  panel(28, 500, 292, 262, 'POWER BUDGET', '02');
  add(`<div class="pn" style="left:44px;top:534px;color:${C.warm}">MODEL</div>`);
  const barRows = [];
  for (let i = 0; i < 6; i++) {
    const y = 552 + i * 21;
    const k = add(`<div class="rowk" style="left:44px;top:${y}px"></div>`);
    add(`<div style="position:absolute;left:146px;top:${y + 2}px;width:102px;height:5px;background:${C.track};border-radius:3px"></div>`);
    const f = add(`<div style="position:absolute;left:146px;top:${y + 2}px;height:5px;border-radius:3px"></div>`);
    const v = add(`<div class="rowv" style="right:${1600 - 306}px;top:${y - 2}px;width:60px"></div>`);
    barRows.push({k, f, v});
  }
  add(`<div style="position:absolute;left:44px;top:682px;width:260px;height:1px;background:${C.line}"></div>`);
  const tot = [];
  const TY = 692;
  [['DC DRAW', 0], ['AC INPUT', 1], ['HEAT BTU/h', 2]].forEach(([n, i]) => {
    const x = 44 + i * 88;
    add(`<div class="sm" style="position:absolute;left:${x}px;top:${TY}px">${n}</div>`);
    tot.push(add(`<div class="mo" style="position:absolute;left:${x}px;top:${TY + 14}px;font-size:16px;font-weight:700"></div>`));
  });
  add(`<div class="sm" style="position:absolute;left:44px;top:730px">SUPPLY LOAD</div>`);
  const psuBars = [];
  for (let i = 0; i < 6; i++) {
    const x = 44 + i * 44;
    add(`<div style="position:absolute;left:${x}px;top:726px;width:36px;height:16px;background:${C.track};border-radius:2px"></div>`);
    const f = add(`<div style="position:absolute;left:${x}px;top:726px;width:36px;height:0px;background:${C.acc};border-radius:0 0 2px 2px"></div>`);
    const t = add(`<div class="mo" style="position:absolute;left:${x}px;top:746px;width:36px;text-align:center;font-size:7.6px;color:${C.mute}"></div>`);
    psuBars.push({f, t});
  }

  // ------------------------------------------------------------ 03 accelerator
  panel(1280, 110, 292, 182, 'ACCELERATOR', '03');
  btnRow(GPU_ORDER, Object.fromEntries(GPU_ORDER.map((k) => [k, GPUS[k].label])), 1296, 146, 260);
  const gpuLine = add(`<div class="mo" style="position:absolute;left:1296px;top:204px;width:260px;font-size:9px;line-height:1.72;color:#58626d"></div>`);
  add(`<div class="sm" style="position:absolute;left:1296px;top:261px">FRONT BAYS</div>`);
  btnRow(DRIVES, DRIVE_LABEL, 1396, 256, 160);

  // ------------------------------------------------------------ 04 subsystems, 05 views, 06 display
  panel(1280, 306, 292, 146, 'ISOLATE', '04');
  btnRow(SUB_KEYS, Object.fromEntries(SUBS.map((s) => [s.key, s.label])), 1296, 342, 260);
  panel(1280, 468, 292, 110, 'VIEW', '05');
  btnRow(VIEWS, VIEW_LABEL, 1296, 504, 260);
  panel(1280, 594, 292, 110, 'DISPLAY', '06');
  btnRow(DISPLAY, DISPLAY_LABEL, 1296, 630, 260);

  // ------------------------------------------------------------ 07 the two inputs and what they do
  panel(344, 772, 912, 96, 'OPERATING POINT', '07');
  add(`<div class="sm" style="position:absolute;left:360px;top:812px">GPU LOAD</div>`);
  const LD = {x: 360, w: 176, y: 838};
  add(`<div style="position:absolute;left:${LD.x}px;top:${LD.y}px;width:${LD.w}px;height:4px;background:${C.track};border-radius:2px"></div>`);
  const ldFill = add(`<div style="position:absolute;left:${LD.x}px;top:${LD.y}px;height:4px;background:${C.acc};border-radius:2px"></div>`);
  const ldKnob = add(`<div style="position:absolute;top:${LD.y - 6}px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:#fff;border:2px solid ${C.acc};box-sizing:border-box"></div>`);
  const ldVal = add(`<div class="mo" style="position:absolute;left:${LD.x + LD.w + 12}px;top:${LD.y - 7}px;font-size:13px;font-weight:700"></div>`);

  add(`<div class="sm" style="position:absolute;left:608px;top:812px">INLET AIR</div>`);
  const AM = {x: 608, w: 136, y: 838};
  add(`<div style="position:absolute;left:${AM.x}px;top:${AM.y}px;width:${AM.w}px;height:4px;background:${C.track};border-radius:2px"></div>`);
  const amFill = add(`<div style="position:absolute;left:${AM.x}px;top:${AM.y}px;height:4px;background:${C.warm};border-radius:2px"></div>`);
  const amKnob = add(`<div style="position:absolute;top:${AM.y - 6}px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:#fff;border:2px solid ${C.warm};box-sizing:border-box"></div>`);
  const amVal = add(`<div class="mo" style="position:absolute;left:${AM.x + AM.w + 12}px;top:${AM.y - 7}px;font-size:13px;font-weight:700"></div>`);

  const stats = [];
  [['FAN DUTY', 0], ['AIRFLOW', 1], ['SOUND', 2], ['WEIGHT', 3]].forEach(([n, i]) => {
    const x = 812 + i * 112;
    add(`<div style="position:absolute;left:${x - 14}px;top:800px;width:1px;height:50px;background:${C.line}"></div>`);
    add(`<div class="sm" style="position:absolute;left:${x}px;top:804px">${n}</div>`);
    const v = add(`<div class="mo" style="position:absolute;left:${x}px;top:820px;font-size:17px;font-weight:700"></div>`);
    const s = add(`<div class="sm" style="position:absolute;left:${x}px;top:843px;font-size:8px"></div>`);
    stats.push({v, s});
  });

  // ------------------------------------------------------------ footer
  add(`<div class="sm" style="position:absolute;left:28px;top:880px;letter-spacing:2px">PROCEDURAL MODEL · EVERY DIMENSION FROM THE ${DOC.guide.toUpperCase()}</div>`);
  add(`<div class="sm" style="position:absolute;right:28px;top:880px;letter-spacing:2px">POWER · AIRFLOW · SOUND ARE MODELLED FROM THE PUBLISHED FIGURES <span style="color:${C.acc}">//////</span></div>`);

  // ------------------------------------------------------------ callouts and the tour pointer
  const callSvg = add(`<svg data-callouts style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div data-callouts style="position:absolute;inset:0"></div>`);
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#111" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);
  const centre = (n) => {
    const r = n.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, centre(n)]));
  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };

  const kW = (w) => (w >= 1000 ? `${(w / 1000).toFixed(2)} kW` : `${Math.round(w)} W`);
  let lastSub = null;
  let lastRows = '';

  return {
    root: ui, btn, spots, LD, AM,
    update(s) {
      const sub = SUBS.find((x) => x.key === s.sub) || SUBS[0];
      const g = GPUS[s.gpu];
      // --- the subsystem card
      if (lastSub !== sub.key || s.rowsKey !== lastRows) {
        lastSub = sub.key;
        lastRows = s.rowsKey;
        subTitle.textContent = sub.title;
        subBlurb.textContent = sub.key === 'gpu' ? g.note : sub.blurb;
        const rows = sub.key === 'gpu' ? s.gpuRows : sub.rows;
        subRule.style.top = '296px';
        subRows.innerHTML = rows
          .slice(0, 8)
          .map(([k, v], i) => {
            const y = 308 + i * 19;
            const fs = String(v).length > 25 ? 8.1 : String(v).length > 21 ? 8.8 : 9.6;
            return `<div class="rowk" style="left:44px;top:${y}px">${k}</div><div class="rowv" style="left:140px;top:${y - 1}px;width:166px;font-size:${fs}px">${v}</div>`;
          })
          .join('');
      }
      // --- the power budget
      const m = s.model;
      const maxW = Math.max(...m.parts.map((p) => p.w));
      m.parts.forEach((p, i) => {
        const r = barRows[i];
        r.k.textContent = p.label;
        r.f.style.width = `${((p.w / maxW) * 102).toFixed(1)}px`;
        r.f.style.background = PW[p.k] || C.acc;
        r.v.textContent = kW(p.w);
      });
      tot[0].textContent = kW(m.dc);
      tot[1].textContent = kW(m.ac);
      tot[2].textContent = `${Math.round(m.btu / 100) / 10}k`;
      psuBars.forEach((b, i) => {
        const on = i < m.active;
        const k = on ? Math.min(1, m.per / m.psu) : 0;
        b.f.style.height = `${(k * 16).toFixed(1)}px`;
        b.f.style.top = `${(726 + 16 - k * 16).toFixed(1)}px`;
        b.f.style.background = k > 0.92 ? C.warm : C.acc;
        b.t.textContent = on ? `${Math.round(k * 100)}%` : 'SPARE';
        b.t.style.color = on ? C.mute : C.faint;
      });

      // --- the pickers
      for (const k of GPU_ORDER) btn[k].classList.toggle('on', s.gpu === k);
      for (const k of DRIVES) {
        btn[k].classList.toggle('on', s.drives === k);
        btn[k].style.opacity = k === 'e3s' && !g.e3s ? '.35' : '1';
      }
      for (const k of SUB_KEYS) btn[k].classList.toggle('on', s.sub === k);
      for (const k of VIEWS) btn[k].classList.toggle('on', s.view === k);
      for (const k of DISPLAY) btn[k].classList.toggle('on', !!s.display[k]);
      hdrGpu.textContent = `8 × ${g.name.toUpperCase()}`;
      hdrSub.textContent = `${g.mem} · ${g.tdp} W · ${g.form}`;
      gpuLine.textContent = `${g.mem} per module · ${g.tdp} W · ${g.form} · ${g.fabric} · host ${g.host} · ${g.slots} PCIe slots · ${g.fansRear} rear fans`;

      // --- the operating point
      ldFill.style.width = `${(s.load * LD.w).toFixed(1)}px`;
      ldKnob.style.left = `${(LD.x + s.load * LD.w).toFixed(1)}px`;
      ldVal.textContent = `${Math.round(s.load * 100)} %`;
      const ak = (s.ambient - 10) / 25;
      amFill.style.width = `${(ak * AM.w).toFixed(1)}px`;
      amKnob.style.left = `${(AM.x + ak * AM.w).toFixed(1)}px`;
      amVal.textContent = `${Math.round(s.ambient)} °C`;
      stats[0].v.textContent = `${Math.round(m.duty * 100)}%`;
      stats[0].s.textContent = `${m.rpm.toLocaleString('en-US')} RPM`;
      stats[1].v.textContent = `${m.cfm}`;
      stats[1].s.textContent = `CFM · ${m.fans} FANS`;
      stats[2].v.textContent = `${m.lwa.toFixed(1)} B`;
      stats[2].s.textContent = `LwA,m · ${m.lpa} dBA`;
      stats[3].v.textContent = `${m.weight}`;
      stats[3].s.textContent = 'KG POPULATED';

      // --- the callouts
      let lh = '';
      let ch = '';
      for (const c of s.callouts) {
        if (c.o < 0.02 || !c.at) continue;
        const [ax, ay] = c.at;
        const [lx, ly] = c.label;
        const right = lx > ax;
        const ex = right ? lx - 6 : lx + c.w + 6;
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${ex.toFixed(1)},${(ly + 6).toFixed(1)}" fill="none" stroke="${C.acc}" stroke-width=".9" opacity="${c.o.toFixed(2)}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.4" fill="${C.acc}" opacity="${c.o.toFixed(2)}"/>`;
        ch += `<div class="call" style="left:${lx.toFixed(1)}px;top:${(ly - 1).toFixed(1)}px;opacity:${c.o.toFixed(2)}"><b><i></i>${c.name}</b><span>${c.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
      pointer(s.cursor);
    },
    pointer,
  };
}
