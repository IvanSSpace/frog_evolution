export type EmblemStyle = 'pond' | 'stripes'

export interface ClanEmblem {
  variant: number
  style: EmblemStyle
  bg: string
  frog: string
  topColor?: string
  stripeColor?: string
}

export const BG_COLORS = ['#5e8b2a','#2f6e57','#3a5a8c','#8c4a2f','#6b3a8c','#2b2b3a','#b08423','#246b6b','#8c2f4a','#445']
export const FROG_COLORS = ['#6aab3c','#4caf6e','#7ec850','#3d8b5a','#9ccc4f','#5aa0a0','#c8a13c','#8c6ad4','#d4795a','#5b7d3a']

function mulberry32(a: number): () => number {
  return function() {
    a|=0; a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  }
}

function shade(hex: string, amt: number): string {
  let c=hex.replace('#','');
  if(c.length===3)c=c.split('').map((x: string)=>x+x).join('');
  let r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16);
  r=Math.max(0,Math.min(255,Math.round(r+amt)));
  g=Math.max(0,Math.min(255,Math.round(g+amt)));
  b=Math.max(0,Math.min(255,Math.round(b+amt)));
  return '#'+[r,g,b].map((x: number)=>x.toString(16).padStart(2,'0')).join('');
}

function lighten(hex: string, f: number): string { return shade(hex,f); }

