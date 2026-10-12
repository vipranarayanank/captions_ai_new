import { randomUUID } from 'node:crypto';
import { Caption, Word } from '../projects/project.types';

/**
 * Groups Gemini's word-timestamp annotations into sentence-like caption parts.
 * Word timestamps are retained; only the part boundaries are inferred from
 * punctuation and pauses, not from estimated word timing.
 */
export function groupWordsIntoCaptions(words: Word[], pauseMs = 700): Caption[] {
  const sorted = [...words]
    .filter((word) => Number.isFinite(word.startMs) && Number.isFinite(word.endMs) && word.endMs > word.startMs)
    .sort((a, b) => a.startMs - b.startMs);

  const captions: Caption[] = [];
  let group: Word[] = [];

  const flush = () => {
    if (!group.length) return;
    const timedWords = group.map((word) => ({
      ...word,
      id: word.id || randomUUID(),
      startMs: Math.round(word.startMs),
      endMs: Math.round(word.endMs),
    }));
    captions.push({
      id: randomUUID(),
      startMs: timedWords[0].startMs,
      endMs: timedWords[timedWords.length - 1].endMs,
      text: timedWords.map((word) => word.text).join(' ').trim(),
      words: timedWords,
    });
    group = [];
  };

  for (const word of sorted) {
    const previous = group[group.length - 1];
    const sentenceEnded = previous && /[.!?]["')\]]?$/.test(previous.text);
    const pause = previous ? word.startMs - previous.endMs > pauseMs : false;
    if (group.length && (sentenceEnded || pause)) flush();
    group.push(word);
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
    if (caption.words.some((word) => !word.id || !word.text.trim() ||
        !Number.isInteger(word.startMs) || !Number.isInteger(word.endMs) ||
        word.startMs < caption.startMs || word.endMs > caption.endMs || word.endMs <= word.startMs)) {
      return 'Each word must have an ID, text, and valid timestamps within its caption part.';
    }
    previousEnd = caption.endMs;
  }
  return null;
}
