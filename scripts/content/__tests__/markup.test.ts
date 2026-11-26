import path from 'node:path';

import { buildPack } from '../build';
import { MarkupError, parseInline, parseJaLine, romajiOf, surfaceOf } from '../markup';

describe('Japanese markup', () => {
  it('parses words, readings and particles', () => {
    const line = parseJaLine('{私|わたし} は {学生|がくせい} だ。', 't');
    expect(surfaceOf(line)).toBe('私は学生だ。');
    expect(romajiOf(line)).toBe('watashi wa gakusei da');
    expect(line[0].s[0]).toEqual({ b: '私', r: 'わたし' });
    expect(line.at(-1)?.p).toBe(true);
  });
  it('handles okurigana, punctuation inside words and romaji overrides', () => {
    const line = parseJaLine('うん、{食|た}べる {は||ha}', 't');
    expect(surfaceOf(line)).toBe('うん、食べるは');
    expect(line[2].s).toEqual([{ b: '食', r: 'た' }, { b: 'べる' }]);
    expect(line[3].rm).toBe('ha');
  });
  it('turns を and へ into particle romaji', () => {
    expect(romajiOf(parseJaLine('{水|みず} を {飲|の}む', 't'))).toBe('mizu o nomu');
  });
  it('refuses kanji without a reading', () => {
    expect(() => parseJaLine('学生 だ', 'where')).toThrow(MarkupError);
    expect(() => parseInline('The word 学生 means student', 'where')).toThrow(MarkupError);
  });
  it('splits English prose from Japanese runs', () => {
    const runs = parseInline('The particle は is said **wa**.', 't');
    expect(runs.map((r) => r.k)).toEqual(['text', 'ja', 'text', 'text', 'text']);
  });
});

describe('content build', () => {
  it('builds the real content folder without errors', () => {
    const { pack } = buildPack(path.resolve(__dirname, '../../../content'));
    expect(pack.articles.length).toBeGreaterThan(0);
    for (const a of pack.articles.filter((x) => x.kind === 'core')) expect(a.quiz.length).toBeGreaterThan(0);
  });
});