export function buildFrog(seed: number, bg: string, frog: string, opts?: { bgStyle?: EmblemStyle; topColor?: string; stripeColor?: string }): string {
  const bgStyle=(opts?.bgStyle)||'pond';
  const topColor=(opts?.topColor)||'#e8b923';
  const stripeColor=(opts?.stripeColor)||'#1f5fc4';
  const rnd=mulberry32(seed*2654435761);
  const pick=<T>(arr: T[]): T =>arr[Math.floor(rnd()*arr.length)];
  void pick; // used below via rnd()

  // производные цвета
  const frogDark = shade(frog,-45);
  const frogLight= shade(frog, 38);
  void frogLight;
  const belly    = lighten(frog,70);
  const bellyShade=lighten(frog,40);
  const bgDark   = shade(bg,-40);
  const bgLight  = shade(bg, 35);
  const ringBase = (bgStyle==='stripes') ? stripeColor : bg;
  const ringOuter= shade(ringBase,-70);
  const ringInner= shade(ringBase, 55);

  // черты вида (детерминированы seed)
  const bodyType   = Math.floor(rnd()*3);
  const eyeType    = Math.floor(rnd()*4);
  const eyeSize    = 38 + Math.floor(rnd()*16);
  const mouthType  = Math.floor(rnd()*4);
  const browType   = Math.floor(rnd()*3);
  const hat         = Math.floor(rnd()*5);
  const cheeks     = rnd()>0.45;
  const spots      = Math.floor(rnd()*4);
  const blink      = rnd()>0.85;
  const lilypad    = rnd()>0.4;

  let s='';

  const shieldPath=(p: number)=>{
    const L=24+p, R=376-p, T=20+p, B=384-p;
    const mid=(L+R)/2;
    const shoulder=T+(B-T)*0.16;
    const waist=T+(B-T)*0.62;
    return `M${L} ${T} `+
      `L${R} ${T} `+
      `L${R} ${shoulder} `+
      `C${R} ${waist} ${R-26} ${waist+30} ${mid} ${B} `+
      `C${L+26} ${waist+30} ${L} ${waist} ${L} ${shoulder} `+
      `Z`;
  };
  s+=`<path d="${shieldPath(0)}" fill="${ringOuter}"/>`;
  s+=`<path d="${shieldPath(9)}" fill="${ringInner}"/>`;
  s+=`<clipPath id="cc"><path d="${shieldPath(18)}"/></clipPath>`;
  s+=`<g clip-path="url(#cc)">`;

  if(bgStyle==='stripes'){
    const topH=120;
    const splitY=16+topH;
    const stripeBottom=388;
    s+=`<rect x="20" y="16" width="360" height="${topH}" fill="${topColor}"/>`;
    s+=`<rect x="20" y="${splitY-12}" width="360" height="12" fill="${shade(topColor,-35)}" opacity="0.6"/>`;
    s+=`<rect x="20" y="${splitY}" width="360" height="${stripeBottom-splitY}" fill="#ffffff"/>`;
    const band=22, gap=22;
    for(let y=splitY+gap; y<stripeBottom; y+=band+gap){
      const h=Math.min(band, stripeBottom-y);
      s+=`<rect x="20" y="${y}" width="360" height="${h}" fill="${stripeColor}"/>`;
    }
  } else {
    s+=`<rect x="20" y="16" width="360" height="372" fill="${bg}"/>`;
    s+=`<rect x="20" y="220" width="360" height="180" fill="${bgDark}" opacity="0.45"/>`;
    for(let i=0;i<5;i++){
      const x=60+rnd()*280, y=50+rnd()*300, r=22+rnd()*38;
      s+=`<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${r.toFixed(0)}" ry="${(r*0.6).toFixed(0)}" fill="${bgLight}" opacity="0.4"/>`;
    }
    if(lilypad){
      s+=`<ellipse cx="200" cy="322" rx="110" ry="30" fill="${shade(bg,-25)}"/>`;
      s+=`<path d="M200 322 L174 300 A110 30 0 0 1 226 300 Z" fill="${bgDark}" opacity="0.55"/>`;
    }
  }
  s+=`</g>`;
  const strokeCol = bgStyle==='stripes' ? shade(stripeColor,-30) : shade(bg,-55);
  s+=`<path d="${shieldPath(18)}" fill="none" stroke="${strokeCol}" stroke-width="2" opacity="0.5"/>`;

  s+=`<g transform="translate(0,-30)">`;

  let bw=118,bh=96,by=232;
  if(bodyType===0){bw=112;bh=106;}
  else if(bodyType===1){bw=124;bh=88;}
  else {bw=114;bh=110;by=236;}
  s+=`<ellipse cx="${200-bw*0.55}" cy="${by+52}" rx="42" ry="27" fill="${frogDark}"/>`;
  s+=`<ellipse cx="${200+bw*0.55}" cy="${by+52}" rx="42" ry="27" fill="${frogDark}"/>`;
  const toeY=by+74;
  ([[-bw*0.85,-18],[-bw*0.62,0],[-bw*0.4,12]] as [number,number][]).forEach(([dx,rot])=>{
    s+=`<ellipse cx="${200+dx}" cy="${toeY}" rx="11" ry="18" transform="rotate(${rot} ${200+dx} ${toeY})" fill="${frogDark}"/>`;
  });
  ([[bw*0.4,-12],[bw*0.62,0],[bw*0.85,18]] as [number,number][]).forEach(([dx,rot])=>{
    s+=`<ellipse cx="${200+dx}" cy="${toeY}" rx="11" ry="18" transform="rotate(${rot} ${200+dx} ${toeY})" fill="${frogDark}"/>`;
  });

  s+=`<ellipse cx="200" cy="${by}" rx="${bw}" ry="${bh}" fill="${frog}"/>`;
  s+=`<ellipse cx="200" cy="${by+22}" rx="${bw*0.72}" ry="${bh*0.7}" fill="${belly}"/>`;
  s+=`<ellipse cx="200" cy="${by+30}" rx="${bw*0.55}" ry="${bh*0.45}" fill="${bellyShade}" opacity="0.5"/>`;

  s+=`<ellipse cx="${200-44}" cy="${by+66}" rx="17" ry="27" transform="rotate(8 ${200-44} ${by+66})" fill="${frog}"/>`;
  s+=`<ellipse cx="${200+44}" cy="${by+66}" rx="17" ry="27" transform="rotate(-8 ${200+44} ${by+66})" fill="${frog}"/>`;
  ([-1,1] as number[]).forEach(side=>{
    const cx=200+side*46;
    s+=`<circle cx="${cx-9}" cy="${by+88}" r="7" fill="${frogDark}"/>`;
    s+=`<circle cx="${cx}" cy="${by+91}" r="7" fill="${frogDark}"/>`;
    s+=`<circle cx="${cx+9}" cy="${by+88}" r="7" fill="${frogDark}"/>`;
  });

  if(spots===1){
    ([-1,1] as number[]).forEach(side=>{
      s+=`<ellipse cx="${200+side*bw*0.42}" cy="${by-bh*0.05}" rx="${bw*0.18}" ry="${bh*0.3}" fill="${frogDark}" opacity="0.5"/>`;
    });
  } else if(spots===2){
    ([-1,1] as number[]).forEach(side=>{
      s+=`<circle cx="${200+side*bw*0.42}" cy="${by-bh*0.45}" r="${bw*0.14}" fill="${frogDark}" opacity="0.5"/>`;
    });
  } else if(spots===3){
    s+=`<ellipse cx="200" cy="${by-bh*0.5}" rx="${bw*0.16}" ry="${bh*0.26}" fill="${frogDark}" opacity="0.5"/>`;
  }

  const eyeGap=58, eyeY=150, er=eyeSize;
  ([-1,1] as number[]).forEach(side=>{
    const ex=200+side*eyeGap;
    s+=`<circle cx="${ex}" cy="${eyeY}" r="${er*0.95}" fill="${frog}"/>`;
  });
  ([-1,1] as number[]).forEach(side=>{
    const ex=200+side*eyeGap;
    const winking = blink && side===1;
    if(winking){
      s+=`<path d="M${ex-22} ${eyeY-4} Q${ex} ${eyeY+14} ${ex+22} ${eyeY-4}" fill="none" stroke="${frogDark}" stroke-width="7" stroke-linecap="round"/>`;
    } else {
      s+=`<circle cx="${ex}" cy="${eyeY-6}" r="${er*0.62}" fill="#f4f8e8"/>`;
      const px=ex+side*2, py=eyeY+2;
      if(eyeType===0){
        s+=`<circle cx="${px}" cy="${py}" r="${er*0.32}" fill="#16210d"/>`;
      } else if(eyeType===1){
        s+=`<ellipse cx="${px}" cy="${py}" rx="${er*0.16}" ry="${er*0.4}" fill="#16210d"/>`;
      } else if(eyeType===2){
        s+=`<circle cx="${px}" cy="${py}" r="${er*0.4}" fill="#16210d"/>`;
      } else {
        s+=`<circle cx="${px+side*8}" cy="${py}" r="${er*0.3}" fill="#16210d"/>`;
      }
      s+=`<circle cx="${px-side*6}" cy="${py-8}" r="${er*0.12}" fill="#fff"/>`;
    }
  });

  if(browType===1){
    ([-1,1] as number[]).forEach(side=>{const ex=200+side*eyeGap;
      s+=`<path d="M${ex-20} ${eyeY-30} L${ex+18} ${eyeY-22}" stroke="${frogDark}" stroke-width="6" stroke-linecap="round" transform="scale(${side},1) translate(${side<0?-400:0},0)"/>`;});
  } else if(browType===2){
    ([-1,1] as number[]).forEach(side=>{const ex=200+side*eyeGap;
      s+=`<path d="M${ex-18} ${eyeY-26} Q${ex} ${eyeY-34} ${ex+18} ${eyeY-26}" fill="none" stroke="${frogDark}" stroke-width="5" stroke-linecap="round"/>`;});
  }

  s+=`<circle cx="190" cy="206" r="4" fill="${frogDark}"/>`;
  s+=`<circle cx="210" cy="206" r="4" fill="${frogDark}"/>`;

  const my=232;
  if(mouthType===0){
    s+=`<path d="M150 ${my-8} Q200 ${my+44} 250 ${my-8}" fill="none" stroke="${frogDark}" stroke-width="7" stroke-linecap="round"/>`;
  } else if(mouthType===1){
    s+=`<path d="M165 ${my} Q200 ${my+22} 235 ${my}" fill="none" stroke="${frogDark}" stroke-width="6" stroke-linecap="round"/>`;
  } else if(mouthType===2){
    s+=`<ellipse cx="200" cy="${my+6}" rx="16" ry="20" fill="${frogDark}"/>`;
  } else {
    s+=`<path d="M158 ${my-6} Q200 ${my+40} 242 ${my-6}" fill="none" stroke="${frogDark}" stroke-width="7" stroke-linecap="round"/>`;
    s+=`<ellipse cx="216" cy="${my+24}" rx="13" ry="18" fill="#e8728c"/>`;
  }

  if(cheeks){
    s+=`<ellipse cx="146" cy="210" rx="20" ry="13" fill="#ef7a6a" opacity="0.5"/>`;
    s+=`<ellipse cx="254" cy="210" rx="20" ry="13" fill="#ef7a6a" opacity="0.5"/>`;
  }

  if(hat>0){ s+=`<g transform="translate(0,20)">`; }
  if(hat===1){
    s+=`<path d="M200 96 Q150 70 168 50 Q210 60 200 96 Z" fill="${shade(frog,-20)}"/>`;
    s+=`<path d="M186 76 L200 96" stroke="${frogDark}" stroke-width="3"/>`;
  } else if(hat===2){
    s+=`<path d="M158 100 L168 64 L184 92 L200 58 L216 92 L232 64 L242 100 Z" fill="#f4d35e" stroke="${shade('#f4d35e',-50)}" stroke-width="2"/>`;
    s+=`<circle cx="200" cy="62" r="5" fill="#e85a6a"/>`;
  } else if(hat===3){
    s+=`<rect x="160" y="60" width="80" height="14" rx="4" fill="#22301a"/>`;
    s+=`<rect x="172" y="22" width="56" height="44" rx="6" fill="#2c4020"/>`;
    s+=`<rect x="172" y="50" width="56" height="9" fill="#c8443c"/>`;
  } else if(hat===4){
    for(let i=0;i<5;i++){const a=i/5*Math.PI*2;
      s+=`<circle cx="${(232+Math.cos(a)*14).toFixed(0)}" cy="${(78+Math.sin(a)*14).toFixed(0)}" r="9" fill="#f4a6c0"/>`;}
    s+=`<circle cx="232" cy="78" r="7" fill="#f4d35e"/>`;
  }
  if(hat>0){ s+=`</g>`; }

  s+=`</g>`;
  return s;
}
