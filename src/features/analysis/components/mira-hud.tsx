/* eslint-disable react-hooks/immutability --
   покадровая анимация / жесты: изменяемое состояние кадра живёт в ref и SharedValue мимо React (иначе — перерисовка
   экрана на каждый кадр); плеер expo-video управляется присваиванием свойств. React Compiler такие компоненты
   не оптимизирует (сам пропускает), поведение проверено на телефоне (прототип coldarmsAI/mobile). */
// @ts-nocheck — HUD шлема MIRA, вариант D «Неон: только утолщения» из шаблона «MIRA Helmet HUD Neon.dc.html»
// (frame="accents"; эксперт, 2026-11-15), без радара в правом нижнем углу.
//
// Почему так, а не как в шаблоне: шаблон каждый кадр пересчитывает всё в JavaScript и переписывает SVG — на телефоне
// это основной поток, глаза тормозили и замирали, когда он занят (опрос сервера, чат). Здесь:
//   • логика кадра (взгляд, моргание, состояния, пружины параллакса, прицелы, шкалы, тексты) и запись картинки кадра —
//     один ворклет Reanimated в потоке интерфейса (useFrameCallback); основной поток JavaScript за кадр ничего не делает;
//   • рисует видеокарта (Skia): всё неподвижное (рамка с неоновым свечением, подписи, сетки, прицелы, части глаза)
//     запечено в изображения один раз; веки — готовые картинки на каждые 5% раскрытия; «рыбий глаз» — шейдер.
//   Декларативные компоненты Skia (по свойству на каждый анимированный параметр) не годятся: их ~250 обработчиков
//   на кадр — 85% кадров с задержкой (замер на Galaxy S23 Ultra, 2026-11-15); одна запись кадра — без этого.
// Геометрия и поведение глаз — те же, что у глаз 4a (cyber-geo.ts, cyber-eyes.tsx).
import {
  BlurStyle, Canvas, ClipOp, FilterMode, Group, MipmapMode, PaintStyle, Picture, Skia, StrokeCap, StrokeJoin, TileMode, matchFont,
} from '@shopify/react-native-skia';
import { memo, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, PixelRatio, StyleSheet, Text as RNText, View } from 'react-native';
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle, useFrameCallback, useSharedValue, withSpring } from 'react-native-reanimated';

import { C_BROW, C_FUR, CE, CS, EX, GZ, lerpA, lidGeo, mixHex, revP, browGeo } from './cyber-geo';
import { browArt, irisArt, lidArt, radial, record, statics } from './cyber-eyes';
import type { CyberState } from './cyber-eyes';
import { deviceTier } from './device-tier';
import { DUSK, EYE_PAL, SOFT, dusk, eyeHex } from './mira-theme';
import { mira } from './mira';

// ---------- размеры шаблона ----------
const DW = 390;             // ширина шаблона
const DH = 240;             // высота HUD (линза 34…204, рамка 30…236)
const LENS_Y = 34, LENS_H = 170, HUD_Y = 30;
// пружина сворачивания / раскрытия: мягкий выход с лёгкой инерцией, без «отскока»
const SPRING = { damping: 22, stiffness: 170, mass: 1 };
const PLATE_H = 34;        // свёрнутый визор — плашка «MIRA • статус»
// холст шире визора на столько с каждой стороны: неоновое свечение рамки выходит за её линии и иначе обрезалось
// краем холста — видно, когда визор не во всю ширину экрана (эксперт, 2026-11-16)
const BLEED = 18;
// слои радужки варианта G (замер нагрузки: EXPO_PUBLIC_HUD_SOFT=0 — без них)
const SOFT_ON = process.env.EXPO_PUBLIC_HUD_SOFT !== '0';
const EYES_Y = 22;         // глаза в линзе: шаблон — 35, подняты выше (эксперт, 2026-11-15)
const EYE_K = 320 / 780;    // глаза 320×100 в линзе, рисунок глаз — 780×244 (viewBox 60 16)
const ST = ['idle', 'attention', 'listening', 'thinking', 'speaking', 'emotion', 'scan'];
const NB = 23, OSTEP = 0.05;        // веки: раскрытие 0…1.1 шагом 5%
const SOFTS = [0, 0.5, 1];          // «мягкость» нижнего века (эмоция)
const FISHEYE = 0.24 * 0.6;         // шаблон: k = .24 × fisheye(0.6)
const BOOT = { glass: .25, flw: 1.0, acc: 1.05, M: 1.25, cdot: 1.3, mira: 1.4, stripe: 1.45, gauge: 1.45, tc: 1.5, ruler: 1.5,
  stripe2: 1.55, retL: 1.6, retR: 1.7, gz: 1.85, lk: 1.95, waves: 2.05, ld: 2.1, bars: 2.1, scan: 2.2, mm: 2.25 };
const STYLES = ['Top roll', 'Hook', 'Kings move', 'Press', 'High hook', 'Side pressure'];

// ---------- готовые изображения глаз (основной поток, один раз; веки — постепенно, не мешая интерфейсу) ----------
let ART = null;
const halo = (col) => record((c) => {
  const p = Skia.Paint(); p.setAntiAlias(true); p.setShader(radial(8, 0, 170, 80, [[0, col.mid, .55], [1, '#885CFF', 0]]));
  c.drawOval(Skia.XYWHRect(-162, -80, 340, 160), p);
});
const colOf = (emo) => ({ mid: mixHex(EYE_PAL.mid, EYE_PAL.mid2, emo), inn: mixHex(EYE_PAL.inn, EYE_PAL.inn2, emo) });
const lidAt = (px, lod, oq, sq) => {
  const low = lerpA(CE.LO, CE.LS, sq);
  return lidArt(px, lod, lidGeo(lerpA(revP(low), CE.UO, oq), low, oq));
};
function art(px, lod) {
  const key = px.toFixed(3) + lod;
  if (ART && ART.key === key) return ART;
  const S = statics(px, lod);
  const core = record((c) => { const p = Skia.Paint(); p.setAntiAlias(true); p.setShader(S.co); c.drawCircle(0, 0, 30, p); });
  ART = {
    key, S, core,
    iris: [irisArt(px, lod, colOf(0)), irisArt(px, lod, colOf(1))],
    halo: [halo(colOf(0)), halo(colOf(1))],
    brows: ST.map((s) => browArt(px, lod, browGeo(C_BROW[s] || C_BROW.idle))),
    lids: new Array(NB * SOFTS.length).fill(null),
  };
  ART.lids[0 * NB + 20] = lidAt(px, lod, 1, 0);   // открытые веки — сразу; остальные — в фоне
  return ART;
}

// ---------- шейдер линзы: «рыбий глаз», как feDisplacementMap шаблона ----------
const LENS = Skia.RuntimeEffect.Make(`
uniform shader image;
uniform float2 c;
uniform float2 rad;
uniform float k;
half4 main(float2 xy) {
  float2 p = xy - c;
  float2 q = p / rad;
  float f = k * max(0.0, 1.0 - (q.x * q.x + q.y * q.y) / 2.0);
  return image.eval(c + p * (1.0 - f));
}`);

// ---------- контуры шаблона ----------
const P = (d) => Skia.Path.MakeFromSVGString(d);
const PATHS = {
  glassClip: P('M195 3.5H148L142 9.5H26L6 29.5V173L22 193.5H96L109 172.5H281L294 193.5H368L384 173V29.5L364 9.5H248L242 3.5Z'),
  acc: P('M6 54V29.5L26 9.5H60M384 54V29.5L364 9.5H330M6 148V173L22 193.5H48M384 148V173L368 193.5H342'),
  accTop: P('M168 3.5H222'),
  accTri: P('M191.6 8H198.4L195 12.4Z'),
  accSide: P('M6 93H12.5M384 93H377.5'),
  mLine: P('M195 16V74M195 112V166'),
  mDia: P('M195 37L197.4 40L195 43L192.6 40Z'),
  mCross: P('M182 93H186.5M189.5 93H192.5M197.5 93H200.5M203.5 93H208M195 87.5V90.5M195 95.5V98.5'),
  mTri: P('M195 144L152 170M195 144L238 170M170 159H220'),
  mArcs: P('M72 140Q107 156 142 140M248 140Q283 156 318 140'),
  rtL: P('M72 138.5Q107 154.5 142 138.5'),
  rtR: P('M248 138.5Q283 154.5 318 138.5'),
  gaugeBase: P('M12 0V22H16'),
  rulTri: P('M371 70L373.6 72L371 74Z'),
  rcL: [P('M50 32V43M50 57V68M32 50H43M57 50H68'), P('M50 12V25M50 75V88M12 50H25M75 50H88'), P('M47.6 12H52.4M47.6 88H52.4M12 47.6V52.4M88 47.6V52.4')],
  rcR: [P('M50 38V45M50 55V62M38 50H45M55 50H62'), P('M50 8V20M50 80V92M8 50H20M80 50H92'), P('M50 11L47.9 14.8H52.1ZM50 89L47.9 85.2H52.1ZM11 50L14.8 47.9V52.1ZM89 50L85.2 47.9V52.1Z'), P('M27 31V27H31M69 27H73V31M73 69V73H69M31 73H27V69')],
  raRtri: P('M50 6.6L48.8 8.8H51.2Z'),
  waveGrid: P('M11 0V22M22 0V22M33 0V22M44 0V22M55 0V22M0 5.5H66M0 11H66M0 16.5H66'),
  waveAxis: P('M0 0V22H66'),
};
/** Прицел левого глаза MIRA (справа на экране) — для прицела в «скане» людей (aim-reticle.tsx): тот же рисунок 100×100. */
export const RETICLE = { ticksIn: PATHS.rcR[0], ticksOut: PATHS.rcR[1], tris: PATHS.rcR[2], corners: PATHS.rcR[3], arcTri: PATHS.raRtri };
// стекло визора: виньетка + строки развёртки (неизменно — одна запись)
const GLASS = record((c) => {
  c.save(); c.clipPath(PATHS.glassClip, 1, true);
  const p = Skia.Paint(); p.setAntiAlias(true);
  p.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: 0 }, { x: 0, y: 206 },
    [Skia.Color(dusk('rgba(110,70,255,.05)')), Skia.Color(dusk('rgba(110,70,255,.012)')), Skia.Color(dusk('rgba(110,70,255,.04)'))], [0, .45, 1], 0));
  c.drawRect(Skia.XYWHRect(0, 0, DW, 206), p);
  p.setShader(Skia.Shader.MakeRadialGradient({ x: 195, y: 92.7 }, 253, [Skia.Color(dusk('rgba(98,60,255,0)')), Skia.Color(dusk('rgba(98,60,255,0)')), Skia.Color(dusk('rgba(98,60,255,.13)'))], [0, .55, 1], 0, Skia.Matrix([1, 0, 0, 0, 309 / 253, 0, 0, 0, 1])));
  c.drawRect(Skia.XYWHRect(0, 0, DW, 206), p);
  const l = Skia.Paint(); l.setColor(Skia.Color(dusk('rgba(186,154,255,.035)')));
  for (let y = 0; y < 206; y += 3) c.drawRect(Skia.XYWHRect(0, y, DW, 1), l);
  c.restore();
});

