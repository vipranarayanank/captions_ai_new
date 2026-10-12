import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Video } from '@remotion/media';
import type { CSSProperties } from 'react';
import type { Caption } from '../lib/api';
import { CAPTION_TEMPLATES, type CaptionAnimation, type CaptionPreset } from '../templates';

export interface CaptionCompositionProps {
  src: string;
  captions: Caption[];
  templateId: string;
  transitionName?: CaptionAnimation;
}

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

function animationStyle(name: CaptionAnimation, progress: number): CSSProperties {
  const p = Math.max(0, Math.min(1, progress));
  switch (name) {
    case 'none': return {};
    case 'fade': return { opacity: p };
    case 'slideUp': return { opacity: p, transform: `translateY(${(1 - p) * 0.65}em)` };
    case 'slideDown': return { opacity: p, transform: `translateY(${(p - 1) * 0.65}em)` };
    case 'pop': return { opacity: p, transform: `scale(${0.65 + 0.35 * p})` };
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
): React.ReactNode {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;

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
      {words.map((word,index)=><span key={index} style={{display:'inline-block',marginRight:index===words.length-1?0:'.22em',color:index===activeIndex?(preset.activeWord??'#00D9FF'):preset.color,fontWeight:index===activeIndex?900:preset.weight,textShadow:'none'}}>{word}</span>)}
    </span>;
  }
  if (structure === 'chat') {
    return <span style={{display:'inline-block',maxWidth:'92%',padding:'.32em .55em',borderRadius:'.7em',background:preset.background ?? '#151519',boxShadow:'0 8px 22px rgba(0,0,0,.35)',lineHeight:1.05}}>{words.map((word,index)=><span key={index} style={{color:index===activeIndex?(preset.activeWord??'#35D7FF'):preset.color,display:'inline-block',marginRight:index===words.length-1?0:'.22em'}}>{word}</span>)}</span>;
  }
  if (structure === 'notification') {
    return <span style={{display:'inline-flex',alignItems:'center',gap:'.28em',padding:'.28em .55em',borderRadius:'999px',background:preset.background??'#E8F7F0',color:preset.color==='#FFFFFF'?'#161616':preset.color,boxShadow:'0 4px 14px rgba(0,0,0,.25)'}}>
      <span style={{width:'.48em',height:'.48em',borderRadius:'50%',background:preset.activeWord??'#29C58A',flexShrink:0}}/>
      {words.join(' ')}
    </span>;
  }
  if (structure === 'three-line') {
    const parts = [words.slice(0,Math.ceil(words.length/3)),words.slice(Math.ceil(words.length/3),Math.ceil(words.length*2/3)),words.slice(Math.ceil(words.length*2/3))];
    return <span style={{display:'flex',flexDirection:'column',alignItems:'center',lineHeight:.92}}>{parts.filter(p=>p.length).map((part,index)=><span key={index} style={{fontSize:index===1?'1.18em':'.9em',fontWeight:900,color:index===1?(preset.activeWord??'#00D9FF'):preset.color}}>{part.join(' ')}</span>)}</span>;
  }
  if (structure === 'scattered') {
    return <span style={{display:'block',position:'relative',minHeight:'2.2em'}}>{words.map((word,index)=><span key={`${index}-${word}`} style={{display:'inline-block',position:'relative',margin:index%3===1?'-0.15em .05em':'0 .06em',fontSize:index===Math.floor(words.length/2)?'1.35em':index%3===0?'.62em':'.9em',color:index===Math.floor(words.length/2)?(preset.activeWord??'#FFE600'):preset.color,textShadow:preset.shadow,transform:`rotate(${index%2===0?-4:3}deg) translateY(${index%3===0?'.18em':index%3===2?'-.12em':0})`,zIndex:index===Math.floor(words.length/2)?2:1}}>{word}</span>)}</span>;
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
  return words.map((word, index) => {
    const revealed = preset.display !== 'wordByWord' || timeMs >= startMs + index * ((endMs - startMs) / words.length);
    if (!revealed) return null;
    const progress = wordProgress(timeMs, startMs, endMs, index, words.length, preset);
    const isActive = index === activeIndex;
    const style: CSSProperties = {
      display: 'inline-block',
      whiteSpace: 'pre',
      color: preset.display === 'karaoke' && isActive ? (preset.activeWord ?? '#FFD400') : preset.color,
      ...animationStyle(animation, progress),
      ...(preset.wordShadow ? { textShadow: preset.wordShadow } : {}),
    };
    return <span key={`${index}-${word}`} style={style}>{word}{index < words.length - 1 ? ' ' : ''}</span>;
  });
}

export function CaptionComposition({ src, captions, templateId, transitionName }: CaptionCompositionProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const timeMs = frame / fps * 1000;
  const active = captions.find((caption) => timeMs >= caption.startMs && timeMs < caption.endMs);
  const preset = CAPTION_TEMPLATES.find((item) => item.id === templateId) ?? CAPTION_TEMPLATES[0];
  const animation = transitionName ?? preset.animationIn;
  const structure = preset.id === 'master' ? 'master'
    : ['simple','typo-simple','word-highlight','cursive-highlight','focus','spotlight','glow-word','oneword-pill'].includes(preset.id) ? 'highlight'
    : ['popup-chat-bubble','popup-chat-bubble-left','podcast'].includes(preset.id) ? 'chat'
    : ['notification','mint-punch'].includes(preset.id) ? 'notification'
    : ['triple','smooth-fusion'].includes(preset.id) ? 'three-line'
    : preset.structure;
  const fontSize = Math.max(12, Math.min(width, height) * preset.sizeRel);
  const top = preset.position === 'top' ? '8%' : preset.position === 'middle' ? '42%' : 'auto';
  const bottom = preset.position === 'bottom' ? '12%' : 'auto';
  const activeDuration = active ? active.endMs - active.startMs : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#090a10', justifyContent: 'center', alignItems: 'center' }}>
      <Video src={src} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      {active && (
        <div
          style={{
            position: 'absolute',
            top,
            bottom,
            left: '5%',
            width: '90%',
            maxHeight: '90%',
            overflow: 'visible',
            textAlign: preset.align,
            display: 'block',
            border: preset.id === 'boxed' ? '2px solid #FFFFFF' : undefined,
            borderColor: preset.id === 'boxed' ? (preset.activeWord ?? '#B7F34A') : undefined,
            boxShadow: preset.structure === 'chat' ? '0 8px 24px rgba(0,0,0,.25)' : undefined,
            transform: preset.structure === 'chat' ? 'scale(1.02)' : undefined,
            ...(preset.id === 'podcast' ? { textAlign:'left' as const, textTransform:'uppercase' as const, fontWeight:900, letterSpacing:'-.035em', maxWidth:'74%', left:'13%' } : {}),
            ...(preset.id === 'hind' ? { textShadow:'0 0 8px rgba(0,210,255,.5)', fontFamily:'Georgia, serif' } : {}),
            ...(preset.id === 'boxed' ? { padding:'0.32em 0.42em', borderRadius:'.12em' } : {}),
            ...(preset.id === 'sliding-highlight' || preset.id === 'dynamic-sliding-highlight' ? { background:'linear-gradient(transparent 58%, rgba(173,255,0,.75) 58%)', padding:'0 .18em' } : {}),
            color: preset.color,
            textShadow: preset.shadow,
            fontFamily: `"${preset.font}", sans-serif`,
            fontWeight: preset.weight,
            fontSize,
            lineHeight: preset.lineHeight ?? 1.08,
            letterSpacing: preset.letterSpacing ?? '-.025em',
            textTransform: preset.uppercase ? 'uppercase' : 'none',
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
          {renderWords(active.text, timeMs, active.startMs, active.endMs, preset, animation, structure)}
        </div>
      )}
    </AbsoluteFill>
  );
}
