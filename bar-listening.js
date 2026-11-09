import {$} from './dom.js';
import {locateBar, clipRange, onsetMap, latestAnchor, saveAnchor} from './bar-audition.js';

export function connectBarListening(review, state) {
  let points, signature, lastSection, anchors = [], layout, anchorView;
  const player = $('sourcePlayer');
  const shape = score => JSON.stringify([score.bpm, score.meter, score.form.map(f => f.section),
    Object.entries(score.sections).map(([key, bars]) => [key, bars.map(b => b.beats ?? null)])]);
  const geometry = score => JSON.stringify([score.meter, score.form.map(f => f.section),
    Object.entries(score.sections).map(([key, bars]) => [key, bars.map(b => b.beats ?? null)])]);
  const selected = () => {
    const {score, current, name} = state(), pass = Number($('barPass').value);
    const beat = locateBar(score, current, 0, pass).first;
    return {beat, title: name + ' 第 ' + pass + ' 次'};
  };
  const syncAnchor = (force = false) => {
    const {score} = state();
    if (!score || !$('barPass').value) { $('anchorInfo').textContent = '此段落未列入曲式。'; return; }
    const target = selected(), exact = anchors.find(a => a.beat === target.beat);
    const key = JSON.stringify([target, exact?.seconds]);
    if (force || key !== anchorView) {
      $('anchorTime').value = exact?.seconds ?? '';
      anchorView = key;
    }
    $('anchorInfo').textContent = target.title + (exact ? ' · 已設為 ' + exact.seconds + ' 秒' : ' · 未設獨立起點');
  };
  const say = text => { $('barStatus').textContent = text; };
  const stop = () => { review.cancelBar(); };
  const reset = () => {
    stop();
    points = signature = null;
    anchors = []; anchorView = null; layout = null;
    $('anchorInfo').textContent = ''; $('anchorTime').value = '';
    $('barOffset').value = '0';
    $('barTempo').value = '';
    say('點小節號可聽原錄音。');
  };
  $('audioFile').addEventListener('change', () => { reset(); syncAnchor(true); });
  const setTime = now => {
    try {
      if (!player.getAttribute('src') || !Number.isFinite(player.duration)) throw Error('請先選取原錄音。');
      const seconds = now ? Math.round(player.currentTime * 1000) / 1000 :
        ($('anchorTime').value === '' ? NaN : Number($('anchorTime').value));
      anchors = saveAnchor(anchors, {...selected(), seconds}, player.duration);
      layout = geometry(state().score);
      stop(); syncAnchor(true);
    } catch (e) { $('anchorInfo').textContent = e.message; }
  };
  $('anchorSet').onclick = () => setTime(false);
  $('anchorNow').onclick = () => setTime(true);
  $('anchorClear').onclick = () => {
    try { const {beat} = selected(); anchors = anchors.filter(a => a.beat !== beat); stop(); syncAnchor(true); }
    catch (e) { $('anchorInfo').textContent = e.message; }
  };
  $('barPass').addEventListener('change', () => syncAnchor(true));
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
      if (anchors.length && geometry(score) !== layout) { anchors = []; anchorView = null; }
      const count = score.form.filter(f => f.section === current).length, select = $('barPass');
      if (lastSection === current && select.options.length === count) { syncAnchor(); return; }
      const pass = lastSection === current ? Number(select.value) || 1 : 1;
      lastSection = current;
      select.replaceChildren(...Array.from({length: count}, (_, i) => new Option('第 ' + (i + 1) + ' 次', i + 1)));
      select.value = String(Math.min(pass, count));
      syncAnchor(true);
    },
    async play(index) {
      stop();
      try {
        if (!player.getAttribute('src') || !Number.isFinite(player.duration))
          throw Error('請先在「匯入 → 錄音」選取原錄音，等播放器載入。');
        const {score, current, name} = state(), pass = Number($('barPass').value);
        const raw = $('barTempo').value, useMap = points && !raw && signature === shape(score);
        const bounds = locateBar(score, current, index, pass), anchor = latestAnchor(anchors, bounds.first);
        const next = anchors.find(a => a.beat > bounds.first);
        const range = clipRange(bounds, {duration: player.duration, origin: anchor?.beat ?? 0,
          nextSeconds: next?.seconds ?? Infinity,
          offset: anchor?.seconds ?? ($('barOffset').value === '' ? NaN : Number($('barOffset').value)),
          bpm: raw ? Number(raw) : score.bpm, points: useMap ? points : null});
        say(`${name}第 ${pass} 次，第 ${index + 1} 小節 · ${range.start.toFixed(2)}–${range.end.toFixed(2)} 秒 · ` +
          (useMap ? '依辨識起音定位' : '依固定 BPM 估算') + (anchor ? ' · 校準：' + anchor.title : ''));
        await review.playBar(range, $('barRepeat').checked);
      } catch (e) { say(e.message); }
    }
  };
}