// ---------- вариант G: слои радужки (mira-theme.SOFT) ----------
const toRgba = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
const SOFT_RGBA = Object.fromEntries(['well', 'rim', 'back', 'glow'].map((k) => [k, SOFT[k].map(([o, c, a]) => [o, toRgba(c, a)])]));
const SOFT_TICKS = Array.from({ length: 12 }, (_, k) => {
  const a = (k * Math.PI) / 6, r1 = k % 3 ? 25.4 : 24.6, r2 = 27.2, f = (v) => v.toFixed(2);
  return `M${f(r1 * Math.cos(a))} ${f(r1 * Math.sin(a))}L${f(r2 * Math.cos(a))} ${f(r2 * Math.sin(a))}`;
}).join('');

// ---------- кадр: ворклет в потоке интерфейса ----------
const clamp = (v, a, b) => { 'worklet'; return Math.min(b, Math.max(a, v)); };
const bootOp = (q) => { 'worklet'; return q < 0 ? 0 : q < .06 ? .8 : q < .12 ? .1 : q < .6 ? Math.min(1, .2 + (q - .12) * 1.8) : 1; };
const eo = (x) => { 'worklet'; return 1 - Math.pow(1 - x, 3); };
const eio = (x) => { 'worklet'; return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

function initState() {
  const p = (x, y) => ({ x, y, vx: 0, vy: 0 });
  return {
    t: 0, g: .5, o: 1, soft: 0, pu: 15, gx: 0, gy: 0, tgx: 0, tgy: 0, hx: 0, hy: 0, nextG: 0, nextB: 0, bStart: -9, dbl: false,
    ang: 0, arcA: 0, arcO: 0, lvl: 0, pulse: -9, emo: 0, st: '', stT: 0, away: false, fixT: 0, fixD: .8, fur: 0, bem: 0,
    iT: -99, iSeen: -1, browFrom: 0, browTo: 0, browMix: 1, sp: -9,
    F: p(0, 0), M: p(0, 0), N: p(0, 0), rL: p(118, 77), rR: p(271, 77),
    lock: 0, sweep: 0, flash: 0, aL: 0, aR: 120, tn: 0, amp: 2, spl: .2, gl: .5, dim: 1, ry: 0, thT: 0, thSt: '', stOp: 0,
    txT: 0, gz: '+0.00 +0.00', fo: '0.50', lk: '99%', tc: '00:00:00', boot0: -1, last: 0,
  };
}

/** collapsed — нужно действие спортсмена (вопрос, кнопка): визор свёрнут в плашку «MIRA • статус», освобождая место
 *  видео и чату; ответил — плашка раскрывается, визор и глаза включаются заново (эксперт, 2026-11-15). Свёрнутый HUD
 *  не рисуется вовсе (кадры не считаются). */
export const MiraHud = memo(function MiraHud({ state, width, intro = 0, down = false, statusText, statusColor, collapsed = false, sleep = false,
  rootRef, dotRef, eyeOut, cvOut, gazeIn }: {
  state: CyberState; width: number; intro?: number; down?: boolean; statusText: string; statusColor: string; collapsed?: boolean;
  /** для прицела в «скане» (aim-reticle.tsx): блок визора и точка статуса (measure), центр прицела левого глаза MIRA
   *  в блоке (точки экрана, с поправкой на «рыбий глаз»), насколько свёрнут визор (0…1) */
  rootRef?: object; dotRef?: object; eyeOut?: { value: { x: number; y: number } }; cvOut?: { value: number };
  /** куда смотреть, пока прицел идёт по силуэтам (первый круг скана): x — доля ширины экрана −1…1, on — включено */
  gazeIn?: { value: { x: number; on: number } };
  /** вне окна разбора (21:00–06:00 МСК) MIRA спит: веки опускаются, взгляд вниз, без морганий, визор приглушён */
  sleep?: boolean;
}) {
  const S = width / DW;
  const tier = deviceTier();
  const lod = tier === 'high';
  const pd = PixelRatio.get();
  const px = EYE_K * S * pd;             // единица рисунка глаз → пиксели экрана (разрешение готовых изображений)
  const A = useMemo(() => art(px, lod), [px, lod]);

  // веки на каждые 5% раскрытия: в фоне, по одному за кадр — интерфейс не замирает (кэш на весь сеанс)
  const lidsSV = useSharedValue(A.lids.slice());
  // веки — готовыми изображениями: векторные ресницы и подводка растеризуются заново каждый кадр (дорого). Ворклет
  // просит запечь раскрытие, которое встретилось; пока не готово — рисует вектор. Частые раскрытия быстро становятся картинками.
  const lidImgSV = useSharedValue(new Array(NB * SOFTS.length).fill(null));
  // кэш картинок век — заново при смене рисунка глаз (A)
  const imgs = useMemo(() => new Array(NB * SOFTS.length).fill(null), [A]); // eslint-disable-line react-hooks/exhaustive-deps
  const bakeLid = (i) => {
    if (imgs[i] || !A.lids[i]) return;
    const ke = EYE_K * S * pd, box = [-165, -130, 180, 80], L0 = A.lids[i];
    imgs[i] = { skin: bake(ke, box, (c) => c.drawPicture(L0.skin)), shade: bake(ke, box, (c) => c.drawPicture(L0.shade)), front: bake(ke, box, (c) => c.drawPicture(L0.front)) };
    lidImgSV.value = imgs.slice();
  };
  useEffect(() => {
    let alive = true;
    const order = [];
    SOFTS.forEach((_, si) => { for (let i = NB - 1; i >= 0; i--) order.push([si, i]); });
    const step = () => {
      if (!alive) return;
      const next = order.find(([si, i]) => !A.lids[si * NB + i]);
      if (!next) return;
      const [si, i] = next;
      A.lids[si * NB + i] = lidAt(px, lod, Math.round(i * OSTEP * 100) / 100, SOFTS[si]);
      lidsSV.value = A.lids.slice();
      setTimeout(step, 16);
    };
    setTimeout(step, 300);
    return () => { alive = false; };
  }, [A]);  // eslint-disable-line react-hooks/exhaustive-deps

  // входы с экрана → поток интерфейса
  const stSV = useSharedValue(ST.indexOf(state) < 0 ? 0 : ST.indexOf(state));
  const downSV = useSharedValue(down);
  const introSV = useSharedValue(intro);
  const wakeSV = useSharedValue(0);              // сколько раз раскрывался — включение визора заново
  const rmSV = useSharedValue(tier === 'low');
  const sleepSV = useSharedValue(sleep);
  useEffect(() => { sleepSV.value = sleep; }, [sleep]); // eslint-disable-line
  useEffect(() => { stSV.value = ST.indexOf(state) < 0 ? 0 : ST.indexOf(state); }, [state]); // eslint-disable-line
  useEffect(() => { downSV.value = down; }, [down]); // eslint-disable-line
  useEffect(() => { introSV.value = intro; }, [intro]); // eslint-disable-line
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((x) => { rmSV.value = x || tier === 'low'; }).catch(() => {});
  }, []); // eslint-disable-line

  // запечённое неподвижное, шрифт, линза — один раз на размер экрана
  const font = useMemo(() => matchFont({ fontFamily: 'monospace', fontSize: 8, fontStyle: 'italic', fontWeight: '500' }), []);
  const R = useMemo(() => {
    const b = Skia.RuntimeShaderBuilder(LENS);
    b.setUniform('c', [195 * S * pd, (LENS_Y + 85) * S * pd]);
    b.setUniform('rad', [195 * S * pd, 85 * S * pd]);
    b.setUniform('k', [FISHEYE]);
    const lensPaint = Skia.Paint();
    lensPaint.setImageFilter(Skia.ImageFilter.MakeRuntimeShader(b, null, null));
    const { sclera, collar, rings, crease, hl, arcDash, ruffDash, furrow, spark } = A.S;   // в ворклет — только картинки и контуры
    return { B: bakeAll(S, pd, font, A), A: { S: { sclera, collar, rings, crease, hl, arcDash, ruffDash, furrow, spark }, iris: A.iris }, S, pd, lensPaint, font };
  }, [S, pd, font, A]);
  const [pic0] = useState(() => { const r = Skia.PictureRecorder(); r.beginRecording(Skia.XYWHRect(0, 0, 1, 1)); return r.finishRecordingAsPicture(); });
  const picSV = useSharedValue(pic0);

  const E = useSharedValue(initState());
  const O = useSharedValue(null);

  const frame = useFrameCallback((fi) => {
    'worklet';
    const L = E.value;
    const now = fi.timestamp;
    if (now - L.last < 15) return;          // экран 120 Гц — кадр HUD не чаще 60 раз в секунду
    L.last = now;
    const t = now / 1000, dt = L.t ? Math.min(.05, t - L.t) : .016;
    L.t = t;
    const rm = rmSV.value;
    if (L.boot0 < 0) L.boot0 = t;
    if (L.iSeen !== introSV.value) { L.iSeen = introSV.value; L.iT = t; L.nextB = t + 3.3; L.nextG = t + 1.85; L.tgx = L.tgy = L.gx = L.gy = 0; L.boot0 = t; L.bootK = 1; L.bootSmooth = false; }
    // раскрылся после ожидания ответа: визор включается заново — быстрее первого раза, глаза «просыпаются» морганием
    if (L.wSeen !== wakeSV.value) { L.wSeen = wakeSV.value; if (L.wSeen > 0) { L.boot0 = t; L.bootK = 2.6; L.bootSmooth = true; L.bStart = t + .12; L.dbl = false; } }
    const ID = 1.3, IO = .55;
    const ip = (t - L.iT) / ID, wake = ip < 1 ? 0 : eio(clamp((t - L.iT - ID - .08) / IO, 0, 1));
    const zoomS = rm ? 1 : ip >= 1 ? 1 : 1.34 - .34 * eo(clamp(ip, 0, 1));
    const zoomO = eo(clamp(ip / .75, 0, 1));
    const slpOn = sleepSV.value;
    L.slp = (L.slp ?? (slpOn ? 1 : 0)) + ((slpOn ? 1 : 0) - (L.slp ?? 0)) * (1 - Math.exp(-dt / (slpOn ? .6 : .35)));
    const name = slpOn ? 'idle' : ST[stSV.value] || 'idle', Sd = CS[name];
    const k = 1 - Math.exp(-dt / .12);
    let gT = Sd.g;
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
    L.g += (gT - L.g) * k; L.o += (Sd.o - L.o) * k; L.soft += (Sd.soft - L.soft) * k; L.pu += (Sd.pu - L.pu) * k;
    L.emo += ((name === 'emotion' ? 1 : 0) - L.emo) * k;
    if (name !== L.st) {
      if (name === 'emotion') L.flash = 1;
      L.st = name; L.stT = t; L.nextG = Math.min(L.nextG, t + .12); L.away = false; L.fixT = t; L.fixD = .8;
      const to = ST.indexOf(name);
      if (to !== L.browTo) { L.browFrom = L.browTo; L.browTo = to; L.browMix = 0; }
    }
    // HUD «читает» список техник, пока думает — глаза смотрят на строку
    if (name === 'thinking' && L.thSt !== 'thinking') L.thT = t;
    L.thSt = name;
    const thOn = name === 'thinking', q = thOn ? t - L.thT : 99, T0 = .45, STEP = .5;
    const cur = thOn ? Math.floor((q - T0) / STEP) : -1, looking = thOn && q >= T0 && cur < STYLES.length;
    L.stOp += ((thOn ? 1 : 0) - L.stOp) * (1 - Math.exp(-dt / (thOn ? .05 : .25)));
    if (t > L.nextG && t > L.iT + ID + IO) {
      const Z = GZ[name], r = (a, b) => a + Math.random() * (b - a), pxv = L.tgx;
      if (looking) { L.tgx = 23; L.tgy = -11 + cur * 3.4; L.nextG = t + .2; }
      else if (downSV.value) { L.tgx = r(-16, 16) * EX.gaze; L.tgy = r(7, 11) * EX.gaze; L.nextG = t + r(.5, 1.2); }
      else if (name === 'scan') { L.tgx = (Math.random() * 2 - 1) * 18 * EX.gaze; L.tgy = (5 + Math.random() * 5) * EX.gaze; L.nextG = t + .35 + Math.random() * .35; }
      else if (L.away) { L.away = false; L.tgx = r(-2, 2); L.tgy = r(-1.2, 1.2); L.fixT = t; L.fixD = r(Z.fix[0], Z.fix[1]); L.nextG = t + r(.45, 1.1); }
      else if (t - L.fixT > L.fixD && t - L.stT > Z.wait && Math.random() < Z.away) {
        L.away = true; const sx = Math.random() < .5 ? -1 : 1;
        L.tgx = sx * Z.ax * r(.55, 1); L.tgy = Z.up ? -Z.ay * r(.5, 1) : r(-.7, 1) * Z.ay;
        L.nextG = t + r(Z.hold[0], Z.hold[1]);
      } else { L.tgx = r(-2.2, 2.2) * EX.gaze; L.tgy = r(-1.4, 1.4) * EX.gaze + (name === 'attention' ? 1 : 0); L.nextG = t + r(.45, 1.1); }
      if (rm) { L.tgx = 0; L.tgy = 0; }
      if (slpOn) { L.tgx = 0; L.tgy = 2; L.nextG = t + 1; }
      if (!rm && Math.abs(L.tgx - pxv) > 12 && t - L.bStart > 2 && Math.random() < .35) { L.bStart = t + .03; L.dbl = false; L.nextB = t + 4 + Math.random() * 3; }
    }
    // скан людей, первый круг: глаза за прицелом — слева направо с остановками на силуэтах, взгляд чуть вниз (на кадр),
    // как при «чтении» списка стилей (эксперт, 2026-11-18)
    const gz = gazeIn?.value;
    if (gz && gz.on > 0 && !slpOn && !rm) { L.tgx = gz.x * 30; L.tgy = 11; L.away = false; L.nextG = t + .12; }   // эксперт: выраженнее
    const kg = 1 - Math.exp(-dt / .045);
    L.gx += (L.tgx - L.gx) * kg; L.gy += (L.tgy - L.gy) * kg;
    const kh = 1 - Math.exp(-dt / .35);
    L.hx += ((rm ? 0 : L.gx * EX.follow[0]) - L.hx) * kh;
    L.hy += ((rm ? 0 : L.gy * EX.follow[1]) - L.hy) * kh;
    if (!L.nextB) L.nextB = t + 1.5;
    if (!rm && !slpOn && t > L.nextB) { L.bStart = t; L.dbl = Math.random() < .15; L.nextB = t + 4 + Math.random() * 3; }
    let c = 0; const pb = (t - L.bStart) / .32;
    if (pb >= 0 && pb < 1) { c = pb < .4 ? pb / .4 : 1 - (pb - .4) / .6; c = c * c * (3 - 2 * c); }
    else if (L.dbl && pb >= 1.15 && pb < 2.15) { const qq = pb - 1.15; c = qq < .4 ? qq / .4 : 1 - (qq - .4) / .6; c = c * c * (3 - 2 * c); }
    const o = L.o * (1 - c) * wake * (1 - L.gy * .011) * (1 - .93 * L.slp);
    const drx = rm ? 0 : (.7 * Math.sin(t * .83) + .45 * Math.sin(t * 1.9 + 1)) * EX.drift, dry = rm ? 0 : .4 * Math.sin(t * 1.13 + .5) * EX.drift;
    const kb = 1 - Math.exp(-dt / .14);
    L.browMix += (1 - L.browMix) * kb;
    L.fur += ((C_FUR[name] || 0) - L.fur) * kb;
    L.bem += (L.lvl - L.bem) * (1 - Math.exp(-dt / .35));
    const sst = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
    const bLift = (-Math.max(0, -L.gy) * .35 - (name === 'speaking' ? sst(.45, .8, L.bem) * 3 : 0)) * EX.lift + c * 1.5;
    if (!rm) L.ang += Sd.rs * dt;
    L.arcO += ((name === 'thinking' || name === 'scan' ? 1 : 0) - L.arcO) * k; if (!rm) L.arcA += 72 * dt;
    const pq = (t - L.pulse) / 1.2, pOn = !rm && pq >= 0 && pq < 1;
    // веки: ближайшие готовые (раскрытие шагом 5%, мягкость 0 / 0.5 / 1)
    const oi = clamp(Math.round(o / OSTEP), 0, NB - 1), si = L.soft < .25 ? 0 : L.soft < .75 ? 1 : 2;
    const lids = lidsSV.value;
    let lidI = -1;
    for (let d = 0; d < NB && lidI < 0; d++) {
      for (const s2 of [si, 0, 1, 2]) {
        if (oi - d >= 0 && lids[s2 * NB + oi - d]) { lidI = s2 * NB + oi - d; break; }
        if (oi + d < NB && lids[s2 * NB + oi + d]) { lidI = s2 * NB + oi + d; break; }
      }
    }

    // ---------- HUD ----------
    const s = EYE_K, ex = (qq) => 1 - Math.exp(-dt / qq);
    const HX = L.hx * s, HY = L.hy * s, GX = L.gx * s, GY = L.gy * s;
    const spr = (p, tx, ty, kk, dd) => { p.vx += ((tx - p.x) * kk - p.vx * dd) * dt; p.vy += ((ty - p.y) * kk - p.vy * dd) * dt; p.x += p.vx * dt; p.y += p.vy * dt; };
    spr(L.F, (HX * 1.5 + GX * .3) * .55, (HY * 1.5 + GY * .3) * .55, 70, 10);
    spr(L.M, (HX * 1.5 + GX * .3), (HY * 1.5 + GY * .3), 70, 10);
    spr(L.N, (HX * 1.5 + GX * .3) * 1.3, (HY * 1.5 + GY * .3) * 1.3, 70, 10);
    L.dim += ((name === 'idle' ? .7 : 1) - L.dim) * ex(.5);
    const ix = (X) => 35 + (X + L.gx + L.hx - 60) * s, iy = EYES_Y + (148 + L.gy + L.hy - 16) * s;
    spr(L.rL, ix(263.4), iy, 220, 22); spr(L.rR, ix(636), iy, 220, 22);
    // центр прицела левого глаза MIRA (справа) — наружу, в точках экрана блока; «рыбий глаз» сдвигает его от центра линзы
    if (eyeOut) {
      const qx = L.rR.x, qy = L.rR.y + LENS_Y, ux = (qx - 195) / 195, uy = (qy - LENS_Y - 85) / 85;
      const fe = FISHEYE * Math.max(0, 1 - (ux * ux + uy * uy) / 2);
      eyeOut.value = { x: (195 + (qx - 195) / (1 - fe)) * S, y: (LENS_Y + 85 + (qy - LENS_Y - 85) / (1 - fe)) * S };
    }
    const lockT = slpOn ? 0 : looking ? .9 : ({ attention: 1, emotion: 1, speaking: .65, idle: .45, thinking: 0, scan: 0, listening: .65 })[name] ?? .5;
    L.lock += (lockT - L.lock) * ex(.35);
    const spd = 22 + (1 - L.lock) * 150; L.aL += spd * dt; L.aR -= spd * .85 * dt;
    const sc = 1.22 - .22 * L.lock, jit = c > .4 ? (Math.random() - .5) * 1.6 : 0, rop = (.45 + .55 * L.lock) * (1 - c * .75) * (1 - L.slp);   // спит — прицелов нет
    const glT = ({ attention: .62 + .05 * Math.sin(t * 1.7), thinking: .3 + .45 * Math.abs(Math.sin(t * 1.9)), speaking: .3 + L.lvl * .7, scan: (t * 1.3) % 1, emotion: 1, idle: .22, listening: .5 })[name] ?? .5;
    L.gl += (glT - L.gl) * ex(.1);
    L.ry += dt * L.sweep * 16;
    const lv = name === 'speaking' ? .25 + L.lvl * .75 : .06;
    L.tn += (lv - L.tn) * ex(.12);
    const ampT = name === 'speaking' ? 3 + L.lvl * 7 : name === 'thinking' || name === 'scan' ? 6.5 : name === 'idle' ? 1.2 : name === 'emotion' ? 5 : 2.6;
    L.amp += (ampT - L.amp) * ex(.25);
    const spT = name === 'speaking' ? .3 + L.lvl * .7 : name === 'thinking' || name === 'scan' ? .5 : name === 'idle' ? .08 : .22;
    L.spl += (spT - L.spl) * ex(.15);
    L.sweep += ((name === 'thinking' || name === 'scan' ? 1 : 0) - L.sweep) * ex(.3);
    L.flash *= Math.exp(-dt * 2.2);
    if (t - L.txT > .09) {
      L.txT = t;
      const sg = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2), el = t - L.boot0, p2 = (n) => String(Math.floor(n)).padStart(2, '0');
      L.gz = `${sg(L.gx / 30)} ${sg(L.gy / 14)}`;
      L.fo = (.5 + L.lock * .46 + Math.sin(t * 1.3) * .01).toFixed(2);
      L.lk = Math.round(91 + L.lock * 7 + Math.sin(t * .7)) + '%';
      L.tc = `${p2(el / 60)}:${p2(el % 60)}:${p2((el % 1) * 24)}`;
    }
    const bt = (t - L.boot0) * (L.bootK || 1);
    const rows = [];
    for (let i = 0; i < STYLES.length; i++) {
      const a = q - (T0 + i * STEP), act = looking && i === cur;
      let op = a < 0 ? 0 : a < .05 ? .9 : a < .1 ? .15 : a < .35 ? Math.min(1, .3 + (a - .1) * 3) : 1;
      if (a >= .35) op = act ? 1 : looking ? .5 : .62;
      rows.push({ op: op * L.stOp, dx: a < 0 ? 10 : 10 * Math.pow(Math.max(0, 1 - a / .3), 3), act, bar: act ? 10 : a >= 0 ? 3 : 0 });
    }

    L.dwA = (L.dwA || 0) - dt * 14;
    if (t > (L.gNext || 0)) { L.gT = t; L.gNext = t + 3.2 + Math.random() * 4; }
    const glint = (i) => { const q = (t - (L.gT ?? -9) - i * .07) / .8; return q > 0 && q < 1 ? Math.pow(Math.sin(Math.PI * q), 2) : 0; };
    const f = {
      dwA: L.dwA, gp0: glint(0), gp1: glint(1), gy: L.gy,
      t, bt, zoomS, zoomO, hx: L.hx, hy: L.hy, bLift, fur: L.fur, crease: (1 - Math.min(1, o)) * 12, halo: L.g * .5 * (1 - .7 * L.slp),
      core: .3 + L.g * .55, hl: .7 + .3 * L.g, sp: L.emo * (.55 + .45 * Math.sin(t * 3)), emo: L.emo, pupil: L.pu, ruff: L.pu + 1.5,
      pulseR: pOn ? 16 + pq * 26 : 16, pulseO: pOn ? (1 - pq) * .55 : 0, arcO: L.arcO * .9,
      ixL: 6 + (L.gx + drx) * -1 + .6, ixR: 6 + (L.gx + drx), iy: -2 + L.gy + dry,
      ringsL: L.ang * .85, ringsR: L.ang, arcL: L.arcA + 40, arcR: L.arcA, gx: L.gx,
      sc, jit, rop, aR: L.aR, gauge: Math.round(L.gl * 8), ry: (L.gy + L.hy) * s * 2.4 + L.ry,
      sweepX: ((t * .5) % 1) * 470 - 60, sweepO: L.sweep * .85, scanAct: L.sweep > .5, rows,
    };
    const li = lidImgSV.value[lidI];
    if (!li && lids[lidI]) { L.req = L.req || {}; if (!L.req[lidI]) { L.req[lidI] = 1; runOnJS(bakeLid)(lidI); } }
    picSV.value = drawHud(L, f, lids[lidI] || null, R, li || null);
    O.value = { Fx: L.F.x, Fy: L.F.y, bt, slp: L.slp };
    if (L.statT == null) L.statT = t;
  });

  // свёрнут / раскрыт: высота блока, визор гаснет и уезжает вверх, плашка поднимается наверх
  const cv = useSharedValue(collapsed ? 1 : 0);
  useAnimatedReaction(() => cv.value, (v) => { if (cvOut) cvOut.value = v; });
  const pause = () => frame.setActive(false);
  useEffect(() => {
    if (!collapsed) {
      frame.setActive(true);
      if (cv.value > .5) wakeSV.value += 1;
      cv.value = withSpring(0, SPRING);
    } else {
      cv.value = withSpring(1, SPRING, (fin) => { if (fin) runOnJS(pause)(); });
    }
  }, [collapsed]); // eslint-disable-line react-hooks/exhaustive-deps
  const H = DH * S;
  // визор: гаснет быстрее, чем уезжает (к середине пути уже прозрачный), чуть уменьшается — без резких краёв
  const vis = useAnimatedStyle(() => ({
    opacity: interpolate(cv.value, [0, .65], [1, 0], Extrapolation.CLAMP) * (1 - .35 * (O.value?.slp ?? 0)),
    transform: [{ translateY: -cv.value * 26 * S }, { scale: 1 - .05 * cv.value }],
  }));
  return (
    // без zIndex: видео и чат (идут ниже в разметке) при сворачивании наезжают поверх гаснущего визора
    <Animated.View ref={rootRef} style={{ width, height: collapsed ? PLATE_H : H }} pointerEvents="none">
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width, height: H }, vis]}>
        <Canvas style={{ position: 'absolute', left: -BLEED, top: -BLEED, width: width + BLEED * 2, height: H + BLEED * 2 }}>
          <Group transform={[{ translateX: BLEED }, { translateY: BLEED }]}>
            <Picture picture={picSV} />
          </Group>
        </Canvas>
      </Animated.View>
      <Stat O={O} S={S} cv={cv} text={statusText} color={statusColor} dotRef={dotRef} />
    </Animated.View>
  );
});

