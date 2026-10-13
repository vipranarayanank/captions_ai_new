import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { createReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { TranscriptionProvider, TranscriptionResult } from './transcription-provider';

@Injectable()
export class OpenAiWhisperProvider implements TranscriptionProvider {
  private readonly client: OpenAI;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY is required to transcribe videos.');
    this.client = new OpenAI({ apiKey });
  }

  async transcribe(audioPath: string, language?: string): Promise<TranscriptionResult> {
    const response = await this.client.audio.transcriptions.create({
      file: createReadStream(audioPath),
      model: 'whisper-1',
      ...(language ? { language } : {}),
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    });
    const words = ((response as unknown as { words?: Array<{ word: string; start: number; end: number }> }).words ?? [])
      .map((word) => ({
        id: randomUUID(),
        text: word.word.trim(),
        startMs: Math.max(0, Math.round(word.start * 1000)),
        endMs: Math.max(1, Math.round(word.end * 1000)),
      }))
      .filter((word) => word.text && word.endMs > word.startMs);
    return { words, language: (response as unknown as { language?: string }).language };
  }
}
