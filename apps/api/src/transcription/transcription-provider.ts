import { Word } from '../projects/project.types';

export const TRANSCRIPTION_PROVIDER = Symbol('TRANSCRIPTION_PROVIDER');

export interface TranscriptionResult {
  words: Word[];
  language?: string;
}

export interface TranscriptionProvider {
  transcribe(audioPath: string): Promise<TranscriptionResult>;
}
