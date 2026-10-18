import {KEYS,validateScore} from './music.js';
import {writtenEvents} from './score-bridge.js';
import {widths} from './font-metrics.js';
import {applyWordingToScore,wordingHints} from './wording.js';
export {wordingHints,applyWording,applyWordingToScore,describeChanges} from './wording.js';
const scale=[0,2,4,5,7,9,11],enc=new TextEncoder();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
// ── 版式選項 ───────────────────────────────────────────────────────────────
// lsm：依水流職事站官方標語歌頁（B26ANCC01zht p.2）實測；classic：本專案原有版式（A4、標楷體 22pt、一、二、三、）。
// 兩者皆可個別覆寫 paper／verseMarks／tempo／copyright。官方量測不到的項目（01SMN 14pt、和弦字型字級顏色、音符間距）兩版共用現狀。
export const PAPERS={letter:{w:12240,h:15840,name:'Letter'},a4:{w:11906,h:16838,name:'A4'}};
export const PRESETS={
 lsm:{paper:'letter',verseMarks:'circled',tempo:false,keyStyle:'lsm',titleFont:'新細明體',titlePt:14,textFont:'新細明體',textAscii:'Times New Roman',lyricPt:12,metaPt:10,marginLR:650,marginTop:1140,marginBottom:650,rowBase:34,copyright:'',wording:true},
 classic:{paper:'a4',verseMarks:'chinese',tempo:true,keyStyle:'classic',titleFont:'標楷體',titlePt:22,textFont:'標楷體',textAscii:undefined,lyricPt:13.5,metaPt:11,marginLR:567,marginTop:567,marginBottom:567,rowBase:44,copyright:'',wording:false}};
export const DEFAULT_PRESET='lsm';
export function resolveOptions(o={}){const base=PRESETS[o.preset]||PRESETS[DEFAULT_PRESET],r={...base};
 for(const k of ['paper','verseMarks','tempo','copyright','wording'])if(o[k]!==undefined&&o[k]!==null)r[k]=o[k];
 if(!PAPERS[r.paper])throw Error('紙張只支援 Letter 或 A4。');if(!['circled','chinese'].includes(r.verseMarks))throw Error('節次樣式只支援圈圈數字或中文數字。');
 r.copyright=String(r.copyright||'').trim().slice(0,120);r.tempo=Boolean(r.tempo);r.wording=Boolean(r.wording);r.preset=PRESETS[o.preset]?o.preset:DEFAULT_PRESET;
 const page=PAPERS[r.paper];r.pageW=page.w/20;r.pageH=page.h/20;r.usable=r.pageW-2*r.marginLR/20;r.wrapMax=r.usable-68.6;r.classic=r.keyStyle==='classic';return r;}
const CN_MARKS=['一','二','三','四','五','六','七','八','九','十'];
// ①～⑳（U+2460）、㉑～㉟（U+3251）、㊱～㊿（U+32B1）；超過 50 節退回「51、」。
export function verseMark(i,style='circled'){const n=i+1;if(style==='circled'){if(n<=20)return String.fromCodePoint(0x2460+i);if(n<=35)return String.fromCodePoint(0x3251+n-21);if(n<=50)return String.fromCodePoint(0x32b1+n-36);}return (CN_MARKS[i]||n)+'、';}
// 官方調號寫法：「D大調」；降記號寫「降B大調」（官方樣本只有 D 大調，降調寫法為依華語慣例推定）。
export function keyName(key){return (key.endsWith('b')?'降':'')+key[0]+'大調';}
export function token(midi,q,key){const dotted=[3,6].includes(q),base=dotted?q/1.5:q;if(midi===null)return {1:';',2:'p',3:'po',4:'`',6:'`.',8:'``',12:'```',16:'````'}[q];
 let rel=midi-60-KEYS[key],oct=Math.floor(rel/12),pc=(rel%12+12)%12,degree=scale.indexOf(pc),acc='';if(degree<0){const next=scale.find(v=>v>pc)??12;degree=scale.indexOf(next);if(next===12){degree=0;oct++;}acc=':';}
 if(oct< -1||oct>1)throw Error('Word 字型版暫限中音及高低各一個八度；請先移調或校正音高。');
 let ch=base>=4?String(degree+1):(base===2?'qwertyu':'asdfghj')[degree];if(oct>0)ch=base>=4?'!@#$%^&'[degree]:ch.toUpperCase();
 return acc+ch+(oct<0?(base>=4?'8':base===2?'i':'k'):'')+(dotted?(base===2?'o':'.'):'')+(base>=4?'/'.repeat(Math.floor(base/4)-1):'');}
