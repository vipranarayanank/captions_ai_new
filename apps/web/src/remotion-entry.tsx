import { Composition, registerRoot } from 'remotion';
import type { ComponentType } from 'react';
import { CaptionComposition } from './components/CaptionComposition';

function RemotionRoot() {
  return (
    <Composition
      id="CaptionsVideo"
      component={CaptionComposition as ComponentType<Record<string, unknown>>}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ src: '', captions: [], templateId: 'classic' }}
    />
  );
}
registerRoot(RemotionRoot);
