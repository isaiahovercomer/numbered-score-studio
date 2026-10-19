// 和弦：依旋律建議編配、儲存／套用錄音估計的和弦時間表。
import {KEYS, chordVoicing} from './music.js';
import {$} from './dom.js';

export function connectChords({getScore, installScore, status, download, chordState}) {
  $('suggestChords').onclick = () => {
    try {
      const s = getScore(),
        candidates = [0, 2, 4, 5, 7, 9, 11].map(
          (interval, i) =>
            Object.keys(KEYS).find(k => KEYS[k] === (KEYS[s.key] + interval) % 12) +
            ['', 'm', 'm', '', '', 'm', 'dim'][i]
        );
      candidates.push(Object.keys(KEYS).find(k => KEYS[k] === (KEYS[s.key] + 7) % 12) + '7');
      for (const bars of Object.values(s.sections))
        for (const b of bars) {
          if (b.chord || b.chordChanges?.length) continue;
          let best = {score: -Infinity, text: s.key};
          for (const symbol of candidates) {
            const c = chordVoicing(symbol),
              pcs = c.tones.map(p => p % 12);
            let value = 0;
            for (const [p, d] of b.notes) if (p !== null) value += d * (pcs.includes(p % 12) ? 1 : -0.6);
            if (symbol === s.key) value += 0.1;
            if (value > best.score) best = {score: value, text: symbol};
          }
          b.chord = best.text;
          b.chordChanges = [{beat: 0, text: best.text}];
          s.chords[best.text] = chordVoicing(best.text);
        }
      s.warnings = [...(s.warnings || []), '和弦為根據旋律的建議編配，非錄音伴奏辨識。'];
      installScore(s);
      status('已為空白小節加入建議和弦，原有和弦保留。請試奏校對。');
    } catch (e) {
      status(e.message, true);
    }
  };
  $('saveChords').onclick = () =>
    download(
      new Blob(
        [
          JSON.stringify(
            {
              method: 'browser-chroma-template-experimental',
              bpm: Number($('sourceBpm').value),
              chords: chordState.timeline
            },
            null,
            2
          )
        ],
        {type: 'application/json'}
      ),
      '和弦時間表.json'
    );
  $('applyChords').onclick = () => {
    try {
      const s = getScore(),
        offset = Number($('alignmentOffset').value);
      if (!Number.isFinite(offset) || offset < 0) throw Error('請填入正確錄音起點。');
      if (s.key !== $('sourceKey').value || s.bpm !== Number($('sourceBpm').value))
        throw Error('請先將樂譜調性及 BPM 設為與錄音一致。');
      let at = 0;
      for (const bars of Object.values(s.sections))
        for (const b of bars) {
          const length = b.notes.reduce((n, x) => n + x[1], 0),
            a = offset + (at * 60) / s.bpm,
            z = offset + ((at + length) * 60) / s.bpm;
          const held = chordState.timeline.filter(c => c.time <= a).at(-1);
          const cs = [
            ...(held ? [{time: a, text: held.text}] : []),
            ...chordState.timeline.filter(c => c.time > a && c.time < z)
          ];
          b.chordChanges = cs.filter(c => c.text !== 'N').map(c => ({beat: ((c.time - a) * s.bpm) / 60, text: c.text}));
          b.chord = b.chordChanges[0]?.text || '';
          for (const c of b.chordChanges) s.chords[c.text] = chordVoicing(c.text);
          at += length;
        }
      s.warnings = [...(s.warnings || []), '和弦依錄音起點及固定速度對位，尚未驗證反覆與速度變化。'];
      installScore(s);
      status('估計和弦已套入，請核對拍點及前奏位置。');
    } catch (e) {
      status(e.message, true);
    }
  };
}
