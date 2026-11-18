/* eslint-disable react-hooks/immutability --
   покадровая анимация: начало скана (общее значение Reanimated) записывает ворклет useFrameCallback в потоке интерфейса —
   правило React Compiler этого не различает (как в mira-hud.tsx) */
import { BlurMask, Canvas, Group, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';

import type { ScannedPerson } from '../../../../modules/video-prep';
import { mira } from './mira';
import { cycleAt, flash, flashAt } from './scan-timing';

// «Скан» людей на замершем кадре после вступления — украшение интерфейса, как визор Терминатора (эксперт, 2026-11-18,
// стенды annotator/report/scan_contours.html и scan_aim.html): силуэты слева направо, каждый сразу целиком — вспышка
// заливки и контура, быстрое угасание, следующий через 0,5–0,8 с; между кругами 5 с (время — scan-timing.ts).
// Первый круг ждёт прицел MIRA (aim-reticle.tsx): первая вспышка — когда он долетел.
const FILL = 0.5;         // яркость заливки во вспышке (контур — полная)

/**
 * Скан поверх кадра. people — силуэты в долях кадра (PeopleScanner); imgW/imgH — размер кадра; fit — как у видео
 * под ним (cover / contain), чтобы контуры легли на людей. clock — общее начало скана (мс кадра, −1 — ещё не начат),
 * lead — задержка первого круга под прицел; boxesOut — силуэты для прицела, в точках рамки видео (до «наезда» камеры):
 * x0, y0, x1, y1 (рамка), cx, cy (центр тяжести фигуры) подряд, в том же порядке, что вспышки.
 */
export function ScanPeople({ people, imgW, imgH, fit, clock, lead, boxesOut }: {
  people: ScannedPerson[];
  imgW: number;
  imgH: number;
  fit: 'cover' | 'contain';
  clock: SharedValue<number>;
  lead: number;
  boxesOut?: SharedValue<number[]>;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  // контуры в точках рамки видео, слева направо (по середине силуэта)
  const shapes = useMemo(() => {
    if (!box.w || !box.h) return [] as { path: SkPath; cx: number; cy: number }[];
    const k = fit === 'cover' ? Math.max(box.w / imgW, box.h / imgH) : Math.min(box.w / imgW, box.h / imgH);
    const ox = (box.w - imgW * k) / 2;
    const oy = (box.h - imgH * k) / 2;
    return [...people]
      .sort((a, b) => a.left + a.right - (b.left + b.right))
      .map((p) => {
        const b = Skia.PathBuilder.Make();
        const xs: number[] = [];
        const ys: number[] = [];
        for (let i = 0; i + 1 < p.points.length; i += 2) {
          const x = ox + p.points[i] * imgW * k;
          const y = oy + p.points[i + 1] * imgH * k;
          xs.push(x);
          ys.push(y);
          if (i === 0) b.moveTo(x, y);
          else b.lineTo(x, y);
        }
        // центр тяжести фигуры (по площади многоугольника); вырожденный контур — среднее точек
        let a2 = 0, sx = 0, sy = 0;
        for (let i = 0; i < xs.length; i++) {
          const j = (i + 1) % xs.length, cr = xs[i] * ys[j] - xs[j] * ys[i];
          a2 += cr;
          sx += (xs[i] + xs[j]) * cr;
          sy += (ys[i] + ys[j]) * cr;
        }
        const mean = (v: number[]) => v.reduce((s, q) => s + q, 0) / Math.max(1, v.length);
        const cx = Math.abs(a2) > 1e-6 ? sx / (3 * a2) : mean(xs);
        const cy = Math.abs(a2) > 1e-6 ? sy / (3 * a2) : mean(ys);
        return { path: b.close().build(), cx, cy };
      });
  }, [people, imgW, imgH, fit, box.w, box.h]);
  const paths = useMemo(() => shapes.map((s) => s.path), [shapes]);

  const n = paths.length;
  const alphas = useSharedValue<number[]>([]);
  const frame = useFrameCallback((fi) => {
    'worklet';
    if (clock.value < 0) clock.value = fi.timestamp;
    const { c, t } = cycleAt((fi.timestamp - clock.value) / 1000, n, lead);
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push(flash(t - flashAt(c, i, lead)));
    alphas.value = out;
  }, false);

  useEffect(() => {
    if (!n) return;
    // рамки силуэтов — прицелу (в той же системе, что контуры: точки рамки видео)
    boxesOut?.set(shapes.flatMap((s) => {
      const r = s.path.computeTightBounds();
      return [r.x, r.y, r.x + r.width, r.y + r.height, s.cx, s.cy];
    }));
    clock.set(-1);
    frame.setActive(true);
    return () => frame.setActive(false);
  }, [n, paths]); // eslint-disable-line react-hooks/exhaustive-deps

  const lw = Math.max(1.5, box.w / 260);
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {n ? (
        <Canvas style={StyleSheet.absoluteFill}>
          {paths.map((path, i) => (
            <Flash key={i} path={path} i={i} alphas={alphas} lw={lw} />
          ))}
        </Canvas>
      ) : null}
    </View>
  );
}

/** Один силуэт: заливка и светящийся контур, яркость — из общей анимации. */
function Flash({ path, i, alphas, lw }: { path: SkPath; i: number; alphas: SharedValue<number[]>; lw: number }) {
  const a = useDerivedValue(() => alphas.value[i] ?? 0);
  return (
    <Group opacity={a}>
      <Path path={path} color={mira.ind} opacity={FILL} />
      <Path path={path} color={mira.ind} style="stroke" strokeWidth={lw * 1.3} strokeJoin="round">
        <BlurMask blur={lw * 3} style="solid" />
      </Path>
    </Group>
  );
}
