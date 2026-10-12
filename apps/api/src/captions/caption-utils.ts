import { randomUUID } from 'node:crypto';
import { Caption, Word } from '../projects/project.types';

export function groupWordsIntoCaptions(words: Word[], maxWords = 6, maxDurationMs = 2500): Caption[] {
  const sorted = [...words]
    .filter((word) => Number.isFinite(word.startMs) && Number.isFinite(word.endMs) && word.endMs > word.startMs)
    .sort((a, b) => a.startMs - b.startMs);
  const captions: Caption[] = [];
  let group: Word[] = [];

  const flush = () => {
    if (!group.length) return;
    captions.push({
      id: randomUUID(),
      startMs: group[0].startMs,
      endMs: group[group.length - 1].endMs,
      text: group.map((word) => word.text).join(' ').trim(),
      words: group,
    });
    group = [];
  };

  for (const word of sorted) {
    const previous = group[group.length - 1];
    const sentenceEnded = previous && /[.!?]["')\]]?$/.test(previous.text);
    const pause = previous ? word.startMs - previous.endMs > 700 : false;
    const tooMany = group.length >= maxWords;
    const tooLong = group.length ? word.endMs - group[0].startMs > maxDurationMs : false;
    if (group.length && (sentenceEnded || pause || tooMany || tooLong)) flush();
    group.push({ ...word, startMs: Math.round(word.startMs), endMs: Math.round(word.endMs) });
  }
  flush();
  return captions;
}

export function validateCaptions(captions: Caption[]): string | null {
  let previousEnd = -1;
  for (const caption of captions) {
    if (!Number.isInteger(caption.startMs) || !Number.isInteger(caption.endMs) ||
        caption.startMs < 0 || caption.endMs - caption.startMs < 200) {
      return 'Caption times must be integer milliseconds with a duration of at least 200ms.';
    }
    if (caption.startMs < previousEnd) return 'Captions must be ordered and must not overlap.';
    if (!caption.text.trim()) return 'Caption text cannot be empty.';
    previousEnd = caption.endMs;
  }
  return null;
}
