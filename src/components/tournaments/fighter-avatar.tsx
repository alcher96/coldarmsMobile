import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { thumbnailUrl } from '@/api/competitions';
import { initialsOf } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

/** Аватарка бойца (квадратная или круглая — `round`); пока фото нет или оно не загрузилось — инициалы (как в макете). */
export function FighterAvatar({
  id,
  name,
  size = 36,
  round = false,
}: {
  id?: string | null;
  name: string;
  size?: number;
  round?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[styles.box, { width: size, height: size }, round && { borderRadius: size / 2 }]}>
      <Text style={styles.initials}>{initialsOf(name)}</Text>
      {id && !failed ? (
        <Image
          source={thumbnailUrl(id)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          onError={() => setFailed(true)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radii.small,
    backgroundColor: '#222226',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textMuted },
});
