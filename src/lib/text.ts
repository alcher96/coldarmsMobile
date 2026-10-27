/**
 * Подгонка текста под узкие экраны и крупный системный шрифт.
 */

/** Мелкие подписи и цифры растут с системным шрифтом не больше чем в 1,3 раза — иначе не влезут в плашки. */
export const SMALL_TEXT_SCALE = 1.3;

/**
 * Текст, которому не хватает места, уменьшается, а не обрезается многоточием.
 * Предел 75% соблюдает только iOS — Android сжимает сколько нужно, поэтому только для коротких строк.
 */
export const fitText = { adjustsFontSizeToFit: true, minimumFontScale: 0.75 } as const;

/** Множитель для колонок фиксированной ширины: растут вместе со шрифтом, но не больше SMALL_TEXT_SCALE. */
export const columnScale = (fontScale: number) => Math.min(fontScale, SMALL_TEXT_SCALE);
