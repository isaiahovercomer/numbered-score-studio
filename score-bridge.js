import {KEYS,validateScore,chordVoicing} from './music.js';
export function fromTranscription(d){
 if(!Array.isArray(d.notes)||!d.notes.length||d.notes.length>8000)throw Error('缺少有效的音符資料。');
 const key=d.target_key||d.source_key||'C';if(!(key in KEYS))throw Error('不支援此調性。');
 const bars=[];let bar={notes:[],chord:'',tieFrom:[]},q=0,limit=d.pickup_beats?d.pickup_beats*4:16,used=0;
 for(const n of d.notes){if(n.q!==q||!Number.isInteger(n.duration)||n.duration<1||n.duration>512||!(n.midi===null||Number.isInteger(n.midi)&&n.midi>=24&&n.midi<=96))throw Error('音符時間不連續或數值無效。');let left=n.duration,continuation=false;
 while(left){let take=Math.min(left,limit-used);if(continuation&&n.midi!==null)bar.tieFrom.push(bar.notes.length);bar.notes.push([n.midi,take/4]);left-=take;q+=take;used+=take;continuation=true;if(used===limit){bar.beats=limit/4;bars.push(bar);bar={notes:[],chord:'',tieFrom:[]};used=0;limit=16;}}
 }if(bar.notes.length){bar.beats=used/4;bars.push(bar);}
 let at=0;for(const b of bars){b.chordChanges=(d.chords||[]).filter(c=>c.q>=at&&c.q<at+b.beats*4).map(c=>({beat:(c.q-at)/4,text:c.text}));b.chord=b.chordChanges[0]?.text||'';at+=b.beats*4;}
 const s={title:d.title||'旋律校對稿',key,bpm:Math.max(40,Math.min(200,d.bpm_estimate||117)),meter:[4,4],sections:{verse:bars},form:[{section:'verse',intensity:1,strings:false,flute:false}],chords:{},warnings:d.review_notes||['音訊辨識校對稿：請核對音高、休止、拍號與弱起。'],lyrics:'',provenance:d.source||'skill-import'};
 if(d.systems?.length){const count=Math.max(...d.systems.map(x=>x.lyrics?.length||0));s.lyrics=Array.from({length:count},(_,i)=>{const chunks=d.systems.map(x=>(x.lyrics?.[i]?.syllables||[]).join(''));return (['一','二','三','四','五','六','七','八','九','十'][i]||i+1)+'、\n'+chunks.join('\n');}).join('\n\n');}
 if(d.systems?.length)s.notationLayout={systems:d.systems,fingerprint:JSON.stringify([s.sections,s.key,s.lyrics])};
 validateScore(s);return s;
}
export function writtenEvents(s){validateScore(s);const events=[],changes=[];let q=0;
 for(const [section,bars] of Object.entries(s.sections)){for(const b of bars){let at=q;for(const [i,n]of b.notes.entries()){const d=Math.round(n[1]*4);if(Math.abs(d-n[1]*4)>1e-7)throw Error('Word 暫支援十六分音符格線，請修正非整格拍數。');const tied=b.tieFrom?.includes(i);if(tied){const prev=events.at(-1);if(!prev||prev.midi!==n[0]||n[0]===null)throw Error('連結延音與前音不符，請重新校對。');prev.duration+=d;}else events.push({q:at,midi:n[0],duration:d});at+=d;}
 const cs=b.chordChanges?.length?b.chordChanges:(b.chord?[{beat:0,text:b.chord}]:[]);for(const c of cs){if(!Number.isFinite(c.beat)||c.beat<0||c.beat>=(at-q)/4)throw Error('和弦拍點超出小節。');chordVoicing(c.text);changes.push({q:q+c.beat*4,text:c.text});}q=at;}}
 return {events,changes};
}
export function parseChordChanges(text,beats){if(!text.trim())return [];let seen=new Set();return text.trim().split(/\s+/).map(t=>{const [symbol,b='0']=t.split('@');chordVoicing(symbol);const beat=Number(b);if(!Number.isFinite(beat)||beat<0||beat>=beats||seen.has(beat))throw Error('和弦請用 F@0 C7@2，拍點從 0 起算且不能重複。');seen.add(beat);return {text:symbol,beat};}).sort((a,b)=>a.beat-b.beat);}
