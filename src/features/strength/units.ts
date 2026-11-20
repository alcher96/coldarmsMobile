// Килограммы или фунты — выбор спортсмена, один на всё приложение. Хранится в профиле на сервере (coldarms.com) — приходит
// с силовыми и с планом тренировок; на телефоне — копия, чтобы до ответа сервера показывать как в прошлый раз.
// Веса на сервер всегда уходят в кг.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { saveBody } from './api';

export type Unit = 'kg' | 'lb';
const KEY = 'strength:unit';
const LB = 2.20462;
let unit: Unit = 'kg';
const subs = new Set<() => void>();
AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v === 'lb' || v === 'kg') {
      unit = v;
      subs.forEach((f) => f());
    }
  })
  .catch(() => {});

/** Значение с сервера (не сохраняет обратно). */
export function applyUnit(u: Unit) {
  if (u !== 'kg' && u !== 'lb') return;
  if (u !== unit) {
    unit = u;
    subs.forEach((f) => f());
  }
  AsyncStorage.setItem(KEY, u).catch(() => {});
}

/** Выбор спортсмена: сразу на экране и в профиль на сервере. */
export function setUnit(u: Unit) {
  applyUnit(u);
  saveBody({ unit: u }).catch(() => {
    // нет связи — останется копия на телефоне, сервер узнает при следующем выборе
  });
}

export function useUnit(): Unit {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => unit,
  );
}

/** Вес для показа: кг — до десятых без лишних нулей, lb — целые. */
export function fmtW(kg: number, u: Unit) {
  if (u === 'lb') return `${Math.round(kg * LB)} lb`;
  return `${Number.isInteger(kg) ? kg : kg.toFixed(1).replace('.', ',')} кг`;
}
export const toKg = (v: number, u: Unit) => (u === 'lb' ? Math.round((v / LB) * 10) / 10 : Math.round(v * 10) / 10);
export const fromKg = (kg: number, u: Unit) => (u === 'lb' ? Math.round(kg * LB) : kg);
/** «12,5» или «12.5» → число. */
export const parseNum = (s: string) => {
  const v = Number(s.replace(',', '.').trim());
  return Number.isFinite(v) && v > 0 ? v : null;
};
