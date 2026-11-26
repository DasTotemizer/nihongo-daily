/**
 * Japanese markup used in /content files.
 *
 *   {私|わたし} は {学生|がくせい} です。
 *
 * - Words are separated by spaces. Spaces are never shown in Japanese.
 * - {base|reading} gives a reading (furigana) for kanji. Every kanji needs one.
 * - {base|reading|romaji} overrides the romaji, e.g. {は||ha} for the kana itself.
 * - word@vocab-id links a word to the vocab table (tap-to-translate later).
 * - A standalone は / へ / を is treated as a particle: wa / e / o.
 */
import * as wanakana from 'wanakana';

import type { Inline, InlineRun, JaLine, JaToken, RubySegment } from '../../src/content/types';

const KANJI = /[㐀-䶿一-鿿豈-﫿々〆]/;
const JA_CHAR = /[　-〿぀-ゟ゠-ヿ㐀-䶿一-鿿＀-￯々〆～]/;
const PUNCT = /^[。、！？「」『』（）・…〜～：；!?,.　ー—]+$/;
const TRAILING_PUNCT = /([。、！？」』）…]+)$/;
const SPLIT_PUNCT = /[。、！？「」『』（）…]/;
const LEADING_PUNCT = /^([「『（]+)/;

export class MarkupError extends Error {}

const PARTICLE_ROMAJI: Record<string, string> = { は: 'wa', へ: 'e', を: 'o' };

function toRomaji(kana: string): string {
  return wanakana.toRomaji(kana).replace(/ー/g, '-');
}

/** Parse one word such as "{食|た}べる@taberu" into a token. */
export function parseWord(raw: string, where: string): JaToken {
  let word = raw;
  let vocab: string | undefined;
  const at = word.lastIndexOf('@');
  if (at > 0 && /^[a-z0-9-]+$/.test(word.slice(at + 1))) {
    vocab = word.slice(at + 1);
    word = word.slice(0, at);
  }
  if (PUNCT.test(word)) {
    return { s: [{ b: word }], p: true };
  }
  const segments: RubySegment[] = [];
  let romajiOverride: string | undefined;
  const re = /\{([^|}]+)\|([^|}]*)(?:\|([^}]*))?\}|([^{]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(word))) {
    if (m[1] !== undefined) {
      const base = m[1];
      const reading = m[2];
      if (m[3] !== undefined) romajiOverride = (romajiOverride ?? '') + m[3];
      if (reading && !wanakana.isKana(reading.replace(/ー/g, 'ー'))) {
        throw new MarkupError(`${where}: reading "${reading}" for "${base}" must be kana`);
      }
      if (KANJI.test(base) && !reading) {
        throw new MarkupError(`${where}: "${base}" contains kanji but has no reading`);
      }
      segments.push(reading ? { b: base, r: reading } : { b: base });
    } else {
      const plain = m[4];
      if (KANJI.test(plain)) {
        throw new MarkupError(`${where}: kanji in "${plain}" needs a reading, e.g. {${plain}|...}`);
      }
      segments.push({ b: plain });
    }
  }
  const reading = segments.map((s) => s.r ?? s.b).join('');
  const surface = segments.map((s) => s.b).join('');
  let rm: string;
  if (romajiOverride !== undefined) rm = romajiOverride;
  else if (PARTICLE_ROMAJI[surface]) rm = PARTICLE_ROMAJI[surface];
  else rm = toRomaji(reading);
  const token: JaToken = { s: segments, rm };
  if (vocab) token.v = vocab;
  return token;
}