export function parseVerses(text){if(!text?.trim())return [];const lines=text.replace(/\r/g,'').split('\n');const verses=[];let current=[];
 const flush=()=>{if(current.length){verses.push(current);current=[];}};
 for(const line of lines){const s=line.trim();if(!s){flush();continue;}if(/^([一二三四五六七八九十\d]+[、.．]|[\u2460-\u2473\u3251-\u325f\u32b1-\u32bf])$/.test(s)){flush();continue;}current.push(s.replace(/^([一二三四五六七八九十\d]+[、.．]\s*|[\u2460-\u2473\u3251-\u325f\u32b1-\u32bf]\s*)/,''));}flush();
 return verses.map(lines=>{const syllables=[];let prefix='';for(const line of lines){for(const c of line){if(/\p{Script=Han}|[a-zA-Z0-9]/u.test(c)){syllables.push(prefix+c);prefix='';}else if(!syllables.length||'「『“'.includes(c)){prefix+=c;}else syllables[syllables.length-1]+=c;}}if(prefix&&syllables.length)syllables[syllables.length-1]+=prefix;return syllables;});}
const advance=raw=>[...raw].reduce((n,c)=>n+(widths[c]??1),0)*14;
export function layout(s,options){const o=resolveOptions(options);validateScore(s);const {events,changes}=writtenEvents(s),verses=parseVerses(s.lyrics);const count=events.filter(e=>e.midi!==null).length;
 if(verses.some(v=>v.length!==count))throw Error(`歌詞需逐字對位：本譜有 ${count} 個起音，目前各節為 ${verses.map(v=>v.length).join('、')} 字。請以空行分節，或先清空歌詞匯出純譜。英語及一字多音請匯入已對位的技能 JSON。`);
 const pieces=[];let attack=0;const beats=s.meter[0]*4/s.meter[1];let barEnd=(Object.values(s.sections)[0][0].beats??beats)*4;const barEnds=[];let bq=0;for(const bs of Object.values(s.sections))for(const b of bs){bq+=b.notes.reduce((n,x)=>n+x[1]*4,0);barEnds.push(bq);}
 for(const e of events){let at=e.q,left=e.duration,part=0;while(left){barEnd=barEnds.find(v=>v>at)??at+left;const cap=Math.min(left,barEnd-at);const duration=[16,12,8,6,4,3,2,1].find(v=>v<=cap);const text=token(e.midi,duration,s.key);const lyrics=e.midi!==null&&part===0?verses.map(v=>v[attack]):[];const inside=changes.filter(c=>c.q>=at&&c.q<at+duration);let width=Math.max(advance(text),...lyrics.map(t=>[...t].length*o.lyricPt+2),16);if(inside.length)width=Math.max(width,...inside.map(c=>c.text.length*6+10),inside.length*34);pieces.push({text,q:at,duration,midi:e.midi,lyrics,tied:e.midi!==null&&part>0,tieNext:e.midi!==null&&left>duration,endBar:at+duration===barEnd,width,chords:inside});left-=duration;at+=duration;part++;}if(e.midi!==null)attack++;}
 const systems=[];let row=[],x=0;for(const p of pieces){const w=p.width+(p.endBar?14:3);if(x+w>o.wrapMax&&row.length){systems.push(row);row=[];x=0;}p.x=x;row.push(p);x+=w;}if(row.length)systems.push(row);
 const maxWidth=Math.max(...systems.map(r=>r.at(-1).x+r.at(-1).width+14)),offset=(o.usable-maxWidth-32)/2+32;
 return {systems,verses,offset,count,options:o};}
