import test from 'node:test';import assert from 'node:assert/strict';import {createHash,createHmac} from 'node:crypto';
import worker,{MAX_OUTPUT_TOKENS,imageHeaderMatches,quotaSubject,hashIp} from './worker.js';

const salt='test-salt';
function dataUrl(type,bytes){
 const padded=Buffer.alloc(64);Buffer.from(bytes).copy(padded);
 return `data:image/${type};base64,${padded.toString('base64')}`;
}
const png=dataUrl('png',[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
const jpeg=dataUrl('jpeg',[0xff,0xd8,0xff,0xe0]);
const webp=dataUrl('webp',[0x52,0x49,0x46,0x46,0x18,0,0,0,0x57,0x45,0x42,0x50]);
const envBase={ALLOWED_ORIGIN:'https://example.com',OPENAI_API_KEY:'test-key',IP_HASH_SALT:salt};

test('image header must match the declared PNG, JPEG or WebP type',()=>{
 assert.equal(imageHeaderMatches(png),true);
 assert.equal(imageHeaderMatches(jpeg),true);
 assert.equal(imageHeaderMatches(webp),true);
 assert.equal(imageHeaderMatches(dataUrl('jpeg',[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])),false);
 assert.equal(imageHeaderMatches(dataUrl('png',[0xff,0xd8,0xff,0xe0])),false);
 assert.equal(imageHeaderMatches(dataUrl('webp',[0x52,0x49,0x46,0x46,0x18,0,0,0,0x57,0x41,0x56,0x45])),false);
 assert.equal(imageHeaderMatches(dataUrl('png',[0,1,2,3,4,5,6,7])),false);
 assert.equal(imageHeaderMatches('data:image/png;base64,AAAA'),false);
 assert.equal(imageHeaderMatches(png.replace('image/png','image/gif')),false);
});

test('IPv6 quota identity is the /64 prefix and IPv4 stays the full address',()=>{
 assert.equal(quotaSubject('203.0.113.7'),'203.0.113.7');
 assert.equal(quotaSubject('203.0.113.7'),quotaSubject('203.0.113.7'));
 assert.notEqual(quotaSubject('203.0.113.7'),quotaSubject('203.0.113.8'));
 const prefix='2001:db8:85a3:0::/64';
 assert.equal(quotaSubject('2001:db8:85a3::8a2e:370:7334'),prefix);
 assert.equal(quotaSubject('2001:0db8:85a3:0000:0000:8a2e:0370:7334'),prefix);
 assert.equal(quotaSubject('2001:DB8:85A3:0:ffff::1'),prefix);
 assert.equal(quotaSubject('2001:db8:85a3:0::1%eth0'),prefix);
 assert.notEqual(quotaSubject('2001:db8:85a3:1::1'),prefix);
 assert.equal(quotaSubject('::ffff:203.0.113.7'),'203.0.113.7');
 assert.equal(quotaSubject('0:0:0:0:0:ffff:203.0.113.8'),'203.0.113.8');
 assert.notEqual(quotaSubject('::ffff:203.0.113.7'),quotaSubject('::ffff:203.0.113.8'));
 assert.equal(quotaSubject('2001:db8::192.0.2.1'),'2001:db8:0:0::/64');
 assert.equal(quotaSubject('not-an-ip'),'not-an-ip');
});

test('IP hash is HMAC-SHA256 and groups addresses in the same IPv6 /64',async()=>{
 const ip='203.0.113.7';
 const previous=createHash('sha256').update(salt+'\0'+ip).digest('hex');
 const hmac=createHmac('sha256',salt).update(ip).digest('hex');
 assert.equal(await hashIp(salt,ip),hmac);
 assert.notEqual(await hashIp(salt,ip),previous);
 assert.notEqual(await hashIp(salt,ip),await hashIp('other-salt',ip));
 assert.notEqual(await hashIp(salt,'203.0.113.7'),await hashIp(salt,'203.0.113.8'));
 const a='2001:db8:85a3::1',b='2001:db8:85a3:0:ffff:ffff:ffff:ffff',c='2001:db8:85a3:1::1';
 assert.equal(await hashIp(salt,a),await hashIp(salt,b));
 assert.notEqual(await hashIp(salt,a),await hashIp(salt,c));
 assert.equal(await hashIp(salt,a),createHmac('sha256',salt).update(quotaSubject(a)).digest('hex'));
});

test('a missing client IP is rejected before the body is read',async()=>{
 let read=false;
 const request={method:'POST',url:'https://api.example/recognize',headers:new Headers({Origin:envBase.ALLOWED_ORIGIN}),body:{getReader(){read=true;throw Error('body read');}}};
 const env={...envBase,QUOTA:{idFromName(){throw Error('quota');},get(){throw Error('quota');}}};
 const res=await worker.fetch(request,env);
 assert.equal(res.status,403);
 assert.equal(read,false);
 assert.match((await res.json()).error,/網路來源/);
});

test('a mismatched image is rejected without consuming quota',async()=>{
 let consumed=false;
 const env={...envBase,QUOTA:{idFromName(){consumed=true;return 'id';},get(){consumed=true;return {fetch(){consumed=true;}};}}};
 const image=dataUrl('png',[0xff,0xd8,0xff,0xe0]);
 const res=await worker.fetch(new Request('https://api.example/recognize',{method:'POST',headers:{Origin:env.ALLOWED_ORIGIN,'CF-Connecting-IP':'203.0.113.9','Content-Type':'application/json'},body:JSON.stringify({image})}),env);
 assert.equal(res.status,400);
 assert.equal(consumed,false);
});

test('an accepted image is sent with the reduced output cap after quota admission',async()=>{
 const seen=[];const calls=[];
 const score={title:'t',key:'C',bpm:90,meter_numerator:3,meter_denominator:4,lyrics:'',uncertainties:[],sections:[{name:'verse',bars:[{chord:'C',beats:3,notes:[{pitch:60,duration:3}]}]}]};
 const original=globalThis.fetch;
 globalThis.fetch=async(url,init)=>{
  calls.push({url,body:init.body});
  const payload={status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(score)}]}]};
  return new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}});
 };
 const env={...envBase,QUOTA:{idFromName:name=>name,get:()=>({async fetch(_url,init){seen.push(JSON.parse(init.body).ipHash);return new Response('ok',{status:200});}})}};
 try{
  const res=await worker.fetch(new Request('https://api.example/recognize',{method:'POST',headers:{Origin:env.ALLOWED_ORIGIN,'CF-Connecting-IP':'203.0.113.10','Content-Type':'application/json'},body:JSON.stringify({image:png})}),env);
  assert.equal(res.status,200);
  assert.equal(seen.length,1);
  assert.equal(seen[0],await hashIp(salt,'203.0.113.10'));
  assert.equal(calls.length,1);
  assert.equal(JSON.parse(calls[0].body).max_output_tokens,MAX_OUTPUT_TOKENS);
  assert.equal(MAX_OUTPUT_TOKENS,10000);
  assert.ok(MAX_OUTPUT_TOKENS<12000);
 }finally{globalThis.fetch=original;}
});
