import type { Center, Result, Side, Technique, Wrist, YesNo } from './types';

/** Центр стола — те же варианты, что у сервера (annotator/api_server.py CHOICES.center). */
export const CENTERS: { key: Center; label: string }[] = [
  { key: 'opp', label: 'Соперник' },
  { key: 'me', label: 'Я' },
  { key: 'none', label: 'Никто, не помню' },
];

/** Кингсмув (условные вопросы) — как в разметчике: да / нет. */
export const YES_NO: { key: YesNo; label: string }[] = [
  { key: 'yes', label: 'Да' },
  { key: 'no', label: 'Нет' },
];

/** Варианты кнопок — те же, что в разметчике эксперта (annotator/static/app.js). */
export const SIDES: { key: Side; label: string }[] = [
  { key: 'left', label: 'Слева' },
  { key: 'right', label: 'Справа' },
];

export const RESULTS: { key: Result; label: string; disabled?: boolean }[] = [
  { key: 'loss', label: 'Проиграл' },
  { key: 'win', label: 'Победил · скоро', disabled: true },
];

export const TECHNIQUES: { key: Technique; label: string }[] = [
  { key: 'hook', label: 'Крюк' },
  { key: 'high_hook', label: 'Высокий крюк' },
  { key: 'top_roll', label: 'Топролл (верх)' },
  { key: 'open_top_roll', label: 'Открытый топролл' },
  { key: 'press', label: 'Жим (трицепс)' },
  { key: 'flop_press', label: 'Флоп-пресс' },
  { key: 'side_press', label: 'Боковой нажим' },
  { key: 'kings_move', label: 'Кингсмув' },
  { key: 'hit', label: 'Удар со старта' },
  { key: 'post', label: 'Держал оборону' },
  { key: 'none', label: 'Без выраженной техники' },
  { key: 'other', label: 'Другое' },
];

export const WRISTS: { key: Wrist; label: string; hint: string }[] = [
  { key: 'mine', label: 'Выиграл я', hint: 'Контроль кисти был у тебя' },
  {
    key: 'held_opp',
    label: 'Держал, но контроль у соперника',
    hint: 'Кисть не выбита, но контроль у соперника — например, в крюках провалился в супинацию. Раскрылась только у самой подушки — тоже сюда',
  },
  { key: 'lost', label: 'Проиграл', hint: 'Кисть ушла, и это решило схватку' },
  { key: 'neutral', label: 'На равных', hint: 'Кисть не решила схватку: оба держали прямую кисть, или в крюках оба закрутили — никто не провалился в супинацию и не взял перевес' },
];
