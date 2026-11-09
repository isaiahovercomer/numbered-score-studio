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
export function clipRange({first, last}, {bpm, offset, duration, points}) {
  if (![bpm, offset, duration].every(Number.isFinite) || bpm <= 0 || offset < 0 || duration <= 0)
    throw Error('請先載入原錄音，並確認起點與 BPM。');
  const time = beat => offset + (points ? mapped(beat, points) : beat * 60 / bpm);
  const start = time(first), end = Math.min(duration, time(last));
  if (!(end > start)) throw Error('這一小節不在錄音範圍內，請核對起點、BPM 或遍次。');
  return {start, end};
}
