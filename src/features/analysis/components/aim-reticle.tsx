/* eslint-disable react-hooks/immutability --
   покадровая анимация: общие значения Reanimated (взгляд MIRA) пишутся в ворклете useFrameCallback (поток интерфейса),
   правило React Compiler этого не различает — как в mira-hud.tsx */
import { Canvas, PaintStyle, Picture, Skia, StrokeCap, type SkPaint, type SkPath } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  measure, runOnJS, useAnimatedRef, useFrameCallback, useSharedValue, type AnimatedRef, type SharedValue,
} from 'react-native-reanimated';

import { RETICLE } from './mira-hud';
import { dusk } from './mira-theme';
import { AIM_ASSEMBLE_S, AIM_DISASM_S, AIM_FLY0_S, AIM_HOLD_S, AIM_LEAD_S, flashAt } from './scan-timing';

// Прицел MIRA в первом круге «скана» (эксперт, 2026-11-18, стенд annotator/report/scan_aim.html): настоящий прицел левого
// глаза MIRA (справа на экране) — геометрия и цвета из шлема (mira-hud.tsx: PATHS.rcR, raRtri, B.rcR, B.raR). Собирается
// у глаза (визор раскрыт) или у точки статуса на плашке (свёрнут — глаз не рисуется), летит к силуэтам по очереди и
// захватывает каждый к вспышке (увеличивается, пока уголки не лягут на силуэт), после последнего — быстро разлетается.
// Всё считается в потоке интерфейса: положение кадра видео, визора и точки статуса — measure() каждый кадр (визор
// сворачивается — кадр едет, прицел с ним); рисунок — готовые контуры, за кадр меняются только сдвиг, поворот, масштаб.

const CORNER = 23;          // уголки прицела — на ±23 от центра (рисунок 100×100, центр 50,50)
const LINE = 1.6;           // толщина линий относительно шлема — на видео тоньше не видно
const MAX_SC = 3.2;         // наибольшее увеличение при захвате

type Item = { layer: number; path?: SkPath | null; r?: number; paint: SkPaint; a: number; w?: number };

/** Слои прицела: кольца, перекрестие, метки, уголки, вращающаяся дуга — собираются по очереди. */
function makeItems(): Item[] {
  const mk = (hex: string, w?: number, dash?: number[], round = false) => {
    const p = Skia.Paint();
    p.setAntiAlias(true);
    p.setColor(Skia.Color(dusk(hex)));
    if (w != null) {
      p.setStyle(PaintStyle.Stroke);
      p.setStrokeWidth(w);
      if (dash) p.setPathEffect(Skia.PathEffect.MakeDash(dash, 0));
      if (round) p.setStrokeCap(StrokeCap.Round);
    }
    return p;
  };
  return [
    { layer: 0, r: 21, paint: mk('#E5E7FF', 0.5), a: 0.45, w: 0.5 },
    { layer: 0, r: 25, paint: mk('#E5E7FF', 0.45, [0.6, 2.1]), a: 0.28, w: 0.45 },
    { layer: 1, path: RETICLE.ticksIn, paint: mk('#F2EEFF', 0.55), a: 0.65, w: 0.55 },
    { layer: 1, path: RETICLE.ticksOut, paint: mk('#E5E7FF', 0.5), a: 0.45, w: 0.5 },
    { layer: 1, r: 1.1, paint: mk('#F2EEFF'), a: 1 },
    { layer: 2, path: RETICLE.tris, paint: mk('#F2EEFF'), a: 0.85 },
    { layer: 3, path: RETICLE.corners, paint: mk('#BA9AFF', 0.5), a: 0.6, w: 0.5 },
    { layer: 4, r: 29, paint: mk('#BA9AFF', 0.9, [20, 71.1], true), a: 0.85, w: 0.9 },
    { layer: 4, r: 32.5, paint: mk('#E5E7FF', 2, [0.35, 3.05]), a: 0.3, w: 2 },
    { layer: 4, path: RETICLE.arcTri, paint: mk('#E5E7FF'), a: 0.7 },
  ];
}

