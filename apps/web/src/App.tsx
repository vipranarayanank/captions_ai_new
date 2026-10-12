import { ChangeEvent, DragEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { CaptionComposition } from './components/CaptionComposition';
import { apiUrl, deleteProject, getProject, getProjects, patchProject, Project, uploadProject, saveCaptions, Caption, startExport, getExportStatus } from './lib/api';
import { useEditorStore } from './store/editor-store';

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
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load projects.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 2000); return () => window.clearInterval(timer); }, [refresh]);

  const handleFiles = async (file?: File) => {
    if (!file) return;
    setError('');
    if (!/^video\/(mp4|quicktime|webm|x-matroska)$/.test(file.type) && !/\.(mp4|mov|webm|mkv)$/i.test(file.name)) {
      setError('Choose an MP4, MOV, WebM, or MKV video.'); return;
    }
    setUploading(true);
    try {
      const project = await uploadProject(file);
      await refresh();
      onOpen(project.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed.'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const onInput = (event: ChangeEvent<HTMLInputElement>) => void handleFiles(event.target.files?.[0]);
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDragging(false); void handleFiles(event.dataTransfer.files?.[0]);
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
      <div className={`upload-zone ${dragging ? 'dragging' : ''} ${uploading ? 'busy' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}
        onClick={() => !uploading && fileRef.current?.click()} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click(); }}>
        <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mkv" hidden onChange={onInput} />
        <div className="upload-icon">{uploading ? <span className="spinner" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 15.5v3A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-3" /></svg>}</div>
        <strong>{uploading ? 'Uploading your video…' : 'Drop your video here, or browse'}</strong>
        <span>{uploading ? 'This may take a moment' : 'MP4, MOV, WebM or MKV · up to 50 MB'}</span>
        <button type="button" className="primary-button" disabled={uploading} onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>{uploading ? 'Uploading' : '＋  Upload a video'}</button>
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
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
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
          await new Promise((resolve) => window.setTimeout(resolve, 2000));
          p = await getProject(id);
        }
        if (alive) { setProject(p); setTitle(p.title); if (p.status === 'FAILED') setError(p.errorMessage || 'Video processing failed.'); if (p.status === 'READY') { void getExportStatus(id).then((result) => { if (alive) { setExportStatus(result.status); setDownloadUrl(result.downloadUrl); } }).catch(() => undefined); } }
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

  useEffect(() => {
    if (!exporting) return;
    let alive = true;
    const poll = async () => {
      try {
        const result = await getExportStatus(id);
        if (!alive) return;
        setExportStatus(result.status);
        if (result.status === 'READY') { setDownloadUrl(result.downloadUrl); setExporting(false); setSaveStatus('Export ready'); }
        else if (result.status === 'FAILED') { setExporting(false); setError(result.errorMessage || 'Export failed.'); }
      } catch (e) {
        if (alive) { setExporting(false); setError(e instanceof Error ? e.message : 'Could not check export status.'); }
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [exporting, id]);

  const requestExport = async () => {
    setError(''); setDownloadUrl(null); setExportStatus('QUEUED'); setExporting(true);
    try { await startExport(id); }
    catch (e) { setExporting(false); setError(e instanceof Error ? e.message : 'Could not start export.'); }
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
  const seek = (ms: number) => { setCurrentMs(ms); playerRef.current?.seekTo(Math.floor(ms / 1000 * 30)); };
  const changeTemplate = async (templateId: string) => {
    if (!project) return;
    try { const updated = await patchProject(id, { templateId }); setProject({ ...updated, captions }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update style.'); }
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
      <div className="editor-actions"><button className="icon-button" title="Undo (Ctrl+Z)" onClick={undo}>↶</button><button className="icon-button" title="Redo (Ctrl+Shift+Z)" onClick={redo}>↷</button>{downloadUrl && exportStatus === 'READY' ? <a className="primary-button small" href={downloadUrl} target="_blank" rel="noreferrer">Download MP4 <span>↓</span></a> : <button className="primary-button small" disabled={exporting || project?.status !== 'READY'} onClick={() => void requestExport()}>{exporting ? 'Exporting…' : 'Export video'} <span>↗</span></button>}</div>
    </header>
    {error && <div className="error-banner editor-error">{error}<button onClick={() => setError('')}>×</button></div>}
    <div className="editor-workspace">
      <aside className="caption-panel">
        <div className="panel-heading"><div><span className="section-kicker">TRANSCRIPT</span><h2>Captions <span className="count">{captions.length}</span></h2></div><button className="add-caption" onClick={addCaption}>＋</button></div>
        {captions.length === 0 ? <div className="no-captions"><p>No captions yet.</p><button className="subtle-button" onClick={addCaption}>＋ Add caption</button></div> :
          <div className="caption-list">{captions.map((caption) => <article key={caption.id} className={`caption-row ${selectedId === caption.id ? 'selected' : ''} ${currentMs >= caption.startMs && currentMs < caption.endMs ? 'playing' : ''}`}>
            <button className="caption-time" onClick={() => { selectCaption(caption.id); seek(caption.startMs); }}>{formatTime(caption.startMs)}</button>
            <textarea aria-label="Caption text" value={caption.text} rows={Math.min(4, Math.max(1, Math.ceil(caption.text.length / 28)))} onFocus={() => selectCaption(caption.id)} onChange={(e) => updateCaption(caption.id, { text: e.target.value })} />
            <button className="remove-caption" title="Delete caption" onClick={() => removeCaption(caption.id)}>×</button>
            {selectedId === caption.id && <div className="time-edit"><label>Start <input type="number" min="0" step="0.1" value={(caption.startMs / 1000).toFixed(1)} onChange={(e) => updateCaption(caption.id, { startMs: Math.max(0, Math.round(Number(e.target.value) * 1000)) })} /></label><label>End <input type="number" min="0.2" step="0.1" value={(caption.endMs / 1000).toFixed(1)} onChange={(e) => updateCaption(caption.id, { endMs: Math.max(caption.startMs + 200, Math.round(Number(e.target.value) * 1000)) })} /></label></div>}
          </article>)}</div>}
      </aside>
      <section className="preview-panel">
        <div className="preview-header"><div><span className="section-kicker">LIVE PREVIEW</span><h2>Style your story</h2></div><span className="aspect-label">9:16 · VERTICAL</span></div>
        <div className="player-wrap">{project.status === 'READY' && <Player ref={playerRef} component={CaptionComposition} inputProps={{ src: videoSrc, captions, templateId: project.templateId }} durationInFrames={Math.max(1, Math.ceil((project.durationSec ?? 30) * 30))} fps={30} compositionWidth={1080} compositionHeight={1920} controls clickToPlay style={{ width: 'min(100%, 340px)', maxHeight: 'min(64vh, 640px)', aspectRatio: '9 / 16', backgroundColor: '#090a10', borderRadius: 12, overflow: 'hidden' }} onFrameUpdate={(frame) => { if (frame % 3 === 0) setCurrentMs(frame / 30 * 1000); }} />}</div>
        <div className="template-picker"><div className="template-heading"><span>CAPTION STYLE</span><span>5 presets</span></div><div className="template-grid">{[
          ['classic', 'Classic', 'Aa'], ['karaoke', 'Karaoke', 'Aa'], ['pop', 'Pop', 'POP'], ['boxed', 'Boxed', 'Aa'], ['neon', 'Neon', 'Aa'],
        ].map(([key, label, sample]) => <button key={key} className={`template-card ${project.templateId === key ? 'active' : ''} template-${key}`} onClick={() => void changeTemplate(key)}><span>{sample}</span><small>{label}</small></button>)}</div></div>
      </section>
      <aside className="properties-panel">
        <div className="panel-heading"><div><span className="section-kicker">DETAILS</span><h2>Properties</h2></div></div>
        {selected ? <><div className="property-group"><label>Caption text</label><textarea className="property-text" value={selected.text} onChange={(e) => updateCaption(selected.id, { text: e.target.value })} rows={4} /><span className="hint">Keep it short for maximum impact.</span></div><div className="property-group"><label>Timing</label><div className="property-time"><div><span>START (SEC)</span><input type="number" min="0" step=".1" value={(selected.startMs / 1000).toFixed(1)} onChange={(e) => updateCaption(selected.id, { startMs: Math.max(0, Math.round(Number(e.target.value) * 1000)) })} /></div><div><span>END (SEC)</span><input type="number" min=".2" step=".1" value={(selected.endMs / 1000).toFixed(1)} onChange={(e) => updateCaption(selected.id, { endMs: Math.max(selected.startMs + 200, Math.round(Number(e.target.value) * 1000)) })} /></div></div></div><div className="caption-actions"><button className="subtle-button" disabled={selected.text.trim().split(/\\s+/).length < 2} onClick={splitSelected}>Split caption</button><button className="subtle-button" disabled={captions.findIndex((caption) => caption.id === selected.id) <= 0 || captions[captions.findIndex((caption) => caption.id === selected.id) - 1]?.endMs > selected.startMs} onClick={mergeSelected}>Merge previous</button></div><button className="danger-button" onClick={() => removeCaption(selected.id)}>Delete caption</button></> : <div className="property-empty"><div>✦</div><strong>Select a caption</strong><p>Choose a caption to edit its text and timing.</p></div>}
        <div className="keyboard-hints"><span>KEYBOARD SHORTCUTS</span><p><kbd>Space</kbd> Play / pause</p><p><kbd>←</kbd> <kbd>→</kbd> Seek 0.5 seconds</p><p><kbd>Ctrl</kbd> + <kbd>Z</kbd> Undo</p></div>
      </aside>
    </div>
    <section className="timeline-panel">
      <div className="timeline-head">
        <div><span className="section-kicker">TIMELINE</span><strong>Caption track</strong></div>
        <span>{formatTime(currentMs)} <span className="timeline-divider">/</span> {formatTime(durationMs)}</span>
      </div>
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
        {captions.map((caption) => (
          <button
            key={caption.id}
            className={`timeline-block ${selectedId === caption.id ? 'active' : ''}`}
            style={{
              left: `${caption.startMs / durationMs * 100}%`,
              width: `${Math.max(.6, (caption.endMs - caption.startMs) / durationMs * 100)}%`
            }}
            title={caption.text}
            onPointerDown={(e) => beginTimelineDrag(e, caption)}
            onClick={(e) => {
              e.stopPropagation();
              selectCaption(caption.id);
              seek(caption.startMs);
            }}
          >
            {caption.text}
          </button>
        ))}
        <div className="playhead" style={{ left: `${Math.min(100, currentMs / durationMs * 100)}%` }} />
      </div>
      <div className="timeline-footer">
        <span>Drag the playhead to scrub · Select a block to edit</span>
        <button className="subtle-button" onClick={addCaption}>＋ Add caption</button>
      </div>
    </section>
    <footer className="editor-footer"><span>CAPTIFY AI</span><span>Autosave is on · Changes save automatically</span></footer>
  </main>;
}
