import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

/** Тень для заголовка поверх фото — отделяет буквы от надписей на самом постере. */
export const textOnCover = {
  textShadowColor: 'rgba(0,0,0,0.75)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
} as const;

/**
 * Обложка турнира фоном блока: фото + затемнение, чтобы белый текст поверх читался на любой
 * картинке. Сверху постер почти не затемнён, к низу (где название и мета) — почти в цвет карточки.
 */
export function CoverBackground({ uri }: { uri: string }) {
  return (
    <>
      <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      <LinearGradient
        colors={['rgba(11,11,12,0.15)', 'rgba(11,11,12,0.55)', 'rgba(17,17,19,0.94)', 'rgba(21,21,23,0.98)']}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
    </>
  );
}
