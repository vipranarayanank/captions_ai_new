import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Video } from '@remotion/media';
import type { Caption } from '../lib/api';

export interface CaptionCompositionProps {
  src: string;
  captions: Caption[];
  templateId: string;
}
const styles: Record<string, { color: string; background: string; shadow: string; transform: string }> = {
  classic: { color: '#fff', background: 'transparent', shadow: '0 3px 16px #000', transform: 'none' },
  karaoke: { color: '#f7ff64', background: 'transparent', shadow: '0 3px 18px #000', transform: 'none' },
  pop: { color: '#fff', background: 'transparent', shadow: '0 4px 18px #000', transform: 'scale(1.04)' },
  boxed: { color: '#fff', background: '#17171ee8', shadow: 'none', transform: 'none' },
  neon: { color: '#d9fffb', background: 'transparent', shadow: '0 0 16px #26f6e5, 0 2px 12px #000', transform: 'none' },
};
export function CaptionComposition({ src, captions, templateId }: CaptionCompositionProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeMs = frame / fps * 1000;
  const active = captions.find((caption) => timeMs >= caption.startMs && timeMs < caption.endMs);
  const style = styles[templateId] ?? styles.classic;
  return (
    <AbsoluteFill style={{ backgroundColor: '#090a10', justifyContent: 'center', alignItems: 'center' }}>
      <Video src={src} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      {active && <div style={{
        position: 'absolute', bottom: '18%', left: '7.5%', width: '85%', textAlign: 'center',
        color: style.color, background: style.background, textShadow: style.shadow, transform: style.transform,
        fontFamily: 'Arial, sans-serif', fontWeight: 900, fontSize: 'clamp(24px, 5.1vw, 68px)',
        lineHeight: 1.12, letterSpacing: templateId === 'neon' ? '0.04em' : '-0.025em',
        textTransform: templateId === 'pop' ? 'uppercase' : 'none', padding: templateId === 'boxed' ? '0.18em 0.28em' : 0,
        borderRadius: templateId === 'boxed' ? 14 : 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
      }}>{active.text}</div>}
    </AbsoluteFill>
  );
}
