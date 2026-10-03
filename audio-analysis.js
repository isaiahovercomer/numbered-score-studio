// Local experimental monophonic pitch tracker, not Chordino or a separation model.
const median=a=>{const s=[...a].sort((a,b)=>a-b);return s[Math.floor(s.length/2)]||0;};
export function detectPitch(y,start,size,sr){let energy=0,mean=0;for(let i=0;i<size;i++)mean+=y[start+i]||0;mean/=size;for(let i=0;i<size;i++)energy+=((y[start+i]||0)-mean)**2;
 const rms=Math.sqrt(energy/size);if(rms<.006)return {midi:null,confidence:0,rms};
 let best=0,lagBest=0;const values=[];for(let lag=Math.floor(sr/1100);lag<=Math.ceil(sr/90);lag++){let cross=0,a=0,b=0;for(let i=0;i<size-lag;i++){const x=(y[start+i]||0)-mean,z=(y[start+i+lag]||0)-mean;cross+=x*z;a+=x*x;b+=z*z;}const v=cross/Math.sqrt(a*b+1e-20);values[lag]=v;}
 // Prefer the first strong local maximum to reduce octave-down errors.
 for(let lag=Math.floor(sr/1100)+1;lag<Math.ceil(sr/90);lag++)if(values[lag]>values[lag-1]&&values[lag]>=values[lag+1]&&values[lag]>best){best=values[lag];lagBest=lag;if(best>.92)break;}
 if(best<.70)return {midi:null,confidence:best,rms};
 const delta=.5*(values[lagBest-1]-values[lagBest+1])/(values[lagBest-1]-2*best+values[lagBest+1]||1);
 let midi=Math.round(69+12*Math.log2(sr/(lagBest+delta)/440));
 const spectral=m=>{let re=0,im=0;const omega=2*Math.PI*440*2**((m-69)/12)/sr;for(let i=0;i<size;i++){const v=((y[start+i]||0)-mean)*(.5-.5*Math.cos(2*Math.PI*i/(size-1)));re+=v*Math.cos(omega*i);im+=v*Math.sin(omega*i);}return Math.hypot(re,im);};
 if(midi<=78&&spectral(midi+12)>spectral(midi)*5.5)midi+=12;
 return {midi:midi>=36&&midi<=90?midi:null,confidence:best,rms};
}
export function analyzeMelody(samples,sr,{bpm=0,pickup=0,key='C',title='旋律校對稿'}={},progress=()=>{}){
 if(samples.length/sr>180)throw Error('請使用 3 分鐘以內的單音旋律。');
 const hop=Math.round(sr*.02),size=Math.round(sr*.096),frames=[];
 for(let start=0;start+size<=samples.length;start+=hop){frames.push({...detectPitch(samples,start,size,sr),time:(start+size/2)/sr});if(frames.length%100===0)progress(start/samples.length*.65);}
 for(let i=2;i<frames.length-2;i++){const p=frames.slice(i-2,i+3).map(x=>x.midi).filter(x=>x!==null);if(p.length>=3)frames[i].smooth=median(p);}
 // Detect attacks from energy rises; do not create a new note merely because
 // a decaying tone's autocorrelation jumps down an octave.
 const energy=frames.map((f,i)=>median(frames.slice(Math.max(0,i-1),i+2).map(v=>v.rms)));
 const rises=energy.map((v,i)=>Math.max(0,v-(energy[i-1]||0))),maxRise=Math.max(...rises),candidates=[];
 for(let i=1;i<rises.length-1;i++)if(rises[i]>=rises[i-1]&&rises[i]>rises[i+1]&&rises[i]>maxRise*.065){
  if(candidates.length&&i-candidates.at(-1)<8){if(rises[i]>rises[candidates.at(-1)])candidates[candidates.length-1]=i;}else candidates.push(i);}
 const events=[];
 for(const i of candidates){const start=Math.max(0,frames[i].time-.04),window=frames.slice(i+1,i+7),weights=new Map();
 for(const f of window)if(f.midi!==null)weights.set(f.midi,(weights.get(f.midi)||0)+f.rms*f.confidence);
 if(!weights.size)continue;const midi=[...weights].sort((a,b)=>b[1]-a[1])[0][0];const amplitude=Math.max(...window.map(f=>f.rms));const local=Math.max(...energy.slice(Math.max(0,i-50),i+50));
 if(amplitude<local*.22)continue;
 if(events.length&&midi===events.at(-1).midi&&rises[i]<amplitude*.08)continue;
 const confidence=median(window.map(f=>f.confidence));if(confidence<.70)continue;
 events.push({start,end:start+.1,midi,confidence});}
 if(events.length<2)throw Error('無法找到足夠的穩定單音，請使用清楚的獨奏錄音。');
 for(let i=0;i<events.length;i++){const e=events[i],next=events[i+1]?.start??samples.length/sr;const active=frames.filter(f=>f.time>=e.start&&f.time<next&&f.rms>.012);e.end=active.at(-1)?.time??next;}

 if(!bpm){const gaps=events.slice(1).map((e,i)=>e.start-events[i].start).filter(t=>t>.18&&t<.45);bpm=Math.round(60/(2*median(gaps)||.5));bpm=Math.max(40,Math.min(200,bpm));}
 if(!Number.isFinite(bpm)||bpm<40||bpm>200)throw Error('速度需為 40–200 BPM。');
 const beat=60/bpm,notes=[];let q=0;
 for(let i=0;i<events.length;i++){const e=events[i],next=events[i+1];const gap=(next?.start??e.end)-e.start;const duration=Math.max(2,Math.round(gap/beat*2)*2);
 // Only sustained silence is a rest; instrument decay alone is unreliable.
 const silence=next?next.start-e.end:0;const rest=silence>beat*.9?Math.max(0,Math.round(silence/beat*2)*2):0;
 const sounding=Math.max(2,duration-rest);notes.push({q,duration:sounding,midi:e.midi,confidence:e.confidence});q+=sounding;
 if(rest){notes.push({q,duration:rest,midi:null,confidence:.5});q+=rest;}}
 progress(1);return {title,target_key:key,source_key:key,bpm_estimate:bpm,pickup_beats:pickup,notes,events,source:'browser-autocorrelation-experimental',review_notes:['瀏覽器單音辨識實驗稿；調性及弱起依輸入設定，拍號暫用 4/4。','音高、同音重複、長音及休止必須人工校對。']};
}
// Chroma-template estimate from audio, distinct from melody harmonization.
export function estimateChords(samples,sr,bpm=120,progress=()=>{}){
 const hop=Math.round(sr*.25),size=Math.round(sr*.12),out=[];const masks={major:[0,4,7],minor:[0,3,7],seventh:[0,4,7,10]};
 for(let offset=0;offset<samples.length;offset+=Math.round(sr*60/bpm*2)){
 const chroma=new Float64Array(12);let energy=0;
 for(let start=offset;start<Math.min(samples.length-size,offset+sr*60/bpm*2);start+=hop){for(let midi=40;midi<=83;midi++){const f=440*2**((midi-69)/12),w=2*Math.PI*f/sr;let re=0,im=0;for(let j=0;j<size;j++){const x=samples[start+j]*(.5-.5*Math.cos(2*Math.PI*j/(size-1)));re+=x*Math.cos(w*j);im+=x*Math.sin(w*j);}const v=Math.sqrt(re*re+im*im);chroma[midi%12]+=v;energy+=v;}}
 let best={score:-Infinity,text:'N'};for(let root=0;root<12;root++)for(const [type,mask]of Object.entries(masks)){let v=0;for(let pc=0;pc<12;pc++)v+=chroma[pc]*(mask.includes((pc-root+12)%12)?1/mask.length:-.09);if(v>best.score)best={score:v,text:['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'][root]+(type==='minor'?'m':type==='seventh'?'7':'')};}
 const text=energy<.5?'N':best.text;if(out.at(-1)?.text!==text)out.push({time:offset/sr,text});progress(offset/samples.length);
 }return out;
}
