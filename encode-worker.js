importScripts('./lame.min.js');
let encoder, chunks, size;
const append = chunk => {
  if (chunk.length) {
    chunks.push(new Uint8Array(chunk));
    size += chunk.length;
  }
};
self.onmessage = ({data: {left, right, sr, finish}}) => {
  try {
    if (sr) {
      encoder = new lamejs.Mp3Encoder(2, sr, 192);
      chunks = [];
      size = 0;
    } else if (finish) {
      append(encoder.flush());
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      self.postMessage({bytes}, [bytes.buffer]);
      return;
    } else {
      for (let i = 0; i < left.length; i += 1152) {
        const end = Math.min(i + 1152, left.length),
          l = new Int16Array(end - i),
          r = new Int16Array(end - i);
        for (let j = i; j < end; j++) {
          l[j - i] = Math.max(-32768, Math.min(32767, Math.round(left[j] * 32767)));
          r[j - i] = Math.max(-32768, Math.min(32767, Math.round(right[j] * 32767)));
        }
        append(encoder.encodeBuffer(l, r));
      }
    }
    // 背壓：主執行緒收到確認才傳下一段，不堆積整首 PCM 複本。
    self.postMessage({ready: true});
  } catch (error) {
    self.postMessage({error: error.message});
  }
};
