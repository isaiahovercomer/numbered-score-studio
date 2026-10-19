// Word 匯出面板：版式選項、說明文字、匯出與官方用字回報。
import {wordBlob, PRESETS, PAPERS, wordingHints, wordingChanges, describeChanges} from './word-export.js';
import {$} from './dom.js';

export function connectWordExport({getScore, status, download}) {
  const wordOptions = () => ({
    preset: $('wordPreset').value,
    paper: $('wordPaper').value,
    verseMarks: $('wordMarks').value,
    tempo: $('wordTempo').checked,
    copyright: $('wordCopyright').value,
    wording: $('wordWording').checked
  });
  const wordHint = () => {
    const o = wordOptions(),
      p = PRESETS[o.preset];
    $('wordHint').innerHTML =
      `${PAPERS[o.paper].name} · 01SMN 簡譜 · ${p.textFont}歌詞<br>深紅和弦／數字下標 · 詞譜整組置中`;
  };
  $('wordPreset').onchange = () => {
    const p = PRESETS[$('wordPreset').value];
    $('wordPaper').value = p.paper;
    $('wordMarks').value = p.verseMarks;
    $('wordTempo').checked = p.tempo;
    $('wordWording').checked = p.wording;
    wordHint();
  };
  for (const id of ['wordPaper', 'wordMarks', 'wordTempo', 'wordWording']) $(id).onchange = wordHint;
  $('exportWord').onclick = () => {
    try {
      const s = getScore(),
        o = wordOptions();
      download(wordBlob(s, o), (s.title || '詞譜') + '_' + PAPERS[o.paper].name + '.docx');
      const text = (s.title || '') + '\n\n' + (s.lyrics || ''),
        changes = wordingChanges(s, o),
        hints = wordingHints(text, {applied: o.wording}),
        shown = hints.slice(0, 4).join('；') + (hints.length > 4 ? '…等 ' + hints.length + ' 項' : '');
      status(
        'Word 已產生。請用安裝 01SMN 與' +
          PRESETS[o.preset].textFont +
          '的 Word 開啟；長譜可能分頁。' +
          (o.wording
            ? changes.length
              ? '已依官方用字輸出（只改輸出，原稿未動）：' + describeChanges(changes) + '。'
              : '官方用字檢查：沒有需要替換的詞。'
            : '') +
          (hints.length
            ? (o.wording ? '待確認（未自動替換）：' : '用字提醒（官方寫法，未自動改寫）：') + shown + '。'
            : '')
      );
    } catch (e) {
      status(e.message, true);
    }
  };
}
