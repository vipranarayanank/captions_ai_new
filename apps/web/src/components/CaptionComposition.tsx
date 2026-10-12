import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { Video } from '@remotion/media';
import type { Caption } from '../lib/api';
import { CAPTION_TEMPLATES, type CaptionAnimation } from '../templates';

export interface CaptionCompositionProps { src: string; captions: Caption[]; templateId: string; transitionName?: CaptionAnimation; }
const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
function animationStyle(name: CaptionAnimation, progress: number): React.CSSProperties {
  const p = Math.max(0, Math.min(1, progress));
  switch (name) {
    case 'fade': return { opacity: p };
    case 'slideUp': return { opacity: p, transform: `translateY(${(1-p)*34}px)` };
    case 'slideDown': return { opacity: p, transform: `translateY(${(p-1)*34}px)` };
    case 'pop': return { opacity: p, transform: `scale(${.65 + .35*p})` };
    case 'blurIn': return { opacity: p, filter: `blur(${(1-p)*12}px)`, transform: `scale(${1.04-.04*p})` };
    case 'bounce': return { opacity: p, transform: `translateY(${Math.sin((1-p)*Math.PI*3)*16*(1-p)}px)` };
    case 'shake': return { transform: `translateX(${Math.sin(p*Math.PI*8)*(1-p)*7}px)` };
    case 'typewriter': return { clipPath: `inset(0 ${(1-p)*100}% 0 0)` };
    default: return {};
  }
}
export function CaptionComposition({ src, captions, templateId, transitionName }: CaptionCompositionProps) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const timeMs = frame / fps * 1000;
  const active = captions.find((caption) => timeMs >= caption.startMs && timeMs < caption.endMs);
  const preset = CAPTION_TEMPLATES.find((item) => item.id === templateId) ?? CAPTION_TEMPLATES[0];
  const animation = transitionName ?? preset.animationIn;
  const progress = animation === 'none' ? 1 : active ? interpolate(timeMs, [active.startMs, active.startMs + Math.max(1,preset.durationMs)], [0,1], clamp) : 1;
  const wordList = active?.text.trim().split(/\s+/) ?? [];
  const fontSize = Math.max(12, width * preset.sizeRel);
  const top = preset.position === 'top' ? '8%' : preset.position === 'middle' ? '42%' : 'auto';
  const bottom = preset.position === 'bottom' ? '12%' : 'auto';
  return <AbsoluteFill style={{ backgroundColor:'#090a10', justifyContent:'center', alignItems:'center' }}>
    <Video src={src} style={{ width:'100%', height:'100%', objectFit:'contain' }} />
    {active && <div style={{
      position:'absolute', top, bottom, left:'5%', width:'90%', maxHeight:'90%', overflow:'hidden',
      textAlign:preset.align, color:preset.color, textShadow:preset.shadow, fontFamily:`"${preset.font}", sans-serif`,
      fontWeight:preset.weight, fontSize, lineHeight:1.12, letterSpacing:preset.letterSpacing ?? '-.02em',
      textTransform:preset.uppercase?'uppercase':'none', background:preset.background ?? 'transparent',
      padding:preset.background?'0.18em 0.3em':0, borderRadius:12, overflowWrap:'anywhere', whiteSpace:'pre-wrap',
      ...animationStyle(animation, progress)
    }}>{preset.display === 'wordByWord' ? wordList.slice(0, Math.max(1, Math.floor((timeMs-active.startMs)/Math.max(150,(active.endMs-active.startMs)/Math.max(1,wordList.length)))+1)).join(' ') : preset.display === 'karaoke' ? wordList.map((word,i)=><span key={i} style={{color: i === Math.min(wordList.length-1,Math.max(0,Math.floor((timeMs-active.startMs)/Math.max(1,(active.endMs-active.startMs)/Math.max(1,wordList.length))))) ? preset.activeWord ?? preset.color : preset.color}}>{word}{i<wordList.length-1?' ':''}</span>) : active.text}</div>}
  </AbsoluteFill>;
}
