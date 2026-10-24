import {arrange} from './music.js';
let manifest, context;
const buffers = new Map(),
  peaks = new Map();
export async function renderAudio(score, mode, mix, preview, onProgress) {
  const {ev, seconds} = arrange(score, mode, mix, preview);
  if (!ev.length) throw Error('所有聲部都已靜音。');
  context ??= new AudioContext();
  await context.resume();
  if (!manifest) {
    const response = await fetch('./samples.json');
    if (!response.ok) throw Error('無法載入音色清單。');
    manifest = await response.json();
  }
  const sampleFor = event => {
    const inst = ['melody', 'arpeggio'].includes(event.part) ? 'piano' : event.part;
    const sample = manifest[inst].samples.reduce((a, b) =>
      Math.abs(a.pitch - event.p) <= Math.abs(b.pitch - event.p) ? a : b
    );
    if (Math.abs(sample.pitch - event.p) > 12) {
      throw Error(`音高 ${event.p} 超出 ${inst} 音色範圍，請移調或改用鋼琴。`);
    }
    return {inst, ...sample};
  };
  const needed = new Map(
    ev.map(event => {
      const sample = sampleFor(event);
      return [sample.url, sample];
    })
  );
  let done = 0;
  for (const [url] of needed) {
    if (!buffers.has(url)) {
      const response = await fetch(url);
      if (!response.ok) throw Error('音色下載失敗，請稍後重試。');
      buffers.set(url, await context.decodeAudioData(await response.arrayBuffer()));
    }
    onProgress(5 + (20 * ++done) / needed.size, '正在準備樂器音色…');
  }
  const sr = 44100,
    offline = new OfflineAudioContext(2, Math.ceil(seconds * sr), sr);
  const master = offline.createGain();
  master.gain.value = 0.65;
  master.connect(offline.destination);
  const sec = 60 / score.bpm;
  const schedule = event => {
    const sample = sampleFor(event),
      buffer = buffers.get(sample.url);
    const source = offline.createBufferSource(),
      gain = offline.createGain(),
      pan = offline.createStereoPanner();
    source.buffer = buffer;
    source.playbackRate.value = 2 ** ((event.p - sample.pitch) / 12);
    const t = event.t * sec,
      d = event.d * sec;
    const attack = sample.inst === 'piano' ? 0.003 : sample.inst === 'flute' ? 0.04 : 0.13;
    if (sample.inst !== 'piano' && d > (buffer.duration / source.playbackRate.value) * 0.8) {
      source.loop = true;
      source.loopStart = buffer.duration * 0.25;
      source.loopEnd = buffer.duration * 0.75;
    }
    if (!peaks.has(sample.url)) {
      const data = buffer.getChannelData(0);
      let peak = 0;
      for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
      peaks.set(sample.url, peak);
    }
    const level = event.g * (sample.inst === 'piano' ? 1 : 0.38 / Math.max(0.01, peaks.get(sample.url)));
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + Math.min(attack, d / 4));
    gain.gain.setValueAtTime(level, t + Math.max(d - 0.05, attack));
    gain.gain.linearRampToValueAtTime(0, t + d + 0.15);
    pan.pan.value = event.pan;
    source.connect(gain).connect(pan).connect(master);
    source.start(t);
    source.stop(t + d + 0.16);
  };
  const order = [...ev].sort((a, b) => a.t - b.t);
  let next = 0;
  const scheduleUntil = end => {
    while (next < order.length && order[next].t * sec < end) schedule(order[next++]);
  };
  const fallback = () => {
    scheduleUntil(Infinity);
    if (offline.state === 'suspended') return offline.resume();
  };
  scheduleUntil(20);
  for (let at = 10; at < seconds; at += 10) {
    try {
      offline
        .suspend(at)
        .then(() => {
          scheduleUntil(at + 20);
          return offline.resume();
        })
        .catch(() => fallback()?.catch(() => {}));
    } catch {
      fallback()?.catch(() => {});
      break;
    }
  }
  onProgress(30, '正在合成演奏…');
  const rendered = await offline.startRendering();
  const left = rendered.getChannelData(0),
    right = rendered.getChannelData(1);
  let peak = 0;
  for (let i = 0; i < left.length; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  if (!Number.isFinite(peak) || peak === 0) throw Error('產生的音訊無效。');
  const gain = 0.85 / peak;
  for (let i = 0; i < left.length; i++) {
    left[i] *= gain;
    right[i] *= gain;
  }
  onProgress(55, '正在編碼 MP3…');
  return await new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./encode-worker.js', import.meta.url));
    const fail = error => {
      clearTimeout(timer);
      worker.terminate();
      reject(error);
    };
    const timer = setTimeout(
      () => fail(Error('編碼逾時，請減少遍數後重試。')),
      Math.max(180000, seconds * 500)
    );
    let offset = 0;
    const sendNext = () => {
      if (offset === left.length) {
        worker.postMessage({finish: true});
        return;
      }
      const end = Math.min(offset + sr * 10, left.length);
      const l = left.slice(offset, end),
        r = right.slice(offset, end);
      offset = end;
      worker.postMessage({left: l, right: r}, [l.buffer, r.buffer]);
    };
    worker.onmessage = ({data}) => {
      try {
        if (data.error) {
          fail(Error(data.error));
          return;
        }
        if (data.ready) {
          onProgress(55 + (offset / left.length) * 44, '正在編碼 MP3…');
          sendNext();
          return;
        }
        clearTimeout(timer);
        worker.terminate();
        resolve(new Blob([data.bytes], {type: 'audio/mpeg'}));
      } catch (error) {
        fail(error);
      }
    };
    worker.onerror = () => fail(Error('MP3 編碼失敗。'));
    worker.postMessage({sr});
  });
}
