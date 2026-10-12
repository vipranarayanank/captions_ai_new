import { create } from 'zustand';
import type { Caption, Project } from '../lib/api';

interface EditorState {
  project: Project | null;
  captions: Caption[];
  selectedCaptionId: string | null;
  history: Caption[][];
  future: Caption[][];
  setProject: (project: Project) => void;
  setCaptions: (captions: Caption[]) => void;
  updateCaption: (id: string, patch: Partial<Caption>) => void;
  selectCaption: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
}
const copy = (captions: Caption[]) => captions.map((caption) => ({ ...caption, words: caption.words.map((word) => ({ ...word })) }));
export const useEditorStore = create<EditorState>((set) => ({
  project: null, captions: [], selectedCaptionId: null, history: [], future: [],
  setProject: (project) => set({ project, captions: copy(project.captions ?? []), selectedCaptionId: null, history: [], future: [] }),
  setCaptions: (captions) => set((state) => ({
    history: [...state.history, copy(state.captions)].slice(-50), future: [], captions: copy(captions),
  })),
  updateCaption: (id, patch) => set((state) => ({
    history: [...state.history, copy(state.captions)].slice(-50), future: [],
    captions: state.captions.map((caption) => caption.id === id ? { ...caption, ...patch } : caption),
  })),
  selectCaption: (id) => set({ selectedCaptionId: id }),
  undo: () => set((state) => {
    if (!state.history.length) return state;
    const previous = state.history[state.history.length - 1];
    return { captions: copy(previous), history: state.history.slice(0, -1), future: [copy(state.captions), ...state.future].slice(0, 50) };
  }),
  redo: () => set((state) => {
    if (!state.future.length) return state;
    const next = state.future[0];
    return { captions: copy(next), future: state.future.slice(1), history: [...state.history, copy(state.captions)].slice(-50) };
  }),
}));