// MIRA и статус — внизу рамки, следуют за рамкой (параллакс); шрифты приложения
function Stat({ O, S, cv, text, color, dotRef }) {
  // раскрыт — внизу рамки, за рамкой (параллакс); свёрнут — плашка наверху блока
  const down = (HUD_Y + 176) * S - (PLATE_H - 22) / 2;
  const st = useAnimatedStyle(() => {
    const o = O.value, k = 1 - cv.value;
    return {
      transform: [{ translateX: (o?.Fx ?? 0) * S * k }, { translateY: (down + (o?.Fy ?? 0) * S) * k }],
      opacity: Math.max(Math.min(1, cv.value * 3), o ? Math.min(1, o.bt / 1.2) : 0),
    };
  });
  return (
    <Animated.View style={[styles.stat, { top: (PLATE_H - 22) / 2 }, st]}>
      <RNText style={styles.name}>MIRA</RNText>
      <View style={styles.statusRow}>
        <Animated.View ref={dotRef} style={[styles.dot, { backgroundColor: color, shadowColor: color }]} />
        <RNText style={[styles.status, { color }]}>{text}</RNText>
      </View>
    </Animated.View>
  );
}

// ---------- неподвижное — запекается в изображения один раз (основной поток) ----------
// Рисовать неоновое размытие, надписи и сетки каждый кадр — дорого (замер 2026-11-15: всё вместе 85% кадров с
// задержкой, по частям — 1–7%); готовое изображение видеокарта рисует почти даром.

