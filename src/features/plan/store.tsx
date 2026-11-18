import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/auth/auth-context';

import type { ActivePlan, Log, TrackMode } from './track';
import { DAYS, type Exercise, type Plan, type Week } from './types';

/** Неделя пользователя, инвентарь и начатый план — в памяти телефона (в браузере — localStorage), отдельно для каждого
 *  аккаунта: план строится по разбору, второй человек, вошедший на этом же телефоне, чужого плана не увидит. */
const KEY = 'coldarms.plan.week';
const GEAR_KEY = 'coldarms.plan.gear';
const ACTIVE_KEY = 'coldarms.plan.active';

const empty = (): Week => Object.fromEntries(DAYS.map((d) => [d, 'отдых'])) as Week;

async function read<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, v: unknown) {
  (v == null ? AsyncStorage.removeItem(key) : AsyncStorage.setItem(key, JSON.stringify(v))).catch(() => {
    // хранилище недоступно — живёт до перезапуска
  });
}

type Store = {
  week: Week;
  setWeek: (w: Week) => void;
  add: (day: string, e: Exercise) => void;
  remove: (day: string, index: number) => void;
  toggleDay: (day: string) => void; // день тренировки ↔ отдых
  hasExercises: boolean;
  inventory: string[] | null; // null — ещё не спрашивали
  setInventory: (g: string[]) => void;
  active: ActivePlan | null; // начатый план с отметками
  startPlan: (analysis: string, plan: Plan, mode?: TrackMode) => void;
  setMode: (mode: TrackMode) => void;
  setLog: (key: string, log: Log | null) => void;
  dropPlan: () => void;
};

const Ctx = createContext<Store | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [week, setWeek] = useState<Week>(empty);
  const [inventory, setInventory] = useState<string[] | null>(null);
  const [active, setActive] = useState<ActivePlan | null>(null);
  const { user } = useAuth();
  const acct = user?.sub ?? 'anon';
  // чьи данные сейчас загружены: сменился аккаунт — пока не загрузили новые, ничего не сохраняем
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const ready = loadedFor === acct;
  useEffect(() => {
    let alive = true;
    Promise.all([read<Week>(`${KEY}:${acct}`), read<string[]>(`${GEAR_KEY}:${acct}`), read<ActivePlan>(`${ACTIVE_KEY}:${acct}`)]).then(
      ([w, g, a]) => {
        if (!alive) return;
        setWeek(w ? { ...empty(), ...w } : empty());
        setInventory(g ?? null);
        setActive(a ?? null);
        setLoadedFor(acct);
      },
    );
    return () => {
      alive = false;
    };
  }, [acct]);
  // сохраняем только после загрузки — иначе пустые значения затрут сохранённые
  useEffect(() => void (ready && write(`${KEY}:${acct}`, week)), [week, ready, acct]);
  useEffect(() => void (ready && inventory && write(`${GEAR_KEY}:${acct}`, inventory)), [inventory, ready, acct]);
  useEffect(() => void (ready && write(`${ACTIVE_KEY}:${acct}`, active)), [active, ready, acct]);

  const list = (d: string) => (Array.isArray(week[d]) ? (week[d] as Exercise[]) : []);
  const value: Store = {
    week,
    setWeek,
    add: (day, e) => setWeek((w) => ({ ...w, [day]: [...(Array.isArray(w[day]) ? (w[day] as Exercise[]) : []), e] })),
    remove: (day, i) =>
      setWeek((w) => {
        // день остаётся днём тренировки, даже если упражнений не осталось (отдых — переключателем дней)
        return { ...w, [day]: (Array.isArray(w[day]) ? (w[day] as Exercise[]) : []).filter((_, k) => k !== i) };
      }),
    toggleDay: (day) => setWeek((w) => ({ ...w, [day]: Array.isArray(w[day]) ? 'отдых' : [] })),
    hasExercises: DAYS.some((d) => list(d).length > 0),
    inventory,
    setInventory,
    active,
    startPlan: (analysis, plan, mode = 'simple') =>
      setActive({ analysis, plan, mode, started: new Date().toISOString(), logs: {} }),
    setMode: (mode) => setActive((a) => a && { ...a, mode }),
    setLog: (key, log) =>
      setActive((a) => {
        if (!a) return a;
        const logs = { ...a.logs };
        if (log) logs[key] = log;
        else delete logs[key];
        return { ...a, logs };
      }),
    dropPlan: () => setActive(null),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlan() {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePlan вне PlanProvider');
  return v;
}
