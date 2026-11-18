import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';

// нативный драйвер анимаций — на телефоне (в браузере его нет)
const ND = Platform.OS !== 'web';

/** MIRA — палитра и элементы из макета «MIRA Analysis» (вариант 2a: контурные глаза индиго). */
export const mira = {
  bg: '#0A0A0B',
  ind: '#67C1D7',    // «Морской закат» (mira-theme.SEA.sea)
  name: '#A7C5D4',   // SEA.mist
  bubble: '#17171A',
  bubbleBorder: '#26262A',
  chip: '#141416',
  chipBorder: '#2E2E33',
  track: '#232327',
  text: '#F4F4F5',
  muted: '#8E8F96',
  soft: '#C9CAD0',
  dim: '#5E5F66',
  red: '#E5483F',
  font: 'GolosText_500Medium',
  fontSemi: 'GolosText_600SemiBold',
  fontBold: 'GolosText_700Bold',
  display: 'RobotoCondensed_800ExtraBold',
  displayBold: 'RobotoCondensed_700Bold',
} as const;

export type EyesMode = 'scan' | 'think' | 'look' | 'happy';

const UP = 'M-52 4 C-30 -26 30 -30 54 -4';
const ALM = UP + ' C30 22 -30 24 -52 4 Z';
const LOW = 'M-52 4 C-30 24 30 22 54 -4';
const HAPPY = 'M-60 60 L-60 22 Q0 2 70 22 L70 60 Z';

/** Глаза MIRA: бегают по видео (scan), задумываются (think), смотрят на тебя (look), щурятся (happy); моргают. */
export function MiraEyes({ mode, width }: { mode: EyesMode; width: number }) {
  const [blink, setBlink] = useState(false);
  const [g, setG] = useState({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const [happy, setHappy] = useState(0); // 0..1 — нижнее «веко» при улыбке

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>, t2: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        setBlink(true);
        t2 = setTimeout(() => setBlink(false), 120);
        loop();
      }, 2400 + Math.random() * 3200);
    };
    loop();
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const pick = () => {
      if (mode === 'scan') {
        target.current = { x: (Math.random() * 2 - 1) * 0.9, y: 0.5 + Math.random() * 0.45 };
        t = setTimeout(pick, 320 + Math.random() * 420);
      } else if (mode === 'think') target.current = { x: -0.6, y: -0.75 };
      else if (mode === 'happy') target.current = { x: 0, y: 0.1 };
      else {
        target.current = { x: (Math.random() - 0.5) * 0.3, y: (Math.random() - 0.5) * 0.2 };
        t = setTimeout(pick, 1300 + Math.random() * 1700);
      }
    };
    pick();
    return () => clearTimeout(t);
  }, [mode]);

  // плавное движение зрачков и «улыбки» к цели (вместо CSS-переходов макета)
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setG((p) => {
        const nx = p.x + (target.current.x - p.x) * 0.22;
        const ny = p.y + (target.current.y - p.y) * 0.22;
        return Math.abs(nx - p.x) + Math.abs(ny - p.y) < 0.002 ? p : { x: nx, y: ny };
      });
      setHappy((h) => {
        const want = mode === 'happy' ? 1 : 0;
        const n = h + (want - h) * 0.2;
        return Math.abs(n - h) < 0.005 ? want : n;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  const pr = mode === 'scan' ? 4.2 : mode === 'think' ? 6.4 : 5.4;
  const eye = (side: 'L' | 'R') => {
    const flip = side === 'L';
    const gx = (flip ? -1 : 1) * g.x * 20;
    const gy = g.y * 8;
    const browY = mode === 'think' ? (flip ? -2 : -8) : mode === 'happy' ? -4 : 0;
    const lid = 18 - happy * 24; // нижнее веко поднимается при улыбке
    return (
      <G key={side} transform={`translate(${flip ? 78 : 222},60) scale(${flip ? -1 : 1},1)`}>
        <Path
          d="M-40 -40 C-14 -50 24 -50 50 -38"
          transform={`translate(0,${browY})`}
          fill="none"
          stroke={mira.ind}
          strokeOpacity={0.45}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
        <G transform={`scale(1,${blink ? 0.05 : 1})`}>
          <G clipPath={`url(#alm${side})`}>
            <G transform={`translate(${gx},${gy})`}>
              <Circle r={16} fill="none" stroke={mira.ind} strokeWidth={1.6} />
              <Circle r={10.5} fill="none" stroke={mira.ind} strokeOpacity={0.35} strokeWidth={1} />
              <Circle r={pr} fill={mira.ind} />
              <Circle cx={5} cy={-6} r={1.8} fill={mira.bg} />
            </G>
            <Path d={HAPPY} transform={`translate(0,${lid})`} fill={mira.bg} />
          </G>
          <Path d={LOW} fill="none" stroke={mira.ind} strokeOpacity={0.55} strokeWidth={1.3} strokeLinecap="round" />
          <Path d={UP} fill="none" stroke={mira.ind} strokeWidth={2.4} strokeLinecap="round" />
          <Path d="M48 -9 Q60 -14 74 -24" fill="none" stroke={mira.ind} strokeWidth={2.4} strokeLinecap="round" />
          <Path d="M-52 4 L-58 6" fill="none" stroke={mira.ind} strokeOpacity={0.55} strokeWidth={1.3} strokeLinecap="round" />
        </G>
      </G>
    );
  };

  return (
    // свечение — по контуру глаз (drop-shadow), а не тенью View: на вебе тень View рисует прямоугольную рамку
    <View style={Platform.OS === 'web' ? ({ filter: 'drop-shadow(0 0 6px rgba(103,193,215,.45))' } as object) : undefined}>
      <Svg viewBox="0 0 300 110" width={width} height={(width * 110) / 300} style={{ overflow: 'visible' }}>
        <Defs>
          <ClipPath id="almL">
            <Path d={ALM} />
          </ClipPath>
          <ClipPath id="almR">
            <Path d={ALM} />
          </ClipPath>
        </Defs>
        {eye('L')}
        {eye('R')}
      </Svg>
    </View>
  );
}

/** Сканирование кадра: линия ходит сверху вниз, две пульсирующие рамки на борцах. */
export function Scan() {
  const y = useState(() => new Animated.Value(0))[0];
  const [h, setH] = useState(0);
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: ND }),
        Animated.timing(y, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: ND }),
      ]),
    );
    a.start();
    return () => {
      a.stop();
    };
  }, [y]);
  // сдвиг, а не top: анимация идёт в нативном потоке и не дёргается, когда JS занят (глаза MIRA)
  const ty = y.interpolate({ inputRange: [0, 1], outputRange: [h * 0.04, h * 0.96] });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      <Animated.View style={[styles.line, { top: 0, transform: [{ translateY: ty }] }]} />
    </View>
  );
}

