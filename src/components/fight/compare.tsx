import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { advancedFor, type FightPage, type Hand, type WrestlerStats } from '@/api/fight';
import { colors, fonts, radii } from '@/theme/tokens';

import { InfoButton, type Info } from './info-sheet';
import { MirrorRow, type MirrorRowData } from './mirror-row';
import {
  dominanceRows,
  experienceRows,
  flashRows,
  formRows,
  gripRows,
  INFO,
  intervals,
  oppositionRows,
  physRows,
  ratings,
  type Interval,
  type Rating,
  type Side,
} from './model';
import { fc } from './palette';

export type Category = 'form' | 'grips' | 'phys' | 'exp' | 'dom' | 'flash' | 'deep';

const BASIC: { key: Category; label: string }[] = [
  { key: 'form', label: 'Форма' },
  { key: 'grips', label: 'Захваты' },
  { key: 'phys', label: 'Физика' },
];
const EXPERT: { key: Category; label: string }[] = [
  { key: 'exp', label: 'Опыт' },
  { key: 'dom', label: 'Доминирование' },
  { key: 'flash', label: 'Флешпины и фолы' },
  { key: 'deep', label: 'Сила оппозиции' },
];

export type CompareState = {
  hand: Hand;
  cat: Category;
  expert: boolean;
  gripMode: 'win' | 'rounds';
  /** Для завершённого боя: статистика на сегодня или на дату боя. */
  asOf: boolean;
};

type Props = {
  data: FightPage;
  a: Side;
  b: Side;
  state: CompareState;
  onChange: (patch: Partial<CompareState>) => void;
  /** Статистика «на момент боя», если выбрана и загружена. */
  asOfStats: { statsA: WrestlerStats | null; statsB: WrestlerStats | null } | null;
  finished: boolean;
  onInfo: (info: Info) => void;
};

