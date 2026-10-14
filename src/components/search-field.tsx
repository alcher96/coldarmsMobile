import { Search, X } from 'lucide-react-native';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, fonts, radii } from '@/theme/tokens';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  /** «Найти» на клавиатуре — искать сразу, не дожидаясь паузы в наборе. */
  onSubmit?: () => void;
  placeholder?: string;
};

export function SearchField({ value, onChangeText, onSubmit, placeholder = 'Поиск по названию' }: Props) {
  return (
    <View style={styles.box}>
      <Search size={16} color={colors.textMuted} strokeWidth={1.6} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityLabel="Очистить">
          <X size={16} color={colors.textMuted} strokeWidth={1.6} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.control,
    backgroundColor: colors.row,
  },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.text, paddingVertical: 0 },
});
