import {$} from './dom.js';
import {locateBar, clipRange, onsetMap} from './bar-audition.js';

export function connectBarListening(review, state) {
  let points, signature, lastSection;
  const player = $('sourcePlayer');
  const shape = score => JSON.stringify([score.bpm, score.meter, score.form.map(f => f.section),
    Object.entries(score.sections).map(([key, bars]) => [key, bars.map(b => b.beats ?? null)])]);
  const say = text => { $('barStatus').textContent = text; };
  const stop = () => { review.cancelBar(); };
  const reset = () => {
    stop();
    points = signature = null;
    $('barOffset').value = '0';
    $('barTempo').value = '';
    say('點小節號可聽原錄音。');
  };
  $('audioFile').addEventListener('change', reset);
  $('barStop').onclick = () => { stop(); say('已停止小節對聽。'); };
  for (const id of ['barOffset', 'barTempo', 'barPass', 'barRepeat']) $(id).addEventListener('input', stop);
  return {
    clearMap: reset,
    setMap(data) {
      points = onsetMap(data.notes, data.events);
      if (points) {
        signature = shape(state().score);
        $('barOffset').value = points[0][1].toFixed(3);
      }
    },
    update() {
      stop();
      const {score, current} = state();
      if (!score) return;
      const count = score.form.filter(f => f.section === current).length, select = $('barPass');
      if (lastSection === current && select.options.length === count) return;
      const pass = lastSection === current ? Number(select.value) || 1 : 1;
      lastSection = current;
      select.replaceChildren(...Array.from({length: count}, (_, i) => new Option('第 ' + (i + 1) + ' 次', i + 1)));
      select.value = String(Math.min(pass, count));
    },
    async play(index) {
      stop();
      try {
        if (!player.getAttribute('src') || !Number.isFinite(player.duration))
          throw Error('請先在「匯入 → 錄音」選取原錄音，等播放器載入。');
        const {score, current, name} = state(), pass = Number($('barPass').value);
        const raw = $('barTempo').value, useMap = points && !raw && signature === shape(score);
        const range = clipRange(locateBar(score, current, index, pass), {duration: player.duration,
          offset: $('barOffset').value === '' ? NaN : Number($('barOffset').value),
          bpm: raw ? Number(raw) : score.bpm, points: useMap ? points : null});
        say(`${name}第 ${pass} 次，第 ${index + 1} 小節 · ${range.start.toFixed(2)}–${range.end.toFixed(2)} 秒 · ` +
          (useMap ? '依辨識起音定位' : '依固定 BPM 估算'));
        await review.playBar(range, $('barRepeat').checked);
      } catch (e) { say(e.message); }
    }
  };
}