/** Кольцо загрузки: процент + вращающаяся дуга внутри. */
/** Кольцо прогресса с бегущей дугой; children — подпись в центре (например, процент). */
export function Ring({ pct, size = 44, color = mira.ind, children }: {
  pct: number; size?: number; color?: string; children?: ReactNode;
}) {
  const sw = size > 50 ? 4 : 3;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const ri = r - sw - 2;
  const rot = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    const a = Animated.loop(Animated.timing(rot, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: ND }));
    a.start();
    return () => a.stop();
  }, [rot]);
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2A2B30" strokeWidth={sw} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${c}`}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </Svg>
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ rotate: rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={ri}
            fill="none"
            stroke="rgba(244,244,245,.55)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeDasharray={`${ri * 1.2} ${c}`}
          />
        </Svg>
      </Animated.View>
      {children != null ? <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>{children}</View> : null}
    </View>
  );
}

/** Три точки «печатает». */
export function Dots() {
  const vals = useState(() => [0, 1, 2].map(() => new Animated.Value(0.25)))[0];
  useEffect(() => {
    const a = Animated.loop(
      Animated.stagger(
        180,
        vals.map((v) =>
          Animated.sequence([
            Animated.timing(v, { toValue: 1, duration: 360, useNativeDriver: ND }),
            Animated.timing(v, { toValue: 0.25, duration: 360, useNativeDriver: ND }),
          ]),
        ),
      ),
    );
    a.start();
    return () => a.stop();
  }, [vals]);
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {vals.map((v, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0.25, 1], outputRange: [0, -3] }) }] }]}
        />
      ))}
    </View>
  );
}

/** Появление снизу (как animation: rise в макете). */
export function Rise({ children, style }: { children: React.ReactNode; style?: object }) {
  const v = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    // появление сообщения — в родном потоке: в JavaScript каждый кадр отнимал время у глаз MIRA (просадка на сообщениях)
    Animated.timing(v, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: ND }).start();
  }, [v]);
  return (
    <Animated.View
      style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: mira.ind,
    shadowColor: mira.ind,
    shadowOpacity: 0.5,
    shadowRadius: 14,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#A3A4AB' },
});
