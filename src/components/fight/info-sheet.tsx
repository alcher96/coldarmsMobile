import { createContext, use, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode, type RefObject } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radii } from '@/theme/tokens';

import { fc } from './palette';

/** Абзац, подзаголовок или пункт списка; `**жирное**` внутри текста выделяется. */
export type Block = string | { h: string } | { li: string };

export type Info = {
  title: string;
  /** Блоки текста или загрузчик (для разбора M.I.R.A., который приходит с сервера). */
  body: Block[] | (() => Promise<Block[]>);
};

/**
 * Геометрия шторки: где в ней список. Касания в списке — прокрутка, остальные — свайп шторки.
 * Список меряется относительно самой шторки, а не экрана: так замер не зависит от того,
 * что шторка в этот момент ещё выезжает. Шторка прижата к низу окна, её верх — высота окна
 * минус высота шторки.
 */
class SheetGeometry {
  windowH = 0;
  sheetH = 0;
  listTop = Infinity;
  listBottom = -Infinity;
  setWindow(h: number) {
    this.windowH = h;
  }
  setSheetHeight(h: number) {
    this.sheetH = h;
  }
  setList(top: number, bottom: number) {
    this.listTop = top;
    this.listBottom = bottom;
  }
  inList(pageY: number) {
    const y = pageY - (this.windowH - this.sheetH);
    return y >= this.listTop && y <= this.listBottom;
  }
}
const SheetContext = createContext<{ geo: SheetGeometry; sheet: RefObject<ViewInstance | null> } | null>(null);

/** ScrollView для содержимого шторки: его касания листают список, остальные — тянут шторку. */
export function SheetScrollView({ onLayout, ...props }: ComponentProps<typeof ScrollView>) {
  const ctx = use(SheetContext);
  const ref = useRef<ScrollViewInstance>(null);
  // Ушёл список — касания снова тянут шторку.
  useEffect(() => () => ctx?.geo.setList(Infinity, -Infinity), [ctx]);
  return (
    <ScrollView
      ref={ref}
      {...props}
      onLayout={(e) => {
        const sheet = ctx?.sheet.current;
        if (sheet) ref.current?.measureLayout(sheet, (_x, y, _w, h) => ctx.geo.setList(y, y + h));
        onLayout?.(e);
      }}
    />
  );
}

/**
 * Нижняя шторка поверх экрана. `tall` — высокая шторка на всю доступную высоту (комментарии),
 * `bare` — без внутренних отступов (содержимое само задаёт поля).
 * Закрывается тапом по фону, «Назад» или свайпом вниз.
 */
