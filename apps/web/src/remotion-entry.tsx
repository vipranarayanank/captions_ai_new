import { Composition, registerRoot } from 'remotion';
import { CaptionComposition } from './components/CaptionComposition';

function RemotionRoot() {
  return (
    <Composition
      id="CaptionsVideo"
      component={CaptionComposition}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ src: '', captions: [], templateId: 'classic' }}
    />
  );
}
registerRoot(RemotionRoot);
