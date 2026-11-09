// 拍數一律以四分音符計；弱起與不完整的末小節保留實際長度。
export function locateBar(score, section, index, occurrence) {
  let pos = 0, count = 0;
  for (const entry of score.form) {
    const chosen = entry.section === section && ++count === occurrence;
    const bars = score.sections[entry.section];
    for (let i = 0; i < bars.length; i++) {
      const beats = bars[i].beats ?? score.meter[0] * 4 / score.meter[1];
      if (!Number.isFinite(beats) || beats <= 0) throw Error('小節拍數無效。');
      if (chosen && i === index) return {first: pos, last: pos + beats};
      pos += beats;
    }
  }
  throw Error('目前曲式中沒有選定的段落或遍次。');
}

export function onsetMap(notes = [], events = []) {
  const sounding = notes.filter(n => n.midi !== null);
  if (!events.length || sounding.length !== events.length || sounding[0].q !== 0) return null;
  const points = sounding.map((n, i) => [n.q / 4, events[i].start]);
  const last = notes.at(-1);
  points.push([(last.q + last.duration) / 4, events.at(-1).end]);
  if (points.some(([b, t], i) => !Number.isFinite(b) || !Number.isFinite(t) || t < 0 ||
      (i && (b <= points[i - 1][0] || t <= points[i - 1][1])))) return null;
  return points;
}
function mapped(beat, points) {
  for (let i = 1; i < points.length; i++) {
    const [b, t] = points[i], [prev, time] = points[i - 1];
    if (beat <= b) return time + (beat - prev) * (t - time) / (b - prev) - points[0][1];
  }
  throw Error('此小節已超過辨識時間表，請指定錄音 BPM 來估算。');
}
export function clipRange({first, last}, {bpm, offset, duration, points, origin = 0, nextSeconds = Infinity}) {
  if (![bpm, offset, duration].every(Number.isFinite) || bpm <= 0 || offset < 0 || duration <= 0)
    throw Error('請先載入原錄音，並確認起點與 BPM。');
  const time = beat => offset + (points ? mapped(beat, points) - mapped(origin, points) : (beat - origin) * 60 / bpm);
  const start = time(first), end = Math.min(duration, nextSeconds, time(last));
  if (start >= nextSeconds) throw Error('小節起點已超過下一個校準點，請核對段落起點與速度。');
  if (!(end > start)) throw Error('這一小節不在錄音範圍內，請核對起點、BPM 或遍次。');
  return {start, end};
}

export function latestAnchor(anchors, beat) {
  return anchors.reduce((last, a) => a.beat <= beat && (!last || a.beat > last.beat) ? a : last, null);
}
export function saveAnchor(anchors, anchor, duration) {
  if (!Number.isFinite(duration) || !Number.isFinite(anchor.seconds) || anchor.seconds < 0 ||
      anchor.seconds >= duration) throw Error('起點須在錄音範圍內。');
  const next = [...anchors.filter(a => a.beat !== anchor.beat), anchor].sort((a, b) => a.beat - b.beat);
  if (next.some((a, i) => i && a.seconds <= next[i - 1].seconds))
    throw Error('較晚段落的起點必須晚於前一個校準點。');
  return next;
}
