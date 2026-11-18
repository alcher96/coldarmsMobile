/** Упражнение недели — только свойства из каталога и числа (никакого свободного текста). */
export type Exercise = {
  targets: string[];
  equipment: string;
  handle: string;
  mode: string;
  sets?: number | null;
  reps?: number | null;
  weight?: number | null;
  // от сервера при коррекции
  note?: string | null;
  link?: string;
  advice?: string | null;
  caution?: boolean;
  instead?: Exercise; // план поставил замену: для главного упражнения звена нет инвентаря
  key?: string; // «день|снаряд|ручка|цели» — для веса 1-й недели (кнопки −/+)
  weeks?: WeekLoad[] | null; // прогрессия по неделям плана (null — борьба и работа за столом, как обычно)
};

/** Числа упражнения на одну неделю плана; reps в статике — секунды, weight null — вес подбирает спортсмен. */
export type WeekLoad = { sets: number; reps: number; weight: number | null; mode: string; hint: string | null };

export const loadNumbers = (l: WeekLoad) =>
  `${l.sets}×${l.reps}${l.mode === 'статика' ? ' с' : ''}` + (l.weight ? ` · ${l.weight} кг` : '');

export type Week = Record<string, Exercise[] | 'отдых'>;

export type Catalog = {
  targets: string[];
  equipment: string[];
  handles: string[];
  modes: string[];
  days: string[];
  gear: { снаряды: string[]; ручки: string[] }; // инвентарь — спрашивается перед планом
  gearOfEquipment: Record<string, string>;
  gearOfHandle: Record<string, string>;
};

/** Инвентарь, который точно есть: всё, на чём спортсмен уже тренируется. */
export const gearOfWeek = (week: Week, cat: Catalog) => {
  const out = new Set<string>();
  for (const v of Object.values(week)) {
    if (!Array.isArray(v)) continue;
    for (const e of v) {
      const g = [cat.gearOfEquipment[e.equipment], cat.gearOfHandle[e.handle]];
      if (e.equipment === 'за столом с блоком') g.push('блок');
      g.forEach((x) => x && out.add(x));
    }
  }
  return out;
};

export type Change =
  | { kind: 'added'; day: string; new: Exercise; link: string }
  | { kind: 'replaced'; day: string; old: Exercise; new: Exercise; link: string }
  | { kind: 'covered'; link: string }
  | { kind: 'no_gear'; link: string; need: string[] };

export type PlanWeek = {
  week: number;
  kind: string;
  dose: { sets: string; reps: string };
  static: string | null;
  start_work: boolean;
};

export type Plan = {
  links: { name: string; kb: string }[];
  degree: 'weak' | 'medium' | 'strong';
  months: 1 | 2 | 3;
  days: Record<string, Exercise[]>;
  changes: Change[];
  table_work: string[];
  weeks: PlanWeek[];
  static_type: { kind: string; label: string; forced: boolean };
};

export const DAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const;
export const DAY_RU: Record<string, string> = {
  пн: 'Понедельник', вт: 'Вторник', ср: 'Среда', чт: 'Четверг', пт: 'Пятница', сб: 'Суббота', вс: 'Воскресенье',
};

export const exerciseLine = (e: Exercise) =>
  [e.targets.join(' + '), e.equipment, e.handle, e.mode !== 'динамика' ? e.mode : null].filter(Boolean).join(' · ');

export const exerciseNumbers = (e: Exercise) =>
  [e.sets && e.reps ? `${e.sets}×${e.reps}` : e.sets ? `${e.sets} подх.` : null, e.weight ? `${e.weight} кг` : null]
    .filter(Boolean)
    .join(' · ');