/** Сравнение бойцов: рука, одна категория за раз, расширенные разделы — в режиме «Эксперт». */
export function Compare({ data, a, b, state, onChange, asOfStats, finished, onInfo }: Props) {
  const { hand, cat, expert, gripMode, asOf } = state;
  const fightHand: Hand = data.fight.hand === 'Left' ? 'Left' : 'Right';
  const statsA = (asOf && asOfStats?.statsA) || data.statsA;
  const statsB = (asOf && asOfStats?.statsB) || data.statsB;
  const A = advancedFor(statsA, hand);
  const B = advancedFor(statsB, hand);
  const cats = expert ? [...BASIC, ...EXPERT] : BASIC;

  let blocks: { title: string; sub?: string; info?: Info; rows?: MirrorRowData[]; mode?: boolean }[] = [];
  let hasSmall = false;
  let extra: 'ratings' | 'ci' | null = null;
  let ci: Interval[] | null = null;
  let rt: Rating[] = [];

  if (cat === 'form') blocks = [{ title: 'Форма', info: INFO.form, rows: formRows(statsA, statsB, hand, { expert }) }];
  if (cat === 'grips') {
    const g = gripRows(statsA, statsB, hand, gripMode);
    hasSmall = g.hasSmall;
    blocks = [
      {
        title: 'Захваты',
        info: INFO.grips,
        mode: true,
        sub: gripMode === 'win' ? 'Доля выигранных раундов · в центре разница' : 'Сколько раундов провёл в каждом захвате',
        rows: g.rows,
      },
    ];
  }
  if (cat === 'phys') {
    const p = physRows(data, expert);
    blocks = [
      {
        title: 'Антропометрия',
        info: INFO.phys,
        sub: expert && p.cohort ? `Перцентиль — место среди ${p.cohort} атлетов того же пола` : undefined,
        rows: p.rows,
      },
    ];
    rt = ratings(data);
    if (rt.length) extra = 'ratings';
  }
  if (cat === 'exp') blocks = [{ title: 'Опыт', rows: experienceRows(A, B) }];
  if (cat === 'dom') blocks = [{ title: 'Доминирование', info: INFO.dom, rows: dominanceRows(A, B) }];
  if (cat === 'flash') blocks = [{ title: 'Флешпины и фолы', info: INFO.flash, rows: flashRows(statsA, statsB) }];
  if (cat === 'deep') {
    blocks = [{ title: 'Сила оппозиции', info: INFO.deep, rows: oppositionRows(A, B) }];
    ci = intervals(A, B, a, b);
    extra = 'ci';
  }

  return (
    <View style={styles.root}>
      <View style={styles.controls}>
        <Toggle
          options={[
            { key: 'Right', label: 'Правая' },
            { key: 'Left', label: 'Левая' },
          ]}
          value={hand}
          onChange={(h) => onChange({ hand: h as Hand })}
        />
        <Pressable onPress={() => onChange({ expert: !expert })} style={styles.expert}>
          <Text style={styles.expertText}>Эксперт</Text>
          <Switch
            value={expert}
            onValueChange={(v) => onChange({ expert: v })}
            trackColor={{ false: '#3A3B40', true: colors.accent }}
            thumbColor={colors.text}
          />
        </Pressable>
      </View>

      {finished ? (
        <View style={styles.asOf}>
          <Toggle
            stretch
            options={[
              { key: 'today', label: 'Сегодня' },
              { key: 'then', label: 'На момент боя' },
            ]}
            value={asOf ? 'then' : 'today'}
            onChange={(k) => onChange({ asOf: k === 'then' })}
          />
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catsScroll} contentContainerStyle={styles.cats}>
        {cats.map((c) => {
          const on = cat === c.key;
          const isExp = EXPERT.some((e) => e.key === c.key);
          return (
            <Pressable key={c.key} onPress={() => onChange({ cat: c.key })} style={[styles.cat, on && styles.catOn]}>
              <Text style={[styles.catText, on && styles.catTextOn]}>{c.label}</Text>
              {isExp ? <View style={styles.expDot} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {hand !== fightHand && cat !== 'phys' ? (
        <Text style={styles.notice}>
          Бой на {fightHand === 'Right' ? 'правую' : 'левую'} руку. Показана статистика{' '}
          {hand === 'Right' ? 'правой' : 'левой'} — для контекста.
        </Text>
      ) : null}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.text }]} />
          <Text style={styles.legendText}>{a.last}</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={[styles.legendText, { color: fc.second }]}>{b.last}</Text>
          <View style={[styles.swatch, { backgroundColor: fc.barB }]} />
        </View>
      </View>

      {blocks.map((blk) => (
        <View key={blk.title} style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.blockTitle}>{blk.title}</Text>
            {blk.mode ? (
              <Toggle
                small
                options={[
                  { key: 'win', label: 'Винрейт' },
                  { key: 'rounds', label: 'Раунды' },
                ]}
                value={gripMode}
                onChange={(k) => onChange({ gripMode: k as 'win' | 'rounds' })}
              />
            ) : null}
            {blk.info ? <InfoButton onPress={() => onInfo(blk.info!)} label={blk.title} /> : null}
          </View>
          {blk.sub ? <Text style={styles.sub}>{blk.sub}</Text> : null}
          {blk.rows?.map((r, i) => (
            <MirrorRow key={r.label} row={r} last={i === blk.rows!.length - 1} />
          ))}
        </View>
      ))}

      {extra === 'ratings' ? <Ratings items={rt} /> : null}
      {extra === 'ci' ? <Intervals items={ci} /> : null}

      {hasSmall ? (
        <Pressable onPress={() => onInfo(INFO.small)} style={styles.small}>
          <View style={styles.dot} />
          <Text style={styles.smallText}>Меньше 5 раундов — процент ненадёжен</Text>
        </Pressable>
      ) : null}

      {!expert ? (
        <Pressable onPress={() => onChange({ expert: true })} style={styles.hint}>
          <Text style={styles.hintText}>
            Ещё 4 раздела в режиме «Эксперт»: опыт, доминирование, флешпины и фолы, сила оппозиции →
          </Text>
        </Pressable>
      ) : null}

      <Text style={styles.footer}>
        Cold Arms · {finished ? (asOf ? 'данные на момент боя' : 'данные на сегодня') : 'данные до боя'} · статистика рук
        не смешивается
      </Text>
    </View>
  );
}

function Ratings({ items }: { items: Rating[] }) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <Text style={styles.blockTitle}>Физические оценки</Text>
        <Text style={styles.outOf}>из 10</Text>
      </View>
      {items.map((q, i) => (
        <View key={q.name} style={[styles.rating, i < items.length - 1 && styles.ratingBorder]}>
          <View style={styles.ratingTop}>
            <Text style={styles.ratingValue}>{q.a ?? '—'}</Text>
            <Text style={styles.ratingName}>{q.name}</Text>
            <Text style={[styles.ratingValue, styles.right, { color: fc.second }]}>{q.b ?? '—'}</Text>
          </View>
          <View style={styles.ratingBars}>
            <View style={[styles.ratingTrack, styles.trackLeft]}>
              <View style={[styles.ratingFill, { width: `${(q.a ?? 0) * 10}%`, backgroundColor: colors.text }]} />
            </View>
            <View style={styles.ratingTrack}>
              <View style={[styles.ratingFill, { width: `${(q.b ?? 0) * 10}%`, backgroundColor: fc.barB }]} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function Intervals({ items }: { items: Interval[] | null }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>Доверительный интервал винрейта</Text>
      <Text style={styles.sub}>95% · вся карьера на эту руку</Text>
      {!items ? (
        <Text style={styles.empty}>Нет данных: выборка слишком мала</Text>
      ) : (
        <View style={styles.ciList}>
          {items.map((c) => (
            <View key={c.name}>
              <View style={styles.ciHead}>
                <Text style={[styles.ciName, c.second && { color: fc.second }]}>{c.name}</Text>
                <Text style={[styles.ciValue, c.second && { color: fc.second }]}>
                  {Math.round(c.p * 10) / 10}%
                  <Text style={styles.ciRange}>
                    {' '}
                    · {Math.round(c.lo)}–{Math.round(c.hi)}%
                  </Text>
                </Text>
              </View>
              <View style={styles.ciTrack}>
                <View
                  style={[
                    styles.ciBand,
                    {
                      left: `${c.lo}%`,
                      width: `${Math.max(c.hi - c.lo, 1)}%`,
                      backgroundColor: c.second ? 'rgba(142,143,150,0.35)' : 'rgba(244,244,245,0.3)',
                    },
                  ]}
                />
                <View style={styles.ciMid} />
                <View style={[styles.ciPoint, { left: `${c.p}%`, backgroundColor: c.second ? fc.second : colors.text }]} />
              </View>
            </View>
          ))}
          <View style={styles.ciAxis}>
            <Text style={styles.axis}>0%</Text>
            <Text style={styles.axis}>50%</Text>
            <Text style={styles.axis}>100%</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function Toggle<K extends string>({
  options,
  value,
  onChange,
  small,
  stretch,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  small?: boolean;
  stretch?: boolean;
}) {
  return (
    <View style={[styles.toggle, small && styles.toggleSmall, stretch && styles.toggleStretch]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.toggleItem, small && styles.toggleItemSmall, stretch && styles.flex, on && styles.toggleOn]}>
            <Text style={[styles.toggleText, small && styles.toggleTextSmall, on && styles.toggleTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 28 },
  flex: { flex: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: fc.card,
    borderWidth: 1,
    borderColor: fc.border,
    borderRadius: radii.control,
    padding: 3,
  },
  toggleSmall: { padding: 2, borderRadius: radii.small + 2 },
  toggleStretch: { alignSelf: 'stretch' },
  toggleItem: { height: 34, paddingHorizontal: 12, borderRadius: radii.small, alignItems: 'center', justifyContent: 'center' },
  toggleItemSmall: { height: 28, paddingHorizontal: 10, borderRadius: 6 },
  toggleOn: { backgroundColor: colors.light },
  toggleText: { fontFamily: fonts.bodySemi, fontSize: 13, color: fc.second },
  toggleTextSmall: { fontSize: 12 },
  toggleTextOn: { color: colors.lightText },
  expert: {
    height: 42,
    paddingLeft: 12,
    paddingRight: 4,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: fc.border,
    backgroundColor: fc.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expertText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  asOf: { marginTop: 8 },
  catsScroll: { marginTop: 10, marginHorizontal: -16 },
  cats: { gap: 6, paddingHorizontal: 16 },
  cat: {
    height: 38,
    paddingHorizontal: 13,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: fc.border,
    backgroundColor: fc.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catOn: { borderColor: colors.accent, backgroundColor: fc.coralBg },
  catText: { fontFamily: fonts.bodySemi, fontSize: 13, color: fc.soft },
  catTextOn: { color: fc.coral },
  expDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
  notice: {
    marginTop: 10,
    padding: 12,
    borderRadius: radii.control,
    backgroundColor: '#17171A',
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
    color: fc.second,
  },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, marginHorizontal: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.text },
  block: { marginTop: 18 },
  blockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginHorizontal: 2 },
  blockTitle: { flex: 1, fontFamily: fonts.display, fontSize: 19, textTransform: 'uppercase', color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 12, color: fc.muted, marginTop: 4, marginHorizontal: 2 },
  outOf: { fontFamily: fonts.bodyMedium, fontSize: 11, color: fc.muted },
  rating: { paddingVertical: 10, paddingHorizontal: 2 },
  ratingBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: fc.line },
  ratingTop: { flexDirection: 'row', alignItems: 'baseline' },
  ratingValue: { width: 44, fontFamily: fonts.display, fontSize: 17, color: colors.text },
  right: { textAlign: 'right' },
  ratingName: { flex: 1, textAlign: 'center', fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.second },
  ratingBars: { flexDirection: 'row', gap: 4, marginTop: 6 },
  ratingTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: fc.track, overflow: 'hidden' },
  trackLeft: { flexDirection: 'row', justifyContent: 'flex-end' },
  ratingFill: { height: '100%', borderRadius: 2 },
  empty: { fontFamily: fonts.body, fontSize: 13, color: fc.muted, marginTop: 10, marginHorizontal: 2 },
  ciList: { gap: 14, marginTop: 12 },
  ciHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  ciName: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  ciValue: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  ciRange: { fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.muted },
  ciTrack: { height: 14, marginTop: 6, borderRadius: 7, backgroundColor: fc.chip },
  ciBand: { position: 'absolute', top: 0, bottom: 0, borderRadius: 7 },
  ciMid: { position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1, backgroundColor: '#3A3B40' },
  ciPoint: { position: 'absolute', top: -3, bottom: -3, width: 3, marginLeft: -1.5, borderRadius: 2 },
  ciAxis: { flexDirection: 'row', justifyContent: 'space-between' },
  axis: { fontFamily: fonts.bodyMedium, fontSize: 11, color: fc.dim },
  small: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  smallText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.second },
  hint: {
    marginTop: 18,
    padding: 14,
    borderRadius: radii.control,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: fc.borderStrong,
  },
  hintText: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: fc.soft },
  footer: { marginTop: 22, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: '#5E5F66' },
});