function run(text,font,size,color='000000',sub=false,ascii=font,italic=false){return `<w:r><w:rPr><w:rFonts w:ascii="${ascii}" w:hAnsi="${ascii}" w:eastAsia="${font}"/>${italic?'<w:i/>':''}<w:color w:val="${color}"/><w:sz w:val="${size*2}"/>${sub?'<w:vertAlign w:val="subscript"/>':''}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;}
let shapeId=0;const emu=v=>Math.round(v*12700);
function anchor(x,y,w,h,inner){return `<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${++shapeId}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>${emu(x)}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>${emu(y)}</wp:posOffset></wp:positionV><wp:extent cx="${emu(w)}" cy="${emu(h)}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${shapeId}" name="Score ${shapeId}"/><wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr txBox="1"/>${inner}</wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;}
function box(text,x,y,w,h,font,size,color='000000',chord=false,ascii=font){const content=chord?text.split(/(\d+)/).filter(Boolean).map(t=>run(t,font,size,color,/^\d+$/.test(t))).join(''):run(text,font,size,color,false,ascii);return anchor(x,y,w,h,`<wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></wps:spPr><wps:txbx><w:txbxContent><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${Math.round(h*20)}" w:lineRule="exact"/><w:jc w:val="${chord?'center':'left'}"/></w:pPr>${content}</w:p></w:txbxContent></wps:txbx><wps:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></wps:bodyPr>`);}
function tie(x,y,width){if(width<2)return '';const w=emu(width),h=emu(5),edge=Math.min(emu(7),w/3);return anchor(x,y,width,5,`<wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst><a:path w="${w}" h="${h}" fill="none"><a:moveTo><a:pt x="0" y="${h}"/></a:moveTo><a:cubicBezTo><a:pt x="0" y="0"/><a:pt x="${edge}" y="0"/><a:pt x="${edge}" y="0"/></a:cubicBezTo><a:lnTo><a:pt x="${w-edge}" y="0"/></a:lnTo><a:cubicBezTo><a:pt x="${w-edge}" y="0"/><a:pt x="${w}" y="0"/><a:pt x="${w}" y="${h}"/></a:cubicBezTo></a:path></a:pathLst></a:custGeom><a:noFill/><a:ln w="6350"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></wps:spPr><wps:bodyPr/>`);}
function zipStore(files){const chunks=[],central=[];let offset=0;const u16=n=>[n&255,n>>>8&255],u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];const crc=data=>{let c=0xffffffff;for(const b of data){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
 for(const [name,text]of Object.entries(files)){const n=enc.encode(name),b=enc.encode(text),c=crc(b);const header=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(33),...u32(c),...u32(b.length),...u32(b.length),...u16(n.length),...u16(0),...n]);chunks.push(header,b);central.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(33),...u32(c),...u32(b.length),...u32(b.length),...u16(n.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...n]));offset+=header.length+b.length;}
 const size=central.reduce((n,c)=>n+c.length,0);return new Blob([...chunks,...central,new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(central.length),...u16(central.length),...u32(size),...u32(offset),...u16(0)])],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});}