export function Sheet({
  visible,
  onClose,
  children,
  tall,
  bare,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  tall?: boolean;
  bare?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [drag] = useState(() => new Animated.Value(0));
  const [geo] = useState(() => new SheetGeometry());
  const sheet = useRef<ViewInstance>(null);
  const ctx = useMemo(() => ({ geo, sheet }), [geo]);

  // Каждое открытие — с исходной позиции, даже если прошлое закрыли свайпом.
  useEffect(() => {
    if (visible) drag.setValue(0);
  }, [visible, drag]);

  // Во время свайпа экран не перерисовывается (двигается Animated-значение), так что жест не сбросится.
  const pan = useMemo(
    () =>
      PanResponder.create({
        // Касание достаётся шторке, если его не забрал элемент внутри (кнопка) и оно не в списке —
        // иначе список перестал бы листаться.
        onStartShouldSetPanResponder: (e) => !geo.inList(e.nativeEvent.pageY),
        onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > 120 || g.vy > 1) {
            Animated.timing(drag, { toValue: height, duration: 180, useNativeDriver: true }).start(() => onClose());
          } else {
            Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
          }
        },
        onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [drag, height, onClose, geo],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        onLayout={(e) => geo.setWindow(e.nativeEvent.layout.height)}
        accessibilityLabel="Закрыть"
      />
      {visible ? (
        <Animated.View
          ref={sheet}
          onLayout={(e) => geo.setSheetHeight(e.nativeEvent.layout.height)}
          {...pan.panHandlers}
          style={[
            styles.sheet,
            tall && { top: insets.top + 60, maxHeight: undefined },
            bare && { paddingHorizontal: 0 },
            { paddingBottom: (tall ? 0 : 24) + insets.bottom, transform: [{ translateY: drag }] },
          ]}>
          <View style={styles.handle} />
          <SheetContext value={ctx}>{children}</SheetContext>
        </Animated.View>
      ) : null}
    </Modal>
  );
}

/** Шторка с пояснением: оговорки живут здесь, а не на экране. */
export function InfoSheet({ info, onClose }: { info: Info | null; onClose: () => void }) {
  return (
    <Sheet visible={!!info} onClose={onClose}>
      {info ? (
        <>
          <Text style={styles.title}>{info.title}</Text>
          <SheetScrollView style={styles.scroll} contentContainerStyle={styles.body}>
            <Body body={info.body} />
          </SheetScrollView>
        </>
      ) : null}
    </Sheet>
  );
}

function Body({ body }: { body: Info['body'] }) {
  const [loaded, setLoaded] = useState<{ source: Info['body']; paragraphs: Block[] | null } | null>(null);
  const isLoader = typeof body === 'function';

  useEffect(() => {
    if (typeof body !== 'function') return;
    let alive = true;
    body().then(
      (paragraphs) => alive && setLoaded({ source: body, paragraphs }),
      () => alive && setLoaded({ source: body, paragraphs: null }),
    );
    return () => {
      alive = false;
    };
  }, [body]);

  if (!isLoader) return <Paragraphs items={body} />;
  if (!loaded || loaded.source !== body) return <ActivityIndicator color={colors.text} style={styles.loader} />;
  return <Paragraphs items={loaded.paragraphs ?? ['Не удалось загрузить. Попробуйте позже.']} />;
}

function Paragraphs({ items }: { items: Block[] }) {
  return items.map((b, i) => {
    if (typeof b === 'string') {
      return (
        <Text key={i} style={styles.p}>
          <Inline text={b} />
        </Text>
      );
    }
    if ('h' in b) {
      return (
        <Text key={i} style={[styles.h, i === 0 && styles.hFirst]}>
          {b.h}
        </Text>
      );
    }
    return (
      <View key={i} style={styles.li}>
        <View style={styles.bullet} />
        <Text style={[styles.p, styles.liText]}>
          <Inline text={b.li} />
        </Text>
      </View>
    );
  });
}

/** `**жирное**` → полужирный фрагмент внутри абзаца. */
function Inline({ text }: { text: string }) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 ? (
      <Text key={i} style={styles.strong}>
        {part}
      </Text>
    ) : (
      part
    ),
  );
}

/** Круглая кнопка «i» рядом с заголовком блока. */
export function InfoButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.info} accessibilityLabel={`Пояснение: ${label}`}>
      <Text style={styles.infoText}>i</Text>
    </Pressable>
  );
}

export function SectionHead({ title, onInfo, right }: { title: string; onInfo?: () => void; right?: ReactNode }) {
  return (
    <View style={styles.head}>
      <Text style={styles.headTitle}>{title}</Text>
      {right}
      {onInfo ? <InfoButton onPress={onInfo} label={title} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '80%',
    backgroundColor: fc.card,
    borderTopWidth: 1,
    borderColor: fc.border,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#3A3B40', alignSelf: 'center', marginBottom: 16 },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 24, textTransform: 'uppercase', color: colors.text },
  scroll: { marginTop: 12 },
  body: { gap: 10, paddingBottom: 4 },
  p: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: fc.soft },
  strong: { fontFamily: fonts.bodySemi, color: colors.text },
  h: { fontFamily: fonts.display, fontSize: 17, textTransform: 'uppercase', color: colors.text, marginTop: 10 },
  hFirst: { marginTop: 0 },
  li: { flexDirection: 'row', gap: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginTop: 8 },
  liText: { flex: 1 },
  loader: { marginVertical: 24 },
  info: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: fc.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: { fontFamily: fonts.bodySemi, fontSize: 12, color: fc.muted },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headTitle: { flex: 1, fontFamily: fonts.display, fontSize: 20, textTransform: 'uppercase', color: colors.text },
});
