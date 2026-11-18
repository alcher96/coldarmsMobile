// Время «скана» людей на замершем кадре — одно на вспышки силуэтов (scan-people.tsx) и прицел MIRA (aim-reticle.tsx).
// Подобрано на стендах annotator/report/scan_contours.html и scan_aim.html (эксперт, 2026-11-18). Все функции — ворклеты:
// считаются в потоке интерфейса каждый кадр, без состояния (паузы «случайные», но повторяемые).

export const ATTACK_S = 0.035;   // вспышка набирает яркость
export const DECAY_S = 0.22;     // и гаснет
const STEP_MIN_S = 0.5;          // пауза между силуэтами — от
const STEP_MAX_S = 0.8;          // и до
const CYCLE_PAUSE_S = 5;         // пауза между кругами

// прицел — только в первом круге: собирается у MIRA, долетает до первого силуэта к первой вспышке
export const AIM_ASSEMBLE_S = 0.55;
export const AIM_FLY0_S = 0.42;
/** Первый круг: первая вспышка — когда прицел долетел. */
export const AIM_LEAD_S = AIM_ASSEMBLE_S + AIM_FLY0_S;
export const AIM_HOLD_S = 0.2;   // держит последний захват
export const AIM_DISASM_S = 0.22; // и разлетается (эксперт: быстро)

/** Пауза перед i-м силуэтом в круге c: псевдослучайно в [0,5; 0,8] с. */
export function stepOf(c: number, i: number) {
  'worklet';
  const r = Math.sin((c * 31 + i * 7 + 1) * 12.9898) * 43758.5453;
  return STEP_MIN_S + (r - Math.floor(r)) * (STEP_MAX_S - STEP_MIN_S);
}

/** Яркость вспышки через dt после её начала: резкий набор и быстрое угасание (0…1). */
export function flash(dt: number) {
  'worklet';
  if (dt < 0) return 0;
  if (dt < ATTACK_S) return dt / ATTACK_S;
  const k = Math.max(0, 1 - (dt - ATTACK_S) / DECAY_S);
  return k * k;
}

/** Время i-й вспышки от начала круга c (lead — задержка первого круга под прицел). */
export function flashAt(c: number, i: number, lead: number) {
  'worklet';
  let at = c === 0 ? lead : 0;
  for (let k = 1; k <= i; k++) at += stepOf(c, k);
  return at;
}

/** Длина круга c из n силуэтов. */
export function cycleLen(c: number, n: number, lead: number) {
  'worklet';
  return flashAt(c, Math.max(0, n - 1), lead) + ATTACK_S + DECAY_S + CYCLE_PAUSE_S;
}

/** Время от начала скана → номер круга и время внутри него. */
export function cycleAt(e: number, n: number, lead: number) {
  'worklet';
  let t = e;
  let c = 0;
  while (n > 0 && c < 10000) {
    const len = cycleLen(c, n, lead);
    if (t < len) break;
    t -= len;
    c++;
  }
  return { c, t };
}
