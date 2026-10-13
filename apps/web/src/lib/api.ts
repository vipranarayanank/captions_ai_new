export interface Word {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  positionX?: number;
  positionY?: number;
  color?: string;
}
export interface Caption {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  words: Word[];
  templateId?: string;
  positionX?: number;
  positionY?: number;
  scale?: number;
  animationIn?: import('../templates').CaptionAnimation;
  animationOut?: import('../templates').CaptionAnimation;
  animationDurationMs?: number;
  fontFamily?: string;
  textColor?: string;
  activeWordColor?: string;
  wordsOnScreen?: number;
  displayMode?: 'word' | 'line';
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
  templateId: string;
  backgroundColor?: string;
  backgroundOnly?: boolean;
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
    try { const body = await response.json(); message = body.message ?? message; } catch { /* Keep the HTTP status fallback for non-JSON errors. */ }
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  return response.json() as Promise<T>;
}
export const getProjects = () => request<Project[]>('/projects');
export const getProject = (id: string) => request<Project>(`/projects/${id}`);
export const uploadProject = (
  file: File,
  sourceLanguage = 'en',
  captionStyle = 'native',
  onProgress?: (progress: number) => void,
): Promise<Project> => new Promise((resolve, reject) => {
  const body = new FormData();
  body.append('video', file);
  body.append('sourceLanguage', sourceLanguage);
  body.append('captionStyle', captionStyle);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', apiUrl('/projects'));
  // Allow large videos and slow connections, but fail instead of spinning forever.
  xhr.timeout = 10 * 60 * 1000;
  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
  };
  xhr.onload = () => {
    if (xhr.status < 200 || xhr.status >= 300) {
      let message = `Upload failed (${xhr.status})`;
      try {
        const response = JSON.parse(xhr.responseText) as { message?: string | string[] };
        if (response.message) message = Array.isArray(response.message) ? response.message.join(', ') : response.message;
      } catch { /* Keep the HTTP status fallback. */ }
      reject(new Error(message));
      return;
    }
    try {
      onProgress?.(100);
      resolve(JSON.parse(xhr.responseText) as Project);
    } catch {
      reject(new Error('The server returned an invalid upload response.'));
    }
  };
  xhr.onerror = () => reject(new Error('Upload failed due to a network or CORS error. Check that the API is running and WEB_ORIGIN matches this website.'));
  xhr.ontimeout = () => reject(new Error('Upload timed out after 10 minutes. Check the API logs and storage connection.'));
  xhr.onabort = () => reject(new Error('Upload was cancelled.'));
  xhr.send(body);
});
export const patchProject = (id: string, body: Partial<Pick<Project, 'title' | 'templateId' | 'backgroundColor' | 'backgroundOnly'>>) =>
  request<Project>(`/projects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const saveCaptions = (id: string, captions: Caption[]) =>
  request<Project>(`/projects/${id}/captions`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ captions }) });
export const deleteProject = (id: string) => request<{ deleted: boolean }>(`/projects/${id}`, { method: 'DELETE' });
