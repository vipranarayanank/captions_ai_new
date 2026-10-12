import { groupWordsIntoCaptions, validateCaptions } from './caption-utils';
import { Word } from '../projects/project.types';

describe('groupWordsIntoCaptions', () => {
  const words: Word[] = [
    { text: 'Hello', startMs: 0, endMs: 300 },
    { text: 'there.', startMs: 320, endMs: 600 },
    { text: 'How', startMs: 1500, endMs: 1700 },
    { text: 'are', startMs: 1710, endMs: 1800 },
    { text: 'you?', startMs: 1810, endMs: 2050 },
  ];

  it('splits on punctuation and long pauses', () => {
    const result = groupWordsIntoCaptions(words);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('Hello there.');
    expect(result[1].text).toBe('How are you?');
  });

  it('validates ordered non-overlapping captions', () => {
    const result = groupWordsIntoCaptions(words);
    expect(validateCaptions(result)).toBeNull();
    expect(validateCaptions([{ ...result[0], startMs: 0, endMs: 600 }, { ...result[1], startMs: 500 }])).toContain('overlap');
  });
});