/** Parse a whole Japanese line (space-separated words). */
export function parseJaLine(src: string, where: string): JaLine {
  const tokens: JaLine = [];
  // Put spaces around punctuation that sits outside {...} so it becomes its own token.
  let spaced = '';
  let depth = 0;
  for (const ch of src) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    spaced += depth === 0 && SPLIT_PUNCT.test(ch) ? ` ${ch} ` : ch;
  }
  for (const rawWord of spaced.trim().split(/\s+/).filter(Boolean)) {
    let word = rawWord;
    const lead = word.match(LEADING_PUNCT);
    if (lead && lead[1] !== word) {
      tokens.push({ s: [{ b: lead[1] }], p: true });
      word = word.slice(lead[1].length);
    }
    const trail = word.match(TRAILING_PUNCT);
    if (trail && trail[1] !== word) {
      tokens.push(parseWord(word.slice(0, -trail[1].length), where));
      tokens.push({ s: [{ b: trail[1] }], p: true });
    } else {
      tokens.push(parseWord(word, where));
    }
  }
  if (tokens.length === 0) throw new MarkupError(`${where}: empty Japanese line`);
  return tokens;
}

/**
 * Parse English prose with embedded Japanese and **bold** / *italic*.
 * Any run of Japanese characters or {base|reading} becomes a Japanese run.
 * Inside a Japanese run, "_" can separate words for romaji, e.g. {私|わたし}_は.
 */
export function parseInline(src: string, where: string): Inline {
  const runs: Inline = [];
  const styled = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const parts = src.split(styled).filter((p) => p !== '');
  for (const part of parts) {
    let bold = false;
    let italic = false;
    let text = part;
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      bold = true;
      text = part.slice(2, -2);
    } else if (/^\*[^*]+\*$/.test(part)) {
      italic = true;
      text = part.slice(1, -1);
    }
    pushMixed(runs, text, bold, italic, where);
  }
  return runs;
}

function pushMixed(runs: Inline, text: string, bold: boolean, italic: boolean, where: string) {
  // Tokenise into Japanese runs ({...} groups and Japanese characters) and other text.
  let i = 0;
  let buf = '';
  let jaBuf = '';
  const flushText = () => {
    if (buf) {
      const run: InlineRun = { k: 'text', t: buf };
      if (bold) run.bold = true;
      if (italic) run.italic = true;
      runs.push(run);
      buf = '';
    }
  };
  const flushJa = () => {
    if (jaBuf) {
      const words = jaBuf.split('_').filter(Boolean);
      const tokens: JaLine = [];
      for (const w of words) tokens.push(...parseJaLine(w, where));
      const run: InlineRun = { k: 'ja', tokens };
      if (bold) run.bold = true;
      runs.push(run);
      jaBuf = '';
    }
  };
  while (i < text.length) {
    const ch = text[i];
    if (ch === '{') {
      const end = text.indexOf('}', i);
      if (end < 0) throw new MarkupError(`${where}: unclosed { in "${text}"`);
      flushText();
      jaBuf += text.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    if (JA_CHAR.test(ch) || (ch === '_' && jaBuf)) {
      flushText();
      jaBuf += ch;
      i++;
      continue;
    }
    if (ch === '@' && jaBuf) {
      // vocab link inside inline Japanese
      const m = text.slice(i).match(/^@[a-z0-9-]+/);
      if (m) {
        jaBuf += m[0];
        i += m[0].length;
        continue;
      }
    }
    flushJa();
    buf += ch;
    i++;
  }
  flushJa();
  flushText();
}

/** Plain Japanese surface text of a line (for search and accessibility). */
export function surfaceOf(line: JaLine): string {
  return line.map((t) => t.s.map((s) => s.b).join('')).join('');
}

/** Reading of a line in kana. */
export function readingOf(line: JaLine): string {
  return line.map((t) => t.s.map((s) => s.r ?? s.b).join('')).join('');
}

export function romajiOf(line: JaLine): string {
  return line
    .filter((t) => !t.p)
    .map((t) => t.rm ?? '')
    .join(' ');
}

export function inlinePlain(inline: Inline): { en: string; ja: string; terms: string[] } {
  let en = '';
  let ja = '';
  const terms: string[] = [];
  for (const run of inline) {
    if (run.k === 'text') en += run.t;
    else {
      const s = surfaceOf(run.tokens);
      en += s;
      ja += s + ' ' + readingOf(run.tokens) + ' ';
      for (const t of run.tokens) if (t.rm) terms.push(t.rm);
    }
  }
  return { en, ja, terms };
}
