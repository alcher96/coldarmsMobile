import { router } from 'expo-router';
import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';

import type { Kpi } from '@/api/analytics';
import { fc } from '@/components/fight/palette';
import { FighterAvatar } from '@/components/tournaments/fighter-avatar';
import { Card } from '@/components/ui';
import { useAsync } from '@/hooks/use-async';
import { flagOf } from '@/lib/countries';
import { fitText, SMALL_TEXT_SCALE } from '@/lib/text';
import { colors, fonts, radii } from '@/theme/tokens';

export const GREEN = '#4AC87C';

/** Итоговые цифры сеткой 2×2 — как плашки над вкладками на сайте. */
export function KpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <View style={styles.kpis}>
      {kpis.map((k) => (
        <View key={k.label} style={styles.kpi}>
          <Text style={styles.kpiValue} maxFontSizeMultiplier={SMALL_TEXT_SCALE} numberOfLines={1}>
            {k.value}
          </Text>
          <Text style={styles.kpiLabel} numberOfLines={1} {...fitText}>
            {k.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

type Box = { x: number; width: number };

/** Выбранный пункт ленты — по центру, насколько позволяет прокрутка; пока размеры неизвестны — ничего. */
function centerChip(view: ScrollViewInstance | null, chip: Box | undefined, viewWidth: number, animated: boolean) {
  if (!view || !chip || !viewWidth) return;
  view.scrollTo({ x: Math.max(0, chip.x - (viewWidth - chip.width) / 2), animated });
}

/**
 * Лента-переключатель с прокруткой: разделов больше, чем влезает в ширину экрана. Выбранный
 * пункт всегда виден — лента сама доезжает до него (в том числе при открытии по ссылке).
 * `inset` — отступ по краям, когда лента идёт от края до края экрана.
 */
export function Chips<K extends string>({
  options,
  value,
  onChange,
  inset,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  inset?: number;
}) {
  const view = useRef<ScrollViewInstance>(null);
  const boxes = useRef(new Map<string, Box>());
  const viewWidth = useRef(0);

  useEffect(() => {
    centerChip(view.current, boxes.current.get(value), viewWidth.current, true);
  }, [value]);

  return (
    <ScrollView
      ref={view}
      onLayout={(e) => {
        viewWidth.current = e.nativeEvent.layout.width;
        centerChip(view.current, boxes.current.get(value), viewWidth.current, false);
      }}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.chips, inset ? { paddingHorizontal: inset } : null]}
      accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            onLayout={(e) => {
              boxes.current.set(o.key, e.nativeEvent.layout);
              if (o.key === value) centerChip(view.current, e.nativeEvent.layout, viewWidth.current, false);
            }}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}>
            <Text style={[styles.chipText, on && styles.chipTextOn]} maxFontSizeMultiplier={SMALL_TEXT_SCALE}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Подраздел вкладки: заголовок, содержимое и сноска мелким текстом. */
export function Block({ title, note, children }: { title?: string; note?: string; children: ReactNode }) {
  return (
    <Card style={styles.block}>
      {title ? <Text style={styles.blockTitle}>{title}</Text> : null}
      {children}
      {note ? <Note>{note}</Note> : null}
    </Card>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <Text style={styles.note}>{children}</Text>;
}

/** Крупная цифра с подписью — для «79,9% взявших первый раунд…». */
export function BigStat({ value, text, color }: { value: string; text: string; color?: string }) {
  return (
    <View style={styles.big}>
      <Text style={[styles.bigValue, color ? { color } : null]} maxFontSizeMultiplier={SMALL_TEXT_SCALE}>
        {value}
      </Text>
      <Text style={styles.bigText}>{text}</Text>
    </View>
  );
}

/**
 * Строка с полосой: подпись и значение сверху, полоса снизу. Длина полосы — доля (0…1).
 * `marker` — отметка 50% для винрейта; `dim` — мало боёв, вывод ненадёжен; `wrap` — длинная
 * подпись: она занимает всю ширину, а полоса с цифрами уходит строкой ниже.
 */
export function BarRow({
  label,
  value,
  sub,
  fraction,
  marker,
  dim,
  wrap,
  color = colors.text,
}: {
  label: string;
  value: string;
  sub?: string;
  fraction: number;
  marker?: boolean;
  dim?: boolean;
  wrap?: boolean;
  color?: string;
}) {
  const width = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%` as const;
  const track = (
    <View style={[styles.track, wrap && styles.trackInline]}>
      <View style={[styles.fill, { width, backgroundColor: color }]} />
      {marker ? <View style={styles.marker} /> : null}
    </View>
  );
  const numbers = (
    <>
      {sub ? (
        <Text style={styles.barSub} maxFontSizeMultiplier={SMALL_TEXT_SCALE}>
          {sub}
        </Text>
      ) : null}
      <Text style={styles.barValue} maxFontSizeMultiplier={SMALL_TEXT_SCALE}>
        {value}
      </Text>
    </>
  );
  return (
    <View style={[styles.bar, dim && styles.dim]} accessible accessibilityLabel={[label, value, sub].filter(Boolean).join(', ')}>
      {wrap ? (
        <>
          <Text style={styles.barLabel}>{label}</Text>
          <View style={styles.barLine}>
            {track}
            {numbers}
          </View>
        </>
      ) : (
        <>
          <View style={styles.barHead}>
            <Text style={styles.barLabel} numberOfLines={1} {...fitText}>
              {label}
            </Text>
            {numbers}
          </View>
          {track}
        </>
      )}
    </View>
  );
}

/** Строка атлета: место, аватар, имя с флагом и подписью; справа значение. Ведёт на страницу атлета. */
export function AthleteRow({
  id,
  name,
  country,
  rank,
  sub,
  right,
  rightSub,
}: {
  id: string;
  name: string;
  country?: string | null;
  rank?: number;
  sub?: string;
  right?: string;
  rightSub?: string;
}) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/athlete/[id]', params: { id } })}
      style={({ pressed }) => [styles.athlete, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={[name, sub, right, rightSub].filter(Boolean).join(', ')}>
      {rank != null ? <Text style={styles.rank}>{String(rank).padStart(2, '0')}</Text> : null}
      <FighterAvatar id={id} name={name} size={34} round />
      <View style={styles.athleteMain}>
        <Text style={styles.athleteName} numberOfLines={1} {...fitText}>
          {name} {flagOf(country)}
        </Text>
        {sub ? (
          <Text style={styles.athleteSub} numberOfLines={1} {...fitText}>
            {sub}
          </Text>
        ) : null}
      </View>
      {right ? (
        <View style={styles.athleteRight}>
          <Text style={styles.athleteValue} maxFontSizeMultiplier={SMALL_TEXT_SCALE}>
            {right}
          </Text>
          {rightSub ? (
            <Text style={styles.athleteRightSub} maxFontSizeMultiplier={SMALL_TEXT_SCALE}>
              {rightSub}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

/** «Показать все (53)» / «Свернуть» под длинным списком. */
export function ShowMore({ expanded, total, onPress }: { expanded: boolean; total: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.more, pressed && styles.pressed]} hitSlop={6}>
      <Text style={styles.moreText}>{expanded ? 'Свернуть' : `Показать все (${total})`}</Text>
    </Pressable>
  );
}

/** Вкладка грузится сама, пока грузится — индикатор, при ошибке — «Повторить». */
export function Loadable<T>({ load, children }: { load: () => Promise<T>; children: (data: T) => ReactNode }) {
  const { data, error, loading, refresh } = useAsync(load);
  if (data) return children(data);
  if (loading) return <ActivityIndicator color={colors.text} style={styles.loader} />;
  return (
    <View style={styles.error}>
      <Text style={styles.errorText}>{error?.message || 'Не удалось загрузить'}</Text>
      <Pressable onPress={refresh} style={styles.retry}>
        <Text style={styles.retryText}>Повторить</Text>
      </Pressable>
    </View>
  );
}

export const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  dim: { opacity: 0.45 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  kpi: { width: '50%', paddingRight: 8 },
  kpiValue: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.text },
  kpiLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.light, borderColor: colors.light },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted },
  chipTextOn: { fontFamily: fonts.bodySemi, color: colors.lightText },
  block: { gap: 12 },
  blockTitle: { fontFamily: fonts.display, fontSize: 18, textTransform: 'uppercase', color: colors.text },
  note: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.textDim },
  big: { gap: 2 },
  bigValue: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: colors.text },
  bigText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: fc.soft },
  bar: { gap: 6 },
  barHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  barLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  barSub: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  barValue: { minWidth: 44, textAlign: 'right', fontFamily: fonts.display, fontSize: 16, color: colors.text },
  barLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { height: 6, borderRadius: 3, backgroundColor: fc.track, overflow: 'hidden' },
  trackInline: { flex: 1 },
  fill: { height: '100%', borderRadius: 3 },
  marker: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  athlete: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  rank: { width: 20, fontFamily: fonts.body, fontSize: 11, color: colors.textDim },
  athleteMain: { flex: 1, minWidth: 0 },
  athleteName: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  athleteSub: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  athleteRight: { alignItems: 'flex-end' },
  athleteValue: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  athleteRightSub: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  more: { alignSelf: 'flex-start', paddingVertical: 4 },
  moreText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text, textDecorationLine: 'underline' },
  loader: { marginVertical: 32 },
  error: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  retry: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radii.control, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
});
