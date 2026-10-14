/** Цвета и шрифты из макета Figma (тёмная тема — единственная). */
export const colors = {
  bg: '#0B0B0C',
  card: '#151517',
  cardBorder: '#26262A',
  row: '#0F0F11',
  divider: '#26262A',
  text: '#FFFFFF',
  textMuted: '#8C8C92',
  textDim: '#5E5E64',
  accent: '#E5352B',
  light: '#F3F3F3',
  lightText: '#0B0B0C',
  lightMuted: '#5E5E64',
} as const;

export const fonts = {
  display: 'RobotoCondensed_700Bold',
  displaySemi: 'RobotoCondensed_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
} as const;

export const space = {
  gutter: 24,
  cardPad: 16,
  gap: 20,
  /** Карточки и крупные блоки. */
  radius: 18,
} as const;

/** Скругления: всё мягкое, без острых углов. */
export const radii = {
  card: space.radius,
  /** Кнопки, поля ввода, сегменты. */
  control: 12,
  /** Аватары, строки рейтинга, мелкие плашки. */
  small: 8,
  /** Бейджи-капсулы. */
  pill: 999,
} as const;
