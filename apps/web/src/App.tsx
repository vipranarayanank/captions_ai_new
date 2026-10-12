import { ChangeEvent, DragEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { CaptionComposition } from './components/CaptionComposition';
import { apiUrl, deleteProject, getProject, getProjects, patchProject, Project, uploadProject, saveCaptions, Caption } from './lib/api';
import { renderMediaOnWeb } from '@remotion/web-renderer';
import { useEditorStore } from './store/editor-store';
import { CAPTION_TEMPLATES, CAPTION_TRANSITIONS, type CaptionAnimation } from './templates';

const LANGUAGES = [
  ['en', 'English'], ['ta', 'Tamil'], ['hi', 'Hindi'], ['te', 'Telugu'], ['ml', 'Malayalam'],
  ['kn', 'Kannada'], ['bn', 'Bengali'], ['mr', 'Marathi'], ['gu', 'Gujarati'], ['pa', 'Punjabi'],
  ['ur', 'Urdu'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'],
  ['it', 'Italian'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese'], ['ar', 'Arabic'],
  ['id', 'Indonesian'], ['ru', 'Russian'], ['tr', 'Turkish'], ['vi', 'Vietnamese'], ['th', 'Thai'],
] as const;

const formatTime = (ms: number) => {
  const value = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
};
const formatDuration = (seconds: number | null) => seconds == null ? '—' : formatTime(seconds * 1000);
const processing = (status: Project['status']) => ['UPLOADED', 'EXTRACTING_AUDIO', 'TRANSCRIBING'].includes(status);
const statusText: Record<Project['status'], string> = {
  UPLOADED: 'In queue', EXTRACTING_AUDIO: 'Preparing audio', TRANSCRIBING: 'Generating captions', READY: 'Ready to edit', FAILED: 'Failed',
};

export default function App() {
  const [route, setRoute] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const openEditor = (id: string) => {
    window.history.pushState({}, '', `/editor/${id}`);
    setRoute(window.location.pathname);
  };
  const backHome = () => {
    window.history.pushState({}, '', '/');
    setRoute('/');
  };
  const match = route.match(/^\/editor\/([^/]+)/);
  return match ? <Editor key={match[1]} id={decodeURIComponent(match[1])} onBack={backHome} /> : <Home onOpen={openEditor} />;
}

function Home({ onOpen }: { onOpen: (id: string) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [spokenLanguage, setSpokenLanguage] = useState('en');
  const [captionStyle, setCaptionStyle] = useState('native');

  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const projectsRef = useRef<Project[]>([]);
  useEffect(() => { projectsRef.current = projects; }, [projects]);

  const refresh = useCallback(async () => {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load projects.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (projectsRef.current.some((project) => processing(project.status))) void refresh();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const chooseFile = (file?: File) => {
    if (!file) return;
    setError('');
    if (!/^video\/(mp4|quicktime|webm|x-matroska)$/.test(file.type) && !/\.(mp4|mov|webm|mkv)$/i.test(file.name)) {
      setError('Choose an MP4, MOV, WebM, or MKV video.'); return;
    }
    setSelectedFile(file);
  };
  const handleUpload = async () => {
    if (!selectedFile) { fileRef.current?.click(); return; }
    setUploading(true); setError('');
    try {
      const project = await uploadProject(selectedFile, spokenLanguage, captionStyle);
      await refresh();
      onOpen(project.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed.'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const onInput = (event: ChangeEvent<HTMLInputElement>) => chooseFile(event.target.files?.[0]);
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files?.[0]);
  };

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="/" onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', '/'); location.reload(); }}><span className="brand-mark">C</span><span>captify<span className="brand-ai">.ai</span></span></a>
      <div className="topbar-right"><span className="cloud-dot" /> Workspace <span className="avatar">V</span></div>
    </header>
    <section className="home-hero">
      <div className="eyebrow"><span className="sparkle">✳</span> YOUR VIDEO, REIMAGINED</div>
      <h1>Words that make<br /><span>people stop scrolling.</span></h1>
      <p>Turn videos into captivating, styled captions. Upload a clip and let the words do the talking.</p>
      <div className={`upload-card ${dragging ? 'dragging' : ''} ${uploading ? 'busy' : ''}`}>
        <div className={`upload-zone ${dragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}
          onClick={() => !uploading && fileRef.current?.click()} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click(); }}>
          <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mkv" hidden onChange={onInput} />
          <div className="upload-icon">{uploading ? <span className="spinner" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 15.5v3A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-3" /></svg>}</div>
          <strong>{selectedFile ? selectedFile.name : 'Click or drag video here'}</strong>
          <span>{selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB · Ready to upload` : 'MP4, MOV, WebM or MKV · Max 500 MB'}</span>
        </div>
        <div className="language-fields">
          <label className="language-label" htmlFor="spoken-language">◎ <span>Audio Spoken</span></label>
          <select id="spoken-language" className="language-select" value={spokenLanguage} onChange={(e) => setSpokenLanguage(e.target.value)}>
            {LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
          {spokenLanguage !== 'en' && <><label className="language-label" htmlFor="caption-style">Aa <span>Caption Language</span></label>
          <select id="caption-style" className="language-select" value={captionStyle} onChange={(e) => setCaptionStyle(e.target.value)}>
            <option value="native">Native language ({LANGUAGES.find(([code]) => code === spokenLanguage)?.[1] ?? 'Native script'})</option>
            <option value="roman">Romanized {LANGUAGES.find(([code]) => code === spokenLanguage)?.[1] ?? 'captions'} (English letters)</option>
            <option value="english">English translation</option>
          </select></>}
          <p className="language-hint">{spokenLanguage === 'en' ? 'English audio automatically produces English captions.' : captionStyle === 'native' ? 'Captions stay in the original language and writing system.' : captionStyle === 'roman' ? 'Captions keep the original language but use English letters.' : 'Captions are translated into English.'}</p>
        </div>
        <button type="button" className="primary-button upload-submit" disabled={uploading} onClick={() => void handleUpload()}>
          {uploading ? 'Uploading video…' : selectedFile ? 'Generate captions →' : '＋ Choose a video'}
        </button>
      </div>
      {error && <div className="error-banner">{error}</div>}
    </section>
    <section className="projects-section">
      <div className="section-title-row"><div><span className="section-kicker">YOUR LIBRARY</span><h2>Recent projects <span className="count">{projects.length}</span></h2></div><button className="subtle-button" onClick={() => void refresh()}>↻ Refresh</button></div>
      {loading ? <div className="empty-state"><span className="spinner" /> Loading your workspace…</div> :
        projects.length === 0 ? <div className="empty-state"><div className="empty-icon">▧</div><strong>Your first story starts here</strong><span>Upload a video to create your first caption project.</span></div> :
        <div className="project-grid">{projects.map((project) => <article key={project.id} className="project-card">
          <button className="project-open" onClick={() => onOpen(project.id)} aria-label={`Open ${project.title}`}>
            <div className="project-thumb"><div className="thumb-mark">C<span>.</span></div><span className="duration">{formatDuration(project.durationSec)}</span><span className={`project-status ${project.status.toLowerCase()}`}>{processing(project.status) && <span className="mini-spinner" />}{statusText[project.status]}</span></div>
            <div className="project-meta"><strong>{project.title}</strong><span>{new Date(project.updatedAt).toLocaleDateString()} · {project.status === 'READY' ? `${project.captions.length} captions` : 'Video project'}</span></div>
          </button>
          {project.status === 'FAILED' && <p className="project-error">{project.errorMessage || 'Processing failed. Try another video.'}</p>}
          <button className="delete-project" title="Delete project" onClick={async () => { if (confirm(`Delete “${project.title}”?`)) { await deleteProject(project.id); await refresh(); } }}>×</button>
        </article>)}</div>}
    </section>
    <footer className="app-footer"><span>CAPTIFY AI</span><span>Make every second count.</span></footer>
  </main>;
}

function Editor({ id, onBack }: { id: string; onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('Saved');
  const [currentMs, setCurrentMs] = useState(0);
  const [title, setTitle] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('NOT_STARTED');
  const [exportProgress, setExportProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [styleTab, setStyleTab] = useState<'edit' | 'templates' | 'transitions'>('templates');
  const [transitionName, setTransitionName] = useState<CaptionAnimation | undefined>(undefined);
  const [wordsOnScreen, setWordsOnScreen] = useState(4);
  const [captionScale, setCaptionScale] = useState(100);
  const [captionX, setCaptionX] = useState(50);
  const [captionY, setCaptionY] = useState(65);
  const [applyToAll, setApplyToAll] = useState(false);
  const [behindPerson, setBehindPerson] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [captionPosition, setCaptionPosition] = useState<'top' | 'middle' | 'bottom'>('middle');
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const [previewDimensions, setPreviewDimensions] = useState({ width: 1080, height: 1920 });
  const playerRef = useRef<PlayerRef>(null);
  const dragRef = useRef<{ id: string; startX: number; startMs: number; endMs: number; width: number; mode: 'move' | 'start' | 'end' } | null>(null);
  const lastProjectId = useRef('');
  const project = useEditorStore((s) => s.project);
  const captions = useEditorStore((s) => s.captions);
  const selectedId = useEditorStore((s) => s.selectedCaptionId);
  const setProject = useEditorStore((s) => s.setProject);
  const setCaptions = useEditorStore((s) => s.setCaptions);
  const updateCaption = useEditorStore((s) => s.updateCaption);
  const patchCaption = useEditorStore((s) => s.patchCaption);
  const selectCaption = useEditorStore((s) => s.selectCaption);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        let p = await getProject(id);
        while (alive && processing(p.status)) {
          await new Promise((resolve) => window.setTimeout(resolve, 5000));
          p = await getProject(id);
        }
        if (alive) { setProject(p); setTitle(p.title); if (p.status === 'FAILED') setError(p.errorMessage || 'Video processing failed.'); }
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : 'Could not load project.'); }
      finally { if (alive) setLoading(false); }
    };
    void load();
    return () => { alive = false; };
  }, [id, setProject]);

  useEffect(() => {
    if (!project) return;
    if (lastProjectId.current !== project.id) { lastProjectId.current = project.id; return; }
    setSaveStatus('Saving…');
    const timer = window.setTimeout(async () => {
      try { await saveCaptions(id, captions); setSaveStatus('Saved'); }
      catch (e) { setSaveStatus('Save failed'); setError(e instanceof Error ? e.message : 'Could not save captions.'); }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [captions, id, project]);

  const requestExport = async () => {
    if (!project || !project.durationSec) {
      setError('Video duration is unavailable. Reload the project and try again.');
      return;
    }
    setError('');
    setExporting(true);
    setExportProgress(0);
    setExportStatus('PROCESSING');
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(null);
    try {
      // Save the latest caption edits before starting the local browser render.
      await saveCaptions(id, captions);
      const fps = project.fps && project.fps > 0 ? Math.round(project.fps) : 30;
      const durationInFrames = Math.max(1, Math.ceil(project.durationSec * fps));
      const result = await renderMediaOnWeb({
        composition: {
          id: 'CaptionsVideo',
          component: CaptionComposition,
          defaultProps: { src: videoSrc, captions, templateId: project.templateId, transitionName, captionPosition },
          durationInFrames,
          fps,
          width: project.width && project.width > 0 ? project.width : 1080,
          height: project.height && project.height > 0 ? project.height : 1920,
        },
        inputProps: { src: videoSrc, captions, templateId: project.templateId, transitionName, captionPosition },
        container: 'mp4',
        videoCodec: 'h264',
        pageResponsiveness: 'medium',
        onProgress: ({ progress }) => setExportProgress(Math.min(100, Math.floor(progress * 100))),
      });
      const blob = await result.getBlob();
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setExportStatus('READY');
      setExportProgress(100);
      setSaveStatus('Export ready');
    } catch (e) {
      setExportStatus('FAILED');
      setError(e instanceof Error ? e.message : 'Browser video export failed. Try Chrome or a shorter video.');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return;
      if (event.code === 'Space') { event.preventDefault(); const player = playerRef.current; if (player) { if (player.isPlaying()) player.pause(); else player.play(); } }
      if (event.key === 'ArrowLeft') playerRef.current?.seekTo(Math.max(0, Math.floor(currentMs / 1000 * 30) - 15));
      if (event.key === 'ArrowRight') playerRef.current?.seekTo(Math.floor(currentMs / 1000 * 30) + 15);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentMs, redo, undo]);

  const durationMs = Math.max(1000, (project?.durationSec ?? 30) * 1000);
  const selected = captions.find((caption) => caption.id === selectedId);
  const videoSrc = useMemo(() => apiUrl(`/projects/${id}/media`), [id]);

  useEffect(() => {
    if (!videoSrc) return;
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = videoSrc;
    video.onloadedmetadata = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) setPreviewDimensions({ width: video.videoWidth, height: video.videoHeight });
    };
    return () => { video.onloadedmetadata = null; video.src = ''; };
  }, [videoSrc]);
  const seek = (ms: number) => { setCurrentMs(ms); playerRef.current?.seekTo(Math.floor(ms / 1000 * 30)); };
  const changeTemplate = async (templateId: string) => {
    if (!project) return;
    try { const updated = await patchProject(id, { templateId }); setProject({ ...updated, captions }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update style.'); }
  };
  const changeCaptionPosition = (position: 'top' | 'middle' | 'bottom') => {
    setCaptionPosition(position);
  };
  const rename = async () => {
    setRenaming(false);
    if (!title.trim() || title.trim() === project?.title || !project) return;
    try { const updated = await patchProject(id, { title: title.trim() }); setProject({ ...updated, captions }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not rename project.'); }
  };
  const beginTimelineDrag = (event: ReactPointerEvent<HTMLButtonElement>, caption: Caption) => {
    event.stopPropagation();
    const track = event.currentTarget.parentElement as HTMLElement;
    const blockRect = event.currentTarget.getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();
    const nearStart = event.clientX - blockRect.left < 8;
    const nearEnd = blockRect.right - event.clientX < 8;
    dragRef.current = {
      id: caption.id, startX: event.clientX, startMs: caption.startMs, endMs: caption.endMs,
      width: trackRect.width, mode: nearStart ? 'start' : nearEnd ? 'end' : 'move',
    };
    setCaptions(captions);
    selectCaption(caption.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveTimelineDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !drag.width) return;
    const delta = (event.clientX - drag.startX) / drag.width * durationMs;
    const index = captions.findIndex((caption) => caption.id === drag.id);
    const previousEnd = index > 0 ? captions[index - 1].endMs : 0;
    const nextStart = index >= 0 && index < captions.length - 1 ? captions[index + 1].startMs : durationMs;
    if (drag.mode === 'move') {
      const length = drag.endMs - drag.startMs;
      const startMs = Math.max(previousEnd, Math.min(nextStart - length, Math.round((drag.startMs + delta) / 10) * 10));
      patchCaption(drag.id, { startMs, endMs: startMs + length });
    } else if (drag.mode === 'start') {
      const startMs = Math.max(previousEnd, Math.min(drag.endMs - 200, Math.round((drag.startMs + delta) / 10) * 10));
      patchCaption(drag.id, { startMs });
    } else {
      const endMs = Math.min(nextStart, durationMs, Math.max(drag.startMs + 200, Math.round((drag.endMs + delta) / 10) * 10));
      patchCaption(drag.id, { endMs });
    }
  };
  const endTimelineDrag = () => { dragRef.current = null; };

  const splitSelected = () => {
    if (!selected || selected.text.trim().split(/\\s+/).length < 2) return;
    const words = selected.text.trim().split(/\\s+/);
    const splitIndex = Math.ceil(words.length / 2);
    const splitMs = Math.max(selected.startMs + 200, Math.min(selected.endMs - 200, currentMs));
    const at = splitMs > selected.startMs + 100 && splitMs < selected.endMs - 100
      ? splitMs : Math.round((selected.startMs + selected.endMs) / 2);
    const first: Caption = { ...selected, endMs: at, text: words.slice(0, splitIndex).join(' '), words: [] };
    const second: Caption = { id: crypto.randomUUID(), startMs: at, endMs: selected.endMs, text: words.slice(splitIndex).join(' '), words: [] };
    setCaptions(captions.flatMap((caption) => caption.id === selected.id ? [first, second] : [caption]));
    selectCaption(second.id);
  };
  const mergeSelected = () => {
    if (!selected) return;
    const index = captions.findIndex((caption) => caption.id === selected.id);
    if (index <= 0 || captions[index - 1].endMs > selected.startMs) return;
    const previous = captions[index - 1];
    const merged: Caption = { ...previous, endMs: selected.endMs, text: `${previous.text} ${selected.text}`.trim(), words: [...previous.words, ...selected.words] };
    setCaptions(captions.flatMap((caption) => caption.id === previous.id ? [merged] : caption.id === selected.id ? [] : [caption]));
    selectCaption(previous.id);
  };

  const addCaption = () => {
    const startMs = Math.round(currentMs / 100) * 100;
    const endMs = Math.min(durationMs, startMs + 1500);
    if (endMs - startMs < 200) return;
    const caption: Caption = { id: crypto.randomUUID(), startMs, endMs, text: 'Your caption', words: [] };
    const next = [...captions, caption].sort((a, b) => a.startMs - b.startMs);
    setCaptions(next); selectCaption(caption.id);
  };
  const removeCaption = (captionId: string) => { setCaptions(captions.filter((caption) => caption.id !== captionId)); if (selectedId === captionId) selectCaption(null); };

  if (loading) return <div className="editor-loading"><span className="spinner" /> Preparing your project…</div>;
  if (!project) return <div className="editor-loading"><p>{error || 'Project not found.'}</p><button className="primary-button" onClick={onBack}>Back to projects</button></div>;
  if (processing(project.status)) return <div className="editor-loading"><span className="spinner" /><h2>Making your captions</h2><p>{statusText[project.status]}… Keep this tab open or come back later.</p><button className="subtle-button" onClick={onBack}>Back to projects</button></div>;

  return <main className="editor-shell">
    <header className="editor-topbar">
      <button className="back-button" onClick={onBack}>← <span>Projects</span></button>
      <div className="editor-project-title">{renaming ? <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => void rename()} onKeyDown={(e) => e.key === 'Enter' && void rename()} autoFocus /> : <button onClick={() => setRenaming(true)} title="Rename project">{project.title} <span>✎</span></button>}<small><span className="cloud-dot" /> {saveStatus}</small></div>
      <div className="editor-actions"><button className="icon-button" title="Undo (Ctrl+Z)" onClick={undo}>↶</button><button className="icon-button" title="Redo (Ctrl+Shift+Z)" onClick={redo}>↷</button>{downloadUrl && exportStatus === 'READY' ? <a className="primary-button small" href={downloadUrl} download={`${project.title || 'captify-video'}.mp4`}>Download MP4 <span>↓</span></a> : <button className="primary-button small" disabled={exporting || project?.status !== 'READY'} onClick={() => void requestExport()}>{exporting ? `Rendering ${exportProgress}%…` : 'Export video'} <span>↗</span></button>}</div>
    </header>
    {error && <div className="error-banner editor-error">{error}<button onClick={() => setError('')}>×</button></div>}
    <div className="editor-workspace">
      <aside className="caption-panel">
        <div className="panel-heading"><div><span className="section-kicker">TRANSCRIPT</span><h2>Captions <span className="count">{captions.length}</span></h2></div><button className="add-caption" onClick={addCaption}>＋</button></div>
        <div className="template-picker">
          <div className="style-tabs" role="tablist" aria-label="Caption styling">
            <button role="tab" aria-selected={styleTab === 'edit'} className={styleTab === 'edit' ? 'active' : ''} onClick={() => setStyleTab('edit')}>Edit</button>
            <button role="tab" aria-selected={styleTab === 'templates'} className={styleTab === 'templates' ? 'active' : ''} onClick={() => setStyleTab('templates')}>Templates</button>
            <button role="tab" aria-selected={styleTab === 'transitions'} className={styleTab === 'transitions' ? 'active' : ''} onClick={() => setStyleTab('transitions')}>Transitions</button>
          </div>
          {styleTab === 'templates' ? <>
            <div className="template-heading"><span>CAPTION TEMPLATES</span><span>{CAPTION_TEMPLATES.length} presets</span></div>
            <div className="template-grid">{CAPTION_TEMPLATES.map((item) =>
              <button key={item.id} className={`template-card template-${item.id} ${project.templateId === item.id ? 'active' : ''}`} onClick={() => { setTransitionName(undefined); void changeTemplate(item.id); }}>
                <span className="template-thumb" style={{fontFamily:`"${item.font}",sans-serif`,fontWeight:item.weight,color:item.color,textShadow:item.shadow,background:item.background,textTransform:item.uppercase?'uppercase':'none',fontSize:`clamp(10px, .95vw, ${Math.round(item.sizeRel*190)}px)`}}>
                  {item.id === 'hind' ? <><span>this is</span><span>sample text</span><i>nono</i></> : item.id === 'boxed' ? <><span>this is sample</span><i>text</i></> : item.id === 'podcast' ? <><b>I'M NOT</b><b>GOING TO DO IT</b><b>BECAUSE</b><b>THERE ARE</b></> : item.id === 'master' ? <><span>this is a</span><b>choice</b></> : item.id === 'simple' ? <><b>this is</b><b>sample</b><b>text</b></> : item.id === 'sliding-highlight' ? <b>this is sample</b> : <b>{item.id === 'mrbeast-classic' ? 'THIS IS' : item.name.toUpperCase()}</b>}
                </span>
                <small>{item.name}</small>
                {project.templateId === item.id && <div className="template-position-controls" role="group" aria-label="Caption position">
                  {(['top','middle','bottom'] as const).map(position => <button key={position} type="button" className={`template-position-button ${captionPosition === position ? 'selected' : ''}`} onClick={event => { event.stopPropagation(); changeCaptionPosition(position); }}>{position === 'middle' ? 'Middle' : position === 'top' ? 'Top' : 'Bottom'}</button>)}
                </div>}
              </button>)}</div>
          </> : styleTab === 'transitions' ? <>
            <div className="template-heading"><span>CAPTION TRANSITIONS</span><span>Entrance effects</span></div>
            <div className="transition-grid">{CAPTION_TRANSITIONS.map((item) =>
              <button key={item.id} className={`transition-card ${(transitionName ?? CAPTION_TEMPLATES.find(t => t.id === project.templateId)?.animationIn) === item.id ? 'active' : ''}`} onClick={() => setTransitionName(item.id)}>
                <span className={`transition-sample anim-${item.id}`}>Aa</span><strong>{item.name}</strong><small>{item.description}</small>
              </button>)}</div>
          </> : <div className="caption-edit-panel">
            <button className="save-template-button" onClick={() => window.alert('Custom template saving will be connected later.')}>▣ Save as my template</button>
            <div className="edit-panel-title"><strong>Text</strong><button className="hard-reset-button" onClick={() => { setWordsOnScreen(4); setCaptionScale(100); setCaptionX(50); setCaptionY(65); setBehindPerson(false); }}>↶ Hard Reset</button></div>
            <textarea aria-label="Selected caption text" className="edit-caption-text" value={selected?.text ?? ''} onChange={(e) => selected && updateCaption(selected.id,{text:e.target.value})} placeholder="Select a caption to edit" rows={2}/>
            <div className="words-count-row"><strong>Words on screen</strong><button onClick={() => setWordsOnScreen(v=>Math.max(1,v-1))}>−</button><b>{wordsOnScreen}</b><button onClick={() => setWordsOnScreen(v=>Math.min(12,v+1))}>＋</button><button onClick={() => setWordsOnScreen(0)}>Auto</button></div>
            <p className="edit-help">How many words this caption shows. Other captions keep their own length.</p>
            <div className="per-word-card"><strong>Per-word editing</strong><p>Edit by</p><div><button className="edit-mode-active">Word</button><button>Line</button></div><small>Double-click a word in the preview to move, resize, recolour, glow or give it a different template on its own.</small></div>
            <div className="edit-fields-row"><strong>Position</strong><label>X <input type="number" value={captionX} onChange={e=>setCaptionX(Number(e.target.value))}/></label><label>Y <input type="number" value={captionY} onChange={e=>setCaptionY(Number(e.target.value))}/></label></div>
            <label className="edit-slider-label">Scale <span>{captionScale}%</span><input type="range" min="50" max="220" value={captionScale} onChange={e=>setCaptionScale(Number(e.target.value))}/></label>
            <div className="edit-fields-row"><strong>Font</strong><select defaultValue="Poppins"><option>Poppins</option><option>Inter</option><option>Montserrat</option><option>Anton</option><option>Playfair Display</option></select><select defaultValue="Inter"><option>Inter</option><option>Raleway</option><option>Space Mono</option><option>Permanent Marker</option></select></div>
            <div className="edit-fields-row"><strong>Words on screen</strong><select defaultValue="4 words"><option>1 word</option><option>2 words</option><option>4 words</option><option>6 words</option><option>Auto</option></select></div>
            <button className={`behind-person-setting ${behindPerson?'enabled':''}`} onClick={()=>setBehindPerson(v=>!v)}><span><strong>▱ Behind person</strong><small>Move your captions behind the person — once per project.</small></span><b>{behindPerson?'ON':'OFF'}</b></button>
            <div className="edit-colors"><strong>Colors</strong>{['Headline 1','Headline 2','Script line'].map((label,i)=><label key={label}>{label}<input type="color" defaultValue={['#ffea00','#ff6d00','#ffffff'][i]}/><code>{['#FFEA00','#FF6D00','#FFFFFF'][i]}</code></label>)}</div>
            <button className={`apply-all-setting ${applyToAll?'enabled':''}`} onClick={()=>setApplyToAll(v=>!v)}>Apply to All <b>{applyToAll?'ON':'OFF'}</b><small>Apply edits to all chunks of this template</small></button>
          </div>}
        </div>      </aside>
      <section className="preview-panel">
        <div className="preview-header"><div><span className="section-kicker">LIVE PREVIEW</span><h2>Style your story</h2></div><span className="aspect-label">{previewDimensions.width >= previewDimensions.height ? '16:9 · HORIZONTAL' : '9:16 · VERTICAL'}</span></div>
        <div className="player-wrap">{project.status === 'READY' && <Player ref={playerRef} component={CaptionComposition} inputProps={{ src: videoSrc, captions, templateId: project.templateId, transitionName, captionPosition }} durationInFrames={Math.max(1, Math.ceil((project.durationSec ?? 30) * 30))} fps={30} compositionWidth={previewDimensions.width} compositionHeight={previewDimensions.height} controls clickToPlay style={{ width: '100%', maxWidth: previewDimensions.width >= previewDimensions.height ? '100%' : 'min(100%, 420px)', height: '100%', maxHeight: '100%', aspectRatio: `${previewDimensions.width} / ${previewDimensions.height}`, backgroundColor: '#090a10', borderRadius: 8, overflow: 'hidden' }} onFrameUpdate={(frame: number) => { if (frame % 3 === 0) setCurrentMs(frame / 30 * 1000); }} />}</div>

      </section>
      <aside className="properties-panel legacy-properties-panel">
        <div className="panel-heading"><div><span className="section-kicker">DETAILS</span><h2>Properties</h2></div></div>
        {selected ? <><div className="property-group"><label>Caption text</label><textarea className="property-text" value={selected.text} onChange={(e) => updateCaption(selected.id, { text: e.target.value })} rows={4} /><span className="hint">Keep it short for maximum impact.</span></div><div className="property-group"><label>Timing</label><div className="property-time"><div><span>START (SEC)</span><input type="number" min="0" step=".1" value={(selected.startMs / 1000).toFixed(1)} onChange={(e) => updateCaption(selected.id, { startMs: Math.max(0, Math.round(Number(e.target.value) * 1000)) })} /></div><div><span>END (SEC)</span><input type="number" min=".2" step=".1" value={(selected.endMs / 1000).toFixed(1)} onChange={(e) => updateCaption(selected.id, { endMs: Math.max(selected.startMs + 200, Math.round(Number(e.target.value) * 1000)) })} /></div></div></div><div className="caption-actions"><button className="subtle-button" disabled={selected.text.trim().split(/\\s+/).length < 2} onClick={splitSelected}>Split caption</button><button className="subtle-button" disabled={captions.findIndex((caption) => caption.id === selected.id) <= 0 || captions[captions.findIndex((caption) => caption.id === selected.id) - 1]?.endMs > selected.startMs} onClick={mergeSelected}>Merge previous</button></div><button className="danger-button" onClick={() => removeCaption(selected.id)}>Delete caption</button></> : <div className="property-empty"><div>✦</div><strong>Select a caption</strong><p>Choose a caption to edit its text and timing.</p></div>}
        <div className="keyboard-hints"><span>KEYBOARD SHORTCUTS</span><p><kbd>Space</kbd> Play / pause</p><p><kbd>←</kbd> <kbd>→</kbd> Seek 0.5 seconds</p><p><kbd>Ctrl</kbd> + <kbd>Z</kbd> Undo</p></div>
      </aside>
    </div>
    <section className="timeline-panel">
      <div className="timeline-toolbar">
        <strong>Timeline</strong>
        <button onClick={addCaption}>＋ Text</button><button onClick={()=>window.alert('Background controls will be connected later.')}>◈ Background</button><button className="timeline-tool-active">↖ Select</button>
        <button className="timeline-play-button" onClick={()=>{if(playerRef.current){playerRef.current.isPlaying()?playerRef.current.pause():playerRef.current.play();}}}>▶</button>
        <button className={behindPerson?'timeline-tool-active':''} onClick={()=>setBehindPerson(v=>!v)}>▱ Behind person</button><button onClick={()=>window.alert('Emoji picker will be connected later.')}>☺ Emoji</button>
        <span className="timeline-zoom-label">Zoom</span><button disabled>⇧ Upload</button><button onClick={()=>window.alert('Sound controls will be connected later.')}>♫ Sound</button>
        <button onClick={()=>window.alert('Undo history will be connected later.')}>↶</button><button onClick={()=>window.alert('Redo history will be connected later.')}>↷</button>
        <span className="timeline-current-time">{formatTime(currentMs)}</span><button onClick={()=>setTimelineZoom(v=>Math.max(1,v-1))}>⌕−</button><small>{timelineZoom}x</small><button onClick={()=>setTimelineZoom(v=>Math.min(10,v+1))}>⌕＋</button>
      </div>
      <div className="timeline-scroll" ref={timelineScrollRef}>
        <div className="timeline-content" style={{ width: `${timelineZoom * 100}%` }}>
          <div className="timeline-ruler">
            <span>00:00</span>
            <span>{formatTime(durationMs / 4)}</span>
            <span>{formatTime(durationMs / 2)}</span>
            <span>{formatTime(durationMs * .75)}</span>
            <span>{formatTime(durationMs)}</span>
          </div>
          <div
            className="timeline-track"
            onPointerMove={moveTimelineDrag}
            onPointerUp={endTimelineDrag}
            onPointerCancel={endTimelineDrag}
            onClick={(e) => {
              if (dragRef.current) return;
              const rect = e.currentTarget.getBoundingClientRect();
              seek(Math.round(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * durationMs));
            }}
          >
            <div className="timeline-progress" style={{ width: `${Math.min(100, currentMs / durationMs * 100)}%` }} />
            {captions.map((caption) => {
              const spanMs = Math.max(1, caption.endMs - caption.startMs);
              const words = caption.words?.length ? caption.words : caption.text.trim().split(/\\s+/).filter(Boolean).map((text, index, all) => ({
                id: `${caption.id}-word-${index}`,
                text,
                startMs: caption.startMs + spanMs * index / Math.max(1, all.length),
                endMs: caption.startMs + spanMs * (index + 1) / Math.max(1, all.length),
              }));
              return (
                <button
                  key={caption.id}
                  type="button"
                  className={`timeline-block ${selectedId === caption.id ? 'active' : ''}`}
                  style={{
                    left: `${caption.startMs / durationMs * 100}%`,
                    width: `${Math.max(.6, spanMs / durationMs * 100)}%`
                  }}
                  title={caption.text}
                  aria-label={`Caption part: ${caption.text}`}
                  onPointerDown={(e) => beginTimelineDrag(e, caption)}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectCaption(caption.id);
                    seek(caption.startMs);
                  }}
                >
                  {words.map((word) => (
                    <span
                      key={word.id}
                      className="timeline-word"
                      title={`${word.text} · ${(word.startMs / 1000).toFixed(2)}s–${(word.endMs / 1000).toFixed(2)}s`}
                      style={{
                        left: `${Math.max(0, (word.startMs - caption.startMs) / spanMs) * 100}%`,
                        width: `${Math.max(0, (word.endMs - word.startMs) / spanMs) * 100}%`,
                      }}
                    >{word.text}</span>
                  ))}
                </button>
              );
            })}
            <div className="playhead" style={{ left: `${Math.min(100, currentMs / durationMs * 100)}%` }} />
          </div>
          <div
            className="timeline-audio-track"
            role="img"
            aria-label="Audio waveform lane synchronized with the timeline"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              seek(Math.round(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * durationMs));
            }}
          >
            <span className="timeline-audio-label">♫ Audio</span>
            <div className="timeline-audio-wave" aria-hidden="true">
              {Array.from({ length: 240 }, (_, i) => {
                const envelope = 0.18 + Math.abs(Math.sin(i * 0.19) * Math.cos(i * 0.071)) * 0.82;
                const height = 5 + envelope * (9 + Math.abs(Math.sin(i * 0.61)) * 24);
                return <i key={i} style={{ height: `${height}px` }} />;
              })}
            </div>
            <div className="timeline-audio-progress" style={{ width: `${Math.min(100, currentMs / Math.max(1, durationMs) * 100)}%` }} />
            <div className="timeline-audio-playhead" style={{ left: `${Math.min(100, currentMs / Math.max(1, durationMs) * 100)}%` }} />
          </div>
        </div>
      </div>
      <div className="timeline-footer">
        <span>Drag the playhead to scrub · Select a block to edit</span>
        <button className="subtle-button" onClick={addCaption}>＋ Add caption</button>
      </div>
    </section>
    <footer className="editor-footer"><span>CAPTIFY AI</span><span>Autosave is on · Changes save automatically</span></footer>
  </main>;
}
