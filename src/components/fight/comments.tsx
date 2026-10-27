import { router } from 'expo-router';
import { ArrowUp, CornerDownRight, MoreHorizontal, ThumbsDown, ThumbsUp, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  deleteComment,
  editComment,
  loadComments,
  myReactionOf,
  postComment,
  reactComment,
  reportComment,
  type Comment,
  type CommentSort,
} from '@/api/comments';
import { loadMyId } from '@/api/profile';
import { useAsync } from '@/hooks/use-async';
import { initialsOf, timeAgo } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

import { Sheet, SheetScrollView } from './info-sheet';
import { fc } from './palette';

const count = (list: Comment[]) => list.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0);
const authorOf = (c: Comment) => c.authorName ?? 'Анонимный армрестлер';

/** Причины жалобы — те же, что в меню комментария на сайте. */
const REPORT_REASONS = ['Спам', 'Оскорбления', 'Нецензурная лексика', 'Другое'];

const SORTS: { key: CommentSort; label: string }[] = [
  { key: 'popular', label: 'Популярные' },
  { key: 'newest', label: 'Новые' },
  { key: 'oldest', label: 'Старые' },
];

/** Обсуждение боя: превью на «Обзоре», полный список и отправка — в шторке. */
/** `api` — адрес обсуждения: fightComments(id) или newsComments(id). */
export function CommentsCard({ api, initial }: { api: string; initial: Comment[] }) {
  const [comments, setComments] = useState(initial);
  const [open, setOpen] = useState(false);
  const total = count(comments);

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Text style={styles.title}>Обсуждение</Text>
        <Text style={styles.meta}>{total || ''}</Text>
      </View>
      {comments.length === 0 ? (
        <Text style={styles.empty}>Пока нет комментариев — начни первым</Text>
      ) : (
        comments.slice(0, 2).map((c) => <CommentRow key={c.id} c={c} compact />)
      )}
      <Pressable onPress={() => setOpen(true)} style={styles.all}>
        <Text style={styles.allText}>{comments.length ? 'Все комментарии' : 'Написать комментарий'}</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      <CommentsSheet
        api={api}
        visible={open}
        comments={comments}
        onChange={setComments}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

/** Что сейчас пишем в поле ввода: новый комментарий, ответ или правку своего. */
type Draft = { kind: 'new' } | { kind: 'reply'; parentId: string; to: string } | { kind: 'edit'; id: string };

function CommentsSheet({
  api,
  visible,
  comments,
  onChange,
  onClose,
}: {
  api: string;
  visible: boolean;
  comments: Comment[];
  onChange: (c: Comment[]) => void;
  onClose: () => void;
}) {
  const myId = useAsync(loadMyId).data ?? null;
  const [sort, setSort] = useState<CommentSort>('newest');
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<Draft>({ kind: 'new' });
  const [menu, setMenu] = useState<Comment | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState<Set<string>>(() => new Set());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async (s = sort) => onChange(await loadComments(api, s).catch(() => comments));

  const resetDraft = () => {
    setDraft({ kind: 'new' });
    setText('');
    setError(null);
  };

  // «Назад» по шагам: меню → режим ответа/правки → закрыть обсуждение.
  const back = () => {
    if (menu) {
      setMenu(null);
      setReporting(false);
    } else if (draft.kind !== 'new') resetDraft();
    else onClose();
  };

  const changeSort = (s: CommentSort) => {
    setSort(s);
    reload(s);
  };

  const send = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError(null);
    try {
      if (draft.kind === 'edit') {
        if (!(await editComment(api, draft.id, value))) throw new Error('edit');
      } else {
        const res = await postComment(api, value, draft.kind === 'reply' ? draft.parentId : null);
        if (!res.ok) {
          setError(res.status === 403 ? 'Подтвердите почту, чтобы комментировать' : 'Не удалось отправить');
          return;
        }
      }
      resetDraft();
      await reload();
    } catch {
      setError(draft.kind === 'edit' ? 'Не удалось сохранить' : 'Нет связи. Попробуйте ещё раз');
    } finally {
      setSending(false);
    }
  };

  const react = async (id: string, like: boolean) => {
    try {
      if ((await reactComment(api, id, like)).ok) await reload();
    } catch {}
  };

  // Ответ на ответ уходит в ту же ветку: у сайта один уровень вложенности.
  const reply = (c: Comment) => {
    setDraft({ kind: 'reply', parentId: c.parentCommentId ?? c.id, to: authorOf(c) });
    setError(null);
  };

  const startEdit = (c: Comment) => {
    setMenu(null);
    setDraft({ kind: 'edit', id: c.id });
    setText(c.text);
    setError(null);
  };

  const remove = (c: Comment) => {
    setMenu(null);
    Alert.alert('Удалить комментарий?', 'Отменить удаление нельзя.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          if (await deleteComment(api, c.id).catch(() => false)) {
            if (draft.kind === 'edit' && draft.id === c.id) resetDraft();
            await reload();
          } else Alert.alert('Не удалось удалить комментарий');
        },
      },
    ]);
  };

  const report = async (c: Comment, reason: string) => {
    setMenu(null);
    setReporting(false);
    setReported((s) => new Set(s).add(c.id));
    await reportComment(api, c.id, reason).catch(() => null);
  };

  const rowProps = (c: Comment) => ({
    c,
    own: !!myId && c.userId === myId,
    reported: reported.has(c.id),
    onReact: (like: boolean) => react(c.id, like),
    onReply: () => reply(c),
    onMenu: () => {
      setReporting(false);
      setMenu(c);
    },
  });

  const own = !!menu && !!myId && menu.userId === myId;
  const keyboard = useKeyboardHeight();

  return (
    <Sheet visible={visible} onClose={back} tall bare>
      <View style={[styles.flex, { paddingBottom: keyboard }]}>
        <View style={[styles.headRow, styles.sheetHead]}>
          <Text style={styles.sheetTitle}>Обсуждение</Text>
          <Text style={styles.meta}>{count(comments) || ''}</Text>
        </View>
        <View style={styles.sorts}>
          {SORTS.map((s) => (
            <Pressable
              key={s.key}
              onPress={() => changeSort(s.key)}
              style={[styles.sort, sort === s.key && styles.sortOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: sort === s.key }}>
              <Text style={[styles.sortText, sort === s.key && styles.sortTextOn]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
        <SheetScrollView style={styles.flex} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {comments.length === 0 ? <Text style={styles.empty}>Пока нет комментариев — начни первым</Text> : null}
          {comments.map((c) => (
            <View key={c.id}>
              <CommentRow {...rowProps(c)} />
              {(c.replies ?? []).map((r) => (
                <View key={r.id} style={styles.reply}>
                  <CommentRow {...rowProps(r)} />
                </View>
              ))}
            </View>
          ))}
        </SheetScrollView>

        {menu ? (
          <View style={styles.menu}>
            <View style={styles.menuHead}>
              <Text style={styles.menuTitle} numberOfLines={1}>
                {reporting ? 'Пожаловаться' : authorOf(menu)}
              </Text>
              <Pressable onPress={back} hitSlop={10} accessibilityLabel="Закрыть">
                <X size={18} color={fc.muted} strokeWidth={2} />
              </Pressable>
            </View>
            {own ? (
              <>
                <MenuItem label="Изменить" onPress={() => startEdit(menu)} />
                <MenuItem label="Удалить" danger onPress={() => remove(menu)} />
              </>
            ) : reporting ? (
              REPORT_REASONS.map((r) => <MenuItem key={r} label={r} onPress={() => report(menu, r)} />)
            ) : (
              <>
                <MenuItem
                  label="Ответить"
                  onPress={() => {
                    reply(menu);
                    setMenu(null);
                  }}
                />
                {reported.has(menu.id) ? null : (
                  <MenuItem label="Пожаловаться" danger onPress={() => setReporting(true)} />
                )}
              </>
            )}
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {draft.kind !== 'new' ? (
          <View style={styles.mode}>
            <Text style={styles.modeText} numberOfLines={1}>
              {draft.kind === 'reply' ? `Ответ · ${draft.to}` : 'Редактирование комментария'}
            </Text>
            <Pressable onPress={resetDraft} hitSlop={10} accessibilityLabel="Отменить">
              <X size={16} color={fc.muted} strokeWidth={2} />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={draft.kind === 'reply' ? 'Ваш ответ' : 'Твоё мнение о бое'}
            placeholderTextColor={fc.dim}
            multiline
            maxLength={1000}
            autoFocus={draft.kind !== 'new'}
            key={draft.kind === 'new' ? 'new' : draft.kind === 'reply' ? `r${draft.parentId}` : `e${draft.id}`}
          />
          <Pressable
            onPress={send}
            disabled={!text.trim() || sending}
            style={[styles.send, { backgroundColor: text.trim() ? colors.accent : fc.borderStrong }]}
            accessibilityLabel={draft.kind === 'edit' ? 'Сохранить' : 'Отправить'}>
            {sending ? <ActivityIndicator color={colors.text} /> : <ArrowUp size={20} color={colors.text} strokeWidth={2.2} />}
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}

/**
 * Высота открытой клавиатуры. Шторка живёт в Modal, а его окно на Android под клавиатуру
 * не ужимается (и KeyboardAvoidingView там промахивается) — поле ввода поднимаем сами.
 */
function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) =>
      setHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

function MenuItem({ label, danger, onPress }: { label: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
      <Text style={[styles.menuText, danger && { color: fc.coral }]}>{label}</Text>
    </Pressable>
  );
}

/** Автор комментария — его публичный профиль (свой — личный кабинет). */
async function openAuthor(id: string) {
  if (id === (await loadMyId())) router.navigate('/profile');
  else router.push({ pathname: '/user/[id]', params: { id } });
}

function CommentRow({
  c,
  compact,
  own,
  reported,
  onReact,
  onReply,
  onMenu,
}: {
  c: Comment;
  compact?: boolean;
  own?: boolean;
  reported?: boolean;
  onReact?: (like: boolean) => void;
  onReply?: () => void;
  onMenu?: () => void;
}) {
  const mine = myReactionOf(c);
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initialsOf(authorOf(c))}</Text>
      </View>
      <View style={styles.flex}>
        <View style={styles.authorRow}>
          <Text style={[styles.author, styles.flex]} numberOfLines={1}>
            <Text onPress={c.userId ? () => openAuthor(c.userId!) : undefined} suppressHighlighting={!c.userId}>
              {authorOf(c)}
            </Text>
            {own ? <Text style={styles.you}> · вы</Text> : null}{' '}
            <Text style={styles.time}>
              {timeAgo(c.createdAt)}
              {c.editedAt ? ' · изменено' : ''}
            </Text>
          </Text>
          {!compact && !c.isDeleted ? (
            <Pressable onPress={onMenu} hitSlop={10} accessibilityLabel="Действия с комментарием">
              <MoreHorizontal size={18} color={fc.dim} strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
        <Text
          style={[styles.text, c.isDeleted && styles.deleted]}
          numberOfLines={compact ? 3 : undefined}>
          {c.isDeleted ? 'Комментарий удалён' : c.text}
        </Text>
        {reported ? <Text style={styles.reported}>Вы пожаловались на этот комментарий</Text> : null}
        {!compact && !c.isDeleted ? (
          <View style={styles.actions}>
            <Pressable onPress={() => onReact?.(true)} hitSlop={8} style={styles.action} accessibilityLabel="Нравится">
              <ThumbsUp size={14} color={mine === 'like' ? colors.accent : fc.muted} strokeWidth={1.8} />
              <Text style={[styles.actionText, mine === 'like' && { color: colors.accent }]}>{c.likes ?? 0}</Text>
            </Pressable>
            <Pressable onPress={() => onReact?.(false)} hitSlop={8} style={styles.action} accessibilityLabel="Не нравится">
              <ThumbsDown size={14} color={mine === 'dislike' ? colors.text : fc.muted} strokeWidth={1.8} />
              <Text style={[styles.actionText, mine === 'dislike' && { color: colors.text }]}>{c.dislikes ?? 0}</Text>
            </Pressable>
            <Pressable onPress={onReply} hitSlop={8} style={styles.action}>
              <CornerDownRight size={14} color={fc.muted} strokeWidth={1.8} />
              <Text style={styles.actionText}>Ответить</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    backgroundColor: fc.card,
    borderWidth: 1,
    borderColor: fc.border,
    borderRadius: radii.card,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontFamily: fonts.display, fontSize: 18, textTransform: 'uppercase', color: colors.text },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.muted },
  empty: { fontFamily: fonts.body, fontSize: 13, color: fc.muted, paddingVertical: 12 },
  all: { height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  allText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  chevron: { fontSize: 20, color: fc.dim },
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: fc.line,
  },
  reply: { marginLeft: 42 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: fc.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bodySemi, fontSize: 11, color: fc.second },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  author: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  you: { fontFamily: fonts.body, fontSize: 12, color: fc.muted },
  time: { fontFamily: fonts.body, fontSize: 11, color: fc.dim },
  text: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: '#D5D6DA', marginTop: 2 },
  deleted: { fontStyle: 'italic', color: fc.dim },
  reported: { fontFamily: fonts.body, fontSize: 11, color: fc.coral, marginTop: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 8 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontFamily: fonts.bodySemi, fontSize: 12, color: fc.muted },
  sheetHead: { paddingHorizontal: 20, paddingBottom: 8 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 22, textTransform: 'uppercase', color: colors.text },
  sorts: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 6 },
  sort: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: fc.border,
    justifyContent: 'center',
  },
  sortOn: { backgroundColor: colors.text, borderColor: colors.text },
  sortText: { fontFamily: fonts.bodySemi, fontSize: 12, color: fc.muted },
  sortTextOn: { color: colors.bg },
  list: { paddingHorizontal: 20, paddingBottom: 12 },
  menu: {
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: fc.borderStrong,
    backgroundColor: fc.chip,
  },
  menuHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  menuTitle: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 12, color: fc.muted },
  menuItem: { height: 44, justifyContent: 'center' },
  menuText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  pressed: { opacity: 0.6 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.coral, paddingHorizontal: 20, paddingBottom: 6 },
  mode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: fc.border,
  },
  modeText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.muted },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: fc.border,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: fc.borderStrong,
    backgroundColor: colors.bg,
    color: colors.text,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  send: { width: 46, height: 46, borderRadius: radii.control, alignItems: 'center', justifyContent: 'center' },
});
