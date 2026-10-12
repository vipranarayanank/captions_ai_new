import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import { TranscriptionProvider, TranscriptionResult } from './transcription-provider';

type GeminiFile = {
  name?: string;
  uri?: string;
  mimeType?: string;
};

type GeminiWordAnnotation = {
  type?: string;
  text?: string;
  start_offset?: string;
  end_offset?: string;
};

type GeminiInteraction = {
  status?: string;
  error?: { message?: string };
  steps?: Array<{
    content?: Array<{
      annotations?: GeminiWordAnnotation[];
    }>;
  }>;
  output_text?: string;
  language?: string;
};

@Injectable()
export class GeminiTranscribeProvider implements TranscriptionProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com';

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required to transcribe videos.');
    }

    this.apiKey = apiKey;
    this.model = config.get<string>('GEMINI_TRANSCRIBE_MODEL') ?? 'gemini-3.5-transcribe';
  }

  async transcribe(audioPath: string): Promise<TranscriptionResult> {
    const stat = await fs.stat(audioPath);
    const mimeType = 'audio/mpeg';
    let uploadedFileName: string | undefined;

    try {
      const startResponse = await fetch(`${this.baseUrl}/upload/v1beta/files`, {
        method: 'POST',
        headers: {
          'x-goog-api-key': this.apiKey,
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(stat.size),
          'X-Goog-Upload-Header-Content-Type': mimeType,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file: { display_name: audioPath.split(/[\\/]/).pop() ?? 'captify-audio.mp3' } }),
      });

      if (!startResponse.ok) {
        throw new Error(await this.getApiError(startResponse, 'Gemini file upload could not be started'));
      }

      const uploadUrl = startResponse.headers.get('x-goog-upload-url');
      if (!uploadUrl) {
        throw new Error('Gemini did not return an upload URL for the audio file.');
      }

      const audioBytes = await fs.readFile(audioPath);
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'x-goog-api-key': this.apiKey,
          'X-Goog-Upload-Offset': '0',
          'X-Goog-Upload-Command': 'upload, finalize',
          'Content-Length': String(audioBytes.byteLength),
        },
        body: new Blob([new Uint8Array(audioBytes)]),
      });

      if (!uploadResponse.ok) {
        throw new Error(await this.getApiError(uploadResponse, 'Gemini audio upload failed'));
      }

      const file = await uploadResponse.json() as GeminiFile;
      if (!file.uri || !file.name) {
        throw new Error('Gemini uploaded the audio but returned incomplete file metadata.');
      }
      uploadedFileName = file.name;

      const interactionResponse = await fetch(`${this.baseUrl}/v1beta/interactions`, {
        method: 'POST',
        headers: {
          'x-goog-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: [{
            type: 'audio',
            uri: file.uri,
            mime_type: file.mimeType ?? mimeType,
          }],
          generation_config: {
            transcription_config: {
              mode: {
                type: 'verbatim',
                timestamp_granularities: ['word'],
              },
            },
          },
        }),
      });

      if (!interactionResponse.ok) {
        throw new Error(await this.getApiError(interactionResponse, 'Gemini transcription failed'));
      }

      const interaction = await interactionResponse.json() as GeminiInteraction;
      const words: TranscriptionResult['words'] = [];

      for (const step of interaction.steps ?? []) {
        for (const content of step.content ?? []) {
          for (const annotation of content.annotations ?? []) {
            if (annotation.type !== 'word_info' || !annotation.text) continue;
            const startMs = this.offsetToMs(annotation.start_offset);
            const endMs = this.offsetToMs(annotation.end_offset);
            const text = annotation.text.trim();
            if (text && endMs > startMs) words.push({ text, startMs, endMs });
          }
        }
      }

      if (!words.length) {
        const status = interaction.status ? ` (status: ${interaction.status})` : '';
        throw new Error(`Gemini returned no word-level timestamps${status}. Check that the model supports the Interactions API and word timestamps.`);
      }

      return {
        words,
        language: interaction.language,
      };
    } finally {
      if (uploadedFileName) {
        // Audio is only needed for this request; best-effort cleanup keeps the Gemini file store tidy.
        await fetch(`${this.baseUrl}/v1beta/${uploadedFileName}`, {
          method: 'DELETE',
          headers: { 'x-goog-api-key': this.apiKey },
        }).catch(() => undefined);
      }
    }
  }

  private offsetToMs(offset?: string): number {
    if (!offset) return 0;
    const seconds = Number.parseFloat(offset.replace(/s$/i, ''));
    return Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 1000)) : 0;
  }

  private async getApiError(response: Response, fallback: string): Promise<string> {
    const body = await response.text().catch(() => '');
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
      return parsed.error?.message ?? parsed.message ?? `${fallback} (HTTP ${response.status}).`;
    } catch {
      return `${fallback} (HTTP ${response.status}): ${body.slice(0, 300)}`;
    }
  }
}