const C = (s) => Skia.Color(dusk(s));   // визор — вариант «закат» (mira-theme.ts)
function mk({ color = '#FFFFFF', a = 1, w, blur, shader, join, cap }) {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  if (shader) p.setShader(shader); else p.setColor(C(color));
  p.setAlphaf(a);
  if (w != null) {
    p.setStyle(PaintStyle.Stroke); p.setStrokeWidth(w);
    p.setStrokeJoin(join === 'round' ? StrokeJoin.Round : StrokeJoin.Miter);
    if (cap === 'round') p.setStrokeCap(StrokeCap.Round);
  }
  if (blur) p.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, blur, true));
  return p;
}
/** Изображение области [x0, y0, x1, y1] (единицы рисунка) при k пикселей на единицу. */
function bake(k, [x0, y0, x1, y1], draw) {
  const W = Math.max(1, Math.ceil((x1 - x0) * k)), H = Math.max(1, Math.ceil((y1 - y0) * k));
  const surf = Skia.Surface.Make(W, H), c = surf.getCanvas();
  c.scale(k, k); c.translate(-x0, -y0);
  draw(c);
  surf.flush();
  return { img: surf.makeImageSnapshot(), src: Skia.XYWHRect(0, 0, W, H), dst: Skia.XYWHRect(x0, y0, x1 - x0, y1 - y0) };
}
/** Эллиптическое свечение closest-side, как radial-gradient в шаблоне. */
function glowShader(cx, cy, w, h, a, mid = .5) {
  const r = Math.min(w, h) / 2;
  return Skia.Shader.MakeRadialGradient({ x: 0, y: 0 }, r, [C(`rgba(136,92,255,${a})`), C(`rgba(136,92,255,${a / 4})`), C('rgba(136,92,255,0)')],
    [0, mid, 1], TileMode.Clamp, Skia.Matrix([w / 2 / r, 0, cx, 0, h / 2 / r, cy, 0, 0, 1]));
}
/** Текст со свечением, как text-shadow шаблона (0 0 6px фиолетовый). */
function glowText(c, font, s, x, y, color) {
  c.drawText(s, x, y, mk({ color: '#885CFF', a: .85, blur: 3 }), font);
  c.drawText(s, x, y, mk({ color }), font);
}

