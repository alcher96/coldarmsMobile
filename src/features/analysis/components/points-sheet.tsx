/* eslint-disable react-hooks/refs, react-hooks/purity --
   покадровая анимация / жесты: изменяемое состояние кадра живёт в ref и SharedValue мимо React (иначе — перерисовка
   экрана на каждый кадр); плеер expo-video управляется присваиванием свойств. React Compiler такие компоненты
   не оптимизирует (сам пропускает), поведение проверено на телефоне (прототип coldarmsAI/mobile). */
// Доп. настройка «где я, где соперник» (эксперт, 2026-11-16): вкладка под видео, пока MIRA спрашивает «где ты» →
// экран с тремя кадрами ролика, на каждом спортсмен ставит две точки — себя и соперника. Нужно, когда кто-то или что-то
// закрывает борцов (судья, зрители, своя голова или плечо при съёмке из-за плеча): по точкам конвейер берёт именно
// этих двух людей (research/pipeline_clip.py --taps → track_from_taps.pick_pair), а не угадывает пару сам.
//
// Кадр крупно, по одному; приблизить — двумя пальцами (точнее поставить точку), сдвинуть приближенный — одним.
// Жесты — PanResponder и Animated (сдвиг и масштаб без перерисовки React), точки едут вместе с кадром.
import { Check, Undo2, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Animated, BackHandler, Image, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { mediaSource } from '../api';
import { getFrames, type Tap, type TapFrames } from '../jobs';
import { mira } from './mira';
import { SEA } from './mira-theme';

const BG = require('../../../../assets/mira/modal-bg.jpg');
const ME = '#3DDC84', OPP = '#FF8C28';
type Who = 'me' | 'opp';
type Pts = { me?: [number, number]; opp?: [number, number] };

export function PointsSheet({ jobId, onDone, onClose, error }: {
  jobId: string; onDone: (taps: Tap[]) => void; onClose: () => void; error?: string;
}) {
  const { width, height } = useWindowDimensions();
  const [data, setData] = useState<TapFrames | null>(null);
  const [wait, setWait] = useState<string>();
  const [idx, setIdx] = useState(0);
  const [who, setWho] = useState<Who>('me');
  const [pts, setPts] = useState<Pts[]>([{}, {}, {}]);
  const [busy, setBusy] = useState(false);

  // кадры появляются, когда видео приведено к стандарту (секунды после загрузки) — до этого сервер отвечает 409
  // закрыли экран — запрос и повторы обрываются (токен отмены)
  useEffect(() => {
    const ac = new AbortController();
    let tries = 0, timer: ReturnType<typeof setTimeout> | undefined;
    const load = () =>
      getFrames(jobId, ac.signal)
        .then((d) => !ac.signal.aborted && setData(d))
        .catch((e) => {
          if (ac.signal.aborted) return;
          tries += 1;
          setWait(e?.status === 409 ? 'Видео ещё готовится — кадры будут через пару секунд…' : 'Нет связи с сервером, пробую ещё…');
          if (tries < 40) timer = setTimeout(load, 2000);
        });
    load();
    return () => {
      ac.abort();
      clearTimeout(timer);
    };
  }, [jobId]);

  const complete = (p: Pts) => !!(p.me && p.opp);
  const all = data ? data.frames.every((_, i) => complete(pts[i])) : false;
  // история для «Отменить» и кнопки «назад» телефона: каждая точка — шаг (с переходом на следующий кадр, если он был)
  const hist = useRef<{ pts: Pts[]; idx: number; who: Who }[]>([]);
  const [histLen, setHistLen] = useState(0);
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);
  const place = (x: number, y: number) => {
    hist.current.push({ pts, idx, who });
    setHistLen(hist.current.length);
    const next = pts.map((p, i) => (i === idx ? { ...p, [who]: [Math.round(x), Math.round(y)] as [number, number] } : p));
    setPts(next);
    const cur = next[idx];
    // дальше по порядку: себя → соперника → следующий кадр
    if (who === 'me' && !cur.opp) setWho('opp');
    else if (complete(cur) && data && idx < data.frames.length - 1 && !complete(next[idx + 1])) {
      advance.current = setTimeout(() => { advance.current = null; setIdx(idx + 1); setWho('me'); }, 350);
    }
  };
  /** Отменить последнюю точку: вернуть точки, кадр и «кого ставлю» как было до неё. false — отменять нечего. */
  const undo = () => {
    const last = hist.current.pop();
    if (!last) return false;
    if (advance.current) { clearTimeout(advance.current); advance.current = null; }
    setPts(last.pts); setIdx(last.idx); setWho(last.who);
    setHistLen(hist.current.length);
    return true;
  };
  // кнопка «назад» телефона на этом экране: сначала отменяет точки по одной, потом закрывает экран (не уводит из разговора)
  const backRef = useRef<() => boolean>(() => false);
  backRef.current = () => {
    if (sending) return true;
    if (!undo()) onClose();
    return true;
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => backRef.current());
    return () => sub.remove();
  }, []);
  const done = () => {
    if (!data || !all || sending) return;
    setBusy(true);
    onDone(data.frames.map((f, i) => ({ frame: f.frame, me: pts[i].me!, opp: pts[i].opp! })));
  };
  const sending = busy && !error;

  const boxW = width - 32, maxH = height * 0.46;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Image source={BG} style={FILL} resizeMode="cover" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,6,9,.55)' }]} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.head}>
          <Text style={styles.title}>Где ты и где соперник</Text>
          <Pressable hitSlop={12} onPress={onClose} accessibilityLabel="Закрыть">
            <X size={22} color={mira.soft} strokeWidth={1.8} />
          </Pressable>
        </View>
        <Text style={styles.caption}>
          Если кто-то или что-то закрывает одного из борцов (судья, зрители, твоя голова или плечо), отметь точками себя и
          соперника на трёх кадрах — так MIRA точно не перепутает вас.
        </Text>

        <View style={styles.whoRow}>
          {(['me', 'opp'] as Who[]).map((k) => (
            <Pressable key={k} onPress={() => setWho(k)} style={[styles.who, who === k && { borderColor: k === 'me' ? ME : OPP, backgroundColor: '#17171A' }]}>
              <View style={[styles.dot, { backgroundColor: k === 'me' ? ME : OPP }]} />
              <Text style={[styles.whoText, who === k && { color: mira.text }]}>{k === 'me' ? 'Я' : 'Соперник'}</Text>
              {pts[idx]?.[k] ? <Check size={14} color={mira.soft} strokeWidth={2.2} /> : null}
            </Pressable>
          ))}
        </View>

        <View style={styles.stage}>
          {data ? (
            <ZoomFrame
              key={data.frames[idx].frame}
              src={mediaSource(data.frames[idx].url)}
              W={data.width}
              H={data.height}
              boxW={boxW}
              maxH={maxH}
              pts={pts[idx]}
              onTap={place}
            />
          ) : (
            <View style={{ alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color={mira.soft} />
              <Text style={styles.wait}>{wait ?? 'Беру кадры из видео…'}</Text>
            </View>
          )}
        </View>
        <View style={styles.hintRow}>
          <Pressable onPress={undo} disabled={!histLen} hitSlop={8} accessibilityLabel="Отменить последнюю точку"
            style={({ pressed }) => [styles.undo, !histLen && { opacity: 0.35 }, pressed && { backgroundColor: '#1E1E23' }]}>
            <Undo2 size={15} color={mira.soft} strokeWidth={2} />
            <Text style={styles.undoText}>Отменить</Text>
          </Pressable>
          <Text style={styles.hint} numberOfLines={2}>
            {who === 'me' ? 'Нажми на себя' : 'Нажми на соперника'} · двумя пальцами — приблизить
          </Text>
        </View>

        <View style={styles.tabs}>
          {(data?.frames ?? [0, 1, 2]).map((f, i) => (
            <Pressable key={i} onPress={() => { if (data) { setIdx(i); setWho(pts[i].me ? (pts[i].opp ? who : 'opp') : 'me'); } }}
              style={[styles.tab, i === idx && styles.tabOn]}>
              <Text style={[styles.tabText, i === idx && { color: mira.text }]}>
                Кадр {i + 1}{typeof f === 'object' ? ` · ${Math.round(f.t)} с` : ''}
              </Text>
              {complete(pts[i]) ? <Check size={14} color={ME} strokeWidth={2.4} /> : null}
            </Pressable>
          ))}
        </View>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        <Pressable onPress={done} disabled={!all || sending} style={[styles.go, (!all || sending) && { opacity: 0.45 }]}>
          {sending ? <ActivityIndicator color={SEA.onSea} /> : <Text style={styles.goText}>Готово</Text>}
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

/** Кадр с точками: нажатие — точка (в пикселях кадра), два пальца — приблизить (до ×4), один палец — сдвинуть. */
function ZoomFrame({ src, W, H, boxW, maxH, pts, onTap }: {
  src: { uri: string; headers: Record<string, string> }; W: number; H: number; boxW: number; maxH: number; pts: Pts; onTap: (x: number, y: number) => void;
}) {
  let dw = boxW, dh = (boxW * H) / W;
  if (dh > maxH) { dh = maxH; dw = (maxH * W) / H; }
  const s = useState(() => new Animated.Value(1))[0];
  const tx = useState(() => new Animated.Value(0))[0];
  const ty = useState(() => new Animated.Value(0))[0];
  const inv = useMemo(() => Animated.divide(1, s), [s]);
  const cur = useRef({ s: 1, tx: 0, ty: 0 }).current;
  const box = useRef<ComponentRef<typeof View>>(null);
  const org = useRef({ x: 0, y: 0 }).current;
  const g = useRef({ n: 0, d0: 0, mx: 0, my: 0, base: { s: 1, tx: 0, ty: 0 }, moved: false, t0: 0, multi: false }).current;
  const tapRef = useRef(onTap);
  tapRef.current = onTap;

  const set = (ns: number, ntx: number, nty: number) => {
    ns = Math.min(4, Math.max(1, ns));
    const mx = ((ns - 1) * dw) / 2, my = ((ns - 1) * dh) / 2;
    cur.s = ns; cur.tx = Math.min(mx, Math.max(-mx, ntx)); cur.ty = Math.min(my, Math.max(-my, nty));
    s.setValue(cur.s); tx.setValue(cur.tx); ty.setValue(cur.ty);
  };
  const rebase = (touches: readonly { pageX: number; pageY: number }[]) => {
    g.n = touches.length;
    g.base = { ...cur };
    g.mx = touches.reduce((a, t) => a + t.pageX, 0) / touches.length;
    g.my = touches.reduce((a, t) => a + t.pageY, 0) / touches.length;
    g.d0 = touches.length > 1 ? Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY) : 0;
  };
  const pr = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      box.current?.measureInWindow((x, y) => { org.x = x; org.y = y; });
      g.moved = false; g.multi = false; g.t0 = Date.now();
      rebase(e.nativeEvent.touches);
    },
    onPanResponderMove: (e) => {
      const ts = e.nativeEvent.touches;
      if (ts.length !== g.n) rebase(ts);
      const mx = ts.reduce((a, t) => a + t.pageX, 0) / ts.length, my = ts.reduce((a, t) => a + t.pageY, 0) / ts.length;
      if (Math.hypot(mx - g.mx, my - g.my) > 6) g.moved = true;
      if (ts.length > 1) {
        g.multi = true; g.moved = true;
        const d = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
        set(g.base.s * (d / Math.max(1, g.d0)), g.base.tx + (mx - g.mx), g.base.ty + (my - g.my));
      } else if (cur.s > 1) {
        set(cur.s, g.base.tx + (mx - g.mx), g.base.ty + (my - g.my));
      }
    },
    onPanResponderRelease: (e) => {
      if (g.moved || g.multi || Date.now() - g.t0 > 500) return;
      // нажатие → точка в пикселях кадра (с учётом приближения и сдвига; масштаб — от центра кадра)
      const lx = e.nativeEvent.pageX - org.x, ly = e.nativeEvent.pageY - org.y;
      const cx = (lx - dw / 2 - cur.tx) / cur.s + dw / 2, cy = (ly - dh / 2 - cur.ty) / cur.s + dh / 2;
      if (cx >= 0 && cy >= 0 && cx <= dw && cy <= dh) tapRef.current((cx / dw) * W, (cy / dh) * H);
    },
  }), [dw, dh, W, H]); // eslint-disable-line react-hooks/exhaustive-deps

  const dot = (k: Who) => {
    const p = pts[k];
    if (!p) return null;
    const c = k === 'me' ? ME : OPP;
    return (
      <Animated.View key={k} pointerEvents="none"
        style={[styles.pin, { left: (p[0] / W) * dw - 14, top: (p[1] / H) * dh - 14, transform: [{ scale: inv }] }]}>
        <View style={[styles.pinDot, { backgroundColor: c }]} />
        <View style={[styles.pinTag, { backgroundColor: c }]}><Text style={styles.pinText}>{k === 'me' ? 'Я' : 'Соп.'}</Text></View>
      </Animated.View>
    );
  };
  return (
    <View ref={box} collapsable={false} style={{ width: dw, height: dh, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000' }} {...pr.panHandlers}>
      <Animated.View style={{ width: dw, height: dh, transform: [{ translateX: tx }, { translateY: ty }, { scale: s }] }}>
        <Image source={src} style={{ width: dw, height: dh }} resizeMode="cover" />
        {dot('me')}
        {dot('opp')}
      </Animated.View>
    </View>
  );
}

// на вебе у <img> absoluteFill не растягивает — размер явно
const FILL = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' } as const;

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  title: { fontFamily: mira.display, fontSize: 22, letterSpacing: 0.4, textTransform: 'uppercase', color: mira.text },
  caption: { fontFamily: mira.font, fontSize: 13, lineHeight: 19, color: mira.soft, paddingHorizontal: 16, marginTop: 8 },
  whoRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 14 },
  who: {
    flex: 1, height: 42, borderRadius: 12, borderWidth: 1.5, borderColor: '#2E2E33', backgroundColor: '#111114',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  whoText: { fontFamily: mira.fontSemi, fontSize: 14, color: mira.muted },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  wait: { fontFamily: mira.font, fontSize: 13, color: mira.muted, textAlign: 'center', paddingHorizontal: 24 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  hint: { flex: 1, fontFamily: mira.font, fontSize: 12, lineHeight: 16, color: mira.muted, textAlign: 'right' },
  undo: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#2E2E33', backgroundColor: '#111114',
  },
  undoText: { fontFamily: mira.fontSemi, fontSize: 13, color: mira.soft },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 12 },
  tab: {
    flex: 1, height: 38, borderRadius: 10, borderWidth: 1, borderColor: '#2E2E33', backgroundColor: '#111114',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  tabOn: { borderColor: SEA.sea, backgroundColor: '#0F1E25' },
  tabText: { fontFamily: mira.font, fontSize: 12, color: mira.muted },
  err: { fontFamily: mira.font, fontSize: 12, color: mira.red, textAlign: 'center', marginTop: 8 },
  go: {
    height: 52, borderRadius: 16, marginHorizontal: 16, marginTop: 12, marginBottom: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: SEA.sea,
  },
  goText: { fontFamily: mira.display, fontSize: 17, letterSpacing: 0.6, textTransform: 'uppercase', color: SEA.onSea },
  pin: { position: 'absolute', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2.5, borderColor: '#FFFFFF' },
  pinTag: { position: 'absolute', top: -16, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 },
  pinText: { fontFamily: mira.fontSemi, fontSize: 10, color: '#0A0A0B' },
});
