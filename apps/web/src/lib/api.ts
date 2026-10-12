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
export type ProjectStatus = 'UPLOADED' | 'EXTRACTING_AUDIO' | 'TRANSCRIBING' | 'READY' | 'FAILED';
export interface Project {
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
  sourceLanguage: string;
  captionLanguage: string;
  templateId: string;
  captions: Caption[];
  createdAt: string;
  updatedAt: string;
  fileSizeBytes: number;
  exportKey?: string | null;
  exportStatus?: string | null;
}
const API = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(/\/$/, '');
export const apiUrl = (path: string) => `${API}${path.startsWith('/') ? path : '/' + path}`;
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), init);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { const body = await response.json(); message = body.message ?? message; } catch {}
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  return response.json() as Promise<T>;
}
export const getProjects = () => request<Project[]>('/projects');
export const getProject = (id: string) => request<Project>(`/projects/${id}`);
export const uploadProject = (file: File, sourceLanguage = 'en', captionLanguage = 'en') => {
  const body = new FormData(); body.append('video', file); body.append('sourceLanguage', sourceLanguage); body.append('captionLanguage', captionLanguage);
  return request<Project>('/projects', { method: 'POST', body });
};
export const patchProject = (id: string, body: Partial<Pick<Project, 'title' | 'templateId'>>) =>
  request<Project>(`/projects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const saveCaptions = (id: string, captions: Caption[]) =>
  request<Project>(`/projects/${id}/captions`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ captions }) });
export const deleteProject = (id: string) => request<{ deleted: boolean }>(`/projects/${id}`, { method: 'DELETE' });