function bakeAll(S, pd, font, A) {
  const k = S * pd, ke = EYE_K * S * pd, B = {};
  const TXT = 'rgba(222,214,255,.85)', DIMT = 'rgba(222,214,255,.5)';
  const right = (s, xr) => xr - font.measureText(s).width;
  // ----- рамка F -----

  B.fl = [[-30, -24, 92, 88, .4], [328, -24, 92, 88, .4], [-26, 126, 64, 104, .34], [352, 126, 64, 104, .34]].map(([x, y, w, h, a]) =>
    bake(k, [x, HUD_Y + y, x + w, HUD_Y + y + h], (c) => c.drawRect(Skia.XYWHRect(x, HUD_Y + y, w, h), mk({ shader: glowShader(x + w / 2, HUD_Y + y + h / 2, w, h, a, a > .35 ? .5 : .55) }))));
  B.sp = [24.5, 362.5].map((x) => bake(k, [x - 14, HUD_Y + 9.5 - 15.5, x + 17, HUD_Y + 9.5 + 15.5], (c) => {
    const cx = x + 1.5, cy = HUD_Y + 9.5;
    c.drawCircle(cx, cy, 6, mk({ color: '#F4B9C3', a: .45, blur: 5 }));
    c.drawCircle(cx, cy, 2.5, mk({ color: '#F4B9C3', a: .95, blur: 1.5 }));
    c.drawCircle(cx, cy, 1.5, mk({ color: DUSK.dotCore }));
  }));
  // стекло визора и утолщения рамки — одно изображение (меньше полноэкранных слоёв на кадр)
  B.acc = bake(k, [-4, HUD_Y - 6, DW + 4, HUD_Y + 214], (c) => {
    c.translate(0, HUD_Y);
    c.drawPicture(GLASS);
    const neon = (path, color, a, w) => {
      c.drawPath(path, mk({ color: '#7850FF', a: .55, w: w + 2, blur: 5, join: 'round' }));
      c.drawPath(path, mk({ color: '#885CFF', a: .95, w: w + .6, blur: 1.2, join: 'round' }));
      c.drawPath(path, mk({ color, a, w, join: 'round' }));
    };
    neon(PATHS.acc, DUSK.accent, .9, 1.1);
    neon(PATHS.accTop, DUSK.accent, .8, .9);
    c.drawPath(PATHS.accTri, mk({ color: DUSK.accent }));
    neon(PATHS.accSide, DUSK.accent, .85, .8);
  });
  // ----- середина M -----
  B.mid = bake(k, [0, HUD_Y, DW, HUD_Y + 206], (c) => {
    c.translate(0, HUD_Y);
    c.drawPath(PATHS.mLine, mk({ color: '#E5E7FF', a: .16, w: .5 }));
    c.drawPath(PATHS.mDia, mk({ color: '#F2EEFF', a: .75 }));
    c.drawPath(PATHS.mCross, mk({ color: '#E5E7FF', a: .34, w: .5 }));
    c.drawPath(PATHS.mTri, mk({ color: '#9D84FF', a: .14, w: .5 }));
    c.drawPath(PATHS.mArcs, mk({ color: '#A48CFF', a: .38, w: .5 }));
  });
  B.gaugeBase = bake(k, [10, HUD_Y + 75, 20, HUD_Y + 102], (c) => { c.translate(10, HUD_Y + 79); c.drawPath(PATHS.gaugeBase, mk({ color: '#A48CFF', a: .5, w: .5 })); c.translate(-10, 0); });
  B.rulTri = bake(k, [369, HUD_Y + 68, 376, HUD_Y + 76], (c) => { c.translate(0, HUD_Y); c.drawPath(PATHS.rulTri, mk({ color: '#F2EEFF', a: .85 })); });
  B.cdot = bake(k, [185, HUD_Y + 134, 205, HUD_Y + 154], (c) => {
    c.drawCircle(195, HUD_Y + 144, 6, mk({ color: '#F4B9C3', a: .45, blur: 4 }));
    c.drawCircle(195, HUD_Y + 144, 2.4, mk({ color: '#F4B9C3', a: .95, blur: 1.2 }));
    c.drawCircle(195, HUD_Y + 144, 1.6, mk({ color: DUSK.dotCore }));
  });
  // ----- надписи N (неизменные — со свечением) -----
  const Y = (y) => HUD_Y + y + 7;
  B.nMira = bake(k, [24, HUD_Y + 10, 130, HUD_Y + 34], (c) => {
    glowText(c, font, 'MIRA', 30, Y(16), '#F2EEFF');
    c.drawRect(Skia.XYWHRect(57, HUD_Y + 20, 14, .5), mk({ color: 'rgba(222,214,255,.6)' }));
    glowText(c, font, 'ВИЗОР 01', 78, Y(16), TXT);
    for (let i = 0; i < 9; i++) c.drawLine(30 + i * 3.2, HUD_Y + 30, 31.4 + i * 3.2, HUD_Y + 27, mk({ color: '#C9B8FF', a: .9 * Math.max(0, 1 - i / 9), w: 1.1 }));
    for (let i = 0; i < 9; i++) c.drawLine(336 + i * 3.2, HUD_Y + 30, 337.4 + i * 3.2, HUD_Y + 27, mk({ color: '#C9B8FF', a: .9 * Math.min(1, i / 9 + .1), w: 1.1 }));
  });
  B.nMira.dst = Skia.XYWHRect(24, HUD_Y + 10, 106, 24);
  B.nStripeR = bake(k, [334, HUD_Y + 25, 362, HUD_Y + 32], (c) => {
    for (let i = 0; i < 9; i++) c.drawLine(336 + i * 3.2, HUD_Y + 30, 337.4 + i * 3.2, HUD_Y + 27, mk({ color: '#C9B8FF', a: .9 * Math.min(1, i / 9 + .1), w: 1.1 }));
  });
  B.nGz = bake(k, [14, HUD_Y + 114, 40, HUD_Y + 146], (c) => { glowText(c, font, 'ВЗГ', 18, Y(120), DIMT); glowText(c, font, 'ФОК', 18, Y(133), DIMT); });
  B.nLk = bake(k, [320, HUD_Y + 114, 376, HUD_Y + 146], (c) => {
    glowText(c, font, 'ЛНК', right('ЛНК', 350), Y(120), DIMT); glowText(c, font, 'ТОН', right('ТОН', 344), Y(133), DIMT);
    c.drawRect(Skia.XYWHRect(348, HUD_Y + 139.25, 24, .5), mk({ color: 'rgba(229,231,255,.2)' }));
  });
  B.nWave = bake(k, [14, HUD_Y + 146, 84, HUD_Y + 172], (c) => {
    c.translate(16, HUD_Y + 148);
    c.drawPath(PATHS.waveGrid, mk({ color: '#9D84FF', a: .12, w: .4 }));
    c.drawPath(PATHS.waveAxis, mk({ color: '#A48CFF', a: .45, w: .5 }));
  });
  B.nBars = bake(k, [298, HUD_Y + 168, 342, HUD_Y + 172], (c) => c.drawRect(Skia.XYWHRect(300, HUD_Y + 170.25, 40, .5), mk({ color: 'rgba(164,140,255,.4)' })));
  B.nScan = bake(k, [20, HUD_Y + 173, 60, HUD_Y + 191], (c) => { glowText(c, font, 'SCAN', 24, Y(179), TXT); glowText(c, font, '//', 48, Y(179), 'rgba(222,214,255,.45)'); });
  B.nMm = bake(k, [300, HUD_Y + 173, 368, HUD_Y + 191], (c) => glowText(c, font, 'ММ · ƒ2.8', right('ММ · ƒ2.8', 364), Y(179), 'rgba(222,214,255,.6)'));
  B.rows = STYLES.map((s, i) => {
    const label = s.toUpperCase(), idx = String(i + 1).padStart(2, '0'), y = HUD_Y + 40 + i * 12 + 7, xr = 366;
    const xl = xr - 6 - font.measureText(label).width, xi = xl - 6 - font.measureText(idx).width;
    const box = [xi - 4, y - 10, xr + 14, y + 4];
    const one = (act) => bake(k, box, (c) => {
      glowText(c, font, idx, xi, y, 'rgba(222,214,255,.45)');
      if (act) { c.drawText(label, xl, y, mk({ color: '#F4B9C3', a: .95, blur: 4 }), font); c.drawText(label, xl, y, mk({ color: '#FFFFFF' }), font); }
      else glowText(c, font, label, xl, y, TXT);
    });
    return { n: one(false), a: one(true), barX: xr - 2, y };
  });
  // ----- линза: развёртка и прицелы (рисунок прицела — 100×100, центр 50,50) -----
  B.sweep = bake(k, [0, 0, 70, LENS_H - 12], (c) => {
    c.drawRect(Skia.XYWHRect(0, 0, 70, LENS_H - 12), mk({ shader: Skia.Shader.MakeLinearGradient({ x: 0, y: 0 }, { x: 70, y: 0 },
      [C('rgba(136,92,255,0)'), C('rgba(136,92,255,.09)'), C('rgba(229,231,255,.3)')], [0, .82, 1], TileMode.Clamp) }));
    c.drawRect(Skia.XYWHRect(69.5, 0, .5, LENS_H - 12), mk({ color: 'rgba(242,238,255,.75)' }));
  });
  const dash = (iv) => Skia.PathEffect.MakeDash(iv, 0);
  const ret = (draw) => bake(k * 1.25, [-12, -12, 112, 112], draw);   // прицел увеличивается до ×1.22 — запас разрешения
  B.rcL = ret((c) => {
    c.drawPath(PATHS.rcL[0], mk({ color: '#F2EEFF', a: .7, w: .6 }));
    const p = mk({ color: '#E5E7FF', a: .42, w: .5 }); p.setPathEffect(dash([2.2, 1.6])); c.drawPath(PATHS.rcL[1], p);
    c.drawPath(PATHS.rcL[2], mk({ color: '#C9B8FF', a: .75, w: .6 }));
  });
  B.rcR = ret((c) => {
    c.drawCircle(50, 50, 21, mk({ color: '#E5E7FF', a: .45, w: .5 }));
    const p = mk({ color: '#E5E7FF', a: .28, w: .45 }); p.setPathEffect(dash([.6, 2.1])); c.drawCircle(50, 50, 25, p);
    c.drawPath(PATHS.rcR[0], mk({ color: '#F2EEFF', a: .65, w: .55 }));
    c.drawPath(PATHS.rcR[1], mk({ color: '#E5E7FF', a: .45, w: .5 }));
    c.drawPath(PATHS.rcR[2], mk({ color: '#F2EEFF', a: .85 }));
    c.drawPath(PATHS.rcR[3], mk({ color: '#BA9AFF', a: .6, w: .5 }));
    c.drawCircle(50, 50, 1.1, mk({ color: '#F2EEFF' }));
  });
  B.raR = ret((c) => {
    const p1 = mk({ color: '#BA9AFF', a: .85, w: .9, cap: 'round' }); p1.setPathEffect(dash([20, 71.1])); c.drawCircle(50, 50, 29, p1);
    const p2 = mk({ color: '#E5E7FF', a: .3, w: 2 }); p2.setPathEffect(dash([.35, 3.05])); c.drawCircle(50, 50, 32.5, p2);
    c.drawPath(PATHS.raRtri, mk({ color: '#E5E7FF', a: .7 }));
  });
  // ----- глаза: свечение, сердцевина, брови (единицы рисунка глаза) -----
  B.halo = A.halo.map((pic) => bake(ke, [-162, -80, 178, 80], (c) => c.drawPicture(pic)));
  B.core = bake(ke, [-31, -31, 31, 31], (c) => c.drawPicture(A.core));
  B.brows = A.brows.map((pic) => bake(ke, [-150, -150, 175, -30], (c) => c.drawPicture(pic)));
  B.tcX = 360 - font.measureText('00:00:00').width;
  B.lkX = 372 - font.measureText('99%').width;
  return B;
}

