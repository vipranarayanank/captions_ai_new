import { Word } from '../projects/project.types';

export interface TranscriptionResult {
  words: Word[];
  language?: string;
}

export interface TranscriptionProvider {
  transcribe(audioPath: string): Promise<TranscriptionResult>;
}
