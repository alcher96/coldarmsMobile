/* eslint-disable react-hooks/refs, react-hooks/purity --
   покадровая анимация / жесты: изменяемое состояние кадра живёт в ref и SharedValue мимо React (иначе — перерисовка
   экрана на каждый кадр); плеер expo-video управляется присваиванием свойств. React Compiler такие компоненты
   не оптимизирует (сам пропускает), поведение проверено на телефоне (прототип coldarmsAI/mobile). */
// @ts-nocheck — перенос «один в один» из шаблона «MIRA Analysis.dc.html» (2026-10-21), раздел 4a (CyberEyes):
// слои глаза (основа, кожа и складка века, радужка, кольца, веки с ресницами в 4 группах, брови с бликом), состояния
// idle / attention / listening / thinking / speaking / emotion / scan, моргание, взгляд, появление.
// Анимация — requestAnimationFrame + setAttribute по ссылкам на SVG-узлы, как в шаблоне. Телефон — cyber-eyes.tsx.
import React, { useRef } from 'react';

import { EX, F, CE, CS, revP, sstep, lidGeo, C_G0, C_IRIS, C_CREASE, C_CARU, C_HL, mixHex, C_BROW, C_FUR, browGeo, C_B0, GZ, lerpA } from './cyber-geo';

import { EYE_PAL, SOFT, eyeHex } from './mira-theme';

// вариант G «мягкие голубые глаза» (mira-theme.ts): цвета рисунка — по таблице шаблона
const COLOR_PROPS = ['fill', 'stroke', 'stopColor'];
const h = (tag, props, ...kids) => {
  if (props) for (const k of COLOR_PROPS) if (typeof props[k] === 'string') props = { ...props, [k]: eyeHex(props[k]) };
  return React.createElement(tag, props, ...kids);
};

