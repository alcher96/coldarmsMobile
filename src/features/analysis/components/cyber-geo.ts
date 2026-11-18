// @ts-nocheck — геометрия и параметры глаз MIRA 4a, перенесены «один в один» из шаблона
// «MIRA Analysis.dc.html» (2026-10-21, строки 463–623 и lerpA): контуры век и бровей, ресницы в 4 группах,
// подводка с бликом, кожа и складка века, волокна радужки, состояния (CS), брови по состояниям (C_BROW),
// поведение взгляда (GZ). Общие для веба и телефона.
const F = n => n.toFixed(1);
const CE = {
  UO: [-124, 12, -115, -5, -86, -29, -46, -38, -10, -46, 44, -47, 86, -34, 108, -27.4, 128, -19.5, 137.5, -12.5],
  LO: [137.5, -12.5, 140.7, -10.1, 98.5, 21.9, 58, 35, 22, 46.7, -34, 46, -74, 38, -98, 33, -116, 24, -124, 12],
  LS: [137.5, -12.5, 140.7, -10.1, 97.5, 12.8, 58, 26, 22, 37.5, -34, 37, -74, 30.5, -98, 26.5, -116, 20, -124, 12]
};
const CS = {
  idle: { g: .5, rs: 3, o: 1, soft: 0, pu: 15 },
  attention: { g: .92, rs: 8, o: 1.05, soft: 0, pu: 16.5 },
  listening: { g: .68, rs: 10, o: 1, soft: 0, pu: 15.5 },
  thinking: { g: .76, rs: 24, o: .95, soft: 0, pu: 13.5 },
  speaking: { g: .6, rs: 10, o: 1, soft: 0, pu: 15 },
  emotion: { g: .86, rs: 6, o: .87, soft: 1, pu: 17 },
  scan: { g: .72, rs: 18, o: .94, soft: 0, pu: 13 }
};
const cubAt = (p, o, t) => {
  const u = 1 - t, [x0, y0, x1, y1, x2, y2, x3, y3] = p.slice(o, o + 8);
  return { x: u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, y: u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
    tx: 3 * u * u * (x1 - x0) + 6 * u * t * (x2 - x1) + 3 * t * t * (x3 - x2), ty: 3 * u * u * (y1 - y0) + 6 * u * t * (y2 - y1) + 3 * t * t * (y3 - y2) };
};
const cSegs = p => { let s = ''; for (let i = 2; i < p.length; i += 6) s += `C${F(p[i])} ${F(p[i + 1])} ${F(p[i + 2])} ${F(p[i + 3])} ${F(p[i + 4])} ${F(p[i + 5])}`; return s; };
const pth = p => `M${F(p[0])} ${F(p[1])}` + cSegs(p);
const lidAt = (p, s) => {
  const n = (p.length - 2) / 6, i = Math.min(n - 1, Math.max(0, Math.floor(s))), b = cubAt(p, i * 6, Math.min(1, Math.max(0, s - i))), m = Math.hypot(b.tx, b.ty) || 1;
  b.tx /= m; b.ty /= m; b.nx = b.ty; b.ny = -b.tx; return b;
};
const revP = p => { const r = []; for (let i = p.length - 2; i >= 0; i -= 2) r.push(p[i], p[i + 1]); return r; };
const smoothP = (P, cmd) => {
  let d = `${cmd}${F(P[0][0])} ${F(P[0][1])}`;
  for (let i = 1; i < P.length - 1; i++) d += `Q${F(P[i][0])} ${F(P[i][1])} ${F((P[i][0] + P[i + 1][0]) / 2)} ${F((P[i][1] + P[i + 1][1]) / 2)}`;
  const z = P[P.length - 1]; return d + `L${F(z[0])} ${F(z[1])}`;
};
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lashP = (bx, by, nx, ny, tx, ty, L, dx, dy, wb) => {
  const cx = bx + nx * L * .55, cy = by + ny * L * .55, ex = bx + dx * L, ey = by + dy * L, a = wb / 2, c = wb * .26;
  return `M${F(bx - tx * a)} ${F(by - ty * a)}Q${F(cx - tx * c)} ${F(cy - ty * c)} ${F(ex)} ${F(ey)}Q${F(cx + tx * c)} ${F(cy + ty * c)} ${F(bx + tx * a)} ${F(by + ty * a)}Z`;
};
const hsh = (i, k) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
const bump = (u, c, w) => Math.exp(-Math.pow((u - c) / w, 2));
const rib = (A, B) => smoothP(A, 'M') + smoothP(B.slice().reverse(), 'L') + 'Z';
const linerW = u => .5 + 6.2 * Math.pow(u, 1.7);
const lowW = u => (.22 + 1.1 * Math.pow(1 - u, 1.6)) * sstep(0, .08, u);
const C_LSH = Array.from({ length: 20 }, (_, i) => {
  const u = Math.min(.985, .2 + .78 * Math.pow(i / 19, .8) + (hsh(i, 1) - .5) * .03), r = hsh(i, 3);
  return { u, s: u * 3, L: (6 + 23 * sstep(.12, .88, u)) * (.8 + .4 * hsh(i, 2)) * (u > .96 ? .84 : 1), tl: .1 + .5 * Math.pow(u, 1.3) + (hsh(i, 4) - .5) * .14, wb: (1 + 1.4 * u) * (.7 + .6 * hsh(i, 5)), g: r < .45 ? 0 : r < .8 ? 1 : 2 };
});
const C_LSF = Array.from({ length: 12 }, (_, i) => { const u = .28 + .68 * (i + .2 + hsh(i, 6) * .6) / 12; return { u, s: u * 3, L: (3.5 + 8 * sstep(.2, .9, u)) * (.7 + .6 * hsh(i, 7)), tl: .05 + .4 * u, wb: .6 + .35 * hsh(i, 8), g: 3 }; });
const C_LLS = [.16, .36, .58, .82, 1.08, 1.36, 1.66].map((s, k) => ({ s: s + (hsh(k, 9) - .5) * .08, L: (8.6 - k * .75) * (.75 + .5 * hsh(k, 10)), sw: .6 - k * .05 + (hsh(k, 11) - .5) * .15, wb: .6 + .5 * hsh(k, 12) }));
const lidGeo = (up, low, op = 1) => {
  const kN = -.8 + 1.8 * sstep(.12, .75, op);
  const top = [], bot = [], hT = [], hB = [], eT = [], eB = [], lp = []; let last = null;
  for (let k = 0; k <= 48; k++) {
    const s = k / 16, u = s / 3, b = lidAt(up, s), w = linerW(u);
    lp.push([b.x, b.y]);
    if (k <= 44) {
      top.push([b.x + b.nx * w, b.y + b.ny * w]); last = b;
      const hw = .95 * bump(u, .5, .11) + 1.2 * bump(u, .83, .075), wi = w - .3;
      hT.push([b.x + b.nx * wi, b.y + b.ny * wi]); hB.push([b.x + b.nx * (wi - hw), b.y + b.ny * (wi - hw)]);
    }
    bot.push([b.x - b.nx * .6, b.y - b.ny * .6]);
    const ew = .25 + 1.25 * sstep(.04, .45, u) * (1 - .3 * sstep(.8, 1, u));
    eT.push([b.x + b.nx * ew * .35, b.y + b.ny * ew * .35]); eB.push([b.x - b.nx * ew * .65, b.y - b.ny * ew * .65]);
  }
  const ox = up[up.length - 2], oy = up[up.length - 1], T = top[top.length - 1];
  const a = [T[0] + last.tx * 8, T[1] + last.ty * 8], tip = [ox + 46, oy - 28], rb = [ox + 23, oy - 12];
  const nrm = (x, y) => { const m = Math.hypot(x, y) || 1; return [x / m, y / m]; }, P2 = p => `${F(p[0])} ${F(p[1])}`;
  const [ix, iy] = nrm(tip[0] - a[0], tip[1] - a[1]), [qx, qy] = nrm(rb[0] - tip[0], rb[1] - tip[1]);
  const liner = smoothP(top, 'M') + `Q${P2(a)} ${P2([tip[0] - ix * 2.2, tip[1] - iy * 2.2])}Q${P2(tip)} ${P2([tip[0] + qx * 2.2, tip[1] + qy * 2.2])}Q${P2(rb)} ${P2([ox - 1, oy + 2.2])}` + smoothP(bot.slice().reverse(), 'L') + 'Z';
  const lash = ['', '', '', ''];
  const addL = q => {
    const b = lidAt(up, q.s), w = linerW(q.u) * .35, dx = b.nx * kN + b.tx * q.tl, dy = b.ny * kN + b.ty * q.tl - .12 * kN, dm = Math.hypot(dx, dy) || 1;
    lash[q.g] += lashP(b.x + b.nx * w, b.y + b.ny * w, b.nx * kN, b.ny * kN, b.tx, b.ty, q.L, dx / dm, dy / dm, q.wb);
  };
  C_LSH.forEach(addL); C_LSF.forEach(addL);
  const lt = [], lb = [];
  for (let k = 0; k <= 36; k++) { const s = k / 12, b = lidAt(low, s), w = lowW(s / 3), d = Math.min(.45, w * .4); lt.push([b.x + b.nx * w, b.y + b.ny * w]); lb.push([b.x - b.nx * d, b.y - b.ny * d]); }
  let llash = '';
  C_LLS.forEach(q => {
    const b = lidAt(low, q.s), w = lowW(q.s / 3) * .5, dx = b.nx - b.tx * q.sw, dy = b.ny - b.ty * q.sw, dm = Math.hypot(dx, dy) || 1;
    llash += lashP(b.x + b.nx * w, b.y + b.ny * w, b.nx, b.ny, b.tx, b.ty, q.L, dx / dm, dy / dm, q.wb);
  });
  const dyc = (1 - Math.min(1, op)) * 12;
  const skin = smoothP(C_CREASE.pts.map(p => [p[0], p[1] + dyc]), 'M') + smoothP(lp.slice().reverse(), 'L') + 'Z';
  const upD = pth(up), lowD = pth(low);
  return { upD, lowD, clip: upD + cSegs(low) + 'Z', liner, lash, whi: rib(hT, hB), edge: rib(eT, eB), skin, lowR: rib(lt, lb), llash };
};
const C_IRIS = (() => {
  let sd = 11; const rnd = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  const P = (r, a) => `${F(r * Math.cos(a))} ${F(r * Math.sin(a))}`;
  let fa = '', fb = '', fd = '', tk = '', tK = '';
  for (let i = 0; i < 96; i++) {
    const a = i / 96 * Math.PI * 2 + (rnd() - .5) * .05, r0 = 17.5 + rnd() * 3.5, r1 = 31 + rnd() * 12, tw = .09 + rnd() * .07;
    const sg = `M${P(r0, a)}Q${P((r0 + r1) / 2 + (rnd() - .5) * 3, a + tw * .55)} ${P(r1, a + tw)}`;
    if (i % 3) fb += sg; else fa += sg;
  }
  for (let i = 0; i < 60; i++) {
    const a = (i + .5) / 60 * Math.PI * 2 + (rnd() - .5) * .08, r0 = 19 + rnd() * 5, r1 = 28 + rnd() * 14, tw = .09 + rnd() * .07;
    fd += `M${P(r0, a)}Q${P((r0 + r1) / 2, a + tw * .55)} ${P(r1, a + tw)}`;
  }
  for (let i = 0; i < 72; i++) { const a = i * Math.PI / 36; if (i % 6) tk += `M${P(42.8, a)}L${P(44.2, a)}`; else tK += `M${P(41.2, a)}L${P(44.6, a)}`; }
  const cp = Array.from({ length: 96 }, (_, i) => { const a = i / 96 * Math.PI * 2, r = 23.5 + 1.5 * Math.sin(6 * a + .6) + Math.sin(13 * a + 2.1) + .6 * Math.sin(23 * a + .3); return [r * Math.cos(a), r * Math.sin(a)]; });
  let col = `M${F((cp[0][0] + cp[1][0]) / 2)} ${F((cp[0][1] + cp[1][1]) / 2)}`;
  for (let i = 1; i <= 96; i++) { const p = cp[i % 96], q = cp[(i + 1) % 96]; col += `Q${F(p[0])} ${F(p[1])} ${F((p[0] + q[0]) / 2)} ${F((p[1] + q[1]) / 2)}`; }
  const crypts = Array.from({ length: 14 }, (_, k) => { const a = k / 14 * Math.PI * 2 + (rnd() - .5) * .35, r = 29 + rnd() * 8; return { x: F(r * Math.cos(a)), y: F(r * Math.sin(a)), rx: F(2.2 + rnd() * 2.4), ry: F(.9 + rnd() * .8), rot: F(a * 180 / Math.PI) }; });
  return { fa, fb, fd, tk, tK, col: col + 'Z', crypts };
})();
const C_CREASE = (() => {
  const p = [-110, -8, -86, -54, 26, -74, 124, -38], D0 = [], D1 = [], H0 = [], H1 = [], pts = [];
  for (let k = 0; k <= 32; k++) {
    const t = k / 32, b = lidAt(p, t), wd = 1.6 * Math.pow(Math.sin(Math.PI * t), .9) * (.7 + .3 * t), hw = .8 * sstep(.14, .32, t) * (1 - sstep(.6, .84, t)), o = 2.4;
    pts.push([b.x, b.y]);
    D0.push([b.x + b.nx * wd * .4, b.y + b.ny * wd * .4]); D1.push([b.x - b.nx * wd * .6, b.y - b.ny * wd * .6]);
    H0.push([b.x + b.nx * (o + hw), b.y + b.ny * (o + hw)]); H1.push([b.x + b.nx * o, b.y + b.ny * o]);
  }
  return { dark: rib(D0, D1), hi: rib(H0, H1), pts };
})();
const C_G0 = lidGeo(CE.UO, CE.LO);
const C_CARU = 'M-124 12C-122 4.5 -114 1.5 -107.5 4C-102.5 6.5 -103 14.5 -109 17.5C-115 19.5 -121.5 17 -124 12Z';
const C_HL = 'M-23 -18.5C-22.4 -23.6 -16.6 -27 -11.4 -25.4C-8 -24.3 -8 -20.4 -10.6 -18C-14.4 -14.6 -23.6 -13.4 -23 -18.5Z';
const mixHex = (a, b, t) => { const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16)); return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`; };
const C_BROW = {
  idle: [-108, -78, -78, -87, 18, -102, 66, -104, 92, -105, 120, -94, 142, -80],
  attention: [-108, -82, -78, -92, 18, -108, 66, -110, 92, -111, 120, -99, 142, -84],
  listening: [-108, -82, -78, -91, 18, -104, 66, -105, 92, -106, 120, -95, 142, -80],
  thinking: [-115, -68, -86, -79, 14, -97, 64, -101, 90, -103, 120, -93, 142, -79],
  speaking: [-108, -79, -78, -88, 18, -103, 66, -105, 92, -106, 120, -95, 142, -81],
  emotion: [-106, -84, -76, -95, 16, -110, 62, -111, 90, -111, 118, -99, 140, -82],
  scan: [-111, -73, -82, -83, 16, -99, 66, -102, 92, -103, 120, -93, 142, -79]
};
const C_FUR = { thinking: 1, scan: .55 };
const browWd = u => .45 + 5.5 * (.62 + .38 * sstep(0, .2, u)) * Math.pow(1 - sstep(.25, 1, u), .85);
const C_BH = Array.from({ length: 44 }, (_, i) => { const r = hsh(i, 25); return { u: Math.pow((i + hsh(i, 21)) / 44, 1.12) * .96, off: -.42 + .9 * hsh(i, 22), lm: .65 + .75 * hsh(i, 23), ang: (hsh(i, 24) - .5) * .38, g: r < .4 ? 0 : r < .78 ? 1 : 2, wb: .45 + .35 * hsh(i, 26) }; });
const browGeo = p => {
  const top = [], bot = [], hB = [];
  for (let k = 0; k <= 32; k++) {
    const sp = k / 16, u = sp / 2, b = lidAt(p, sp), w = browWd(u), hw = .9 * bump(u, .44, .16) + .5 * bump(u, .1, .05);
    top.push([b.x + b.nx * w * .55, b.y + b.ny * w * .55]); bot.push([b.x - b.nx * w * .45, b.y - b.ny * w * .45]);
    hB.push([b.x + b.nx * (w * .55 - hw), b.y + b.ny * (w * .55 - hw)]);
  }
  const b0 = lidAt(p, 0), m = [(top[0][0] + bot[0][0]) / 2 - b0.tx * 2.6, (top[0][1] + bot[0][1]) / 2 - b0.ty * 2.6];
  const hair = ['', '', ''];
  C_BH.forEach(q => {
    const b = lidAt(p, q.u * 2), w = browWd(q.u), a = sstep(0, .2, q.u), bb = 1 - .78 * a;
    let dx = b.tx * a + b.nx * bb, dy = b.ty * a + b.ny * bb; const dm = Math.hypot(dx, dy) || 1; dx /= dm; dy /= dm;
    const ca = Math.cos(q.ang), sa = Math.sin(q.ang), rx = dx * ca - dy * sa, ry = dx * sa + dy * ca;
    let ix = rx + b.nx * .2, iy = ry + b.ny * .2; const im = Math.hypot(ix, iy) || 1; ix /= im; iy /= im;
    const L = Math.max(2.4, w * 1.3) * q.lm, ox = b.x + b.nx * q.off * w - rx * L * .35, oy = b.y + b.ny * q.off * w - ry * L * .35;
    hair[q.g] += lashP(ox, oy, ix, iy, -iy, ix, L, rx, ry, q.wb);
  });
  return { fill: smoothP(top, 'M') + smoothP(bot.slice().reverse(), 'L') + `Q${F(m[0])} ${F(m[1])} ${F(top[0][0])} ${F(top[0][1])}Z`, hi: rib(top, hB), hair };
};
const C_B0 = browGeo(C_BROW.idle);
const GZ = {
  idle: { away: .55, ax: 26, ay: 8, hold: [1, 2.4], fix: [1.6, 3.4], wait: 0 },
  attention: { away: .25, ax: 15, ay: 5, hold: [.5, 1], fix: [2, 4], wait: 1.6 },
  listening: { away: .3, ax: 17, ay: 6, hold: [.6, 1.2], fix: [1.8, 3.6], wait: .8 },
  thinking: { away: .85, ax: 22, ay: 10, up: true, hold: [.9, 1.8], fix: [.5, 1.1], wait: .2 },
  speaking: { away: .4, ax: 18, ay: 6, hold: [.45, 1], fix: [1.4, 3], wait: .6 },
  emotion: { away: .1, ax: 10, ay: 4, hold: [.4, .8], fix: [1, 2], wait: .8 },
  scan: { away: 0, ax: 0, ay: 0, hold: [0, 0], fix: [1, 1], wait: 0 }
};
const lerpA = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// Выразительность (эксперт, 2026-10-20: «еле-еле двигаются»). Значения шаблона остаются выше как есть, здесь —
// усиление поверх них: разница состояний (брови, раскрытие век, зрачок) и размах взгляда.
// Брови поднимаются выше, чем в шаблоне, поэтому рамка глаз (viewBox) сверху расширена: 40 → 16.
const EX = { brow: 1.8, lid: 1.7, pupil: 1.6, gaze: 1.4, drift: 1.7, lift: 1.8, follow: [.45, .7] }; // follow — доля взгляда, на которую смещаются сами глаза (x, y)
for (const k in C_BROW) if (k !== 'idle') C_BROW[k] = C_BROW[k].map((v, i) => C_BROW.idle[i] + (v - C_BROW.idle[i]) * EX.brow);
for (const k in CS) { CS[k].o = 1 + (CS[k].o - 1) * EX.lid; CS[k].pu = 15 + (CS[k].pu - 15) * EX.pupil; }
for (const k in GZ) { GZ[k].ax *= EX.gaze; GZ[k].ay *= EX.gaze; }

export { EX, F, CE, CS, cubAt, cSegs, pth, lidAt, revP, smoothP, sstep, lashP, hsh, bump, rib, linerW, lowW, C_LSH, C_LSF, C_LLS, lidGeo, C_G0, C_IRIS, C_CREASE, C_CARU, C_HL, mixHex, C_BROW, C_FUR, browWd, C_BH, browGeo, C_B0, GZ, lerpA };