// 標題區：classic 為原版（標題置中、「1=C　4/4　♩ = 88」靠右）；lsm 為官方（標題置中；左「D大調」、右「4/4」）。
function headerXml(s,o,ref){const title=s.title||'簡譜';
 if(o.classic){const para=(text,size,align)=>`<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:before="0" w:after="80"/></w:pPr>${run(text,'標楷體',size)}</w:p>`,meta=`1=${s.key}　${s.meter.join('/')}　♩ = ${s.bpm}`;
  return ref?`<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="80"/></w:pPr>${run(s.title,'標楷體',22)}</w:p><w:p><w:pPr><w:jc w:val="right"/></w:pPr>${run(meta,'標楷體',11)}</w:p>`:para(title,22,'center')+para(meta,11,'right');}
 const f=o.textFont,a=o.textAscii,right=`${s.meter.join('/')}${o.tempo?`　♩ = ${s.bpm}`:''}`;
 return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="100" w:line="340" w:lineRule="exact"/></w:pPr>${run(title,o.titleFont,o.titlePt,'000000',false,a)}</w:p>`
  +`<w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="${Math.round((o.usable-14)*20)}"/></w:tabs><w:spacing w:before="0" w:after="100" w:line="280" w:lineRule="exact"/><w:ind w:left="500"/></w:pPr>${run(keyName(s.key),f,o.metaPt,'000000',false,a)}<w:r><w:tab/></w:r>${run(right,f,o.metaPt,'000000',false,a)}</w:p>`;}
// 末頁版權行：置於最後一個段落內、相對頁面底部定位（官方約距底 25.5 pt），因此只出現在最後一頁，且不產生多餘空白頁。
function copyrightAnchor(text,o){const w=360,h=14;shapeId++;
 return `<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${shapeId}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:align>center</wp:align></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>${emu(o.pageH-36.5)}</wp:posOffset></wp:positionV><wp:extent cx="${emu(w)}" cy="${emu(h)}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${shapeId}" name="Copyright ${shapeId}"/><wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr txBox="1"/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></wps:spPr><wps:txbx><w:txbxContent><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${h*20}" w:lineRule="exact"/><w:jc w:val="center"/></w:pPr>${run(text,o.textFont,10,'000000',false,'New Century Schoolbook',true)}</w:p></w:txbxContent></wps:txbx><wps:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></wps:bodyPr></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;}
// 節次標記方塊：圈圈數字緊貼第一字左側；中文數字沿用原位置（左移 32 pt、寬 30 pt）。
function markBox(vi,x,y,o){return o.verseMarks==='circled'?box(verseMark(vi,'circled'),x-16,y,16,19,o.textFont,o.lyricPt,'000000',false,o.textAscii):box(verseMark(vi,'chinese'),x-32,y,30,19,o.textFont,o.lyricPt,'000000',false,o.textAscii);}
// 官方用字：只影響輸出（標題、歌詞、技能參考資料音節），呼叫端的原稿 score 不會被修改；前後等長，逐字對位不變。
export function wordingChanges(s,options){return resolveOptions(options).wording?applyWordingToScore(s).changes:[];}
export function wordBlob(s0,options){shapeId=0;const s=resolveOptions(options).wording?applyWordingToScore(s0).score:s0;const {systems,verses,offset,options:o}=layout(s,options);let body=headerXml(s,o,false);
 let tieStart=null;
 const reference=referenceBody(s,o);if(reference)body=reference;
 else for(const [ri,row]of systems.entries()){const height=o.rowBase+verses.length*19;let shapes='';
 for(const [i,p]of row.entries()){const x=offset+p.x;shapes+=box(p.text,x,12,Math.max(p.width,advance(p.text))+2,25,'01SMN',14);if(p.endBar)shapes+=box('\\',x+p.width,12,14,25,'01SMN',14);
 for(const [vi,t]of p.lyrics.entries()){shapes+=box(t,x,38+vi*19,Math.max(p.width,[...t].length*o.lyricPt+2),19,o.textFont,o.lyricPt,'000000',false,o.textAscii);if(ri===0&&i===0)shapes+=markBox(vi,x,38+vi*19,o);}
 for(const c of p.chords){const cx=x+7+(c.q-p.q)/p.duration*p.width,w=Math.max(20,c.text.length*6+4);shapes+=box(c.text,cx-w/2,0,w,13,'Times New Roman',10,'9C2323',true);}
 if(p.tied&&tieStart===null)tieStart=offset;
 if(p.tied&&!p.tieNext&&tieStart!==null){shapes+=tie(tieStart,9,x+7-tieStart);tieStart=null;}
 if(p.tieNext&&!p.tied)tieStart=x+7;
 if(i===row.length-1&&tieStart!==null){shapes+=tie(tieStart,9,x+p.width+7-tieStart);tieStart=null;}}
 body+=`<w:p><w:pPr><w:spacing w:line="${height*20}" w:lineRule="exact" w:after="100"/><w:keepLines/></w:pPr>${shapes}</w:p>`;}
 // Review status is shown in the site; avoid a trailing paragraph forcing a blank second page.
 if(o.copyright)body=body.replace(/<\/w:p>$/,copyrightAnchor(o.copyright,o)+'</w:p>');

 const xml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><w:body>${body}<w:sectPr><w:pgSz w:w="${PAPERS[o.paper].w}" w:h="${PAPERS[o.paper].h}"/><w:pgMar w:top="${o.marginTop}" w:right="${o.marginLR}" w:bottom="${o.marginBottom}" w:left="${o.marginLR}" w:header="0" w:footer="0"/></w:sectPr></w:body></w:document>`;
 return zipStore({'[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>','_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>','word/document.xml':xml});}
function referenceBody(s,o){const ref=s.notationLayout;if(!ref||ref.fingerprint!==JSON.stringify([s.sections,s.key,s.lyrics]))return null;
 const metrics=raw=>{let x=0,tied=false;const p=[];for(let i=0;i<raw.length;i++){const c=raw[i];if(c==='0')tied=true;if('1234567qwertyuasdfghjQWERTYUASDFGHJ!@#$%^&`p;'.includes(c)){p.push({x,attack:!tied&&!('`p;'.includes(c)),index:i});tied=false;}x+=(widths[c]??0)*14;}return p;};
 const systems=ref.systems.map(r=>({...r,raw:r.raw.replace(/9=0/g,'90').replace(/([1-7])([/]+)9=\\0/g,(_,n,d)=>n+'9'+[...d].map(()=> '=/').join('')+'=\\0')}));
 const maxWidth=Math.max(...systems.map(r=>advance(r.raw))),off=(o.usable-maxWidth-32)/2+32;
 let body=headerXml(s,o,true);
 const {changes}=writtenEvents(s);for(const [ri,r]of systems.entries()){const positions=metrics(r.raw),attacks=positions.filter(p=>p.attack);let shapes=box(r.raw,off,12,advance(r.raw)+3,28,'01SMN',14);
 for(const [vi,v]of r.lyrics.entries()){for(const [i,t]of v.syllables.entries()){if(!attacks[i])throw Error('原稿詞音位置不完整，請重新校對。');shapes+=box(t,off+attacks[i].x,40+vi*19,Math.max(16,[...t].length*o.lyricPt+2),19,o.textFont,o.lyricPt,'000000',false,o.textAscii);}if(ri===0)shapes+=markBox(vi,off,40+vi*19,o);}
 const end=systems[ri+1]?.note_q[0]??Infinity;for(const c of changes.filter(c=>c.q>=r.note_q[0]&&c.q<end)){let i=r.note_q.findIndex(q=>q===c.q),x;if(i>=0)x=positions[i].x;else {i=r.note_q.findLastIndex(q=>q<c.q);if(i<0)throw Error('和弦位置無效。');const next=r.note_q[i+1]??c.q+1;x=positions[i].x+(c.q-r.note_q[i])/(next-r.note_q[i])*((positions[i+1]?.x??positions[i].x+14)-positions[i].x);}
 const w=Math.max(20,c.text.length*6+4);shapes+=box(c.text,off+x+7-w/2,0,w,13,'Times New Roman',10,'9C2323',true);}
 body+=`<w:p><w:pPr><w:spacing w:line="${(o.rowBase+2+r.lyrics.length*19)*20}" w:lineRule="exact" w:after="100"/><w:keepLines/></w:pPr>${shapes}</w:p>`;}
 return body;
}
