// @ts-nocheck — глаза MIRA 4a для телефона (Skia, рисует видеокарта; iOS и Android). Слои, цвета, состояния и вся
// логика кадра (взгляд, моргание, брови, веки, импульсы, эмоция, появление) — те же, что в шаблоне и в
// cyber-eyes.web.tsx. Каждый кадр JS записывает в SkPicture вывод готовых изображений частей глаза (см. ниже
// «готовые изображения») и несколько простых кругов: зрачок, дуга, импульс.
// Раньше здесь был react-native-svg: на Android он перерисовывает весь рисунок процессором при любом изменении,
// и при 60 обновлениях в секунду экран подтормаживал (замер 2026-10-22: 13–18% просроченных кадров).
import { Canvas, ClipOp, FilterMode, MipmapMode, PaintStyle, Picture, Skia, StrokeCap, StrokeJoin, TileMode } from '@shopify/react-native-skia';
import React, { memo, useEffect, useRef, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { AccessibilityInfo, PixelRatio, View } from 'react-native';

import {
  C_BROW, EX, C_CARU, C_CREASE, C_FUR, C_HL, C_IRIS, CE, CS, F, GZ, browGeo, lerpA, lidGeo, mixHex, revP, sstep,
} from './cyber-geo';
import { deviceTier } from './device-tier';
import { EYE_PAL, eyeHex } from './mira-theme';

export type CyberState = 'idle' | 'attention' | 'listening' | 'thinking' | 'speaking' | 'emotion' | 'scan';

const ID = 1.3, IO = .55;
const eo = x => 1 - Math.pow(1 - x, 3), eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
// запас холста вокруг рамки viewBox (в единицах рисунка): появление увеличивает глаза в 1.34 раза, глаза следуют за взглядом
const MX = 110, MY = 45;

// memo: экран разговора перерисовывается часто (прогресс, печать сообщений) — глазам это не нужно
export const CyberEyes = memo(function CyberEyes({ state, w, intro = 0, down = false }: { state: CyberState; w: number; intro?: number; down?: boolean; /** только веб-версия (на телефоне сон — в HUD) */ sleep?: boolean }) {
  const sRef = useRef(state); sRef.current = state;
  const iRef = useRef(intro); iRef.current = intro;
  const dRef = useRef(down); dRef.current = down; // смотрит вниз, на видео под глазами
  // класс устройства (device-tier.ts): high — как в шаблоне; mid — 30 кадров/с без мелких деталей; low — статичный кадр
  const tier = deviceTier();
  const lod = w >= 160 && tier === 'high';
  const kk = w / 780, H = w * 244 / 780; // единица рисунка → dp (k внутри кадра — коэффициент сглаживания)
  const px = kk * PixelRatio.get(); // единица рисунка → пиксели экрана (разрешение готовых изображений)
  const [pic0] = useState(() => { const r = Skia.PictureRecorder(); r.beginRecording(Skia.XYWHRect(0, 0, 1, 1)); return r.finishRecordingAsPicture(); });
  const picSV = useSharedValue(pic0);
  const setPic = p => { picSV.value = p; };
  useEffect(() => {
    let rm = false, alive = true;
    const lids = new Map(); // готовые веки по раскрытию
    // «уменьшить движение» в системе или слабое устройство — статичный кадр на каждое состояние (без взгляда и моргания)
    if (tier === 'low') rm = true;
    AccessibilityInfo.isReduceMotionEnabled().then(x => { rm = x || tier === 'low'; }).catch(() => {});
    const L = { t: 0, g: .5, o: 1, soft: 0, pu: 15, gx: 0, gy: 0, tgx: 0, tgy: 0, nextG: 0, nextB: 0, bStart: -9, dbl: false, ang: 0, arcA: 0, arcO: 0, lvl: 0, pulse: -9, emo: 0, sp: 0, geo: null, ver: 0, bp: C_BROW.idle.slice(), fur: 0, bg: null, bv: 0, bem: 0, lo: -1, lsf: -1, iT: -99, iSeen: null };
    let raf;
    const frame = now => {
      const t = now / 1000, dt = L.snap ? 10 : L.t ? Math.min(.05, t - L.t) : .016; L.t = t; // snap: сразу итоговое состояние
      if (L.iSeen !== iRef.current) { L.iSeen = iRef.current; L.iT = t; L.nextB = t + ID + IO + 1.4; L.nextG = t + ID + IO; L.tgx = L.tgy = L.gx = L.gy = 0; }
      const ip = (t - L.iT) / ID, wake = ip < 1 ? 0 : eio(Math.min(1, Math.max(0, (t - L.iT - ID - .08) / IO)));
      const z = Math.min(1, Math.max(0, ip)), sc = rm ? 1 : 1.34 - .34 * eo(z), fo = eo(Math.min(1, Math.max(0, ip / .75)));
      const zoomS = ip >= 1 ? 1 : +sc.toFixed(4);
      const zoomO = fo > .999 ? 1 : +fo.toFixed(3);
      const name = sRef.current in CS ? sRef.current : 'idle', S = CS[name];
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
        if (rm) { L.tgx = 0; L.tgy = 0; }
        if (!rm && Math.abs(L.tgx - px) > 12 && t - L.bStart > 2 && Math.random() < .35) { L.bStart = t + .03; L.dbl = false; L.nextB = t + 4 + Math.random() * 3; }
      }
      const kg = 1 - Math.exp(-dt / .045);
      L.gx += (L.tgx - L.gx) * kg; L.gy += (L.tgy - L.gy) * kg;
      // сами глаза плавно следуют за взглядом (эксперт, 2026-10-20): вбок — по взгляду, вниз/вверх — тоже, медленнее зрачков
      const kh = 1 - Math.exp(-dt / .35);
      L.hx = (L.hx || 0) + ((rm ? 0 : L.gx * EX.follow[0]) - (L.hx || 0)) * kh;
      L.hy = (L.hy || 0) + ((rm ? 0 : L.gy * EX.follow[1]) - (L.hy || 0)) * kh;
      if (!L.nextB) L.nextB = t + 1.5;
      if (t > L.nextB) { L.bStart = t; L.dbl = Math.random() < .15; L.nextB = t + 4 + Math.random() * 3; }
      let c = 0; const bd = .32, p = (t - L.bStart) / bd;
      if (p >= 0 && p < 1) { c = p < .4 ? p / .4 : 1 - (p - .4) / .6; c = c * c * (3 - 2 * c); }
      else if (L.dbl && p >= 1.15 && p < 2.15) { const q = p - 1.15; c = q < .4 ? q / .4 : 1 - (q - .4) / .6; c = c * c * (3 - 2 * c); }
      const o = L.o * (1 - c) * wake * (1 - L.gy * .011);
      const drx = rm ? 0 : (.7 * Math.sin(t * .83) + .45 * Math.sin(t * 1.9 + 1)) * EX.drift, dry = rm ? 0 : .4 * Math.sin(t * 1.13 + .5) * EX.drift;
      const BP = C_BROW[name] || C_BROW.idle, kb = 1 - Math.exp(-dt / .14); let bdel = 0;
      for (let i = 0; i < 14; i++) { const d = (BP[i] - L.bp[i]) * kb; L.bp[i] += d; bdel = Math.max(bdel, Math.abs(d)); }
      L.fur += ((C_FUR[name] || 0) - L.fur) * kb;
      if (bdel > .004 || !L.bg) { L.bg = browGeo(L.bp); L.bv++; }
      L.bem += (L.lvl - L.bem) * (1 - Math.exp(-dt / .35));
      const bLift = (-Math.max(0, -L.gy) * .35 - (name === 'speaking' ? sstep(.45, .8, L.bem) * 3 : 0)) * EX.lift + c * 1.5;
      if (!rm) L.ang += S.rs * dt;
      const arcOn = name === 'thinking' || name === 'scan' ? 1 : 0;
      L.arcO += (arcOn - L.arcO) * k; if (!rm) L.arcA += 72 * dt;
      // веки: раскрытие округляется до 1% (меньше пикселя), готовые веки — из кэша: расчёт контуров и их разбор в Skia
      // стоили до 25 мс и шли почти каждый кадр моргания
      const oq = Math.round(o * 100) / 100, sq = Math.round(L.soft * 50) / 50, lkey = oq + '|' + sq;
      if (lkey !== L.lkey) {
        L.lkey = lkey;
        let hit = lids.get(lkey);
        if (!hit) {
          if (lids.size > 400) lids.clear();
          const low = lerpA(CE.LO, CE.LS, sq);
          lids.set(lkey, (hit = lidArt(px, lod, lidGeo(lerpA(revP(low), CE.UO, oq), low, oq))));
        }
        L.lid = hit;
      }
      const pq = (t - L.pulse) / 1.2, pOn = !rm && pq >= 0 && pq < 1;
      if (Math.random() < .004 && name === 'emotion') L.sp = t;
      const spO = L.emo * (.55 + .45 * Math.sin(t * 3));
      const eye = s => {
        const fl = s === 'L' ? -1 : 1;
        return {
          crease: (1 - Math.min(1, o)) * 12, brow: bLift, furrow: L.fur,
          ix: 6 + (L.gx + drx) * fl + (s === 'L' ? .6 : 0), iy: -2 + L.gy + dry,
          rings: L.ang * (s === 'L' ? .85 : 1), arc: L.arcA + (s === 'L' ? 40 : 0), arcO: L.arcO * .9,
          pupil: L.pu, ruff: L.pu + 1.5, core: .3 + L.g * .55, halo: L.g * .5, hl: .7 + .3 * L.g, sp: spO,
          pulseR: pOn ? 16 + pq * 26 : 16, pulseO: pOn ? (1 - pq) * .55 : 0,
        };
      };
      if (L.gb !== L.bv) { L.gb = L.bv; L.brow = browArt(px, lod, L.bg); }
      const emo = +L.emo.toFixed(2);
      if (L.ge !== emo) { L.ge = emo; L.col = { mid: mixHex(EYE_PAL.mid, EYE_PAL.mid2, emo), inn: mixHex(EYE_PAL.inn, EYE_PAL.inn2, emo) }; L.col.ha = radial(8, 0, 170, 80, [[0, L.col.mid, .55], [1, '#885CFF', 0]]); L.iris = irisArt(px, lod, L.col); }
      setPic(drawFrame({ k: kk, s: px, lod, iris: L.iris, zoomS, zoomO, hx: L.hx, hy: L.hy, lid: L.lid, brow: L.brow, col: L.col, L: eye('L'), R: eye('R') }));
    };
    // экран 120 Гц: кадр глаз — не чаще 60 раз в секунду (mid — 30)
    const step = tier === 'mid' ? 32 : 15;
    let last = 0, shown = null;
    const tick = now => {
      if (!alive) return;
      now = now ?? performance.now();
      if (rm) {
        // статичный кадр: перерисовать только при смене состояния — два кадра с шагом 10 с, сглаживание доходит до конца
        const key = `${sRef.current}|${dRef.current}|${iRef.current}`;
        if (key !== shown) { shown = key; L.snap = true; const T = L.t * 1000 + 10000; frame(T); frame(T + 10000); L.snap = false; }
      } else if (now - last > step) { last = now; frame(now); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [kk, px, lod, tier]); // eslint-disable-line react-hooks/exhaustive-deps -- setPic: сеттер состояния, неизменен

  return (
    <View style={{ width: w, height: H }} pointerEvents="none">
      <Canvas style={{ position: 'absolute', left: -MX * kk, top: -MY * kk, width: (780 + 2 * MX) * kk, height: (244 + 2 * MY) * kk }}>
        <Picture picture={picSV} />
      </Canvas>
    </View>
  );
});

// ---------- Skia: краски, градиенты, готовые изображения ----------
// Skia рисует кадр в UI-потоке, и сложные контуры со сглаживанием (волокна радужки, ресницы, волоски бровей)
// растеризуются заново каждый кадр. Поэтому неизменное (белок, радужка с волокнами, кольца, складка, блики) заранее
// превращено в растровые изображения в разрешении экрана, радужка — заново при смене цвета (эмоция). Веки и брови
// меняются часто (моргание, взгляд, выражение) — их растр тормозил JS, они записываются вектором.

const COLORS = new Map();
const rgba = (c, a = 1) => {
  const key = c + a;
  let col = COLORS.get(key);
  if (!col) {
    c = eyeHex(c);   // вариант G «мягкие голубые глаза» (mira-theme.ts)
    const v = c[0] === '#' ? [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)) : c.match(/\d+/g).map(Number);
    COLORS.set(key, (col = Skia.Color(`rgba(${v[0]},${v[1]},${v[2]},${a})`)));
  }
  return col;
};
const path = d => Skia.Path.MakeFromSVGString(d);
const stops = s => [s.map(([, c, a]) => rgba(c, a ?? 1)), s.map(([o]) => o)];
/** Радиальный градиент на эллипсе: центр (cx, cy), радиусы rx, ry (как SVG objectBoundingBox на эллипсе/прямоугольнике). */
const radial = (cx, cy, rx, ry, s) => {
  const [cols, pos] = stops(s);
  return Skia.Shader.MakeRadialGradient({ x: 0, y: 0 }, rx, cols, pos, TileMode.Clamp, Skia.Matrix([1, 0, cx, 0, ry / rx, cy, 0, 0, 1]));
};
const linear = (x1, x2, s) => { const [cols, pos] = stops(s); return Skia.Shader.MakeLinearGradient({ x: x1, y: 0 }, { x: x2, y: 0 }, cols, pos, TileMode.Clamp); };

/** Краска: заливка цветом/градиентом или обводка (w — толщина, dash — пунктир). */
const paint = ({ color = '#FFFFFF', a = 1, shader, w, dash }) => {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  if (shader) p.setShader(shader); else p.setColor(rgba(color, 1));
  p.setAlphaf(a);
  if (w != null) {
    p.setStyle(PaintStyle.Stroke); p.setStrokeWidth(w); p.setStrokeCap(StrokeCap.Round); p.setStrokeJoin(StrokeJoin.Round);
    if (dash) p.setPathEffect(Skia.PathEffect.MakeDash(dash, 0));
  }
  return p;
};
const ln = (color, a, w, dash) => paint({ color, a, w, dash });

/** Растр области [x0, y0, x1, y1] (единицы рисунка) при s пикселей на единицу. */
const raster = (s, [x0, y0, x1, y1], draw) => {
  const W = Math.ceil((x1 - x0) * s), H = Math.ceil((y1 - y0) * s);
  const surf = Skia.Surface.Make(W, H), c = surf.getCanvas();
  c.scale(s, s); c.translate(-x0, -y0);
  draw(c);
  surf.flush();
  return { img: surf.makeImageSnapshot(), src: Skia.XYWHRect(0, 0, W, H), dst: Skia.XYWHRect(x0, y0, x1 - x0, y1 - y0) };
};
/** Векторная запись (для частей, которые меняются часто: растр на каждое изменение тормозил JS — до 50 мс на кадр). */
const record = draw => {
  const r = Skia.PictureRecorder(), c = r.beginRecording(Skia.XYWHRect(-400, -400, 1800, 1000));
  draw(c);
  return r.finishRecordingAsPicture();
};
// Общие краски кадра: запись картинки копирует краску в момент рисования, поэтому одну краску можно менять и
// переиспользовать — без новых объектов на каждый кадр.
let FP = null, SP = null, IP = null;
const fillP = (color, a, shader) => {
  const p = FP ?? (FP = Skia.Paint());
  p.setAntiAlias(true); p.setShader(shader ?? null);
  if (!shader) p.setColor(rgba(color));
  p.setAlphaf(a);
  return p;
};
const strokeP = (color, a, w, dash) => {
  if (!SP) { SP = Skia.Paint(); SP.setAntiAlias(true); SP.setStyle(PaintStyle.Stroke); SP.setStrokeCap(StrokeCap.Round); SP.setStrokeJoin(StrokeJoin.Round); }
  SP.setColor(rgba(color)); SP.setAlphaf(a); SP.setStrokeWidth(w); SP.setPathEffect(dash ?? null);
  return SP;
};
const img = (c, im, a = 1) => {
  const p = IP ?? (IP = Skia.Paint());
  p.setAlphaf(a);
  c.drawImageRectOptions(im.img, im.src, im.dst, FilterMode.Linear, MipmapMode.None, p);
};
// градиент зрачка зависит от его радиуса — кэш по десятым долям
const PUPILS = new Map();
const pupilShader = r => {
  const key = Math.round(r * 10);
  let sh = PUPILS.get(key);
  if (!sh) PUPILS.set(key, (sh = radial(0, 0, key / 10, key / 10, [[0, '#000000'], [.72, '#04030A'], [1, '#160D2E']])));
  return sh;
};

// Границы частей (единицы рисунка, координаты глаза до зеркала левого), с запасом.
const BX = {
  sclera: [-140, -80, 160, 70], iris: [-47, -47, 47, 47], hl: [-26, -31, 41, 38], crease: [-115, -63, 128, -5],
};

/** Неизменные части: один раз на масштаб s. */
let S0 = null;
const statics = (s, lod) => {
  const key = s.toFixed(3) + lod;
  if (S0 && S0.key === key) return S0;
  const caru = path(C_CARU), cb = caru.computeTightBounds();
  S0 = {
    key,
    sclera: raster(s, BX.sclera, c => {
      c.drawRect(Skia.XYWHRect(-140, -80, 300, 150), paint({ shader: radial(10, 2.5, 186, 93, [[0, '#231D3D'], [.55, '#15122A'], [1, '#08070F']]) }));
      const cs = [[0, '#040309', .8], [1, '#040309', 0]];
      c.drawOval(Skia.XYWHRect(-146, -20, 68, 60), paint({ shader: radial(-112, 10, 34, 30, cs) }));
      c.drawOval(Skia.XYWHRect(102, -38, 60, 52), paint({ shader: radial(132, -12, 30, 26, cs) }));
      c.drawPath(caru, paint({ shader: radial(cb.x + .55 * cb.width, cb.y + .45 * cb.height, .6 * cb.width, .6 * cb.height, [[0, '#6E4F96'], [1, '#251A3D']]) }));
      c.drawOval(Skia.XYWHRect(-114.4, 6.2, 4.8, 2.6), paint({ color: '#E5E7FF', a: .22 }));
      c.drawPath(path('M-101 1 C-97 7 -97 14 -101 19'), ln('#BA9AFF', .14, .9));
    }),
    collar: raster(s, BX.iris, c => {
      const col = path(C_IRIS.col);
      c.drawPath(col, ln('#885CFF', .55, 2.8));
      c.drawPath(col, ln('#E5E7FF', .32, .9));
      c.drawCircle(0, 0, 46, paint({ shader: radial(0, 0, 46, 46, [[0, '#05030E', 0], [.8, '#05030E', 0], [.93, '#05030E', .55], [1, '#05030E', .92]]) }));
      c.drawCircle(0, 0, 45.6, ln('#BA9AFF', .14, .8));
    }),
    rings: raster(s, BX.iris, c => {
      c.drawCircle(0, 0, 33, ln('#BA9AFF', .36, .9, [22, 5, 3, 5]));
      c.drawCircle(0, 0, 39.6, ln('#BA9AFF', .5, 1.3, [34, 22, 6, 40]));
      if (lod) c.drawPath(path(C_IRIS.tk), ln('#BA9AFF', .3, .6));
      c.drawPath(path(C_IRIS.tK), ln('#E5E7FF', .55, .9));
      [20, 140, 262].forEach(a => c.drawCircle(+F(36.3 * Math.cos(a * Math.PI / 180)), +F(36.3 * Math.sin(a * Math.PI / 180)), 1.3, paint({ color: '#E5E7FF', a: .7 })));
    }),
    crease: raster(s, BX.crease, c => {
      c.drawPath(path(C_CREASE.dark), paint({ color: '#030208', a: .8 }));
      c.drawPath(path(C_CREASE.hi), paint({ color: '#BA9AFF', a: .22 }));
    }),
    // блики: у левого глаза зеркальные (scale(-1 1) translate(1.2 .8) внутри уже зеркального глаза)
    hl: [true, false].map(fl => raster(s, BX.hl, c => {
      c.save(); if (fl) { c.scale(-1, 1); c.translate(1.2, .8); }
      c.drawPath(path(C_HL), paint({ color: '#E5E7FF' }));
      c.drawCircle(-6.5, -26, 1.5, paint({ color: '#E5E7FF', a: .85 }));
      c.drawCircle(12, 15, 2.2, paint({ color: '#E5E7FF', a: .42 }));
      c.drawPath(path('M37.7 10.1A39 39 0 0 1 16.5 35.3'), ln('#E5E7FF', .13, 2.2));
      c.restore();
    })),
    arcDash: Skia.PathEffect.MakeDash([12, 217], 0), ruffDash: Skia.PathEffect.MakeDash([1.6, 1.3], 0),
    haloRect: Skia.XYWHRect(-162, -80, 340, 160),
    spark: [-26, 24].map(x => path(`M${x} -30 l1.6 4.4 4.4 1.6 -4.4 1.6 -1.6 4.4 -1.6 -4.4 -4.4 -1.6 4.4 -1.6Z`)),
    frameRect: (() => { let kk = 0, r = null; return k => (k === kk ? r : (kk = k, r = Skia.XYWHRect(0, 0, (780 + 2 * MX) * k, (244 + 2 * MY) * k))); })(),
    furrow: path('M-123 -78 C-125 -74 -125 -69.5 -123.5 -65.5'),
    sk: radial(8, -24, 150, 150, [[0, '#BA9AFF', .085], [.55, '#BA9AFF', .04], [1, '#BA9AFF', 0]]),
    co: radial(0, 0, 30, 30, [[0, '#E5E7FF', .5], [.45, '#BA9AFF', .3], [1, '#BA9AFF', 0]]),
    wg: linear(-124, 138, [[0, '#BA9AFF', 0], [.3, '#BA9AFF', .12], [.5, '#BA9AFF', .3], [.66, '#BA9AFF', .08], [.86, '#BA9AFF', .26], [1, '#BA9AFF', 0]]),
    lg: linear(-124, 184, [[0, '#1E1540'], [.4, '#2A1C62'], [.74, '#46299F'], [.92, '#6C48E2'], [1, '#8A66FF']]),
    rim: linear(-124, 138, [[0, '#BA9AFF', .12], [.18, '#885CFF', .55], [.34, '#885CFF', .22], [.55, '#BA9AFF', .78], [.72, '#885CFF', .32], [.9, '#BA9AFF', .9], [1, '#885CFF', .55]]),
    ll: linear(138, -124, [[0, '#BA9AFF', .55], [.28, '#BA9AFF', .42], [.58, '#885CFF', .24], [1, '#885CFF', .07]]),
    bg: linear(-118, 142, [[0, '#2C2159', .5], [.14, '#2B1F5C', .95], [.55, '#231849', .92], [1, '#1B1339', .5]]),
  };
  return S0;
};

/** Радужка с волокнами и криптами — при смене цвета (эмоция). */
const irisArt = (s, lod, col) => raster(s, BX.iris, c => {
  c.drawCircle(0, 0, 46, paint({ shader: radial(0, 0, 46, 46, [[0, col.inn], [.5, col.mid], [.74, '#4A2AA6'], [.9, '#1E1052'], [1, '#0D0722']]) }));
  if (lod) {
    c.drawPath(path(C_IRIS.fd), ln('#0B0624', .55, 1.2));
    c.drawPath(path(C_IRIS.fb), ln('#BA9AFF', .16, .7));
    c.drawPath(path(C_IRIS.fa), ln('#E5E7FF', .26, .75));
  }
  C_IRIS.crypts.forEach(q => {
    c.save(); c.rotate(+q.rot, +q.x, +q.y);
    c.drawOval(Skia.XYWHRect(q.x - q.rx, q.y - q.ry, 2 * q.rx, 2 * q.ry), paint({ color: '#0A0520', a: .5 }));
    c.restore();
  });
  c.drawCircle(0, 0, 38.2, ln('#0A0520', .45, .8, [9, 3, 14, 4, 6, 3]));
  c.drawCircle(0, 0, 41.4, ln('#0A0520', .4, .8, [5, 3, 11, 2, 7, 4]));
});

/** Веки при данном раскрытии — при моргании и смене взгляда (вектор: меняются почти каждый кадр моргания). */
const lidArt = (s, lod, G) => {
  const S = statics(s, lod), up = path(G.upD), low = path(G.lowD), clip = path(G.clip);
  return {
    clip,
    skin: record(c => c.drawPath(path(G.skin), paint({ shader: S.sk }))),
    shade: record(c => {
      c.drawPath(up, paint({ color: '#030206', a: .28, w: 34 }));
      c.drawPath(up, paint({ color: '#030206', a: .55, w: 14 }));
      c.translate(0, -2.6); c.drawPath(low, paint({ shader: S.wg, w: 1.4 }));
    }),
    front: record(c => {
      c.drawPath(path(G.lowR), paint({ shader: S.ll }));
      c.drawPath(path(G.llash), paint({ color: '#BA9AFF', a: .36 }));
      c.drawPath(up, paint({ color: '#0E0B18', w: 4 }));
      c.drawPath(path(G.liner), paint({ shader: S.lg }));
      c.drawPath(path(G.whi), paint({ color: '#BA9AFF', a: .55 }));
      c.drawPath(path(G.edge), paint({ shader: S.rim }));
      if (lod) c.drawPath(path(G.lash[3]), paint({ color: '#BA9AFF', a: .34 }));
      c.drawPath(path(G.lash[2]), paint({ color: '#885CFF', a: .75 }));
      c.drawPath(path(G.lash[1]), paint({ color: '#BA9AFF', a: .62 }));
      c.drawPath(path(G.lash[0]), paint({ color: '#BA9AFF', a: .92 }));
    }),
  };
};

/** Бровь (без морщинки — у неё своя прозрачность) — при смене выражения (вектор). */
const browArt = (s, lod, bg) => {
  const S = statics(s, lod);
  return record(c => {
    c.drawPath(path(bg.fill), paint({ shader: S.bg }));
    if (lod) {
      c.drawPath(path(bg.hair[0]), paint({ color: '#BA9AFF', a: .42 }));
      c.drawPath(path(bg.hair[1]), paint({ color: '#885CFF', a: .5 }));
      c.drawPath(path(bg.hair[2]), paint({ color: '#E5E7FF', a: .16 }));
    }
    c.drawPath(path(bg.hi), paint({ color: '#BA9AFF', a: .42 }));
  });
};

/** Один кадр: оба глаза в координатах шаблона (viewBox 60 16 780 244) с запасом MX, MY. Новых объектов Skia за кадр
 *  почти не создаётся (краски — общие, градиенты — из кэша): иначе раз в пару секунд сборка мусора давала кадр ~30 мс. */
const drawFrame = f => {
  const S = statics(f.s, f.lod);
  const r = Skia.PictureRecorder();
  const c = r.beginRecording(S.frameRect(f.k));
  c.scale(f.k, f.k); c.translate(MX - 60, MY - 16);
  const fade = f.zoomO < .999;
  if (fade) c.saveLayer(fillP('#000000', f.zoomO));
  c.save();
  if (f.zoomS !== 1) { c.translate(450, 150); c.scale(f.zoomS, f.zoomS); c.translate(-450, -150); }
  c.translate(f.hx, f.hy);
  ['L', 'R'].forEach(s => {
    const e = f[s], fl = s === 'L';
    c.save();
    c.translate(fl ? 270 : 630, 150); c.scale(fl ? -1 : 1, 1);
    c.drawOval(S.haloRect, fillP(null, e.halo, f.col.ha));
    c.drawPicture(f.lid.skin);
    c.save(); c.translate(0, e.brow);
    c.drawPicture(f.brow);
    if (e.furrow > .005) c.drawPath(S.furrow, strokeP('#BA9AFF', .24 * e.furrow, 1));
    c.restore();
    c.save(); c.translate(0, e.crease); img(c, S.crease); c.restore();
    // глазное яблоко под маской век
    c.save(); c.clipPath(f.lid.clip, ClipOp.Intersect, true);
    img(c, S.sclera);
    c.save(); c.translate(e.ix, e.iy);
    img(c, f.iris);
    c.drawCircle(0, 0, 30, fillP(null, e.core, S.co));
    img(c, S.collar);
    c.save(); c.rotate(e.rings, 0, 0); img(c, S.rings); c.restore();
    if (e.arcO > .005) { c.save(); c.rotate(e.arc, 0, 0); c.drawCircle(0, 0, 36.5, strokeP('#E5E7FF', e.arcO, 1.6, S.arcDash)); c.restore(); }
    if (e.pulseO > .005) c.drawCircle(0, 0, e.pulseR, strokeP('#BA9AFF', e.pulseO, 1.4));
    c.drawCircle(0, 0, e.pupil, fillP(null, 1, pupilShader(e.pupil)));
    c.drawCircle(0, 0, e.pupil, strokeP('#885CFF', .5, 1));
    c.drawCircle(0, 0, e.ruff, strokeP('#BA9AFF', .34, 1.1, S.ruffDash));
    img(c, S.hl[fl ? 0 : 1], e.hl);
    if (e.sp > .005) c.drawPath(S.spark[fl ? 0 : 1], fillP('#E5E7FF', e.sp));
    c.restore();
    c.drawPicture(f.lid.shade);
    c.restore();
    c.drawPicture(f.lid.front);
    c.restore();
  });
  c.restore();
  if (fade) c.restore();
  return r.finishRecordingAsPicture();
};

// для HUD шлема (mira-hud.tsx): готовые изображения частей глаза считаются заранее, кадр рисует видеокарта
export { statics, irisArt, lidArt, browArt, radial, record, rgba, MX, MY };
