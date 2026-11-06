import {createHistory, readDraft, saveDraft, DRAFT_KEY} from './project-history.js';
import {validateScore} from './music.js';
import {$} from './dom.js';

const settings = ['mode', 'wordPreset', 'wordPaper', 'wordMarks', 'wordLyricLayout', 'wordTempo', 'wordWording'];
export function connectProjectSession({getScore, installScore, isBusy}) {
  let history, versions = [], restoring = false, timer, conflict = false, lastRaw = null, writeAllowed = false;
  const message = text => { $('draftStatus').textContent = text; };
  const project = () => ({
    score: getScore(),
    settings: Object.fromEntries(settings.map(id => [id, $(id).type === 'checkbox' ? $(id).checked : $(id).value]))
  });
  function update() {
    let invalid = false;
    try { getScore(); } catch { invalid = true; }
    $('undoEdit').disabled = isBusy() || (!invalid && !history?.canUndo);
    $('redoEdit').disabled = isBusy() || !history?.canRedo;
  }
  function persist() {
    if (conflict || !writeAllowed) return;
    const write = () => {
      if (conflict) return;
      try {
        if (localStorage.getItem(DRAFT_KEY) !== lastRaw) {
          conflict = true;
          message('另一個分頁已更新草稿，已暫停儲存。請先下載 JSON 備份，再重新整理。');
          return;
        }
        saveDraft(localStorage, project(), versions);
        lastRaw = localStorage.getItem(DRAFT_KEY);
        message('已儲存於此瀏覽器 · ' + new Date().toLocaleTimeString('zh-TW'));
      } catch {
        message('草稿尚未儲存：請修正樂譜或下載 JSON 備份；瀏覽器儲存空間可能不足。');
      }
    };
    write();
  }
  function capture() {
    if (restoring || !history) return;
    clearTimeout(timer);
    try { history.record(project()); } catch {}
    update();
    persist();
  }
  function restore(value) {
    restoring = true;
    try {
      installScore(value.score);
      for (const id of settings) {
        const v = value.settings?.[id];
        if ($(id).type === 'checkbox') {
          if (typeof v === 'boolean') $(id).checked = v;
        } else if ([...$(id).options].some(o => o.value === v)) $(id).value = v;
      }
      $('wordPaper').dispatchEvent(new Event('change'));
    } finally { restoring = false; }
    update();
  }
  function listVersions() {
    $('versionList').replaceChildren(...versions.map((v, i) => {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = `${new Date(v.time).toLocaleString('zh-TW')} · ${v.project.score.title || '未命名'}`;
      return option;
    }).reverse());
    $('restoreVersion').disabled = !versions.length;
  }
  function step(direction) {
    if (isBusy()) return;
    try { project(); } catch {
      if (direction === 'undo') { restore(history.current); persist(); }
      return;
    }
    capture();
    const value = history[direction]();
    if (value) { restore(value); persist(); }
    update();
  }
  $('undoEdit').onclick = () => step('undo');
  $('redoEdit').onclick = () => step('redo');
  $('saveVersion').onclick = () => {
    if (isBusy()) return;
    try {
      capture();
      versions.push({time: new Date().toISOString(), project: project()});
      versions = versions.slice(-20);
      listVersions();
      persist();
    } catch { message('請先修正樂譜，再儲存版本。'); }
  };
  $('restoreVersion').onclick = () => {
    if (isBusy()) return;
    const v = versions[Number($('versionList').value)];
    if (v) { capture(); restore(v.project); capture(); }
  };
  document.addEventListener('change', e => {
    if (settings.includes(e.target.id)) capture();
  });
  window.addEventListener('pagehide', capture);
  document.addEventListener('visibilitychange', () => { if (document.hidden) capture(); });
  window.addEventListener('storage', e => {
    if (e.key === DRAFT_KEY) {
      conflict = true;
      message('另一個分頁已更新草稿，本頁暫停自動儲存。請先下載 JSON 備份，再重新整理。');
    }
  });
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y') {
      e.preventDefault();
      step(e.shiftKey || e.key.toLowerCase() === 'y' ? 'redo' : 'undo');
    }
  });
  return {
    capture,
    update,
    schedule() { clearTimeout(timer); timer = setTimeout(capture, 600); },
    async start() {
      const initialize = () => {
      try {
        lastRaw = localStorage.getItem(DRAFT_KEY);
        const saved = readDraft(localStorage, validateScore);
        if (saved) { versions = saved.versions; restore(saved.draft); }
        message(saved ? '已恢復上次草稿；原始音檔及圖片請重新選取。' : '修改後自動儲存在此瀏覽器。');
      } catch {
        conflict = true;
        message('無法讀取既有草稿，已保留原資料並暫停儲存。請使用 JSON 下載備份。');
      }
      history = createHistory(project());
      listVersions();
      update();
      if (!writeAllowed) message('另一個分頁正在編輯，或瀏覽器不支援安全儲存。本頁請下載 JSON 保留修改。');
      };
      if (!navigator.locks) { initialize(); return; }
      await new Promise(resolve => {
        navigator.locks.request(DRAFT_KEY, {ifAvailable: true}, lock => {
          writeAllowed = !!lock;
          initialize();
          resolve();
          // 持有此分頁的寫入權直到離開；pagehide 能同步完成最後一次保存。
          if (lock) return new Promise(() => {});
        }).catch(() => { initialize(); resolve(); });
      });
    }
  };
}
