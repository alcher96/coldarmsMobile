import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  loadMiraAnalysis,
  loadVotes,
  VOTE_OUTCOMES,
  voteFight,
  votingOpen,
  type FightPage,
  type Hand,
  type Round,
  type VoteStats,
} from '@/api/fight';
import { plural } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

import { CommentsCard } from './comments';
import { InfoButton, type Block, type Info } from './info-sheet';
import { MiraButton } from './mira-button';
import { MirrorRow } from './mirror-row';
import {
  confidenceLevel,
  formRows,
  INFO,
  mainMatchup,
  matrixView,
  miraHeadline,
  upsetLevel,
  type Side,
} from './model';
import { fc } from './palette';

type Props = {
  data: FightPage;
  a: Side;
  b: Side;
  onInfo: (info: Info) => void;
  onCompareForm: () => void;
  onStyles: () => void;
};

export function Overview({ data, a, b, onInfo, onCompareForm, onStyles }: Props) {
  const hand: Hand = data.fight.hand === 'Left' ? 'Left' : 'Right';
  const rows = formRows(data.statsA, data.statsB, hand).filter((r) => r.label !== 'Тренд формы' || r.l !== '—');
  const finished = data.rounds.length > 0 && !!data.fight.winnerName && data.fight.winnerName !== 'Draw';
  return (
    <View style={styles.list}>
      {finished ? <ResultCard data={data} a={a} b={b} /> : null}
      {data.mira ? (
        <MiraCard
          data={data}
          a={a}
          b={b}
          onInfo={onInfo}
          onStyles={onStyles}
          finished={finished}
          past={finished || !votingOpen(data.competition)}
        />
      ) : null}
      <View style={[styles.card, styles.formCard]}>
        {rows.map((r, i) => (
          <MirrorRow key={r.label} row={r} last={i === rows.length - 1} />
        ))}
        <Pressable onPress={onCompareForm} style={styles.more}>
          <Text style={styles.moreText}>Полное сравнение →</Text>
        </Pressable>
      </View>
      <VoteCard data={data} a={a} b={b} />
      <CommentsCard fightId={data.fight.fightId} initial={data.comments} />
    </View>
  );
}

// ── Итог завершённого боя ──

const gripShort = (r: Round) =>
  r.isStrapAndRefereeGrip || r.isStrapAndFreeGrip ? 'Рем.' : r.isRefereeGrip ? 'Суд.' : r.isFreeGrip ? 'Своб.' : '—';
const gripLong = (r: Round) =>
  r.isStrapAndRefereeGrip
    ? 'Судейский + ремни'
    : r.isStrapAndFreeGrip
      ? 'Свободный + ремни'
      : r.isRefereeGrip
        ? 'Судейский захват'
        : r.isFreeGrip
          ? 'Свободный захват'
          : null;

function ResultCard({ data, a, b }: { data: FightPage; a: Side; b: Side }) {
  const [sel, setSel] = useState(0);
  const { fight, rounds } = data;
  const aWon = fight.winnerName === fight.wrestler1Name;
  const winner = aWon ? a : b;
  const score = aWon ? `${data.w1Score}–${data.w2Score}` : `${data.w2Score}–${data.w1Score}`;
  const r = rounds[sel];
  const rWinner = r?.winnerName === fight.wrestler1Name ? a.last : r?.winnerName === fight.wrestler2Name ? b.last : null;
  const detail = r
    ? [gripLong(r), r.styleUsed, rWinner, r.isFlashPin ? 'флешпин' : null, r.isWinnerByFouls ? 'по фолам' : null]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <View style={styles.card}>
      <View style={[styles.rowBetween, styles.baseline]}>
        <Text style={styles.cardTitle}>
          {winner.last} победил {score}
        </Text>
        <Text style={styles.meta}>
          {rounds.length} {plural(rounds.length, ['раунд', 'раунда', 'раундов'])}
        </Text>
      </View>
      <View style={styles.rounds}>
        {rounds.map((x, i) => {
          const isA = x.winnerName === fight.wrestler1Name;
          return (
            <Pressable
              key={x.roundNumber}
              onPress={() => setSel(i)}
              style={[styles.round, isA ? styles.roundA : styles.roundB, sel === i && styles.roundOn]}>
              <Text style={[styles.roundN, isA && { color: colors.lightText }]}>R{x.roundNumber}</Text>
              <Text style={[styles.roundG, isA && { color: colors.lightText }]}>{gripShort(x)}</Text>
            </Pressable>
          );
        })}
      </View>
      {r ? (
        <Text style={styles.roundDetail}>
          Раунд {r.roundNumber} · {detail}
        </Text>
      ) : null}
    </View>
  );
}

