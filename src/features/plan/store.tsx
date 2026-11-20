import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { useAuth } from '@/auth/auth-context';
import { applyUnit } from '@/features/strength/units';

import { dropActive, fetchState, saveInventory, saveLog, saveMode, saveWeek, startActive, type PlanParams } from './api';
import type { ActivePlan, Log, TrackMode } from './track';
import { DAYS, type Exercise, type Week } from './types';

/**
 * Неделя спортсмена, инвентарь и начатый план с отметками — на сервере за аккаунтом (coldarms.com, /api/plan/state):
 * другой телефон, переустановка — всё на месте. Изменения показываются сразу и уходят на сервер: неделя и инвентарь —
 * с задержкой (правки подряд — одним запросом), отметки — сразу. Не дошло — состояние перечитывается с сервера.
 */
const empty = (): Week => Object.fromEntries(DAYS.map((d) => [d, 'отдых'])) as Week;
const EMPTY = empty();
const SAVE_DELAY = 600;

type Store = {
  /** Состояние загружено с сервера (до этого — пустая неделя, плана нет). */
  ready: boolean;
  week: Week;
  setWeek: (w: Week) => void;
  add: (day: string, e: Exercise) => void;
  remove: (day: string, index: number) => void;
  toggleDay: (day: string) => void; // день тренировки ↔ отдых
  hasExercises: boolean;
  inventory: string[] | null; // null — ещё не спрашивали
  setInventory: (g: string[]) => void;
  active: ActivePlan | null; // начатый план с отметками
  /** «Начать этот план»: сервер строит план по тем же параметрам и сохраняет; ошибка — исключением. */
  startPlan: (analysis: string, params: PlanParams, mode?: TrackMode) => Promise<void>;
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
  const acct = user?.sub ?? null;
  // чьи данные загружены: сменился аккаунт — пока не загрузили новые, ничего не сохраняем
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const ready = acct !== null && loadedFor === acct;
  // что сейчас лежит на сервере — сохраняем только отличия (загрузка состояния — не правка)
  const savedWeek = useRef<string | null>(null);
  const savedGear = useRef<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) =>
      fetchState(signal).then((s) => {
        const w = { ...empty(), ...s.week };
        savedWeek.current = JSON.stringify(w);
        savedGear.current = JSON.stringify(s.inventory);
        setWeek(w);
        setInventory(s.inventory);
        setActive(s.active);
        applyUnit(s.unit);
        setLoadedFor(acct);
      }),
    [acct],
  );

  useEffect(() => {
    if (!acct) return;
    const ctl = new AbortController();
    load(ctl.signal).catch(() => {
      // нет связи — экраны плана покажут пустое; при следующем входе в приложение загрузится
    });
    return () => ctl.abort();
  }, [acct, load]);

  // не дошло до сервера — показать то, что на самом деле сохранено
  const resync = useCallback(() => {
    load().catch(() => {});
  }, [load]);

  useEffect(() => {
    if (!ready) return;
    const json = JSON.stringify(week);
    if (json === savedWeek.current) return;
    const t = setTimeout(() => {
      saveWeek(week)
        .then(() => {
          savedWeek.current = json;
        })
        .catch(resync);
    }, SAVE_DELAY);
    return () => clearTimeout(t);
  }, [week, ready, resync]);

  useEffect(() => {
    if (!ready || inventory === null) return;
    const json = JSON.stringify(inventory);
    if (json === savedGear.current) return;
    const t = setTimeout(() => {
      saveInventory(inventory)
        .then(() => {
          savedGear.current = json;
        })
        .catch(resync);
    }, SAVE_DELAY);
    return () => clearTimeout(t);
  }, [inventory, ready, resync]);

  // до загрузки (и после смены аккаунта) — пусто, а не данные прежнего аккаунта
  const shownWeek = ready ? week : EMPTY;
  const list = (d: string) => (Array.isArray(shownWeek[d]) ? (shownWeek[d] as Exercise[]) : []);
  const value: Store = {
    ready,
    week: shownWeek,
    setWeek,
    add: (day, e) => setWeek((w) => ({ ...w, [day]: [...(Array.isArray(w[day]) ? (w[day] as Exercise[]) : []), e] })),
    remove: (day, i) =>
      setWeek((w) => {
        // день остаётся днём тренировки, даже если упражнений не осталось (отдых — переключателем дней)
        return { ...w, [day]: (Array.isArray(w[day]) ? (w[day] as Exercise[]) : []).filter((_, k) => k !== i) };
      }),
    toggleDay: (day) => setWeek((w) => ({ ...w, [day]: Array.isArray(w[day]) ? 'отдых' : [] })),
    hasExercises: DAYS.some((d) => list(d).length > 0),
    inventory: ready ? inventory : null,
    setInventory,
    active: ready ? active : null,
    startPlan: async (analysis, params, mode = 'simple') => {
      setActive(await startActive(analysis, params, mode));
    },
    setMode: (mode) => {
      setActive((a) => a && { ...a, mode });
      saveMode(mode).catch(resync);
    },
    setLog: (key, log) => {
      setActive((a) => {
        if (!a) return a;
        const logs = { ...a.logs };
        if (log) logs[key] = log;
        else delete logs[key];
        return { ...a, logs };
      });
      saveLog(key, log).catch(resync);
    },
    dropPlan: () => {
      setActive(null);
      dropActive().catch(resync);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlan() {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePlan вне PlanProvider');
  return v;
}
