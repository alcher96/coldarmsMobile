import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, Text, View } from 'react-native';

import { SITE_URL } from '@/api/http';
import { fc } from '@/components/fight/palette';
import { colors, fonts } from '@/theme/tokens';

/**
 * Текст новости из HTML, который присылает API. Разметка там простая (абзацы, списки,
 * заголовки, жирный/курсив, ссылки, картинки), поэтому разбираем её сами, без WebView.
 */

type Run = { text: string; bold?: boolean; italic?: boolean; href?: string; code?: boolean };
type Block =
  | { kind: 'p'; runs: Run[] }
  | { kind: 'h'; level: number; runs: Run[] }
  | { kind: 'li'; marker: string; depth: number; runs: Run[] }
  | { kind: 'quote'; runs: Run[] }
  | { kind: 'img'; src: string }
  | { kind: 'hr' };

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', mdash: '—', ndash: '–', hellip: '…' };

const decode = (s: string) =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isNaN(code) ? m : String.fromCodePoint(code);
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

const attr = (attrs: string, name: string) => {
  const m = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(attrs);
  return m ? decode(m[2] ?? m[3] ?? '') : null;
};

const absolute = (url: string) => (/^https?:\/\//.test(url) ? url : `${SITE_URL}/${url.replace(/^\/+/, '')}`);

const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'ul', 'ol', 'section', 'article']);

type TextBlock = Exclude<Block, { kind: 'img' } | { kind: 'hr' }>;

export function parseHtml(html: string): Block[] {
  const blocks: Block[] = [];
  const lists: { ordered: boolean; n: number }[] = [];
  const marks = { bold: 0, italic: 0, code: 0, href: [] as string[] };
  // Текущий текстовый блок — в объекте, чтобы TypeScript не сужал его до null внутри замыканий.
  const state: { current: TextBlock | null } = { current: null };
  let quote = 0;

  const flush = () => {
    const c = state.current;
    if (c && c.runs.some((r) => r.text.trim())) {
      // Пробелы по краям блока — от переносов строк в исходной разметке.
      c.runs[0].text = c.runs[0].text.replace(/^\s+/, '');
      const last = c.runs[c.runs.length - 1];
      last.text = last.text.replace(/\s+$/, '');
      blocks.push(c);
    }
    state.current = null;
  };
  const open = (block: TextBlock) => {
    flush();
    state.current = block;
  };
  const text = (raw: string) => {
    const t = decode(raw).replace(/\s+/g, ' ');
    if (!t.trim() && !state.current) return;
    state.current ??= quote ? { kind: 'quote', runs: [] } : { kind: 'p', runs: [] };
    state.current.runs.push({
      text: t,
      bold: marks.bold > 0 || undefined,
      italic: marks.italic > 0 || undefined,
      code: marks.code > 0 || undefined,
      href: marks.href[marks.href.length - 1],
    });
  };

  const re = /<(\/?)([a-z0-9]+)([^>]*)>|([^<]+)/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[4] != null) {
      text(m[4]);
      continue;
    }
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrs = m[3];
    if (tag === 'br') {
      state.current?.runs.push({ text: '\n' });
      continue;
    }
    if (tag === 'hr') {
      flush();
      blocks.push({ kind: 'hr' });
      continue;
    }
    if (tag === 'img') {
      const src = attr(attrs, 'src');
      if (src) {
        flush();
        blocks.push({ kind: 'img', src: absolute(src) });
      }
      continue;
    }
    if (tag === 'strong' || tag === 'b') marks.bold += closing ? -1 : 1;
    else if (tag === 'em' || tag === 'i') marks.italic += closing ? -1 : 1;
    else if (tag === 'code') marks.code += closing ? -1 : 1;
    else if (tag === 'a') {
      if (closing) marks.href.pop();
      else marks.href.push(absolute(attr(attrs, 'href') ?? ''));
    } else if (BLOCK_TAGS.has(tag)) {
      if (tag === 'ul' || tag === 'ol') {
        flush();
        if (closing) lists.pop();
        else lists.push({ ordered: tag === 'ol', n: 0 });
      } else if (tag === 'blockquote') {
        flush();
        quote += closing ? -1 : 1;
      } else if (closing) flush();
      else if (tag === 'li') {
        const list = lists[lists.length - 1];
        const marker = list?.ordered ? `${++list.n}.` : '•';
        open({ kind: 'li', marker, depth: Math.max(0, lists.length - 1), runs: [] });
      } else if (/^h[1-6]$/.test(tag)) open({ kind: 'h', level: Number(tag[1]), runs: [] });
      else open(quote ? { kind: 'quote', runs: [] } : { kind: 'p', runs: [] });
    }
  }
  flush();
  return blocks;
}

function Runs({ runs }: { runs: Run[] }) {
  return runs.map((r, i) => (
    <Text
      key={i}
      style={[r.bold && styles.bold, r.italic && styles.italic, r.code && styles.code, r.href && styles.link]}
      onPress={r.href ? () => WebBrowser.openBrowserAsync(r.href!) : undefined}>
      {r.text}
    </Text>
  ));
}

export function HtmlBody({ html }: { html: string }) {
  const blocks = parseHtml(html);
  return (
    <View style={styles.body}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'h':
            return (
              <Text key={i} style={[styles.h, b.level <= 2 && styles.hBig]}>
                <Runs runs={b.runs} />
              </Text>
            );
          case 'li':
            return (
              <View key={i} style={[styles.li, { paddingLeft: b.depth * 16 }]}>
                <Text style={styles.marker}>{b.marker}</Text>
                <Text style={[styles.text, styles.flex]}>
                  <Runs runs={b.runs} />
                </Text>
              </View>
            );
          case 'quote':
            return (
              <Text key={i} style={[styles.text, styles.quote]}>
                <Runs runs={b.runs} />
              </Text>
            );
          case 'img':
            return <Image key={i} source={b.src} style={styles.img} contentFit="contain" />;
          case 'hr':
            return <View key={i} style={styles.hr} />;
          default:
            return (
              <Text key={i} style={styles.text}>
                <Runs runs={b.runs} />
              </Text>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12 },
  flex: { flex: 1 },
  text: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: '#D5D6DA' },
  h: { fontFamily: fonts.display, fontSize: 18, lineHeight: 22, textTransform: 'uppercase', color: colors.text, marginTop: 6 },
  hBig: { fontSize: 22, lineHeight: 26 },
  bold: { fontFamily: fonts.bodySemi, color: colors.text },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: 'monospace', fontSize: 13, color: colors.text },
  link: { color: colors.accent, textDecorationLine: 'underline' },
  li: { flexDirection: 'row', gap: 10, marginTop: -4 },
  marker: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 23, color: colors.accent, minWidth: 12 },
  quote: { borderLeftWidth: 2, borderLeftColor: colors.accent, paddingLeft: 12, fontStyle: 'italic', color: fc.soft },
  img: { width: '100%', aspectRatio: 16 / 9, borderRadius: 8, backgroundColor: fc.chip },
  hr: { height: StyleSheet.hairlineWidth, backgroundColor: fc.line },
});
