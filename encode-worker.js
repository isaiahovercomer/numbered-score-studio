importScripts('./lame.min.js');
self.onmessage=({data:{left,right,sr}})=>{try{
 const encoder=new lamejs.Mp3Encoder(2,sr,192),chunks=[];let size=0;
 for(let i=0;i<left.length;i+=1152){const end=Math.min(i+1152,left.length),l=new Int16Array(end-i),r=new Int16Array(end-i);for(let j=i;j<end;j++){l[j-i]=Math.max(-32768,Math.min(32767,Math.round(left[j]*32767)));r[j-i]=Math.max(-32768,Math.min(32767,Math.round(right[j]*32767)));}const chunk=encoder.encodeBuffer(l,r);if(chunk.length){chunks.push(new Uint8Array(chunk));size+=chunk.length;}if(i%(1152*100)===0)self.postMessage({progress:i/left.length});}
 const tail=encoder.flush();chunks.push(new Uint8Array(tail));size+=tail.length;const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}self.postMessage({bytes},[bytes.buffer]);
}catch(e){self.postMessage({error:e.message});}};
