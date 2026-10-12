import { CAPTION_TEMPLATES, type CaptionAnimation, type CaptionPreset } from './templates';

/**
 * Normalized, JSON-serializable description used by both the preview and export renderer.
 * The legacy preset fields remain supported while templates are migrated to this schema.
 */
export type TemplateWordRole = 'first' | 'middle' | 'last' | 'active' | 'highlight';
export type TemplateLayoutKind =
  | 'standard' | 'master' | 'highlight' | 'chat' | 'notification'
  | 'three-line' | 'scattered' | 'cutout' | 'headline-script' | 'blended';

export interface TemplateAnimationPhase {
  type: CaptionAnimation;
  durationMs: number;
  easing: 'linear' | 'ease-out' | 'spring';
}
export interface CaptionTemplateSchema {
  schemaVersion: 1;
  id: string;
  layout: {
    kind: TemplateLayoutKind;
    position: 'top' | 'middle' | 'bottom';
    alignment: 'center' | 'left';
    maxWidth: number;
    lineHeight: number;
    padding: number;
  };
  typography: {
    fontFamily: string;
    fontWeight: number;
    fontSizeRelative: number;
    color: string;
    uppercase: boolean;
    letterSpacing: string;
    shadow?: string;
    outline?: string;
    glow?: string;
    background?: string;
    radius?: number;
  };
  grouping: {
    mode: 'sentence' | 'word-by-word' | 'karaoke';
    revealWordsIndividually: boolean;
    highlightActiveWord: boolean;
  };
  wordStyles: Array<{
    role: TemplateWordRole;
    color?: string;
    fontWeight?: number;
    fontSizeScale?: number;
    italic?: boolean;
    textShadow?: string;
  }>;
  animation: {
    enter: TemplateAnimationPhase;
    hold: { type: 'none' };
    exit: TemplateAnimationPhase;
    staggerMs: number;
  };
}

const STRUCTURE_BY_ID: Record<string, TemplateLayoutKind> = {
  master: 'master',
  simple: 'highlight',
  'typo-simple': 'highlight',
  'word-highlight': 'highlight',
  'cursive-highlight': 'highlight',
  focus: 'highlight',
  spotlight: 'scattered',
  'glow-word': 'highlight',
  'oneword-pill': 'highlight',
  'popup-chat-bubble': 'chat',
  'popup-chat-bubble-left': 'chat',
  podcast: 'chat',
  notification: 'notification',
  'mint-punch': 'notification',
  triple: 'three-line',
  'smooth-fusion': 'three-line',
  creator: 'headline-script',
  'creator-2': 'headline-script',
  'creator-3': 'headline-script',
  'creator-4': 'headline-script',
  'dyn-creator': 'headline-script',
  'estate-1': 'blended',
  estate: 'blended',
  'estate-2': 'blended',
  'estate-3': 'blended',
  'dyn-estate': 'blended',
  ransom: 'cutout',
  'ransom-animate': 'cutout',
};

function phase(type: CaptionAnimation, durationMs: number): TemplateAnimationPhase {
  return {
    type,
    durationMs: Math.max(0, durationMs),
    easing: type === 'bounce' || type === 'pop' ? 'spring' : 'ease-out',
  };
}

/** Converts every catalog entry into the common schema without hand-maintaining duplicate data. */
export function createTemplateSchema(preset: CaptionPreset): CaptionTemplateSchema {
  const supportedStructures: TemplateLayoutKind[] = [
    'standard', 'master', 'highlight', 'chat', 'notification',
    'three-line', 'scattered', 'cutout', 'headline-script', 'blended',
  ];
  const layoutKind = STRUCTURE_BY_ID[preset.id] ??
    (supportedStructures.includes(preset.structure as TemplateLayoutKind)
      ? preset.structure as TemplateLayoutKind
      : 'standard');
  const mode = preset.display === 'karaoke'
    ? 'karaoke'
    : preset.display === 'wordByWord'
      ? 'word-by-word'
      : 'sentence';
  const styles: CaptionTemplateSchema['wordStyles'] = mode === 'karaoke'
    ? [{ role: 'active', color: preset.activeWord, fontWeight: 900 }]
    : [];
  if (layoutKind === 'master') {
    styles.push({ role: 'first', color: '#E7E7E7', fontWeight: 700, fontSizeScale: 0.62 });
    styles.push({ role: 'highlight', color: preset.activeWord ?? '#FFE600', fontWeight: 900, fontSizeScale: 1.45 });
  }
  if (layoutKind === 'headline-script') {
    styles.push({ role: 'last', color: preset.activeWord ?? '#FFFFFF', italic: true, fontWeight: 500, fontSizeScale: 0.82 });
  }
  if (layoutKind === 'cutout') {
    styles.push({ role: 'first', color: '#B52037', fontWeight: 900 });
    styles.push({ role: 'middle', color: '#171717', fontWeight: 900 });
  }

  return {
    schemaVersion: 1,
    id: preset.id,
    layout: {
      kind: layoutKind,
      position: preset.position,
      alignment: preset.align,
      maxWidth: preset.id === 'podcast' ? 0.74 : 0.9,
      lineHeight: preset.lineHeight ?? 1.08,
      padding: preset.background ? 0.18 : 0,
    },
    typography: {
      fontFamily: preset.font,
      fontWeight: preset.weight,
      fontSizeRelative: preset.sizeRel,
      color: preset.color,
      uppercase: preset.uppercase ?? false,
      letterSpacing: preset.letterSpacing ?? '-.025em',
      ...(preset.shadow ? { shadow: preset.shadow } : {}),
      ...(preset.outline ? { outline: preset.outline } : {}),
      ...(preset.glow ? { glow: preset.glow } : {}),
      ...(preset.background ? { background: preset.background } : {}),
      ...(preset.radius !== undefined ? { radius: preset.radius } : {}),
    },
    grouping: {
      mode,
      revealWordsIndividually: mode === 'word-by-word',
      highlightActiveWord: mode === 'karaoke' || Boolean(preset.activeWord),
    },
    wordStyles: styles,
    animation: {
      enter: phase(preset.animationIn, preset.durationMs),
      hold: { type: 'none' },
      exit: phase(preset.animationOut ?? 'fade', preset.animationOut ? Math.min(180, preset.durationMs) : 100),
      staggerMs: mode === 'word-by-word' ? 40 : 0,
    },
  };
}

export const CAPTION_TEMPLATE_SCHEMAS: CaptionTemplateSchema[] = CAPTION_TEMPLATES.map(createTemplateSchema);
