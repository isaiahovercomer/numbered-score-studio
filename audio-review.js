// 原錄音校對：僅控制本機播放器，不修改譜面或分析輸入。
export function validateLoop(start, end, duration) {
  if (String(start).trim() === '' || String(end).trim() === '') throw Error('請填入起點與終點秒數。');
  start = Number(start);
  end = Number(end);
  if (![start, end, duration].every(Number.isFinite) || start < 0 || end > duration || end - start < 0.5) {
    throw Error('區間須在錄音範圍內，且終點至少比起點晚 0.5 秒。');
  }
  return {start, end};
}

export function connectAudioReview(player) {
  const panel = document.createElement('fieldset');
  panel.hidden = true;
  panel.id = 'audioReview';
  panel.style.cssText = 'min-width:0;margin:12px 0;padding:12px;border:1px solid #ccc;border-radius:8px';
  panel.innerHTML = `
    <legend>原錄音校對</legend>
    <label>試聽速度<select id="reviewRate">
      <option value="0.5">0.5 倍</option><option value="0.75">0.75 倍</option>
      <option value="1" selected>原速</option></select></label>
    <div class="analysis-settings">
      <label>起點（秒）<input id="reviewStart" type="number" min="0" step="0.01" value="0"></label>
      <label>終點（秒）<input id="reviewEnd" type="number" min="0" step="0.01"></label>
    </div>
    <button type="button" id="reviewMarkStart" class="quiet wide">目前位置設為起點</button>
    <button type="button" id="reviewMarkEnd" class="quiet wide">目前位置設為終點</button>
    <button type="button" id="reviewLoop" class="secondary wide" aria-pressed="false">循環播放片段</button>
    <p class="hint" id="reviewStatus" role="status" aria-live="polite"></p>
    <p class="hint">試聽速度不改變辨識結果。支援的瀏覽器會保持原音高；循環邊界可能略有延遲。</p>`;
  player.after(panel);
  const el = id => panel.querySelector('#' + id);
  let loop = null;
  let revision = 0;
  const stop = () => {
    revision++;
    loop = null;
    el('reviewLoop').textContent = '循環播放片段';
    el('reviewLoop').setAttribute('aria-pressed', 'false');
  };
  const rate = () => {
    player.preservesPitch = true;
    player.playbackRate = Number(el('reviewRate').value);
  };
  const reset = () => {
    stop();
    panel.hidden = true;
    el('reviewStatus').textContent = '';
  };
  player.addEventListener('loadstart', reset);
  player.addEventListener('emptied', reset);
  player.addEventListener('loadedmetadata', () => {
    if (!Number.isFinite(player.duration) || player.duration <= 0) return;
    el('reviewStart').value = '0';
    el('reviewEnd').value = String(Math.floor(player.duration * 100) / 100);
    panel.hidden = false;
    rate();
  });
  player.addEventListener('error', () => { stop(); panel.hidden = true; });
  el('reviewRate').onchange = rate;
  for (const side of ['Start', 'End']) {
    el('reviewMark' + side).onclick = () => {
      stop();
      el('review' + side).value = String(Math.floor(Math.min(player.currentTime, player.duration) * 100) / 100);
    };
    el('review' + side).oninput = stop;
  }
  el('reviewLoop').onclick = async () => {
    if (loop) { stop(); player.pause(); return; }
    const operation = ++revision;
    let playing = false;
    try {
      loop = validateLoop(el('reviewStart').value, el('reviewEnd').value, player.duration);
      player.currentTime = loop.start;
      el('reviewLoop').textContent = '停止循環';
      el('reviewLoop').setAttribute('aria-pressed', 'true');
      el('reviewStatus').textContent = `循環範圍：${loop.start}–${loop.end} 秒。`;
      playing = true;
      await player.play();
    } catch (e) {
      if (operation !== revision) return;
      stop();
      if (e.name === 'AbortError') return;
      el('reviewStatus').textContent = playing ? '無法開始播放，請按播放器重試。' : e.message;
    }
  };
  player.addEventListener('timeupdate', () => {
    if (loop && !player.paused && (player.currentTime >= loop.end || player.currentTime < loop.start)) {
      player.currentTime = loop.start;
    }
  });
  player.addEventListener('ended', () => {
    if (!loop) return;
    player.currentTime = loop.start;
    const operation = revision;
    player.play().catch(e => {
      if (operation !== revision) return;
      stop();
      if (e.name !== 'AbortError') el('reviewStatus').textContent = '請按播放器繼續播放。';
    });
  });
}
