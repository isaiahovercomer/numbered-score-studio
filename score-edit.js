// 樂譜編輯的純函式（不碰 DOM）：移調與曲式。
import {KEYS} from './music.js';

// 把 score 就地移調到 next 調（音符、和弦名稱與和弦音高一起移，最短距離）。
export function transposeScore(score, next) {
  let delta = KEYS[next] - KEYS[score.key];
  if (delta > 6) delta -= 12;
  if (delta < -6) delta += 12;
  for (const bars of Object.values(score.sections))
    for (const b of bars) for (const n of b.notes) if (n[0] !== null) n[0] += delta;
  const old = score.chords || {},
    chords = {};
  const transposeSymbol = s =>
    s.replace(/[A-G][b#]?/g, x => {
      const pc = {...KEYS, 'C#': 1, 'D#': 3, 'F#': 6, 'G#': 8, 'A#': 10}[x];
      return Object.keys(KEYS).find(k => KEYS[k] === (pc + delta + 12) % 12) || x;
    });
  for (const [name, c] of Object.entries(old))
    chords[transposeSymbol(name)] = {bass: c.bass + delta, tones: c.tones.map(p => p + delta)};
  for (const bs of Object.values(score.sections))
    for (const b of bs) {
      if (b.chord) b.chord = transposeSymbol(b.chord);
      for (const c of b.chordChanges || []) c.text = transposeSymbol(c.text);
    }
  score.chords = chords;
  score.key = next;
}

// 依遍數與「最後再奏一次副歌」重建曲式；回傳新的 form 陣列（不修改傳入的 sections）。
export function buildForm(sections, n, finalChorus) {
  const secs = Object.keys(sections),
    form = [];
  for (let i = 0; i < n; i++)
    for (const s of secs)
      form.push({
        section: s,
        intensity: i === 0 ? 0.85 : i === 2 ? 0.8 : 1,
        strings: s === 'chorus' || i % 2 === 1,
        flute: s === 'chorus' || i > 0
      });
  if (finalChorus) {
    const s = secs.includes('chorus') ? 'chorus' : secs.at(-1);
    form.push({section: s, intensity: 1.1, strings: true, flute: true});
  }
  return form;
}