// ---------- кадр: запись картинки в потоке интерфейса (ворклет) ----------
const FM_LINEAR = FilterMode.Linear, MM_NONE = MipmapMode.None, CLIP_INT = ClipOp.Intersect;

function drawHud(L, f, lid, R, li) {
  'worklet';
  const { B, A, S, pd, lensPaint, font } = R;
  if (!L.P) {   // краски — один раз, в потоке интерфейса; запись картинки копирует их состояние в момент рисования
    const st = Skia.Paint(); st.setAntiAlias(true); st.setStyle(1); st.setStrokeCap(1); st.setStrokeJoin(1);
    const fi = Skia.Paint(); fi.setAntiAlias(true);
    L.P = { img: Skia.Paint(), stroke: st, fill: fi, layer: Skia.Paint(), cols: {} };
    const gr = (stops, r) => Skia.Shader.MakeRadialGradient({ x: 0, y: 0 }, r, stops.map((q) => Skia.Color(q[1])), stops.map((q) => q[0]), 0);
    L.SP = {
      well: gr(SOFT_RGBA.well, 30), rim: gr(SOFT_RGBA.rim, 1), back: gr(SOFT_RGBA.back, 1), glow: gr(SOFT_RGBA.glow, 1),
      d1: Skia.PathEffect.MakeDash([2.6, 2], 0), d2: Skia.PathEffect.MakeDash([11, 3.5, 2, 3.5], 0),
      ticks: Skia.Path.MakeFromSVGString(SOFT_TICKS),
      cor1: Skia.Path.MakeFromSVGString('M-37.6 -13.7A40 40 0 0 1 10.4 -38.6'),
      cor2: Skia.Path.MakeFromSVGString('M-30 -4A31 31 0 0 1 -22 -21'),
      star: Skia.Path.MakeFromSVGString('M0 -10L.9 -.9L10 0L.9 .9L0 10L-.9 .9L-10 0L-.9 -.9Z'),
    };
  }
  const P = L.P, SP = L.SP;
  P.ia = P.sc = P.sa = P.sw = P.se = P.fc = P.fa = undefined; P.fsh = true;
  const col = (s) => P.cols[s] || (P.cols[s] = Skia.Color(dusk(s)));
  // свойства кисти меняются, только если изменились: каждый вызов Skia из ворклета — переход через JSI
  const im = (c, b, a = 1) => {
    if (a <= .004) return;
    const q = Math.min(1, Math.round(a * 200) / 200);
    if (P.ia !== q) { P.ia = q; P.img.setAlphaf(q); }
    c.drawImageRectOptions(b.img, b.src, b.dst, FM_LINEAR, MM_NONE, P.img);
  };
  const stroke = (color, a, w, eff = null) => {
    const q = Math.round(a * 200) / 200;
    if (P.sc !== color || P.sa !== q) { P.sc = color; P.sa = q; P.stroke.setColor(col(color)); P.stroke.setAlphaf(q); }
    if (P.sw !== w) { P.sw = w; P.stroke.setStrokeWidth(w); }
    if (P.se !== eff) { P.se = eff; P.stroke.setPathEffect(eff); }
    return P.stroke;
  };
  const fill = (color, a = 1) => {
    const q = Math.round(a * 200) / 200;
    if (P.fsh) { P.fsh = false; P.fill.setShader(null); P.fc = null; }
    if (P.fc !== color || P.fa !== q) { P.fc = color; P.fa = q; P.fill.setColor(col(color)); P.fill.setAlphaf(q); }
    return P.fill;
  };
  const path = (d) => Skia.Path.MakeFromSVGString(d);   // контур одной строкой — один вызов вместо десятков
  // первое открытие — «включение» с мерцанием, как в шаблоне; повторное (после ожидания ответа) — плавное проявление
  const bo = (key) => {
    const q = f.bt - BOOT[key];
    if (!L.bootSmooth) return bootOp(q);
    const u = Math.min(1, Math.max(0, q / .45));
    return u * u * (3 - 2 * u);
  };

  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(Skia.XYWHRect(-BLEED, -BLEED, DW * S + BLEED * 2, DH * S + BLEED * 2));   // с запасом под свечение
  c.scale(S, S);

  // ===== линза: глаза, развёртка, прицелы, выноски — под «рыбьим глазом» (шейдер видеокарты) =====
  c.save();
  c.scale(1 / (S * pd), 1 / (S * pd));
  c.saveLayer(lensPaint, Skia.XYWHRect(0, LENS_Y * S * pd, DW * S * pd, LENS_H * S * pd));
  c.scale(S * pd, S * pd);
  c.clipRect(Skia.XYWHRect(0, LENS_Y, DW, LENS_H), CLIP_INT, true);
  if (lid) {
    c.save();
    c.translate(35, LENS_Y + EYES_Y); c.scale(EYE_K, EYE_K); c.translate(-60, -16);
    const fade = f.zoomO < .999;
    if (fade) { P.layer.setAlphaf(f.zoomO); c.saveLayer(P.layer); }
    if (f.zoomS !== 1) { c.translate(450, 150); c.scale(f.zoomS, f.zoomS); c.translate(-450, -150); }
    c.translate(f.hx, f.hy);
    for (let side = 0; side < 2; side++) {
      const fl = side === 0;
      c.save();
      c.translate(fl ? 270 : 630, 150); c.scale(fl ? -1 : 1, 1);
      im(c, B.halo[0], f.halo * (1 - f.emo)); im(c, B.halo[1], f.halo * f.emo);
      if (li) im(c, li.skin); else c.drawPicture(lid.skin);
      c.save(); c.translate(0, f.bLift);
      im(c, B.brows[L.browFrom], 1 - L.browMix); im(c, B.brows[L.browTo], L.browMix);
      if (f.fur > .005) c.drawPath(A.S.furrow, stroke(eyeHex('#BA9AFF'), .24 * f.fur, 1));
      c.restore();
      c.save(); c.translate(0, f.crease); im(c, A.S.crease); c.restore();
      c.save(); c.clipPath(lid.clip, CLIP_INT, true);
      im(c, A.S.sclera);
      c.save(); c.translate(fl ? f.ixL : f.ixR, f.iy);
      im(c, A.iris[0], 1 - f.emo); im(c, A.iris[1], f.emo);
      im(c, B.core, f.core);
      im(c, A.S.collar);
      c.save(); c.rotate(fl ? f.ringsL : f.ringsR, 0, 0); im(c, A.S.rings); c.restore();
      if (f.arcO > .005) { c.save(); c.rotate(fl ? f.arcL : f.arcR, 0, 0); c.drawCircle(0, 0, 36.5, stroke(eyeHex('#E5E7FF'), f.arcO, 1.6, A.S.arcDash)); c.restore(); }
      if (f.pulseO > .005) c.drawCircle(0, 0, f.pulseR, stroke(eyeHex('#BA9AFF'), f.pulseO, 1.4));
      // вариант G: слои радужки со сдвигом против взгляда (глубина) — чаша, шестерёнка, обод
      // все слои радужки — концентрично со зрачком: сдвиг «для глубины» из шаблона читался как отстающий чёрный
      // зрачок (эксперт, 2026-11-17); блики и искра — поверх, со своим лёгким сдвигом
      const gq = fl ? f.gp0 : f.gp1;
      if (SOFT_ON) {
      c.save(); P.fill.setShader(SP.well); P.fill.setAlphaf(1); P.fsh = true; P.fa = 1; c.drawCircle(0, 0, 30, P.fill); c.restore();
      c.save(); c.rotate(f.dwA, 0, 0);
      c.drawCircle(0, 0, 23.5, stroke(SOFT.c1, .3, .6, SP.d1));
      c.drawCircle(0, 0, 20.2, stroke(SOFT.c2, .5, 1.3, SP.d2));
      c.drawPath(SP.ticks, stroke(SOFT.c3, .32, .6));
      c.restore();
      const rr = f.pupil + 4.5;
      c.save(); c.scale(rr, rr); P.fill.setShader(SP.rim); P.fill.setAlphaf(1); P.fsh = true; c.drawCircle(0, 0, 1, P.fill); c.restore();
      }
      c.save();   // зрачок, бахрома, обод и свечение за зрачком — строго в центре радужки (в шаблоне G зрачок
      // сдвигался против взгляда на 25% «для глубины» — выглядело как отставание и уводило зрачок из прицела; эксперт, 2026-11-17)
      P.fill.setShader(Skia.Shader.MakeRadialGradient({ x: 0, y: 0 }, f.pupil, [col('#000000'), col(eyeHex('#04030A')), col(eyeHex('#160D2E'))], [0, .72, 1], 0));
      P.fill.setAlphaf(1); P.fsh = true; P.fa = 1;
      c.drawCircle(0, 0, f.pupil, P.fill);
      c.drawCircle(0, 0, f.pupil, stroke(eyeHex('#885CFF'), .5, 1));
      c.restore();
      // розоватое свечение за зрачком (вспыхивает с искрой)
      const br = f.pupil * .38;
      if (SOFT_ON) { c.save(); c.scale(br, br); P.fill.setShader(SP.back); P.fill.setAlphaf(.32 + .35 * gq); P.fsh = true; c.drawCircle(0, 0, 1, P.fill); c.restore(); }
      c.save(); c.drawCircle(0, 0, f.ruff, stroke(eyeHex('#BA9AFF'), .34, 1.1, A.S.ruffDash)); c.restore();
      im(c, A.S.hl[fl ? 0 : 1], f.hl);
      if (f.sp > .005) c.drawPath(A.S.spark[fl ? 0 : 1], fill(eyeHex('#E5E7FF'), f.sp));
      // блики-дуги и искра — не зеркалятся (свет сверху слева у обоих глаз)
      if (SOFT_ON) {
      c.save(); if (fl) c.scale(-1, 1); c.translate(-f.gx * .4, -f.gy * .4);
      c.drawPath(SP.cor1, stroke(SOFT.c4, .12, 5));
      c.drawPath(SP.cor2, stroke(SOFT.c4, .1, 1.6));
      c.restore();
      c.save(); if (fl) c.scale(-1, 1);
      c.translate(-13 - f.gx * .4, -15 - f.gy * .4); c.rotate(gq * 25, 0, 0); c.scale(.6 + gq * .8, .6 + gq * .8);
      c.save(); c.scale(8, 8); P.fill.setShader(SP.glow); P.fill.setAlphaf(.22 + .78 * gq); P.fsh = true; c.drawCircle(0, 0, 1, P.fill); c.restore();
      if (gq > .004) c.drawPath(SP.star, fill(SOFT.star, gq * .95));
      c.drawCircle(0, 0, 1.7, fill(SOFT.star, .55 + .45 * gq));
      c.restore();
      }
      c.restore();
      if (li) im(c, li.shade); else c.drawPicture(lid.shade);
      c.restore();
      if (li) im(c, li.front); else c.drawPicture(lid.front);
      c.restore();
    }
    if (fade) c.restore();
    c.restore();
  }
  // развёртка (думает / сканирует)
  if (f.sweepO > .004) { c.save(); c.translate(f.sweepX, LENS_Y + 6); im(c, B.sweep, f.sweepO); c.restore(); }
  // прицелы на зрачках
  const reticle = (p, img, ra, a, jit) => {
    if (a <= .004) return;
    c.save(); c.translate(p.x - 50 + jit, p.y - 50 + LENS_Y);
    c.save(); c.translate(50, 50); c.scale(f.sc, f.sc); c.translate(-50, -50); im(c, img, a); c.restore();
    if (ra) { c.save(); c.translate(50, 50); c.rotate(f.aR, 0, 0); c.scale(f.sc * 1.02, f.sc * 1.02); c.translate(-50, -50); im(c, ra, a); c.restore(); }
    c.restore();
  };
  reticle(L.rL, B.rcL, null, f.rop * bo('retL'), f.jit);
  reticle(L.rR, B.rcR, B.raR, f.rop * bo('retR'), 0);
  // выноски от прицелов к подписям (с поправкой на «рыбий глаз»)
  const ldA = .4 * bo('ld') * (1 - L.slp);   // выноски от прицелов — гаснут во сне вместе с прицелами
  if (ldA > .004) {
    const uw = (x, y) => { const px = x - 195, py = y - 4 - 85, k = FISHEYE * Math.max(0, 1 - ((px / 195) ** 2 + (py / 85) ** 2) / 2); return [x - px * k, y - 4 - py * k]; };
    const N = L.N, a1 = uw(54 + N.x, 116 + N.y), a2 = uw(18 + N.x, 116 + N.y), b1 = uw(336 + N.x, 116 + N.y), b2 = uw(372 + N.x, 116 + N.y);
    const Y0 = LENS_Y, n1 = (v) => v.toFixed(1);
    c.drawPath(path(`M${n1(L.rL.x - 38 * f.sc)} ${n1(L.rL.y + Y0)}L${n1(a1[0])} ${n1(a1[1] + Y0)}L${n1(a2[0])} ${n1(a2[1] + Y0)}`
      + `M${n1(L.rR.x + 42 * f.sc)} ${n1(L.rR.y + Y0)}L${n1(b1[0])} ${n1(b1[1] + Y0)}L${n1(b2[0])} ${n1(b2[1] + Y0)}`), stroke('#C9B8FF', ldA, .5));
  }
  c.restore();   // слой линзы
  c.restore();

  // ===== рамка: три слоя с параллаксом (сдвиг + поворот в перспективе вокруг центра рамки) =====
  // параллакс — сдвиг слоя; наклон в перспективе (шаблон: < 2°) на глаз не виден, а стоит ~10% кадров (замер 2026-11-15)
  const layer = (p) => [1, 0, p.x, 0, 1, p.y, 0, 0, 1];
  const dim = L.dim;
  // F: стекло, свечения в углах, искры, утолщения (вариант D)
  c.save(); c.concat(layer(L.F));
  const fo = bo('flw') * dim;
  for (let i = 0; i < 4; i++) im(c, B.fl[i], fo * Math.min(1, .72 + .18 * Math.sin(f.t * 1.1 + i * 1.7) + L.flash * .5));
  im(c, B.sp[0], fo * (.5 + .5 * Math.sin(f.t * 2.3) ** 2));
  im(c, B.sp[1], fo * (.5 + .5 * Math.sin(f.t * 2.3 + 1.4) ** 2));
  im(c, B.acc, bo('acc') * dim);
  c.restore();
  // M: оси и дуги, бегущие засечки, маркеры, точка, датчик, линейка
  c.save(); c.concat(layer(L.M));
  const mA = bo('M');
  if (mA > .004) {
    im(c, B.mid, mA);
    const rt = Skia.PathEffect.MakeDash([.45, 3.1], f.gx * EYE_K * 1.3);
    c.save(); c.translate(0, HUD_Y);
    c.drawPath(PATHS.rtL, stroke('#E5E7FF', .34 * mA, 2.6, rt)); c.drawPath(PATHS.rtR, stroke('#E5E7FF', .34 * mA, 2.6, rt));
    c.restore();
    const gx = f.gx * EYE_K;
    let md = '';
    for (const [cx, x0] of [[107, 72], [283, 248]]) {
      const x = Math.max(x0 + 5, Math.min(x0 + 65, cx + gx * 1.8)), q = (x - x0) / 70, y = 140 + 32 * q * (1 - q) + HUD_Y;
      md += `M${x.toFixed(1)} ${(y - 6.5).toFixed(1)}V${(y + .5).toFixed(1)}M${(x - 2).toFixed(1)} ${(y + 4.5).toFixed(1)}L${x.toFixed(1)} ${(y + 2).toFixed(1)}L${(x + 2).toFixed(1)} ${(y + 4.5).toFixed(1)}Z`;
    }
    const mk2 = path(md);
    c.drawPath(mk2, fill('#F2EEFF', mA)); c.drawPath(mk2, stroke('#F2EEFF', mA, .8));
  }
  im(c, B.cdot, bo('cdot') * (.55 + .45 * Math.sin(f.t * 2.4) ** 2));
  const gA = bo('gauge');
  if (gA > .004) {
    const gd = ['', '', ''];
    for (let i = 0; i < 8; i++) gd[i < f.gauge ? (i === f.gauge - 1 ? 2 : 1) : 0] += `M10 ${HUD_Y + 44 + (7 - i) * 4}h4v2.5h-4Z`;
    [.13, .7, 1].forEach((a, j) => { if (gd[j]) c.drawPath(path(gd[j]), fill('#C9B8FF', gA * a)); });
    im(c, B.gaugeBase, gA);
  }
  const rA = bo('ruler');
  if (rA > .004) {
    for (const [step, x, wd, a, w] of [[3.5, 377, 4, .6, .5], [14, 374, 7, .75, .6]]) {
      const off = ((f.ry % step) + step) % step;
      const rd = ['', '', ''];
      for (let y = off; y < 56; y += step) {
        const u = y / 56, b = u < .12 || u > .88 ? 0 : u < .25 || u > .75 ? 1 : 2;
        rd[b] += `M${x} ${(HUD_Y + 44 + y).toFixed(1)}h${wd}`;
      }
      [.25, .6, 1].forEach((fade, j) => { if (rd[j]) c.drawPath(path(rd[j]), stroke('#C9B8FF', rA * a * fade, w)); });
    }
    im(c, B.rulTri, rA);
  }
  c.restore();
  // N: надписи, тайм-код, спектр, волна, полосы, список техник. Радара нет (эксперт, 2026-11-15)
  c.save(); c.concat(layer(L.N));
  const T = 'rgba(222,214,255,.85)';
  const nb = (key) => .75 * bo(key);
  im(c, B.nMira, nb('mira'));
  im(c, B.nStripeR, nb('stripe2'));
  const txt = (s, x, y, a, color = T) => { if (a > .004) c.drawText(s, x, HUD_Y + y + 7, fill(color, a), font); };
  txt(L.tc, B.tcX, 16, nb('tc'));
  im(c, B.nGz, nb('gz')); txt(L.gz, 40, 120, nb('gz')); txt(L.fo, 40, 133, nb('gz'));
  im(c, B.nLk, nb('lk')); txt(L.lk, B.lkX, 120, nb('lk'));
  const lkA = nb('lk');
  if (lkA > .004) {
    let sd = '';
    for (let i = 0; i < 8; i++) {
      const hh = 1 + L.tn * 11 * (.35 + .65 * Math.abs(Math.sin(f.t * 9 + i * 1.7) * Math.sin(f.t * 2.3 + i * .6)));
      sd += `M${(348 + i * 3 + .6).toFixed(1)} ${HUD_Y + 139}V${(HUD_Y + 139 - hh * 8 / 12).toFixed(1)}`;
    }
    c.drawPath(path(sd), stroke('#E5E7FF', .75 * lkA, 1.2));
  }
  const wA = nb('waves');
  if (wA > .004) {
    im(c, B.nWave, wA);
    const cl = (x) => Math.max(1, Math.min(21, x));
    let d1 = '', d2 = '';
    for (let i = 0; i <= 33; i++) {
      const ph = f.t * 2.6 - i * .38;
      const y1 = cl(11 - L.amp * (Math.sin(ph * 1.6) * .5 + Math.sin(ph * 3.9 + 1.3) * .32 + Math.sin(ph * 8.7) * .18));
      const y2 = cl(12 - L.amp * .6 * (Math.sin(ph * 1.05 + 2.1) * .65 + Math.sin(ph * 2.7) * .35));
      d1 += `${i ? 'L' : 'M'}${16 + i * 2} ${(HUD_Y + 148 + y1).toFixed(1)}`;
      d2 += `${i ? 'L' : 'M'}${16 + i * 2} ${(HUD_Y + 148 + y2).toFixed(1)}`;
    }
    c.drawPath(path(d2), stroke('#885CFF', .7 * wA, .6)); c.drawPath(path(d1), stroke('#E5DEFF', .85 * wA, .7));
  }
  const bA = nb('bars');
  if (bA > .004) {
    im(c, B.nBars, bA);
    let bd = '';
    for (let i = 0; i < 13; i++) {
      const h = 1.5 + L.spl * 17 * (.3 + .7 * Math.abs(Math.sin(f.t * 7.3 + i * 1.9) * Math.sin(f.t * 2.2 + i * .7)));
      bd += `M${300 + i * 3 + 1} ${HUD_Y + 170}V${(HUD_Y + 170 - h).toFixed(1)}`;
    }
    c.drawPath(path(bd), stroke('#C9B8FF', .8 * bA, 2));
  }
  const sA = nb('scan');
  im(c, B.nScan, sA);
  txt(f.scanAct ? 'ACTIVE' : 'IDLE', 60, 179, sA * (f.scanAct ? (Math.sin(f.t * 6) > -.2 ? 1 : .35) : .55));
  im(c, B.nMm, nb('mm'));
  for (let i = 0; i < f.rows.length; i++) {
    const r = f.rows[i];
    if (r.op <= .004) continue;
    c.save(); c.translate(r.dx, 0);
    im(c, r.act ? B.rows[i].a : B.rows[i].n, .75 * r.op);
    if (r.bar > 0) c.drawRect(Skia.XYWHRect(B.rows[i].barX, B.rows[i].y - 3, r.bar, .5), fill('#BA9AFF', .75 * r.op));
    c.restore();
  }
  c.restore();

  return rec.finishRecordingAsPicture();
}

const styles = StyleSheet.create({
  stat: { position: 'absolute', left: 0, right: 0, height: 22, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  name: { fontFamily: mira.display, fontSize: 17, letterSpacing: 1.7, color: dusk('#DCD6FF'), textShadowColor: dusk('rgba(136,92,255,.75)'), textShadowRadius: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, shadowOpacity: 1, shadowRadius: 6 },
  status: { fontFamily: mira.font, fontSize: 12 },
});
