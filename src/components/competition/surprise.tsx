import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { loadSurprise, SURPRISE_ZONES, type CompetitionFight, type Surprise } from '@/api/competition';
import { Sheet, SheetScrollView } from '@/components/fight/info-sheet';
import { fc } from '@/components/fight/palette';
import { useAsync } from '@/hooks/use-async';
import { columnScale, fitText, SMALL_TEXT_SCALE } from '@/lib/text';
import { colors, fonts, radii } from '@/theme/tokens';

/** Яркость зон растёт слева направо: обычный уровень почти сливается с фоном, исключение светится. */
const ZONE_COLORS = ['#23262B', '#333841', '#4A515C', '#6E7684'];

const fixed1 = (n: number) => n.toFixed(1).replace('.', ',');

/**
 * Шкала неожиданности турнира — как на сайте у вошедшего пользователя:
 * штырь на шкале из четырёх зон, по тапу — разбивка по боям.
 */
export function SurpriseScale({ competitionId, fights }: { competitionId: string; fights: CompetitionFight[] }) {
  const load = useCallback(() => loadSurprise(competitionId, fights), [competitionId, fights]);
  const { data } = useAsync(load);
  const [open, setOpen] = useState(false);
  if (!data) return null;
  const value = Math.min(100, Math.max(0, data.value));
  const zone = SURPRISE_ZONES.findIndex((z) => value < z.to || z.to === 100);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Неожиданность турнира ${Math.round(value)}%, показать разбивку по боям`}>
        <View style={styles.head}>
          <Text style={styles.label} numberOfLines={1} {...fitText}>
            Неожиданность турнира
          </Text>
          <Text style={styles.more}>По боям ›</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.value}>{Math.round(value)}%</Text>
          <View style={styles.scale}>
            <View style={styles.track}>
              {SURPRISE_ZONES.map((z, i) => (
                <View key={z.label} style={[styles.zone, { flex: z.to - z.from, backgroundColor: ZONE_COLORS[i] }]} />
              ))}
              <View style={[styles.pin, { left: `${value}%` }]} />
            </View>
            <View style={styles.zones}>
              {SURPRISE_ZONES.map((z, i) => (
                <Text
                  key={z.label}
                  style={[styles.zoneLabel, { flex: z.to - z.from }, i === zone && styles.zoneOn]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={SMALL_TEXT_SCALE}
                  {...fitText}>
                  {z.label}
                </Text>
              ))}
            </View>
          </View>
        </View>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} bare>
        <Breakdown data={data} />
      </Sheet>
    </>
  );
}

function Breakdown({ data }: { data: Surprise }) {
  // Колонки с числами — фиксированной ширины (иначе строки не встанут под шапку), но растут
  // вместе с системным шрифтом; бой и победитель делят остаток экрана.
  const { fontScale } = useWindowDimensions();
  const k = columnScale(fontScale);
  const cCap = { width: 58 * k };
  const cPct = { width: 54 * k };
  const head = [
    { label: 'Бой', col: styles.cFight, lines: 1 },
    { label: 'Потенциал', col: [styles.num, cCap], lines: 1 },
    { label: 'Победитель', col: styles.cWin, lines: 1 },
    { label: 'Его шанс\nбыл', col: [styles.num, cPct], lines: 2 },
  ];

  return (
    <>
      <View style={styles.sheetHead}>
        <Text style={styles.sheetTitle}>Неожиданность турнира</Text>
        <Text style={styles.sheetSub}>
          {Math.round(data.value)}% при обычном уровне {Math.round(data.usual)}%.
        </Text>
      </View>
      <View style={[styles.tr, styles.th]}>
        {/* Слово целиком: однословные подписи сжимаются в одну строку, а не рвутся посередине. */}
        {head.map(({ label, col, lines }) => (
          <Text
            key={label}
            style={[styles.thText, col]}
            numberOfLines={lines}
            maxFontSizeMultiplier={SMALL_TEXT_SCALE}
            {...fitText}>
            {label}
          </Text>
        ))}
      </View>
      <SheetScrollView style={styles.flexShrink} contentContainerStyle={styles.tbody}>
        {data.fights.map((f) => {
          // Бои без вклада приглушены: неожиданности в них не было.
          const dim = !f.upset && styles.dim;
          return (
            <View key={f.fightId} style={styles.tr}>
              <Text style={[styles.td, styles.cFight, dim]} numberOfLines={2} {...fitText}>
                {f.title.replace(' / ', ' /\n')}
              </Text>
              <Text style={[styles.tdValue, styles.num, cCap, dim]} maxFontSizeMultiplier={SMALL_TEXT_SCALE}>
                {fixed1(f.capacity)}
              </Text>
              <Text style={[styles.td, styles.cWin, dim]} numberOfLines={1} {...fitText}>
                {f.winner}
              </Text>
              <Text style={[styles.td, styles.num, cPct, dim]} maxFontSizeMultiplier={SMALL_TEXT_SCALE}>
                {fixed1(f.winnerPct)}%
              </Text>
            </View>
          );
        })}
      </SheetScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: fc.card,
    borderWidth: 1,
    borderColor: fc.border,
    borderRadius: radii.control,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  pressed: { opacity: 0.8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  label: { flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 10, color: fc.muted },
  more: { fontFamily: fonts.bodyMedium, fontSize: 11, color: fc.soft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 },
  value: { fontFamily: fonts.display, fontSize: 24, color: colors.text, minWidth: 50 },
  scale: { flex: 1, gap: 8, paddingTop: 5 },
  track: { flexDirection: 'row', gap: 2, height: 6 },
  zone: { height: '100%', borderRadius: 1 },
  // Обводка цветом карточки: без неё штырь в светлой зоне сливается с треком.
  pin: {
    position: 'absolute',
    top: -5,
    bottom: -5,
    width: 2,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: '#F4F5F7',
    boxShadow: `0 0 0 2px ${fc.card}`,
  },
  zones: { flexDirection: 'row', gap: 2 },
  zoneLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: '#565B66',
  },
  zoneOn: { color: '#C9CDD5' },
  sheetHead: { paddingHorizontal: 20, gap: 8, paddingBottom: 14 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 24, textTransform: 'uppercase', color: colors.text },
  sheetSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: fc.soft },
  flexShrink: { flexShrink: 1 },
  tbody: { paddingHorizontal: 20, paddingBottom: 8 },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: fc.borderStrong,
  },
  th: { paddingHorizontal: 20, borderTopWidth: 0, paddingTop: 0, alignItems: 'flex-end' },
  thText: {
    fontFamily: fonts.bodySemi,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    color: '#565B66',
  },
  td: { fontFamily: fonts.body, fontSize: 13, color: colors.text },
  tdValue: { fontFamily: fonts.display, fontSize: 17, color: colors.text },
  dim: { color: '#565B66' },
  cFight: { flex: 1.2 },
  cWin: { flex: 1, textAlign: 'right' },
  num: { textAlign: 'right' },
});
