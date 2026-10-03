import {arrange} from './music.js';
let manifest,context;const buffers=new Map();
export async function renderAudio(score,mode,mix,preview,onProgress){
 const {ev,seconds}=arrange(score,mode,mix,preview);if(!ev.length)throw Error('所有聲部都已靜音。');
 context??=new AudioContext();await context.resume();
 if(!manifest){const r=await fetch('./samples.json');if(!r.ok)throw Error('無法載入音色清單。');manifest=await r.json();}
 const sampleFor=e=>{const inst=['melody','arpeggio'].includes(e.part)?'piano':e.part;const sample=manifest[inst].samples.reduce((a,b)=>Math.abs(a.pitch-e.p)<=Math.abs(b.pitch-e.p)?a:b);if(Math.abs(sample.pitch-e.p)>12)throw Error(`音高 ${e.p} 超出 ${inst} 音色範圍，請移調或改用鋼琴。`);return {inst,...sample};};
 const needed=new Map(ev.map(e=>{const s=sampleFor(e);return [s.url,s];}));let done=0;
 for(const [url,s]of needed){if(!buffers.has(url)){const r=await fetch(url);if(!r.ok)throw Error('音色下載失敗，請稍後重試。');const b=await context.decodeAudioData(await r.arrayBuffer());buffers.set(url,b);}onProgress(5+20*++done/needed.size,'正在準備樂器音色…');}
 const sr=44100,offline=new OfflineAudioContext(2,Math.ceil(seconds*sr),sr),master=offline.createGain();master.gain.value=.65;master.connect(offline.destination);
 const sec=60/score.bpm;
 for(const e of ev){const s=sampleFor(e),buffer=buffers.get(s.url),source=offline.createBufferSource(),gain=offline.createGain(),pan=offline.createStereoPanner();source.buffer=buffer;source.playbackRate.value=2**((e.p-s.pitch)/12);
  const t=e.t*sec,d=e.d*sec,attack=s.inst==='piano'?.003:s.inst==='flute'?.04:.13;
  if(s.inst!=='piano'&&d>buffer.duration/source.playbackRate.value*.8){source.loop=true;source.loopStart=buffer.duration*.25;source.loopEnd=buffer.duration*.75;}
  const data=buffer.getChannelData(0);let peak=0;for(let i=0;i<data.length;i++)peak=Math.max(peak,Math.abs(data[i]));const level=e.g*(s.inst==='piano'?1:.38/Math.max(.01,peak));
  gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(level,t+Math.min(attack,d/4));gain.gain.setValueAtTime(level,t+Math.max(d-.05,attack));gain.gain.linearRampToValueAtTime(0,t+d+.15);pan.pan.value=e.pan;
  source.connect(gain).connect(pan).connect(master);source.start(t);source.stop(t+d+.16);
 }
 onProgress(30,'正在合成演奏…');const rendered=await offline.startRendering();const left=rendered.getChannelData(0),right=rendered.getChannelData(1);let peak=0;
 for(let i=0;i<left.length;i++){peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));}
 if(!Number.isFinite(peak)||peak===0)throw Error('產生的音訊無效。');const gain=.85/peak;
 for(let i=0;i<left.length;i++){left[i]*=gain;right[i]*=gain;}
 onProgress(55,'正在編碼 MP3…');
 return await new Promise((resolve,reject)=>{const w=new Worker(new URL('./encode-worker.js',import.meta.url));const timer=setTimeout(()=>{w.terminate();reject(Error('編碼逾時，請減少遍數後重試。'));},180000);
  w.onmessage=e=>{if(e.data.progress!==undefined){onProgress(55+e.data.progress*44,'正在編碼 MP3…');return;}clearTimeout(timer);w.terminate();if(e.data.error)reject(Error(e.data.error));else resolve(new Blob([e.data.bytes],{type:'audio/mpeg'}));};
  w.onerror=()=>{clearTimeout(timer);w.terminate();reject(Error('MP3 編碼失敗。'));};const l=left.slice(),r=right.slice();w.postMessage({left:l,right:r,sr},[l.buffer,r.buffer]);
 });
}