// ── Прогноз M.I.R.A. ──

function MiraCard({
  data,
  a,
  b,
  onInfo,
  onStyles,
  finished,
  past,
}: Omit<Props, 'onCompareForm'> & { finished: boolean; past: boolean }) {
  const [layersOpen, setLayersOpen] = useState(false);
  const m = data.mira!;
  const leader = m.w1Pct >= m.w2Pct ? a : b;
  const underdog = leader === a ? b : a;
  const leaderPct = Math.max(m.w1Pct, m.w2Pct);
  const fightId = data.fight.fightId;
  const conf = confidenceLevel(m.confidencePct);
  const upset = upsetLevel(m.upsetPct);
  const matchup = mainMatchup(matrixView(data));
  const winnerIsA = data.fight.winnerName === data.fight.wrestler1Name;
  const hit = finished && winnerIsA === m.w1Pct >= m.w2Pct;
  // Шкала: слева 100% за первого, справа — за второго; ромб — где стоит прогноз.
  const pick = 100 - m.w1Pct;

  const tiles: { v: string; l: string; c: string; info: Info }[] = [
    { v: `${m.confidencePct}%`, l: conf.label, c: conf.color, info: INFO.conf(m.confidencePct) },
    { v: `${m.upsetPct}%`, l: upset.label, c: upset.color, info: INFO.upset(m.upsetPct, underdog.last, leaderPct) },
  ];
  if (m.reliability) {
    const n = m.reliability.sampleSize;
    tiles.push({
      v: `${m.reliability.accuracy}%`,
      l: `Надёжность · ${n} ${plural(n, ['бой', 'боя', 'боёв'])}`,
      c: fc.second,
      info: INFO.hist(m.reliability.accuracy, n),
    });
  }

  // Разбор от языковой модели: на сайте закрыт для гостей, в приложении пользователь всегда вошёл.
  const why: Info = {
    title: 'Разбор M.I.R.A.',
    body: async () => {
      const text = await loadMiraAnalysis(fightId);
      if (!text) return ['Разбор этого боя ещё не готов. Загляните позже.'];
      return parseAnalysis(text);
    },
  };

  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.kicker}>M.I.R.A. · ПРОГНОЗ</Text>
        {finished ? (
          <Text style={[styles.badge, hit ? styles.badgeHit : styles.badgeMiss]}>
            {hit ? 'Прогноз сбылся' : 'Прогноз не сбылся'}
          </Text>
        ) : (
          <InfoButton onPress={() => onInfo(INFO.mira)} label="Прогноз M.I.R.A." />
        )}
      </View>
      <Text style={styles.headline}>{miraHeadline(leader.last, Math.abs(m.w1Pct - m.w2Pct))}</Text>

      <View style={styles.scale}>
        <Text style={[styles.pickLabel, { left: `${pick}%` }]}>◆ MIRA PICK</Text>
        <View style={styles.scaleTrack}>
          <View
            style={[
              styles.scaleBand,
              { left: `${Math.min(pick, 50)}%`, width: `${Math.abs(50 - pick)}%` },
            ]}
          />
        </View>
        <View style={styles.scaleMid} />
        <View style={[styles.diamond, { left: `${pick}%` }]} />
      </View>
      <View style={styles.scaleLabels}>
        <Text style={styles.scaleLabel}>100% {a.last}</Text>
        <Text style={styles.scaleLabel}>50/50</Text>
        <Text style={styles.scaleLabel}>100% {b.last}</Text>
      </View>
      <View style={[styles.rowBetween, styles.pcts]}>
        <Text style={[styles.pct, m.w1Pct < m.w2Pct && styles.pctDim]}>{m.w1Pct}%</Text>
        <Text style={styles.edge}>Перевес {Math.abs(m.w1Pct - m.w2Pct)}%</Text>
        <Text style={[styles.pct, m.w2Pct < m.w1Pct && styles.pctDim]}>{m.w2Pct}%</Text>
      </View>

      <View style={styles.tiles}>
        {tiles.map((t) => (
          <Pressable key={t.l} onPress={() => onInfo(t.info)} style={styles.tile}>
            <View style={styles.tileTop}>
              <View style={[styles.tileDot, { backgroundColor: t.c }]} />
              <Text style={styles.tileValue}>{t.v}</Text>
            </View>
            <Text style={[styles.tileLabel, { color: t.c }]}>{t.l}</Text>
          </Pressable>
        ))}
      </View>

      {m.layers.length ? (
        <>
          <Pressable onPress={() => setLayersOpen((v) => !v)} style={styles.line}>
            <Text style={styles.lineText}>Слои прогноза</Text>
            <View style={styles.lineRight}>
              <Text style={styles.lineMeta}>{m.layers.map((l) => l.name.replace('.', '')).join(' · ')}</Text>
              <View style={layersOpen && styles.flip}>
                <ChevronDown size={16} color={fc.muted} strokeWidth={1.8} />
              </View>
            </View>
          </Pressable>
          {layersOpen ? (
            <View style={styles.layers}>
              <View style={styles.rowBetween}>
                <Text style={styles.scaleLabel}>← {a.last}</Text>
                <InfoButton onPress={() => onInfo(INFO.layers)} label="Слои прогноза" />
                <Text style={styles.scaleLabel}>{b.last} →</Text>
              </View>
              {m.layers.map((l) => (
                <View key={l.name} style={styles.layer}>
                  <Text style={styles.layerName}>{l.name}</Text>
                  <View style={styles.layerBar}>
                    <View style={[styles.layerA, { width: `${l.pct}%` }]}>
                      {l.pct >= 18 ? <Text style={styles.layerAText}>{l.pct}%</Text> : null}
                    </View>
                    <View style={styles.layerB}>
                      {100 - l.pct >= 18 ? <Text style={styles.layerBText}>{100 - l.pct}%</Text> : null}
                    </View>
                    <View style={styles.layerMid} />
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {matchup ? (
        <Pressable onPress={onStyles} style={styles.line}>
          <Text style={styles.lineText}>Матрица стилей</Text>
          <View style={styles.lineRight}>
            <Text style={styles.lineMeta} numberOfLines={1}>
              {matchup.stronger} › {matchup.weaker} {matchup.hi}/{matchup.lo}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>
      ) : null}

      {/* Разбор нужен до боя; у прошедших боёв его не показываем. */}
      {!past ? <MiraButton onPress={() => onInfo(why)} /> : null}
    </View>
  );
}

/**
 * Разбор M.I.R.A. приходит markdown-подобным текстом: «## Заголовок», «**Заголовок**»,
 * пункты «◆ …» / «- …», а иногда заголовок — просто короткая строка без точки перед абзацем.
 */
function parseAnalysis(text: string): Block[] {
  const lines = text.split('\n').map((l) => l.trim());
  const blocks: Block[] = [];
  lines.forEach((line, i) => {
    if (!line) return;
    const heading = line.match(/^#{1,6}\s+(.+)$/) ?? line.match(/^\*\*([^*]+)\*\*:?$/);
    if (heading) {
      blocks.push({ h: heading[1].replace(/:$/, '') });
      return;
    }
    const bullet = line.match(/^(?:[◆•▪●◇*-]|\d+[.)])\s+(.+)$/);
    if (bullet) {
      blocks.push({ li: bullet[1] });
      return;
    }
    const next = lines[i + 1];
    if (line.length <= 60 && !/[.!?:;,…»)%]$/.test(line) && next) blocks.push({ h: line });
    else blocks.push(line);
  });
  return blocks;
}

// ── Голосование ──

/** Цвета сегментов распределения: от уверенной победы первого к уверенной победе второго. */
const SEG_A = ['#F4F4F5', '#B9BAC0', '#8E8F96', '#6E6F76'];
const SEG_B = ['#2C2D31', '#3E3F44', '#55565C', '#4A4B50'];

/** Прогноз пользователя в два шага: кто победит → как закончится бой. */
function VoteCard({ data, a, b }: { data: FightPage; a: Side; b: Side }) {
  const fightId = data.fight.fightId;
  const open = votingOpen(data.competition);
  const [stats, setStats] = useState<VoteStats | null>(data.votes);
  const [side, setSide] = useState<Side | null>(null);
  const [mine, setMine] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const send = async (outcome: number) => {
    if (!side) return;
    setSending(true);
    setMessage(null);
    try {
      const res = await voteFight(fightId, side.id, outcome);
      if (res.ok) {
        setMine(`${side.id}:${VOTE_OUTCOMES[outcome].key}`);
        setStats((await loadVotes(fightId).catch(() => null)) ?? stats);
      } else {
        setMessage(res.status === 403 ? 'Подтвердите почту, чтобы голосовать' : 'Вы уже голосовали за этот бой');
        setSide(null);
      }
    } catch {
      setMessage('Нет связи. Попробуйте ещё раз');
    } finally {
      setSending(false);
    }
  };

  const s1 = stats?.wrestler1Stats;
  const s2 = stats?.wrestler2Stats;
  const total = (s1?.totalVotes ?? 0) + (s2?.totalVotes ?? 0);
  const segs = total
    ? [
        ...VOTE_OUTCOMES.map((o, i) => ({ key: `${a.id}:${o.key}`, label: `${a.last} · ${o.label.toLowerCase()}`, n: s1?.outcomeCounts?.[o.key] ?? 0, c: SEG_A[i] })),
        ...VOTE_OUTCOMES.map((o, i) => ({ key: `${b.id}:${o.key}`, label: `${b.last} · ${o.label.toLowerCase()}`, n: s2?.outcomeCounts?.[o.key] ?? 0, c: SEG_B[3 - i] })).reverse(),
      ].filter((s) => s.n > 0)
    : [];
  const segTotal = segs.reduce((n, s) => n + s.n, 0) || total;
  const p1 = total ? Math.round(((s1?.totalVotes ?? 0) / total) * 100) : 50;
  const showResults = !!mine || !open;

  const meta = showResults
    ? total
      ? `${total} ${plural(total, ['голос', 'голоса', 'голосов'])}`
      : ''
    : side
      ? `${side.last} — как?`
      : 'отдельно от M.I.R.A.';

  return (
    <View style={styles.card}>
      <View style={[styles.rowBetween, styles.baseline]}>
        <Text style={styles.cardTitle}>{open ? 'Ваш прогноз' : 'Голоса сообщества'}</Text>
        <Text style={styles.meta}>{meta}</Text>
      </View>

      {!showResults && !side ? (
        <View style={styles.voteBtns}>
          {[a, b].map((s) => (
            <Pressable key={s.id} onPress={() => setSide(s)} style={styles.voteBtn}>
              <Text style={styles.voteBtnText} numberOfLines={1}>
                {s.last}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {!showResults && side ? (
        <View style={styles.outcomes}>
          {VOTE_OUTCOMES.map((o, i) => (
            <Pressable key={o.key} onPress={() => send(i)} disabled={sending} style={styles.outcome}>
              <Text style={styles.outcomeText}>{o.label}</Text>
              <Text style={styles.outcomeHint}>{o.hint}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setSide(null)} disabled={sending} style={styles.back}>
            <Text style={styles.backText}>← Выбрать другого бойца</Text>
          </Pressable>
          {sending ? <ActivityIndicator color={colors.text} /> : null}
        </View>
      ) : null}

      {message ? <Text style={styles.error}>{message}</Text> : null}

      {showResults && total > 0 ? (
        <View style={styles.results}>
          <View style={styles.rowBetween}>
            <Text style={styles.resBig}>
              {a.last} {p1}%
            </Text>
            <Text style={[styles.resBig, { color: fc.second }]}>
              {100 - p1}% {b.last}
            </Text>
          </View>
          <View style={styles.segBar}>
            {segs.map((s) => (
              <View key={s.key} style={{ width: `${(s.n / segTotal) * 100}%`, backgroundColor: s.c }} />
            ))}
          </View>
          <View style={styles.legend}>
            {segs.map((s) => (
              <View key={s.key} style={styles.legendRow}>
                <View style={[styles.legendSwatch, { backgroundColor: s.c }]} />
                <Text style={[styles.legendText, mine === s.key && { color: colors.text }]}>{s.label}</Text>
                <Text style={styles.legendPct}>{Math.round((s.n / segTotal) * 100)}%</Text>
                {mine === s.key ? <Text style={styles.you}>ты</Text> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {showResults && total === 0 ? <Text style={styles.note}>Пока никто не сделал прогноз</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 28, gap: 10 },
  card: { backgroundColor: fc.card, borderWidth: 1, borderColor: fc.border, borderRadius: radii.card, padding: 16 },
  formCard: { paddingTop: 6, paddingBottom: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  baseline: { alignItems: 'baseline' },
  kicker: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 1, color: fc.muted },
  headline: { fontFamily: fonts.display, fontSize: 22, lineHeight: 24, textTransform: 'uppercase', color: colors.text, marginTop: 8 },
  badge: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.small,
    overflow: 'hidden',
  },
  badgeHit: { backgroundColor: 'rgba(61,190,122,0.14)', color: '#5FD99A' },
  badgeMiss: { backgroundColor: fc.coralBg, color: fc.coral },

  scale: { marginTop: 32, height: 10, justifyContent: 'center' },
  scaleTrack: { height: 10, borderRadius: 5, backgroundColor: '#2A2B30', overflow: 'hidden' },
  scaleBand: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.text },
  scaleMid: { position: 'absolute', left: '50%', top: -4, bottom: -4, width: 2, marginLeft: -1, backgroundColor: fc.dim },
  diamond: {
    position: 'absolute',
    top: -1,
    width: 12,
    height: 12,
    marginLeft: -6,
    backgroundColor: colors.text,
    borderWidth: 2,
    borderColor: fc.card,
    transform: [{ rotate: '45deg' }],
  },
  pickLabel: {
    position: 'absolute',
    top: -24,
    width: 90,
    marginLeft: -45,
    textAlign: 'center',
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.text,
  },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  scaleLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: fc.dim },
  pcts: { marginTop: 12, alignItems: 'flex-end' },
  pct: { fontFamily: fonts.display, fontSize: 36, lineHeight: 38, color: colors.text },
  pctDim: { color: fc.dim },
  edge: { fontFamily: fonts.bodySemi, fontSize: 13, color: fc.soft, marginBottom: 6 },

  tiles: { flexDirection: 'row', gap: 6, marginTop: 14 },
  tile: { flex: 1, backgroundColor: fc.chip, borderRadius: radii.control, paddingVertical: 9, paddingHorizontal: 10 },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileDot: { width: 7, height: 7, borderRadius: 4 },
  tileValue: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  tileLabel: { fontFamily: fonts.bodySemi, fontSize: 11, lineHeight: 14, marginTop: 5 },

  line: {
    height: 46,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: fc.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  lineText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  lineRight: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineMeta: { flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.muted },
  flip: { transform: [{ rotate: '180deg' }] },
  chevron: { fontSize: 20, color: fc.dim },
  layers: { paddingBottom: 4 },
  layer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  layerName: { width: 80, fontFamily: fonts.bodySemi, fontSize: 13, color: fc.soft },
  layerBar: { flex: 1, height: 22, flexDirection: 'row', gap: 2, borderRadius: 6, overflow: 'hidden' },
  layerA: { backgroundColor: colors.text, justifyContent: 'center', paddingLeft: 6 },
  layerAText: { fontFamily: fonts.display, fontSize: 12, color: colors.lightText },
  layerB: { flex: 1, backgroundColor: '#3A3B40', justifyContent: 'center', alignItems: 'flex-end', paddingRight: 6 },
  layerBText: { fontFamily: fonts.display, fontSize: 12, color: fc.soft },
  layerMid: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: colors.bg, opacity: 0.6 },

  more: { height: 46, justifyContent: 'center' },
  moreText: { fontFamily: fonts.bodySemi, fontSize: 13, color: fc.coral },
  cardTitle: { flexShrink: 1, fontFamily: fonts.display, fontSize: 18, textTransform: 'uppercase', color: colors.text },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.muted },
  note: { fontFamily: fonts.body, fontSize: 13, color: fc.muted, marginTop: 12 },

  rounds: { flexDirection: 'row', gap: 4, marginTop: 12 },
  round: {
    flex: 1,
    height: 58,
    borderRadius: radii.small,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  roundA: { backgroundColor: colors.light },
  roundB: { backgroundColor: '#3A3B40' },
  roundOn: { borderColor: colors.accent },
  roundN: { fontFamily: fonts.display, fontSize: 15, color: colors.text },
  roundG: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.text, opacity: 0.8 },
  roundDetail: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: fc.soft, marginTop: 10 },

  voteBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  voteBtn: {
    flex: 1,
    height: 50,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: fc.borderStrong,
    backgroundColor: fc.chip,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  voteBtnText: { fontFamily: fonts.display, fontSize: 15, textTransform: 'uppercase', color: colors.text },
  outcomes: { gap: 6, marginTop: 12 },
  outcome: {
    height: 48,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: fc.borderStrong,
    backgroundColor: fc.chip,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  outcomeText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  outcomeHint: { fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.muted },
  back: { paddingVertical: 6 },
  backText: { fontFamily: fonts.bodySemi, fontSize: 12, color: fc.muted },
  error: { fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.coral, marginTop: 10 },
  results: { marginTop: 12 },
  resBig: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  segBar: { flexDirection: 'row', gap: 2, height: 10, marginTop: 8, borderRadius: 5, overflow: 'hidden' },
  legend: { gap: 6, marginTop: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: fc.soft },
  legendPct: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  you: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    color: colors.text,
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
});
