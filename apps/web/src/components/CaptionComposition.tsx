import { AbsoluteFill, Audio, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Video } from '@remotion/media';
import type { CSSProperties } from 'react';
import type { Caption } from '../lib/api';
import { CAPTION_TEMPLATES, type CaptionAnimation, type CaptionPreset } from '../templates';
import { createTemplateSchema } from '../templateSchema';

export interface CaptionCompositionProps {
  src: string;
  captions: Caption[];
  templateId: string;
  transitionName?: CaptionAnimation;
  captionPosition?: 'top' | 'middle' | 'bottom';
  backgroundColor?: string;
  backgroundOnly?: boolean;
  selectedCaptionId?: string | null;
  selectedWordId?: string | null;
  editable?: boolean;
  onSelectCaption?: (id: string) => void;
  onSelectWord?: (captionId: string, wordId: string) => void;
  onMoveCaption?: (id: string, x: number, y: number) => void;
  onMoveWord?: (captionId: string, wordId: string, x: number, y: number) => void;
}

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

function animationStyle(name: CaptionAnimation, progress: number): CSSProperties {
  const p = Math.max(0, Math.min(1, progress));
  switch (name) {
    case 'none': return {};
    case 'fade':
    case 'fadeOut': return { opacity: p };
    case 'slideUp':
    case 'slideOut': return { opacity: p, transform: `translateY(${(1 - p) * 0.65}em)` };
    case 'slideDown': return { opacity: p, transform: `translateY(${(p - 1) * 0.65}em)` };
    case 'pop': return { opacity: p, transform: `scale(${0.65 + 0.35 * p})` };
    case 'zoomOut': return { opacity: p, transform: `scale(${p})` };
    case 'blurIn': return { opacity: p, filter: `blur(${(1 - p) * 0.35}em)`, transform: `scale(${1.04 - 0.04 * p})` };
    case 'bounce': return { opacity: p, transform: `translateY(${Math.sin((1 - p) * Math.PI * 3) * 0.32 * (1 - p)}em)` };
    case 'shake': return { opacity: p, transform: `translateX(${Math.sin(p * Math.PI * 8) * (1 - p) * 0.12}em)` };
    case 'typewriter': return { clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` };
    default: return {};
  }
}

function progressAt(timeMs: number, startMs: number, durationMs: number): number {
  return interpolate(timeMs, [startMs, startMs + Math.max(1, durationMs)], [0, 1], clamp);
}

function wordProgress(timeMs: number, startMs: number, endMs: number, index: number, count: number, preset: CaptionPreset): number {
  const wordDuration = Math.max(1, preset.durationMs);
  const span = Math.max(1, endMs - startMs);
  const stagger = Math.min(110, span / Math.max(1, count) * 0.42);
  return progressAt(timeMs, startMs + index * stagger, wordDuration);
}

function renderWords(
  text: string,
  timeMs: number,
  startMs: number,
  endMs: number,
  preset: CaptionPreset,
  animation: CaptionAnimation,
  structure: string,
  wordData?: Caption['words'],
  selectedWordId?: string | null,
  editable = false,
  onSelectWord?: (wordId: string) => void,
  onMoveWord?: (wordId: string, x: number, y: number) => void,
  displayMode: 'word' | 'line' = 'word',
  wordsOnScreen = 0,
  activeWordColor?: string,
  textColor?: string,
  width = 1080,
  height = 1920,
): React.ReactNode {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  if (displayMode === 'line') return <span>{text}</span>;
  const visibleCount = wordsOnScreen > 0 ? wordsOnScreen : words.length;
  const chunkIndex = Math.floor(((timeMs - startMs) / Math.max(1, endMs - startMs)) * Math.ceil(words.length / visibleCount));
  const wordOffset = wordsOnScreen > 0 ? Math.max(0, chunkIndex) * visibleCount : 0;
  const visibleWords = wordsOnScreen > 0 ? words.slice(wordOffset, wordOffset + visibleCount) : words;

  const activeIndex = Math.min(
    words.length - 1,
    Math.max(0, Math.floor(((timeMs - startMs) / Math.max(1, endMs - startMs)) * words.length)),
  );

  if (structure === 'master') {
    const split = Math.max(1, Math.ceil(words.length / 2));
    return <span style={{display:'inline-flex',flexDirection:'column',alignItems:'center',lineHeight:.92,textShadow:'0 3px 2px rgba(0,0,0,.8)'}}>
      <span style={{fontSize:'.62em',fontWeight:700,color:'#E7E7E7'}}>{words.slice(0,split).join(' ')}</span>
      <span style={{fontSize:'1.45em',fontWeight:900,background:'linear-gradient(180deg,#fff8d9,#c8c8c8)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{words.slice(split).join(' ') || words[0]}</span>
    </span>;
  }
  if (structure === 'highlight') {
    return <span style={{display:'inline-block',padding:'.16em .34em',borderRadius:'.22em',background:preset.background ?? 'rgba(0,0,0,.72)',lineHeight:1.02}}>
      {words.map((word,index)=><span key={index} style={{display:'inline-block',marginRight:index===words.length-1?0:'.22em',color:index===activeIndex?(activeWordColor ?? preset.activeWord ?? '#00D9FF'):(textColor ?? preset.color),fontWeight:index===activeIndex?900:preset.weight,textShadow:'none'}}>{word}</span>)}
    </span>;
  }
  if (structure === 'chat') {
    return <span style={{display:'inline-block',maxWidth:'92%',padding:'.32em .55em',borderRadius:'.7em',background:preset.background ?? '#151519',boxShadow:'0 8px 22px rgba(0,0,0,.35)',lineHeight:1.05}}>{words.map((word,index)=><span key={index} style={{color:index===activeIndex?(activeWordColor ?? preset.activeWord ?? '#35D7FF'):(textColor ?? preset.color),display:'inline-block',marginRight:index===words.length-1?0:'.22em'}}>{word}</span>)}</span>;
  }
  if (structure === 'notification') {
    return <span style={{display:'inline-flex',alignItems:'center',gap:'.28em',padding:'.28em .55em',borderRadius:'999px',background:preset.background??'#E8F7F0',color:(textColor ?? preset.color)==='#FFFFFF'?'#161616':(textColor ?? preset.color),boxShadow:'0 4px 14px rgba(0,0,0,.25)'}}>
      <span style={{width:'.48em',height:'.48em',borderRadius:'50%',background:preset.activeWord??'#29C58A',flexShrink:0}}/>
      {words.join(' ')}
    </span>;
  }
  if (structure === 'three-line') {
    const parts = [words.slice(0,Math.ceil(words.length/3)),words.slice(Math.ceil(words.length/3),Math.ceil(words.length*2/3)),words.slice(Math.ceil(words.length*2/3))];
    return <span style={{display:'flex',flexDirection:'column',alignItems:'center',lineHeight:.92}}>{parts.filter(p=>p.length).map((part,index)=><span key={index} style={{fontSize:index===1?'1.18em':'.9em',fontWeight:900,color:index===1?(preset.activeWord??'#00D9FF'):(textColor ?? preset.color)}}>{part.join(' ')}</span>)}</span>;
  }
  if (structure === 'scattered') {
    return <span style={{display:'block',position:'relative',minHeight:'2.2em'}}>{words.map((word,index)=><span key={`${index}-${word}`} style={{display:'inline-block',position:'relative',margin:index%3===1?'-0.15em .05em':'0 .06em',fontSize:index===Math.floor(words.length/2)?'1.35em':index%3===0?'.62em':'.9em',color:index===Math.floor(words.length/2)?(preset.activeWord??'#FFE600'):(textColor ?? preset.color),textShadow:preset.shadow,transform:`rotate(${index%2===0?-4:3}deg) translateY(${index%3===0?'.18em':index%3===2?'-.12em':0})`,zIndex:index===Math.floor(words.length/2)?2:1}}>{word}</span>)}</span>;
  }
  if (structure === 'cutout') {
    return <span style={{display:'inline-flex',flexWrap:'wrap',justifyContent:'center',gap:'.08em'}}>{words.map((word,index)=><span key={`${index}-${word}`} style={{display:'inline-block',padding:'.02em .08em',background:index%2?'#F6D84A':'#F7F0D8',color:index%2?'#171717':'#B52037',transform:`rotate(${index%2?3:-2}deg)`,textShadow:'none',boxShadow:'0 2px 0 rgba(0,0,0,.35)'}}>{word}</span>)}</span>;
  }
  if (preset.display === 'block') {
    return <span style={animationStyle(animation, progressAt(timeMs, startMs, preset.durationMs))}>{text}</span>;
  }

  if (structure === 'headline-script' && words.length > 1) {
    const split = Math.max(1, Math.ceil(words.length / 2));
    return <span style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'.02em'}}><span>{words.slice(0,split).join(' ')}</span><span style={{fontFamily:'cursive',fontStyle:'italic',fontWeight:500,color:preset.activeWord??'#FFFFFF',fontSize:'.82em',textShadow:'0 0 8px rgba(255,255,255,.45)'}}>{words.slice(split).join(' ')}</span></span>;
  }
  return visibleWords.map((word, visibleIndex) => {
    const index = visibleIndex + wordOffset;
    const revealed = preset.display !== 'wordByWord' || timeMs >= startMs + index * ((endMs - startMs) / words.length);
    if (!revealed) return null;
    const progress = wordProgress(timeMs, startMs, endMs, index, words.length, preset);
    const isActive = index === activeIndex;
    const wordInfo = wordData?.[index];
    const style: CSSProperties = {
      display: 'inline-block',
      position: 'relative',
      left: wordInfo?.positionX != null ? wordInfo.positionX : undefined,
      top: wordInfo?.positionY != null ? wordInfo.positionY : undefined,
      color: wordInfo?.color ?? (preset.display === 'karaoke' && isActive ? (activeWordColor ?? preset.activeWord ?? '#FFD400') : (textColor ?? preset.color)),
      outline: editable && selectedWordId === wordInfo?.id ? '1px dashed #a855f7' : undefined,
      cursor: editable ? 'grab' : undefined,
      whiteSpace: 'pre',
      ...animationStyle(animation, progress),
      ...(preset.wordShadow ? { textShadow: preset.wordShadow } : {}),
    };
    return <span data-caption-word key={wordInfo?.id ?? `${index}-${word}`} style={style} onPointerDown={editable && wordInfo ? (event) => { event.stopPropagation(); event.preventDefault(); onSelectWord?.(wordInfo.id); const startX = event.clientX, startY = event.clientY; const initialX = wordInfo.positionX ?? 0, initialY = wordInfo.positionY ?? 0; const parent = (event.currentTarget as HTMLElement).closest('[data-caption-stage]') as HTMLElement | null; const rect = parent?.getBoundingClientRect(); const move = (moveEvent: PointerEvent) => onMoveWord?.(wordInfo.id, initialX + (moveEvent.clientX - startX) * width / Math.max(1, rect?.width ?? width), initialY + (moveEvent.clientY - startY) * height / Math.max(1, rect?.height ?? height)); const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true }); } : undefined}>{word}{index < words.length - 1 ? ' ' : ''}</span>;
  });
}

export function CaptionComposition({ src, captions, templateId, transitionName, captionPosition = 'middle', selectedCaptionId = null, selectedWordId = null, editable = false, backgroundColor = '#000000', backgroundOnly = false, onSelectCaption, onSelectWord, onMoveCaption, onMoveWord }: CaptionCompositionProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const timeMs = frame / fps * 1000;
  const active = captions.find((caption) => timeMs >= caption.startMs && timeMs < caption.endMs);
  const preset = CAPTION_TEMPLATES.find((item) => item.id === (active?.templateId ?? templateId)) ?? CAPTION_TEMPLATES[0];
  const schema = createTemplateSchema(preset);
  const animation = transitionName ?? schema.animation.enter.type;
  const structure = schema.layout.kind;
  const fontSize = Math.max(12, Math.min(width, height) * schema.typography.fontSizeRelative * (active?.scale ?? 100) / 100);
  const top = active?.positionY != null ? `${active.positionY}%` : captionPosition === 'top' ? '8%' : captionPosition === 'middle' ? '42%' : 'auto';
  const bottom = active?.positionY != null ? 'auto' : captionPosition === 'bottom' ? '12%' : 'auto';
  const left = active?.positionX != null ? `${active.positionX}%` : '50%';
  const activeAnimation = active?.animationIn ?? transitionName ?? schema.animation.enter.type;
  const activeExit = active?.animationOut ?? schema.animation.exit.type;
  const activeDuration = active ? active.endMs - active.startMs : 0;
  const transitionDuration = active?.animationDurationMs ?? preset.durationMs;
  const enterMs = Math.min(transitionDuration || 0, activeDuration / 2);
  const exitMs = Math.min(transitionDuration || 0, activeDuration / 2);
  const enterProgress = enterMs > 0 ? progressAt(timeMs, active?.startMs ?? 0, enterMs) : 1;
  const exitProgress = exitMs > 0 && active ? progressAt(timeMs, active.endMs - exitMs, exitMs) : 0;
  const exitStyle = activeExit === 'none' || exitMs <= 0 ? {} : animationStyle(activeExit, 1 - exitProgress);

  return (
    <AbsoluteFill style={{ backgroundColor, justifyContent: 'center', alignItems: 'center' }}>
      {backgroundOnly ? <Audio src={src} /> : <Video src={src} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
      {active && preset.id !== 'no-caption' && (
        <div
          onClick={editable ? () => onSelectCaption?.(active.id) : undefined}
          onPointerDown={editable ? (event) => { if ((event.target as HTMLElement).closest('[data-caption-word]')) return; event.preventDefault(); onSelectCaption?.(active.id); const startX = event.clientX, startY = event.clientY; const initialX = active.positionX ?? (captionPosition === 'bottom' ? 50 : 50); const initialY = active.positionY ?? (captionPosition === 'top' ? 8 : captionPosition === 'middle' ? 42 : 78); const parent = (event.currentTarget as HTMLElement).parentElement; if (!parent) return; const rect = parent.getBoundingClientRect(); const move = (moveEvent: PointerEvent) => onMoveCaption?.(active.id, Math.max(0, Math.min(100, initialX + (moveEvent.clientX - startX) / rect.width * 100)), Math.max(0, Math.min(100, initialY + (moveEvent.clientY - startY) / rect.height * 100))); const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true }); } : undefined}
          style={{
            position: 'absolute',
            top,
            bottom,
            left,
            width: '90%',
            maxHeight: '90%',
            overflow: 'visible',
            textAlign: schema.layout.alignment,
            display: 'block',
            border: editable && selectedCaptionId === active.id ? '1px dashed #a855f7' : preset.id === 'boxed' ? '2px solid #FFFFFF' : undefined,
            cursor: editable ? 'grab' : 'default',
            touchAction: editable ? 'none' : 'auto',
            userSelect: editable ? 'none' : 'auto',
            borderColor: preset.id === 'boxed' ? (preset.activeWord ?? '#B7F34A') : undefined,
            boxShadow: preset.structure === 'chat' ? '0 8px 24px rgba(0,0,0,.25)' : undefined,
            transform: `translateX(-50%) ${animationStyle(activeAnimation, enterProgress).transform ?? (preset.structure === 'chat' ? 'scale(1.02)' : '')}`,
            opacity: exitStyle.opacity ?? animationStyle(activeAnimation, enterProgress).opacity ?? 1,
            ...(exitStyle.transform ? { transform: `translateX(-50%) ${exitStyle.transform}` } : {}),
            ...(exitStyle.filter ? { filter: exitStyle.filter } : {}),
            ...(preset.id === 'podcast' ? { textAlign:'left' as const, textTransform:'uppercase' as const, fontWeight:900, letterSpacing:'-.035em', maxWidth:'74%', left:'13%' } : {}),
            ...(preset.id === 'hind' ? { textShadow:'0 0 8px rgba(0,210,255,.5)', fontFamily:'Georgia, serif' } : {}),
            ...(preset.id === 'boxed' ? { padding:'0.32em 0.42em', borderRadius:'.12em' } : {}),
            ...(preset.id === 'sliding-highlight' || preset.id === 'dynamic-sliding-highlight' ? { background:'linear-gradient(transparent 58%, rgba(173,255,0,.75) 58%)', padding:'0 .18em' } : {}),
            color: active.textColor ?? preset.color,
            textShadow: preset.shadow,
            fontFamily: `"${active.fontFamily ?? schema.typography.fontFamily}", sans-serif`,
            fontWeight: schema.typography.fontWeight,
            fontSize,
            lineHeight: schema.layout.lineHeight,
            letterSpacing: schema.typography.letterSpacing,
            textTransform: schema.typography.uppercase ? 'uppercase' : 'none',
            background: preset.background ?? 'transparent',
            padding: preset.background ? '0.18em 0.3em' : 0,
            borderRadius: preset.radius ?? 0,
            overflowWrap: 'break-word',
            whiteSpace: 'pre-wrap',
            ...(preset.outline ? { WebkitTextStroke: preset.outline } : {}),
            ...(preset.glow ? { filter: `drop-shadow(0 0 ${preset.glow})` } : {}),
            ...(preset.textTransform ? { textTransform: preset.textTransform } : {}),
          }}
        >
          {renderWords(active.text, timeMs, active.startMs, active.endMs, preset, activeAnimation, structure, active.words, selectedWordId, editable, (wordId) => onSelectWord?.(active.id, wordId), (wordId, x, y) => onMoveWord?.(active.id, wordId, x, y), active.displayMode ?? 'word', active.wordsOnScreen ?? 0, active.activeWordColor, active.textColor, width, height)}
        </div>
      )}
    </AbsoluteFill>
  );
}
