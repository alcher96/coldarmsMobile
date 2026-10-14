import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';

import { fonts } from '@/theme/tokens';

type Series = { values: number[]; color: string };

/**
 * «Паутинка» по N осям. Значения — от 0 до `max`; несколько серий рисуются друг поверх друга.
 * Подписи осей — по кругу снаружи.
 */
export function RadarChart({
  labels,
  series,
  max = 10,
  size = 240,
}: {
  labels: string[];
  series: Series[];
  max?: number;
  size?: number;
}) {
  const n = labels.length;
  const pad = 74; // место под подписи по бокам
  const c = size / 2;
  const r = c - pad;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i: number, v: number) => {
    const k = Math.max(0, Math.min(1, v / max));
    return [c + Math.cos(angle(i)) * r * k, c + Math.sin(angle(i)) * r * k] as const;
  };
  const ring = (k: number) =>
    labels.map((_, i) => `${c + Math.cos(angle(i)) * r * k},${c + Math.sin(angle(i)) * r * k}`).join(' ');

  // Холст по высоте фигуры с подписями: у пятиугольника низ короче верха, лишнее не держим.
  const ys = labels.map((_, i) => Math.sin(angle(i)) * (r + 14));
  const top = c + Math.min(...ys) - 14;
  const bottom = c + Math.max(...ys) + 18;
  const height = bottom - top;

  return (
    <Svg width={size} height={height} viewBox={`0 ${top} ${size} ${height}`}>
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <Polygon key={k} points={ring(k)} fill="none" stroke="#2A2B30" strokeWidth={1} />
      ))}
      {labels.map((_, i) => (
        <Line
          key={i}
          x1={c}
          y1={c}
          x2={c + Math.cos(angle(i)) * r}
          y2={c + Math.sin(angle(i)) * r}
          stroke="#2A2B30"
          strokeWidth={1}
        />
      ))}
      {series.map((s, si) => (
        <Polygon
          key={si}
          points={s.values.map((v, i) => point(i, v).join(',')).join(' ')}
          fill={s.color}
          fillOpacity={0.18}
          stroke={s.color}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      ))}
      {series.map((s, si) =>
        s.values.map((v, i) => {
          const [x, y] = point(i, v);
          return <Circle key={`${si}-${i}`} cx={x} cy={y} r={3} fill={s.color} />;
        }),
      )}
      {labels.map((label, i) => {
        const a = angle(i);
        const x = c + Math.cos(a) * (r + 14);
        const y = c + Math.sin(a) * (r + 14);
        const cos = Math.cos(a);
        const anchor = Math.abs(cos) < 0.3 ? 'middle' : cos > 0 ? 'start' : 'end';
        return (
          <SvgText
            key={label}
            x={x}
            y={y + 4}
            fill="#A3A4AB"
            fontSize={11}
            fontFamily={fonts.bodyMedium}
            textAnchor={anchor}>
            {label}
          </SvgText>
        );
      })}
    </Svg>
  );
}
