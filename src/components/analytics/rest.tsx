import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatPct, restLabel, restMonths, type RestAnalytics, type RestBucket, type RestCrossTable } from '@/api/analytics';
import { AthleteRow, BarRow, Block, Note, ShowMore, styles as kit } from '@/components/analytics/kit';
import { fc } from '@/components/fight/palette';
import { plural } from '@/lib/format';
import { fitText, SMALL_TEXT_SCALE } from '@/lib/text';
import { colors, fonts, radii } from '@/theme/tokens';

const FEW = 10;
const fights = (n: number) => `${n} ${plural(n, ['бой', 'боя', 'боёв'])}`;

const TABLE_TITLES: Record<string, string> = {
  weightByBand: 'Вес × перерыв',
  ageByBand: 'Возраст × перерыв',
  weightByBucket: 'Вес × полная шкала',
};

/** Винрейт по интервалам: полоса от 0 до 100% с отметкой 50%; мало боёв — приглушено. */
function Buckets({ list }: { list: RestBucket[] }) {
  return list.map((b) => (
    <BarRow
      key={b.key}
      label={restLabel(b.key, b.label)}
      value={formatPct(b.winRate)}
      sub={fights(b.n)}
      fraction={(b.winRate ?? 0) / 100}
      marker
      dim={!b.isReliable}
    />
  ));
}

/** «Простои»: влияет ли перерыв между боями на результат. */
export function RestSection({ data }: { data: RestAnalytics }) {
  const [all, setAll] = useState(false);
  const [tables, setTables] = useState(false);
  const p = data.paired;
  const athletes = all ? data.athletes : data.athletes.slice(0, FEW);

  return (
    <View style={{ gap: 12 }}>
      <Block title="Кто побеждает">
        <View style={styles.trio}>
          {(
            [
              [p.restedWon, 'отдыхал дольше'],
              [p.inRhythmWon, 'был в ритме'],
              [p.equalRest, 'равный перерыв'],
            ] as const
          ).map(([n, label]) => (
            <View key={label} style={styles.trioCell}>
              <Text style={kit.kpiValue} maxFontSizeMultiplier={SMALL_TEXT_SCALE}>
                {n}
              </Text>
              <Text style={kit.kpiLabel} numberOfLines={2}>
                {label}
              </Text>
            </View>
          ))}
        </View>
        <Note>
          Тот, кто отдыхал дольше соперника, выиграл {formatPct(p.restedSharePct)} боёв с разным перерывом.
        </Note>
      </Block>

      <Block title="По разрыву в перерыве" note="Черта на полосе — 50%. Бледным — мало боёв, вывод ненадёжен.">
        <Buckets list={data.gapSpread} />
      </Block>

      <Block title="Винрейт по длине перерыва">
        <Buckets list={data.buckets} />
      </Block>

      <Block title="Перерывы и результаты по атлетам">
        {athletes.map((a) => (
          <AthleteRow
            key={a.armWrestlerId}
            id={a.armWrestlerId}
            name={a.fullName}
            country={a.country}
            sub={`Выходит раз в ${restMonths(a.medianRestDays)} · ${fights(a.fights)}`}
            right={formatPct(a.winRate)}
            rightSub="побед"
          />
        ))}
        {data.athletes.length > FEW ? (
          <ShowMore expanded={all} total={data.athletes.length} onPress={() => setAll((v) => !v)} />
        ) : null}
      </Block>

      <Block
        title="Разрезы по весу и возрасту"
        note="Бледным — мало боёв, вывод ненадёжен. Перерыв считается между поединками на East vs West и King of the Table — выступления на других турнирах в этих данных не отражены.">
        {tables ? data.crossTables.map((t) => <CrossTable key={t.key} table={t} />) : null}
        <Pressable onPress={() => setTables((v) => !v)} style={kit.more} hitSlop={6}>
          <Text style={kit.moreText}>{tables ? 'Свернуть' : 'Показать таблицы'}</Text>
        </Pressable>
      </Block>
    </View>
  );
}

/**
 * Перекрёстная таблица винрейта. Широкую (шесть интервалов) переворачиваем: на телефоне
 * длинный столбец читается лучше, чем шесть узких колонок.
 */
function CrossTable({ table }: { table: RestCrossTable }) {
  const wide = table.columns.length > 3;
  const colKeys = table.rows[0]?.cells.map((c) => c.key) ?? [];
  // Без переворота: строки — группы (вес/возраст), колонки — интервалы перерыва.
  const head = wide ? table.rows.map((r) => restLabel(r.key, r.group)) : colKeys.map((k, i) => restLabel(k, table.columns[i]));
  const rows = wide
    ? colKeys.map((k, ci) => ({ key: k, label: restLabel(k, table.columns[ci]), cells: table.rows.map((r) => r.cells[ci]) }))
    : table.rows.map((r) => ({ key: r.key, label: restLabel(r.key, r.group), cells: r.cells }));

  return (
    <View style={styles.table}>
      <Text style={styles.tableTitle}>{TABLE_TITLES[table.key] ?? table.rowLabel}</Text>
      <View style={styles.tr}>
        <View style={styles.th0} />
        {head.map((h) => (
          <Text key={h} style={styles.th} numberOfLines={2} maxFontSizeMultiplier={SMALL_TEXT_SCALE}>
            {h}
          </Text>
        ))}
      </View>
      {rows.map((r) => (
        <View key={r.key} style={styles.tr}>
          <Text style={styles.rowLabel} numberOfLines={2} {...fitText}>
            {r.label}
          </Text>
          {r.cells.map((c, i) => (
            <View key={i} style={[styles.cell, c && !c.isReliable && kit.dim]}>
              <Text style={styles.cellValue} maxFontSizeMultiplier={SMALL_TEXT_SCALE} numberOfLines={1} {...fitText}>
                {c ? formatPct(c.winRate) : '—'}
              </Text>
              {c ? (
                <Text style={styles.cellSub} maxFontSizeMultiplier={SMALL_TEXT_SCALE}>
                  {fights(c.n)}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  trio: { flexDirection: 'row', gap: 8 },
  trioCell: { flex: 1 },
  table: { gap: 6, marginTop: 4 },
  tableTitle: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  th0: { width: 76 },
  th: { flex: 1, fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, textAlign: 'center' },
  rowLabel: { width: 76, fontFamily: fonts.bodyMedium, fontSize: 11, color: fc.soft },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: radii.small,
    backgroundColor: colors.row,
  },
  cellValue: { fontFamily: fonts.display, fontSize: 15, color: colors.text },
  cellSub: { fontFamily: fonts.body, fontSize: 9, color: colors.textMuted },
});
