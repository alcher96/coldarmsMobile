import { router } from 'expo-router';
import { Image } from 'expo-image';
import { ArrowUpRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ageOf, wrestlerPhotoUrl, type Wrestler } from '@/api/fight';
import { initialsOf, plural } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

import { Sheet } from './info-sheet';
import { countryName, feet, inches, lb, type Side } from './model';
import { fc } from './palette';

/** Карточка бойца: фото, страна и возраст, вес и рост в двух системах, обхваты. */
export function FighterSheet({
  side,
  wrestler,
  onClose,
}: {
  side: Side | null;
  wrestler: Wrestler | null;
  onClose: () => void;
}) {
  return (
    <Sheet visible={!!side} onClose={onClose} bare>
      {side ? (
        <Body
          side={side}
          w={wrestler}
          onProfile={() => {
            onClose();
            router.push({ pathname: '/athlete/[id]', params: { id: side.id } });
          }}
        />
      ) : null}
    </Sheet>
  );
}

function Body({ side, w, onProfile }: { side: Side; w: Wrestler | null; onProfile: () => void }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const age = ageOf(w?.birthDate ?? null);
  const country = countryName(w?.country ?? null);
  const meta = [country, age ? `${age} ${plural(age, ['год', 'года', 'лет'])}` : null].filter(Boolean).join(' · ');
  const girths: [string, number | null][] = [
    ['Бицепс', w?.bicep ?? null],
    ['Предплечье', w?.forearm ?? null],
    ['Запястье', w?.wristSize ?? null],
  ];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <View style={styles.photo}>
          <Text style={styles.initials}>{initialsOf(side.full)}</Text>
          {w?.photoPath && !photoFailed ? (
            <Image
              source={wrestlerPhotoUrl(side.id)}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={150}
              onError={() => setPhotoFailed(true)}
            />
          ) : null}
        </View>
        <View style={styles.flex}>
          <View style={styles.metaRow}>
            {w?.country ? <Text style={styles.code}>{w.country}</Text> : null}
            {meta ? <Text style={styles.meta}>{meta}</Text> : null}
          </View>
          <Text style={styles.name}>
            {side.first}
            {'\n'}
            {side.last}
          </Text>
        </View>
      </View>

      <View style={styles.tiles}>
        <View style={styles.tile}>
          <Text style={styles.tileValue}>{w?.weight ? `${w.weight} кг` : '—'}</Text>
          <Text style={styles.tileLabel}>{w?.weight ? `${lb(w.weight)} lb · вес` : 'вес'}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileValue}>{w?.height ? `${w.height} см` : '—'}</Text>
          <Text style={styles.tileLabel}>{w?.height ? `${feet(w.height)} · рост` : 'рост'}</Text>
        </View>
      </View>

      <View style={styles.girths}>
        {girths.map(([name, cm], i) => (
          <View key={name} style={[styles.girth, i < girths.length - 1 && styles.girthBorder]}>
            <Text style={styles.girthName}>{name}</Text>
            <Text style={styles.girthValue}>
              {cm ? `${cm} см` : '—'}
              <Text style={styles.girthInch}>{cm ? `  ${inches(cm)}` : '  нет данных'}</Text>
            </Text>
          </View>
        ))}
      </View>

      <Pressable onPress={onProfile} style={styles.profile}>
        <Text style={styles.profileText}>Профиль атлета</Text>
        <ArrowUpRight size={16} color={colors.lightText} strokeWidth={1.8} />
      </Pressable>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 8 },
  flex: { flex: 1 },
  head: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  photo: {
    width: 86,
    height: 104,
    borderRadius: radii.control,
    backgroundColor: fc.chip,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontFamily: fonts.display, fontSize: 24, color: fc.dim },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  code: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    color: fc.soft,
    backgroundColor: fc.border,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 13, color: fc.second },
  name: { fontFamily: fonts.display, fontSize: 28, lineHeight: 30, textTransform: 'uppercase', color: colors.text, marginTop: 6 },
  tiles: { flexDirection: 'row', gap: 6, marginTop: 16 },
  tile: { flex: 1, backgroundColor: fc.chip, borderRadius: radii.control, padding: 12 },
  tileValue: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  tileLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.muted, marginTop: 4 },
  girths: { marginTop: 6 },
  girth: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 12 },
  girthBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: fc.line },
  girthName: { fontFamily: fonts.bodyMedium, fontSize: 14, color: fc.second },
  girthValue: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  girthInch: { fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.muted },
  profile: {
    marginTop: 16,
    height: 48,
    borderRadius: radii.control,
    backgroundColor: colors.light,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  profileText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.lightText },
});
