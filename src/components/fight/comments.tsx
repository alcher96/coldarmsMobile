import { ArrowUp } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { likeComment, loadComments, postComment, type Comment } from '@/api/fight';
import { initialsOf, timeAgo } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

import { Sheet } from './info-sheet';
import { fc } from './palette';

const count = (list: Comment[]) => list.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0);

/** Обсуждение боя: превью на «Обзоре», полный список и отправка — в шторке. */
export function CommentsCard({ fightId, initial }: { fightId: string; initial: Comment[] }) {
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
        fightId={fightId}
        visible={open}
        comments={comments}
        onChange={setComments}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

function CommentsSheet({
  fightId,
  visible,
  comments,
  onChange,
  onClose,
}: {
  fightId: string;
  visible: boolean;
  comments: Comment[];
  onChange: (c: Comment[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => onChange(await loadComments(fightId).catch(() => comments));

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await postComment(fightId, text);
      if (res.ok) {
        setDraft('');
        await reload();
      } else {
        setError(res.status === 403 ? 'Подтвердите почту, чтобы комментировать' : 'Не удалось отправить');
      }
    } catch {
      setError('Нет связи. Попробуйте ещё раз');
    } finally {
      setSending(false);
    }
  };

  const like = async (id: string) => {
    try {
      const res = await likeComment(fightId, id);
      if (res.ok) await reload();
    } catch {}
  };

  return (
    <Sheet visible={visible} onClose={onClose} tall bare>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.headRow, styles.sheetHead]}>
          <Text style={styles.sheetTitle}>Обсуждение</Text>
          <Text style={styles.meta}>{count(comments) || ''}</Text>
        </View>
        <ScrollView style={styles.flex} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {comments.length === 0 ? <Text style={styles.empty}>Пока нет комментариев — начни первым</Text> : null}
          {comments.map((c) => (
            <View key={c.id}>
              <CommentRow c={c} onLike={() => like(c.id)} />
              {(c.replies ?? []).map((r) => (
                <View key={r.id} style={styles.reply}>
                  <CommentRow c={r} onLike={() => like(r.id)} />
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Твоё мнение о бое"
            placeholderTextColor={fc.dim}
            multiline
            maxLength={1000}
          />
          <Pressable
            onPress={send}
            disabled={!draft.trim() || sending}
            style={[styles.send, { backgroundColor: draft.trim() ? colors.accent : fc.borderStrong }]}
            accessibilityLabel="Отправить">
            {sending ? <ActivityIndicator color={colors.text} /> : <ArrowUp size={20} color={colors.text} strokeWidth={2.2} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Sheet>
  );
}

function CommentRow({ c, compact, onLike }: { c: Comment; compact?: boolean; onLike?: () => void }) {
  const liked = c.myReaction === true || c.myReaction === 'Like' || c.myReaction === 'like';
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initialsOf(c.authorName ?? '?')}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.author}>
          {c.authorName ?? 'Аноним'} <Text style={styles.time}>{timeAgo(c.createdAt)}</Text>
        </Text>
        <Text style={styles.text} numberOfLines={compact ? 3 : undefined}>
          {c.text}
        </Text>
        {!compact ? (
          <Pressable onPress={onLike} hitSlop={8} style={styles.like}>
            <Text style={[styles.likeText, liked && { color: colors.accent }]}>▲ {c.likes ?? 0}</Text>
          </Pressable>
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
  author: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  time: { fontFamily: fonts.body, fontSize: 11, color: fc.dim },
  text: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: '#D5D6DA', marginTop: 2 },
  like: { marginTop: 6, alignSelf: 'flex-start' },
  likeText: { fontFamily: fonts.bodySemi, fontSize: 12, color: fc.muted },
  sheetHead: { paddingHorizontal: 20, paddingBottom: 8 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 22, textTransform: 'uppercase', color: colors.text },
  list: { paddingHorizontal: 20, paddingBottom: 12 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 12, color: fc.coral, paddingHorizontal: 20, paddingBottom: 6 },
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
