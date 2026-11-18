import { DAYS, type Exercise, type Plan, type WeekLoad } from './types';

/** Отметка упражнения за неделю плана. done=false — не сделал; числа — фактически сделанное (режим слежения). */
export type Log = { done: boolean; sets?: number; reps?: number; weight?: number | null };

/** Режимы: simple — «сделал / не сделал»; track — вписываешь сделанное, веса следующих недель подстраиваются. */
export type TrackMode = 'simple' | 'track';

export type ActivePlan = {
  analysis: string;
  plan: Plan;
  mode: TrackMode;
  started: string; // дата начала, ISO
  logs: Record<string, Log>; // ключ — logKey
};

export const logKey = (wk: number, day: string, i: number) => `${wk}|${day}|${i}`;

const round = (w: number) => (w < 10 ? Math.round(w * 2) / 2 : Math.round(w));

/** Не добил: повторов (секунд) или подходов меньше, чем по плану. Меньший вес с полными повторами — не недобор:
 * дальше просто веса от сделанного. */
const short = (log: Log, l: WeekLoad) => (log.reps ?? l.reps) < l.reps || (log.sets ?? l.sets) < l.sets;

/**
 * Числа упражнения по неделям с учётом сделанного (правило плана: прошло чисто — вес плана; не добил — вес прошлой
 * недели). Сделанный вес сдвигает всю дальнейшую кривую: поднял меньше плана — следующие недели ниже, больше — выше.
 * Не сделал — ничего не меняется.
 */
export function adjustedWeeks(e: Exercise, day: string, i: number, plan: Plan, logs: Record<string, Log>): WeekLoad[] | null {
  if (!e.weeks) return null;
  let factor = 1;
  let prev: { wk: number; kind: string; weight: number | null; short: boolean } | null = null;
  return e.weeks.map((l, wk) => {
    const kind = plan.weeks[wk]?.kind;
    let weight = l.weight ? round(l.weight * factor) : null;
    let hint = l.hint;
    if (prev?.short && prev.weight && prev.kind === kind && weight) {
      // не добил — тот же вес, пока неделя этой фазы не пройдёт чисто
      weight = Math.min(weight, prev.weight);
      hint = `на ${prev.wk + 1}-й неделе не добил — вес тот же`;
    } else if (!l.weight && prev?.weight) {
      hint = `в прошлый раз ${prev.weight} кг`;
    }
    const out = { ...l, weight, hint };
    const log = logs[logKey(wk, day, i)];
    if (log?.done) {
      if (log.weight && l.weight) factor = log.weight / l.weight;
      prev = { wk, kind, weight: log.weight ?? weight, short: short(log, out) };
    }
    return out;
  });
}

/** Все упражнения недели плана: [день, индекс, упражнение]. */
export const planItems = (plan: Plan) =>
  DAYS.flatMap((d) => (plan.days[d] ?? []).map((e, i) => [d, i, e] as const));

/** Сколько отмечено и сколько сделано за неделю. */
export function weekProgress(a: ActivePlan, wk: number) {
  const items = planItems(a.plan);
  const logs = items.map(([d, i]) => a.logs[logKey(wk, d, i)]);
  return { total: items.length, marked: logs.filter(Boolean).length, done: logs.filter((l) => l?.done).length };
}

/** Текущая неделя — первая, где отмечено не всё. */
export function currentWeek(a: ActivePlan) {
  const n = a.plan.weeks.findIndex((_, wk) => {
    const p = weekProgress(a, wk);
    return p.marked < p.total;
  });
  return n < 0 ? a.plan.weeks.length - 1 : n;
}
