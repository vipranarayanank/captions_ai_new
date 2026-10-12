export type CaptionAnimation = 'none' | 'fade' | 'slideUp' | 'slideDown' | 'pop' | 'blurIn' | 'typewriter' | 'bounce' | 'shake';
export type CaptionPreset = {
  id: string; name: string; category: 'minimal'|'bold'|'playful'|'cinematic'; font: string; weight: number; sizeRel: number;
  color: string; activeWord?: string; background?: string; shadow?: string; position: 'top'|'middle'|'bottom';
  align: 'center'|'left'; uppercase?: boolean; letterSpacing?: string; display: 'block'|'wordByWord'|'karaoke';
  animationIn: CaptionAnimation; durationMs: number; animationOut?: CaptionAnimation;
  outline?: string; glow?: string; radius?: number; lineHeight?: number; textTransform?: 'none'|'capitalize'|'lowercase'|'uppercase';
  wordShadow?: string;
};
export const CAPTION_TEMPLATES: CaptionPreset[] = [
{id:'clean',name:'Clean',category:'minimal',font:'Inter',weight:600,sizeRel:.042,color:'#FFFFFF',shadow:'0 3px 18px #000',position:'bottom',align:'center',display:'block',animationIn:'fade',durationMs:150},
{id:'subtle',name:'Subtle',category:'minimal',font:'Source Sans 3',weight:500,sizeRel:.038,color:'#F5F5F5',background:'rgba(0,0,0,.45)',position:'bottom',align:'center',display:'block',animationIn:'fade',durationMs:200},
{id:'highlight-run',name:'Highlight Run',category:'bold',font:'Montserrat',weight:800,sizeRel:.05,color:'#FFFFFF',activeWord:'#FFD400',shadow:'-2px -2px 0 #000, 2px 2px 0 #000',outline:'1px #111',position:'middle',align:'center',uppercase:true,display:'karaoke',animationIn:'none',durationMs:0},
{id:'pop',name:'Pop',category:'playful',font:'Poppins',weight:800,sizeRel:.075,color:'#FFFFFF',shadow:'-3px -3px 0 #111, 3px 3px 0 #111',position:'middle',align:'center',uppercase:true,display:'wordByWord',animationIn:'pop',durationMs:180},
{id:'stack',name:'Stack',category:'bold',font:'Anton',weight:400,sizeRel:.09,color:'#FFFFFF',activeWord:'#FF3B6B',shadow:'-2px -2px 0 #000, 2px 2px 0 #000',position:'middle',align:'left',uppercase:true,display:'wordByWord',animationIn:'slideUp',durationMs:160,lineHeight:.94},
{id:'typewriter',name:'Typewriter',category:'minimal',font:'Space Mono',weight:700,sizeRel:.034,color:'#E8FFE8',background:'rgba(11,15,11,.7)',position:'bottom',align:'left',display:'block',animationIn:'typewriter',durationMs:700},
{id:'glow',name:'Glow',category:'cinematic',font:'Raleway',weight:700,sizeRel:.045,color:'#DDE6FF',activeWord:'#7AF0FF',shadow:'0 0 18px #4D9BFF, 0 2px 12px #000',glow:'12px #4D9BFF',position:'bottom',align:'center',display:'karaoke',animationIn:'blurIn',durationMs:250},
{id:'marker',name:'Marker',category:'playful',font:'Permanent Marker',weight:400,sizeRel:.055,color:'#FFFFFF',activeWord:'#FF5E3A',shadow:'-2px -2px 0 #000, 2px 2px 0 #000',position:'middle',align:'center',display:'karaoke',animationIn:'slideUp',durationMs:160},
{id:'bounce',name:'Bounce',category:'playful',font:'Fredoka',weight:700,sizeRel:.07,color:'#FFFFFF',activeWord:'#5DFF9A',shadow:'-3px -3px 0 #0A2A18, 3px 3px 0 #0A2A18',position:'middle',align:'center',display:'wordByWord',animationIn:'bounce',durationMs:220},
{id:'cinematic',name:'Cinematic',category:'cinematic',font:'Playfair Display',weight:500,sizeRel:.04,color:'#F3EAD7',shadow:'0 3px 18px #000',position:'bottom',align:'center',letterSpacing:'.04em',display:'block',animationIn:'blurIn',durationMs:300,animationOut:'fade'}
];
export const CAPTION_TRANSITIONS: {id: CaptionAnimation; name: string; description: string}[] = [
{id:'none',name:'Instant',description:'Caption appears immediately'},
{id:'fade',name:'Fade',description:'Soft fade-in'},
{id:'slideUp',name:'Slide Up',description:'Moves up into place'},
{id:'slideDown',name:'Slide Down',description:'Drops down into place'},
{id:'pop',name:'Pop',description:'Scales up with a punch'},
{id:'blurIn',name:'Blur In',description:'Sharpens into focus'},
{id:'typewriter',name:'Typewriter',description:'Reveals text over time'},
{id:'bounce',name:'Bounce',description:'Bouncy entrance'},
{id:'shake',name:'Shake',description:'Quick energetic jitter'}
];