// Слои радужки варианта G — код шаблона «MIRA Helmet HUD Neon» (skyEyes / skyFrame, THEMES.soft) почти дословно:
// чаша за зрачком, кольцо-шестерёнка с делениями, обод, розоватое свечение за зрачком, блики-дуги, искра.
function skyEyes(svg) {
  const NS = 'http://www.w3.org/2000/svg', T = SOFT;
  const id = 'sk' + Math.random().toString(36).slice(2, 7), defs = svg.querySelector('defs');
  const mk = (tag, at, par) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (par) par.appendChild(e); return e; };
  const rg = (nm, stops) => { const g = mk('radialGradient', { id: id + nm }, defs); stops.forEach(([o, c, op]) => mk('stop', { offset: o, 'stop-color': c, 'stop-opacity': op }, g)); };
  rg('w', T.well); rg('r', T.rim); rg('b', T.back); rg('g', T.glow);
  return [...svg.querySelectorAll('g[clip-path] > g')].map((ir, i) => {
    const fl = i === 0 ? -1 : 1;
    const pupil = [...ir.children].find(c => (c.getAttribute('fill') || '').endsWith('pu)'));
    if (!pupil) return null;
    const ruff = pupil.nextElementSibling;
    const well = mk('circle', { r: 30, fill: `url(#${id}w)` }); ir.insertBefore(well, pupil);
    const gear = mk('g', {}); ir.insertBefore(gear, pupil);
    mk('circle', { r: 23.5, fill: 'none', stroke: T.c1, 'stroke-opacity': .3, 'stroke-width': .6, 'stroke-dasharray': '2.6 2' }, gear);
    mk('circle', { r: 20.2, fill: 'none', stroke: T.c2, 'stroke-opacity': .5, 'stroke-width': 1.3, 'stroke-dasharray': '11 3.5 2 3.5' }, gear);
    let d = '';
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6, r1 = k % 3 ? 25.4 : 24.6, r2 = 27.2; d += `M${(r1 * Math.cos(a)).toFixed(2)} ${(r1 * Math.sin(a)).toFixed(2)}L${(r2 * Math.cos(a)).toFixed(2)} ${(r2 * Math.sin(a)).toFixed(2)}`; }
    mk('path', { d, fill: 'none', stroke: T.c3, 'stroke-opacity': .32, 'stroke-width': .6 }, gear);
    const rim = mk('circle', { r: 19, fill: `url(#${id}r)` }); ir.insertBefore(rim, pupil);
    const back = mk('circle', { r: 5, fill: `url(#${id}b)`, opacity: .4 }); ir.insertBefore(back, ruff);
    const cor = mk('g', {}, ir);
    mk('path', { d: 'M-37.6 -13.7A40 40 0 0 1 10.4 -38.6', fill: 'none', stroke: T.c4, 'stroke-opacity': .12, 'stroke-width': 5, 'stroke-linecap': 'round' }, cor);
    mk('path', { d: 'M-30 -4A31 31 0 0 1 -22 -21', fill: 'none', stroke: T.c4, 'stroke-opacity': .1, 'stroke-width': 1.6, 'stroke-linecap': 'round' }, cor);
    const gl = mk('g', {}, ir);
    const bloom = mk('circle', { r: 8, fill: `url(#${id}g)`, opacity: .25 }, gl);
    const star = mk('path', { d: 'M0 -10L.9 -.9L10 0L.9 .9L0 10L-.9 .9L-10 0L-.9 -.9Z', fill: T.star, opacity: 0 }, gl);
    const dot = mk('circle', { r: 1.7, fill: T.star, opacity: .6 }, gl);
    return { fl, pupil, ruff, well, gear, rim, back, cor, gl, bloom, star, dot };
  }).filter(Boolean);
}
function skyFrame(S, sky, t, dt, gx, gy) {
  const f = v => v.toFixed(2);
  S.dwA = (S.dwA || 0) - dt * 14;
  if (t > (S.gNext || 0)) { S.gT = t; S.gNext = t + 3.2 + Math.random() * 4; }
  sky.forEach((e, i) => {
    const q = (t - (S.gT ?? -9) - i * .07) / .8, p = q > 0 && q < 1 ? Math.sin(Math.PI * q) ** 2 : 0;
    const Sc = e.fl < 0 ? 'scale(-1 1) ' : '';   // слои радужки — концентрично со зрачком (без «отставания»)
    const pr = +e.pupil.getAttribute('r') || 15;
    e.gear.setAttribute('transform', `rotate(${f(S.dwA)})`);
    e.rim.setAttribute('r', f(pr + 4.5));   // зрачок и всё, что вокруг него, — в центре радужки (без «отставания», эксперт 2026-11-17)
    e.back.setAttribute('r', f(pr * .38)); e.back.setAttribute('opacity', f(.32 + .35 * p));
    e.cor.setAttribute('transform', `${Sc}translate(${f(-gx * .4)} ${f(-gy * .4)})`);
    e.gl.setAttribute('transform', `${Sc}translate(${f(-13 - gx * .4)} ${f(-15 - gy * .4)}) rotate(${f(p * 25)}) scale(${(.6 + p * .8).toFixed(3)})`);
    e.star.setAttribute('opacity', f(p * .95)); e.bloom.setAttribute('opacity', f(.22 + p * .78)); e.dot.setAttribute('opacity', f(.55 + .45 * p));
  });
}

