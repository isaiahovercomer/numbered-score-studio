export const KEYS={C:0,Db:1,D:2,Eb:3,E:4,F:5,Gb:6,G:7,Ab:8,A:9,Bb:10,B:11};
const SCALE=[0,2,4,5,7,9,11];
export function parseNotes(text,key='C'){
 if(!(key in KEYS))throw Error('請選擇大調調性。');
 return text.trim().split(/\s+/).filter(Boolean).map(t=>{
  const m=t.match(/^([#b]?)([0-7])([,']*)(?::(\d*\.?\d+))?$/);
  if(!m)throw Error(`無法讀取音符「${t}」，例如 1:0.5 或 5,。`);
  const d=m[4]===undefined?1:Number(m[4]);if(d<=0||d>32)throw Error('每個音符拍數需大於 0，且不超過 32。');
  if(m[2]==='0')return [null,d];
  const oct=[...m[3]].reduce((v,c)=>v+(c==="'"?12:-12),0);
  const p=60+KEYS[key]+SCALE[Number(m[2])-1]+oct+(m[1]==='#'?1:m[1]==='b'?-1:0);
  if(p<24||p>96)throw Error('音高超出可用範圍。');return [p,d];
 });
}
export function formatNotes(notes,key){return notes.map(([p,d])=>{
 if(p===null)return d===1?'0':`0:${d}`;
 const delta=p-(60+KEYS[key]);const oct=Math.floor(delta/12),pc=((delta%12)+12)%12;
 let degree=SCALE.indexOf(pc),alter='';if(degree<0){degree=SCALE.indexOf(pc-1);alter='#';}
 return `${alter}${degree+1}${oct>=0?"'".repeat(oct):','.repeat(-oct)}${d===1?'':':'+d}`;
}).join(' ');}
export function chordVoicing(symbol){
 const m=symbol.match(/^([A-G])([b#]?)(maj7|m7|m|7|dim|sus4|sus2|aug)?(?:\/([A-G])([b#]?))?$/);
 if(!m)throw Error(`不支援和絃「${symbol}」。可用 F、Bb、Dm、G7、Gm7、C/E 等。`);
 const natural={C:0,D:2,E:4,F:5,G:7,A:9,B:11},pc=(natural[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0)+12)%12;
 const ints={'':[0,4,7],m:[0,3,7],7:[0,4,7,10],m7:[0,3,7,10],maj7:[0,4,7,11],dim:[0,3,6],sus4:[0,5,7],sus2:[0,2,7],aug:[0,4,8]}[m[3]||''];
 const tones=ints.map(i=>{let p=48+pc+i;while(p<52)p+=12;while(p>64)p-=12;return p;}).sort((a,b)=>a-b);
 let bp=m[4]?(natural[m[4]]+(m[5]==='#'?1:m[5]==='b'?-1:0)+12)%12:pc;
 return {bass:36+bp,tones};
}
export function validateScore(s){
 if(!s||typeof s!=='object'||!s.sections||!Array.isArray(s.form)||!s.form.length)throw Error('樂譜缺少 sections 或 form。');
 if(s.extra_events?.length)throw Error('此樂譜含自訂額外聲部，請先用原技能輸出；網頁版尚不支援此格式。');
 if(s.warnings!==undefined&&(!Array.isArray(s.warnings)||!s.warnings.every(w=>typeof w==='string')))throw Error('辨識備註格式不正確。');
 if(Object.keys(s.sections).length>12||s.form.length>64)throw Error('段落數量過多。');
 for(const section of Object.values(s.sections))if(!Array.isArray(section)||!section.length||section.length>128||section.some(b=>!Array.isArray(b.notes)||b.notes.some(n=>!Array.isArray(n)||n.length!==2)))throw Error('樂譜段落格式不正確。');
 if(!(s.key in KEYS))throw Error('目前支援 C 到 B 的大調，請先轉為大調音階表示。');
 if(!Number.isFinite(s.bpm)||s.bpm<40||s.bpm>200)throw Error('速度請設定為 40–200 BPM。');
 if(!Array.isArray(s.meter)||s.meter.length!==2||!Number.isInteger(s.meter[0])||s.meter[0]<1||s.meter[0]>12||![4,8].includes(s.meter[1]))throw Error('拍號格式不正確。');
 let beats=0,bars=0,notes=0;
 for(const f of s.form){
  const section=s.sections[f.section];if(!Array.isArray(section)||!section.length)throw Error(`找不到段落 ${f.section}。`);
  section.forEach((b,i)=>{if(!Array.isArray(b.notes)||!b.notes.length)throw Error(`${f.section} 第 ${i+1} 小節沒有音符。`);
   let sum=0;for(const n of b.notes){if(!Array.isArray(n)||n.length!==2||!(n[0]===null||(Number.isInteger(n[0])&&n[0]>=24&&n[0]<=96))||!Number.isFinite(n[1])||n[1]<=0||n[1]>32)throw Error(`${f.section} 第 ${i+1} 小節有無效音符。`);sum+=n[1];if(n[0]!==null)notes++;}
   const expected=b.beats??s.meter[0]*4/s.meter[1];if(!Number.isFinite(expected)||expected<=0||expected>16||Math.abs(sum-expected)>1e-6)throw Error(`${f.section} 第 ${i+1} 小節應為 ${expected} 拍，目前 ${sum} 拍。`);
   beats+=sum;bars++;
  });
 }
 if(bars>512||notes>8000||beats*60/s.bpm>600)throw Error('單次輸出上限為 10 分鐘、512 小節。請減少遍數。');
 return {beats,bars,notes,seconds:beats*60/s.bpm+2};
}
export function arrange(s,mode='ensemble',mix={},preview=false){
 const stats=validateScore(s),ev=[];let pos=0,count=0;
 function add(part,p,t,d,g,pan=0){if((mix[part]??1)>0)ev.push({part,p,t,d,g:g*(mix[part]??1),pan});}
 for(const f of s.form){for(const b of playbackBars(s.sections[f.section])){
  if(preview&&count>=8)return {ev,seconds:pos*60/s.bpm+2,beats:pos};
  const beats=b.notes.reduce((a,n)=>a+n[1],0),base=pos;const rests=[];
  for(const [index,[p,d]] of b.notes.entries()){if(p!==null){const prev=ev.findLast(e=>e.part==='melody');if(b.tieFrom?.includes(index)&&prev?.p===p&&Math.abs(prev.t+prev.d-pos)<1e-6)prev.d+=d;else add('melody',p,pos,d,.88);}else rests.push([pos,d]);pos+=d;}
  if(mode!=='melody'){
   if(!b.chord){if(b.lastSegment)count++;continue;}
   let c=s.chords?.[b.chord]||chordVoicing(b.chord);
   if(!Number.isInteger(c.bass)||!Array.isArray(c.tones)||c.tones.length<3||c.tones.length>5||![c.bass,...c.tones].every(p=>Number.isInteger(p)&&p>=24&&p<=96))throw Error(`和絃 ${b.chord} 音高無效。`);
   const tones=[...c.tones].sort((a,b)=>a-b),level=Math.min(1.2,Math.max(.5,Number(f.intensity)||.9));
   if(mode==='block'){
    add('arpeggio',c.bass,base,beats*.9,.34*level,-.2);
    for(let j=1;j<beats;j++)for(const p of tones)add('arpeggio',p,base+j,Math.min(.88,beats-j),.2*level,-.2);
   }else{
    const pat=[c.bass+12,...tones,...tones.slice(0,-1).reverse()];
    for(let j=0;j<beats*2;j++)add('arpeggio',pat[j%pat.length],base+j*.5,Math.min(.7,beats-j*.5),.27*level,-.22);
    if(mode==='arpeggio')add('arpeggio',c.bass,base,beats*.9,.28*level,-.1);
   }
   if(mode==='ensemble'){
    add('cello',c.bass,base,beats*.97,.30*level,.12);
    if(f.strings!==false)tones.slice(-2).forEach((p,j)=>add('violin',p,base,beats*.97,.13*level,j? .48:-.48));
    if(f.flute!==false&&rests.length){const [t,d]=rests.at(-1);tones.slice(-2).forEach((p,j)=>add('flute',p+12,t+j*d/2,d*.46,.20*level,.3));}
   }
  }if(b.lastSegment)count++;
 }}return {ev,seconds:stats.seconds,beats:stats.beats};
}
export function midiBytes(s,mode,mix){
 const {ev}=arrange(s,mode,mix),enc=new TextEncoder();
 const be=(n,c)=>Array.from({length:c},(_,i)=>(n>>>(8*(c-i-1)))&255);
 const vlq=n=>{let a=[n&127];while(n>>=7)a.unshift((n&127)|128);return a;};
 const chunk=(name,bytes)=>[...enc.encode(name),...be(bytes.length,4),...bytes];
 const tracks=[],parts=['melody','arpeggio','cello','violin','flute'];
 const tempo=Math.round(60000000/s.bpm);tracks.push(chunk('MTrk',[0,255,81,3,...be(tempo,3),0,255,88,4,s.meter[0],Math.log2(s.meter[1]),24,8,0,255,47,0]));
 parts.forEach((part,ch)=>{
  const events=[];ev.filter(e=>e.part===part).forEach(e=>{events.push([Math.round(e.t*480),1,e.p,Math.min(110,Math.max(20,Math.round(e.g*90)))]);events.push([Math.round((e.t+e.d*.95)*480),0,e.p,0]);});
  if(!events.length)return;events.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const name=[...enc.encode(part)];let bytes=[0,255,3,...vlq(name.length),...name,0,192+ch,[0,0,42,48,73][ch]],last=0;
  for(const [t,on,p,v]of events){bytes.push(...vlq(t-last),(on?144:128)+ch,p,v);last=t;}bytes.push(0,255,47,0);tracks.push(chunk('MTrk',bytes));
 });return new Uint8Array([...enc.encode('MThd'),0,0,0,6,0,1,...be(tracks.length,2),1,224,...tracks.flat()]);
}

function playbackBars(bars){
 const result=[];for(const bar of bars){const length=bar.notes.reduce((n,v)=>n+v[1],0),changes=bar.chordChanges?.length?bar.chordChanges:[{beat:0,text:bar.chord||''}];const points=[...new Set([0,...changes.map(c=>c.beat),length])].sort((a,b)=>a-b);
 for(let i=0;i<points.length-1;i++){const start=points[i],end=points[i+1],out={lastSegment:i===points.length-2,notes:[],tieFrom:[],chord:changes.filter(c=>c.beat<=start).at(-1)?.text||'',beats:end-start};let at=0;for(const [j,n]of bar.notes.entries()){const a=Math.max(at,start),z=Math.min(at+n[1],end);if(z>a){if((a>at||bar.tieFrom?.includes(j))&&n[0]!==null)out.tieFrom.push(out.notes.length);out.notes.push([n[0],z-a]);}at+=n[1];}result.push(out);}}
 return result;
}
