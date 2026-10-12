import { groupWordsIntoCaptions, validateCaptions } from './caption-utils';
import { Word } from '../projects/project.types';

describe('groupWordsIntoCaptions', () => {
  const words: Word[] = [
    { id: 'w1', text: 'Hello', startMs: 0, endMs: 300 },
    { id: 'w2', text: 'there.', startMs: 320, endMs: 600 },
    { id: 'w3', text: 'How', startMs: 1500, endMs: 1700 },
    { id: 'w4', text: 'are', startMs: 1710, endMs: 1800 },
    { id: 'w5', text: 'you?', startMs: 1810, endMs: 2050 },
  ];

  it('splits on sentence punctuation and long pauses while retaining word timings', () => {
    const result = groupWordsIntoCaptions(words);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('Hello there.');
    expect(result[1].text).toBe('How are you?');
    expect(result[0].words.map((word) => word.id)).toEqual(['w1', 'w2']);
    expect(result[1].words[2].endMs).toBe(2050);
  });

  it('does not split a sentence just because it contains many words', () => {
    const longSentence: Word[] = Array.from({ length: 9 }, (_, index) => ({
      id: `long-${index}`,
      text: index === 8 ? 'today.' : 'word',
      startMs: index * 250,
      endMs: index * 250 + 150,
    }));
    expect(groupWordsIntoCaptions(longSentence)).toHaveLength(1);
  });

  it('validates ordered, non-overlapping caption parts and word timings', () => {
    const result = groupWordsIntoCaptions(words);
    expect(validateCaptions(result)).toBeNull();
    expect(validateCaptions([{ ...result[0], startMs: 0, endMs: 600 }, { ...result[1], startMs: 500 }])).toContain('overlap');
    expect(validateCaptions([{ ...result[0], words: [] }])).toContain('word-level');
  });
});