// sleep — MIRA спит (вне окна разбора): веки плавно смыкаются, свечение гаснет, взгляд замирает.
// onFrame — каждый кадр: взгляд и моргание (для прицела на кнопке «Разбери свой поединок», запекание в видео).
function CyberEyes({ state, w, intro = 0, down = false, sleep = false, onFrame = null }) {
  const id = useRef('c' + Math.random().toString(36).slice(2, 8)).current;
  const R = useRef({ L: {}, R: {}, stops: {} }).current;
  const sRef = useRef(state); sRef.current = state;
  const iRef = useRef(intro); iRef.current = intro;
  const dRef = useRef(down); dRef.current = down; // смотрит вниз, на видео под глазами
  const slRef = useRef(sleep); slRef.current = sleep;
  const fRef = useRef(onFrame); fRef.current = onFrame;
  const lod = w >= 160;
  React.useLayoutEffect(() => {
    const rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const L = { t: 0, g: .5, o: 1, soft: 0, pu: 15, gx: 0, gy: 0, tgx: 0, tgy: 0, nextG: 0, nextB: 0, bStart: -9, dbl: false, ang: 0, arcA: 0, arcO: 0, lvl: 0, pulse: -9, emo: 0, sp: 0, geo: null, ver: 0, bp: C_BROW.idle.slice(), fur: 0, bg: null, bv: 0, bem: 0, lo: -1, lsf: -1, iT: -99, iSeen: document.hidden ? intro : null };
    const ID = 1.3, IO = .55;
    const eo = x => 1 - Math.pow(1 - x, 3), eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    let raf;
    const frame = now => {
      const t = now / 1000, dt = L.t ? Math.min(.05, t - L.t) : .016; L.t = t;
      if (L.iSeen !== iRef.current) { L.iSeen = iRef.current; L.iT = t; L.nextB = t + ID + IO + 1.4; L.nextG = t + ID + IO; L.tgx = L.tgy = L.gx = L.gy = 0; }
      const ip = (t - L.iT) / ID, wake = ip < 1 ? 0 : eio(Math.min(1, Math.max(0, (t - L.iT - ID - .08) / IO)));
      if (R.zoom) {
        const z = Math.min(1, Math.max(0, ip)), sc = rm ? 1 : 1.34 - .34 * eo(z), fo = eo(Math.min(1, Math.max(0, ip / .75)));
        R.zoom.setAttribute('transform', ip >= 1 ? '' : `translate(450 150) scale(${sc.toFixed(4)}) translate(-450 -150)`);
        R.zoom.setAttribute('opacity', fo > .999 ? '1' : fo.toFixed(3));
      }
      L.slp = (L.slp ?? (slRef.current ? 1 : 0)) + ((slRef.current ? 1 : 0) - (L.slp ?? 0)) * (1 - Math.exp(-dt / .6));
      const name = slRef.current ? 'idle' : (sRef.current in CS ? sRef.current : 'idle'), S = CS[name];
      const k = 1 - Math.exp(-dt / .12);
      let gT = S.g;
      if (name === 'idle') gT += .04 * Math.sin(t * Math.PI / 2);
      if (name === 'listening') gT += .08 * Math.max(0, Math.sin(t * 2.1) * Math.sin(t * .9));
      if (name === 'speaking') {
        const env = Math.sin(t * 1.3) + Math.sin(t * .7) > -.4 ? 1 : .05;
        const lt = env * (.35 + .65 * Math.abs(Math.sin(t * 11) * Math.sin(t * 3.3)));
        L.lvl += (lt - L.lvl) * (1 - Math.exp(-dt / .13));
        gT += L.lvl * .3;
        if (L.lvl > .62 && t - L.pulse > .7) L.pulse = t;
      } else L.lvl *= .9;
      if (name === 'listening' && t - L.pulse > 1.4) L.pulse = t;
      L.g += (gT - L.g) * k; L.o += (S.o - L.o) * k; L.soft += (S.soft - L.soft) * k; L.pu += (S.pu - L.pu) * k;
      L.emo += ((name === 'emotion' ? 1 : 0) - L.emo) * k;
      if (name !== L.st) { L.st = name; L.stT = t; L.nextG = Math.min(L.nextG, t + .12); L.away = false; L.fixT = t; L.fixD = .8; }
      if (t > L.nextG && t > L.iT + ID + IO) {
        const Z = GZ[name], r = (a, b) => a + Math.random() * (b - a), px = L.tgx;
        if (dRef.current) {  // взгляд на видео: вниз, скользит по кадру
          L.tgx = r(-16, 16) * EX.gaze; L.tgy = r(7, 11) * EX.gaze; L.nextG = t + r(.5, 1.2);
        } else if (name === 'scan') { L.tgx = (Math.random() * 2 - 1) * 18 * EX.gaze; L.tgy = (5 + Math.random() * 5) * EX.gaze; L.nextG = t + .35 + Math.random() * .35; }
        else if (L.away) { L.away = false; L.tgx = r(-2, 2); L.tgy = r(-1.2, 1.2); L.fixT = t; L.fixD = r(Z.fix[0], Z.fix[1]); L.nextG = t + r(.45, 1.1); }
        else if (t - L.fixT > L.fixD && t - L.stT > Z.wait && Math.random() < Z.away) {
          L.away = true; const sx = Math.random() < .5 ? -1 : 1;
          L.tgx = sx * Z.ax * r(.55, 1); L.tgy = Z.up ? -Z.ay * r(.5, 1) : r(-.7, 1) * Z.ay;
          L.nextG = t + r(Z.hold[0], Z.hold[1]);
        } else { L.tgx = r(-2.2, 2.2) * EX.gaze; L.tgy = r(-1.4, 1.4) * EX.gaze + (name === 'attention' ? 1 : 0); L.nextG = t + r(.45, 1.1); }
        if (rm || slRef.current) { L.tgx = 0; L.tgy = slRef.current ? 2 : 0; }
        if (!rm && Math.abs(L.tgx - px) > 12 && t - L.bStart > 2 && Math.random() < .35) { L.bStart = t + .03; L.dbl = false; L.nextB = t + 4 + Math.random() * 3; }
      }
      const kg = 1 - Math.exp(-dt / .045);
      L.gx += (L.tgx - L.gx) * kg; L.gy += (L.tgy - L.gy) * kg;
      // сами глаза плавно следуют за взглядом (эксперт, 2026-10-20): вбок — по взгляду, вниз/вверх — тоже, медленнее зрачков
      const kh = 1 - Math.exp(-dt / .35);
      L.hx = (L.hx || 0) + ((rm ? 0 : L.gx * EX.follow[0]) - (L.hx || 0)) * kh;
      L.hy = (L.hy || 0) + ((rm ? 0 : L.gy * EX.follow[1]) - (L.hy || 0)) * kh;
      if (!L.nextB) L.nextB = t + 1.5;
      if (t > L.nextB && !slRef.current) { L.bStart = t; L.dbl = Math.random() < .15; L.nextB = t + 4 + Math.random() * 3; }
      let c = 0; const bd = .32, p = (t - L.bStart) / bd;
      if (p >= 0 && p < 1) { c = p < .4 ? p / .4 : 1 - (p - .4) / .6; c = c * c * (3 - 2 * c); }
      else if (L.dbl && p >= 1.15 && p < 2.15) { const q = p - 1.15; c = q < .4 ? q / .4 : 1 - (q - .4) / .6; c = c * c * (3 - 2 * c); }
      const o = L.o * (1 - c) * wake * (1 - L.gy * .011) * (1 - .93 * L.slp);   // спит — веки почти сомкнуты
      const drx = rm ? 0 : (.7 * Math.sin(t * .83) + .45 * Math.sin(t * 1.9 + 1)) * EX.drift, dry = rm ? 0 : .4 * Math.sin(t * 1.13 + .5) * EX.drift;
      const BP = C_BROW[name] || C_BROW.idle, kb = 1 - Math.exp(-dt / .14); let bdel = 0;
      for (let i = 0; i < 14; i++) { const v = (BP[i] - L.bp[i]) * kb; L.bp[i] += v; bdel = Math.max(bdel, Math.abs(v)); }
      L.fur += ((C_FUR[name] || 0) - L.fur) * kb;
      if (bdel > .004 || !L.bg) { L.bg = browGeo(L.bp); L.bv++; }
      L.bem += (L.lvl - L.bem) * (1 - Math.exp(-dt / .35));
      const bLift = (-Math.max(0, -L.gy) * .35 - (name === 'speaking' ? sstep(.45, .8, L.bem) * 3 : 0)) * EX.lift + c * 1.5;
      if (!rm) L.ang += S.rs * dt;
      const arcOn = name === 'thinking' || name === 'scan' ? 1 : 0;
      L.arcO += (arcOn - L.arcO) * k; if (!rm) L.arcA += 72 * dt;
      if (!L.geo || Math.abs(o - L.lo) > 2e-4 || Math.abs(L.soft - L.lsf) > 2e-4) {
        const low = lerpA(CE.LO, CE.LS, L.soft);
        L.geo = lidGeo(lerpA(revP(low), CE.UO, o), low, o); L.lo = o; L.lsf = L.soft; L.ver++;
      }
      const G = L.geo;
      const pq = (t - L.pulse) / 1.2, pOn = !rm && pq >= 0 && pq < 1;
      if (Math.random() < .004 && name === 'emotion') L.sp = t;
      const spO = L.emo * (.55 + .45 * Math.sin(t * 3));
      const irisMid = mixHex(EYE_PAL.mid, EYE_PAL.mid2, L.emo), irisIn = mixHex(EYE_PAL.inn, EYE_PAL.inn2, L.emo);
      if (R.stops.mid) { R.stops.mid.setAttribute('stop-color', irisMid); R.stops.in.setAttribute('stop-color', irisIn); R.stops.halo.setAttribute('stop-color', irisMid); }
      if (R.follow) R.follow.setAttribute('transform', `translate(${F(L.hx)} ${F(L.hy)})`);
      ['L', 'R'].forEach(s => {
        const e = R[s]; if (!e.up) return;
        const fl = s === 'L' ? -1 : 1;
        if (e.ver !== L.ver) {
          e.ver = L.ver;
          e.clip.setAttribute('d', G.clip);
          e.up.setAttribute('d', G.edge); e.up0.setAttribute('d', G.upD); e.sh1.setAttribute('d', G.upD); e.sh2.setAttribute('d', G.upD);
          e.wl.setAttribute('d', G.lowD); e.low.setAttribute('d', G.lowR); e.llash.setAttribute('d', G.llash);
          e.wing.setAttribute('d', G.liner); e.whi.setAttribute('d', G.whi); e.skin.setAttribute('d', G.skin);
          for (let j = 0; j < 4; j++) if (e['lash' + j]) e['lash' + j].setAttribute('d', G.lash[j]);
        }
        e.crease.setAttribute('transform', `translate(0 ${F((1 - Math.min(1, o)) * 12)})`);
        if (e.bv !== L.bv) { e.bv = L.bv; e.browF.setAttribute('d', L.bg.fill); e.browHi.setAttribute('d', L.bg.hi); for (let j = 0; j < 3; j++) if (e['browH' + j]) e['browH' + j].setAttribute('d', L.bg.hair[j]); }
        e.brow.setAttribute('transform', `translate(0 ${F(bLift)})`); e.furrow.setAttribute('opacity', F(L.fur));
        e.iris.setAttribute('transform', `translate(${F(6 + (L.gx + drx) * fl + (s === 'L' ? .6 : 0))} ${F(-2 + L.gy + dry)})`);
        e.rings.setAttribute('transform', `rotate(${F(L.ang * (s === 'L' ? .85 : 1))})`);
        e.arc.setAttribute('transform', `rotate(${F(L.arcA + (s === 'L' ? 40 : 0))})`); e.arc.setAttribute('opacity', F(L.arcO * .9));
        e.pupil.setAttribute('r', F(L.pu)); e.ruff.setAttribute('r', F(L.pu + 1.5));
        e.core.setAttribute('opacity', F(.3 + L.g * .55));
        e.halo.setAttribute('opacity', F(L.g * .5 * (1 - .7 * L.slp)));
        e.hl.setAttribute('opacity', F(.7 + .3 * L.g));
        e.sp.setAttribute('opacity', F(spO));
        e.pulse.setAttribute('r', F(pOn ? 16 + pq * 26 : 16)); e.pulse.setAttribute('opacity', F(pOn ? (1 - pq) * .55 : 0));
      });
      if (R.sky) skyFrame(R.skyS, R.sky, t, dt, L.gx, L.gy);
      if (fRef.current) fRef.current({ gx: L.gx, gy: L.gy, hx: L.hx || 0, hy: L.hy || 0, blink: c, lvl: L.lvl, sleep: L.slp, name });
    };
    if (R.svg && !R.sky) { R.sky = skyEyes(R.svg); R.skyS = {}; }
    const tick = now => { frame(now); raf = requestAnimationFrame(tick); };
    if (!document.hidden) frame(performance.now());
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- запуск покадровой анимации один раз; входы читаются через ref
  const eye = side => {
    const fl = side === 'L', E = R[side], rf = k => el => { if (el && E[k] !== el) { E[k] = el; E.ver = -1; E.bv = -1; } };
    const ln = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }, u = n => `url(#${id}${n})`;
    return h('g', { key: side, transform: `translate(${fl ? 270 : 630},150) scale(${fl ? -1 : 1},1)` },
      h('ellipse', { ref: rf('halo'), cx: 8, cy: 0, rx: 170, ry: 80, fill: u('ha'), opacity: .25 }),
      h('clipPath', { id: id + side }, h('path', { ref: rf('clip'), d: C_G0.clip })),
      h('path', { ref: rf('skin'), d: C_G0.skin, fill: u('sk') }),
      h('g', { ref: rf('brow') },
        h('path', { ref: rf('browF'), d: C_B0.fill, fill: u('bg') }),
        lod && h('path', { ref: rf('browH0'), d: C_B0.hair[0], fill: '#BA9AFF', fillOpacity: .42 }),
        lod && h('path', { ref: rf('browH1'), d: C_B0.hair[1], fill: '#885CFF', fillOpacity: .5 }),
        lod && h('path', { ref: rf('browH2'), d: C_B0.hair[2], fill: '#E5E7FF', fillOpacity: .16 }),
        h('path', { ref: rf('browHi'), d: C_B0.hi, fill: '#BA9AFF', fillOpacity: .42 }),
        h('path', { ref: rf('furrow'), d: 'M-123 -78 C-125 -74 -125 -69.5 -123.5 -65.5', ...ln, stroke: '#BA9AFF', strokeOpacity: .24, strokeWidth: 1, opacity: 0 })),
      h('g', { ref: rf('crease') },
        h('path', { d: C_CREASE.dark, fill: '#030208', fillOpacity: .8 }),
        h('path', { d: C_CREASE.hi, fill: '#BA9AFF', fillOpacity: .22 })),
      h('g', { clipPath: u(side) },
        h('rect', { x: -140, y: -80, width: 300, height: 150, fill: u('sc') }),
        h('ellipse', { cx: -112, cy: 10, rx: 34, ry: 30, fill: u('cs') }),
        h('ellipse', { cx: 132, cy: -12, rx: 30, ry: 26, fill: u('cs') }),
        h('path', { d: C_CARU, fill: u('cr') }),
        h('ellipse', { cx: -112, cy: 7.5, rx: 2.4, ry: 1.3, fill: '#E5E7FF', opacity: .22 }),
        h('path', { d: 'M-101 1 C-97 7 -97 14 -101 19', ...ln, stroke: '#BA9AFF', strokeOpacity: .14, strokeWidth: .9 }),
        h('g', { ref: rf('iris'), transform: 'translate(6 -2)' },
          h('circle', { r: 46, fill: u('ir') }),
          lod && h('path', { d: C_IRIS.fd, ...ln, stroke: '#0B0624', strokeOpacity: .55, strokeWidth: 1.2 }),
          lod && h('path', { d: C_IRIS.fb, ...ln, stroke: '#BA9AFF', strokeOpacity: .16, strokeWidth: .7 }),
          lod && h('path', { d: C_IRIS.fa, ...ln, stroke: '#E5E7FF', strokeOpacity: .26, strokeWidth: .75 }),
          C_IRIS.crypts.map((q, i) => h('ellipse', { key: i, cx: q.x, cy: q.y, rx: q.rx, ry: q.ry, transform: `rotate(${q.rot} ${q.x} ${q.y})`, fill: '#0A0520', opacity: .5 })),
          h('circle', { r: 38.2, ...ln, stroke: '#0A0520', strokeOpacity: .45, strokeWidth: .8, strokeDasharray: '9 3 14 4 6 3' }),
          h('circle', { r: 41.4, ...ln, stroke: '#0A0520', strokeOpacity: .4, strokeWidth: .8, strokeDasharray: '5 3 11 2 7 4' }),
          h('circle', { ref: rf('core'), r: 30, fill: u('co'), opacity: .5 }),
          h('path', { d: C_IRIS.col, ...ln, stroke: '#885CFF', strokeOpacity: .55, strokeWidth: 2.8 }),
          h('path', { d: C_IRIS.col, ...ln, stroke: '#E5E7FF', strokeOpacity: .32, strokeWidth: .9 }),
          h('circle', { r: 46, fill: u('lb') }),
          h('circle', { r: 45.6, ...ln, stroke: '#BA9AFF', strokeOpacity: .14, strokeWidth: .8 }),
          h('g', { ref: rf('rings') },
            h('circle', { r: 33, ...ln, stroke: '#BA9AFF', strokeOpacity: .36, strokeWidth: .9, strokeDasharray: '22 5 3 5' }),
            h('circle', { r: 39.6, ...ln, stroke: '#BA9AFF', strokeOpacity: .5, strokeWidth: 1.3, strokeDasharray: '34 22 6 40' }),
            lod && h('path', { d: C_IRIS.tk, stroke: '#BA9AFF', strokeOpacity: .3, strokeWidth: .6 }),
            h('path', { d: C_IRIS.tK, stroke: '#E5E7FF', strokeOpacity: .55, strokeWidth: .9 }),
            [20, 140, 262].map(a => h('circle', { key: a, cx: F(36.3 * Math.cos(a * Math.PI / 180)), cy: F(36.3 * Math.sin(a * Math.PI / 180)), r: 1.3, fill: '#E5E7FF', opacity: .7 }))),
          h('circle', { ref: rf('arc'), r: 36.5, ...ln, stroke: '#E5E7FF', strokeWidth: 1.6, strokeDasharray: '12 217', opacity: 0 }),
          h('circle', { ref: rf('pulse'), r: 16, ...ln, stroke: '#BA9AFF', strokeWidth: 1.4, opacity: 0 }),
          h('circle', { ref: rf('pupil'), r: 15, fill: u('pu'), stroke: '#885CFF', strokeOpacity: .5, strokeWidth: 1 }),
          h('circle', { ref: rf('ruff'), r: 16.5, ...ln, stroke: '#BA9AFF', strokeOpacity: .34, strokeWidth: 1.1, strokeDasharray: '1.6 1.3' }),
          h('g', { ref: rf('hl'), transform: fl ? 'scale(-1 1) translate(1.2 .8)' : undefined },
            h('path', { d: C_HL, fill: '#E5E7FF' }),
            h('circle', { cx: -6.5, cy: -26, r: 1.5, fill: '#E5E7FF', opacity: .85 }),
            h('circle', { cx: 12, cy: 15, r: 2.2, fill: '#E5E7FF', opacity: .42 }),
            h('path', { d: 'M37.7 10.1A39 39 0 0 1 16.5 35.3', ...ln, stroke: '#E5E7FF', strokeOpacity: .13, strokeWidth: 2.2 })),
          h('path', { ref: rf('sp'), d: `M${fl ? -26 : 24} -30 l1.6 4.4 4.4 1.6 -4.4 1.6 -1.6 4.4 -1.6 -4.4 -4.4 -1.6 4.4 -1.6Z`, fill: '#E5E7FF', opacity: 0 })),
        h('path', { ref: rf('sh2'), d: C_G0.upD, ...ln, stroke: '#030206', strokeOpacity: .28, strokeWidth: 34 }),
        h('path', { ref: rf('sh1'), d: C_G0.upD, ...ln, stroke: '#030206', strokeOpacity: .55, strokeWidth: 14 }),
        h('path', { ref: rf('wl'), d: C_G0.lowD, ...ln, stroke: u('wg'), strokeWidth: 1.4, transform: 'translate(0 -2.6)' })),
      h('path', { ref: rf('low'), d: C_G0.lowR, fill: u('ll') }),
      h('path', { ref: rf('llash'), d: C_G0.llash, fill: '#BA9AFF', fillOpacity: .36 }),
      h('path', { ref: rf('up0'), d: C_G0.upD, ...ln, stroke: '#0E0B18', strokeWidth: 4 }),
      h('path', { ref: rf('wing'), d: C_G0.liner, fill: u('lg') }),
      h('path', { ref: rf('whi'), d: C_G0.whi, fill: '#BA9AFF', fillOpacity: .55 }),
      h('path', { ref: rf('up'), d: C_G0.edge, fill: u('rim') }),
      lod && h('path', { ref: rf('lash3'), d: C_G0.lash[3], fill: '#BA9AFF', fillOpacity: .34 }),
      h('path', { ref: rf('lash2'), d: C_G0.lash[2], fill: '#885CFF', fillOpacity: .75 }),
      h('path', { ref: rf('lash1'), d: C_G0.lash[1], fill: '#BA9AFF', fillOpacity: .62 }),
      h('path', { ref: rf('lash0'), d: C_G0.lash[0], fill: '#BA9AFF', fillOpacity: .92 }));
  };
  const st = k => el => { if (el) R.stops[k] = el; };
  const stp = (o, c, op) => h('stop', { offset: o, stopColor: c, stopOpacity: op == null ? 1 : op });
  return h('svg', { ref: el => { if (el) R.svg = el; }, viewBox: '60 16 780 244', width: w, height: w * 244 / 780, style: { display: 'block', overflow: 'visible' } },
    h('defs', null,
      h('radialGradient', { id: id + 'sc', cx: .5, cy: .55, r: .62 }, stp('0%', '#231D3D'), stp('55%', '#15122A'), stp('100%', '#08070F')),
      h('radialGradient', { id: id + 'cs' }, stp('0%', '#040309', .8), stp('100%', '#040309', 0)),
      h('radialGradient', { id: id + 'cr', cx: .55, cy: .45, r: .6 }, stp('0%', '#6E4F96'), stp('100%', '#251A3D')),
      h('radialGradient', { id: id + 'ir' }, h('stop', { ref: st('in'), offset: '0%', stopColor: '#BA9AFF' }), h('stop', { ref: st('mid'), offset: '50%', stopColor: '#885CFF' }), stp('74%', '#4A2AA6'), stp('90%', '#1E1052'), stp('100%', '#0D0722')),
      h('radialGradient', { id: id + 'co' }, stp('0%', '#E5E7FF', .5), stp('45%', '#BA9AFF', .3), stp('100%', '#BA9AFF', 0)),
      h('radialGradient', { id: id + 'lb' }, stp('0%', '#05030E', 0), stp('80%', '#05030E', 0), stp('93%', '#05030E', .55), stp('100%', '#05030E', .92)),
      h('radialGradient', { id: id + 'pu' }, stp('0%', '#000000'), stp('72%', '#04030A'), stp('100%', '#160D2E')),
      h('radialGradient', { id: id + 'ha' }, h('stop', { ref: st('halo'), offset: '0%', stopColor: '#885CFF', stopOpacity: .55 }), stp('100%', '#885CFF', 0)),
      h('linearGradient', { id: id + 'lg', gradientUnits: 'userSpaceOnUse', x1: -124, y1: 0, x2: 184, y2: 0 }, stp('0%', '#1E1540'), stp('40%', '#2A1C62'), stp('74%', '#46299F'), stp('92%', '#6C48E2'), stp('100%', '#8A66FF')),
      h('linearGradient', { id: id + 'rim', gradientUnits: 'userSpaceOnUse', x1: -124, y1: 0, x2: 138, y2: 0 }, stp('0%', '#BA9AFF', .12), stp('18%', '#885CFF', .55), stp('34%', '#885CFF', .22), stp('55%', '#BA9AFF', .78), stp('72%', '#885CFF', .32), stp('90%', '#BA9AFF', .9), stp('100%', '#885CFF', .55)),
      h('linearGradient', { id: id + 'wg', gradientUnits: 'userSpaceOnUse', x1: -124, y1: 0, x2: 138, y2: 0 }, stp('0%', '#BA9AFF', 0), stp('30%', '#BA9AFF', .12), stp('50%', '#BA9AFF', .3), stp('66%', '#BA9AFF', .08), stp('86%', '#BA9AFF', .26), stp('100%', '#BA9AFF', 0)),
      h('radialGradient', { id: id + 'sk', gradientUnits: 'userSpaceOnUse', cx: 8, cy: -24, r: 150 }, stp('0%', '#BA9AFF', .085), stp('55%', '#BA9AFF', .04), stp('100%', '#BA9AFF', 0)),
      h('linearGradient', { id: id + 'll', gradientUnits: 'userSpaceOnUse', x1: 138, y1: 0, x2: -124, y2: 0 }, stp('0%', '#BA9AFF', .55), stp('28%', '#BA9AFF', .42), stp('58%', '#885CFF', .24), stp('100%', '#885CFF', .07)),
      h('linearGradient', { id: id + 'bg', gradientUnits: 'userSpaceOnUse', x1: -118, y1: 0, x2: 142, y2: 0 }, stp('0%', '#2C2159', .5), stp('14%', '#2B1F5C', .95), stp('55%', '#231849', .92), stp('100%', '#1B1339', .5))),
    h('g', { ref: el => { if (el) R.zoom = el; } }, h('g', { ref: el => { if (el) R.follow = el; } }, eye('L'), eye('R'))));
}

export type CyberState = 'idle' | 'attention' | 'listening' | 'thinking' | 'speaking' | 'emotion' | 'scan';
export { CyberEyes };
