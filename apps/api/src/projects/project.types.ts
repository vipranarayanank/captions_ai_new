export type ProjectStatus =
  | 'UPLOADED'
  | 'EXTRACTING_AUDIO'
  | 'TRANSCRIBING'
  | 'READY'
  | 'FAILED';

export interface Word {
  text: string;
  startMs: number;
  endMs: number;
}

export interface Caption {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  words: Word[];
}

export interface ProjectDto {
  id: string;
  title: string;
  status: ProjectStatus;
  errorMessage: string | null;
  videoKey: string;
  audioKey: string | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  language: string | null;
  templateId: string;
  captions: Caption[];
  createdAt: string;
  updatedAt: string;
}