/**
 * Прицел поверх всего экрана разговора. clock — начало скана (scan-people), boxes — рамки силуэтов в точках рамки видео;
 * videoRef — рамка видео, hudRef — блок визора (eye — центр прицела глаза в нём, cv — свёрнут 0…1), dotRef — точка
 * статуса MIRA. hudScale — масштаб шлема (ширина визора / 390): раскрытый прицел — того же размера, что на глазу.
 */
export function AimReticle({ clock, boxes, videoRef, hudRef, dotRef, eye, cv, hudScale, zoom, gazeOut, onDone }: {
  clock: SharedValue<number>;
  boxes: SharedValue<number[]>;
  videoRef: AnimatedRef<Animated.View>;
  hudRef: AnimatedRef<Animated.View>;
  dotRef: AnimatedRef<Animated.View>;
  eye: SharedValue<{ x: number; y: number }>;
  cv: SharedValue<number>;
  hudScale: number;
  /** «наезд» камеры на замерший кадр: кадр с контурами увеличен от центра рамки (session: 1.07) */
  zoom: number;
  /** куда смотреть глазам MIRA: x прицела — доля ширины экрана −1…1 (on — пока прицел виден) */
  gazeOut?: SharedValue<{ x: number; on: number }>;
  onDone: () => void;
}) {
  const items = useMemo(() => makeItems(), []);
  // пустая картинка: запись надо начать, прежде чем закончить (иначе Skia падает — 2026-11-18, SIGSEGV)
  const [empty] = useState(() => {
    const r = Skia.PictureRecorder();
    r.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
    return r.finishRecordingAsPicture();
  });
  const pic = useSharedValue(empty);
  const ref = useAnimatedRef<Animated.View>();
  const done = useSharedValue(false);

  useFrameCallback((fi) => {
    'worklet';
    if (done.value || clock.value < 0) return;
    const b = boxes.value;
    const n = Math.floor(b.length / 6);
    if (!n) return;
    const t = (fi.timestamp - clock.value) / 1000;
    const end = flashAt(0, n - 1, AIM_LEAD_S) + AIM_HOLD_S + AIM_DISASM_S;
    if (t > end) {
      done.value = true;
      pic.value = empty;
      if (gazeOut) gazeOut.value = { x: 0, on: 0 };
      runOnJS(onDone)();
      return;
    }
    const mo = measure(ref), mv = measure(videoRef), mh = measure(hudRef), md = measure(dotRef);
    if (!mo || !mv || !mh) return;
    const clamp = (x: number, a: number, z: number) => Math.max(a, Math.min(z, x));
    const smooth = (x: number) => x * x * (3 - 2 * x);
    // MIRA: глаз (визор раскрыт), по мере сворачивания — точка статуса на плашке
    const ex = mh.pageX + eye.value.x, ey = mh.pageY + eye.value.y - cv.value * 26 * hudScale;
    const dx = md ? md.pageX + md.width / 2 : ex, dy = md ? md.pageY + md.height / 2 : ey;
    const k = smooth(clamp(cv.value, 0, 1));
    const mx = ex + (dx - ex) * k - mo.pageX, my = ey + (dy - ey) * k - mo.pageY;
    // силуэт i: центр тяжести фигуры (в точках экрана прицела) с учётом «наезда» камеры (увеличение от центра рамки
    // видео) и половины рамки от этого центра — уголки охватывают весь силуэт
    const vx = mv.pageX - mo.pageX + mv.width / 2, vy = mv.pageY - mo.pageY + mv.height / 2;
    const zx = (v: number) => vx + (v - mv.width / 2) * zoom, zy = (v: number) => vy + (v - mv.height / 2) * zoom;
    const cx = (i: number) => zx(b[i * 6 + 4]);
    const cy = (i: number) => zy(b[i * 6 + 5]);
    const hw = (i: number) => clamp(Math.max(b[i * 6 + 4] - b[i * 6], b[i * 6 + 2] - b[i * 6 + 4]) * zoom + 6, 14, 170);
    const hh = (i: number) => clamp(Math.max(b[i * 6 + 5] - b[i * 6 + 1], b[i * 6 + 3] - b[i * 6 + 5]) * zoom + 6, 14, 150);
    const open = CORNER * hudScale;

    let x = mx, y = my, bw = open, bh = open, asm = 1, dis = 0;
    if (t < AIM_ASSEMBLE_S) {
      asm = t / AIM_ASSEMBLE_S;
    } else {
      let i = -1;
      for (let j = 0; j < n; j++) if (t < flashAt(0, j, AIM_LEAD_S)) { i = j; break; }
      if (i === -1) {
        const j = n - 1;
        x = cx(j); y = cy(j); bw = hw(j); bh = hh(j);
        dis = (t - flashAt(0, j, AIM_LEAD_S) - AIM_HOLD_S) / AIM_DISASM_S;
      } else {
        const fi0 = flashAt(0, i, AIM_LEAD_S);
        const fly = i === 0 ? AIM_FLY0_S : Math.min(0.42, (fi0 - flashAt(0, i - 1, AIM_LEAD_S)) * 0.7);
        const s = clamp((t - (fi0 - fly)) / fly, 0, 1), e = s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2;
        const fx = i === 0 ? mx : cx(i - 1), fy = i === 0 ? my : cy(i - 1);
        x = fx + (cx(i) - fx) * e; y = fy + (cy(i) - fy) * e;
        // скобки: на силуэте — по нему; первая половина перелёта — раскрываются, вторая — сжимаются на следующий
        const pw = i === 0 ? open : hw(i - 1), ph = i === 0 ? open : hh(i - 1);
        const lerp = (a: number, z: number, q: number) => a + (z - a) * smooth(clamp(q, 0, 1));
        bw = s < 0.5 ? lerp(pw, open, s * 2) : lerp(open, hw(i), s * 2 - 1);
        bh = s < 0.5 ? lerp(ph, open, s * 2) : lerp(open, hh(i), s * 2 - 1);
      }
    }

    // глаза MIRA — за прицелом (после сборки, пока он идёт по силуэтам)
    if (gazeOut) gazeOut.value = { x: (x / Math.max(1, mo.width)) * 2 - 1, on: t >= AIM_ASSEMBLE_S && dis <= 0 ? 1 : 0 };
    // рисунок: слои слетаются по очереди и разлетаются в обратном порядке
    const sc = clamp(Math.max(bw, bh) / CORNER, hudScale, MAX_SC);
    const spin = -t * 1.4 * 57.2958;
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, mo.width, mo.height));
    for (let j = 0; j < 5; j++) {
      const a = smooth(clamp((asm - j * 0.11) / 0.56, 0, 1));
      const d = smooth(clamp((dis - (4 - j) * 0.08) / 0.68, 0, 1));
      const alpha = a * (1 - d);
      if (alpha <= 0.003) continue;
      const kk = 1 + (1 - a) * (1.6 + j * 0.25) + d * 1.4;
      const rot = ((1 - a) * (j % 2 ? -1 : 1) * 0.9 + d * 0.6) * 57.2958 + (j === 4 ? spin : 0);
      c.save();
      c.translate(x, y);
      c.rotate(rot, 0, 0);
      c.scale(sc * kk, sc * kk);
      c.translate(-50, -50);
      for (const it of items) {
        if (it.layer !== j) continue;
        it.paint.setAlphaf(it.a * alpha);
        if (it.w != null) it.paint.setStrokeWidth((it.w * LINE * hudScale) / (sc * kk));
        if (it.path) c.drawPath(it.path, it.paint);
        else c.drawCircle(50, 50, it.r ?? 1, it.paint);
      }
      c.restore();
    }
    pic.value = rec.finishRecordingAsPicture();
  });

  return (
    <Animated.View ref={ref} pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Picture picture={pic} />
      </Canvas>
    </Animated.View>
  );
}
