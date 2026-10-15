import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ChevronLeft, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SITE_URL } from '@/api/http';
import { notifIcon, notifMessage, notifTime, notifTitle, routeFor, type AppNotification } from '@/api/notifications';
import { fc } from '@/components/fight/palette';
import { useNotifications } from '@/notifications/notifications-context';
import { colors, fonts, radii } from '@/theme/tokens';

/** Все уведомления — как панель колокольчика на сайте. Открыл экран — непрочитанные считаются прочитанными. */
export default function NotificationsScreen() {
  const { items, unread, refresh, readAll, remove } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  // Какие были непрочитанными на момент открытия — подсветим их, хотя отметка уже ушла на сервер.
  const [fresh] = useState(() => new Set(items.filter((n) => !n.isRead).map((n) => n.id)));

  useFocusEffect(
    useCallback(() => {
      if (unread > 0) readAll();
    }, [unread, readAll]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={10}
          style={styles.back}
          accessibilityLabel="Назад">
          <ChevronLeft size={24} color={colors.text} strokeWidth={1.6} />
        </Pressable>
        <Text style={styles.title}>Уведомления</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => <Row n={item} isNew={fresh.has(item.id)} onDelete={() => remove(item.id)} />}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>Нет уведомлений</Text>
            <Text style={styles.emptyText}>
              Здесь появятся бои и результаты избранных атлетов, ответы на комментарии, достижения и решения по правкам.
            </Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
      />
    </SafeAreaView>
  );
}

const Separator = () => <View style={{ height: 8 }} />;

function Row({ n, isNew, onDelete }: { n: AppNotification; isNew: boolean; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const route = routeFor(n.linkUrl);
  const go = () => {
    if (route) router.push(route);
    else if (n.linkUrl) WebBrowser.openBrowserAsync(n.linkUrl.startsWith('http') ? n.linkUrl : SITE_URL + n.linkUrl);
  };
  const message = notifMessage(n);
  return (
    <Pressable onPress={() => setOpen((v) => !v)} style={[styles.row, isNew && styles.rowNew]}>
      <Text style={styles.icon}>{notifIcon(n.type)}</Text>
      <View style={styles.flex}>
        <View style={styles.head}>
          <Text style={styles.rowTitle} numberOfLines={open ? undefined : 1}>
            {notifTitle(n)}
          </Text>
          <Text style={styles.time}>{notifTime(n.createdAt)}</Text>
        </View>
        {message ? (
          <Text style={styles.message} numberOfLines={open ? undefined : 2}>
            {message}
          </Text>
        ) : null}
        {open ? (
          <View style={styles.actions}>
            {route || n.linkUrl ? (
              <Pressable onPress={go} style={styles.go}>
                <Text style={styles.goText}>Перейти →</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onDelete} hitSlop={8} style={styles.delete} accessibilityLabel="Удалить">
              <Trash2 size={16} color={fc.muted} strokeWidth={1.8} />
            </Pressable>
          </View>
        ) : null}
      </View>
      {isNew ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  bar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: fc.line,
  },
  back: { width: 36, height: 44, justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 20, textTransform: 'uppercase', color: colors.text },
  list: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: radii.card,
    backgroundColor: fc.card,
    borderWidth: 1,
    borderColor: fc.border,
  },
  rowNew: { borderColor: 'rgba(229,53,43,0.45)' },
  icon: { fontSize: 20, width: 26, textAlign: 'center', marginTop: 1 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  rowTitle: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  time: { fontFamily: fonts.body, fontSize: 11, color: fc.dim },
  message: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: fc.soft, marginTop: 3 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  go: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radii.control,
    backgroundColor: colors.light,
    justifyContent: 'center',
  },
  goText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.lightText },
  delete: { width: 34, height: 34, borderRadius: 17, backgroundColor: fc.chip, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 6 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 20, textTransform: 'uppercase', color: colors.text },
  emptyText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: fc.muted, textAlign: 'center' },
});
